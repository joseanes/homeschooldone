import emailjs from '@emailjs/browser';

// EmailJS configuration
// You need to sign up at https://www.emailjs.com/ and get these values
const EMAIL_SERVICE_ID = 'YOUR_SERVICE_ID'; // Replace with your EmailJS service ID
const EMAIL_TEMPLATE_ID = 'YOUR_TEMPLATE_ID'; // Replace with your EmailJS template ID
const EMAIL_PUBLIC_KEY = 'YOUR_PUBLIC_KEY'; // Replace with your EmailJS public key

// Initialize EmailJS
emailjs.init(EMAIL_PUBLIC_KEY);

export interface InvitationEmailParams {
  toEmail: string;
  toName: string;
  fromName: string;
  homeschoolName: string;
  role: string;
  inviteUrl: string;
}

export const sendInvitationEmail = async (params: InvitationEmailParams): Promise<void> => {
  try {
    const templateParams = {
      to_email: params.toEmail,
      to_name: params.toName,
      from_name: params.fromName,
      homeschool_name: params.homeschoolName,
      role: params.role,
      invite_url: params.inviteUrl,
    };

    const response = await emailjs.send(
      EMAIL_SERVICE_ID,
      EMAIL_TEMPLATE_ID,
      templateParams
    );

    if (response.status !== 200) {
      throw new Error('Failed to send email');
    }

    console.log('Email sent successfully:', response);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

// Student invitation email
export interface StudentInvitationEmailParams {
  toEmail: string;
  studentName: string;
  parentName: string;
  homeschoolName: string;
  inviteUrl: string;
}

export const sendStudentInvitationEmail = async (params: StudentInvitationEmailParams): Promise<void> => {
  try {
    const templateParams = {
      to_email: params.toEmail,
      student_name: params.studentName,
      parent_name: params.parentName,
      homeschool_name: params.homeschoolName,
      invite_url: params.inviteUrl,
    };

    const response = await emailjs.send(
      EMAIL_SERVICE_ID,
      EMAIL_TEMPLATE_ID, // You might want a different template for students
      templateParams
    );

    if (response.status !== 200) {
      throw new Error('Failed to send email');
    }

    console.log('Student email sent successfully:', response);
  } catch (error) {
    console.error('Error sending student email:', error);
    throw error;
  }
};