begin;

do $$
declare
  actual_names text[];
  actual_count integer;
begin
  select count(*) into actual_count
  from public.team_groups
  where is_active;
  if actual_count <> 4 then
    raise exception 'Expected 4 active team groups, got %', actual_count;
  end if;

  select array_agg(zones.name order by zones.sort_order) into actual_names
  from public.zones
  join public.team_groups on team_groups.id = zones.team_group_id
  where team_groups.name = '樂福團隊'
    and zones.is_active;
  if actual_names <> array['1區', '4區', '11區', '12區'] then
    raise exception '樂福團隊 zones mismatch: %', actual_names;
  end if;

  select array_agg(teams.name order by teams.sort_order) into actual_names
  from public.teams
  join public.zones on zones.id = teams.zone_id
  join public.team_groups on team_groups.id = zones.team_group_id
  where team_groups.name = '洞見團隊'
    and zones.name = '9區'
    and teams.is_active;
  if actual_names <> array['品凡小組', '佳婕小組', '芳怡小組', '汶芯小組', '昕霖小組'] then
    raise exception '洞見團隊 9區 teams mismatch: %', actual_names;
  end if;

  if exists (
    select 1
    from public.teams
    join public.zones on zones.id = teams.zone_id
    join public.team_groups on team_groups.id = zones.team_group_id
    where team_groups.name = '樂福團隊'
      and zones.name not in ('1區', '4區', '11區', '12區')
      and teams.is_active
  ) then
    raise exception '樂福團隊 contains a team from another team group';
  end if;
end;
$$;

insert into auth.users (id)
values
  ('00000000-0000-0000-0000-000000000301'),
  ('00000000-0000-0000-0000-000000000401'),
  ('00000000-0000-0000-0000-000000000501'),
  ('00000000-0000-0000-0000-000000000601'),
  ('00000000-0000-0000-0000-000000000701'),
  ('00000000-0000-0000-0000-000000000801'),
  ('00000000-0000-0000-0000-000000000901');

insert into public.admins (user_id)
values ('00000000-0000-0000-0000-000000000801');

insert into public.profiles (id, name, team_id)
select
  '00000000-0000-0000-0000-000000000301',
  '階層驗收使用者',
  teams.id
from public.teams
join public.zones on zones.id = teams.zone_id
where zones.name = '3區'
  and teams.name = '柏勳小組2';

insert into public.profiles (id, name, team_id)
select
  '00000000-0000-0000-0000-000000000401',
  '地圖預設使用者',
  teams.id
from public.teams
join public.zones on zones.id = teams.zone_id
where zones.name = '4區'
  and teams.name = '永恩小組';

insert into public.profiles (id, name, team_id)
select
  user_id,
  user_name,
  teams.id
from (
  values
    ('00000000-0000-0000-0000-000000000501'::uuid, 'RLS A'),
    ('00000000-0000-0000-0000-000000000601'::uuid, 'RLS B'),
    ('00000000-0000-0000-0000-000000000701'::uuid, '計分驗收')
) as users(user_id, user_name)
cross join public.teams
join public.zones on zones.id = teams.zone_id
where zones.name = '5區'
  and teams.name = '加榮小組';

do $$
declare
  actual_path text;
begin
  select team_groups.name || '|' || zones.name || '|' || teams.name
  into actual_path
  from public.profiles
  join public.teams on teams.id = profiles.team_id
  join public.zones on zones.id = teams.zone_id
  join public.team_groups on team_groups.id = zones.team_group_id
  where profiles.id = '00000000-0000-0000-0000-000000000301';
  if actual_path <> '基河團隊|3區|柏勳小組2' then
    raise exception 'Profile hierarchy mismatch: %', actual_path;
  end if;

  update public.profiles
  set name = '重新整理後仍保留'
  where id = '00000000-0000-0000-0000-000000000301';

  select team_groups.name
  into actual_path
  from public.profiles
  join public.teams on teams.id = profiles.team_id
  join public.zones on zones.id = teams.zone_id
  join public.team_groups on team_groups.id = zones.team_group_id
  where profiles.id = '00000000-0000-0000-0000-000000000401';
  if actual_path <> '樂福團隊' then
    raise exception '4區永恩小組 should default to 樂福團隊, got %', actual_path;
  end if;
