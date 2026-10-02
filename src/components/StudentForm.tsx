import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Person, Homeschool } from '../types';
import { sendStudentInvitation } from '../utils/invitations';
import InvitationDialog from './InvitationDialog';
import Modal from './Modal';

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
  const [invitationSent, setInvitationSent] = useState(false);
  const [showInvitationDialog, setShowInvitationDialog] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState<{
    email: string;
    subject: string;
    body: string;
  } | null>(null);

  // Reset invitation status when the email changes
  useEffect(() => {
    setInvitationSent(false);
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
        role: 'student',
        homeschoolId
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
    <>
      <Modal maxWidth="400px">
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
                border: '1px solid var(--hs-border-input)',
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
                border: '1px solid var(--hs-border-input)',
                borderRadius: '4px'
              }}
              placeholder="student@example.com"
            />
            <div style={{ fontSize: '12px', color: 'var(--hs-text-secondary)', marginTop: '4px' }}>
              If provided, student can log in to record their own activities
            </div>
            
            {/* Email Status and Invitation */}
            {email.trim() && email.includes('@') && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '12px' }}>
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
                    <div style={{ color: 'var(--hs-text-secondary)', fontSize: '11px' }}>
                      Enter student name first to send invitation
                    </div>
                  )}
                </div>
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
                border: '1px solid var(--hs-border-input)',
                borderRadius: '4px'
              }}
              placeholder="e.g., +1 (555) 123-4567"
            />
            <div style={{ fontSize: '12px', color: 'var(--hs-text-secondary)', marginTop: '4px' }}>
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
                border: '1px solid var(--hs-border-input)',
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
                border: '1px solid var(--hs-border-input)',
                borderRadius: '4px'
              }}
              placeholder="e.g., 4.5"
            />
            <div style={{ fontSize: '12px', color: 'var(--hs-text-secondary)', marginTop: '4px' }}>
              Students of different ages and abilities do different daily hours of education
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={saving}
              className="hs-btn hs-btn--primary"
            >
              {saving ? 'Adding...' : 'Add Student'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="hs-btn hs-btn--secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
      
      {showInvitationDialog && invitationDetails && (
        <InvitationDialog
          email={invitationDetails.email}
          subject={invitationDetails.subject}
          body={invitationDetails.body}
          onClose={() => setShowInvitationDialog(false)}
        />
      )}
    </>
  );
};

export default StudentForm;