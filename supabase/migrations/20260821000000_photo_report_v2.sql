begin;

alter table public.reports
add column photo_consent boolean not null default false;

alter table public.reports
add column photo_visibility text not null default 'visible'
  check (photo_visibility in ('visible', 'hidden'));

alter table public.reports
add constraint reports_valid_photo_requires_consent
check (not photo_is_valid or (photo_consent and photo_path is not null));

create unique index reports_active_photo_path_unique
  on public.reports(photo_path)
  where status = 'active' and photo_path is not null;

comment on column public.reports.photo_consent is
  '回報者確認照片可用於活動照片牆；有照片 bonus 時必須為 true。';
comment on column public.reports.photo_visibility is
  '照片牆顯示狀態；學生不可直接修改。';

-- Keep the bucket private. MIME and byte limits are enforced again inside the
-- trusted report RPC because client-supplied metadata is never a score source.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'mission-photos',
  'mission-photos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can upload mission photos to their folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'mission-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id::text = (select auth.uid())::text
  and name ~ (
    '^' || (select auth.uid())::text ||
    '/[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
  )
);

create policy "Users can read their own mission photo objects"
on storage.objects for select
to authenticated
using (
  bucket_id = 'mission-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id::text = (select auth.uid())::text
);

create policy "Users can delete unreferenced mission photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'mission-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id::text = (select auth.uid())::text
  and not exists (
    select 1
    from public.reports
    where reports.photo_path = storage.objects.name
  )
);

create or replace function public.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  calculated_base_score smallint;
  profile_team_id uuid;
begin
  select profiles.team_id
  into profile_team_id
  from public.profiles
  join public.teams on teams.id = profiles.team_id
  where profiles.id = new.user_id
    and teams.is_active = true;

  if profile_team_id is null then
    raise exception 'REPORT_PROFILE_REQUIRED'
      using errcode = 'P0001';
  end if;

  select missions.base_score
  into calculated_base_score
  from public.missions
  where missions.id = new.mission_id
    and missions.is_active = true;

  if calculated_base_score is null then
    raise exception 'REPORT_MISSION_INVALID'
      using errcode = 'P0001';
  end if;

  new.team_id := profile_team_id;
  new.base_score := calculated_base_score;
  new.mission_score := calculated_base_score * case when new.is_3x5 then 2 else 1 end;
  new.photo_is_valid := coalesce(new.photo_is_valid, false)
    and new.photo_path is not null
    and coalesce(new.photo_consent, false);
  new.photo_bonus := case when new.photo_is_valid then 3 else 0 end;
  new.raw_score := new.mission_score + new.photo_bonus;
  new.accepted_score := 0;

  if new.photo_path is null then
    new.photo_consent := false;
  end if;

  if tg_op = 'INSERT' then
    new.created_at := now();
    new.status := 'active';
    new.photo_visibility := 'visible';
    new.activity_week := coalesce(
      new.activity_week,
      public.activity_week_for(new.created_at)
    );

    if new.activity_week is null then
      raise exception 'REPORT_OUTSIDE_ACTIVITY'
        using errcode = 'P0001';
    end if;
  else
    new.created_at := old.created_at;
    new.activity_week := old.activity_week;
  end if;

  return new;
end;
$$;

drop function public.submit_report(text, integer, boolean, text);
drop function public.submit_report_for_development(uuid, text, integer, boolean, text, integer);
drop function public.submit_report_internal(uuid, text, integer, boolean, text, integer);

