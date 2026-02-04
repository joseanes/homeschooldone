import React, { useState } from 'react';

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
            border: '1px solid #ccc',
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
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: confirmText === entityName ? '#dc3545' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: confirmText === entityName && !isDeleting ? 'pointer' : 'not-allowed',
              opacity: isDeleting ? 0.6 : 1
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#6c757d',
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
    </div>
  );
};

export default DeleteConfirmation;