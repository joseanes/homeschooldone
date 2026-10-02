#!/usr/bin/env node
/**
 * One-time backfill required before deploying firestore.rules.
 *
 * The rules authorize every read with a single lookup of the document's
 * `homeschoolId`. Older data is missing that field on:
 *   - activityInstances (created before ActivityInstanceForm stored it)
 *   - people student records (StudentForm never stored it)
 * This script fills it in from goals and homeschools.studentIds. It is
 * idempotent and only ever adds the missing field.
 *
 * Usage (from functions/):
 *   node migrations/backfillHomeschoolIds.js --project <id>           dry run
 *   node migrations/backfillHomeschoolIds.js --project <id> --apply   write
 *
 * Against the emulator, set FIRESTORE_EMULATOR_HOST=127.0.0.1:8080.
 * Against a real project, authenticate first with
 *   gcloud auth application-default login
 */
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {{apply: (boolean|undefined)}} options
 * @return {Promise<Object>} summary of what was (or would be) changed
 */
async function backfillHomeschoolIds(db, {apply = false} = {}) {
  const summary = {
    apply,
    activityInstances: {total: 0, updated: 0, orphaned: []},
    students: {total: 0, updated: 0, orphaned: [], ambiguous: []},
    missingHomeschoolId: {activities: [], goals: [], adHocTasks: []},
  };

  const [homeschools, goals, instances, people] = await Promise.all([
    db.collection("homeschools").get(),
    db.collection("goals").get(),
    db.collection("activityInstances").get(),
    db.collection("people").get(),
  ]);

  const goalHomeschool = new Map();
  goals.docs.forEach((d) => goalHomeschool.set(d.id, d.data().homeschoolId));

  const studentHomeschools = new Map();
  homeschools.docs.forEach((hs) => {
    for (const studentId of hs.data().studentIds || []) {
      const list = studentHomeschools.get(studentId) || [];
      list.push(hs.id);
      studentHomeschools.set(studentId, list);
    }
  });

  const writer = apply ? db.bulkWriter() : null;

  for (const d of instances.docs) {
    summary.activityInstances.total++;
    const data = d.data();
    if (data.homeschoolId) continue;
    const homeschoolId = goalHomeschool.get(data.goalId);
    if (!homeschoolId) {
      summary.activityInstances.orphaned.push(d.id);
      continue;
    }
    summary.activityInstances.updated++;
    if (writer) writer.update(d.ref, {homeschoolId});
  }

  for (const d of people.docs) {
    const data = d.data();
    if (data.role !== "student") continue;
    summary.students.total++;
    if (data.homeschoolId) continue;
    const ids = studentHomeschools.get(d.id) || [];
    if (ids.length === 0) {
      summary.students.orphaned.push(d.id);
    } else if (ids.length > 1) {
      summary.students.ambiguous.push({id: d.id, homeschoolIds: ids});
    } else {
      summary.students.updated++;
      if (writer) writer.update(d.ref, {homeschoolId: ids[0]});
    }
  }

  // Report-only: these collections always stored homeschoolId.
  for (const name of ["activities", "goals", "adHocTasks"]) {
    const snap = name === "goals" ? goals : await db.collection(name).get();
    snap.docs.forEach((d) => {
      if (!d.data().homeschoolId) summary.missingHomeschoolId[name].push(d.id);
    });
  }

  if (writer) await writer.close();
  return summary;
}

/**
 * Command-line entry point.
 */
async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const projectIndex = args.indexOf("--project");
  const projectId = projectIndex >= 0 ? args[projectIndex + 1] : undefined;
  if (!projectId) {
    console.error("Usage: backfillHomeschoolIds.js --project <id> [--apply]");
    process.exit(2);
  }

  initializeApp({projectId});
  const target = process.env.FIRESTORE_EMULATOR_HOST ?
    `emulator ${process.env.FIRESTORE_EMULATOR_HOST}` : "LIVE Firestore";
  console.log(`${apply ? "APPLYING" : "Dry run"} against ${target}, ` +
    `project ${projectId}`);

  const summary = await backfillHomeschoolIds(getFirestore(), {apply});
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {backfillHomeschoolIds};
