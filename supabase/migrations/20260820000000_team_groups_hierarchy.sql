begin;

create table public.team_groups (
  id bigint generated always as identity primary key,
  name text not null unique check (length(btrim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (sort_order)
);

comment on table public.team_groups is
  '青年關懷大富翁的最上層團隊；代替 age_groups 成為群組來源。';

alter table public.zones
add column team_group_id bigint references public.team_groups(id) on delete restrict;

alter table public.teams
add column sort_order integer not null default 0;

alter table public.teams
add column is_active boolean not null default true;

-- age_groups and the old foreign-key columns remain in place so already-applied
-- databases and historical rows stay readable. New writes no longer depend on them.
alter table public.profiles
drop constraint if exists profiles_team_zone_age_group_fkey;

alter table public.teams
alter column age_group_id drop not null;

alter table public.profiles
alter column age_group_id drop not null;

comment on table public.age_groups is
  '已停用的舊年齡層參照表；僅為相容已有資料保留。';
comment on column public.teams.age_group_id is
  '已停用；新版階層由 teams.zone_id -> zones.team_group_id 推導。';
comment on column public.profiles.age_group_id is
  '已停用；新版 profile 以 team_id 為階層單一真實來源。';
comment on column public.profiles.zone_id is
  '相容欄位；由 database trigger 依 team_id 自動填入，client 不可寫入。';

insert into public.team_groups (name, sort_order, is_active)
values
  ('樂福團隊', 1, true),
  ('神榮耀團隊', 2, true),
  ('洞見團隊', 3, true),
  ('基河團隊', 4, true)
on conflict (name) do update
set
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

create temporary table official_zones_seed (
  zone_name text primary key,
  team_group_name text not null,
  zone_sort_order integer not null
) on commit drop;

insert into official_zones_seed (zone_name, team_group_name, zone_sort_order)
values
  ('1區', '樂福團隊', 1),
  ('2區', '洞見團隊', 2),
  ('3區', '基河團隊', 3),
  ('4區', '樂福團隊', 4),
  ('5區', '神榮耀團隊', 5),
  ('6區', '神榮耀團隊', 6),
  ('7區', '洞見團隊', 7),
  ('8區', '基河團隊', 8),
  ('9區', '洞見團隊', 9),
  ('10區', '神榮耀團隊', 10),
  ('11區', '樂福團隊', 11),
  ('12區', '樂福團隊', 12);

insert into public.zones (name, sort_order, is_active, team_group_id)
select
  seed.zone_name,
  seed.zone_sort_order,
  true,
  team_groups.id
from official_zones_seed as seed
join public.team_groups
  on team_groups.name = seed.team_group_name
on conflict (name) do update
set
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  team_group_id = excluded.team_group_id;

update public.zones
set is_active = false
where not exists (
  select 1
  from official_zones_seed
  where official_zones_seed.zone_name = zones.name
);

alter table public.zones
add constraint zones_active_requires_team_group
check (not is_active or team_group_id is not null);

create index zones_team_group_id_idx on public.zones(team_group_id);
create index teams_active_zone_sort_idx
  on public.teams(zone_id, is_active, sort_order, name);

create temporary table official_teams_seed (
  zone_name text not null,
  team_name text not null,
  team_sort_order integer not null,
  primary key (zone_name, team_name),
  unique (zone_name, team_sort_order)
) on commit drop;

insert into official_teams_seed (zone_name, team_name, team_sort_order)
values
  ('1區', '舒畬小組', 1),
  ('1區', '葭羚小組', 2),
  ('1區', '舒涵小組', 3),
  ('2區', '峻暐小組', 1),
  ('2區', '彩泰小組', 2),
  ('2區', '敬雅小組', 3),
  ('2區', '捷予小組', 4),
  ('3區', '柏勳小組1', 1),
  ('3區', '柏勳小組2', 2),
  ('3區', '昱祈小組', 3),
  ('4區', '永恩小組', 1),
  ('4區', '育菘小組', 2),
  ('4區', '軒丞小組', 3),
  ('4區', '少馳小組', 4),
  ('5區', '加榮小組', 1),
  ('5區', '信博小組', 2),
  ('5區', '耀中小組', 3),
  ('5區', '以約小組', 4),
  ('5區', '桓瑞小組', 5),
  ('5區', '陳恩小組', 6),
  ('6區', '安妤小組', 1),
  ('6區', '大恩小組', 2),
  ('6區', '奕君小組', 3),
  ('6區', '又璇小組', 4),
  ('6區', '麗恩小組', 5),
  ('7區', '林翰小組1', 1),
  ('7區', '林翰小組2', 2),
  ('7區', '政崴小組', 3),
  ('7區', '軍瑋小組', 4),
  ('8區', '櫂維小組', 1),
  ('8區', '紫盈小組', 2),
  ('8區', '愛妮小組', 3),
  ('9區', '品凡小組', 1),
  ('9區', '佳婕小組', 2),
  ('9區', '芳怡小組', 3),
  ('9區', '汶芯小組', 4),
  ('9區', '昕霖小組', 5),
  ('10區', '柔安小組', 1),
  ('10區', '語箴小組', 2),
  ('10區', '祈宣小組', 3),
  ('10區', '奕涵小組', 4),
  ('10區', '晨瑜小組', 5),
  ('11區', '思吟小組', 1),
  ('11區', '虹潔小組', 2),
  ('11區', '星儀小組', 3),
  ('12區', '靖翎小組', 1),
  ('12區', '雲翔小組', 2),
  ('12區', '芝琳小組', 3),
  ('12區', '宗哲小組', 4);

insert into public.teams (zone_id, name, sort_order, is_active)
select
  zones.id,
  seed.team_name,
  seed.team_sort_order,
  true
from official_teams_seed as seed
join public.zones
  on zones.name = seed.zone_name
on conflict (zone_id, name) do update
set
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;

update public.teams
set is_active = false
where not exists (
  select 1
  from official_teams_seed
  join public.zones
    on zones.name = official_teams_seed.zone_name
  where teams.zone_id = zones.id
    and teams.name = official_teams_seed.team_name
);

create function public.prepare_profile_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_zone_id bigint;
begin
  select teams.zone_id
  into selected_zone_id
  from public.teams
  join public.zones on zones.id = teams.zone_id
  join public.team_groups on team_groups.id = zones.team_group_id
  where teams.id = new.team_id
    and teams.is_active = true
    and zones.is_active = true
    and team_groups.is_active = true;

  if selected_zone_id is null then
    raise exception 'The selected team is not active or has an invalid hierarchy.'
      using errcode = '23514';
  end if;

  new.zone_id := selected_zone_id;
  new.age_group_id := null;
  return new;
end;
$$;

create trigger profiles_prepare_hierarchy
before insert or update of team_id on public.profiles
for each row execute function public.prepare_profile_hierarchy();

alter table public.team_groups enable row level security;

revoke all on table public.team_groups from anon, authenticated;
grant select on table public.team_groups to anon, authenticated;

-- Profiles use team_id as their only client-writable hierarchy value.
revoke insert (age_group_id, zone_id) on table public.profiles from authenticated;
revoke update (age_group_id, zone_id) on table public.profiles from authenticated;

-- Admin writes still pass through RLS and are limited to hierarchy fields.
grant insert (name, sort_order, is_active)
  on table public.team_groups to authenticated;
grant update (name, sort_order, is_active)
  on table public.team_groups to authenticated;
grant delete on table public.team_groups to authenticated;

grant insert (name, team_group_id, sort_order, is_active)
  on table public.zones to authenticated;
grant update (name, team_group_id, sort_order, is_active)
  on table public.zones to authenticated;
grant delete on table public.zones to authenticated;

grant insert (zone_id, name, sort_order, is_active)
  on table public.teams to authenticated;
grant update (zone_id, name, sort_order, is_active)
  on table public.teams to authenticated;
grant delete on table public.teams to authenticated;

grant usage, select on sequence public.team_groups_id_seq to authenticated;
grant usage, select on sequence public.zones_id_seq to authenticated;

create policy "Reference team groups are publicly readable"
on public.team_groups for select
to anon, authenticated
using (true);

create policy "Admins can create team groups"
on public.team_groups for insert
to authenticated
with check ((select public.is_admin()));

create policy "Admins can update team groups"
on public.team_groups for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete team groups"
on public.team_groups for delete
to authenticated
using ((select public.is_admin()));

create policy "Admins can create zones"
on public.zones for insert
to authenticated
with check ((select public.is_admin()));

create policy "Admins can update zones"
on public.zones for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete zones"
on public.zones for delete
to authenticated
using ((select public.is_admin()));

create policy "Admins can create teams"
on public.teams for insert
to authenticated
with check ((select public.is_admin()));

create policy "Admins can update teams"
on public.teams for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete teams"
on public.teams for delete
to authenticated
using ((select public.is_admin()));

revoke execute on function public.prepare_profile_hierarchy()
  from public, anon, authenticated;

commit;
