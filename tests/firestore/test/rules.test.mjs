// Security rules tests. Run with `npm test` from tests/firestore (starts the
// Firestore emulator under the demo-homeschooldone project; never touches live data).
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, describe, test } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';

const PROJECT_ID = 'demo-homeschooldone';

// Cast of characters for homeschool H1, plus an outsider who runs H2.
const PARENT = 'parent-uid';
const TUTOR = 'tutor-uid';
const OBSERVER = 'observer-uid';
const STUDENT = 'student-uid'; // auth UID linked to student record S1
const STUDENT2 = 'student2-uid'; // auth UID linked to student record S2 (same homeschool)
const OUTSIDER = 'outsider-uid';

let env;

const as = (uid, email = `${uid}@example.com`) =>
  env.authenticatedContext(uid, { email, email_verified: true }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

const day = (d) => Timestamp.fromDate(new Date(`2026-09-${d}T12:00:00Z`));

async function seed() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'homeschools/H1'), {
      name: 'Anes Academy',
      parentIds: [PARENT],
      tutorIds: [TUTOR],
      observerIds: [OBSERVER],
      studentIds: ['S1', 'S2'],
      studentUids: [STUDENT, STUDENT2],
      parentEmails: [],
      tutorEmails: [],
      observerEmails: ['invited@example.com'],
      createdBy: PARENT,
      createdAt: day(1),
    });
    await setDoc(doc(db, 'homeschools/H2'), {
      name: 'Other School',
      parentIds: [OUTSIDER],
      tutorIds: [],
      observerIds: [],
      studentIds: ['S9'],
      createdBy: OUTSIDER,
      createdAt: day(1),
    });

    // Account profiles (doc id == auth uid)
    for (const uid of [PARENT, TUTOR, OBSERVER, STUDENT, OUTSIDER]) {
      await setDoc(doc(db, `people/${uid}`), { id: uid, name: uid, email: `${uid}@example.com`, role: 'parent' });
    }
    // Student records
    await setDoc(doc(db, 'people/S1'), { name: 'Ana', role: 'student', email: 'student-uid@example.com', homeschoolId: 'H1', authUid: STUDENT });
    await setDoc(doc(db, 'people/S2'), { name: 'Ben', role: 'student', homeschoolId: 'H1', authUid: STUDENT2 });
    await setDoc(doc(db, 'people/S9'), { name: 'Zed', role: 'student', homeschoolId: 'H2' });

    await setDoc(doc(db, 'activities/A1'), { name: 'Math', homeschoolId: 'H1', progressReportingStyle: {} });
    await setDoc(doc(db, 'activities/A9'), { name: 'Art', homeschoolId: 'H2', progressReportingStyle: {} });

    await setDoc(doc(db, 'goals/G1'), { name: 'Math daily', activityId: 'A1', studentIds: ['S1', 'S2'], homeschoolId: 'H1', timesDone: 0, tutorOrParentId: PARENT });
    await setDoc(doc(db, 'goals/G9'), { name: 'Art', activityId: 'A9', studentIds: ['S9'], homeschoolId: 'H2', tutorOrParentId: OUTSIDER });

    await setDoc(doc(db, 'activityInstances/I1'), { goalId: 'G1', studentId: 'S1', homeschoolId: 'H1', date: day(10), createdBy: PARENT, description: 'p1' });
    await setDoc(doc(db, 'activityInstances/I2'), { goalId: 'G1', studentId: 'S2', homeschoolId: 'H1', date: day(11), createdBy: TUTOR, description: 'p2' });
    await setDoc(doc(db, 'activityInstances/I9'), { goalId: 'G9', studentId: 'S9', homeschoolId: 'H2', date: day(10), createdBy: OUTSIDER, description: 'x' });

    await setDoc(doc(db, 'adHocTasks/T1'), { name: 'Library', studentId: 'S1', homeschoolId: 'H1', createdBy: PARENT, startDate: day(1), completedDate: null });
    await setDoc(doc(db, 'adHocTasks/T9'), { name: 'Other', studentId: 'S9', homeschoolId: 'H2', createdBy: OUTSIDER, startDate: day(1), completedDate: null });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

const newInstance = (uid, overrides = {}) => ({
  goalId: 'G1',
  studentId: 'S1',
  homeschoolId: 'H1',
  date: day(12),
  createdBy: uid,
  description: 'did math',
  ...overrides,
});

