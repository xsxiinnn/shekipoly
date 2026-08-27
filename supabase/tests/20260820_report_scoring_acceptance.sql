begin;

insert into auth.users (id)
values
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002');

insert into public.profiles (id, name, team_id)
select
  '10000000-0000-0000-0000-000000000001',
  'Cases A-D',
  teams.id
from public.teams
join public.zones on zones.id = teams.zone_id
where zones.name = '1區'
  and teams.name = '舒畬小組';

insert into public.profiles (id, name, team_id)
select
  '10000000-0000-0000-0000-000000000002',
  'Cases E-F',
  teams.id
from public.teams
join public.zones on zones.id = teams.zone_id
where zones.name = '5區'
  and teams.name = '信博小組';

set local role service_role;

select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000001', 'case-a', 1, false, '', 1
);
select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000001', 'case-b', 1, true, '', 1
);
select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000001', 'case-c', 5, false, '', 1
);
select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000001', 'case-d', 5, true, '', 1
);

reset role;

do $$
declare
  actual_scores text[];
begin
  select array_agg(
    friend_alias || ':' || raw_score || ':' || accepted_score
    order by friend_alias
  )
  into actual_scores
  from public.reports;

  if actual_scores <> array[
    'case-a:1:1',
    'case-b:2:2',
    'case-c:3:3',
    'case-d:6:6'
  ] then
    raise exception 'Cases A-D mismatch: %', actual_scores;
  end if;

  if exists (
    select 1
    from public.reports
    where photo_bonus <> 0
      or raw_score <> mission_score
      or activity_week <> 1
      or status <> 'active'
  ) then
    raise exception 'Trusted score, activity week, photo bonus, or status mismatch';
  end if;
end;
$$;

-- Prefill the second team to 28: 6 + 6 + 6 + 6 + 2 + 2.
set local role service_role;

select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000002', 'prefill-1', 6, true, '', 1
);
select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000002', 'prefill-2', 6, true, '', 1
);
select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000002', 'prefill-3', 6, true, '', 1
);
select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000002', 'prefill-4', 6, true, '', 1
);
select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000002', 'prefill-5', 1, true, '', 1
);
select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000002', 'prefill-6', 1, true, '', 1
);

select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000002', 'case-e', 6, true, '', 1
);
select public.submit_report_for_development(
  '10000000-0000-0000-0000-000000000002', 'case-f', 6, true, '', 1
);

reset role;

do $$
declare
  case_e record;
  case_f record;
  weekly_score integer;
begin
  select raw_score, accepted_score into case_e
  from public.reports where friend_alias = 'case-e';
  select raw_score, accepted_score into case_f
  from public.reports where friend_alias = 'case-f';

  if case_e.raw_score <> 6 or case_e.accepted_score <> 6 then
    raise exception 'Case E mismatch: raw %, accepted %',
      case_e.raw_score, case_e.accepted_score;
  end if;

  if case_f.raw_score <> 6 or case_f.accepted_score <> 6 then
    raise exception 'Case F mismatch: raw %, accepted %',
      case_f.raw_score, case_f.accepted_score;
  end if;

  select team_progress.accepted_score into weekly_score
  from public.team_progress
  join public.profiles on profiles.team_id = team_progress.team_id
  where profiles.id = '10000000-0000-0000-0000-000000000002'
    and team_progress.activity_week = 1;

  if weekly_score <> 40 then
    raise exception 'Unlimited weekly total mismatch: %', weekly_score;
  end if;

  if not exists (
    select 1 from public.reports where friend_alias = 'case-f'
  ) then
    raise exception 'Case F report was not saved';
  end if;
end;
$$;

do $$
begin
  if public.activity_week_for(timestamptz '2026-08-21 12:00:00+08') is not null
    or public.activity_week_for(timestamptz '2026-09-10 12:00:00+08') <> 2
    or public.activity_week_for(timestamptz '2026-08-30 15:59:59+00') is not null
    or public.activity_week_for(timestamptz '2026-08-30 16:00:00+00') <> 1
    or public.activity_week_for(timestamptz '2026-10-11 15:59:00+00') <> 6
    or public.activity_week_for(timestamptz '2026-10-11 15:59:59+00') <> 6
    or public.activity_week_for(timestamptz '2026-10-11 16:00:00+00') is not null then
    raise exception 'Asia/Taipei activity-week boundary mismatch';
  end if;

  if has_column_privilege(
    'authenticated', 'public.reports', 'raw_score', 'UPDATE'
  ) or has_column_privilege(
    'authenticated', 'public.reports', 'accepted_score', 'UPDATE'
  ) or has_column_privilege(
    'authenticated', 'public.reports', 'activity_week', 'INSERT'
  ) then
    raise exception 'Client unexpectedly has trusted score/week column privileges';
  end if;

  if not has_function_privilege(
    'authenticated',
    'public.submit_report(text, integer, boolean, text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.submit_report_for_development(uuid, text, integer, boolean, text, integer)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.submit_report_for_development(uuid, text, integer, boolean, text, integer)',
    'EXECUTE'
  ) then
    raise exception 'Report RPC execute privileges are incorrect';
  end if;
end;
$$;

-- Verify the shared map formula at its upper bound.
update public.team_progress
set accepted_score = 60
where team_id = (
  select team_id
  from public.profiles
  where id = '10000000-0000-0000-0000-000000000001'
);

do $$
declare
  progress record;
begin
  select * into progress
  from public.team_map_progress
  where team_id = (
    select team_id
    from public.profiles
    where id = '10000000-0000-0000-0000-000000000001'
  );

  if progress.accepted_total <> 360
    or progress.current_square <> 36
    or progress.steps_to_next_square <> 0 then
    raise exception 'Map upper-bound mismatch: total %, square %, next %',
      progress.accepted_total,
      progress.current_square,
      progress.steps_to_next_square;
  end if;
end;
$$;

rollback;
