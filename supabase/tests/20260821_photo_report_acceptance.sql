begin;

insert into auth.users (id)
values
  ('20000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003');

insert into public.profiles (id, name, team_id)
select test_user.id, test_user.name, teams.id
from (
  values
    ('20000000-0000-0000-0000-000000000001'::uuid, 'Photo owner A', '舒畬小組'),
    ('20000000-0000-0000-0000-000000000002'::uuid, 'Photo owner B', '舒畬小組'),
    ('20000000-0000-0000-0000-000000000003'::uuid, 'Weekly cap', '信博小組')
) as test_user(id, name, team_name)
join public.teams on teams.name = test_user.team_name;

insert into storage.objects (bucket_id, name, owner_id, metadata)
values
  ('mission-photos', '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000001.webp', '20000000-0000-0000-0000-000000000001', '{"mimetype":"image/webp","size":100000}'),
  ('mission-photos', '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000002.webp', '20000000-0000-0000-0000-000000000001', '{"mimetype":"image/webp","size":100000}'),
  ('mission-photos', '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000003.webp', '20000000-0000-0000-0000-000000000001', '{"mimetype":"image/webp","size":100000}'),
  ('mission-photos', '20000000-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000004.webp', '20000000-0000-0000-0000-000000000002', '{"mimetype":"image/webp","size":100000}'),
  ('mission-photos', '20000000-0000-0000-0000-000000000003/00000000-0000-4000-8000-000000000005.webp', '20000000-0000-0000-0000-000000000003', '{"mimetype":"image/webp","size":100000}'),
  ('mission-photos', '20000000-0000-0000-0000-000000000003/00000000-0000-4000-8000-000000000006.webp', '20000000-0000-0000-0000-000000000003', '{"mimetype":"image/webp","size":100000}'),
  ('mission-photos', '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000007.webp', '20000000-0000-0000-0000-000000000001', '{"mimetype":"image/webp","size":100000}'),
  ('mission-photos', '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000008.svg', '20000000-0000-0000-0000-000000000001', '{"mimetype":"image/svg+xml","size":1000}'),
  ('mission-photos', '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000009.webp', '20000000-0000-0000-0000-000000000001', '{"mimetype":"image/svg+xml","size":1000}');

set local role service_role;

-- Case A: no photo.
select public.submit_report_for_development_v2(
  '20000000-0000-0000-0000-000000000001', 'photo-case-a', 1, false, '', 1,
  null, false
);

-- Case B: normal mission one + valid photo = 1 + 3.
select public.submit_report_for_development_v2(
  '20000000-0000-0000-0000-000000000001', 'photo-case-b', 1, false, '', 1,
  '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000001.webp', true
);

-- Case C: 3x5 mission five + photo = 6 + 3, never 12.
select public.submit_report_for_development_v2(
  '20000000-0000-0000-0000-000000000001', 'photo-case-c', 5, true, '', 1,
  '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000002.webp', true
);

-- Prefill a separate team to 27, then verify cap cases D and E.
select public.submit_report_for_development(
  '20000000-0000-0000-0000-000000000003', 'photo-prefill-1', 6, true, '', 1
);
select public.submit_report_for_development(
  '20000000-0000-0000-0000-000000000003', 'photo-prefill-2', 6, true, '', 1
);
select public.submit_report_for_development(
  '20000000-0000-0000-0000-000000000003', 'photo-prefill-3', 6, true, '', 1
);
select public.submit_report_for_development(
  '20000000-0000-0000-0000-000000000003', 'photo-prefill-4', 6, true, '', 1
);
select public.submit_report_for_development(
  '20000000-0000-0000-0000-000000000003', 'photo-prefill-5', 5, false, '', 1
);

select public.submit_report_for_development_v2(
  '20000000-0000-0000-0000-000000000003', 'photo-case-d', 5, true, '', 1,
  '20000000-0000-0000-0000-000000000003/00000000-0000-4000-8000-000000000005.webp', true
);
select public.submit_report_for_development_v2(
  '20000000-0000-0000-0000-000000000003', 'photo-case-e', 6, true, '', 1,
  '20000000-0000-0000-0000-000000000003/00000000-0000-4000-8000-000000000006.webp', true
);

reset role;

do $$
declare
  scores text[];
begin
  select array_agg(
    friend_alias || ':' || mission_score || ':' || photo_bonus || ':' || raw_score || ':' || accepted_score
    order by friend_alias
  ) into scores
  from public.reports
  where friend_alias in ('photo-case-a', 'photo-case-b', 'photo-case-c', 'photo-case-d', 'photo-case-e');

  if scores <> array[
    'photo-case-a:1:0:1:1',
    'photo-case-b:1:3:4:4',
    'photo-case-c:6:3:9:9',
    'photo-case-d:6:3:9:3',
    'photo-case-e:6:3:9:0'
  ] then
    raise exception 'Photo scoring cases A-E mismatch: %', scores;
  end if;
end;
$$;

