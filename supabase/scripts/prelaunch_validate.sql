-- Read-only production readiness checks. This script creates or changes nothing.

with checks(name, actual, expected, passed) as (
  select 'active team_groups', count(*)::text, '4', count(*) = 4
  from public.team_groups where is_active
  union all
  select 'active zones', count(*)::text, '12', count(*) = 12
  from public.zones where is_active
  union all
  select 'active teams', count(*)::text, '> 0', count(*) > 0
  from public.teams where is_active
  union all
  select 'active missions', count(*)::text, '6', count(*) = 6
  from public.missions where is_active
  union all
  select 'admins', count(*)::text, '>= 1', count(*) >= 1
  from public.admins
  union all
  select 'activity_week_for function',
         coalesce(to_regprocedure('public.activity_week_for(timestamptz)')::text, 'missing'),
         'present',
         to_regprocedure('public.activity_week_for(timestamptz)') is not null
  union all
  select 'submit_report function',
         coalesce(to_regprocedure('public.submit_report(text,integer,boolean,text)')::text, 'missing'),
         'present',
         to_regprocedure('public.submit_report(text,integer,boolean,text)') is not null
  union all
  select 'recalculate_team_week function',
         coalesce(to_regprocedure('public.recalculate_team_week(uuid,smallint)')::text, 'missing'),
         'present',
         to_regprocedure('public.recalculate_team_week(uuid,smallint)') is not null
  union all
  select 'mission-photos private bucket',
         coalesce((select case when public then 'public' else 'private' end from storage.buckets where id = 'mission-photos'), 'missing'),
         'private',
         coalesce((select not public from storage.buckets where id = 'mission-photos'), false)
  union all
  select 'core tables RLS enabled',
         count(*) filter (where relrowsecurity)::text,
         '7',
         count(*) filter (where relrowsecurity) = 7
  from pg_catalog.pg_class
  where oid in (
    'public.profiles'::regclass,
    'public.reports'::regclass,
    'public.team_groups'::regclass,
    'public.zones'::regclass,
    'public.teams'::regclass,
    'public.missions'::regclass,
    'public.admins'::regclass
  )
)
select name, actual, expected, passed
from checks
order by passed, name;

select team_groups.name as team_group,
       count(distinct zones.id) as zone_count,
       count(distinct teams.id) as team_count
from public.team_groups
left join public.zones on zones.team_group_id = team_groups.id and zones.is_active
left join public.teams on teams.zone_id = zones.id and teams.is_active
where team_groups.is_active
group by team_groups.id, team_groups.name, team_groups.sort_order
order by team_groups.sort_order;

select id, name, base_score
from public.missions
where is_active
order by id;
