import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './firebase';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PublicDashboard from './components/PublicDashboard';
import { updateLastLogin } from './utils/activityTracking';
import { isValidPublicDashboardId } from './utils/publicDashboard';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if we're on a public dashboard route
  const currentPath = window.location.pathname;
  const publicDashboardMatch = currentPath.match(/^\/dashboard\/([a-zA-Z0-9]{8})$/);
  const isPublicDashboard = publicDashboardMatch && isValidPublicDashboardId(publicDashboardMatch[1]);

  useEffect(() => {
    // Skip authentication for public dashboards
    if (isPublicDashboard) {
      setLoading(false);
      return;
    }
    
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Update last login timestamp when user logs in
      if (user) {
        await updateLastLogin(user);
      }
      
      setLoading(false);
    });

    // Clean up the listener
    return () => unsubscribe();
  }, [isPublicDashboard]);

  if (loading) {
    return <div>Loading...</div>;
  }

  // Render public dashboard if this is a public route
  if (isPublicDashboard) {
    const publicId = publicDashboardMatch![1];
    return <PublicDashboard publicId={publicId} />;
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
      <Dashboard user={user} onSignOut={() => auth.signOut()} />
    </div>
  );
}

export default App;
