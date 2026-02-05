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
      <svg width="120" height="120" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginBottom: '20px' }}>
        <path d="M14 43L40 19L66 43V67C66 70.3137 63.3137 73 60 73H20C16.6863 73 14 70.3137 14 67V43Z" fill="#F59E0B"/>
        <path d="M8 45L40 15L72 45" stroke="#D97706" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        <circle cx="40" cy="53" r="16" fill="white"/>
        <path d="M32 53L38 59L50 47" stroke="#16A34A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      <h1 style={{ 
        fontSize: '36px', 
        fontWeight: '700',
        margin: '0 0 10px 0',
        fontFamily: 'Trebuchet MS, sans-serif'
      }}>
        <span style={{ color: '#92400E' }}>Homeschool</span>{' '}
        <span style={{ color: '#16A34A' }}>Done</span>
      </h1>
      <p style={{ fontSize: '18px', color: '#666', marginBottom: '30px' }}>Track your homeschool progress</p>
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