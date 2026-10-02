# Firestore security rules: rollout

`firestore.rules` closes the database to everyone except members of each
homeschool. This document covers the access model, how to test it, and the
order in which to deploy it without locking anyone out.

## Access model

A user's role in a homeschool comes **only** from the membership arrays on the
homeschool document. The `role` field on `people` profiles is display-only.

| | parent | tutor | observer | student |
|---|---|---|---|---|
| Read homeschool, students, activities, goals, tasks, progress | ✓ | ✓ | ✓ | ✓ |
| Homeschool settings, invitations, membership, delete | ✓ | | | |
| Create/edit/delete student records | ✓ | | | |
| Create/edit activities and goals | ✓ | ✓ | | |
| Delete activities and goals | ✓ | | | |
| Record progress (activity instances) | ✓ any student | ✓ any student | | own only |
| Delete progress entries | ✓ | ✓ | | |
| Ad-hoc tasks | ✓ | ✓ | | own only, no delete |

- Membership arrays: `parentIds`, `tutorIds`, `observerIds`, `studentUids`.
- `studentUids` holds the auth UIDs of student accounts. It is written only by
  the `acceptInvitations` Cloud Function, which matches the signed-in user's
  **verified** email against student records and also sets `authUid` on the
  student record.
- Pending invitations (`parentEmails`, `tutorEmails`, `observerEmails`) grant
  nothing until `acceptInvitations` moves them into the matching `*Ids` array.
  Clients can no longer promote themselves (security finding #8).
- Every per-homeschool document carries `homeschoolId`, and every query must
  filter on it. Rules are not filters: an unscoped query is rejected outright.
- Unauthenticated visitors cannot read anything. The public dashboard is
  served by the `getPublicDashboard` function, which returns display fields
  only (no emails, UIDs, notes or grades).
- Account profiles (`people/{uid}`) can be fetched by ID by any signed-in user
  (UIDs are only visible to fellow members), but cannot be listed or searched
  by email.

## Testing

```bash
npm ci --prefix functions
npm ci --prefix tests/firestore
npm --prefix tests/firestore test
```

This starts the Firestore emulator under the `demo-homeschooldone` project
(which cannot reach real Firebase) and runs:

- `tests/firestore/test/rules.test.mjs`: every role against every collection,
  including the cross-family and self-promotion attacks
- `tests/firestore/test/functions.test.mjs`: `acceptInvitations`,
  `getPublicDashboard`, and the backfill migration

The same tests run in GitHub Actions on every pull request
(`.github/workflows/firestore-tests.yml`). Requires Java 11+.

## Deploying (in this order)

Every step before the last is safe to run against the current open database.
Steps marked **live** touch the production `homeschooldone` project.

1. **Indexes (live).** `firebase deploy --only firestore:indexes`.
   Wait until the new `activityInstances` indexes show *Enabled* in the
   Firebase console (Firestore → Indexes).

2. **Functions (live).** `firebase deploy --only functions`.
   Adds `acceptInvitations` and updates `getPublicDashboard`. The current web
   app does not call either, so this changes nothing for users yet.

3. **Backfill (live).** Older activity instances and student records have no
   `homeschoolId`, so the rules would hide them. From `functions/`:

   ```bash
   gcloud auth application-default login
   node migrations/backfillHomeschoolIds.js --project homeschooldone          # dry run
   node migrations/backfillHomeschoolIds.js --project homeschooldone --apply  # write
   ```

   Read the dry-run report before applying. `orphaned` entries point at deleted
   goals or students that no homeschool lists; they are already invisible in the
   app and stay that way. `ambiguous` students are listed by more than one
   homeschool and must be fixed by hand.

4. **Web app (live).** `npm run build && firebase deploy --only hosting`.
   The new web app works with or without the rules. On sign-in it calls
   `acceptInvitations`, which links student accounts.

5. **Apple TV / iOS app.** Build and install from this branch in Xcode. Builds
   from before this change look up students by email, which the rules reject,
   and they stop loading once the rules are live. A student account must sign
   in to the web app once (to be linked) before it works on the TV.

6. **Backfill again (live).** Rerun the dry run. Clients that were still on the
   old version during steps 3–5 may have written entries without
   `homeschoolId`. Apply if it reports any.

7. **Rules (live).** `firebase deploy --only firestore:rules`.

8. **Verify.** Sign in as a parent, as a tutor or observer if you have one, and
   as a student. Open the public dashboard link in a private window.

**Rollback:** Firebase console → Firestore → Rules → *History*, then restore
the previous version. Nothing else needs to be reverted: every client and
function change works with the old rules too.

## Still manual

- TODO (on hold): restrict the web API key to the app's domains (security
  finding #7). See `docs/api-keys.md` for the order of steps; the tvOS app
  must get its own key first.
