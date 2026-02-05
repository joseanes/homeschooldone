import React, { useState, useEffect } from 'react';
import { doc, updateDoc, arrayRemove, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool, Person } from '../types';
import DeleteConfirmation from './DeleteConfirmation';
import CleanupDuplicates from './CleanupDuplicates';
import InvitationDialog from './InvitationDialog';
import { formatLastActivity } from '../utils/activityTracking';

interface AuthorizedUsersProps {
  homeschool: Homeschool;
  currentUserId: string;
  currentUserInfo: { name?: string; email?: string };
  onClose: () => void;
  onUpdate: (updatedHomeschool: Homeschool) => void;
}

interface UserWithStatus extends Person {
  status: 'active' | 'invited';
}

const AuthorizedUsers: React.FC<AuthorizedUsersProps> = ({ 
  homeschool, 
  currentUserId,
  currentUserInfo,
  onClose, 
  onUpdate 
}) => {
  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    userId: string;
    userName: string;
    userRole: string;
  } | null>(null);
  const [showCleanup, setShowCleanup] = useState(false);
  const [showInvitationDialog, setShowInvitationDialog] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState<{
    email: string;
    subject: string;
    body: string;
  } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, [homeschool]);

  const fetchUsers = async () => {
    try {
      const allUserIds = [
        ...homeschool.parentIds,
        ...homeschool.tutorIds,
        ...homeschool.observerIds
      ];
      
      // Also include invited emails
      const allUserEmails = [
        ...(homeschool.parentEmails || []),
        ...(homeschool.tutorEmails || []),
        ...(homeschool.observerEmails || [])
      ];
      
      const allUsers = [...allUserIds, ...allUserEmails];

      if (allUsers.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // Create user objects for all IDs, including current user and invitees
      const userList: UserWithStatus[] = [];

      for (const userId of allUsers) {
        try {
          // First, check if this is the current user
          if (userId === currentUserId) {
            // Try to get current user info from database
            const currentUserDoc = await getDoc(doc(db, 'people', userId));
            if (currentUserDoc.exists()) {
              const userData = currentUserDoc.data();
              userList.push({
                ...userData,
                id: userId,
                name: userData.name || currentUserInfo.name || 'You',
                email: userData.email || currentUserInfo.email || '',
                role: getUserRole(userId) as any,
                status: 'active'
              } as UserWithStatus);
            } else {
              // Fallback if no database entry
              userList.push({
                id: userId,
                name: currentUserInfo.name || 'You',
                email: currentUserInfo.email || '',
                role: getUserRole(userId) as any,
                status: 'active'
              });
            }
            continue;
          }

          // Try to find user in people collection by email or other identifier
          // For now, we'll check both document ID and email field
          const q1 = query(collection(db, 'people'), where('email', '==', userId));
          const snapshot1 = await getDocs(q1);
          
          if (!snapshot1.empty) {
            const userData = snapshot1.docs[0].data();
            userList.push({ 
              ...userData, 
              id: userId,
              status: 'active' 
            } as UserWithStatus);
            continue;
          }

          // If not found by email, try by document ID
          const q2 = query(collection(db, 'people'), where('__name__', '==', userId));
          const snapshot2 = await getDocs(q2);
          
          if (!snapshot2.empty) {
            const userData = snapshot2.docs[0].data();
            userList.push({ 
              ...userData, 
              id: userId,
              status: 'active' 
            } as UserWithStatus);
            continue;
          }

          // If user not found in database, they might be invited but haven't signed up yet
          userList.push({
            id: userId,
            name: userId.includes('@') ? userId.split('@')[0] : 'Invited User',
            email: userId.includes('@') ? userId : '',
            role: getUserRole(userId) as any,
            status: 'invited'
          });

        } catch (error) {
          console.error('Error fetching user:', userId, error);
          // Still add them as invited
          userList.push({
            id: userId,
            name: userId.includes('@') ? userId.split('@')[0] : 'Unknown User',
            email: userId.includes('@') ? userId : '',
            role: getUserRole(userId) as any,
            status: 'invited'
          });
        }
      }

      // Deduplicate users based on email
      const deduplicatedUsers: UserWithStatus[] = [];
      const seenEmails = new Set<string>();
      const seenIds = new Set<string>();
      
      for (const user of userList) {
        // Skip if we've already seen this email (and it's not empty)
        if (user.email && seenEmails.has(user.email.toLowerCase())) {
          // If this is the authenticated version, replace the invited version
          const existingIndex = deduplicatedUsers.findIndex(
            u => u.email?.toLowerCase() === user.email?.toLowerCase()
          );
          if (existingIndex !== -1 && user.status === 'active' && deduplicatedUsers[existingIndex].status === 'invited') {
            deduplicatedUsers[existingIndex] = user;
          }
          continue;
        }
        
        // Skip if we've already seen this ID
        if (seenIds.has(user.id)) {
          continue;
        }
        
        if (user.email) seenEmails.add(user.email.toLowerCase());
        seenIds.add(user.id);
        deduplicatedUsers.push(user);
      }
      
      setUsers(deduplicatedUsers);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const getUserRole = (userId: string): string => {
    if (homeschool.parentIds.includes(userId) || (homeschool.parentEmails && homeschool.parentEmails.includes(userId))) return 'Parent';
    if (homeschool.tutorIds.includes(userId) || (homeschool.tutorEmails && homeschool.tutorEmails.includes(userId))) return 'Tutor';
    if (homeschool.observerIds.includes(userId) || (homeschool.observerEmails && homeschool.observerEmails.includes(userId))) return 'Observer';
    return 'Unknown';
  };
  
  const handleResendInvitation = (email: string, role: string) => {
    const subject = `Reminder: You've been invited to ${homeschool.name} on HomeschoolDone`;
    const inviteUrl = window.location.origin;
    const body = `Hi ${email.split('@')[0]},

This is a reminder that ${currentUserInfo.name || 'someone'} has invited you to join ${homeschool.name} as a ${role} on HomeschoolDone.

HomeschoolDone is a platform for tracking homeschool education progress and activities.

To accept this invitation, please:
1. Visit ${inviteUrl}
2. Sign in with this email address: ${email}
3. You'll automatically have access to ${homeschool.name}

Role: ${role}
${role === 'Parent' ? '- Full access to all features\n- Can invite other users\n- Can delete students and activities' : 
  role === 'Tutor' ? '- Can create activities and assign goals\n- Can record student progress\n- Can view reports' :
  '- Can view student progress\n- Can view reports\n- Cannot edit or delete anything'}

If you have any questions, please contact ${currentUserInfo.name || 'the person who invited you'}.

Best regards,
The HomeschoolDone Team`;

    setInvitationDetails({
      email,
      subject,
      body
    });
    setShowInvitationDialog(true);
  };

  const handleRevokeAccess = async (userId: string) => {
    try {
      const userRole = getUserRole(userId);
      
      // Check if this is an email (invited user) or ID (actual user)
      const isEmail = userId.includes('@');
      
      let updateField: string;
      let updateFieldEmail: string;
      
      switch (userRole) {
        case 'Parent':
          updateField = 'parentIds';
          updateFieldEmail = 'parentEmails';
          break;
        case 'Tutor':
          updateField = 'tutorIds';
          updateFieldEmail = 'tutorEmails';
          break;
        case 'Observer':
          updateField = 'observerIds';
          updateFieldEmail = 'observerEmails';
          break;
        default:
          throw new Error('Unknown user role');
      }

      // Remove from appropriate field
      if (isEmail) {
        await updateDoc(doc(db, 'homeschools', homeschool.id), {
          [updateFieldEmail]: arrayRemove(userId)
        });
      } else {
        await updateDoc(doc(db, 'homeschools', homeschool.id), {
          [updateField]: arrayRemove(userId)
        });
      }

      // Update local state
      const updatedHomeschool = { ...homeschool };
      switch (userRole) {
        case 'Parent':
          if (isEmail) {
            updatedHomeschool.parentEmails = (updatedHomeschool.parentEmails || []).filter(email => email !== userId);
          } else {
            updatedHomeschool.parentIds = updatedHomeschool.parentIds.filter(id => id !== userId);
          }
          break;
        case 'Tutor':
          if (isEmail) {
            updatedHomeschool.tutorEmails = (updatedHomeschool.tutorEmails || []).filter(email => email !== userId);
          } else {
            updatedHomeschool.tutorIds = updatedHomeschool.tutorIds.filter(id => id !== userId);
          }
          break;
        case 'Observer':
          if (isEmail) {
            updatedHomeschool.observerEmails = (updatedHomeschool.observerEmails || []).filter(email => email !== userId);
          } else {
            updatedHomeschool.observerIds = updatedHomeschool.observerIds.filter(id => id !== userId);
          }
          break;
      }

      onUpdate(updatedHomeschool);
      setUsers(users.filter(user => user.id !== userId));
      setDeleteConfirmation(null);
    } catch (error) {
      console.error('Error revoking access:', error);
      alert('Error revoking access. Please try again.');
    }
  };

  if (loading) return <div>Loading authorized users...</div>;

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
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Authorized Users</h2>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              onClick={() => setShowCleanup(true)}
              style={{
                padding: '6px 12px',
                fontSize: '14px',
                backgroundColor: '#ffc107',
                color: '#000',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              title="Remove duplicate email entries for users who are already in the system"
            >
              Clean Up Duplicates
            </button>
            <button
              onClick={onClose}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666'
              }}
            >
              ×
            </button>
          </div>
        </div>

        <p style={{ color: '#666', marginBottom: '20px' }}>
          People with access to "{homeschool.name}" homeschool:
        </p>

        {users.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#666' }}>
            No authorized users found
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '12px' }}>
            {users.map(user => {
              const role = getUserRole(user.id);
              const isCurrentUser = user.id === currentUserId;
              const isOnlyParent = role === 'Parent' && homeschool.parentIds.length === 1;

              return (
                <div key={user.id} style={{
                  padding: '15px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: isCurrentUser ? '#f0f8ff' : 'white',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      {user.name || user.email}
                      {isCurrentUser && (
                        <span style={{ 
                          marginLeft: '8px', 
                          fontSize: '12px', 
                          color: '#007bff',
                          fontWeight: 'normal'
                        }}>
                          (You)
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ 
                        backgroundColor: role === 'Parent' ? '#e3f2fd' : role === 'Tutor' ? '#e8f5e8' : '#fff3e0',
                        color: role === 'Parent' ? '#1976d2' : role === 'Tutor' ? '#388e3c' : '#f57c00',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        {role}
                      </span>
                      <span style={{
                        backgroundColor: user.status === 'active' ? '#e8f5e8' : '#fff3e0',
                        color: user.status === 'active' ? '#388e3c' : '#f57c00',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        {user.status === 'active' ? '✅ Active' : '📧 Invited'}
                      </span>
                      {user.email && (
                        <span>
                          📧 {user.email}
                        </span>
                      )}
                    </div>
                    {/* Last activity info */}
                    {user.status === 'active' && (
                      <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>
                        {user.lastLogin && (
                          <span>Last login: {formatLastActivity(user.lastLogin)}</span>
                        )}
                        {user.lastActivity && user.lastActivity !== user.lastLogin && (
                          <span style={{ marginLeft: '12px' }}>
                            Last active: {formatLastActivity(user.lastActivity)}
                          </span>
                        )}
                        {!user.lastLogin && !user.lastActivity && (
                          <span>No activity recorded</span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* Resend button for invited users */}
                    {user.status === 'invited' && user.email && (
                      <button
                        onClick={() => handleResendInvitation(user.email || user.id, role)}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                        title="Resend invitation email"
                      >
                        📧 Resend
                      </button>
                    )}
                    
                    {/* Revoke access button - show for everyone except current user and only parent */}
                    {!isCurrentUser && (!isOnlyParent || homeschool.parentEmails?.length) && (
                      <button
                        onClick={() => setDeleteConfirmation({
                          userId: user.id,
                          userName: user.name || user.email || 'Unknown User',
                          userRole: role
                        })}
                        style={{
                          padding: '6px 12px',
                          fontSize: '12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        {user.status === 'invited' ? 'Remove' : 'Revoke Access'}
                      </button>
                    )}
                    
                    {/* Status messages */}
                    {isOnlyParent && !homeschool.parentEmails?.length && (
                      <span style={{ 
                        fontSize: '11px', 
                        color: '#666',
                        fontStyle: 'italic'
                      }}>
                        Cannot remove only parent
                      </span>
                    )}
                    {isCurrentUser && (
                      <span style={{ 
                        fontSize: '11px', 
                        color: '#666',
                        fontStyle: 'italic'
                      }}>
                        Cannot remove yourself
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '4px',
          fontSize: '13px',
          color: '#666'
        }}>
          <strong>Note:</strong> To add new users, use the "Invite" function in the main settings panel. 
          You cannot remove yourself or the last parent from the homeschool.
        </div>
      </div>

      {deleteConfirmation && (
        <DeleteConfirmation
          entityType="user access"
          entityName={`${deleteConfirmation.userName}'s ${deleteConfirmation.userRole.toLowerCase()} access`}
          onConfirm={() => handleRevokeAccess(deleteConfirmation.userId)}
          onCancel={() => setDeleteConfirmation(null)}
        />
      )}
      
      {showCleanup && (
        <CleanupDuplicates
          homeschool={homeschool}
          currentUserEmail={currentUserInfo.email || ''}
          onClose={() => setShowCleanup(false)}
          onUpdate={(updated) => {
            onUpdate(updated);
            fetchUsers(); // Refresh the user list
          }}
        />
      )}
      
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

export default AuthorizedUsers;