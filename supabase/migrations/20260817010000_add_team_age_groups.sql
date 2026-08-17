begin;

insert into public.age_groups (name, sort_order)
values
  ('國中', 1),
  ('高中', 2),
  ('大學', 3),
  ('研究生+社青', 4)
on conflict (name) do update
set sort_order = excluded.sort_order;

alter table public.teams
add column age_group_id bigint references public.age_groups(id) on delete restrict;

update public.teams as teams
set age_group_id = inferred.age_group_id
from (
  select team_id, min(age_group_id) as age_group_id
  from public.profiles
  group by team_id
  having count(distinct age_group_id) = 1
) as inferred
where teams.id = inferred.team_id;

do $$
begin
  if exists (select 1 from public.teams where age_group_id is null) then
    raise exception
      'Existing teams must have one unambiguous profile age group before this migration can continue.';
  end if;
end;
$$;

alter table public.teams
alter column age_group_id set not null;

alter table public.teams
add constraint teams_id_zone_age_group_key unique (id, zone_id, age_group_id);

alter table public.profiles
add constraint profiles_team_zone_age_group_fkey
foreign key (team_id, zone_id, age_group_id)
references public.teams(id, zone_id, age_group_id)
on delete restrict;

create index teams_age_group_id_idx on public.teams(age_group_id);

commit;
