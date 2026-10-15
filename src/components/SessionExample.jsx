import React, { useState, useEffect } from 'react';
import { sessionApi } from '../store/AppContext';

/**
 * Example component demonstrating externalized session management
 * using Azure Cache for Redis via API calls
 */
export default function SessionExample() {
  const [session, setSession] = useState({ userId: null, token: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load session on component mount
  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      setLoading(true);
      const sessionData = await sessionApi.getSession();
      setSession(sessionData);
      setError(null);
    } catch (err) {
      setError('Failed to load session');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      // Simulate login - in real app, this would come from authentication
      const newSession = {
        userId: 'user-' + Date.now(),
        token: 'token-' + Math.random().toString(36).substring(2)
      };
      
      await sessionApi.setSession(newSession);
      setSession(newSession);
      setError(null);
    } catch (err) {
      setError('Failed to save session');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await sessionApi.clearSession();
      setSession({ userId: null, token: null });
      setError(null);
    } catch (err) {
      setError('Failed to clear session');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Loading session...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>Session Management Example</h2>
      <p style={{ color: '#666' }}>
        Session state is now stored in Azure Cache for Redis, enabling stateless horizontal scaling.
      </p>
      
      {error && (
        <div style={{ color: 'red', padding: '10px', backgroundColor: '#fee', marginBottom: '10px' }}>
          {error}
        </div>
      )}
      
      <div style={{ backgroundColor: '#f5f5f5', padding: '15px', marginBottom: '20px' }}>
        <h3>Current Session:</h3>
        <pre>{JSON.stringify(session, null, 2)}</pre>
      </div>
      
      <div>
        {!session.userId ? (
          <button 
            onClick={handleLogin}
            style={{ padding: '10px 20px', marginRight: '10px', cursor: 'pointer' }}
          >
            Login (Create Session)
          </button>
        ) : (
          <>
            <button 
              onClick={handleLogout}
              style={{ padding: '10px 20px', marginRight: '10px', cursor: 'pointer' }}
            >
              Logout (Clear Session)
            </button>
            <button 
              onClick={loadSession}
              style={{ padding: '10px 20px', cursor: 'pointer' }}
            >
              Refresh Session
            </button>
          </>
        )}
      </div>
      
      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#e8f4f8', borderLeft: '4px solid #0066cc' }}>
        <h4>How it works:</h4>
        <ul>
          <li>Session data is stored in Azure Cache for Redis, not in browser memory</li>
          <li>Each pod replica can access the same session data</li>
          <li>Sessions persist across pod restarts and scaling events</li>
          <li>Redis credentials are injected via Azure Key Vault CSI driver</li>
          <li>Session IDs are stored in HttpOnly cookies for security</li>
        </ul>
      </div>
    </div>
  );
}
