import React, { useState } from 'react';
import { doc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool } from '../types';

interface HomeschoolDeleteProps {
  homeschool: Homeschool;
  onClose: () => void;
  onDeleted: () => void;
}

const HomeschoolDelete: React.FC<HomeschoolDeleteProps> = ({ homeschool, onClose, onDeleted }) => {
  const [confirmationName, setConfirmationName] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showWarning, setShowWarning] = useState(true);

  const handleDelete = async () => {
    if (confirmationName !== homeschool.name) {
      alert('The name you entered does not match the homeschool name.');
      return;
    }

    setDeleting(true);
    const batch = writeBatch(db);

    try {
      // Delete all related data
      console.log('Starting homeschool deletion...');

      // 1. Delete all students
      const studentsQuery = query(collection(db, 'people'), where('__name__', 'in', homeschool.studentIds || []));
      if (homeschool.studentIds && homeschool.studentIds.length > 0) {
        const studentsSnapshot = await getDocs(studentsQuery);
        studentsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
      }

      // 2. Delete all activities
      const activitiesQuery = query(collection(db, 'activities'), where('homeschoolId', '==', homeschool.id));
      const activitiesSnapshot = await getDocs(activitiesQuery);
      activitiesSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 3. Delete all goals
      const goalsQuery = query(collection(db, 'goals'), where('homeschoolId', '==', homeschool.id));
      const goalsSnapshot = await getDocs(goalsQuery);
      const goalIds = goalsSnapshot.docs.map(doc => doc.id);
      goalsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      // 4. Delete all activity instances for these goals
      if (goalIds.length > 0) {
        const instancesQuery = query(collection(db, 'activityInstances'), where('goalId', 'in', goalIds));
        const instancesSnapshot = await getDocs(instancesQuery);
        instancesSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
      }

      // 5. Delete the homeschool itself
      batch.delete(doc(db, 'homeschools', homeschool.id));

      // Execute all deletions
      await batch.commit();

      console.log('Homeschool deletion completed');
      onDeleted();
      onClose();
    } catch (error) {
      console.error('Error deleting homeschool:', error);
      alert('Error deleting homeschool. Please try again.');
    } finally {
      setDeleting(false);
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
        maxWidth: '500px',
        width: '90%'
      }}>
        <h2 style={{ color: '#dc3545', marginTop: 0 }}>⚠️ Delete Homeschool</h2>
        
        {showWarning ? (
          <div>
            <p><strong>This action cannot be undone!</strong></p>
            <p>Deleting "{homeschool.name}" will permanently remove:</p>
            <ul style={{ color: '#dc3545', margin: '15px 0', paddingLeft: '20px' }}>
              <li>All students ({homeschool.studentIds?.length || 0})</li>
              <li>All activities and goals</li>
              <li>All recorded activity instances</li>
              <li>All progress data and reports</li>
            </ul>
            <p><strong>Are you sure you want to continue?</strong></p>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setShowWarning(false)}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Yes, Continue
              </button>
              <button
                onClick={onClose}
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
        ) : (
          <div>
            <p>To confirm deletion, please type the exact name of the homeschool:</p>
            <p style={{ 
              fontWeight: 'bold', 
              backgroundColor: '#f8f9fa', 
              padding: '10px', 
              borderRadius: '4px',
              fontFamily: 'monospace'
            }}>
              {homeschool.name}
            </p>
            
            <input
              type="text"
              value={confirmationName}
              onChange={(e) => setConfirmationName(e.target.value)}
              placeholder="Type the homeschool name here..."
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                border: '2px solid #dc3545',
                borderRadius: '4px',
                marginBottom: '20px'
              }}
            />
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleDelete}
                disabled={deleting || confirmationName !== homeschool.name}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: confirmationName === homeschool.name ? '#dc3545' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: (deleting || confirmationName !== homeschool.name) ? 'not-allowed' : 'pointer'
                }}
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
              <button
                onClick={() => setShowWarning(true)}
                disabled={deleting}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: deleting ? 'not-allowed' : 'pointer'
                }}
              >
                Back
              </button>
              <button
                onClick={onClose}
                disabled={deleting}
                style={{
                  padding: '10px 20px',
                  fontSize: '16px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: deleting ? 'not-allowed' : 'pointer'
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

export default HomeschoolDelete;