import React from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';

const Login: React.FC = () => {
  const handleGoogleSignIn = async () => {
    console.log('Starting Google sign in...');
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      console.log('User signed in successfully:', result.user.email);
    } catch (error: any) {
      console.error('Error signing in:', error);
      alert(`Error signing in: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh' 
    }}>
      <h1>HomeschoolDone</h1>
      <p>Track your homeschool progress</p>
      <button 
        onClick={handleGoogleSignIn}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: '#4285f4',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Sign in with Google
      </button>
    </div>
  );
};

export default Login;