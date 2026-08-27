begin;

alter table public.reports
  rename column is_test to is_prelaunch_test;

comment on column public.reports.is_prelaunch_test is
  '由 trusted server 決定；預上線與本機 override 回報不得計入正式活動。';

alter table public.team_progress
  rename column is_test to is_prelaunch_test;

-- New uploads are browser-normalized. Existing stored PNG objects remain
-- readable, but no new unnormalized PNG can enter the bonus path.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/webp']::text[]
where id = 'mission-photos';

-- Scoring is still database-owned. Test week values survive only for rows
-- inserted by the service-role-only trusted RPC; official rows always use the
-- formal Asia/Taipei calendar.
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
    raise exception 'REPORT_PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

  select missions.base_score
  into calculated_base_score
  from public.missions
  where missions.id = new.mission_id
    and missions.is_active = true;

  if calculated_base_score is null then
    raise exception 'REPORT_MISSION_INVALID' using errcode = 'P0001';
  end if;

  new.team_id := profile_team_id;
  new.base_score := calculated_base_score;
  new.mission_score := calculated_base_score * case when new.is_3x5 then 2 else 1 end;
  new.photo_is_valid := coalesce(new.photo_is_valid, false) and new.photo_path is not null;
  new.photo_bonus := case when new.photo_is_valid then 3 else 0 end;
  new.raw_score := new.mission_score + new.photo_bonus;
  new.accepted_score := 0;

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.status := 'active';
    new.photo_visibility := 'visible';
    new.is_prelaunch_test := coalesce(new.is_prelaunch_test, false);

    if new.is_prelaunch_test then
      if new.activity_week is null or new.activity_week not between 1 and 6 then
        raise exception 'REPORT_WEEK_OVERRIDE_INVALID' using errcode = 'P0001';
      end if;
    else
      new.activity_week := public.activity_week_for(new.created_at);
      if new.activity_week is null then
        raise exception 'REPORT_OUTSIDE_ACTIVITY' using errcode = 'P0001';
      end if;
    end if;
  else
    new.created_at := old.created_at;
    new.activity_week := old.activity_week;
    new.is_prelaunch_test := old.is_prelaunch_test;
  end if;

  return new;
end;
$$;

drop trigger if exists reports_prepare_score on public.reports;
create trigger reports_prepare_score
before insert or update of
  user_id, friend_alias, is_3x5, mission_id, story, photo_path,
  photo_is_valid, status, created_at, activity_week, is_prelaunch_test
on public.reports
for each row execute function public.prepare_report();

create or replace function public.recalculate_team_week(
  target_team_id uuid,
  target_activity_week smallint,
  target_is_test boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_accepted smallint;
begin
  if target_team_id is null or target_activity_week is null or target_is_test is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_team_id::text || ':' || target_activity_week::text || ':' || target_is_test::text,
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
              order by created_at asc, id asc
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
      and is_prelaunch_test = target_is_test
      and status = 'active'
  )
  update public.reports as target
  set accepted_score = active_reports.recalculated_score
  from active_reports
  where target.id = active_reports.id
    and target.accepted_score is distinct from active_reports.recalculated_score;

  update public.reports
  set accepted_score = 0
  where team_id = target_team_id
    and activity_week = target_activity_week
    and is_prelaunch_test = target_is_test
    and status <> 'active'
    and accepted_score <> 0;

  select coalesce(sum(accepted_score), 0)::smallint
  into total_accepted
  from public.reports
  where team_id = target_team_id
    and activity_week = target_activity_week
    and is_prelaunch_test = target_is_test
    and status = 'active';

  insert into public.team_progress (
    team_id, activity_week, starts_on, ends_on, accepted_score, is_prelaunch_test, updated_at
  ) values (
    target_team_id,
    target_activity_week,
    (date '2026-08-31' + ((target_activity_week - 1) * 7)),
    (date '2026-09-06' + ((target_activity_week - 1) * 7)),
    least(total_accepted, 30),
    target_is_test,
    now()
  )
  on conflict (team_id, activity_week, is_prelaunch_test) do update
  set accepted_score = excluded.accepted_score,
      updated_at = excluded.updated_at;
end;
$$;

create or replace function public.recalculate_team_week(
  target_team_id uuid,
  target_activity_week smallint
)
returns void
language sql
security definer
set search_path = ''
as $$
  select public.recalculate_team_week(target_team_id, target_activity_week, false);
$$;

