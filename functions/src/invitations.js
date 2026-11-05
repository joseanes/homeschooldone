const {FieldValue} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");

// Pending-invitation email list -> membership UID list, per role.
const ROLE_FIELDS = [
  {role: "parent", emails: "parentEmails", ids: "parentIds"},
  {role: "tutor", emails: "tutorEmails", ids: "tutorIds"},
  {role: "observer", emails: "observerEmails", ids: "observerIds"},
];

/**
 * Returns the distinct spellings of an email we may have stored.
 * @param {string} email
 * @return {string[]}
 */
function emailVariants(email) {
  return [...new Set([email, email.toLowerCase()])];
}

/**
 * Accepts every pending invitation addressed to the caller's verified email
 * and links any student record with that email to the caller's account.
 *
 * Runs with admin privileges, which is why Firestore rules can forbid
 * clients from editing membership arrays of homeschools they don't own.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{uid: string, token: Object}|undefined} auth callable request.auth
 * @return {Promise<{memberships: Array<{homeschoolId: string, role: string}>}>}
 */
async function acceptInvitations(db, auth) {
  if (!auth) {
    throw new HttpsError("unauthenticated", "Sign in first.");
  }
  const {uid} = auth;
  const email = auth.token && auth.token.email;
  if (!email || auth.token.email_verified !== true) {
    // Without a verified email anyone could register someone else's address.
    return {memberships: []};
  }
  const variants = emailVariants(email);
  const memberships = [];

  // Adult roles: move the email from *Emails to the UID in *Ids.
  for (const {role, emails, ids} of ROLE_FIELDS) {
    const snap = await db.collection("homeschools")
        .where(emails, "array-contains-any", variants)
        .get();
    for (const hsDoc of snap.docs) {
      await hsDoc.ref.update({
        [emails]: FieldValue.arrayRemove(...variants),
        [ids]: FieldValue.arrayUnion(uid),
      });
      memberships.push({homeschoolId: hsDoc.id, role});
    }
  }

  // Students: link student records with this email to the account.
  const linkedHomeschools = new Set();
  const students = await db.collection("people")
      .where("email", "in", variants)
      .get();
  for (const studentDoc of students.docs) {
    const student = studentDoc.data();
    if (student.role !== "student") continue;
    // Already linked to a different account: a parent must unlink it first.
    if (student.authUid && student.authUid !== uid) continue;

    const homeschoolId = await findStudentHomeschool(db, studentDoc);
    if (!homeschoolId) continue;

    const batch = db.batch();
    batch.update(studentDoc.ref, {authUid: uid, homeschoolId});
    batch.update(db.doc(`homeschools/${homeschoolId}`), {
      studentUids: FieldValue.arrayUnion(uid),
    });
    await batch.commit();
    linkedHomeschools.add(homeschoolId);
    memberships.push({homeschoolId, role: "student", studentId: studentDoc.id});
  }

  await removeStaleStudentAccess(db, uid, linkedHomeschools);

  return {memberships};
}

/**
 * Finds the homeschool that lists this student record in studentIds.
 * @param {FirebaseFirestore.Firestore} db
 * @param {FirebaseFirestore.DocumentSnapshot} studentDoc
 * @return {Promise<string|null>}
 */
async function findStudentHomeschool(db, studentDoc) {
  const {homeschoolId} = studentDoc.data();
  if (homeschoolId) {
    const hs = await db.doc(`homeschools/${homeschoolId}`).get();
    const ids = hs.exists ? (hs.data().studentIds || []) : [];
    return ids.includes(studentDoc.id) ? homeschoolId : null;
  }
  // Legacy record without homeschoolId.
  const snap = await db.collection("homeschools")
      .where("studentIds", "array-contains", studentDoc.id)
      .limit(1)
      .get();
  return snap.empty ? null : snap.docs[0].id;
}

/**
 * Drops the caller from studentUids of homeschools where they are no longer
 * linked to any student record (e.g. the student was removed or re-emailed).
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} uid
 * @param {Set<string>} keep homeschool IDs linked during this call
 */
async function removeStaleStudentAccess(db, uid, keep) {
  const snap = await db.collection("homeschools")
      .where("studentUids", "array-contains", uid)
      .get();
  for (const hsDoc of snap.docs) {
    if (keep.has(hsDoc.id)) continue;
    const studentIds = hsDoc.data().studentIds || [];
    const linked = await db.collection("people")
        .where("authUid", "==", uid)
        .where("homeschoolId", "==", hsDoc.id)
        .get();
    const stillLinked = linked.docs.some((d) => studentIds.includes(d.id));
    if (!stillLinked) {
      await hsDoc.ref.update({studentUids: FieldValue.arrayRemove(uid)});
    }
  }
}

module.exports = {acceptInvitations};