describe('unauthenticated access', () => {
  test('cannot read or write anything', async () => {
    const db = anon();
    await assertFails(getDoc(doc(db, 'homeschools/H1')));
    await assertFails(getDocs(query(collection(db, 'homeschools'), where('publicDashboardId', '==', 'abcd1234'))));
    await assertFails(getDoc(doc(db, 'people/S1')));
    await assertFails(getDocs(query(collection(db, 'goals'), where('homeschoolId', '==', 'H1'))));
    await assertFails(getDocs(query(collection(db, 'activityInstances'), where('homeschoolId', '==', 'H1'))));
    await assertFails(setDoc(doc(db, 'homeschools/new'), { name: 'x', parentIds: [], createdBy: 'x' }));
  });

  test('unknown collections are closed', async () => {
    await assertFails(getDoc(doc(as(PARENT), 'secrets/x')));
    await assertFails(setDoc(doc(as(PARENT), 'secrets/x'), { a: 1 }));
  });
});

describe('homeschools', () => {
  test('every member role can read, outsiders cannot', async () => {
    for (const uid of [PARENT, TUTOR, OBSERVER, STUDENT]) {
      await assertSucceeds(getDoc(doc(as(uid), 'homeschools/H1')));
    }
    await assertFails(getDoc(doc(as(OUTSIDER), 'homeschools/H1')));
  });

  test('membership queries succeed for the matching role', async () => {
    const hs = collection(as(PARENT), 'homeschools');
    await assertSucceeds(getDocs(query(hs, where('parentIds', 'array-contains', PARENT))));
    await assertSucceeds(getDocs(query(collection(as(TUTOR), 'homeschools'), where('tutorIds', 'array-contains', TUTOR))));
    await assertSucceeds(getDocs(query(collection(as(OBSERVER), 'homeschools'), where('observerIds', 'array-contains', OBSERVER))));
    await assertSucceeds(getDocs(query(collection(as(STUDENT), 'homeschools'), where('studentUids', 'array-contains', STUDENT))));
  });

  test('cannot list all homeschools or query by someone else\'s membership', async () => {
    await assertFails(getDocs(collection(as(PARENT), 'homeschools')));
    await assertFails(getDocs(query(collection(as(OUTSIDER), 'homeschools'), where('parentIds', 'array-contains', PARENT))));
  });

  test('pending email invitations do not grant read access', async () => {
    const invited = as('invited-uid', 'invited@example.com');
    await assertFails(getDoc(doc(invited, 'homeschools/H1')));
    await assertFails(getDocs(query(collection(invited, 'homeschools'), where('observerEmails', 'array-contains', 'invited@example.com'))));
  });

  test('anyone signed in can create a homeschool they own', async () => {
    const db = as(OUTSIDER);
    await assertSucceeds(addDoc(collection(db, 'homeschools'), {
      name: 'New', parentIds: [OUTSIDER], tutorIds: [], observerIds: [], studentIds: [], createdBy: OUTSIDER, createdAt: new Date(),
    }));
  });

  test('cannot create a homeschool for someone else or with pre-linked students', async () => {
    const db = as(OUTSIDER);
    await assertFails(addDoc(collection(db, 'homeschools'), { name: 'x', parentIds: [PARENT], createdBy: PARENT }));
    await assertFails(addDoc(collection(db, 'homeschools'), { name: 'x', parentIds: [OUTSIDER, PARENT], createdBy: OUTSIDER }));
    await assertFails(addDoc(collection(db, 'homeschools'), { name: 'x', parentIds: [OUTSIDER], createdBy: OUTSIDER, studentUids: [OUTSIDER] }));
  });

  test('parents can change settings and membership', async () => {
    const db = as(PARENT);
    await assertSucceeds(updateDoc(doc(db, 'homeschools/H1'), { dashboardSettings: { cycleSeconds: 5, startOfWeek: 1, timezone: 'UTC' } }));
    await assertSucceeds(updateDoc(doc(db, 'homeschools/H1'), { tutorEmails: arrayUnion('new-tutor@example.com') }));
    await assertSucceeds(updateDoc(doc(db, 'homeschools/H1'), { publicDashboardId: 'abcd1234' }));
  });

  test('tutors, observers, students and outsiders cannot modify the homeschool', async () => {
    for (const uid of [TUTOR, OBSERVER, STUDENT, OUTSIDER]) {
      await assertFails(updateDoc(doc(as(uid), 'homeschools/H1'), { name: 'pwned' }));
    }
  });

  test('invitation self-promotion is blocked (finding #8)', async () => {
    // An outsider adds their own email/uid to the parent lists of H1.
    const db = as(OUTSIDER);
    await assertFails(updateDoc(doc(db, 'homeschools/H1'), { parentEmails: arrayUnion('outsider-uid@example.com') }));
    await assertFails(updateDoc(doc(db, 'homeschools/H1'), { parentIds: arrayUnion(OUTSIDER) }));
    // An observer tries to promote themselves.
    await assertFails(updateDoc(doc(as(OBSERVER), 'homeschools/H1'), { parentIds: arrayUnion(OBSERVER) }));
    // An invitee tries to accept their own invitation client-side.
    await assertFails(updateDoc(doc(as('invited-uid', 'invited@example.com'), 'homeschools/H1'), { observerIds: arrayUnion('invited-uid') }));
  });

  test('a parent can delete the whole homeschool in batches', async () => {
    const db = as(PARENT);
    const batch = writeBatch(db);
    for (const name of ['people', 'activities', 'goals', 'adHocTasks', 'activityInstances']) {
      const snap = await getDocs(query(collection(db, name), where('homeschoolId', '==', 'H1')));
      snap.docs.forEach((d) => batch.delete(d.ref));
    }
    await assertSucceeds(batch.commit());
    await assertSucceeds(deleteDoc(doc(db, 'homeschools/H1')));
  });

  test('only parents can delete', async () => {
    await assertFails(deleteDoc(doc(as(TUTOR), 'homeschools/H1')));
    await assertSucceeds(deleteDoc(doc(as(PARENT), 'homeschools/H1')));
  });
});

