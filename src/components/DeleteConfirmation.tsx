import React, { useState } from 'react';
import Modal from './Modal';

interface DeleteConfirmationProps {
  entityType: string;
  entityName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
  entityType,
  entityName,
  onConfirm,
  onCancel
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText === entityName) {
      setIsDeleting(true);
      await onConfirm();
    }
  };

  return (
    <Modal maxWidth="400px">
      <h2 style={{ color: '#dc3545' }}>Delete {entityType}</h2>
      
      <p style={{ marginBottom: '20px' }}>
        Are you sure you want to delete <strong>{entityName}</strong>?
        This action cannot be undone.
      </p>

      <p style={{ marginBottom: '10px' }}>
        To confirm deletion, please type <strong>{entityName}</strong> below:
      </p>

      <input
        type="text"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        style={{
          width: '100%',
          padding: '8px',
          fontSize: '16px',
          border: '1px solid var(--hs-border-input)',
          borderRadius: '4px',
          marginBottom: '20px'
        }}
        placeholder={`Type "${entityName}" to confirm`}
        disabled={isDeleting}
      />

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleDelete}
          disabled={confirmText !== entityName || isDeleting}
          className="hs-btn hs-btn--danger"
        >
          {isDeleting ? 'Deleting...' : 'Delete'}
        </button>
        <button
          onClick={onCancel}
          disabled={isDeleting}
          className="hs-btn hs-btn--secondary"
        >
          Cancel
        </button>
      </div>
    </Modal>
  );
};

export default DeleteConfirmation;