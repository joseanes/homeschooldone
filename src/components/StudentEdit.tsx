import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Person } from '../types';

interface StudentEditProps {
  student: Person;
  onClose: () => void;
  onUpdate: (updatedStudent: Person) => void;
}

const StudentEdit: React.FC<StudentEditProps> = ({ student, onClose, onUpdate }) => {
  const [name, setName] = useState(student.name);
  const [dateOfBirth, setDateOfBirth] = useState(
    student.dateOfBirth ? 
      (student.dateOfBirth instanceof Date ? 
        student.dateOfBirth.toISOString().split('T')[0] : 
        new Date(student.dateOfBirth.seconds * 1000).toISOString().split('T')[0]) : 
      ''
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updates: any = {
        name: name.trim()
      };

      if (dateOfBirth) {
        updates.dateOfBirth = new Date(dateOfBirth);
      }

      await updateDoc(doc(db, 'people', student.id), updates);

      const updatedStudent = { 
        ...student, 
        name: name.trim(),
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined
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
    </div>
  );
};

export default StudentEdit;