create function public.submit_report_internal(
  p_reporter_id uuid,
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text,
  p_activity_week_override integer,
  p_photo_path text,
  p_photo_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  reporter_id uuid := p_reporter_id;
  reporter_team_id uuid;
  reporter_team_name text;
  effective_activity_week smallint;
  created_report public.reports%rowtype;
  selected_mission_name text;
  weekly_accepted smallint;
  map_progress record;
  normalized_photo_path text := nullif(btrim(p_photo_path), '');
  stored_photo_owner text;
  stored_photo_mime text;
  stored_photo_size bigint;
  has_valid_photo boolean := false;
begin
  if reporter_id is null then
    raise exception 'REPORT_AUTH_REQUIRED'
      using errcode = 'P0001';
  end if;

  if nullif(btrim(p_friend_alias), '') is null
    or length(btrim(p_friend_alias)) > 80 then
    raise exception 'REPORT_FRIEND_ALIAS_INVALID'
      using errcode = 'P0001';
  end if;

  if length(coalesce(p_story, '')) > 2000 then
    raise exception 'REPORT_STORY_TOO_LONG'
      using errcode = 'P0001';
  end if;

  if p_activity_week_override is not null
    and p_activity_week_override not between 1 and 6 then
    raise exception 'REPORT_WEEK_OVERRIDE_INVALID'
      using errcode = 'P0001';
  end if;

  select teams.id, teams.name
  into reporter_team_id, reporter_team_name
  from public.profiles
  join public.teams on teams.id = profiles.team_id
  where profiles.id = reporter_id
    and teams.is_active = true;

  if reporter_team_id is null then
    raise exception 'REPORT_PROFILE_REQUIRED'
      using errcode = 'P0001';
  end if;

  select missions.name
  into selected_mission_name
  from public.missions
  where missions.id = p_mission_id
    and missions.is_active = true;

  if selected_mission_name is null then
    raise exception 'REPORT_MISSION_INVALID'
      using errcode = 'P0001';
  end if;

  effective_activity_week := coalesce(
    p_activity_week_override::smallint,
    public.activity_week_for(now())
  );

  if effective_activity_week is null then
    raise exception 'REPORT_OUTSIDE_ACTIVITY'
      using errcode = 'P0001';
  end if;

  if normalized_photo_path is not null then
    if not coalesce(p_photo_consent, false) then
      raise exception 'REPORT_PHOTO_CONSENT_REQUIRED'
        using errcode = 'P0001';
    end if;

    if split_part(normalized_photo_path, '/', 1) <> reporter_id::text
      or normalized_photo_path !~ (
        '^' || reporter_id::text ||
        '/[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.](jpg|jpeg|png|webp)$'
      ) then
      raise exception 'REPORT_PHOTO_NOT_OWNED'
        using errcode = 'P0001';
    end if;

    select
      storage_objects.owner_id::text,
      lower(storage_objects.metadata ->> 'mimetype'),
      case
        when storage_objects.metadata ->> 'size' ~ '^[0-9]+$'
          then (storage_objects.metadata ->> 'size')::bigint
        else null
      end
    into stored_photo_owner, stored_photo_mime, stored_photo_size
    from storage.objects as storage_objects
    where storage_objects.bucket_id = 'mission-photos'
      and storage_objects.name = normalized_photo_path;

    if stored_photo_owner is null
      or stored_photo_owner <> reporter_id::text then
      raise exception 'REPORT_PHOTO_NOT_OWNED'
        using errcode = 'P0001';
    end if;

    if stored_photo_mime not in ('image/jpeg', 'image/png', 'image/webp')
      or stored_photo_size is null
      or stored_photo_size <= 0
      or stored_photo_size > 2097152 then
      raise exception 'REPORT_PHOTO_INVALID'
        using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from public.reports
      where reports.photo_path = normalized_photo_path
        and reports.status = 'active'
    ) then
      raise exception 'REPORT_PHOTO_ALREADY_USED'
        using errcode = 'P0001';
    end if;

    has_valid_photo := true;
  end if;

  -- Preserve the existing transaction-safe weekly cap behavior.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      reporter_team_id::text || ':' || effective_activity_week::text,
      0
    )
  );

  insert into public.reports (
    user_id,
    team_id,
    friend_alias,
    is_3x5,
    mission_id,
    story,
    photo_path,
    photo_is_valid,
    photo_consent,
    status,
    activity_week
  ) values (
    reporter_id,
    reporter_team_id,
    btrim(p_friend_alias),
    p_is_3x5,
    p_mission_id::smallint,
    coalesce(p_story, ''),
    normalized_photo_path,
    has_valid_photo,
    has_valid_photo,
    'active',
    effective_activity_week
  )
  returning * into created_report;

  select reports.*
  into created_report
  from public.reports
  where reports.id = created_report.id;

  select team_progress.accepted_score
  into weekly_accepted
  from public.team_progress
  where team_progress.team_id = reporter_team_id
    and team_progress.activity_week = effective_activity_week;

  select *
  into map_progress
  from public.team_map_progress
  where team_map_progress.team_id = reporter_team_id;

  return jsonb_build_object(
    'report_id', created_report.id,
    'mission_name', selected_mission_name,
    'is_3x5', created_report.is_3x5,
    'mission_score', created_report.mission_score,
    'photo_bonus', created_report.photo_bonus,
    'has_photo', created_report.photo_path is not null,
    'raw_score', created_report.raw_score,
    'accepted_score', created_report.accepted_score,
    'activity_week', created_report.activity_week,
    'team_name', reporter_team_name,
    'team_weekly_score', coalesce(weekly_accepted, 0),
    'team_total_score', coalesce(map_progress.accepted_total, 0),
    'current_square', coalesce(map_progress.current_square, 1),
    'steps_to_next_square', coalesce(map_progress.steps_to_next_square, 5)
  );
