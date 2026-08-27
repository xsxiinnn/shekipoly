# Production Smoke Test

Run this checklist against the final Vercel production URL on a real iPhone and Android phone. Use a dedicated test student and a dedicated admin. Record the timestamp and tester for every run.

## Preconditions

- [ ] Production migrations are current (`supabase migration list`).
- [ ] Vercel production variables are configured; `DEV_ACTIVITY_WEEK` is absent.
- [ ] `mission-photos` is private.
- [ ] Six missions, four team groups, 12 zones, official teams, and at least one admin exist.
- [ ] Use a real activity date. Outside the activity window, report submission must be rejected.

## Student

- [ ] First visit to `/` redirects to `/onboarding` when no profile exists.
- [ ] Anonymous session is created and team → zone → team options cascade correctly.
- [ ] Completing onboarding creates the profile and redirects to `/report`.
- [ ] Refreshing and reopening the browser preserves the session/profile.
- [ ] `/` and completed onboarding take the student to `/report`.
- [ ] Report header shows the correct name, team group, zone, and team.
- [ ] Activity status shows before, active W1–W6, or ended correctly in Taipei time.
- [ ] A normal mission report succeeds with the database-calculated score.
- [ ] A 3×5 mission doubles only the mission score.
- [ ] A valid photo adds exactly 3 steps, is previewed before upload, and does not double.
- [ ] Photo upload remains optional; JPG, PNG, and WebP work.
- [ ] Invalid/oversized/unsupported photos show a friendly error without clearing the form.
- [ ] Submit shows progress, is disabled while busy, and a double tap creates one report.
- [ ] Success state shows raw steps, accepted steps, weekly total, map square, and remainder.
- [ ] Every active report is fully counted; weekly accepted steps have no cap.
- [ ] `/map` displays the correct team flag position and no horizontal scrolling.
- [ ] `/photos` defaults to the student's team group and can switch groups.
- [ ] Photo wall excludes hidden photos, void reports, and invalid photos.
- [ ] Photo wall shows the reporter name and story, but never shows friend alias, user ID, email, or raw storage path.
- [ ] Signed images load, lazy-load, open in the dialog, close with button/backdrop/Escape, and can be reopened after URL renewal.
- [ ] `/rules` shows the six database missions, four database team groups/zones, photo bonus, unlimited weekly steps, the 10-step map rule, and official dates.
- [ ] Bottom navigation has exactly Report, Map, Photos, and Rules with a visible active state.

## Admin

- [ ] Email/password admin login succeeds and redirects to `/admin`.
- [ ] Dashboard KPIs, week filter, team overview, and team progress load.
- [ ] Reports filters, search, pagination, detail, and Taipei timestamps work.
- [ ] Voiding a report keeps the record, records the reason, and removes its score from that team/week.
- [ ] Map reflects the recalculated accepted scores after void.
- [ ] Photo hide removes it from the student wall without changing score.
- [ ] Eligible photo restore returns it to the student wall.
- [ ] CSV export matches active filters and opens as Chinese text in Excel.
- [ ] Admin logout ends the admin session.

## Security

- [ ] A normal anonymous-auth student opening `/admin` or invoking an admin action is rejected.
- [ ] Production ignores `DEV_ACTIVITY_WEEK` even if it is accidentally configured.
- [ ] Outside the formal dates, report submission returns the friendly closed-period message.
- [ ] Browser source/network responses expose no service-role key, auth token, raw photo path, friend alias, or email; photo-wall story and reporter name are the only approved participant details.
- [ ] A student cannot upload into another user's folder or reuse another photo path for bonus.

## Mobile

- [ ] iPhone Safari: 320×568 and 390×844 flows have no horizontal overflow; safe-area navigation does not cover actions.
- [ ] Android Chrome: 375×667 and 430×932 flows have no horizontal overflow; keyboard does not permanently cover submit controls.
- [ ] Keyboard-only desktop pass: inputs, cards, tabs, dialogs, buttons, and links have visible focus and logical order.
- [ ] Screen reader spot-check: labels, selected states, loading announcements, dialog names, and image alt text are meaningful.
