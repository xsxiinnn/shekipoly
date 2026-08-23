# Vercel Production Checklist

## Repository and build

- [ ] GitHub `main` contains the approved release commit and no unreviewed local changes.
- [ ] Resolve the repository integrity issue in `20260821000000_photo_report_v2.sql` with the project owner/Supabase migration-history procedure; do not edit the already-applied file casually or reset production.
- [ ] Vercel project is connected to the correct GitHub repository and production branch.
- [ ] Framework preset is Next.js and the project root is this repository.
- [ ] Local `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` pass.
- [ ] Latest Supabase migrations were reviewed with `npx supabase migration list` and `npx supabase db push --dry-run` before push.

## Production environment variables

Set these only in Vercel Production (and separately in Preview only when intended):

- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (server-only secret)
- [ ] `DEV_ACTIVITY_WEEK` is **not set** in Production.
- [ ] No variable named `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` exists.
- [ ] Redeploy after changing environment variables.

Production code ignores `DEV_ACTIVITY_WEEK` when `NODE_ENV=production`, but omitting it reduces operational confusion.

## Supabase

- [ ] Supabase Auth anonymous sign-ins are enabled for students.
- [ ] A formal email/password admin exists and its UUID is present in `public.admins`.
- [ ] Site URL and redirect URL allow the final HTTPS production domain (and intended preview domains only).
- [ ] `mission-photos` exists, is private, and has JPEG/PNG/WebP plus 2 MB limits.
- [ ] Storage and table RLS are enabled; authenticated students cannot read all reports or all storage objects.
- [ ] Production data validation script reports four team groups, 12 zones, six missions, official teams, an admin, scoring functions, bucket, and RLS.

## Deploy and smoke test

- [ ] Production deployment completes without build warnings that indicate missing variables or failed routes.
- [ ] Open the final production URL in a clean browser and complete the student smoke flow.
- [ ] Test iPhone Safari and Android Chrome at the viewport/device sizes in `docs/production-smoke-test.md`.
- [ ] Verify report score, map movement, and weekly cap from the admin view.
- [ ] Upload a photo, confirm the signed URL loads, then reload after expiration to confirm a new URL is generated.
- [ ] Verify admin login, dashboard, reports, void/recalculation, photo moderation, and CSV.
- [ ] Verify a student is rejected from `/admin`.
- [ ] Check Vercel function logs for unexpected Supabase errors without exposing them in the UI.
- [ ] Save the tested production URL, release commit SHA, tester, and timestamp in the release record.
