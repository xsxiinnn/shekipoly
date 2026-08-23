-- PostgreSQL requires a newly-added enum value to be committed before it is
-- used by defaults, functions, or data changes later in the migration.
begin;

alter type public.report_status add value if not exists 'active';

commit;

begin;

alter table public.missions
add column description text not null default '';

update public.missions as missions
set
  name = seed.name,
  description = seed.description,
  base_score = seed.base_score,
  is_active = true
from (
  values
    (1::smallint, '任務一｜找到他', '打招呼、有聊天、關心近況', 1::smallint),
    (2::smallint, '任務二｜祝福他', '送小東西、小點心、一起吃飯', 1::smallint),
    (3::smallint, '任務三｜探訪他', '成功揪團/邀約到小組長來探訪', 2::smallint),
    (4::smallint, '任務四｜為他禱告', '發現朋友需求並實體為他祝福禱告', 2::smallint),
    (5::smallint, '任務五｜來烤肉', '成功邀請他來教會參加烤肉', 3::smallint),
    (6::smallint, '任務六｜來教會', '成功邀請他來教會參加崇拜／小組', 3::smallint)
) as seed(id, name, description, base_score)
where missions.id = seed.id;

alter table public.reports
add column activity_week smallint
  check (activity_week between 1 and 6);

alter table public.reports
add column scoring_sequence bigint generated always as identity;

update public.reports
set activity_week = public.activity_week_for(created_at)
where activity_week is null;

comment on column public.reports.activity_week is
  '依 Asia/Taipei 活動日期由 trusted server/database 決定；client 不可寫入。';

alter table public.reports
alter column status set default 'active';

create index reports_team_week_status_created_idx
  on public.reports(team_id, activity_week, status, scoring_sequence);

create or replace function public.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_base_score smallint;
  profile_team_id uuid;
begin
  select profiles.team_id
  into profile_team_id
  from public.profiles
  join public.teams on teams.id = profiles.team_id
  where profiles.id = new.user_id
    and teams.is_active = true;

  if profile_team_id is null then
    raise exception 'REPORT_PROFILE_REQUIRED'
      using errcode = 'P0001';
  end if;

  select missions.base_score
  into calculated_base_score
  from public.missions
  where missions.id = new.mission_id
    and missions.is_active = true;

  if calculated_base_score is null then
    raise exception 'REPORT_MISSION_INVALID'
      using errcode = 'P0001';
  end if;

  new.team_id := profile_team_id;
  new.base_score := calculated_base_score;
  new.mission_score := calculated_base_score * case when new.is_3x5 then 2 else 1 end;
  new.photo_is_valid := false;
  new.photo_bonus := 0;
  new.raw_score := new.mission_score;
  new.accepted_score := 0;

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.status := 'active';
    new.activity_week := coalesce(
      new.activity_week,
      public.activity_week_for(new.created_at)
    );

    if new.activity_week is null then
      raise exception 'REPORT_OUTSIDE_ACTIVITY'
        using errcode = 'P0001';
    end if;
  else
    new.created_at := old.created_at;
    new.activity_week := old.activity_week;
  end if;

  return new;
end;
$$;

drop trigger if exists reports_prepare_score on public.reports;

create trigger reports_prepare_score
before insert or update of
  user_id,
  friend_alias,
  is_3x5,
  mission_id,
  story,
  photo_path,
  photo_is_valid,
  status,
  created_at,
  activity_week
on public.reports
for each row execute function public.prepare_report();

create or replace function public.recalculate_team_week(
  target_team_id uuid,
  target_activity_week smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_accepted smallint;
begin
  if target_activity_week is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_team_id::text || ':' || target_activity_week::text,
      0
    )
  );

  with active_reports as (
    select
      id,
      least(
        raw_score,
        greatest(
          30 - coalesce(
            sum(raw_score) over (
              order by scoring_sequence
              rows between unbounded preceding and 1 preceding
            ),
            0
          ),
          0
        )
      )::smallint as recalculated_score
    from public.reports
    where team_id = target_team_id
      and activity_week = target_activity_week
      and status = 'active'
  )
  update public.reports as reports_to_update
  set accepted_score = active_reports.recalculated_score
  from active_reports
  where reports_to_update.id = active_reports.id
    and reports_to_update.accepted_score is distinct from active_reports.recalculated_score;

  update public.reports
  set accepted_score = 0
  where team_id = target_team_id
    and activity_week = target_activity_week
    and status <> 'active'
    and accepted_score <> 0;

  select coalesce(sum(accepted_score), 0)::smallint
  into total_accepted
  from public.reports
  where team_id = target_team_id
    and activity_week = target_activity_week
    and status = 'active';

  update public.team_progress
  set
    accepted_score = total_accepted,
    updated_at = now()
  where team_id = target_team_id
    and activity_week = target_activity_week;
