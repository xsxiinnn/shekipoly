-- DESTRUCTIVE, guarded pre-launch cleanup. Review docs/prelaunch-data-cleanup.md.
-- This deletes only reports created before the formal launch. It never deletes
-- reference data, admins, profiles, auth users, storage objects, or migrations.

begin;

-- Intentionally invalid by default. Replace REVIEW_REQUIRED with the exact
-- confirmation phrase only after backup, preview, and Storage cleanup.
select set_config(
  'app.prelaunch_cleanup_confirmation',
  'REVIEW_REQUIRED',
  true
);

do $$
begin
  if current_setting('app.prelaunch_cleanup_confirmation', true)
      <> 'DELETE_PRELAUNCH_TEST_REPORTS' then
    raise exception 'PRELAUNCH_CLEANUP_NOT_CONFIRMED';
  end if;

  if (now() at time zone 'Asia/Taipei')::date >= date '2026-08-31' then
    raise exception 'PRELAUNCH_CLEANUP_WINDOW_CLOSED';
  end if;
end;
$$;

create temporary table prelaunch_report_ids on commit drop as
select id
from public.reports
where created_at < timestamptz '2026-08-31 00:00:00 Asia/Taipei';

do $$
declare
  target_count bigint;
begin
  select count(*) into target_count from prelaunch_report_ids;
  raise notice 'Deleting % reviewed pre-launch reports', target_count;
end;
$$;

delete from public.reports
using prelaunch_report_ids
where reports.id = prelaunch_report_ids.id;

do $$
begin
  if exists (
    select 1 from public.reports
    where created_at < timestamptz '2026-08-31 00:00:00 Asia/Taipei'
  ) then
    raise exception 'PRELAUNCH_REPORTS_REMAIN';
  end if;

  if exists (select 1 from public.team_progress where accepted_score <> 0) then
    raise exception 'TEAM_PROGRESS_NOT_ZERO_AFTER_CLEANUP';
  end if;
end;
$$;

commit;
