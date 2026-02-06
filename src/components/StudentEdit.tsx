import React, { useState, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Person, Homeschool } from '../types';
import { checkEmailExists, sendStudentInvitation } from '../utils/invitations';
import InvitationDialog from './InvitationDialog';

interface StudentEditProps {
  student: Person;
  homeschool: Homeschool;
  inviterName: string;
  onClose: () => void;
  onUpdate: (updatedStudent: Person) => void;
}

const StudentEdit: React.FC<StudentEditProps> = ({ student, homeschool, inviterName, onClose, onUpdate }) => {
  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email || '');
  const [mobile, setMobile] = useState(student.mobile || '');
  const [dateOfBirth, setDateOfBirth] = useState(
    student.dateOfBirth ? 
      (student.dateOfBirth instanceof Date ? 
        student.dateOfBirth.toISOString().split('T')[0] : 
        new Date(student.dateOfBirth.seconds * 1000).toISOString().split('T')[0]) : 
      ''
  );
  const [dailyWorkHoursGoal, setDailyWorkHoursGoal] = useState(
    student.dailyWorkHoursGoal ? student.dailyWorkHoursGoal.toString() : ''
  );
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
  const [originalEmail] = useState(student.email || '');

  // Check if email exists when email changes (only if different from original)
  useEffect(() => {
    const checkEmail = async () => {
      if (email.trim() && email.includes('@') && email.trim() !== originalEmail) {
        setCheckingEmail(true);
        const exists = await checkEmailExists(email.trim());
        setEmailExists(exists);
        setCheckingEmail(false);
        setInvitationSent(false);
      } else {
        setEmailExists(null);
        setInvitationSent(false);
      }
    };

    const timeoutId = setTimeout(checkEmail, 500);
    return () => clearTimeout(timeoutId);
  }, [email, originalEmail]);

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
      const updates: any = {
        name: name.trim()
      };

      // Only add fields if they have values to avoid Firestore undefined errors
      if (email.trim()) {
        updates.email = email.trim();
      } else {
        updates.email = null; // Use null instead of undefined for Firestore
      }
      
      if (mobile.trim()) {
        updates.mobile = mobile.trim();
      } else {
        updates.mobile = null;
      }
      
      if (dailyWorkHoursGoal) {
        updates.dailyWorkHoursGoal = parseFloat(dailyWorkHoursGoal);
      } else {
        updates.dailyWorkHoursGoal = null;
      }

      if (dateOfBirth) {
        updates.dateOfBirth = new Date(dateOfBirth);
      } else {
        updates.dateOfBirth = null;
      }

      await updateDoc(doc(db, 'people', student.id), updates);

      const updatedStudent = { 
        ...student, 
        name: name.trim(),
        email: email.trim() || undefined,
        mobile: mobile.trim() || undefined,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        dailyWorkHoursGoal: dailyWorkHoursGoal ? parseFloat(dailyWorkHoursGoal) : undefined
      };
      onUpdate(updatedStudent);
      onClose();
    } catch (error: any) {
      console.error('Error updating student:', error);
      alert(`Error updating student: ${error.message || 'Unknown error'}`);
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
      zIndex: 2000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '90%'
      }}>
        <h2>Edit Student</h2>
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
            {email.trim() && email.includes('@') && email.trim() !== originalEmail && (
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
            
            {/* Show status for current email if it exists */}
            {originalEmail && email.trim() === originalEmail && (
              <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '12px', color: '#2e7d32' }}>
                  ✅ Current email - student can sign in with this address
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
              disabled={saving || !name.trim()}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#4285f4',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving || !name.trim() ? 0.6 : 1
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
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

export default StudentEdit;