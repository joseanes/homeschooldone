#!/usr/bin/env bash
# Runs the homeschoolId backfill against the live project: a dry run first,
# then asks before writing anything.
set -euo pipefail

PROJECT=homeschooldone
cd "$(dirname "$0")/.."   # functions/

echo "== Installing dependencies"
npm ci --silent

if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then
  echo "== Signing in to Google (a browser window will open)"
  gcloud auth application-default login
fi

echo
echo "== Dry run (changes nothing)"
node migrations/backfillHomeschoolIds.js --project "$PROJECT"

echo
read -r -p "Apply these changes to the live database? Type yes to continue: " answer
if [ "$answer" != "yes" ]; then
  echo "Stopped. Nothing was changed."
  exit 0
fi

echo "== Applying"
node migrations/backfillHomeschoolIds.js --project "$PROJECT" --apply
echo "Done."
