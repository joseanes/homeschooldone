import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool } from '../types';
import Modal from './Modal';

interface HomeschoolEditProps {
  homeschool: Homeschool;
  onClose: () => void;
  onUpdate: (updatedHomeschool: Homeschool) => void;
}

const HomeschoolEdit: React.FC<HomeschoolEditProps> = ({ homeschool, onClose, onUpdate }) => {
  const [name, setName] = useState(homeschool.name);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      await updateDoc(doc(db, 'homeschools', homeschool.id), {
        name: name.trim()
      });

      const updatedHomeschool = { ...homeschool, name: name.trim() };
      onUpdate(updatedHomeschool);
      onClose();
    } catch (error: any) {
      console.error('Error updating homeschool:', error);
      alert(`Error updating homeschool: ${error.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal maxWidth="400px">
      <h2>Edit Homeschool</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="homeschool-edit-homeschool-name" style={{ display: 'block', marginBottom: '5px' }}>
            Homeschool Name *
          </label>
          <input id="homeschool-edit-homeschool-name"
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
            placeholder="e.g., Smith Family Homeschool"
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="hs-btn hs-btn--primary"
          >
            {saving ? 'Saving...' : 'Save Changes'}
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
  );
};

export default HomeschoolEdit;