end;
$$;

create or replace function public.sync_team_week_scores()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_team_week(old.team_id, old.activity_week);
    return old;
  elsif tg_op = 'INSERT' then
    perform public.recalculate_team_week(new.team_id, new.activity_week);
    return new;
  end if;

  if old.team_id is distinct from new.team_id
    or old.activity_week is distinct from new.activity_week then
    perform public.recalculate_team_week(old.team_id, old.activity_week);
  end if;

  perform public.recalculate_team_week(new.team_id, new.activity_week);
  return new;
end;
$$;

drop trigger if exists reports_sync_team_week_scores on public.reports;

create trigger reports_sync_team_week_scores
after insert or delete or update of
  user_id,
  is_3x5,
  mission_id,
  photo_path,
  photo_is_valid,
  status,
  created_at,
  activity_week
on public.reports
for each row execute function public.sync_team_week_scores();

-- Reports created by the previous approval-based flow become active only when
-- they fall inside a formal activity week. Rejected and out-of-period rows stay unchanged.
update public.reports
set status = 'active'
where status in ('pending', 'accepted')
  and activity_week is not null;

create or replace view public.team_map_progress as
select
  team_progress.team_id,
  coalesce(sum(team_progress.accepted_score), 0)::integer as accepted_total,
  least(
    36,
    floor(coalesce(sum(team_progress.accepted_score), 0) / 5.0)::integer + 1
  )::smallint as current_square,
  case
    when least(
      36,
      floor(coalesce(sum(team_progress.accepted_score), 0) / 5.0)::integer + 1
    ) = 36 then 0
    when mod(coalesce(sum(team_progress.accepted_score), 0)::integer, 5) = 0 then 5
    else 5 - mod(coalesce(sum(team_progress.accepted_score), 0)::integer, 5)
  end::smallint as steps_to_next_square
from public.team_progress
group by team_progress.team_id;

comment on view public.team_map_progress is
  '六週 accepted_score 累積與 36 格位置的 database 單一來源。';

revoke all on table public.team_map_progress from anon, authenticated;
grant select on table public.team_map_progress to anon, authenticated;

