# Security Findings — HomeschoolDone

Reviewed 2026-06-13. Issues 2, 3, 5, 10, 11, 12, 13, 14, 17 have been fixed.
The following remain open.

---

## Critical

### 1. No Firestore Security Rules Deployed
**Files:** `firebase.json` (no `"rules"` key), no `firestore.rules` file exists  
**Impact:** All authorization is client-side only. Any authenticated user with knowledge of the Firestore SDK can bypass every role check in the React app — reading all homeschool data, writing as any role, deleting records.  
**Fix:** Create `firestore.rules` with per-collection, per-role `allow read/write` conditions using `request.auth.uid in resource.data.parentIds` etc. Add `"rules": "firestore.rules"` inside the `"firestore"` key in `firebase.json`.

---

## High

### 4. PublicDashboard.tsx Bypasses Cloud Function, Queries Firestore Directly
**File:** `src/components/PublicDashboard.tsx:22–74`  
**Impact:** Unauthenticated client-side Firestore queries require the `homeschools` collection to be readable by unauthenticated users, conflicting with any restrictive Firestore rules.  
**Fix:** Remove the Firestore client SDK calls from `PublicDashboard.tsx` and use the `getPublicDashboard` Cloud Function (which already exists and handles this correctly via `httpsCallable`).

### 6. Role Enforcement Is Client-Side Only
**Files:** All form components (`SettingsModal.tsx`, `ActivityInstanceForm.tsx`, etc.)  
**Impact:** Tutors, observers, and students can call any Firestore write operation directly from the browser console — deleting records, changing settings, elevating roles.  
**Fix:** Implement Firestore security rules (see issue 1). Rules should check `request.auth.uid in get(/databases/$(database)/documents/homeschools/$(homeschoolId)).data.parentIds` before allowing writes.

### 7. Firebase API Keys Committed to Git
**Files:** `src/firebase.ts:6–14`, `ios-tvos/HomeschoolDone/HomeschoolDone/GoogleService-Info.plist`  
**Impact:** Without Firestore rules, an exposed API key combined with an open database means anyone who finds it can read/write all data. The key is in git history and the built JS bundle.  
**Fix:** Primary mitigation is issue 1 (Firestore rules). Secondary: restrict the web API key in Google Cloud Console to only allow requests from `homeschooldone.web.app` and `homeschooldone.firebaseapp.com`.

---

## Medium

### 8. Invitation Self-Promotion Exploitable Without Server-Side Rules
**File:** `src/components/Dashboard.tsx` (invitation activation flow)  
**Impact:** A user can add their own email to a homeschool's `parentEmails` array and trigger role elevation to parent on next login, because there is no server-side check that the invite was legitimately issued.  
**Fix:** Move invitation acceptance to a Cloud Function that validates the match server-side, or add a Firestore rule validating `request.auth.token.email in resource.data.parentEmails` before allowing UID promotion writes.

### 9. Cloud Function CORS Is Wildcard
**File:** `functions/index.js:16`  
**Impact:** `cors: true` allows the `getPublicDashboard` function to be invoked from any origin, enabling cross-origin enumeration.  
**Fix:** One-liner: `cors: ['https://homeschooldone.web.app', 'https://homeschooldone.firebaseapp.com']`

---

## Low

### 16. Minimum Password Length Is 6 Characters
**File:** `src/components/Login.tsx:38`  
**Impact:** Allows weak passwords; increases credential-stuffing exposure.  
**Fix:** Change the client-side check from `< 6` to `< 8` (or higher).