describe('people: account profiles', () => {
  test('users can create and update their own profile', async () => {
    const db = as('new-uid');
    await assertSucceeds(setDoc(doc(db, 'people/new-uid'), { id: 'new-uid', name: 'New', email: 'new@example.com', role: 'parent', lastLogin: new Date() }));
    await assertSucceeds(updateDoc(doc(db, 'people/new-uid'), { lastActivity: new Date() }));
    await assertSucceeds(getDoc(doc(db, 'people/new-uid')));
  });

  test('cannot write someone else\'s profile', async () => {
    await assertFails(updateDoc(doc(as(OUTSIDER), `people/${PARENT}`), { name: 'pwned' }));
    await assertFails(setDoc(doc(as(OUTSIDER), `people/${PARENT}`), { name: 'pwned', role: 'parent' }));
    // A parent can no longer rewrite another member's profile role.
    await assertFails(updateDoc(doc(as(PARENT), `people/${TUTOR}`), { role: 'observer' }));
  });

  test('cannot disguise a profile as a student record', async () => {
    const db = as(OUTSIDER);
    await assertFails(updateDoc(doc(db, `people/${OUTSIDER}`), { role: 'student' }));
    await assertFails(updateDoc(doc(db, `people/${OUTSIDER}`), { homeschoolId: 'H1' }));
    await assertFails(updateDoc(doc(db, `people/${OUTSIDER}`), { authUid: OUTSIDER }));
    await assertFails(setDoc(doc(as('fresh'), 'people/fresh'), { name: 'x', role: 'student', homeschoolId: 'H1' }));
  });

  test('profiles can be fetched by id but not listed or searched by email', async () => {
    await assertSucceeds(getDoc(doc(as(PARENT), `people/${TUTOR}`)));
    await assertFails(getDocs(query(collection(as(OUTSIDER), 'people'), where('email', '==', 'parent-uid@example.com'))));
    await assertFails(getDocs(collection(as(PARENT), 'people')));
  });
});

