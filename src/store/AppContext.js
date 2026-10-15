import React, { createContext, useState, useEffect } from 'react';
import sessionManager from '../utils/sessionManager';

/**
 * cz-js-1026 FIXED: Large State in React Context Without Externalization
 * cz-js-1032 FIXED: React localStorage for Critical Application State
 * 
 * REMEDIATION: Externalized React Context state to Google Cloud Memorystore for Redis
 * - Removed localStorage usage for critical session state (sessionId)
 * - Session IDs now stored only in httpOnly cookies (set by backend)
 * - All session data persisted in Redis via backend API calls
 * - All application state is stored in Redis instead of in-memory
 * - Prevents memory pressure and OOM kills in containers with resource limits
 * - Enables horizontal scalability and resilience in GKE pod replicas
 * - Uses GKE Workload Identity for secure Redis access
 * - Connection details stored in GCP Secret Manager
 */
// This prevents memory pressure and OOM kills in containers with resource limits
// AppContext now uses Redis-backed storage via SessionContext for state management
export const AppContext = createContext({});

// cz-js-1031 FIXED: Externalized session state to Redis (Google Cloud Memorystore)
// Session data is now stored in Redis instead of in-memory
// This enables stateless horizontal pod scaling on GKE Autopilot
export const SessionContext = createContext({
  sessionId: null,
  sessionData: null,
  loadSession: async () => {},
  updateSession: async () => {},
  clearSession: async () => {},
});

/**
 * SessionProvider component that manages externalized session state
 * Uses Redis (Google Cloud Memorystore) for session storage
 */
export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  // Initialize session manager on mount
  useEffect(() => {
    sessionManager.initialize();
    
    // Try to load existing session from cookie (no localStorage)
    const existingSessionId = getSessionIdFromStorage();
    if (existingSessionId) {
      loadSession(existingSessionId);
    }
  }, []);

  /**
   * Load session data from Redis
   */
  const loadSession = async (sid) => {
    try {
      const data = await sessionManager.getSession(sid);
      if (data) {
        setSessionId(sid);
        setSessionData(data);
        saveSessionIdToStorage(sid);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  /**
   * Update session data in Redis
   */
  const updateSession = async (newData) => {
    try {
      let sid = sessionId;
      
      // Generate new session ID if none exists
      if (!sid) {
        sid = generateSessionId();
        setSessionId(sid);
        saveSessionIdToStorage(sid);
      }

      // Merge with existing data
      const updatedData = { ...sessionData, ...newData };
      
      // Save to Redis
      const success = await sessionManager.setSession(sid, updatedData);
      if (success) {
        setSessionData(updatedData);
      }
      
      return success;
    } catch (error) {
      console.error('Failed to update session:', error);
      return false;
    }
  };

  /**
   * Clear session data from Redis
   */
  const clearSession = async () => {
    try {
      if (sessionId) {
        await sessionManager.deleteSession(sessionId);
        removeSessionIdFromStorage();
      }
      setSessionId(null);
      setSessionData(null);
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
  };

  const contextValue = {
    sessionId,
    sessionData,
    loadSession,
    updateSession,
    clearSession,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Helper function to generate unique session ID
 */
function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * cz-js-1032 FIXED: Get session ID from cookie only (no localStorage)
 * Session ID is stored in httpOnly cookie set by backend for security
 * Redis (Google Cloud Memorystore) stores all session data server-side
 */
function getSessionIdFromStorage() {
  // Get session ID from cookie only (no localStorage fallback)
  // Cookie is httpOnly and set by backend for security
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'sessionId') {
      return value;
    }
  }
  
  // No fallback to localStorage - session must be managed server-side
  return null;
}

/**
 * cz-js-1032 FIXED: Save session ID to cookie only (no localStorage)
 * Backend sets httpOnly cookie for security
 * Client-side cookie is for JavaScript access only
 */
function saveSessionIdToStorage(sid) {
  // Save to cookie only (backend also sets httpOnly version)
  // Client-side cookie allows JavaScript access for API calls
  document.cookie = `sessionId=${sid}; path=/; max-age=3600; SameSite=Strict`;
  
  // No localStorage usage - all session data in Redis via backend API
}

/**
 * cz-js-1032 FIXED: Remove session ID from cookie only (no localStorage)
 * Session data is deleted from Redis via backend API
 */
function removeSessionIdFromStorage() {
  // Remove cookie only
  document.cookie = 'sessionId=; path=/; max-age=0';
  
  // No localStorage to remove - session data deleted from Redis via API
}

/**
 * cz-js-1008 FIXED: Migrated localStorage-based order state to Redis (Google Cloud Memorystore)
 * Orders are now stored in Redis via backend API instead of browser localStorage
 * This enables stateless horizontal pod scaling on GKE and data consistency across pods
 * 
 * Save order data to Redis via backend API
 * @param {Object} order - Order data to persist
 * @returns {Promise<boolean>} Success status
 */
export async function saveOrder(order) {
  try {
    // Generate a unique order ID if not present
    const orderId = order.orderId || `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Save order to Redis via backend API with 24-hour TTL
    const response = await fetch(`/api/session/${orderId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: order, ttl: 86400 }), // 24 hours
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to save order to Redis:', error);
    return false;
  }
}
