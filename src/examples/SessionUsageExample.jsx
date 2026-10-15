import React, { useContext, useEffect, useState } from 'react';
import { SessionContext, SessionProvider } from '../store/AppContext';

/**
 * Example component demonstrating Redis-backed session usage
 * This replaces the old in-memory session pattern
 */
function UserProfile() {
  const { sessionData, updateSession, clearSession } = useContext(SessionContext);
  const [loading, setLoading] = useState(false);

  // Example: Load user data on component mount
  useEffect(() => {
    if (!sessionData?.userId) {
      // Session not initialized, could redirect to login
      console.log('No active session');
    }
  }, [sessionData]);

  // Example: Login function that creates a session
  const handleLogin = async (userId, token) => {
    setLoading(true);
    try {
      // Store session data in Redis
      await updateSession({
        userId: userId,
        token: token,
        loginTime: new Date().toISOString(),
        preferences: {
          theme: 'dark',
          language: 'en'
        }
      });
      console.log('Session created successfully');
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // Example: Update user preferences in session
  const updatePreferences = async (newPreferences) => {
    setLoading(true);
    try {
      await updateSession({
        ...sessionData,
        preferences: {
          ...sessionData.preferences,
          ...newPreferences
        }
      });
      console.log('Preferences updated');
    } catch (error) {
      console.error('Failed to update preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  // Example: Logout function that clears session
  const handleLogout = async () => {
    setLoading(true);
    try {
      await clearSession();
      console.log('Session cleared successfully');
      // Redirect to login page
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!sessionData?.userId) {
    return (
      <div>
        <h2>Please Login</h2>
        <button onClick={() => handleLogin('user123', 'token-abc-xyz')}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2>User Profile</h2>
      <p>User ID: {sessionData.userId}</p>
      <p>Login Time: {sessionData.loginTime}</p>
      <p>Theme: {sessionData.preferences?.theme}</p>
      <p>Language: {sessionData.preferences?.language}</p>
      
      <button onClick={() => updatePreferences({ theme: 'light' })}>
        Switch to Light Theme
      </button>
      
      <button onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}

/**
 * App component wrapped with SessionProvider
 * This is how you should structure your app to use Redis sessions
 */
function App() {
  return (
    <SessionProvider>
      <div className="app">
        <h1>My Application</h1>
        <UserProfile />
      </div>
    </SessionProvider>
  );
}

export default App;

/**
 * MIGRATION GUIDE: From In-Memory to Redis Sessions
 * 
 * OLD PATTERN (In-Memory - NOT SCALABLE):
 * ----------------------------------------
 * import { session } from './store/AppContext';
 * 
 * // Direct mutation of in-memory object
 * session.userId = '123';
 * session.token = 'abc';
 * 
 * // Reading from in-memory object
 * console.log(session.userId);
 * 
 * 
 * NEW PATTERN (Redis - SCALABLE):
 * --------------------------------
 * import { SessionContext } from './store/AppContext';
 * 
 * function MyComponent() {
 *   const { sessionData, updateSession, clearSession } = useContext(SessionContext);
 *   
 *   // Async update to Redis
 *   await updateSession({ userId: '123', token: 'abc' });
 *   
 *   // Reading from Redis-backed state
 *   console.log(sessionData?.userId);
 *   
 *   // Clear session
 *   await clearSession();
 * }
 * 
 * 
 * KEY DIFFERENCES:
 * ----------------
 * 1. All operations are now ASYNC (use await)
 * 2. Use React Context hooks instead of direct object access
 * 3. Session data is automatically synced across all pods
 * 4. Sessions persist across pod restarts and scaling events
 * 5. No need for session affinity/sticky sessions in load balancer
 * 
 * 
 * BENEFITS FOR KUBERNETES:
 * ------------------------
 * ✓ Stateless pods - any pod can handle any request
 * ✓ Horizontal scaling - add/remove pods freely
 * ✓ Rolling updates - zero downtime deployments
 * ✓ High availability - Redis replication ensures data persistence
 * ✓ Load balancing - no sticky sessions required
 */