describe('people: student records', () => {
  test('members can read their students, outsiders cannot', async () => {
    for (const uid of [PARENT, TUTOR, OBSERVER, STUDENT]) {
      await assertSucceeds(getDoc(doc(as(uid), 'people/S1')));
    }
    await assertFails(getDoc(doc(as(OUTSIDER), 'people/S1')));
    await assertFails(getDoc(doc(as(PARENT), 'people/S9')));
  });

  test('homeschool-scoped student queries succeed; unscoped ones fail', async () => {
    await assertSucceeds(getDocs(query(collection(as(PARENT), 'people'), where('homeschoolId', '==', 'H1'))));
    await assertSucceeds(getDocs(query(collection(as(PARENT), 'people'), where('homeschoolId', '==', 'H1'), where('__name__', 'in', ['S1', 'S2']))));
    await assertFails(getDocs(query(collection(as(OUTSIDER), 'people'), where('homeschoolId', '==', 'H1'))));
    await assertFails(getDocs(query(collection(as(PARENT), 'people'), where('__name__', 'in', ['S1', 'S9']))));
  });

  test('a student can find their own record by authUid', async () => {
    await assertSucceeds(getDocs(query(collection(as(STUDENT), 'people'), where('authUid', '==', STUDENT))));
    await assertFails(getDocs(query(collection(as(OUTSIDER), 'people'), where('authUid', '==', STUDENT))));
  });

  test('parents create, edit and delete student records', async () => {
    const db = as(PARENT);
    await assertSucceeds(addDoc(collection(db, 'people'), { name: 'Cy', role: 'student', homeschoolId: 'H1' }));
    await assertSucceeds(updateDoc(doc(db, 'people/S1'), { name: 'Ana Maria', dailyWorkHoursGoal: 5 }));
    await assertSucceeds(updateDoc(doc(db, 'people/S1'), { email: 'new@example.com', authUid: deleteField() }));
    await assertSucceeds(deleteDoc(doc(db, 'people/S2')));
  });

  test('parents cannot link accounts, move students or touch other homeschools', async () => {
    const db = as(PARENT);
    await assertFails(updateDoc(doc(db, 'people/S2'), { authUid: OUTSIDER }));
    await assertFails(updateDoc(doc(db, 'people/S1'), { homeschoolId: 'H2' }));
    await assertFails(addDoc(collection(db, 'people'), { name: 'x', role: 'student', homeschoolId: 'H2' }));
    await assertFails(addDoc(collection(db, 'people'), { name: 'x', role: 'student', homeschoolId: 'H1', authUid: OUTSIDER }));
    await assertFails(updateDoc(doc(db, 'people/S9'), { name: 'x' }));
  });

  test('tutors, observers and students cannot create or edit student records', async () => {
    for (const uid of [TUTOR, OBSERVER, STUDENT]) {
      await assertFails(addDoc(collection(as(uid), 'people'), { name: 'x', role: 'student', homeschoolId: 'H1' }));
      await assertFails(updateDoc(doc(as(uid), 'people/S1'), { name: 'x' }));
      await assertFails(deleteDoc(doc(as(uid), 'people/S1')));
    }
  });

  test('lastActivity can be bumped by staff and by the linked student only', async () => {
    await assertSucceeds(updateDoc(doc(as(TUTOR), 'people/S1'), { lastActivity: new Date() }));
    await assertSucceeds(updateDoc(doc(as(STUDENT), 'people/S1'), { lastActivity: new Date() }));
    await assertFails(updateDoc(doc(as(STUDENT), 'people/S2'), { lastActivity: new Date() }));
    await assertFails(updateDoc(doc(as(OBSERVER), 'people/S1'), { lastActivity: new Date() }));
    await assertFails(updateDoc(doc(as(STUDENT), 'people/S1'), { lastActivity: new Date(), dailyWorkHoursGoal: 1 }));
  });
});

