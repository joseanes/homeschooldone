import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Homeschool } from '../types';

interface HomeschoolSwitcherProps {
  user: User;
  currentHomeschool: Homeschool;
  onHomeschoolChange: (homeschool: Homeschool) => void;
  onClose: () => void;
}

const HomeschoolSwitcher: React.FC<HomeschoolSwitcherProps> = ({
  user,
  currentHomeschool,
  onHomeschoolChange,
  onClose
}) => {
  const [homeschools, setHomeschools] = useState<Homeschool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newHomeschoolName, setNewHomeschoolName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUserHomeschools();
  }, [user.uid]);

  const fetchUserHomeschools = async () => {
    try {
      const q = query(
        collection(db, 'homeschools'),
        where('parentIds', 'array-contains', user.uid)
      );
      const snapshot = await getDocs(q);
      const homeschoolList = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Homeschool));
      
      setHomeschools(homeschoolList);
    } catch (error) {
      console.error('Error fetching homeschools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHomeschool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHomeschoolName.trim()) return;

    setCreating(true);
    try {
      const newHomeschool = {
        name: newHomeschoolName.trim(),
        parentIds: [user.uid],
        tutorIds: [],
        observerIds: [],
        studentIds: [],
        createdBy: user.uid,
        createdAt: new Date()
      };

      const docRef = await addDoc(collection(db, 'homeschools'), newHomeschool);
      const createdHomeschool = { ...newHomeschool, id: docRef.id };
      
      setHomeschools([...homeschools, createdHomeschool]);
      onHomeschoolChange(createdHomeschool);
      onClose();
    } catch (error) {
      console.error('Error creating homeschool:', error);
      alert('Error creating homeschool. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '8px',
        padding: '20px',
        minWidth: '250px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 1000
      }}>
        Loading homeschools...
      </div>
    );
  }

  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      right: 0,
      backgroundColor: 'white',
      border: '1px solid #ccc',
      borderRadius: '8px',
      padding: '20px',
      minWidth: '300px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 1000
    }}>
      <h3 style={{ margin: '0 0 15px 0' }}>Switch Homeschool</h3>
      
      {homeschools.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666' }}>
            Your Homeschools:
          </h4>
          {homeschools.map(homeschool => (
            <button
              key={homeschool.id}
              onClick={() => {
                onHomeschoolChange(homeschool);
                onClose();
              }}
              disabled={homeschool.id === currentHomeschool.id}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 15px',
                marginBottom: '8px',
                textAlign: 'left',
                backgroundColor: homeschool.id === currentHomeschool.id ? '#e3f2fd' : 'white',
                border: `1px solid ${homeschool.id === currentHomeschool.id ? '#2196f3' : '#ddd'}`,
                borderRadius: '4px',
                cursor: homeschool.id === currentHomeschool.id ? 'default' : 'pointer',
                fontSize: '14px'
              }}
            >
              {homeschool.name}
              {homeschool.id === currentHomeschool.id && (
                <span style={{ color: '#2196f3', fontWeight: 'bold', marginLeft: '8px' }}>
                  (Current)
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
        {!showCreateForm ? (
          <button
            onClick={() => setShowCreateForm(true)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            + Create New Homeschool
          </button>
        ) : (
          <form onSubmit={handleCreateHomeschool}>
            <input
              type="text"
              value={newHomeschoolName}
              onChange={(e) => setNewHomeschoolName(e.target.value)}
              placeholder="Homeschool name..."
              required
              style={{
                width: '100%',
                padding: '8px',
                marginBottom: '10px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="submit"
                disabled={creating || !newHomeschoolName.trim()}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#4285f4',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: creating ? 'not-allowed' : 'pointer',
                  fontSize: '12px'
                }}
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewHomeschoolName('');
                }}
                style={{
                  flex: 1,
                  padding: '8px',
                  backgroundColor: '#666',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          backgroundColor: 'transparent',
          border: 'none',
          fontSize: '18px',
          cursor: 'pointer',
          color: '#666'
        }}
      >
        ×
      </button>
    </div>
  );
};

export default HomeschoolSwitcher;