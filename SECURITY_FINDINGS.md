# Security Findings — HomeschoolDone

Reviewed 2026-06-13. Issues 2, 3, 5, 10, 11, 12, 13, 14, 17 have been fixed.

Updated 2026-10-02: issues 1, 4, 6, 8 and 9 are fixed in code and take effect
when deployed in the order given in `docs/firestore-rules-rollout.md`. Issue 7
is mitigated by the rules; its API-key restriction is still a manual step.
Issue 16 remains open.

---

## Critical

### 1. No Firestore Security Rules Deployed
**Files:** `firebase.json` (no `"rules"` key), no `firestore.rules` file exists  
**Impact:** All authorization is client-side only. Any authenticated user with knowledge of the Firestore SDK can bypass every role check in the React app — reading all homeschool data, writing as any role, deleting records.  
**Fix:** Create `firestore.rules` with per-collection, per-role `allow read/write` conditions using `request.auth.uid in resource.data.parentIds` etc. Add `"rules": "firestore.rules"` inside the `"firestore"` key in `firebase.json`.  
**Status:** Fixed (pending deploy). `firestore.rules` with emulator tests in `tests/firestore/`.

---

## High

### 4. PublicDashboard.tsx Bypasses Cloud Function, Queries Firestore Directly
**File:** `src/components/PublicDashboard.tsx:22–74`  
**Impact:** Unauthenticated client-side Firestore queries require the `homeschools` collection to be readable by unauthenticated users, conflicting with any restrictive Firestore rules.  
**Fix:** Remove the Firestore client SDK calls from `PublicDashboard.tsx` and use the `getPublicDashboard` Cloud Function (which already exists and handles this correctly via `httpsCallable`).  
**Status:** Fixed (pending deploy). The function now also returns the recent activity instances the dashboard charts need, and strips emails, notes and grades.

### 6. Role Enforcement Is Client-Side Only
**Files:** All form components (`SettingsModal.tsx`, `ActivityInstanceForm.tsx`, etc.)  
**Impact:** Tutors, observers, and students can call any Firestore write operation directly from the browser console — deleting records, changing settings, elevating roles.  
**Fix:** Implement Firestore security rules (see issue 1). Rules should check `request.auth.uid in get(/databases/$(database)/documents/homeschools/$(homeschoolId)).data.parentIds` before allowing writes.  
**Status:** Fixed (pending deploy). Enforced by `firestore.rules` (see the role table in `docs/firestore-rules-rollout.md`).

### 7. Firebase API Keys Committed to Git
**Files:** `src/firebase.ts:6–14`, `ios-tvos/HomeschoolDone/HomeschoolDone/GoogleService-Info.plist`  
**Impact:** Without Firestore rules, an exposed API key combined with an open database means anyone who finds it can read/write all data. The key is in git history and the built JS bundle.  
**Fix:** Primary mitigation is issue 1 (Firestore rules). Secondary: restrict the web API key in Google Cloud Console to only allow requests from `homeschooldone.web.app` and `homeschooldone.firebaseapp.com`.  
**Status:** Mitigated by the rules once deployed. Key restriction still to do in Google Cloud Console.

---

## Medium

### 8. Invitation Self-Promotion Exploitable Without Server-Side Rules
**File:** `src/components/Dashboard.tsx` (invitation activation flow)  
**Impact:** A user can add their own email to a homeschool's `parentEmails` array and trigger role elevation to parent on next login, because there is no server-side check that the invite was legitimately issued.  
**Fix:** Move invitation acceptance to a Cloud Function that validates the match server-side, or add a Firestore rule validating `request.auth.token.email in resource.data.parentEmails` before allowing UID promotion writes.  
**Status:** Fixed (pending deploy). The new `acceptInvitations` Cloud Function accepts invitations and links students, and only for verified emails. Rules block clients from editing the membership of homeschools they don't parent.

### 9. Cloud Function CORS Is Wildcard
**File:** `functions/index.js:16`  
**Impact:** `cors: true` allows the `getPublicDashboard` function to be invoked from any origin, enabling cross-origin enumeration.  
**Fix:** One-liner: `cors: ['https://homeschooldone.web.app', 'https://homeschooldone.firebaseapp.com']`  
**Status:** Fixed (pending deploy). Restricted to the app's domains and localhost.

---

## Low

### 16. Minimum Password Length Is 6 Characters
**File:** `src/components/Login.tsx:38`  
**Impact:** Allows weak passwords; increases credential-stuffing exposure.  
**Fix:** Change the client-side check from `< 6` to `< 8` (or higher).

---

## Fixed alongside the rules (2026-10-02)

- **Cross-family data leak in DashboardView.** The chart query loaded *every*
  family's activity instances in the date range. Now scoped by `homeschoolId`.
- **Email enumeration.** The student forms, invite form and user list queried
  `people` by arbitrary email, which revealed whether anyone had an account.
  Removed.
- **Unverified-email invitation acceptance.** Anyone could create an
  email/password account with an invitee's address and accept their
  invitation. `acceptInvitations` now requires `email_verified`.
- **Removed students kept access.** Deleting a student or changing their
  email now revokes the linked account (`studentUids`), and
  `acceptInvitations` also drops stale links on sign-in.
