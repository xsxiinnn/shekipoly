begin;

insert into auth.users (id)
values
  ('30000000-0000-0000-0000-000000000001'),
  ('30000000-0000-0000-0000-000000000002');

insert into public.admins (user_id, role)
values ('30000000-0000-0000-0000-000000000001', 'super_admin');

insert into public.profiles (id, name, team_id)
select
  '30000000-0000-0000-0000-000000000002',
  'Admin acceptance student',
  teams.id
from public.teams
where teams.name = '舒畬小組';

set local role service_role;

select public.submit_report_for_development(
  '30000000-0000-0000-0000-000000000002', 'admin-case-a', 6, true, '', 1
);
select public.submit_report_for_development(
  '30000000-0000-0000-0000-000000000002', 'admin-case-b', 6, true, '', 1
);
select public.submit_report_for_development(
  '30000000-0000-0000-0000-000000000002', 'admin-case-c', 6, true, '', 1
);
select public.submit_report_for_development(
  '30000000-0000-0000-0000-000000000002', 'admin-case-d', 6, true, '', 1
);
select public.submit_report_for_development(
  '30000000-0000-0000-0000-000000000002', 'admin-case-e', 6, true, '', 1
);
select public.submit_report_for_development(
  '30000000-0000-0000-0000-000000000002', 'admin-case-f', 6, true, '', 1
);

reset role;

do $$
begin
  if (select accepted_score from public.reports where friend_alias = 'admin-case-f') <> 0 then
    raise exception 'Capped report did not start at zero';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select public.admin_void_report(
  (select id from public.reports where friend_alias = 'admin-case-a'),
  '重複回報'
);

do $$
declare
  target_team uuid;
begin
  select team_id into target_team from public.reports where friend_alias = 'admin-case-b';
  if (select accepted_score from public.reports where friend_alias = 'admin-case-f') <> 6 then
    raise exception 'Later capped report was not reallocated after void';
  end if;
  if (select accepted_score from public.team_progress where team_id = target_team and activity_week = 1) > 30 then
    raise exception 'Weekly cap exceeded after void';
  end if;
  if (select accepted_total from public.team_map_progress where team_id = target_team) <> 30 then
    raise exception 'Map progress did not reflect void recalculation';
  end if;
  if not exists (
    select 1 from public.admin_audit_logs
    where action = 'report_voided'
      and target_report_id = (select id from public.reports where friend_alias = 'admin-case-a')
  ) then
    raise exception 'Void audit log missing';
  end if;
end;
$$;

reset role;

-- A non-admin authenticated student cannot call an admin mutation directly.
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000002', true);
set local role authenticated;

do $$
begin
  perform public.admin_void_report(
    (select id from public.reports where friend_alias = 'admin-case-b'),
    '不應成功'
  );
  raise exception 'Non-admin void unexpectedly succeeded';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'ADMIN_FORBIDDEN' then raise; end if;
end;
$$;

reset role;

-- Photo moderation never changes scoring.
insert into storage.objects (bucket_id, name, owner_id, metadata)
values (
  'mission-photos',
  '30000000-0000-0000-0000-000000000002/30000000-0000-4000-8000-000000000001.webp',
  '30000000-0000-0000-0000-000000000002',
  '{"mimetype":"image/webp","size":100000}'
);

set local role service_role;
select public.submit_report_for_development_v2(
  '30000000-0000-0000-0000-000000000002', 'admin-photo-case', 1, false, '', 2,
  '30000000-0000-0000-0000-000000000002/30000000-0000-4000-8000-000000000001.webp'
);
reset role;

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select public.admin_set_photo_visibility(
  (select id from public.reports where friend_alias = 'admin-photo-case'),
  'hidden'
);

do $$
declare
  before_raw smallint;
  before_accepted smallint;
begin
  select raw_score, accepted_score into before_raw, before_accepted
  from public.reports where friend_alias = 'admin-photo-case';
  if not exists (
    select 1 from public.reports
    where friend_alias = 'admin-photo-case'
      and status = 'active'
      and photo_visibility = 'hidden'
      and raw_score = before_raw
      and accepted_score = before_accepted
  ) then
    raise exception 'Photo hide changed report scoring or status';
  end if;
end;
$$;

select public.admin_set_photo_visibility(
  (select id from public.reports where friend_alias = 'admin-photo-case'),
  'visible'
);

do $$
begin
  if not exists (
    select 1 from public.reports
    where friend_alias = 'admin-photo-case'
      and status = 'active'
      and photo_visibility = 'visible'
  ) then
    raise exception 'Photo restore failed';
  end if;
  if (select count(*) from public.admin_audit_logs where target_report_id = (
    select id from public.reports where friend_alias = 'admin-photo-case'
  )) <> 2 then
    raise exception 'Photo moderation audit logs missing';
  end if;
end;
$$;

rollback;