describe('activities and goals', () => {
  test('members can query by homeschoolId; outsiders and unscoped queries fail', async () => {
    for (const col of ['activities', 'goals', 'adHocTasks']) {
      for (const uid of [PARENT, TUTOR, OBSERVER, STUDENT]) {
        await assertSucceeds(getDocs(query(collection(as(uid), col), where('homeschoolId', '==', 'H1'))));
      }
      await assertFails(getDocs(query(collection(as(OUTSIDER), col), where('homeschoolId', '==', 'H1'))));
      await assertFails(getDocs(collection(as(PARENT), col)));
    }
  });

  test('staff create and edit; parents delete', async () => {
    for (const uid of [PARENT, TUTOR]) {
      const db = as(uid);
      await assertSucceeds(addDoc(collection(db, 'activities'), { name: 'Sci', homeschoolId: 'H1', progressReportingStyle: {} }));
      await assertSucceeds(addDoc(collection(db, 'goals'), { name: 'g', activityId: 'A1', studentIds: ['S1'], homeschoolId: 'H1', tutorOrParentId: uid }));
      await assertSucceeds(updateDoc(doc(db, 'activities/A1'), { description: uid }));
      await assertSucceeds(updateDoc(doc(db, 'goals/G1'), { timesPerWeek: 3, studentCompletions: { S1: { grade: 'A' } } }));
    }
    await assertFails(deleteDoc(doc(as(TUTOR), 'goals/G1')));
    await assertFails(deleteDoc(doc(as(TUTOR), 'activities/A1')));
    await assertSucceeds(deleteDoc(doc(as(PARENT), 'goals/G1')));
    await assertSucceeds(deleteDoc(doc(as(PARENT), 'activities/A1')));
  });

  test('observers and students cannot create or edit', async () => {
    for (const uid of [OBSERVER, STUDENT]) {
      const db = as(uid);
      await assertFails(addDoc(collection(db, 'activities'), { name: 'x', homeschoolId: 'H1' }));
      await assertFails(addDoc(collection(db, 'goals'), { name: 'x', homeschoolId: 'H1' }));
      await assertFails(updateDoc(doc(db, 'goals/G1'), { name: 'x' }));
      await assertFails(deleteDoc(doc(db, 'goals/G1')));
    }
  });

  test('students may only bump timesDone on goals', async () => {
    await assertSucceeds(updateDoc(doc(as(STUDENT), 'goals/G1'), { timesDone: increment(1) }));
    await assertFails(updateDoc(doc(as(OBSERVER), 'goals/G1'), { timesDone: increment(1) }));
    await assertFails(updateDoc(doc(as(OUTSIDER), 'goals/G1'), { timesDone: increment(1) }));
  });

  test('cannot move documents to or create in another homeschool', async () => {
    await assertFails(updateDoc(doc(as(PARENT), 'goals/G1'), { homeschoolId: 'H2' }));
    await assertFails(updateDoc(doc(as(PARENT), 'activities/A1'), { homeschoolId: 'H2' }));
    await assertFails(addDoc(collection(as(PARENT), 'goals'), { name: 'x', homeschoolId: 'H2' }));
    await assertFails(updateDoc(doc(as(PARENT), 'goals/G9'), { name: 'x' }));
  });
});

describe('adHocTasks', () => {
  test('staff manage tasks', async () => {
    const db = as(TUTOR);
    await assertSucceeds(addDoc(collection(db, 'adHocTasks'), { name: 'x', studentId: 'S2', homeschoolId: 'H1', createdBy: TUTOR, completedDate: null }));
    await assertSucceeds(updateDoc(doc(db, 'adHocTasks/T1'), { completedDate: new Date() }));
    await assertSucceeds(deleteDoc(doc(db, 'adHocTasks/T1')));
  });

  test('students manage only their own tasks and cannot delete', async () => {
    const db = as(STUDENT);
    await assertSucceeds(addDoc(collection(db, 'adHocTasks'), { name: 'x', studentId: 'S1', homeschoolId: 'H1', createdBy: STUDENT, completedDate: new Date() }));
    await assertSucceeds(updateDoc(doc(db, 'adHocTasks/T1'), { completedDate: new Date() }));
    await assertFails(addDoc(collection(db, 'adHocTasks'), { name: 'x', studentId: 'S2', homeschoolId: 'H1', createdBy: STUDENT }));
    await assertFails(updateDoc(doc(db, 'adHocTasks/T1'), { studentId: 'S2' }));
    await assertFails(deleteDoc(doc(db, 'adHocTasks/T1')));
  });

  test('observers are read-only', async () => {
    await assertFails(addDoc(collection(as(OBSERVER), 'adHocTasks'), { name: 'x', studentId: 'S1', homeschoolId: 'H1' }));
    await assertFails(updateDoc(doc(as(OBSERVER), 'adHocTasks/T1'), { completedDate: new Date() }));
  });
});

