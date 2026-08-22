-- Admin dashboard, moderation, and auditable voiding.
-- The enum value must be committed before it can be used later in this migration.
begin;

alter type public.report_status add value if not exists 'void';

commit;

begin;

alter table public.admins
add column role text not null default 'admin'
  check (role in ('admin', 'super_admin'));

alter table public.reports
add column voided_at timestamptz;

alter table public.reports
add column voided_by uuid references public.admins(user_id) on delete set null;

alter table public.reports
add column void_reason text
  check (void_reason is null or length(btrim(void_reason)) between 2 and 500);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references public.admins(user_id) on delete restrict,
  action text not null check (
    action in ('report_voided', 'photo_hidden', 'photo_restored')
  ),
  target_report_id uuid not null references public.reports(id) on delete restrict,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_audit_logs_report_created_idx
  on public.admin_audit_logs(target_report_id, created_at desc);
create index admin_audit_logs_admin_created_idx
  on public.admin_audit_logs(admin_user_id, created_at desc);

alter table public.admin_audit_logs enable row level security;

revoke all on table public.admin_audit_logs from anon, authenticated;
grant select on table public.admin_audit_logs to authenticated;

create policy "Admins can read audit logs"
on public.admin_audit_logs for select
to authenticated
using ((select public.is_admin()));

-- Photo consent is no longer part of the product flow. Keep the legacy column
-- for backward compatibility, but remove it from photo validity requirements.
alter table public.reports
drop constraint if exists reports_valid_photo_requires_consent;

comment on column public.reports.photo_consent is
  'Legacy compatibility column. Photo validity no longer depends on consent.';

