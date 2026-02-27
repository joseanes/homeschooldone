import React, { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';

const Login: React.FC = () => {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Error signing in:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
        alert(`Error signing in: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isCreatingAccount) {
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error('Error:', error);
      switch (error.code) {
        case 'auth/user-not-found':
          setError('No account found with this email');
          break;
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Incorrect email or password');
          break;
        case 'auth/email-already-in-use':
          setError('An account with this email already exists');
          break;
        case 'auth/invalid-email':
          setError('Invalid email address');
          break;
        case 'auth/too-many-requests':
          setError('Too many attempts. Please try again later');
          break;
        default:
          setError(error.message || 'An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Password reset email sent to ${email}`);
      setError('');
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        setError('No account found with this email');
      } else {
        setError(error.message || 'Error sending reset email');
      }
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

      {!showEmailForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <button
            onClick={handleGoogleSignIn}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#4285f4',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '260px'
            }}
          >
            Sign in with Google
          </button>
          <button
            onClick={() => setShowEmailForm(true)}
            style={{
              padding: '10px 20px',
              fontSize: '16px',
              backgroundColor: '#333',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              width: '260px'
            }}
          >
            Sign in with Email
          </button>
        </div>
      ) : (
        <div style={{ width: '300px' }}>
          <form onSubmit={handleEmailSignIn}>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                style={{
                  width: '100%',
                  padding: '10px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            {isCreatingAccount && (
              <div style={{ marginBottom: '12px' }}>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  required
                  style={{
                    width: '100%',
                    padding: '10px',
                    fontSize: '16px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            )}

            {error && (
              <div style={{ color: '#dc3545', fontSize: '14px', marginBottom: '12px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '16px',
                backgroundColor: loading ? '#999' : '#333',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '12px'
              }}
            >
              {loading ? 'Please wait...' : isCreatingAccount ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {!isCreatingAccount && (
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <button
                onClick={handleForgotPassword}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4285f4',
                  cursor: 'pointer',
                  fontSize: '14px',
                  textDecoration: 'underline'
                }}
              >
                Forgot Password?
              </button>
            </div>
          )}

          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <button
              onClick={() => { setIsCreatingAccount(!isCreatingAccount); setError(''); setConfirmPassword(''); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#4285f4',
                cursor: 'pointer',
                fontSize: '14px',
                textDecoration: 'underline'
              }}
            >
              {isCreatingAccount ? 'Already have an account? Sign In' : 'Create a new account'}
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => { setShowEmailForm(false); setError(''); setEmail(''); setPassword(''); setConfirmPassword(''); setIsCreatingAccount(false); }}
              style={{
                background: 'none',
                border: 'none',
                color: '#666',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Back to sign in options
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;