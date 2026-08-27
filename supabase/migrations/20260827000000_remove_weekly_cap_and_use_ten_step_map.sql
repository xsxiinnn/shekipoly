begin;

-- Progress is no longer capped per team/week. Widen the aggregate so a busy
-- team can safely accumulate more than the legacy smallint/check allowed.
drop view if exists public.team_map_progress;

alter table public.team_progress
  drop constraint if exists team_progress_accepted_score_check;

alter table public.team_progress
  alter column accepted_score type integer using accepted_score::integer;

comment on column public.team_progress.accepted_score is
  '該小組活動週所有 active reports 的 accepted_score 總和；不設每週上限。';

-- Keep the existing function signature and parameter names for PostgreSQL
-- CREATE OR REPLACE compatibility with the remote function.
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
  total_accepted integer;
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

  update public.reports
  set accepted_score = raw_score
  where team_id = target_team_id
    and activity_week = target_activity_week
    and is_prelaunch_test = target_is_test
    and status = 'active'
    and accepted_score is distinct from raw_score;

  update public.reports
  set accepted_score = 0
  where team_id = target_team_id
    and activity_week = target_activity_week
    and is_prelaunch_test = target_is_test
    and status <> 'active'
    and accepted_score <> 0;

  select coalesce(sum(accepted_score), 0)::integer
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
    total_accepted,
    target_is_test,
    now()
  )
  on conflict (team_id, activity_week, is_prelaunch_test) do update
  set accepted_score = excluded.accepted_score,
      updated_at = excluded.updated_at;
end;
$$;

-- Reallocate existing official and prelaunch data under the new unlimited rule.
do $$
declare
  target record;
begin
  for target in
    select distinct team_id, activity_week, is_prelaunch_test
    from public.reports
    where activity_week is not null
  loop
    perform public.recalculate_team_week(
      target.team_id,
      target.activity_week,
      target.is_prelaunch_test
    );
  end loop;
end;
$$;

-- Square 1 remains the starting square. Every 10 accepted steps advances one
-- square, with square 36 as the permanent maximum.
create view public.team_map_progress as
select
  team_progress.team_id,
  coalesce(sum(team_progress.accepted_score), 0)::integer as accepted_total,
  least(36, floor(coalesce(sum(team_progress.accepted_score), 0) / 10.0)::integer + 1)::smallint as current_square,
  case
    when least(36, floor(coalesce(sum(team_progress.accepted_score), 0) / 10.0)::integer + 1) = 36 then 0
    when mod(coalesce(sum(team_progress.accepted_score), 0)::integer, 10) = 0 then 10
    else 10 - mod(coalesce(sum(team_progress.accepted_score), 0)::integer, 10)
  end::smallint as steps_to_next_square,
  team_progress.is_prelaunch_test
from public.team_progress
group by team_progress.team_id, team_progress.is_prelaunch_test;

comment on view public.team_map_progress is
  '依 official/test scope 分流的 accepted_score 累積；每 10 步前進一格，最高第 36 格。';

revoke all on table public.team_map_progress from anon, authenticated;
grant select on table public.team_map_progress to anon, authenticated;

-- Preserve the JSON response shape for deployed clients while retiring the
-- legacy capped-team metric.
create or replace function public.admin_dashboard_summary(
  p_activity_week smallint,
  p_is_test boolean
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
      'capped_team_count', 0,
      'participating_team_count', kpis.participating_team_count
    ),
    'team_groups', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'team_count', team_count,
      'participating_team_count', participating_team_count,
      'report_count', report_count, 'raw_steps', raw_steps,
      'accepted_steps', accepted_steps, 'photo_count', photo_count
    ) order by sort_order) from group_rows), '[]'::jsonb)
  ) into result from kpis;
  return result;
end;
$$;

-- Keep Admin progress aligned with the same database-owned map convention.
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
        'current_square', least(36, floor(coalesce(report_totals.accepted_total, 0) / 10.0)::integer + 1),
        'remainder', case when coalesce(report_totals.accepted_total, 0) >= 350 then 0
          else mod(coalesce(report_totals.accepted_total, 0), 10) end
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

commit;
