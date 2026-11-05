// Tests for the Cloud Function handlers and the homeschoolId backfill,
// run against the Firestore emulator with the Admin SDK.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { before, beforeEach, describe, test } from 'node:test';

const PROJECT_ID = 'demo-homeschooldone';
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('Run via `npm test` so the Firestore emulator is running.');
}

// Resolve firebase-admin and the handlers from the functions package.
const requireFn = createRequire(new URL('../../../functions/index.js', import.meta.url));
const { initializeApp } = requireFn('firebase-admin/app');
const { getFirestore, Timestamp } = requireFn('firebase-admin/firestore');
const { acceptInvitations } = requireFn('./src/invitations');
const { buildPublicDashboard } = requireFn('./src/publicDashboard');
const { backfillHomeschoolIds } = requireFn('./migrations/backfillHomeschoolIds');

let db;

before(() => {
  initializeApp({ projectId: PROJECT_ID }, 'functions-tests');
  db = getFirestore(requireFn('firebase-admin/app').getApp('functions-tests'));
});

beforeEach(async () => {
  const res = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  assert.equal(res.status, 200);
});

const authFor = (uid, email, verified = true) => ({ uid, token: { email, email_verified: verified } });
const get = async (path) => (await db.doc(path).get()).data();

describe('acceptInvitations', () => {
  beforeEach(async () => {
    await db.doc('homeschools/H1').set({
      name: 'H1',
      parentIds: ['p1'], tutorIds: [], observerIds: [],
      parentEmails: ['coparent@example.com'],
      tutorEmails: ['tutor@example.com'],
      observerEmails: ['grandma@example.com', 'tutor@example.com'],
      studentIds: ['S1', 'S2'],
    });
    await db.doc('people/S1').set({ name: 'Ana', role: 'student', email: 'ana@example.com' }); // legacy: no homeschoolId
    await db.doc('people/S2').set({ name: 'Ben', role: 'student', email: 'ben@example.com', homeschoolId: 'H1', authUid: 'someone-else' });
    await db.doc('people/S3').set({ name: 'Old', role: 'student', email: 'old@example.com', homeschoolId: 'H1' }); // removed from studentIds
  });

  test('requires sign-in', async () => {
    await assert.rejects(acceptInvitations(db, undefined), { code: 'unauthenticated' });
  });

  test('ignores unverified emails', async () => {
    const result = await acceptInvitations(db, authFor('evil', 'coparent@example.com', false));
    assert.deepEqual(result.memberships, []);
    const hs = await get('homeschools/H1');
    assert.deepEqual(hs.parentIds, ['p1']);
    assert.deepEqual(hs.parentEmails, ['coparent@example.com']);
  });

  test('moves invited emails into membership UIDs, case-insensitively', async () => {
    const result = await acceptInvitations(db, authFor('gm', 'Grandma@Example.com'));
    assert.deepEqual(result.memberships, [{ homeschoolId: 'H1', role: 'observer' }]);
    const hs = await get('homeschools/H1');
    assert.deepEqual(hs.observerIds, ['gm']);
    assert.deepEqual(hs.observerEmails, ['tutor@example.com']);
  });

  test('accepts every role an email was invited to', async () => {
    const result = await acceptInvitations(db, authFor('t1', 'tutor@example.com'));
    assert.deepEqual(result.memberships.map((m) => m.role).sort(), ['observer', 'tutor']);
    const hs = await get('homeschools/H1');
    assert.deepEqual(hs.tutorIds, ['t1']);
    assert.deepEqual(hs.tutorEmails, []);
    assert.deepEqual(hs.observerEmails, ['grandma@example.com']);
  });

  test('links a student record to the account and grants studentUids', async () => {
    const result = await acceptInvitations(db, authFor('ana-uid', 'ana@example.com'));
    assert.deepEqual(result.memberships, [{ homeschoolId: 'H1', role: 'student', studentId: 'S1' }]);
    const s1 = await get('people/S1');
    assert.equal(s1.authUid, 'ana-uid');
    assert.equal(s1.homeschoolId, 'H1');
    assert.deepEqual((await get('homeschools/H1')).studentUids, ['ana-uid']);
  });

  test('is idempotent', async () => {
    await acceptInvitations(db, authFor('ana-uid', 'ana@example.com'));
    await acceptInvitations(db, authFor('ana-uid', 'ana@example.com'));
    assert.deepEqual((await get('homeschools/H1')).studentUids, ['ana-uid']);
  });

  test('does not steal a student record linked to another account', async () => {
    const result = await acceptInvitations(db, authFor('ben-2', 'ben@example.com'));
    assert.deepEqual(result.memberships, []);
    assert.equal((await get('people/S2')).authUid, 'someone-else');
    assert.equal((await get('homeschools/H1')).studentUids, undefined);
  });

  test('does not link students the homeschool no longer lists', async () => {
    const result = await acceptInvitations(db, authFor('old-uid', 'old@example.com'));
    assert.deepEqual(result.memberships, []);
    assert.equal((await get('people/S3')).authUid, undefined);
  });

  test('revokes stale student access', async () => {
    await db.doc('homeschools/H1').update({ studentUids: ['ana-uid', 'gone-uid'] });
    await db.doc('people/S1').update({ authUid: 'ana-uid', homeschoolId: 'H1' });
    await acceptInvitations(db, authFor('gone-uid', 'gone@example.com'));
    await acceptInvitations(db, authFor('ana-uid', 'ana@example.com'));
    assert.deepEqual((await get('homeschools/H1')).studentUids, ['ana-uid']);
  });
});

