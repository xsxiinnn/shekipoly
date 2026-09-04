begin;

do $$
declare
  target_team_id uuid;
  source_count integer;
begin
  select count(*)
  into source_count
  from public.teams
  join public.zones on zones.id = teams.zone_id
  join public.team_groups on team_groups.id = zones.team_group_id
  where teams.name = '耀中小組'
    and zones.name = '5區'
    and team_groups.name = '神榮耀團隊';

  if source_count <> 1 then
    raise exception 'Expected exactly one 耀中小組 in 神榮耀團隊 5區, found %', source_count;
  end if;

  select teams.id
  into target_team_id
  from public.teams
  join public.zones on zones.id = teams.zone_id
  join public.team_groups on team_groups.id = zones.team_group_id
  where teams.name = '耀中小組'
    and zones.name = '5區'
    and team_groups.name = '神榮耀團隊';

  if target_team_id is null then
    raise exception 'Could not resolve 耀中小組 UUID';
  end if;

  if exists (
    select 1
    from public.teams
    join public.zones on zones.id = teams.zone_id
    join public.team_groups on team_groups.id = zones.team_group_id
    where teams.name = '安原小組'
      and teams.id <> target_team_id
      and zones.name = '5區'
      and team_groups.name = '神榮耀團隊'
  ) then
    raise exception '安原小組 already exists; refusing to create a duplicate name';
  end if;

  update public.teams
  set name = '安原小組'
  where id = target_team_id;

  if not exists (
    select 1
    from public.teams
    join public.zones on zones.id = teams.zone_id
    join public.team_groups on team_groups.id = zones.team_group_id
    where teams.id = target_team_id
      and teams.name = '安原小組'
      and zones.name = '5區'
      and team_groups.name = '神榮耀團隊'
  ) then
    raise exception 'Failed to rename 耀中小組 safely';
  end if;
end;
$$;

commit;