-- New trusted-server overloads omit consent while preserving the existing
-- photo verification and scoring implementation. The legacy functions remain
-- callable only by service_role for compatibility with an in-flight deploy.
create function public.submit_report_with_photo(
  p_reporter_id uuid,
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text,
  p_photo_path text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_with_photo(
    p_reporter_id,
    p_friend_alias,
    p_mission_id,
    p_is_3x5,
    p_story,
    p_photo_path,
    true
  );
$$;

create function public.submit_report_for_development_v2(
  p_reporter_id uuid,
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text,
  p_activity_week integer,
  p_photo_path text
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_for_development_v2(
    p_reporter_id,
    p_friend_alias,
    p_mission_id,
    p_is_3x5,
    p_story,
    p_activity_week,
    p_photo_path,
    true
  );
$$;

revoke execute on function public.submit_report_with_photo(
  uuid, text, integer, boolean, text, text
) from public, anon, authenticated;
revoke execute on function public.submit_report_for_development_v2(
  uuid, text, integer, boolean, text, integer, text
) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    grant execute on function public.submit_report_with_photo(
      uuid, text, integer, boolean, text, text
    ) to service_role;
    grant execute on function public.submit_report_for_development_v2(
      uuid, text, integer, boolean, text, integer, text
    ) to service_role;
  end if;
end;
$$;

-- Keep weekly allocation deterministic after voiding an earlier report.
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
  if target_team_id is null or target_activity_week is null then
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
  set accepted_score = least(total_accepted, 30), updated_at = now()
  where team_id = target_team_id
    and activity_week = target_activity_week;
end;
$$;

create function public.admin_void_report(
  p_report_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := auth.uid();
  target_team_id uuid;
  target_week smallint;
begin
  if admin_id is null or not public.is_admin(admin_id) then
    raise exception 'ADMIN_FORBIDDEN' using errcode = 'P0001';
  end if;
  if nullif(btrim(p_reason), '') is null or length(btrim(p_reason)) > 500 then
    raise exception 'ADMIN_VOID_REASON_INVALID' using errcode = 'P0001';
  end if;

  select team_id, activity_week
  into target_team_id, target_week
  from public.reports
  where id = p_report_id
    and status = 'active'
  for update;

  if target_team_id is null then
    raise exception 'ADMIN_REPORT_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_team_id::text || ':' || target_week::text,
      0
    )
  );

  update public.reports
  set
    status = 'void',
    voided_at = now(),
    voided_by = admin_id,
    void_reason = btrim(p_reason)
  where id = p_report_id;

  perform public.recalculate_team_week(target_team_id, target_week);

  insert into public.admin_audit_logs (
    admin_user_id, action, target_report_id, metadata
  ) values (
    admin_id,
    'report_voided',
    p_report_id,
    jsonb_build_object('reason', btrim(p_reason))
  );
end;
$$;

create function public.admin_set_photo_visibility(
  p_report_id uuid,
  p_visibility text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := auth.uid();
  previous_visibility text;
  target_status text;
  target_photo_path text;
  target_photo_valid boolean;
begin
  if admin_id is null or not public.is_admin(admin_id) then
    raise exception 'ADMIN_FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_visibility not in ('visible', 'hidden') then
    raise exception 'ADMIN_PHOTO_VISIBILITY_INVALID' using errcode = 'P0001';
  end if;

  select photo_visibility, status::text, photo_path, photo_is_valid
  into previous_visibility, target_status, target_photo_path, target_photo_valid
  from public.reports
  where id = p_report_id
  for update;

  if previous_visibility is null or target_photo_path is null or not target_photo_valid then
    raise exception 'ADMIN_PHOTO_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p_visibility = 'visible' and target_status <> 'active' then
    raise exception 'ADMIN_PHOTO_NOT_RESTORABLE' using errcode = 'P0001';
  end if;

  update public.reports
  set photo_visibility = p_visibility
  where id = p_report_id;

  if previous_visibility is distinct from p_visibility then
    insert into public.admin_audit_logs (
      admin_user_id, action, target_report_id, metadata
    ) values (
      admin_id,
      case when p_visibility = 'hidden' then 'photo_hidden' else 'photo_restored' end,
      p_report_id,
      jsonb_build_object('previous_visibility', previous_visibility)
    );
  end if;
end;
$$;

create function public.admin_dashboard_summary(
  p_activity_week smallint default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  target_week smallint := coalesce(p_activity_week, public.activity_week_for(now()));
  result jsonb;
begin
  if auth.uid() is null or not public.is_admin(auth.uid()) then
    raise exception 'ADMIN_FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_activity_week is not null and p_activity_week not between 1 and 6 then
    raise exception 'ADMIN_WEEK_INVALID' using errcode = 'P0001';
  end if;

  with filtered_reports as (
    select reports.*
    from public.reports
    where reports.status = 'active'
      and (p_activity_week is null or reports.activity_week = p_activity_week)
  ),
  kpis as (
    select
      count(*)::integer as report_count,
      count(*) filter (where is_3x5)::integer as three_by_five_count,
      count(*) filter (where photo_path is not null)::integer as photo_count,
      coalesce(sum(raw_score), 0)::integer as raw_steps,
      coalesce(sum(accepted_score), 0)::integer as accepted_steps,
      count(distinct team_id)::integer as participating_team_count
    from filtered_reports
  ),
  capped as (
    select count(*)::integer as capped_team_count
    from public.team_progress
    where activity_week = target_week
      and accepted_score >= 30
  ),
  group_rows as (
    select
      team_groups.id,
      team_groups.name,
      team_groups.sort_order,
      count(distinct teams.id) filter (where teams.is_active)::integer as team_count,
      count(distinct filtered_reports.team_id)::integer as participating_team_count,
      count(filtered_reports.id)::integer as report_count,
      coalesce(sum(filtered_reports.raw_score), 0)::integer as raw_steps,
      coalesce(sum(filtered_reports.accepted_score), 0)::integer as accepted_steps,
      count(filtered_reports.id) filter (
        where filtered_reports.photo_path is not null
      )::integer as photo_count
    from public.team_groups
    left join public.zones
      on zones.team_group_id = team_groups.id and zones.is_active
    left join public.teams
      on teams.zone_id = zones.id and teams.is_active
    left join filtered_reports on filtered_reports.team_id = teams.id
    where team_groups.is_active
    group by team_groups.id, team_groups.name, team_groups.sort_order
  )
  select jsonb_build_object(
    'kpis', jsonb_build_object(
      'report_count', kpis.report_count,
      'care_count', kpis.report_count,
      'three_by_five_count', kpis.three_by_five_count,
      'photo_count', kpis.photo_count,
      'raw_steps', kpis.raw_steps,
      'accepted_steps', kpis.accepted_steps,
      'capped_team_count', capped.capped_team_count,
      'participating_team_count', kpis.participating_team_count
    ),
    'team_groups', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', group_rows.id,
          'name', group_rows.name,
          'team_count', group_rows.team_count,
          'participating_team_count', group_rows.participating_team_count,
          'report_count', group_rows.report_count,
          'raw_steps', group_rows.raw_steps,
          'accepted_steps', group_rows.accepted_steps,
          'photo_count', group_rows.photo_count
        ) order by group_rows.sort_order
      )
      from group_rows
    ), '[]'::jsonb)
  ) into result
  from kpis cross join capped;

  return result;