create or replace function public.sync_team_week_scores()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculate_team_week(old.team_id, old.activity_week, old.is_prelaunch_test);
    return old;
  elsif tg_op = 'INSERT' then
    perform public.recalculate_team_week(new.team_id, new.activity_week, new.is_prelaunch_test);
    return new;
  end if;

  if old.team_id is distinct from new.team_id
    or old.activity_week is distinct from new.activity_week
    or old.is_prelaunch_test is distinct from new.is_prelaunch_test then
    perform public.recalculate_team_week(old.team_id, old.activity_week, old.is_prelaunch_test);
  end if;

  perform public.recalculate_team_week(new.team_id, new.activity_week, new.is_prelaunch_test);
  return new;
end;
$$;

drop trigger if exists reports_sync_team_week_scores on public.reports;
create trigger reports_sync_team_week_scores
after insert or delete or update of
  user_id, is_3x5, mission_id, photo_path, photo_is_valid, status,
  created_at, activity_week, is_prelaunch_test
on public.reports
for each row execute function public.sync_team_week_scores();

drop view if exists public.team_map_progress;
create view public.team_map_progress as
select
  team_progress.team_id,
  coalesce(sum(team_progress.accepted_score), 0)::integer as accepted_total,
  least(36, floor(coalesce(sum(team_progress.accepted_score), 0) / 5.0)::integer + 1)::smallint as current_square,
  case
    when least(36, floor(coalesce(sum(team_progress.accepted_score), 0) / 5.0)::integer + 1) = 36 then 0
    when mod(coalesce(sum(team_progress.accepted_score), 0)::integer, 5) = 0 then 5
    else 5 - mod(coalesce(sum(team_progress.accepted_score), 0)::integer, 5)
  end::smallint as steps_to_next_square,
  team_progress.is_prelaunch_test
from public.team_progress
group by team_progress.team_id, team_progress.is_prelaunch_test;

comment on view public.team_map_progress is
  '依 official/test scope 分流的六週 accepted_score 累積與 36 格位置。';
revoke all on table public.team_map_progress from anon, authenticated;
grant select on table public.team_map_progress to anon, authenticated;