describe('buildPublicDashboard', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const daysAgo = (n) => Timestamp.fromDate(new Date(now.getTime() - n * 86400000));

  beforeEach(async () => {
    await db.doc('homeschools/H1').set({
      name: 'Anes Academy',
      publicDashboardId: 'abcd1234',
      parentIds: ['p1'], parentEmails: ['secret@example.com'], studentUids: ['ana-uid'],
      studentIds: ['S1', 'missing'],
      dashboardSettings: { cycleSeconds: 10, startOfWeek: 1, timezone: 'UTC' },
    });
    await db.doc('people/S1').set({ name: 'Ana', role: 'student', email: 'ana@example.com', mobile: '555', homeschoolId: 'H1', authUid: 'ana-uid' });
    await db.doc('activities/A1').set({ name: 'Math', description: 'private notes', homeschoolId: 'H1', progressReportingStyle: { timesTotal: true } });
    await db.doc('goals/G1').set({
      name: 'Math', activityId: 'A1', studentIds: ['S1'], homeschoolId: 'H1', timesPerWeek: 3,
      tutorOrParentId: 'p1', description: 'transcript text', startDate: daysAgo(60),
      studentCompletions: { S1: { grade: 'A', completionDate: daysAgo(1) } },
    });
    await db.doc('activityInstances/recent').set({ goalId: 'G1', studentId: 'S1', homeschoolId: 'H1', date: daysAgo(2), duration: 30, description: 'private', createdBy: 'p1' });
    await db.doc('activityInstances/old').set({ goalId: 'G1', studentId: 'S1', homeschoolId: 'H1', date: daysAgo(90), createdBy: 'p1' });
    await db.doc('activityInstances/other').set({ goalId: 'G9', studentId: 'S9', homeschoolId: 'H2', date: daysAgo(1), createdBy: 'x' });
  });

  test('rejects malformed and unknown IDs', async () => {
    await assert.rejects(buildPublicDashboard(db, undefined, now), { code: 'invalid-argument' });
    await assert.rejects(buildPublicDashboard(db, 'abc', now), { code: 'invalid-argument' });
    await assert.rejects(buildPublicDashboard(db, 'abcd123$', now), { code: 'invalid-argument' });
    await assert.rejects(buildPublicDashboard(db, 'zzzz9999', now), { code: 'not-found' });
  });

  test('returns display data only', async () => {
    const result = await buildPublicDashboard(db, 'abcd1234', now);
    assert.deepEqual(result.homeschool, {
      id: 'H1', name: 'Anes Academy',
      dashboardSettings: { cycleSeconds: 10, startOfWeek: 1, timezone: 'UTC' },
      studentSortOrder: null,
    });
    assert.deepEqual(result.students, [{ id: 'S1', name: 'Ana' }]);
    assert.deepEqual(result.activities, [{ id: 'A1', name: 'Math', homeschoolId: 'H1', progressReportingStyle: { timesTotal: true } }]);

    const [goal] = result.goals;
    assert.equal(goal.tutorOrParentId, undefined);
    assert.equal(goal.description, undefined);
    assert.deepEqual(goal.studentCompletions, { S1: { completionDate: daysAgo(1).toDate().toISOString() } });
    assert.equal(goal.startDate, daysAgo(60).toDate().toISOString());

    const json = JSON.stringify(result);
    for (const secret of ['secret@example.com', 'ana@example.com', 'ana-uid', 'p1', 'private', '555', '"A"']) {
      assert.ok(!json.includes(secret), `response leaks ${secret}`);
    }
  });

  test('returns recent instances for this homeschool only, with ISO dates', async () => {
    const { activityInstances } = await buildPublicDashboard(db, 'abcd1234', now);
    assert.deepEqual(activityInstances, [{
      id: 'recent', goalId: 'G1', studentId: 'S1', duration: 30, date: daysAgo(2).toDate().toISOString(),
    }]);
  });
});

