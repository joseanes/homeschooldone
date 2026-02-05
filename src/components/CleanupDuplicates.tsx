import React, { useState } from 'react';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool } from '../types';

interface CleanupDuplicatesProps {
  homeschool: Homeschool;
  currentUserEmail: string;
  onClose: () => void;
  onUpdate: (updatedHomeschool: Homeschool) => void;
}

const CleanupDuplicates: React.FC<CleanupDuplicatesProps> = ({ 
  homeschool, 
  currentUserEmail,
  onClose, 
  onUpdate 
}) => {
  const [cleaning, setCleaning] = useState(false);

  const findDuplicateEmails = () => {
    const duplicates: { email: string; inIds: boolean; inEmails: boolean; role: string }[] = [];
    
    // Check each email list against the ID lists
    const allEmails = [
      ...(homeschool.parentEmails || []).map(email => ({ email, role: 'parent' })),
      ...(homeschool.tutorEmails || []).map(email => ({ email, role: 'tutor' })),
      ...(homeschool.observerEmails || []).map(email => ({ email, role: 'observer' }))
    ];
    
    // For current user's email, check if it appears in both IDs and emails
    if (currentUserEmail) {
      const emailInParents = homeschool.parentEmails?.includes(currentUserEmail);
      const emailInTutors = homeschool.tutorEmails?.includes(currentUserEmail);
      const emailInObservers = homeschool.observerEmails?.includes(currentUserEmail);
      
      if (emailInParents || emailInTutors || emailInObservers) {
        duplicates.push({
          email: currentUserEmail,
          inIds: true, // We know current user is in IDs
          inEmails: true,
          role: emailInParents ? 'parent' : emailInTutors ? 'tutor' : 'observer'
        });
      }
    }
    
    return duplicates;
  };

  const handleCleanup = async () => {
    setCleaning(true);
    
    try {
      const duplicates = findDuplicateEmails();
      
      if (duplicates.length === 0) {
        alert('No duplicates found!');
        onClose();
        return;
      }
      
      // Remove duplicate emails
      const updates: any = {};
      
      for (const dup of duplicates) {
        const emailField = `${dup.role}Emails`;
        if (!updates[emailField]) {
          updates[emailField] = [...(homeschool[emailField as keyof Homeschool] as string[] || [])];
        }
        updates[emailField] = updates[emailField].filter((email: string) => email !== dup.email);
      }
      
      await updateDoc(doc(db, 'homeschools', homeschool.id), updates);
      
      // Update local homeschool object
      const updatedHomeschool = { ...homeschool };
      for (const key in updates) {
        (updatedHomeschool as any)[key] = updates[key];
      }
      
      onUpdate(updatedHomeschool);
      
      alert(`Cleaned up ${duplicates.length} duplicate(s)!`);
      onClose();
    } catch (error) {
      console.error('Error cleaning duplicates:', error);
      alert('Error cleaning duplicates. Please try again.');
    } finally {
      setCleaning(false);
    }
  };

  const duplicates = findDuplicateEmails();

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
        maxWidth: '500px'
      }}>
        <h2>Clean Up Duplicate Users</h2>
        
        {duplicates.length === 0 ? (
          <div>
            <p>No duplicate users found in your homeschool.</p>
            <button
              onClick={onClose}
              style={{
                marginTop: '20px',
                padding: '10px 20px',
                fontSize: '16px',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <div>
            <p>Found {duplicates.length} duplicate user(s) that can be cleaned up:</p>
            
            <div style={{ margin: '20px 0' }}>
              {duplicates.map((dup, index) => (
                <div key={index} style={{
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  marginBottom: '10px',
                  backgroundColor: '#f8f9fa'
                }}>
                  <strong>{dup.email}</strong> - appears in both user list and {dup.role} email invites
                </div>
              ))}
            </div>
            
            <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>
              This will remove the email invitation entries since these users are already active in the system.
            </p>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleCleanup}
                disabled={cleaning}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: cleaning ? 'not-allowed' : 'pointer',
                  opacity: cleaning ? 0.6 : 1
                }}
              >
                {cleaning ? 'Cleaning...' : 'Clean Up Duplicates'}
              </button>
              <button
                onClick={onClose}
                disabled={cleaning}
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
          </div>
        )}
      </div>
    </div>
  );
};

export default CleanupDuplicates;