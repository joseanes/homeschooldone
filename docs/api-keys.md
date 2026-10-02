# Firebase API keys

GitGuardian flags the Google API keys in this repository. Here is what they are,
what the real exposure is, and the plan to close it.

## The keys

| Key | Used by | Where it lives | Restrictions today |
|---|---|---|---|
| Web key `AIzaSyDx…zLg` | Web app **and the tvOS app** | `src/firebase.ts`, `HomeschoolDone-tvOS/HomeschoolDoneTVApp.swift` | none |
| Apple key `AIzaSyAj…W9k` | iOS app | `GoogleService-Info.plist` (both copies) | iOS bundle `com.anesrincon.homeschooldone` |

The tvOS app overrides its plist and uses the **web** key (commit `b02e054`),
because the Apple key only allows the iOS bundle ID and the tvOS bundle ID is
`com.anesrincon.HomeschoolDone-tvOS`.

## Why "store it somewhere safe" doesn't apply to these keys

A Firebase API key is not a password. It only tells Google which project a
request is for. Every app that talks to Firebase has to ship it: it is in the
JavaScript bundle every visitor downloads and inside the TV app binary.
Environment variables, Secret Manager or a private repo would keep it out of
git, but anyone could still read it from the live site in seconds. Firebase's
own documentation says these keys are safe to include in client code *once the
backend is locked down*.

So the hole was never the key being visible. It was what the key let you do:

1. **The database had no rules.** With the key, anyone could read or write
   every family's data. → Fixed by `firestore.rules` (PR #1), live once
   deployed.
2. **The key isn't restricted.** It can call any API enabled on the project,
   from anywhere. If a paid API (e.g. Gemini or Maps) is ever enabled, someone
   could run up the bill. → Restrict the key (below).
3. **Nothing proves a request comes from *your* apps.** → Firebase App Check.

Real secrets are a different matter: service-account JSON keys, admin tokens,
private API keys for paid services. They must never be in client code or git.
Only server code (Cloud Functions) may use them, through Secret Manager
(`defineSecret` in `firebase-functions`). A scan of this repo found none.

## Plan

1. **Deploy the security rules** (PR #1, `docs/firestore-rules-rollout.md`).
   This closes the actual data exposure.
2. **Restrict which APIs each key can call** (Google Cloud Console → APIs &
   Services → Credentials → key → *API restrictions*). Allow only what Firebase
   Auth + Firestore need: Identity Toolkit API, Token Service API, Cloud
   Firestore API, Firebase Installations API. This blocks billing abuse and
   works for web and TV alike, so it doesn't need to wait for the domain
   restriction. Test sign-in on web and TV right after; add an API back if
   something breaks.
3. **Give the tvOS app its own key.** In the Firebase console, add an Apple
   app for bundle `com.anesrincon.HomeschoolDone-tvOS` (or add that bundle ID
   to the Apple key's allowed apps). Then drop the web-key override in
   `HomeschoolDoneTVApp.swift` and load the tvOS `GoogleService-Info.plist`.
   This step must come before step 4: a domain-restricted web key rejects
   native apps.
4. **TODO (on hold): restrict the web key to the app's domains**:
   `homeschooldone.web.app`, `homeschooldone.firebaseapp.com`,
   `homeschooldone.com`, `www.homeschooldone.com`, plus `localhost` for
   development.
5. **Turn on App Check** (reCAPTCHA Enterprise for web, App Attest or
   DeviceCheck for iOS/tvOS), first in monitoring mode, then enforced for
   Firestore and Functions.
6. **GitGuardian:** once 1–3 are done, resolve the incident as "not a secret /
   restricted client key". Rotating the key or rewriting git history would not
   help: the replacement would be just as public in the next build.

### Optional: keep config out of git

To stop scanner alerts, the web config can move to `.env.production`
(`REACT_APP_FIREBASE_API_KEY=…`, git-ignored) and the plists to git-ignored
files with a committed template. This changes how builds are set up and adds
no real security, so it is optional.
