import React, { useState } from 'react';
import { doc, collection, query, where, getDocs, writeBatch, deleteDoc, DocumentReference } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool } from '../types';
import Modal from './Modal';

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

    try {
      // Delete all related data
      console.log('Starting homeschool deletion...');

      // Students, activities, goals, ad-hoc tasks and activity instances all
      // carry homeschoolId (Firestore rules require queries to be scoped by it).
      const refs: DocumentReference[] = [];
      for (const name of ['people', 'activities', 'goals', 'adHocTasks', 'activityInstances']) {
        const snapshot = await getDocs(query(collection(db, name), where('homeschoolId', '==', homeschool.id)));
        snapshot.docs.forEach(d => refs.push(d.ref));
      }

      // Commit in chunks (batches are capped at 500 writes). The homeschool
      // itself goes last: rules check membership against it on every delete.
      const chunkSize = 400;
      for (let i = 0; i < refs.length; i += chunkSize) {
        const batch = writeBatch(db);
        refs.slice(i, i + chunkSize).forEach(ref => batch.delete(ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, 'homeschools', homeschool.id));

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
    <Modal>
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
              className="hs-btn hs-btn--danger"
            >
              Yes, Continue
            </button>
            <button
              onClick={onClose}
              className="hs-btn hs-btn--secondary"
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
            backgroundColor: 'var(--hs-bg-surface)', 
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
              className="hs-btn hs-btn--danger"
            >
              {deleting ? 'Deleting...' : 'Delete Forever'}
            </button>
            <button
              onClick={() => setShowWarning(true)}
              disabled={deleting}
              className="hs-btn hs-btn--secondary"
            >
              Back
            </button>
            <button
              onClick={onClose}
              disabled={deleting}
              className="hs-btn hs-btn--success"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default HomeschoolDelete;