exception
  when unique_violation then
    raise exception 'REPORT_PHOTO_ALREADY_USED'
      using errcode = 'P0001';
end;
$$;

-- Backward-compatible no-photo RPC.
create function public.submit_report(
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text default ''
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_internal(
    auth.uid(), p_friend_alias, p_mission_id, p_is_3x5, p_story, null, null, false
  );
$$;

create function public.submit_report_with_photo(
  p_reporter_id uuid,
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text,
  p_photo_path text,
  p_photo_consent boolean
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_internal(
    p_reporter_id, p_friend_alias, p_mission_id, p_is_3x5, p_story, null,
    p_photo_path, p_photo_consent
  );
$$;

-- Backward-compatible trusted development RPC.
create function public.submit_report_for_development(
  p_reporter_id uuid,
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text,
  p_activity_week integer
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_internal(
    p_reporter_id, p_friend_alias, p_mission_id, p_is_3x5, p_story,
    p_activity_week, null, false
  );
$$;

create function public.submit_report_for_development_v2(
  p_reporter_id uuid,
  p_friend_alias text,
  p_mission_id integer,
  p_is_3x5 boolean,
  p_story text,
  p_activity_week integer,
  p_photo_path text,
  p_photo_consent boolean
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.submit_report_internal(
    p_reporter_id, p_friend_alias, p_mission_id, p_is_3x5, p_story,
    p_activity_week, p_photo_path, p_photo_consent
  );
$$;

revoke execute on function public.submit_report_internal(
  uuid, text, integer, boolean, text, integer, text, boolean
) from public, anon, authenticated;

revoke execute on function public.submit_report(text, integer, boolean, text)
  from public, anon;
grant execute on function public.submit_report(text, integer, boolean, text)
  to authenticated;

revoke execute on function public.submit_report_with_photo(
  uuid, text, integer, boolean, text, text, boolean
) from public, anon, authenticated;

revoke execute on function public.submit_report_for_development(
  uuid, text, integer, boolean, text, integer
) from public, anon, authenticated;
revoke execute on function public.submit_report_for_development_v2(
  uuid, text, integer, boolean, text, integer, text, boolean
) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_catalog.pg_roles where rolname = 'service_role') then
    grant execute on function public.submit_report_for_development(
      uuid, text, integer, boolean, text, integer
    ) to service_role;
    grant execute on function public.submit_report_for_development_v2(
      uuid, text, integer, boolean, text, integer, text, boolean
    ) to service_role;
    grant execute on function public.submit_report_with_photo(
      uuid, text, integer, boolean, text, text, boolean
    ) to service_role;
  end if;
end;
$$;

revoke insert (photo_consent, photo_visibility)
  on table public.reports from authenticated;
revoke update (photo_consent, photo_visibility)
  on table public.reports from authenticated;

commit;