create or replace function public.submit_report_internal_v3(
  p_reporter_id uuid,
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text,
  p_activity_week_override integer,
  p_photo_path text,
  p_is_test boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reporter_team_id uuid;
  reporter_team_name text;
  effective_activity_week smallint;
  created_report public.reports%rowtype;
  selected_mission_name text;
  weekly_accepted smallint;
  map_progress record;
  normalized_photo_path text := nullif(btrim(p_photo_path), '');
  stored_photo_owner text;
  stored_photo_mime text;
  stored_photo_size bigint;
  has_valid_photo boolean := false;
begin
  if p_reporter_id is null then
    raise exception 'REPORT_AUTH_REQUIRED' using errcode = 'P0001';
  end if;
  if nullif(btrim(p_friend_alias), '') is null or length(btrim(p_friend_alias)) > 80 then
    raise exception 'REPORT_FRIEND_ALIAS_INVALID' using errcode = 'P0001';
  end if;
  if length(coalesce(p_story, '')) > 2000 then
    raise exception 'REPORT_STORY_TOO_LONG' using errcode = 'P0001';
  end if;
  if p_is_test and (p_activity_week_override is null or p_activity_week_override not between 1 and 6) then
    raise exception 'REPORT_WEEK_OVERRIDE_INVALID' using errcode = 'P0001';
  end if;
  if not p_is_test and p_activity_week_override is not null then
    raise exception 'REPORT_WEEK_OVERRIDE_INVALID' using errcode = 'P0001';
  end if;

  select teams.id, teams.name
  into reporter_team_id, reporter_team_name
  from public.profiles
  join public.teams on teams.id = profiles.team_id
  where profiles.id = p_reporter_id and teams.is_active = true;
  if reporter_team_id is null then
    raise exception 'REPORT_PROFILE_REQUIRED' using errcode = 'P0001';
  end if;

  select missions.name into selected_mission_name
  from public.missions
  where missions.id = p_mission_id and missions.is_active = true;
  if selected_mission_name is null then
    raise exception 'REPORT_MISSION_INVALID' using errcode = 'P0001';
  end if;

  effective_activity_week := case
    when p_is_test then p_activity_week_override::smallint
    else public.activity_week_for(now())
  end;
  if effective_activity_week is null then
    raise exception 'REPORT_OUTSIDE_ACTIVITY' using errcode = 'P0001';
  end if;

  if normalized_photo_path is not null then
    if split_part(normalized_photo_path, '/', 1) <> p_reporter_id::text
      or normalized_photo_path !~ ('^' || p_reporter_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|webp)$') then
      raise exception 'REPORT_PHOTO_NOT_OWNED' using errcode = 'P0001';
    end if;

    select owner_id::text, lower(metadata ->> 'mimetype'),
      case when metadata ->> 'size' ~ '^[0-9]+$' then (metadata ->> 'size')::bigint end
    into stored_photo_owner, stored_photo_mime, stored_photo_size
    from storage.objects
    where bucket_id = 'mission-photos' and name = normalized_photo_path;

    if stored_photo_owner is null or stored_photo_owner <> p_reporter_id::text then
      raise exception 'REPORT_PHOTO_NOT_OWNED' using errcode = 'P0001';
    end if;
    if stored_photo_mime not in ('image/jpeg', 'image/webp')
      or stored_photo_size is null or stored_photo_size <= 0 or stored_photo_size > 2097152 then
      raise exception 'REPORT_PHOTO_INVALID' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.reports where photo_path = normalized_photo_path and status = 'active') then
      raise exception 'REPORT_PHOTO_ALREADY_USED' using errcode = 'P0001';
    end if;
    has_valid_photo := true;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      reporter_team_id::text || ':' || effective_activity_week::text || ':' || p_is_test::text,
      0
    )
  );

  insert into public.reports (
    user_id, team_id, friend_alias, is_3x5, mission_id, story, photo_path,
    photo_is_valid, status, activity_week, is_prelaunch_test
  ) values (
    p_reporter_id, reporter_team_id, btrim(p_friend_alias), p_is_3x5,
    p_mission_id::smallint, coalesce(p_story, ''), normalized_photo_path,
    has_valid_photo, 'active', effective_activity_week, p_is_test
  ) returning * into created_report;

  select reports.* into created_report
  from public.reports where reports.id = created_report.id;

  select accepted_score into weekly_accepted
  from public.team_progress
  where team_id = reporter_team_id
    and activity_week = effective_activity_week
    and is_prelaunch_test = p_is_test;

  select * into map_progress
  from public.team_map_progress
  where team_id = reporter_team_id and is_prelaunch_test = p_is_test;

  return jsonb_build_object(
    'report_id', created_report.id,
    'mission_name', selected_mission_name,
    'is_3x5', created_report.is_3x5,
    'mission_score', created_report.mission_score,
    'photo_bonus', created_report.photo_bonus,
    'has_photo', created_report.photo_path is not null,
    'raw_score', created_report.raw_score,
    'accepted_score', created_report.accepted_score,
    'activity_week', created_report.activity_week,
    'team_name', reporter_team_name,
    'team_weekly_score', coalesce(weekly_accepted, 0),
    'team_total_score', coalesce(map_progress.accepted_total, 0),
    'current_square', coalesce(map_progress.current_square, 1),
    'steps_to_next_square', coalesce(map_progress.steps_to_next_square, 5),
    'is_prelaunch_test', created_report.is_prelaunch_test
  );
exception
  when unique_violation then
    raise exception 'REPORT_PHOTO_ALREADY_USED' using errcode = 'P0001';
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
  select public.submit_report_internal_v3(
    auth.uid(), p_friend_alias, p_mission_id, p_is_3x5, p_story, null, null, false
  );
$$;

