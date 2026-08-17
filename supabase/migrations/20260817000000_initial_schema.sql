begin;

create type public.report_status as enum ('pending', 'accepted', 'rejected');

create table public.age_groups (
  id bigint generated always as identity primary key,
  name text not null unique check (length(btrim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.zones (
  id bigint generated always as identity primary key,
  name text not null unique check (length(btrim(name)) > 0),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  zone_id bigint not null references public.zones(id) on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  unique (zone_id, name),
  unique (id, zone_id)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  age_group_id bigint not null references public.age_groups(id) on delete restrict,
  zone_id bigint not null references public.zones(id) on delete restrict,
  team_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_team_zone_fkey
    foreign key (team_id, zone_id)
    references public.teams(id, zone_id)
    on delete restrict
);

create table public.missions (
  id smallint primary key check (id between 1 and 6),
  name text not null check (length(btrim(name)) > 0),
  base_score smallint not null check (base_score between 1 and 3),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.missions (id, name, base_score)
values
  (1, '任務 1', 1),
  (2, '任務 2', 1),
  (3, '任務 3', 2),
  (4, '任務 4', 2),
  (5, '任務 5', 3),
  (6, '任務 6', 3);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete restrict,
  friend_alias text not null check (length(btrim(friend_alias)) > 0),
  is_3x5 boolean not null default false,
  mission_id smallint not null references public.missions(id) on delete restrict,
  base_score smallint not null default 0 check (base_score between 0 and 3),
  mission_score smallint not null default 0 check (mission_score between 0 and 6),
  photo_bonus smallint not null default 0 check (photo_bonus in (0, 3)),
  raw_score smallint not null default 0 check (raw_score between 0 and 9),
  accepted_score smallint not null default 0 check (accepted_score between 0 and 9),
  story text not null default '',
  photo_path text,
  photo_is_valid boolean not null default false,
  status public.report_status not null default 'pending',
  created_at timestamptz not null default now(),
  constraint reports_accepted_not_above_raw
    check (accepted_score <= raw_score),
  constraint reports_valid_photo_has_path
    check (not photo_is_valid or nullif(btrim(photo_path), '') is not null)
);

comment on column public.reports.photo_is_valid is
  'Admin-controlled validation flag. A non-empty photo_path earns a bonus only when this is true.';

create table public.team_progress (
  team_id uuid not null references public.teams(id) on delete cascade,
  activity_week smallint not null check (activity_week between 1 and 6),
  starts_on date not null,
  ends_on date not null,
  accepted_score smallint not null default 0 check (accepted_score between 0 and 30),
  updated_at timestamptz not null default now(),
  primary key (team_id, activity_week),
  check (starts_on <= ends_on)
);

comment on table public.team_progress is
  'Public, trigger-maintained aggregate. It contains no per-student or per-report data.';

create index profiles_team_id_idx on public.profiles(team_id);
create index profiles_age_group_id_idx on public.profiles(age_group_id);
create index reports_user_id_created_at_idx on public.reports(user_id, created_at desc);
create index reports_team_id_created_at_idx on public.reports(team_id, created_at, id);
create index reports_status_idx on public.reports(status);
create index reports_mission_id_idx on public.reports(mission_id);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create function public.is_admin(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admins
    where user_id = check_user_id
  );
$$;

create function public.activity_week_for(report_created_at timestamptz)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case
    when (report_created_at at time zone 'Asia/Taipei')::date
      between date '2026-08-31' and date '2026-09-06' then 1::smallint
    when (report_created_at at time zone 'Asia/Taipei')::date
      between date '2026-09-07' and date '2026-09-13' then 2::smallint
    when (report_created_at at time zone 'Asia/Taipei')::date
      between date '2026-09-14' and date '2026-09-20' then 3::smallint
    when (report_created_at at time zone 'Asia/Taipei')::date
      between date '2026-09-21' and date '2026-09-27' then 4::smallint
    when (report_created_at at time zone 'Asia/Taipei')::date
      between date '2026-09-28' and date '2026-10-04' then 5::smallint
    when (report_created_at at time zone 'Asia/Taipei')::date
      between date '2026-10-05' and date '2026-10-11' then 6::smallint
    else null
  end;
$$;

create function public.initialize_team_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.team_progress (
    team_id,
    activity_week,
    starts_on,
    ends_on
  )
  select new.id, week_number, starts_on, ends_on
  from (
    values
      (1::smallint, date '2026-08-31', date '2026-09-06'),
      (2::smallint, date '2026-09-07', date '2026-09-13'),
      (3::smallint, date '2026-09-14', date '2026-09-20'),
      (4::smallint, date '2026-09-21', date '2026-09-27'),
      (5::smallint, date '2026-09-28', date '2026-10-04'),
      (6::smallint, date '2026-10-05', date '2026-10-11')
  ) as activity_weeks(week_number, starts_on, ends_on);

  return new;
end;
$$;

create trigger teams_initialize_progress
after insert on public.teams
for each row execute function public.initialize_team_progress();

create function public.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_base_score smallint;
  profile_team_id uuid;
  caller_is_admin boolean := public.is_admin();
begin
  select team_id
  into profile_team_id
  from public.profiles
  where id = new.user_id;

  if profile_team_id is null then
    raise exception 'A report requires an existing profile with a team.'
      using errcode = '23503';
  end if;

  select base_score
  into calculated_base_score
  from public.missions
  where id = new.mission_id
    and is_active = true;

  if calculated_base_score is null then
    raise exception 'The selected mission is not active.'
      using errcode = '23514';
  end if;

  new.team_id := profile_team_id;
  new.base_score := calculated_base_score;
  new.mission_score := calculated_base_score * case when new.is_3x5 then 2 else 1 end;
  new.photo_bonus := case
    when new.photo_is_valid and nullif(btrim(new.photo_path), '') is not null then 3
    else 0
  end;
  new.raw_score := new.mission_score + new.photo_bonus;
  new.accepted_score := 0;

  if tg_op = 'INSERT' then
    new.created_at := now();

    if not caller_is_admin then
      new.status := 'pending';
      new.photo_is_valid := false;
      new.photo_bonus := 0;
      new.raw_score := new.mission_score;
    end if;
  end if;

  return new;
end;
$$;

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
  created_at
on public.reports
for each row execute function public.prepare_report();

create function public.recalculate_team_week(
  target_team_id uuid,
  target_activity_week smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  week_start date;
  week_end date;
  total_accepted smallint;
begin
  if target_activity_week is null then
    return;
  end if;

  select starts_on, ends_on
  into week_start, week_end
  from public.team_progress
  where team_id = target_team_id
    and activity_week = target_activity_week;

  if week_start is null then
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      target_team_id::text || ':' || target_activity_week::text,
      0
    )
  );

  with accepted_reports as (
    select
      id,
      least(
        raw_score,
        greatest(
          30 - coalesce(
            sum(raw_score) over (
              order by created_at, id
              rows between unbounded preceding and 1 preceding
            ),
            0
          ),
          0
        )
      )::smallint as recalculated_score
    from public.reports
    where team_id = target_team_id
      and public.activity_week_for(created_at) = target_activity_week
      and status = 'accepted'
  )
  update public.reports as reports_to_update
  set accepted_score = accepted_reports.recalculated_score
  from accepted_reports
  where reports_to_update.id = accepted_reports.id
    and reports_to_update.accepted_score is distinct from accepted_reports.recalculated_score;

  update public.reports
  set accepted_score = 0
  where team_id = target_team_id
    and public.activity_week_for(created_at) = target_activity_week
    and status <> 'accepted'
    and accepted_score <> 0;

  select coalesce(sum(accepted_score), 0)::smallint
  into total_accepted
  from public.reports
  where team_id = target_team_id
    and public.activity_week_for(created_at) = target_activity_week
    and status = 'accepted';

  update public.team_progress
  set
    accepted_score = total_accepted,
    updated_at = now()
  where team_id = target_team_id
    and activity_week = target_activity_week;
end;
$$;

create function public.sync_team_week_scores()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_activity_week smallint;
  new_activity_week smallint;
begin
  if tg_op = 'DELETE' then
    old_activity_week := public.activity_week_for(old.created_at);
    perform public.recalculate_team_week(old.team_id, old_activity_week);
    return old;
  elsif tg_op = 'INSERT' then
    new_activity_week := public.activity_week_for(new.created_at);
    perform public.recalculate_team_week(new.team_id, new_activity_week);
    return new;
  end if;

  old_activity_week := public.activity_week_for(old.created_at);
  new_activity_week := public.activity_week_for(new.created_at);

  if old.team_id is distinct from new.team_id
    or old_activity_week is distinct from new_activity_week then
    perform public.recalculate_team_week(old.team_id, old_activity_week);
  end if;

  perform public.recalculate_team_week(new.team_id, new_activity_week);
  return new;
end;
$$;

create trigger reports_sync_team_week_scores
after insert or delete or update of
  user_id,
  is_3x5,
  mission_id,
  photo_path,
  photo_is_valid,
  status,
  created_at
on public.reports
for each row execute function public.sync_team_week_scores();

alter table public.age_groups enable row level security;
alter table public.zones enable row level security;
alter table public.teams enable row level security;
alter table public.profiles enable row level security;
alter table public.missions enable row level security;
alter table public.reports enable row level security;
alter table public.admins enable row level security;
alter table public.team_progress enable row level security;

revoke all on table public.age_groups from anon, authenticated;
revoke all on table public.zones from anon, authenticated;
revoke all on table public.teams from anon, authenticated;
revoke all on table public.profiles from anon, authenticated;
revoke all on table public.missions from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.admins from anon, authenticated;
revoke all on table public.team_progress from anon, authenticated;

grant select on table public.age_groups to anon, authenticated;
grant select on table public.zones to anon, authenticated;
grant select on table public.teams to anon, authenticated;
grant select on table public.missions to anon, authenticated;
grant select on table public.team_progress to anon, authenticated;

grant select on table public.profiles to authenticated;
grant insert (id, name, age_group_id, zone_id, team_id)
  on table public.profiles to authenticated;
grant update (name, age_group_id, zone_id, team_id)
  on table public.profiles to authenticated;

grant select on table public.admins to authenticated;

grant select, delete on table public.reports to authenticated;
grant insert (
  user_id,
  friend_alias,
  is_3x5,
  mission_id,
  story,
  photo_path,
  photo_is_valid,
  status
) on table public.reports to authenticated;
grant update (
  user_id,
  friend_alias,
  is_3x5,
  mission_id,
  story,
  photo_path,
  photo_is_valid,
  status,
  created_at
) on table public.reports to authenticated;

create policy "Reference age groups are publicly readable"
on public.age_groups for select
to anon, authenticated
using (true);

create policy "Reference zones are publicly readable"
on public.zones for select
to anon, authenticated
using (true);

create policy "Reference teams are publicly readable"
on public.teams for select
to anon, authenticated
using (true);

create policy "Reference missions are publicly readable"
on public.missions for select
to anon, authenticated
using (true);

create policy "Team progress is publicly readable"
on public.team_progress for select
to anon, authenticated
using (true);

create policy "Users and admins can read profiles"
on public.profiles for select
to authenticated
using (
  (select auth.uid()) = id
  or (select public.is_admin())
);

create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Admins can identify their own role"
on public.admins for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users and admins can read reports"
on public.reports for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select public.is_admin())
);

create policy "Users can submit their own reports"
on public.reports for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  or (select public.is_admin())
);

create policy "Admins can update all reports"
on public.reports for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Admins can delete all reports"
on public.reports for delete
to authenticated
using ((select public.is_admin()));

revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.initialize_team_progress() from public, anon, authenticated;
revoke execute on function public.prepare_report() from public, anon, authenticated;
revoke execute on function public.recalculate_team_week(uuid, smallint)
  from public, anon, authenticated;
revoke execute on function public.sync_team_week_scores() from public, anon, authenticated;
revoke execute on function public.activity_week_for(timestamptz)
  from public, anon, authenticated;
revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

commit;