create or replace function public.submit_report_internal(
  p_reporter_id uuid,
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text default '',
  p_activity_week_override integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reporter_id uuid := p_reporter_id;
  reporter_team_id uuid;
  reporter_team_name text;
  effective_activity_week smallint;
  created_report public.reports%rowtype;
  selected_mission_name text;
  weekly_accepted smallint;
  map_progress record;
begin
  if reporter_id is null then
    raise exception 'REPORT_AUTH_REQUIRED'
      using errcode = 'P0001';
  end if;

  if nullif(btrim(p_friend_alias), '') is null
    or length(btrim(p_friend_alias)) > 80 then
    raise exception 'REPORT_FRIEND_ALIAS_INVALID'
      using errcode = 'P0001';
  end if;

  if length(coalesce(p_story, '')) > 2000 then
    raise exception 'REPORT_STORY_TOO_LONG'
      using errcode = 'P0001';
  end if;

  if p_activity_week_override is not null
    and p_activity_week_override not between 1 and 6 then
    raise exception 'REPORT_WEEK_OVERRIDE_INVALID'
      using errcode = 'P0001';
  end if;

  select teams.id, teams.name
  into reporter_team_id, reporter_team_name
  from public.profiles
  join public.teams on teams.id = profiles.team_id
  where profiles.id = reporter_id
    and teams.is_active = true;

  if reporter_team_id is null then
    raise exception 'REPORT_PROFILE_REQUIRED'
      using errcode = 'P0001';
  end if;

  select missions.name
  into selected_mission_name
  from public.missions
  where missions.id = p_mission_id
    and missions.is_active = true;

  if selected_mission_name is null then
    raise exception 'REPORT_MISSION_INVALID'
      using errcode = 'P0001';
  end if;

  effective_activity_week := coalesce(
    p_activity_week_override::smallint,
    public.activity_week_for(now())
  );

  if effective_activity_week is null then
    raise exception 'REPORT_OUTSIDE_ACTIVITY'
      using errcode = 'P0001';
  end if;

  -- Serialize every report submission for the same team and activity week.
  -- The lock is acquired before INSERT, so each INSERT statement sees all
  -- previously committed reports when its after-trigger recalculates the cap.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      reporter_team_id::text || ':' || effective_activity_week::text,
      0
    )
  );

  insert into public.reports (
    user_id,
    team_id,
    friend_alias,
    is_3x5,
    mission_id,
    story,
    photo_path,
    photo_is_valid,
    status,
    activity_week
  ) values (
    reporter_id,
    reporter_team_id,
    btrim(p_friend_alias),
    p_is_3x5,
    p_mission_id::smallint,
    coalesce(p_story, ''),
    null,
    false,
    'active',
    effective_activity_week
  )
  returning * into created_report;

  -- INSERT RETURNING is evaluated before AFTER triggers. Read the row again so
  -- the RPC returns the accepted_score recalculated by the weekly-cap trigger.
  select reports.*
  into created_report
  from public.reports
  where reports.id = created_report.id;

  select team_progress.accepted_score
  into weekly_accepted
  from public.team_progress
  where team_progress.team_id = reporter_team_id
    and team_progress.activity_week = effective_activity_week;

  select *
  into map_progress
  from public.team_map_progress
  where team_map_progress.team_id = reporter_team_id;

  return jsonb_build_object(
    'report_id', created_report.id,
    'mission_name', selected_mission_name,
    'is_3x5', created_report.is_3x5,
    'raw_score', created_report.raw_score,
    'accepted_score', created_report.accepted_score,
    'activity_week', created_report.activity_week,
    'team_name', reporter_team_name,
    'team_weekly_score', coalesce(weekly_accepted, 0),
    'team_total_score', coalesce(map_progress.accepted_total, 0),
    'current_square', coalesce(map_progress.current_square, 1),
    'steps_to_next_square', coalesce(map_progress.steps_to_next_square, 5)
  );
end;
$$;

create or replace function public.submit_report(
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text default ''
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_internal(
    auth.uid(),
    p_friend_alias,
    p_mission_id,
    p_is_3x5,
    p_story,
    null
  );
$$;

create or replace function public.submit_report_for_development(
  p_reporter_id uuid,
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text,
  p_activity_week integer
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_internal(
    p_reporter_id,
    p_friend_alias,
    p_mission_id,
    p_is_3x5,
    p_story,
    p_activity_week
  );
$$;

-- Force application writes through the atomic RPC. Existing RLS remains enabled
-- and continues to protect reads and any future explicitly-granted table writes.
revoke insert (
  user_id,
  friend_alias,
  is_3x5,
  mission_id,
  story,
  photo_path,
  photo_is_valid,
  status
) on table public.reports from authenticated;

revoke execute on function public.submit_report_internal(uuid, text, integer, boolean, text, integer)
  from public, anon, authenticated;
revoke execute on function public.submit_report(text, integer, boolean, text)
  from public, anon;
grant execute on function public.submit_report(text, integer, boolean, text)
  to authenticated;

revoke execute on function public.submit_report_for_development(uuid, text, integer, boolean, text, integer)
  from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    grant execute on function public.submit_report_for_development(
      uuid, text, integer, boolean, text, integer
    ) to service_role;
  end if;
end;
$$;

revoke execute on function public.prepare_report() from public, anon, authenticated;
revoke execute on function public.recalculate_team_week(uuid, smallint)
  from public, anon, authenticated;
revoke execute on function public.sync_team_week_scores()
  from public, anon, authenticated;

-- Rebuild all formal team/week aggregates after migrating old active reports.
do $$
declare
  progress_row record;
begin
  for progress_row in
    select team_id, activity_week
    from public.team_progress
  loop
    perform public.recalculate_team_week(
      progress_row.team_id,
      progress_row.activity_week
    );
  end loop;
end;
$$;

commit;
