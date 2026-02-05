// import { getFunctions, httpsCallable } from 'firebase/functions';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Initialize Firebase Functions
// const functions = getFunctions();

// Check if an email address is already registered
export const checkEmailExists = async (email: string): Promise<boolean> => {
  try {
    // Query the people collection to see if this email exists
    const q = query(collection(db, 'people'), where('email', '==', email));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  } catch (error) {
    console.error('Error checking email existence:', error);
    return false;
  }
};

// Send an invitation email to a student
export const sendStudentInvitation = async (
  studentEmail: string, 
  studentName: string, 
  homeschoolName: string,
  inviterName: string
): Promise<{ success: boolean; message: string; invitationDetails?: { email: string; subject: string; body: string } }> => {
  try {
    const inviteLink = window.location.origin;
    const subject = `Invitation to join ${homeschoolName} on HomeschoolDone`;
    const body = `Hi ${studentName},

${inviterName} has invited you to join "${homeschoolName}" on HomeschoolDone, an app for tracking homeschool activities and progress.

To accept this invitation, please:
1. Visit ${inviteLink}
2. Click "Sign in with Google"
3. Use this email address: ${studentEmail}
4. You'll automatically have access as a student

As a student, you can:
- Track your daily activities and progress
- See your goals and achievements
- Log time spent on different subjects
- View your progress reports

If you have any questions, contact ${inviterName}.

Best regards,
The HomeschoolDone Team`;

    return { 
      success: true, 
      message: 'Ready to send invitation!',
      invitationDetails: {
        email: studentEmail,
        subject,
        body
      }
    };
  } catch (error) {
    console.error('Error preparing invitation:', error);
    return { 
      success: false, 
      message: 'Failed to prepare invitation email. Please try again.' 
    };
  }
};

// Future: Firebase Function for sending emails via SendGrid/other service
/*
export const sendStudentInvitationViaFunction = async (
  studentEmail: string,
  studentName: string,
  homeschoolName: string,
  inviterName: string
): Promise<{ success: boolean; message: string }> => {
  try {
    const sendInvitation = httpsCallable(functions, 'sendStudentInvitation');
    const result = await sendInvitation({
      studentEmail,
      studentName,
      homeschoolName,
      inviterName,
      inviteLink: `${window.location.origin}?invite=student&email=${encodeURIComponent(studentEmail)}`
    });
    
    return result.data as { success: boolean; message: string };
  } catch (error) {
    console.error('Error sending invitation via function:', error);
    return { 
      success: false, 
      message: 'Failed to send invitation email. Please try again.' 
    };
  }
};
*/