describe('activityInstances', () => {
  test('members read via homeschool-scoped queries', async () => {
    const queries = (db) => [
      query(collection(db, 'activityInstances'), where('homeschoolId', '==', 'H1')),
      query(collection(db, 'activityInstances'), where('homeschoolId', '==', 'H1'), where('goalId', 'in', ['G1', 'G2'])),
      query(collection(db, 'activityInstances'), where('homeschoolId', '==', 'H1'), where('studentId', '==', 'S1'), where('date', '>=', day(1))),
      query(collection(db, 'activityInstances'), where('homeschoolId', '==', 'H1'), where('date', '>=', day(1)), where('date', '<=', day(30))),
      query(collection(db, 'activityInstances'), where('homeschoolId', '==', 'H1'), where('goalId', '==', 'G1'), where('studentId', '==', 'S1')),
    ];
    for (const uid of [PARENT, TUTOR, OBSERVER, STUDENT]) {
      for (const q of queries(as(uid))) await assertSucceeds(getDocs(q));
    }
    for (const q of queries(as(OUTSIDER))) await assertFails(getDocs(q));
  });

  test('unscoped queries are rejected (the old cross-family date query)', async () => {
    const db = as(PARENT);
    await assertFails(getDocs(query(collection(db, 'activityInstances'), where('date', '>=', day(1)))));
    await assertFails(getDocs(query(collection(db, 'activityInstances'), where('goalId', 'in', ['G1']))));
    await assertFails(getDocs(query(collection(db, 'activityInstances'), where('studentId', '==', 'S9'))));
    await assertFails(getDoc(doc(db, 'activityInstances/I9')));
  });

  test('staff record progress for any student in the homeschool', async () => {
    for (const uid of [PARENT, TUTOR]) {
      await assertSucceeds(addDoc(collection(as(uid), 'activityInstances'), newInstance(uid, { studentId: 'S2' })));
    }
    await assertSucceeds(updateDoc(doc(as(TUTOR), 'activityInstances/I1'), { description: 'edited', createdBy: TUTOR }));
    await assertSucceeds(deleteDoc(doc(as(TUTOR), 'activityInstances/I1')));
  });

  test('students record only their own progress', async () => {
    const db = as(STUDENT);
    await assertSucceeds(addDoc(collection(db, 'activityInstances'), newInstance(STUDENT)));
    // The student dashboard signs entries with the student record ID.
    await assertSucceeds(addDoc(collection(db, 'activityInstances'), newInstance('S1')));
    await assertSucceeds(updateDoc(doc(db, 'activityInstances/I1'), { description: 'mine', createdBy: 'S1' }));
    await assertSucceeds(updateDoc(doc(db, 'activityInstances/I1'), { description: 'mine', createdBy: STUDENT }));
    await assertFails(addDoc(collection(db, 'activityInstances'), newInstance('S2', { studentId: 'S2' })));
    await assertFails(addDoc(collection(db, 'activityInstances'), newInstance(PARENT)));
    await assertFails(addDoc(collection(db, 'activityInstances'), newInstance(STUDENT, { studentId: 'S2' })));
    await assertFails(updateDoc(doc(db, 'activityInstances/I2'), { description: 'not mine', createdBy: STUDENT }));
    await assertFails(deleteDoc(doc(db, 'activityInstances/I1')));
  });

  test('observers and outsiders cannot record progress', async () => {
    await assertFails(addDoc(collection(as(OBSERVER), 'activityInstances'), newInstance(OBSERVER)));
    await assertFails(addDoc(collection(as(OUTSIDER), 'activityInstances'), newInstance(OUTSIDER)));
  });

  test('instances must be consistent and attributed', async () => {
    const db = as(PARENT);
    // goal from another homeschool
    await assertFails(addDoc(collection(db, 'activityInstances'), newInstance(PARENT, { goalId: 'G9' })));
    // writing into another homeschool
    await assertFails(addDoc(collection(db, 'activityInstances'), newInstance(PARENT, { homeschoolId: 'H2', goalId: 'G9' })));
    // spoofed author (staff may not sign as another user or as the student)
    await assertFails(addDoc(collection(db, 'activityInstances'), newInstance(TUTOR)));
    await assertFails(addDoc(collection(db, 'activityInstances'), newInstance('S1')));
    // missing homeschoolId
    const { homeschoolId, ...noHs } = newInstance(PARENT);
    await assertFails(addDoc(collection(db, 'activityInstances'), noHs));
    // moving an instance
    await assertFails(updateDoc(doc(db, 'activityInstances/I1'), { homeschoolId: 'H2', createdBy: PARENT }));
  });
});
