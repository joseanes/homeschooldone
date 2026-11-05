#!/usr/bin/env bash
# Deploys the security changes to the live homeschooldone project, in the
# order from docs/firestore-rules-rollout.md.
#
#   ./scripts/deploy-security.sh          indexes, functions, website
#   ./scripts/deploy-security.sh rules    the security rules (last step)
set -euo pipefail

PROJECT=homeschooldone
cd "$(dirname "$0")/.."

if command -v firebase >/dev/null 2>&1; then
  FIREBASE=(firebase)
else
  FIREBASE=(npx --yes firebase-tools)
fi

confirm() {
  read -r -p "$1 Type yes to continue: " answer
  if [ "$answer" != "yes" ]; then
    echo "Stopped. Nothing further was deployed."
    exit 0
  fi
}

if [ "${1:-}" = "rules" ]; then
  echo "== Final step: security rules"
  echo "Before this, the Apple TV app must be rebuilt in Xcode from this branch;"
  echo "older TV builds stop loading once the rules are live."
  echo
  echo "== Checking for activity entries written since the data update"
  ./functions/migrations/run-backfill.sh
  echo
  confirm "Deploy the security rules now?"
  "${FIREBASE[@]}" deploy --only firestore:rules --project "$PROJECT"
  echo
  echo "Done. Sign in on the website to check everything loads."
  echo "If anything is wrong: Firebase console > Firestore > Rules > History,"
  echo "and restore the previous version."
  exit 0
fi

echo "== Signing in to Firebase (skipped if already signed in)"
"${FIREBASE[@]}" login

echo
echo "== Step 1 of 3: database indexes"
"${FIREBASE[@]}" deploy --only firestore:indexes --project "$PROJECT"

echo
echo "== Step 2 of 3: Cloud Functions"
npm ci --prefix functions --silent
"${FIREBASE[@]}" deploy --only functions --project "$PROJECT"

echo
echo "== Step 3 of 3: website"
echo "The new website needs the indexes from step 1 to be ready. Open:"
echo "  https://console.firebase.google.com/project/$PROJECT/firestore/indexes"
echo "and check that every index says Enabled (not Building)."
confirm "Are all indexes Enabled?"
npm ci --silent
npm run build
"${FIREBASE[@]}" deploy --only hosting --project "$PROJECT"

echo
echo "Done. The security rules are NOT live yet."
echo "After rebuilding the Apple TV app, run: ./scripts/deploy-security.sh rules"
