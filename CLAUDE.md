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
- `index.js` — Single callable function `getPublicDashboard` that serves public dashboard data without auth

### iOS/tvOS (`ios-tvos/`)
- **SwiftUI** apps sharing code via `SharedModels/` and `FirebaseService/` (singleton pattern)
- `firebase-ios-sdk` included locally (not via SPM)
- tvOS features auto-cycling dashboard display with configurable interval

## Firestore Data Model

`homeschools` → has `studentIds`, `parentIds`, `tutorIds`, `observerIds`, `dashboardSettings`
`people` → role-based (parent|tutor|observer|student), linked to homeschools
`activities` → belong to homeschool, have `progressReportingStyle` (percentage|times|count)
`goals` → link activity to students, have deadlines and completion tracking per student
`activityInstances` → individual logged entries with time tracking and progress data
