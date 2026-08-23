# Pre-launch Test Data Cleanup

Do not reset the remote database. Preserve `team_groups`, `zones`, `teams`, `missions`, `admins`, schema objects, and migrations.

## Recommended guarded cleanup

Use this option only after confirming that every report created before `2026-08-31 00:00 Asia/Taipei` is test data.

1. Take a Supabase database backup and record the project/ref and timestamp.
2. Run the preview queries below in the production SQL Editor. Review counts and export `photo_path` values before deleting anything.
3. Delete the exported objects from the private `mission-photos` bucket through the Supabase Storage API or Dashboard. Deleting rows from `storage.objects` directly is not a supported substitute for deleting the underlying files.
4. Open `supabase/scripts/prelaunch_cleanup.sql`, replace the confirmation placeholder exactly as instructed, and run it once in the SQL Editor before launch.
5. Run `supabase/scripts/prelaunch_validate.sql` and the post-cleanup checks below.
6. Delete test anonymous Auth users only by an explicit reviewed UUID list in the Auth Dashboard/API. Never bulk-delete all auth users: the first admin must remain.

Preview:

```sql
select count(*) as report_count,
       count(photo_path) as referenced_photo_count,
       min(created_at) as oldest,
       max(created_at) as newest
from public.reports
where created_at < timestamptz '2026-08-31 00:00:00 Asia/Taipei';

select id, user_id, photo_path, created_at
from public.reports
where created_at < timestamptz '2026-08-31 00:00:00 Asia/Taipei'
  and photo_path is not null
order by created_at, id;
```

Post-cleanup:

```sql
select count(*) as remaining_prelaunch_reports
from public.reports
where created_at < timestamptz '2026-08-31 00:00:00 Asia/Taipei';

select count(*) as nonzero_team_weeks
from public.team_progress
where accepted_score <> 0;

select count(*) as visible_photos
from public.reports
where status = 'active'
  and photo_path is not null
  and photo_is_valid
  and photo_visibility = 'visible'
  and photo_consent;
```

Expected before the first formal report: all three counts are zero. `team_map_progress.accepted_total` should also be zero for every team, so all flags use the existing start-square convention.

## Selective cleanup alternative

If any real early data must remain, do not use the date-based script. Create and review an explicit list of test report UUIDs, delete their Storage objects first, then delete only those `reports.id` values inside one transaction. The existing report triggers recalculate affected team weeks. Delete test profiles/Auth users only through an explicit UUID allowlist after confirming none belong to `public.admins`.

## Orphan storage audit

Use the Storage object listing API/Dashboard to compare bucket object names with non-null `reports.photo_path`. Remove only reviewed objects that have no report reference. Do not expose or paste signed URLs into cleanup logs.
