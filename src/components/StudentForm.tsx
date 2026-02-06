import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Person, Homeschool } from '../types';
import { checkEmailExists, sendStudentInvitation } from '../utils/invitations';
import InvitationDialog from './InvitationDialog';

interface StudentFormProps {
  homeschoolId: string;
  homeschool: Homeschool;
  inviterName: string;
  onClose: () => void;
  onStudentAdded: () => void;
}

const StudentForm: React.FC<StudentFormProps> = ({ homeschoolId, homeschool, inviterName, onClose, onStudentAdded }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dailyWorkHoursGoal, setDailyWorkHoursGoal] = useState('');
  const [saving, setSaving] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [invitationSent, setInvitationSent] = useState(false);
  const [showInvitationDialog, setShowInvitationDialog] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState<{
    email: string;
    subject: string;
    body: string;
  } | null>(null);

  // Check if email exists when email changes
  useEffect(() => {
    const checkEmail = async () => {
      if (email.trim() && email.includes('@')) {
        setCheckingEmail(true);
        const exists = await checkEmailExists(email.trim());
        setEmailExists(exists);
        setCheckingEmail(false);
        setInvitationSent(false); // Reset invitation status when email changes
      } else {
        setEmailExists(null);
        setInvitationSent(false);
      }
    };

    const timeoutId = setTimeout(checkEmail, 500); // Debounce email checking
    return () => clearTimeout(timeoutId);
  }, [email]);

  const handleSendInvitation = async () => {
    if (!email.trim() || !name.trim()) return;
    
    try {
      const result = await sendStudentInvitation(
        email.trim(),
        name.trim(),
        homeschool.name,
        inviterName
      );
      
      if (result.success && result.invitationDetails) {
        setInvitationSent(true);
        setInvitationDetails(result.invitationDetails);
        setShowInvitationDialog(true);
      } else {
        alert(result.message);
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert('Failed to send invitation. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Create the student document
      const studentData: any = {
        name,
        role: 'student'
      };
      
      // Only add optional fields if they have values
      if (email.trim()) {
        studentData.email = email.trim();
      }
      
      if (mobile.trim()) {
        studentData.mobile = mobile.trim();
      }
      
      if (dateOfBirth) {
        studentData.dateOfBirth = new Date(dateOfBirth);
      }
      
      if (dailyWorkHoursGoal) {
        studentData.dailyWorkHoursGoal = parseFloat(dailyWorkHoursGoal);
      }

      const studentRef = await addDoc(collection(db, 'people'), studentData);
      
      // Add student ID to homeschool's studentIds array
      await updateDoc(doc(db, 'homeschools', homeschoolId), {
        studentIds: arrayUnion(studentRef.id)
      });

      onStudentAdded();
      onClose();
    } catch (error) {
      console.error('Error adding student:', error);
      alert('Error adding student. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '90%'
      }}>
        <h2>Add Student</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Student Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              placeholder="e.g., John Smith"
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Email Address (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              placeholder="student@example.com"
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              If provided, student can log in to record their own activities
            </div>
            
            {/* Email Status and Invitation */}
            {email.trim() && email.includes('@') && (
              <div style={{ marginTop: '8px' }}>
                {checkingEmail ? (
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    🔍 Checking if account exists...
                  </div>
                ) : emailExists === true ? (
                  <div style={{ fontSize: '12px', color: '#2e7d32' }}>
                    ✅ Account already exists! Student can sign in with this email.
                  </div>
                ) : emailExists === false ? (
                  <div style={{ fontSize: '12px' }}>
                    <div style={{ color: '#ff6f00', marginBottom: '8px' }}>
                      ⚠️ No account found with this email
                    </div>
                    {name.trim() && (
                      <button
                        type="button"
                        onClick={handleSendInvitation}
                        disabled={invitationSent}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: invitationSent ? '#4caf50' : '#ff9800',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: invitationSent ? 'default' : 'pointer'
                        }}
                      >
                        {invitationSent ? '📧 Invitation Sent' : '📧 Send Invitation'}
                      </button>
                    )}
                    {!name.trim() && (
                      <div style={{ color: '#666', fontSize: '11px' }}>
                        Enter student name first to send invitation
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Mobile Number (optional)
            </label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              placeholder="e.g., +1 (555) 123-4567"
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              For SMS notifications and emergency contact
            </div>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Date of Birth (optional)
            </label>
            <input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Daily Work Hours Goal (optional)
            </label>
            <input
              type="number"
              value={dailyWorkHoursGoal}
              onChange={(e) => setDailyWorkHoursGoal(e.target.value)}
              min="0"
              max="24"
              step="0.5"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              placeholder="e.g., 4.5"
            />
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Students of different ages and abilities do different daily hours of education
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1
              }}
            >
              {saving ? 'Adding...' : 'Add Student'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
      
      {showInvitationDialog && invitationDetails && (
        <InvitationDialog
          email={invitationDetails.email}
          subject={invitationDetails.subject}
          body={invitationDetails.body}
          onClose={() => setShowInvitationDialog(false)}
        />
      )}
    </div>
  );
};

export default StudentForm;