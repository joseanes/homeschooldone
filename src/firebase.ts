import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDxRPh5cYPqU1LTmirK3-P_vKK-2bqmzLg",
  authDomain: "homeschooldone.firebaseapp.com",
  projectId: "homeschooldone",
  storageBucket: "homeschooldone.firebasestorage.app",
  messagingSenderId: "597375552014",
  appId: "1:597375552014:web:b9d2b5559e2e9de1620a5f",
  measurementId: "G-BYCC7RM47R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;