describe('backfillHomeschoolIds migration', () => {
  beforeEach(async () => {
    await db.doc('homeschools/H1').set({ name: 'H1', studentIds: ['S1', 'S2'] });
    await db.doc('homeschools/H2').set({ name: 'H2', studentIds: ['S2'] });
    await db.doc('goals/G1').set({ name: 'g', homeschoolId: 'H1' });
    await db.doc('activities/A1').set({ name: 'a' }); // missing homeschoolId: reported only
    await db.doc('activityInstances/legacy').set({ goalId: 'G1', studentId: 'S1' });
    await db.doc('activityInstances/current').set({ goalId: 'G1', studentId: 'S1', homeschoolId: 'H1' });
    await db.doc('activityInstances/orphan').set({ goalId: 'deleted-goal', studentId: 'S1' });
    await db.doc('people/S1').set({ name: 'Ana', role: 'student' });
    await db.doc('people/S2').set({ name: 'Ben', role: 'student' }); // listed by two homeschools
    await db.doc('people/S4').set({ name: 'Lost', role: 'student' });
    await db.doc('people/p1').set({ name: 'Parent', role: 'parent' });
  });

  test('dry run reports without writing', async () => {
    const summary = await backfillHomeschoolIds(db);
    assert.equal(summary.apply, false);
    assert.deepEqual(summary.activityInstances, { total: 3, updated: 1, orphaned: ['orphan'] });
    assert.deepEqual(summary.students, {
      total: 3, updated: 1, orphaned: ['S4'], ambiguous: [{ id: 'S2', homeschoolIds: ['H1', 'H2'] }],
    });
    assert.deepEqual(summary.missingHomeschoolId, { activities: ['A1'], goals: [], adHocTasks: [] });
    assert.equal((await get('activityInstances/legacy')).homeschoolId, undefined);
    assert.equal((await get('people/S1')).homeschoolId, undefined);
  });

  test('apply fills missing homeschoolIds and is idempotent', async () => {
    await backfillHomeschoolIds(db, { apply: true });
    assert.equal((await get('activityInstances/legacy')).homeschoolId, 'H1');
    assert.equal((await get('people/S1')).homeschoolId, 'H1');
    assert.equal((await get('people/S2')).homeschoolId, undefined);
    assert.equal((await get('people/p1')).homeschoolId, undefined);

    const second = await backfillHomeschoolIds(db, { apply: true });
    assert.equal(second.activityInstances.updated, 0);
    assert.equal(second.students.updated, 0);
  });
});