create or replace function public.submit_report_trusted(
  p_reporter_id uuid,
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text,
  p_activity_week_override integer,
  p_photo_path text,
  p_is_test boolean
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_internal_v3(
    p_reporter_id, p_friend_alias, p_mission_id, p_is_3x5, p_story,
    p_activity_week_override, p_photo_path, p_is_test
  );
$$;

-- Keep existing trusted-server entry points working during a rolling deploy.
-- Development overrides are tests; ordinary photo submissions remain official.
create or replace function public.submit_report_for_development(
  p_reporter_id uuid, p_friend_alias text, p_mission_id integer,
  p_is_3x5 boolean, p_story text, p_activity_week integer
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_internal_v3(
    p_reporter_id, p_friend_alias, p_mission_id, p_is_3x5, p_story,
    p_activity_week, null, true
  );
$$;

create or replace function public.submit_report_for_development_v2(
  p_reporter_id uuid, p_friend_alias text, p_mission_id integer,
  p_is_3x5 boolean, p_story text, p_activity_week integer, p_photo_path text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_internal_v3(
    p_reporter_id, p_friend_alias, p_mission_id, p_is_3x5, p_story,
    p_activity_week, p_photo_path, true
  );
$$;

create or replace function public.submit_report_with_photo(
  p_reporter_id uuid, p_friend_alias text, p_mission_id integer,
  p_is_3x5 boolean, p_story text, p_photo_path text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_internal_v3(
    p_reporter_id, p_friend_alias, p_mission_id, p_is_3x5, p_story,
    null, p_photo_path, false
  );
$$;

revoke execute on function public.submit_report_internal_v3(uuid, text, integer, boolean, text, integer, text, boolean)
  from public, anon, authenticated;
revoke execute on function public.submit_report_trusted(uuid, text, integer, boolean, text, integer, text, boolean)
  from public, anon, authenticated;
revoke execute on function public.submit_report(text, integer, boolean, text)
  from public, anon;
grant execute on function public.submit_report(text, integer, boolean, text) to authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    grant execute on function public.submit_report_trusted(
      uuid, text, integer, boolean, text, integer, text, boolean
    ) to service_role;
    grant execute on function public.submit_report_for_development(
      uuid, text, integer, boolean, text, integer
    ) to service_role;
    grant execute on function public.submit_report_for_development_v2(
      uuid, text, integer, boolean, text, integer, text
    ) to service_role;
    grant execute on function public.submit_report_with_photo(
      uuid, text, integer, boolean, text, text
    ) to service_role;
  end if;
end;
$$;

create or replace function public.admin_void_report(p_report_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := auth.uid();
  target_team_id uuid;
  target_week smallint;
  target_is_prelaunch_test boolean;
begin
  if admin_id is null or not public.is_admin(admin_id) then
    raise exception 'ADMIN_FORBIDDEN' using errcode = 'P0001';
  end if;
  if nullif(btrim(p_reason), '') is null or length(btrim(p_reason)) > 500 then
    raise exception 'ADMIN_VOID_REASON_INVALID' using errcode = 'P0001';
  end if;

  select team_id, activity_week, is_prelaunch_test
  into target_team_id, target_week, target_is_prelaunch_test
  from public.reports
  where id = p_report_id and status = 'active'
  for update;
  if target_team_id is null then
    raise exception 'ADMIN_REPORT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_team_id::text || ':' || target_week::text || ':' || target_is_prelaunch_test::text,
      0
    )
  );
  update public.reports
  set status = 'void', voided_at = now(), voided_by = admin_id, void_reason = btrim(p_reason)
  where id = p_report_id;
  perform public.recalculate_team_week(target_team_id, target_week, target_is_prelaunch_test);

  insert into public.admin_audit_logs(admin_user_id, action, target_report_id, metadata)
  values (admin_id, 'report_voided', p_report_id,
    jsonb_build_object('reason', btrim(p_reason), 'is_prelaunch_test', target_is_prelaunch_test));
end;
$$;

create or replace function public.admin_dashboard_summary(p_activity_week smallint, p_is_test boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'ADMIN_FORBIDDEN' using errcode = 'P0001';
  end if;

  with filtered_reports as (
    select * from public.reports
    where status = 'active'
      and (p_activity_week is null or activity_week = p_activity_week)
      and (p_is_test is null or is_prelaunch_test = p_is_test)
  ),
  kpis as (
    select count(*)::integer report_count,
      count(*) filter (where is_3x5)::integer three_by_five_count,
      count(*) filter (where photo_path is not null)::integer photo_count,
      coalesce(sum(raw_score), 0)::integer raw_steps,
      coalesce(sum(accepted_score), 0)::integer accepted_steps,
      count(distinct team_id)::integer participating_team_count
    from filtered_reports
  ),
  capped as (
    select count(distinct team_id)::integer capped_team_count
    from public.team_progress
    where (p_activity_week is null or activity_week = p_activity_week)
      and (p_is_test is null or is_prelaunch_test = p_is_test)
      and accepted_score >= 30
  ),
  group_rows as (
    select team_groups.id, team_groups.name, team_groups.sort_order,
      count(distinct teams.id) filter (where teams.is_active)::integer team_count,
      count(distinct filtered_reports.team_id)::integer participating_team_count,
      count(filtered_reports.id)::integer report_count,
      coalesce(sum(filtered_reports.raw_score), 0)::integer raw_steps,
      coalesce(sum(filtered_reports.accepted_score), 0)::integer accepted_steps,
      count(filtered_reports.id) filter (where filtered_reports.photo_path is not null)::integer photo_count
    from public.team_groups
    left join public.zones on zones.team_group_id = team_groups.id and zones.is_active
    left join public.teams on teams.zone_id = zones.id and teams.is_active
    left join filtered_reports on filtered_reports.team_id = teams.id
    where team_groups.is_active
    group by team_groups.id, team_groups.name, team_groups.sort_order
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'report_count', kpis.report_count, 'care_count', kpis.report_count,
      'three_by_five_count', kpis.three_by_five_count, 'photo_count', kpis.photo_count,
      'raw_steps', kpis.raw_steps, 'accepted_steps', kpis.accepted_steps,
      'capped_team_count', capped.capped_team_count,
      'participating_team_count', kpis.participating_team_count
    ),
    'team_groups', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'team_count', team_count,
      'participating_team_count', participating_team_count,
      'report_count', report_count, 'raw_steps', raw_steps,
      'accepted_steps', accepted_steps, 'photo_count', photo_count
    ) order by sort_order) from group_rows), '[]'::jsonb)
  ) into result from kpis cross join capped;
  return result;
