# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HomeschoolDone is a multi-platform homeschool tracking application (web + iOS + tvOS) that lets families track student activities, goals, and progress in real-time. Firebase provides the backend (Auth, Firestore, Cloud Functions).

## Commands

### Web App
```bash
npm start              # Dev server on localhost:3000
npm run build          # Production build to build/
npm test               # Run Jest tests (interactive watch mode)
npm test -- --watchAll=false   # Run tests once (CI mode)
npm test -- --testPathPattern="dateUtils"  # Run a single test file
```

### Firebase
```bash
firebase deploy --only hosting     # Deploy web app
firebase deploy --only functions   # Deploy Cloud Functions (lints first)
firebase deploy                    # Deploy everything
```

### Cloud Functions (from `functions/` directory)
```bash
npm --prefix functions run lint              # Lint functions
npm --prefix functions run serve             # Local functions emulator
```

### Firestore rules, functions & migration tests (emulator, needs Java 11+)
```bash
npm ci --prefix functions && npm ci --prefix tests/firestore
npm --prefix tests/firestore test   # runs under demo-homeschooldone; never touches live data
```
Deploy order for rules changes: see `docs/firestore-rules-rollout.md`.

### iOS/tvOS
Open `ios-tvos/HomeschoolDone.xcodeproj` in Xcode. Targets: `HomeschoolDone-iOS` (iOS 15+) and `HomeschoolDone-tvOS` (tvOS 15+).

## Architecture

### Web App (`src/`)
- **React 19 + TypeScript** with Create React App (strict mode)
- **State management**: React hooks + Firestore real-time listeners (no Redux/Context)
- **Auth**: Firebase Auth with Google OAuth (`signInWithPopup`)
- **Roles**: parent (full CRUD), tutor (create/assign goals), observer (read-only), student (personal dashboard)

### Key Components (`src/components/`)
- `Dashboard.tsx` — Main hub; manages all data, navigation, and Firestore listeners
- `ActivityInstanceForm.tsx` — Time tracking and progress logging for activities
- `SettingsModal.tsx` — Homeschool configuration (dashboard settings, timer, public dashboard)
- `Reports.tsx` — Analytics and reporting with date/student filtering
- `DashboardView.tsx` — Chart/analytics display with progress visualization
- `PublicDashboard.tsx` — Unauthenticated read-only dashboard (shareable via 8-char ID)
- `StudentDashboard.tsx` — Student-specific view

### Data Layer
- All types defined in `src/types/index.ts`
- Core Firestore collections: `homeschools`, `people`, `activities`, `goals`, `activityInstances`
- Firestore indexes defined in `firestore.indexes.json` (activityInstances by studentId+date)
- Firebase config in `src/firebase.ts` (exports `auth`, `db`, `functions`)

### Utilities (`src/utils/`)
- `dateUtils.ts` — UTC/timezone conversion, date boundary calculations (has tests in `dateUtils.test.ts`)
- `goalUtils.ts` — Goal validation and status checking
- `activityUtils.ts` — Activity data fetching and processing
- `activityTracking.ts` — User activity logging
- `publicDashboard.ts` — Public dashboard ID generation/validation

### Cloud Functions (`functions/`)
- `index.js` — Callable functions: `getPublicDashboard` (public dashboard data without auth, display fields only) and `acceptInvitations` (accepts email invitations and links student accounts for verified emails)
- `src/` — Function handlers (testable with the Admin SDK against the emulator)
- `migrations/` — One-off Admin SDK data migrations (dry run by default; not deployed)

### iOS/tvOS (`ios-tvos/`)
- **SwiftUI** apps sharing code via `SharedModels/` and `FirebaseService/` (singleton pattern)
- `firebase-ios-sdk` included locally (not via SPM)
- tvOS features auto-cycling dashboard display with configurable interval

## Firestore Data Model

Security rules (`firestore.rules`) grant access per homeschool from the membership arrays only (`parentIds`, `tutorIds`, `observerIds`, `studentUids`); `people.role` is display-only. Every per-homeschool document carries `homeschoolId`, and **every client query must filter on `homeschoolId`** (or on the caller's own UID), or the rules reject it.

`homeschools` → has `studentIds`, `studentUids`, `parentIds`, `tutorIds`, `observerIds`, pending `*Emails` invitations, `dashboardSettings`
`people` → account profiles (doc ID = auth UID) and student records (`role: 'student'`, `homeschoolId`, `authUid` once linked)
`activities` → belong to homeschool, have `progressReportingStyle` (percentage|times|count)
`goals` → link activity to students, have deadlines and completion tracking per student
`activityInstances` → individual logged entries with time tracking and progress data (carry `homeschoolId`)
`adHocTasks` → one-off tasks per student
