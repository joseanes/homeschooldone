import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import { updateLastLogin } from './utils/activityTracking';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user ? user.email : 'No user');
      setUser(user);
      
      // Update last login timestamp when user logs in
      if (user) {
        await updateLastLogin(user);
      }
      
      setLoading(false);
    });

    // Clean up the listener
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <div className="App">
      <header style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '10px 20px',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center'
      }}>
        <div>
          <span style={{ marginRight: '10px' }}>{user.email}</span>
          <button onClick={() => auth.signOut()}>Sign Out</button>
        </div>
      </header>
      <Dashboard user={user} />
    </div>
  );
}

export default App;