-- Cases F-H: fake, foreign, and reused paths never earn a second bonus.
do $$
begin
  perform public.submit_report_for_development_v2(
    '20000000-0000-0000-0000-000000000001', 'photo-case-f', 1, false, '', 1,
    '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-999999999999.webp', true
  );
  raise exception 'Missing photo unexpectedly succeeded';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'REPORT_PHOTO_NOT_OWNED' then raise; end if;
end;
$$;

-- A photo without explicit consent is rejected before it can be scored.
do $$
begin
  perform public.submit_report_for_development_v2(
    '20000000-0000-0000-0000-000000000001', 'photo-case-no-consent', 1, false, '', 1,
    '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000008.svg', false
  );
  raise exception 'Photo without consent unexpectedly succeeded';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'REPORT_PHOTO_CONSENT_REQUIRED' then raise; end if;
end;
$$;

do $$
begin
  perform public.submit_report_for_development_v2(
    '20000000-0000-0000-0000-000000000001', 'photo-case-f-mime', 1, false, '', 1,
    '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000009.webp', true
  );
  raise exception 'Invalid MIME photo unexpectedly succeeded';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'REPORT_PHOTO_INVALID' then raise; end if;
end;
$$;

do $$
begin
  perform public.submit_report_for_development_v2(
    '20000000-0000-0000-0000-000000000001', 'photo-case-g', 1, false, '', 1,
    '20000000-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000004.webp', true
  );
  raise exception 'Foreign photo unexpectedly succeeded';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'REPORT_PHOTO_NOT_OWNED' then raise; end if;
end;
$$;

do $$
begin
  perform public.submit_report_for_development_v2(
    '20000000-0000-0000-0000-000000000001', 'photo-case-h', 1, false, '', 1,
    '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000001.webp', true
  );
  raise exception 'Reused photo unexpectedly succeeded';
exception when sqlstate 'P0001' then
  if sqlerrm <> 'REPORT_PHOTO_ALREADY_USED' then raise; end if;
end;
$$;

-- Case I: hidden stays scored and stored, but is excluded from wall filters.
set local role service_role;
select public.submit_report_for_development_v2(
  '20000000-0000-0000-0000-000000000001', 'photo-case-i', 2, false, '', 1,
  '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000007.webp', true
);
reset role;

update public.reports
set photo_visibility = 'hidden'
where friend_alias = 'photo-case-i';

do $$
begin
  if not exists (
    select 1 from public.reports
    where friend_alias = 'photo-case-i'
      and photo_bonus = 3
      and photo_visibility = 'hidden'
  ) then
    raise exception 'Hidden photo report was modified or removed';
  end if;

  if exists (
    select 1 from public.reports
    where friend_alias = 'photo-case-i'
      and status = 'active'
      and photo_is_valid
      and photo_consent
      and photo_visibility = 'visible'
      and photo_path is not null
  ) then
    raise exception 'Hidden photo leaked through photo-wall filter';
  end if;

  if not exists (
    select 1 from public.reports
    where friend_alias = 'photo-case-e'
      and accepted_score = 0
      and status = 'active'
      and photo_is_valid
      and photo_consent
      and photo_visibility = 'visible'
      and photo_path is not null
  ) then
    raise exception 'Cap-zero photo was incorrectly hidden from photo wall';
  end if;

  if (select public from storage.buckets where id = 'mission-photos') then
    raise exception 'mission-photos bucket is unexpectedly public';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.submit_report_for_development_v2(uuid, text, integer, boolean, text, integer, text, boolean)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.submit_report_with_photo(uuid, text, integer, boolean, text, text, boolean)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.submit_report_with_photo(uuid, text, integer, boolean, text, text, boolean)',
    'EXECUTE'
  ) then
    raise exception 'Photo report RPC privileges are incorrect';
  end if;
end;
$$;

-- Storage RLS: own UUID folder is writable/readable, foreign folders are not,
-- referenced objects cannot be deleted, and unreferenced own uploads can be.
select set_config(
  'request.jwt.claim.sub',
  '20000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

insert into storage.objects (bucket_id, name, owner_id, metadata)
values (
  'mission-photos',
  '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000010.webp',
  '20000000-0000-0000-0000-000000000001',
  '{"mimetype":"image/webp","size":100000}'
);

do $$
declare
  affected integer;
begin
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'mission-photos',
      '20000000-0000-0000-0000-000000000002/00000000-0000-4000-8000-000000000011.webp',
      '20000000-0000-0000-0000-000000000002',
      '{"mimetype":"image/webp","size":100000}'
    );
    raise exception 'Foreign-folder upload unexpectedly succeeded';
  exception when insufficient_privilege then
    null;
  end;

  if exists (
    select 1 from storage.objects
    where owner_id <> '20000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'User can browse another user storage objects';
  end if;

  delete from storage.objects
  where name = '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000001.webp';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Referenced photo was deletable by its owner';
  end if;

  delete from storage.objects
  where name = '20000000-0000-0000-0000-000000000001/00000000-0000-4000-8000-000000000010.webp';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'Unreferenced own upload could not be deleted';
  end if;
end;
$$;

reset role;

rollback;
