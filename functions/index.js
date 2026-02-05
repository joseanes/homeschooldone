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
    const homeschoolData = {...homeschoolDoc.data(), id: homeschoolDoc.id};

    // Fetch students
    let students = [];
    if (homeschoolData.studentIds && homeschoolData.studentIds.length > 0) {
      const studentsSnapshot = await db.collection("people")
          .where("__name__", "in", homeschoolData.studentIds)
          .get();

      students = studentsSnapshot.docs.map((doc) => ({
        ...doc.data(),
        id: doc.id,
      }));
    }

    // Fetch activities
    const activitiesSnapshot = await db.collection("activities")
        .where("homeschoolId", "==", homeschoolData.id)
        .get();

    const activities = activitiesSnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    // Fetch goals
    const goalsSnapshot = await db.collection("goals")
        .where("homeschoolId", "==", homeschoolData.id)
        .get();

    const goals = goalsSnapshot.docs.map((doc) => ({
      ...doc.data(),
      id: doc.id,
    }));

    // Return the dashboard data
    return {
      homeschool: homeschoolData,
      students,
      activities,
      goals,
    };
  } catch (error) {
    logger.error("Error fetching public dashboard:", error);
    throw new Error("Failed to load dashboard. Please try again later.");
  }
});