end;
$$;

create or replace function public.admin_team_progress_rows(
  p_activity_week smallint,
  p_team_group_id bigint,
  p_zone_id bigint,
  p_team_id uuid,
  p_is_test boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'ADMIN_FORBIDDEN' using errcode = 'P0001';
  end if;

  with progress as (
    select team_id, activity_week, sum(accepted_score)::integer accepted_score
    from public.team_progress
    where p_is_test is null or is_prelaunch_test = p_is_test
    group by team_id, activity_week
  ), report_totals as (
    select team_id, coalesce(sum(raw_score), 0)::integer raw_total,
      coalesce(sum(accepted_score), 0)::integer accepted_total
    from public.reports
    where status = 'active'
      and (p_activity_week is null or activity_week = p_activity_week)
      and (p_is_test is null or is_prelaunch_test = p_is_test)
    group by team_id
  ), rows as (
    select team_groups.sort_order group_sort, zones.sort_order zone_sort,
      teams.sort_order team_sort, teams.name team_name,
      jsonb_build_object(
        'team_group_id', team_groups.id, 'team_group_name', team_groups.name,
        'zone_id', zones.id, 'zone_name', zones.name,
        'team_id', teams.id, 'team_name', teams.name,
        'w1', coalesce(max(progress.accepted_score) filter (where progress.activity_week = 1), 0),
        'w2', coalesce(max(progress.accepted_score) filter (where progress.activity_week = 2), 0),
        'w3', coalesce(max(progress.accepted_score) filter (where progress.activity_week = 3), 0),
        'w4', coalesce(max(progress.accepted_score) filter (where progress.activity_week = 4), 0),
        'w5', coalesce(max(progress.accepted_score) filter (where progress.activity_week = 5), 0),
        'w6', coalesce(max(progress.accepted_score) filter (where progress.activity_week = 6), 0),
        'raw_total', coalesce(report_totals.raw_total, 0),
        'accepted_total', coalesce(report_totals.accepted_total, 0),
        'current_square', least(36, floor(coalesce(report_totals.accepted_total, 0) / 5.0)::integer + 1),
        'remainder', case when coalesce(report_totals.accepted_total, 0) >= 175 then 0
          else mod(coalesce(report_totals.accepted_total, 0), 5) end
      ) row_data
    from public.teams
    join public.zones on zones.id = teams.zone_id
    join public.team_groups on team_groups.id = zones.team_group_id
    left join progress on progress.team_id = teams.id
    left join report_totals on report_totals.team_id = teams.id
    where teams.is_active and zones.is_active and team_groups.is_active
      and (p_team_group_id is null or team_groups.id = p_team_group_id)
      and (p_zone_id is null or zones.id = p_zone_id)
      and (p_team_id is null or teams.id = p_team_id)
    group by team_groups.id, team_groups.name, team_groups.sort_order,
      zones.id, zones.name, zones.sort_order, teams.id, teams.name, teams.sort_order,
      report_totals.raw_total, report_totals.accepted_total
  )
  select coalesce(jsonb_agg(row_data order by group_sort, zone_sort, team_sort, team_name), '[]'::jsonb)
  into result from rows;
  return result;
end;
$$;

create or replace function public.admin_reports_page(
  p_activity_week smallint, p_team_group_id bigint, p_zone_id bigint,
  p_team_id uuid, p_mission_id smallint, p_is_3x5 boolean,
  p_has_photo boolean, p_status text, p_photo_visibility text,
  p_search text, p_limit integer, p_offset integer, p_is_test boolean
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'ADMIN_FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_limit not between 1 and 10000 or p_offset < 0 then
    raise exception 'ADMIN_PAGINATION_INVALID' using errcode = 'P0001';
  end if;

  with filtered as (
    select reports.*, profiles.name reporter_name, teams.name team_name,
      zones.id zone_id, zones.name zone_name, team_groups.id team_group_id,
      team_groups.name team_group_name, missions.name mission_name
    from public.reports
    join public.profiles on profiles.id = reports.user_id
    join public.teams on teams.id = reports.team_id
    join public.zones on zones.id = teams.zone_id
    join public.team_groups on team_groups.id = zones.team_group_id
    join public.missions on missions.id = reports.mission_id
    where reports.status::text in ('active', 'void')
      and (p_activity_week is null or reports.activity_week = p_activity_week)
      and (p_is_test is null or reports.is_prelaunch_test = p_is_test)
      and (p_team_group_id is null or team_groups.id = p_team_group_id)
      and (p_zone_id is null or zones.id = p_zone_id)
      and (p_team_id is null or teams.id = p_team_id)
      and (p_mission_id is null or reports.mission_id = p_mission_id)
      and (p_is_3x5 is null or reports.is_3x5 = p_is_3x5)
      and (p_has_photo is null or (reports.photo_path is not null) = p_has_photo)
      and (p_status is null or reports.status::text = p_status)
      and (p_photo_visibility is null or reports.photo_visibility = p_photo_visibility)
      and (nullif(btrim(p_search), '') is null
        or profiles.name ilike '%' || btrim(p_search) || '%'
        or reports.friend_alias ilike '%' || btrim(p_search) || '%'
        or teams.name ilike '%' || btrim(p_search) || '%')
  ), page_rows as (
    select * from filtered order by created_at desc, id desc
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'created_at', created_at, 'activity_week', activity_week,
      'is_prelaunch_test', is_prelaunch_test, 'reporter_name', reporter_name,
      'team_group_id', team_group_id, 'team_group_name', team_group_name,
      'zone_id', zone_id, 'zone_name', zone_name, 'team_id', team_id,
      'team_name', team_name, 'friend_alias', friend_alias,
      'mission_id', mission_id, 'mission_name', mission_name,
      'is_3x5', is_3x5, 'mission_score', mission_score,
      'photo_bonus', photo_bonus, 'raw_score', raw_score,
      'accepted_score', accepted_score, 'story', story, 'photo_path', photo_path,
      'photo_visibility', photo_visibility, 'status', status,
      'voided_at', voided_at, 'void_reason', void_reason
    ) order by created_at desc, id desc) from page_rows), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke execute on function public.recalculate_team_week(uuid, smallint, boolean)
  from public, anon, authenticated;
revoke execute on function public.admin_dashboard_summary(smallint, boolean)
  from public, anon;
revoke execute on function public.admin_team_progress_rows(smallint, bigint, bigint, uuid, boolean)
  from public, anon;
revoke execute on function public.admin_reports_page(
  smallint, bigint, bigint, uuid, smallint, boolean, boolean, text, text, text, integer, integer, boolean
) from public, anon;
grant execute on function public.admin_dashboard_summary(smallint, boolean) to authenticated;
grant execute on function public.admin_team_progress_rows(smallint, bigint, bigint, uuid, boolean) to authenticated;
grant execute on function public.admin_reports_page(
  smallint, bigint, bigint, uuid, smallint, boolean, boolean, text, text, text, integer, integer, boolean
) to authenticated;

-- Rebuild both existing official and prelaunch scopes after the column rename.
do $$
declare progress_row record;
begin
  for progress_row in
    select team_id, activity_week, is_prelaunch_test
    from public.team_progress
    union
    select team_id, activity_week, is_prelaunch_test
    from public.reports
    where activity_week is not null
  loop
    perform public.recalculate_team_week(
      progress_row.team_id,
      progress_row.activity_week,
      progress_row.is_prelaunch_test
    );
  end loop;
end;
$$;

commit;
