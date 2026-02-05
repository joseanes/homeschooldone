import React, { useState } from 'react';
import { doc, updateDoc, arrayUnion, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool } from '../types';
import InvitationDialog from './InvitationDialog';

interface InviteUserProps {
  homeschool: Homeschool;
  currentUserName?: string;
  onClose: () => void;
  onInviteSent?: (updatedHomeschool: Homeschool) => void;
}

const InviteUser: React.FC<InviteUserProps> = ({ homeschool, currentUserName = 'A HomeschoolDone user', onClose, onInviteSent }) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'parent' | 'tutor' | 'observer'>('tutor');
  const [sending, setSending] = useState(false);
  const [showInvitationDialog, setShowInvitationDialog] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState<{
    email: string;
    subject: string;
    body: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    try {
      const emailToAdd = email.trim().toLowerCase();
      console.log('Starting invitation process for:', emailToAdd);
      
      // Check if user already exists in the homeschool
      const allExistingEmails = [
        ...(homeschool.parentEmails || []),
        ...(homeschool.tutorEmails || []),
        ...(homeschool.observerEmails || [])
      ];
      
      const allExistingIds = [
        ...homeschool.parentIds,
        ...homeschool.tutorIds,
        ...homeschool.observerIds
      ];
      
      // Check if email already invited
      if (allExistingEmails.includes(emailToAdd)) {
        alert('This email has already been invited to the homeschool.');
        setSending(false);
        return;
      }
      
      // Check if user with this email already has access (by checking people collection)
      const peopleQuery = query(collection(db, 'people'), where('email', '==', emailToAdd));
      const peopleSnapshot = await getDocs(peopleQuery);
      
      if (!peopleSnapshot.empty) {
        const existingUser = peopleSnapshot.docs[0];
        if (allExistingIds.includes(existingUser.id)) {
          alert('This user already has access to the homeschool.');
          setSending(false);
          return;
        }
      }
      
      // Prepare invitation details FIRST
      const subject = `You've been invited to ${homeschool.name} on HomeschoolDone`;
      const inviteUrl = window.location.origin;
      const roleCapitalized = role.charAt(0).toUpperCase() + role.slice(1);
      const body = `Hi ${emailToAdd.split('@')[0]},

${currentUserName} has invited you to join ${homeschool.name} as a ${roleCapitalized} on HomeschoolDone.

HomeschoolDone is a platform for tracking homeschool education progress and activities.

To accept this invitation, please:
1. Visit ${inviteUrl}
2. Sign in with this email address: ${emailToAdd}
3. You'll automatically have access to ${homeschool.name}

Role: ${roleCapitalized}
${role === 'parent' ? '- Full access to all features\n- Can invite other users\n- Can delete students and activities' : 
  role === 'tutor' ? '- Can create activities and assign goals\n- Can record student progress\n- Can view reports' :
  '- Can view student progress\n- Can view reports\n- Cannot edit or delete anything'}

If you have any questions, please contact ${currentUserName}.

Best regards,
The HomeschoolDone Team`;

      // Show invitation dialog immediately
      setInvitationDetails({
        email: emailToAdd,
        subject,
        body
      });
      setShowInvitationDialog(true);
      console.log('Setting invitation dialog to true');

      // Try to update database, but don't block the invitation
      try {
        const roleField = role === 'parent' ? 'parentEmails' : 
                         role === 'tutor' ? 'tutorEmails' : 'observerEmails';

        await updateDoc(doc(db, 'homeschools', homeschool.id), {
          [roleField]: arrayUnion(emailToAdd)
        });

        // Update local homeschool object
        const updatedHomeschool = { ...homeschool };
        
        switch (role) {
          case 'parent':
            updatedHomeschool.parentEmails = [...(updatedHomeschool.parentEmails || []), emailToAdd];
            break;
          case 'tutor':
            updatedHomeschool.tutorEmails = [...(updatedHomeschool.tutorEmails || []), emailToAdd];
            break;
          case 'observer':
            updatedHomeschool.observerEmails = [...(updatedHomeschool.observerEmails || []), emailToAdd];
            break;
        }

        if (onInviteSent) {
          onInviteSent(updatedHomeschool);
        }
      } catch (dbError) {
        console.error('Database error (but invitation dialog will still show):', dbError);
        alert('Note: There was a problem saving the invitation to the database, but you can still send the email invitation.');
      }
    } catch (error: any) {
      console.error('Error sending invitation:', error);
      alert(`Error sending invitation: ${error.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
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
      zIndex: 10000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '30px',
        borderRadius: '8px',
        maxWidth: '400px',
        width: '90%'
      }}>
        <h2>Invite User to {homeschool.name}</h2>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Email Address *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
              placeholder="user@example.com"
            />
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>
              Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '16px',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            >
              <option value="parent">Parent (Full access)</option>
              <option value="tutor">Tutor (Can manage activities and goals)</option>
              <option value="observer">Observer (View only)</option>
            </select>
          </div>

          <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
            <strong>Role Permissions:</strong>
            <ul style={{ margin: '5px 0', paddingLeft: '20px' }}>
              {role === 'parent' && (
                <>
                  <li>Full access to all features</li>
                  <li>Can invite other users</li>
                  <li>Can delete students and activities</li>
                </>
              )}
              {role === 'tutor' && (
                <>
                  <li>Can create activities and assign goals</li>
                  <li>Can record student progress</li>
                  <li>Can view reports</li>
                </>
              )}
              {role === 'observer' && (
                <>
                  <li>Can view student progress</li>
                  <li>Can view reports</li>
                  <li>Cannot edit or delete anything</li>
                </>
              )}
            </ul>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button
              type="submit"
              disabled={sending || !email.trim()}
              style={{
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: sending || !email.trim() ? 'not-allowed' : 'pointer',
                opacity: sending || !email.trim() ? 0.6 : 1
              }}
            >
              {sending ? 'Sending...' : 'Send Invitation'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
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
    </div>
    
    {showInvitationDialog && invitationDetails && (
      <InvitationDialog
        email={invitationDetails.email}
        subject={invitationDetails.subject}
        body={invitationDetails.body}
        onClose={() => {
          setShowInvitationDialog(false);
          setEmail('');
          onClose();
        }}
      />
    )}
  </>
  );
};

export default InviteUser;