const {setGlobalOptions} = require("firebase-functions");
const {onCall} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

setGlobalOptions({maxInstances: 10});

/**
 * Keep a stored field, including 0, and drop only missing values.
 * @param {*} value Field value from Firestore.
 * @return {*} The stored value, or null when the field is absent.
 */
function present(value) {
  return value === undefined ? null : value;
}

/**
 * Cloud Function to serve public dashboard data securely
 */
exports.getPublicDashboard = onCall({cors: true}, async (request) => {
  try {
    const authStatus = request.auth ? "authenticated" : "unauthenticated";
    logger.info("Public dashboard request received:", authStatus);

    const {publicId} = request.data;

    if (!publicId || typeof publicId !== "string" || publicId.length !== 8) {
      throw new Error("Invalid public dashboard ID");
    }

    logger.info("Fetching public dashboard for ID:", publicId);

    // Find homeschool with matching public dashboard ID
    const homeschoolQuery = db.collection("homeschools")
        .where("publicDashboardId", "==", publicId);

    const homeschoolSnapshot = await homeschoolQuery.get();

    if (homeschoolSnapshot.empty) {
      throw new Error("Public dashboard not found or has been disabled");
    }

    const homeschoolDoc = homeschoolSnapshot.docs[0];
    const homeschoolRaw = homeschoolDoc.data();
    const homeschoolId = homeschoolDoc.id;

    // Fetch students
    let students = [];
    if (homeschoolRaw.studentIds && homeschoolRaw.studentIds.length > 0) {
      const studentsSnapshot = await db.collection("people")
          .where("__name__", "in", homeschoolRaw.studentIds)
          .get();

      students = studentsSnapshot.docs.map((doc) => ({
        id: doc.id,
        name: doc.data().name,
      }));
    }

    // Fetch activities
    const activitiesSnapshot = await db.collection("activities")
        .where("homeschoolId", "==", homeschoolId)
        .get();

    const activities = activitiesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        subjectId: data.subjectId,
        description: data.description || "",
        progressReportingStyle: data.progressReportingStyle || {},
        progressCountName: data.progressCountName || null,
        requiresTimeTracking: !!data.requiresTimeTracking,
        homeschoolId: data.homeschoolId,
      };
    });

    // Fetch goals. Allowlist display fields so grades, tutor UIDs, and
    // completion notes are not returned to whoever has the public link.
    const goalsSnapshot = await db.collection("goals")
        .where("homeschoolId", "==", homeschoolId)
        .get();

    const goals = goalsSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        description: data.description || "",
        studentIds: data.studentIds || [],
        activityId: data.activityId,
        homeschoolId: data.homeschoolId,
        timesPerWeek: present(data.timesPerWeek),
        minutesPerSession: present(data.minutesPerSession),
        progressCount: present(data.progressCount),
        percentageGoal: present(data.percentageGoal),
        dailyPercentageIncrease: present(data.dailyPercentageIncrease),
        startDate: present(data.startDate),
        deadline: present(data.deadline),
        completionDate: present(data.completionDate),
      };
    });

    // Return only display-safe fields — no UIDs, emails, or role arrays
    return {
      homeschool: {
        id: homeschoolId,
        name: homeschoolRaw.name,
        dashboardSettings: homeschoolRaw.dashboardSettings,
      },
      students,
      activities,
      goals,
    };
  } catch (error) {
    logger.error("Error fetching public dashboard:", error);
    throw new Error("Failed to load dashboard. Please try again later.");
  }
});