end;
$$;

create function public.admin_team_progress_rows(
  p_activity_week smallint default null,
  p_team_group_id bigint default null,
  p_zone_id bigint default null,
  p_team_id uuid default null
)
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

  select coalesce(jsonb_agg(row_data order by group_sort, zone_sort, team_sort, team_name), '[]'::jsonb)
  into result
  from (
    select
      team_groups.sort_order as group_sort,
      zones.sort_order as zone_sort,
      teams.sort_order as team_sort,
      teams.name as team_name,
      jsonb_build_object(
        'team_group_id', team_groups.id,
        'team_group_name', team_groups.name,
        'zone_id', zones.id,
        'zone_name', zones.name,
        'team_id', teams.id,
        'team_name', teams.name,
        'w1', coalesce(w1.accepted_score, 0),
        'w2', coalesce(w2.accepted_score, 0),
        'w3', coalesce(w3.accepted_score, 0),
        'w4', coalesce(w4.accepted_score, 0),
        'w5', coalesce(w5.accepted_score, 0),
        'w6', coalesce(w6.accepted_score, 0),
        'raw_total', coalesce(report_totals.raw_total, 0),
        'accepted_total', coalesce(report_totals.accepted_total, 0),
        'current_square', coalesce(map_progress.current_square, 1),
        'remainder', case
          when coalesce(map_progress.current_square, 1) = 36 then 0
          else mod(coalesce(map_progress.accepted_total, 0), 5)
        end
      ) as row_data
    from public.teams
    join public.zones on zones.id = teams.zone_id
    join public.team_groups on team_groups.id = zones.team_group_id
    left join public.team_progress w1 on w1.team_id = teams.id and w1.activity_week = 1
    left join public.team_progress w2 on w2.team_id = teams.id and w2.activity_week = 2
    left join public.team_progress w3 on w3.team_id = teams.id and w3.activity_week = 3
    left join public.team_progress w4 on w4.team_id = teams.id and w4.activity_week = 4
    left join public.team_progress w5 on w5.team_id = teams.id and w5.activity_week = 5
    left join public.team_progress w6 on w6.team_id = teams.id and w6.activity_week = 6
    left join public.team_map_progress map_progress on map_progress.team_id = teams.id
    left join lateral (
      select
        coalesce(sum(reports.raw_score), 0)::integer as raw_total,
        coalesce(sum(reports.accepted_score), 0)::integer as accepted_total
      from public.reports
      where reports.team_id = teams.id
        and reports.status = 'active'
        and (p_activity_week is null or reports.activity_week = p_activity_week)
    ) report_totals on true
    where teams.is_active and zones.is_active and team_groups.is_active
      and (p_team_group_id is null or team_groups.id = p_team_group_id)
      and (p_zone_id is null or zones.id = p_zone_id)
      and (p_team_id is null or teams.id = p_team_id)
  ) progress_rows;

  return result;
end;
$$;

