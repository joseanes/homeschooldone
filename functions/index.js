const {setGlobalOptions} = require("firebase-functions");
const {onCall, HttpsError} = require("firebase-functions/v2/https");
const {initializeApp} = require("firebase-admin/app");
const {getFirestore} = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const {buildPublicDashboard} = require("./src/publicDashboard");
const {acceptInvitations} = require("./src/invitations");

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

setGlobalOptions({maxInstances: 10});

// Browsers may only call these functions from the app's own origins.
const ALLOWED_ORIGINS = [
  "https://homeschooldone.web.app",
  "https://homeschooldone.firebaseapp.com",
  "https://homeschooldone.com",
  "https://www.homeschooldone.com",
  /^http:\/\/localhost:\d+$/,
];
const callableOptions = {cors: ALLOWED_ORIGINS};

/**
 * Serves the read-only data for a shared dashboard without authentication.
 * Firestore rules deny all unauthenticated reads, so this is the only way
 * the public dashboard can load.
 */
exports.getPublicDashboard = onCall(callableOptions, async (request) => {
  const publicId = request.data && request.data.publicId;
  try {
    return await buildPublicDashboard(db, publicId);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error fetching public dashboard:", error);
    throw new Error("Failed to load dashboard. Please try again later.");
  }
});

/**
 * Accepts pending homeschool invitations and links student records for the
 * signed-in user's verified email. Called by the clients after sign-in.
 */
exports.acceptInvitations = onCall(callableOptions, async (request) => {
  try {
    return await acceptInvitations(db, request.auth);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error("Error accepting invitations:", error);
    throw new Error("Failed to accept invitations.");
  }
});
