import React from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../firebase';

const TestFirestore: React.FC = () => {
  const testConnection = async () => {
    console.log('Testing Firestore connection...');
    try {
      const testDoc = {
        test: true,
        timestamp: new Date().toISOString()
      };
      console.log('Creating test document...');
      const docRef = await addDoc(collection(db, 'test'), testDoc);
      console.log('Test document created with ID:', docRef.id);
      alert('Firestore is working! Check console for details.');
    } catch (error: any) {
      console.error('Firestore test failed:', error);
      alert(`Firestore test failed: ${error.message}`);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h3>Firestore Connection Test</h3>
      <button onClick={testConnection}>Test Firestore</button>
    </div>
  );
};

export default TestFirestore;