create function public.admin_reports_page(
  p_activity_week smallint default null,
  p_team_group_id bigint default null,
  p_zone_id bigint default null,
  p_team_id uuid default null,
  p_mission_id smallint default null,
  p_is_3x5 boolean default null,
  p_has_photo boolean default null,
  p_status text default null,
  p_photo_visibility text default null,
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
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
  if p_limit not between 1 and 10000 or p_offset < 0 then
    raise exception 'ADMIN_PAGINATION_INVALID' using errcode = 'P0001';
  end if;
  if p_status is not null and p_status not in ('active', 'void') then
    raise exception 'ADMIN_STATUS_INVALID' using errcode = 'P0001';
  end if;
  if p_photo_visibility is not null and p_photo_visibility not in ('visible', 'hidden') then
    raise exception 'ADMIN_PHOTO_VISIBILITY_INVALID' using errcode = 'P0001';
  end if;

  with filtered as (
    select
      reports.*,
      profiles.name as reporter_name,
      teams.name as team_name,
      zones.id as zone_id,
      zones.name as zone_name,
      team_groups.id as team_group_id,
      team_groups.name as team_group_name,
      missions.name as mission_name
    from public.reports
    join public.profiles on profiles.id = reports.user_id
    join public.teams on teams.id = reports.team_id
    join public.zones on zones.id = teams.zone_id
    join public.team_groups on team_groups.id = zones.team_group_id
    join public.missions on missions.id = reports.mission_id
    where reports.status::text in ('active', 'void')
      and (p_activity_week is null or reports.activity_week = p_activity_week)
      and (p_team_group_id is null or team_groups.id = p_team_group_id)
      and (p_zone_id is null or zones.id = p_zone_id)
      and (p_team_id is null or teams.id = p_team_id)
      and (p_mission_id is null or reports.mission_id = p_mission_id)
      and (p_is_3x5 is null or reports.is_3x5 = p_is_3x5)
      and (p_has_photo is null or (reports.photo_path is not null) = p_has_photo)
      and (p_status is null or reports.status::text = p_status)
      and (p_photo_visibility is null or reports.photo_visibility = p_photo_visibility)
      and (
        nullif(btrim(p_search), '') is null
        or profiles.name ilike '%' || btrim(p_search) || '%'
        or reports.friend_alias ilike '%' || btrim(p_search) || '%'
        or teams.name ilike '%' || btrim(p_search) || '%'
      )
  ),
  page_rows as (
    select *
    from filtered
    order by created_at desc, id desc
    limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', id,
          'created_at', created_at,
          'activity_week', activity_week,
          'reporter_name', reporter_name,
          'team_group_id', team_group_id,
          'team_group_name', team_group_name,
          'zone_id', zone_id,
          'zone_name', zone_name,
          'team_id', team_id,
          'team_name', team_name,
          'friend_alias', friend_alias,
          'mission_id', mission_id,
          'mission_name', mission_name,
          'is_3x5', is_3x5,
          'mission_score', mission_score,
          'photo_bonus', photo_bonus,
          'raw_score', raw_score,
          'accepted_score', accepted_score,
          'story', story,
          'photo_path', photo_path,
          'photo_visibility', photo_visibility,
          'status', status,
          'voided_at', voided_at,
          'void_reason', void_reason
        ) order by created_at desc, id desc
      ) from page_rows
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

-- Admin mutations must go through audited RPCs; direct Data API writes and
-- hard deletes are intentionally unavailable even to an admin session.
revoke update, delete on table public.reports from authenticated;
drop policy if exists "Admins can delete all reports" on public.reports;

revoke execute on function public.admin_void_report(uuid, text)
  from public, anon;
revoke execute on function public.admin_set_photo_visibility(uuid, text)
  from public, anon;
revoke execute on function public.admin_dashboard_summary(smallint)
  from public, anon;
revoke execute on function public.admin_team_progress_rows(smallint, bigint, bigint, uuid)
  from public, anon;
revoke execute on function public.admin_reports_page(
  smallint, bigint, bigint, uuid, smallint, boolean, boolean, text, text, text, integer, integer
) from public, anon;

grant execute on function public.admin_void_report(uuid, text) to authenticated;
grant execute on function public.admin_set_photo_visibility(uuid, text) to authenticated;
grant execute on function public.admin_dashboard_summary(smallint) to authenticated;
grant execute on function public.admin_team_progress_rows(smallint, bigint, bigint, uuid)
  to authenticated;
grant execute on function public.admin_reports_page(
  smallint, bigint, bigint, uuid, smallint, boolean, boolean, text, text, text, integer, integer
) to authenticated;

revoke execute on function public.recalculate_team_week(uuid, smallint)
  from public, anon, authenticated;

commit;
