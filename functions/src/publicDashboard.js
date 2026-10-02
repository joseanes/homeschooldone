const {Timestamp} = require("firebase-admin/firestore");
const {HttpsError} = require("firebase-functions/v2/https");

const PUBLIC_ID_PATTERN = /^[a-zA-Z0-9]{8}$/;

// How far back activity instances are returned (current week + 4 prior weeks
// for the dashboard charts, plus slack for any start-of-week setting).
const INSTANCE_WINDOW_DAYS = 42;

const GOAL_FIELDS = [
  "name", "studentIds", "activityId", "startDate", "deadline",
  "completionDate", "timesDone", "timesPerWeek", "progressCount",
  "minutesPerSession", "dailyPercentageIncrease", "percentageGoal",
  "homeschoolId", "createdAt",
];

const ACTIVITY_FIELDS = [
  "name", "subjectId", "progressReportingStyle", "progressCountName",
  "requiresTimeTracking", "homeschoolId",
];

/**
 * Copies only the listed fields that are present.
 * @param {Object} data
 * @param {string[]} fields
 * @return {Object}
 */
function pick(data, fields) {
  const out = {};
  for (const f of fields) {
    if (data[f] !== undefined) out[f] = data[f];
  }
  return out;
}

/**
 * Converts Firestore Timestamps (at any depth) to ISO-8601 strings so the
 * callable response is plain JSON the web client can parse with new Date().
 * @param {*} value
 * @return {*}
 */
function serialize(value) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

/**
 * Per-student dates the dashboard needs; grades stay private.
 * @param {Object|undefined} completions
 * @return {Object|undefined}
 */
function publicCompletions(completions) {
  if (!completions) return undefined;
  const out = {};
  for (const [studentId, c] of Object.entries(completions)) {
    out[studentId] = pick(c || {}, ["startDate", "deadline", "completionDate"]);
  }
  return out;
}

/**
 * Builds the read-only data for a shared (public) dashboard. Returns only
 * display fields: no UIDs, emails, membership lists, notes or grades.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {*} publicId
 * @param {Date} now
 * @return {Promise<Object>}
 */
async function buildPublicDashboard(db, publicId, now = new Date()) {
  if (typeof publicId !== "string" || !PUBLIC_ID_PATTERN.test(publicId)) {
    throw new HttpsError("invalid-argument", "Invalid public dashboard ID");
  }

  const hsSnap = await db.collection("homeschools")
      .where("publicDashboardId", "==", publicId)
      .limit(1)
      .get();
  if (hsSnap.empty) {
    throw new HttpsError("not-found",
        "Public dashboard not found or has been disabled");
  }
  const hsDoc = hsSnap.docs[0];
  const homeschoolId = hsDoc.id;
  const hs = hsDoc.data();

  const studentIds = hs.studentIds || [];
  const studentDocs = studentIds.length ?
    await db.getAll(...studentIds.map((id) => db.doc(`people/${id}`))) :
    [];
  const students = studentDocs
      .filter((d) => d.exists)
      .map((d) => ({
        id: d.id,
        ...pick(d.data(), ["name", "dateOfBirth", "dailyWorkHoursGoal"]),
      }));

  const [activitiesSnap, goalsSnap, instancesSnap] = await Promise.all([
    db.collection("activities").where("homeschoolId", "==", homeschoolId).get(),
    db.collection("goals").where("homeschoolId", "==", homeschoolId).get(),
    db.collection("activityInstances")
        .where("homeschoolId", "==", homeschoolId)
        .where("date", ">=", Timestamp.fromMillis(
            now.getTime() - INSTANCE_WINDOW_DAYS * 24 * 60 * 60 * 1000))
        .get(),
  ]);

  const activities = activitiesSnap.docs.map((d) => ({
    id: d.id, ...pick(d.data(), ACTIVITY_FIELDS),
  }));
  const goals = goalsSnap.docs.map((d) => {
    const data = d.data();
    const goal = {id: d.id, ...pick(data, GOAL_FIELDS)};
    const completions = publicCompletions(data.studentCompletions);
    if (completions) goal.studentCompletions = completions;
    return goal;
  });
  const activityInstances = instancesSnap.docs.map((d) => ({
    id: d.id,
    ...pick(d.data(), ["goalId", "studentId", "date", "duration"]),
  }));

  return serialize({
    homeschool: {
      id: homeschoolId,
      name: hs.name,
      dashboardSettings: hs.dashboardSettings || null,
      studentSortOrder: hs.studentSortOrder || null,
    },
    students,
    activities,
    goals,
    activityInstances,
  });
}

module.exports = {buildPublicDashboard, INSTANCE_WINDOW_DAYS};