end;
$$;

do $$
begin
  if not has_table_privilege('authenticated', 'public.profiles', 'SELECT')
    or not has_table_privilege('authenticated', 'public.profiles', 'INSERT')
    or not has_table_privilege('authenticated', 'public.profiles', 'UPDATE') then
    raise exception 'Authenticated profile table privileges are incomplete';
  end if;

  if has_table_privilege('anon', 'public.profiles', 'INSERT')
    or has_table_privilege('anon', 'public.profiles', 'UPDATE') then
    raise exception 'Anon unexpectedly has profile write privileges';
  end if;

  if not has_table_privilege('anon', 'public.team_groups', 'SELECT')
    or not has_table_privilege('anon', 'public.zones', 'SELECT')
    or not has_table_privilege('anon', 'public.teams', 'SELECT')
    or not has_table_privilege('anon', 'public.team_progress', 'SELECT') then
    raise exception 'Public reference read privileges are incomplete';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000901',
  true
);

insert into public.profiles (id, name, team_id)
values (
  '00000000-0000-0000-0000-000000000901',
  'Profile upsert insert',
  (
    select teams.id
    from public.teams
    join public.zones on zones.id = teams.zone_id
    where zones.name = '4區'
      and teams.name = '永恩小組'
  )
)
on conflict (id) do update
set
  name = excluded.name,
  team_id = excluded.team_id;

insert into public.profiles (id, name, team_id)
values (
  '00000000-0000-0000-0000-000000000901',
  'Profile upsert update',
  (
    select teams.id
    from public.teams
    join public.zones on zones.id = teams.zone_id
    where zones.name = '3區'
      and teams.name = '柏勳小組2'
  )
)
on conflict (id) do update
set
  name = excluded.name,
  team_id = excluded.team_id;

do $$
declare
  profile_path text;
  changed_profiles integer;
begin
  select profiles.name || '|' || zones.name || '|' || teams.name
  into profile_path
  from public.profiles
  join public.teams on teams.id = profiles.team_id
  join public.zones on zones.id = teams.zone_id
  where profiles.id = '00000000-0000-0000-0000-000000000901';

  if profile_path <> 'Profile upsert update|3區|柏勳小組2' then
    raise exception 'Authenticated profile upsert failed: %', profile_path;
  end if;

  update public.profiles
  set name = 'forbidden profile update'
  where id = '00000000-0000-0000-0000-000000000301';
  get diagnostics changed_profiles = row_count;
  if changed_profiles <> 0 then
    raise exception 'User unexpectedly updated another profile';
  end if;
end;
$$;

reset role;

set local role service_role;
select public.submit_report_for_development(
  '00000000-0000-0000-0000-000000000501',
  'own-report',
  1,
  false,
  '',
  1
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000501',
  true
);

do $$
declare
  visible_reports integer;
begin
  select count(*) into visible_reports from public.reports;
  if visible_reports <> 1 then
    raise exception 'Student report RLS exposed % rows instead of 1', visible_reports;
  end if;

  begin
    insert into public.reports (
      user_id,
      friend_alias,
      is_3x5,
      mission_id,
      story,
      photo_path
    ) values (
      '00000000-0000-0000-0000-000000000601',
      'forbidden-report',
      false,
      1,
      '',
      null
    );
    raise exception 'Student unexpectedly inserted another user report';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000801',
  true
);

do $$
declare
  visible_reports integer;
  changed_reports integer;
begin
  select count(*) into visible_reports from public.reports;
  if visible_reports <> 1 then
    raise exception 'Admin report RLS exposed % rows instead of 1', visible_reports;
  end if;

  update public.reports
  set status = 'rejected'
  where user_id = '00000000-0000-0000-0000-000000000501';
  get diagnostics changed_reports = row_count;
  if changed_reports <> 1 then
    raise exception 'Admin could not manage all reports';
  end if;

  update public.team_groups
  set name = name
  where name = '樂福團隊';
  get diagnostics changed_reports = row_count;
  if changed_reports <> 1 then
    raise exception 'Admin could not manage team groups';
  end if;
end;
$$;

reset role;
rollback;
