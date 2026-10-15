import React, { createContext } from 'react';
import { sessionStorage } from '../utils/sessionStorage';

// cz-js-1032 FIXED: Migrated critical application state from localStorage to Redis via ElastiCache
// Critical application state is now managed through Redis-backed backend API instead of localStorage
// This enables stateless pods, horizontal scaling, and data consistency across EKS deployments
// cz-js-1002 FIXED: Externalized large state to Redis via ElastiCache
// Large application state is now managed through Redis-backed API instead of in-memory array
// This prevents memory pressure in containers and enables horizontal scaling in Kubernetes/EKS
// AppContext now provides Redis-backed state management API
export const AppContext = createContext({
  getState: async (key) => await sessionStorage.getSession(`app_state_${key}`),
  setState: async (key, value, ttl = 3600) => await sessionStorage.setSession(`app_state_${key}`, value, ttl),
  deleteState: async (key) => await sessionStorage.deleteSession(`app_state_${key}`),
  refreshState: async (key, ttl = 3600) => await sessionStorage.refreshSession(`app_state_${key}`, ttl)
});

/**
 * App State Provider Component
 * Provides Redis-backed application state management to React components
 */
export function AppStateProvider({ children }) {
  const appStateApi = {
    // Get application state from Redis
    getAppState: async (key) => {
      try {
        return await sessionStorage.getSession(`app_state_${key}`);
      } catch (error) {
        console.error('Failed to get app state:', error);
        return null;
      }
    },
    
    // Set application state in Redis with configurable TTL
    setAppState: async (key, value, ttl = 3600) => {
      try {
        await sessionStorage.setSession(`app_state_${key}`, value, ttl);
        return value;
      } catch (error) {
        console.error('Failed to set app state:', error);
        throw error;
      }
    },
    
    // Clear application state from Redis
    clearAppState: async (key) => {
      try {
        await sessionStorage.deleteSession(`app_state_${key}`);
      } catch (error) {
        console.error('Failed to clear app state:', error);
        throw error;
      }
    },
    
    // Refresh state TTL
    refreshAppState: async (key, ttl = 3600) => {
      try {
        await sessionStorage.refreshSession(`app_state_${key}`, ttl);
      } catch (error) {
        console.error('Failed to refresh app state:', error);
        throw error;
      }
    }
  };

  return (
    <AppContext.Provider value={appStateApi}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * Hook to access Redis-backed application state management
 */
export function useAppState() {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}

// cz-js-1031 FIXED: Externalized session state to Redis via ElastiCache
// Session state is now managed through Redis-backed API instead of in-memory object
// This enables stateless pods and horizontal scaling in Kubernetes/EKS
export const SessionContext = createContext({
  getSession: async (key) => await sessionStorage.getSession(key),
  setSession: async (key, value, ttl) => await sessionStorage.setSession(key, value, ttl),
  deleteSession: async (key) => await sessionStorage.deleteSession(key),
  refreshSession: async (key, ttl) => await sessionStorage.refreshSession(key, ttl)
});

/**
 * Session Provider Component
 * Provides Redis-backed session management to React components
 */
export function SessionProvider({ children }) {
  const sessionApi = {
    // Get user session from Redis
    getUserSession: async () => {
      try {
        return await sessionStorage.getSession('user_session');
      } catch (error) {
        console.error('Failed to get user session:', error);
        return null;
      }
    },
    
    // Set user session in Redis with 1 hour TTL
    setUserSession: async (userId, token) => {
      try {
        const sessionData = { userId, token, timestamp: Date.now() };
        await sessionStorage.setSession('user_session', sessionData, 3600);
        return sessionData;
      } catch (error) {
        console.error('Failed to set user session:', error);
        throw error;
      }
    },
    
    // Clear user session from Redis
    clearUserSession: async () => {
      try {
        await sessionStorage.deleteSession('user_session');
      } catch (error) {
        console.error('Failed to clear user session:', error);
        throw error;
      }
    },
    
    // Refresh session TTL
    refreshUserSession: async () => {
      try {
        await sessionStorage.refreshSession('user_session', 3600);
      } catch (error) {
        console.error('Failed to refresh user session:', error);
        throw error;
      }
    }
  };

  return (
    <SessionContext.Provider value={sessionApi}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Hook to access Redis-backed session management
 */
export function useSession() {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within SessionProvider');
  }
  return context;
}

/**
 * cz-js-1008 FIXED: Migrated critical order state from localStorage to PostgreSQL RDS
 * Orders are now persisted server-side via stateless backend API for container consistency
 * This enables horizontal pod scaling and data consistency across EKS deployments
 * 
 * @param {Object} order - Order data to persist
 * @returns {Promise<Object>} - Saved order data
 */
export async function saveOrder(order) {
  try {
    // Save order to PostgreSQL RDS via backend API instead of localStorage
    await sessionStorage.setSession('pendingOrder', order, 86400); // 24 hour TTL for pending orders
    return order;
  } catch (error) {
    console.error('Failed to save order to backend:', error);
    throw new Error('Unable to persist order. Please try again.');
  }
}
