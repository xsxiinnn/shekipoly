begin;

do $$
begin
  if (select count(*) from public.teams where name = '品凡小組') <> 1 then
    raise exception '品凡小組 must remain one record';
  end if;
  if not exists (
    select 1 from public.teams
    join public.zones on zones.id = teams.zone_id
    join public.team_groups on team_groups.id = zones.team_group_id
    where teams.name = '品凡小組'
      and zones.name = '6區'
      and team_groups.name = '神榮耀團隊'
  ) then
    raise exception '品凡小組 hierarchy is incorrect';
  end if;
end;
$$;

insert into auth.users (id)
values ('40000000-0000-0000-0000-000000000001');

insert into public.profiles (id, name, team_id)
select '40000000-0000-0000-0000-000000000001', 'Prelaunch test user', teams.id
from public.teams
where teams.name = '品凡小組';

insert into public.admins (user_id, role)
values ('40000000-0000-0000-0000-000000000001', 'super_admin');

set local role service_role;

select public.submit_report_trusted(
  '40000000-0000-0000-0000-000000000001', 'test-1', 5, true, '', 1, null, true
);
select public.submit_report_trusted(
  '40000000-0000-0000-0000-000000000001', 'test-2', 5, true, '', 1, null, true
);
select public.submit_report_trusted(
  '40000000-0000-0000-0000-000000000001', 'test-3', 5, true, '', 1, null, true
);
select public.submit_report_trusted(
  '40000000-0000-0000-0000-000000000001', 'test-4', 5, true, '', 1, null, true
);
select public.submit_report_trusted(
  '40000000-0000-0000-0000-000000000001', 'test-5', 5, true, '', 1, null, true
);
select public.submit_report_trusted(
  '40000000-0000-0000-0000-000000000001', 'test-6', 5, true, '', 1, null, true
);

reset role;

do $$
declare target_team uuid;
begin
  select team_id into target_team from public.profiles
  where id = '40000000-0000-0000-0000-000000000001';

  if (select count(*) from public.reports where user_id = '40000000-0000-0000-0000-000000000001' and is_prelaunch_test) <> 6 then
    raise exception 'Trusted test reports were not marked is_prelaunch_test';
  end if;
  if (select sum(accepted_score) from public.reports where team_id = target_team and activity_week = 1 and is_prelaunch_test) <> 36 then
    raise exception 'Test reports were not fully accepted';
  end if;
  if (select accepted_score from public.team_progress where team_id = target_team and activity_week = 1 and is_prelaunch_test) <> 36 then
    raise exception 'Test progress aggregate mismatch';
  end if;
  if (select accepted_score from public.team_progress where team_id = target_team and activity_week = 1 and not is_prelaunch_test) <> 0 then
    raise exception 'Test reports contaminated official progress';
  end if;
  if exists (
    select 1 from public.team_map_progress
    where team_id = target_team and not is_prelaunch_test and accepted_total <> 0
  ) then
    raise exception 'Test reports contaminated official map';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.submit_report_trusted(uuid,text,integer,boolean,text,integer,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'Authenticated role can execute trusted test RPC';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select public.admin_void_report(
  (select id from public.reports where friend_alias = 'test-1'),
  '測試 scope 重算驗證'
);

do $$
declare target_team uuid;
begin
  select team_id into target_team from public.profiles
  where id = '40000000-0000-0000-0000-000000000001';

  if (select accepted_score from public.reports where friend_alias = 'test-6') <> 6 then
    raise exception 'Void changed another active TEST score';
  end if;
  if (select sum(accepted_score) from public.reports
      where team_id = target_team and activity_week = 1
        and is_prelaunch_test and status = 'active') <> 30 then
    raise exception 'TEST total did not remove only the void report';
  end if;
  if exists (
    select 1 from public.team_progress
    where team_id = target_team and activity_week = 1
      and not is_prelaunch_test and accepted_score <> 0
  ) then
    raise exception 'TEST void recalculation contaminated official progress';
  end if;
end;
$$;

reset role;

rollback;
