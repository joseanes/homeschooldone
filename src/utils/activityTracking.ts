import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';

// Update last login time for a user
export const updateLastLogin = async (user: User) => {
  try {
    const userDocRef = doc(db, 'people', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      // Update existing user document
      await updateDoc(userDocRef, {
        lastLogin: new Date(),
        lastActivity: new Date()
      });
    } else {
      // Create a new user document if it doesn't exist
      await setDoc(userDocRef, {
        id: user.uid,
        email: user.email || '',
        name: user.displayName || user.email || 'Unknown User',
        role: 'parent', // Default role, should be determined properly
        lastLogin: new Date(),
        lastActivity: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating last login:', error);
  }
};

// Update last activity time for a user
export const updateLastActivity = async (userId: string) => {
  try {
    const userDocRef = doc(db, 'people', userId);
    await updateDoc(userDocRef, {
      lastActivity: new Date()
    });
  } catch (error) {
    console.error('Error updating last activity:', error);
  }
};

// Update last activity for a student when they complete an activity
export const updateStudentLastActivity = async (studentId: string) => {
  try {
    const studentDocRef = doc(db, 'people', studentId);
    const studentDoc = await getDoc(studentDocRef);
    
    if (studentDoc.exists()) {
      await updateDoc(studentDocRef, {
        lastActivity: new Date()
      });
    }
  } catch (error) {
    console.error('Error updating student last activity:', error);
  }
};

// Format timestamp for display
export const formatLastActivity = (timestamp: any): string => {
  if (!timestamp) return 'Never';
  
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  // For older dates, show actual date
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
};