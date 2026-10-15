import React, { createContext } from 'react';

// cz-js-1026 FIXED: Externalized large state to Azure Cache for Redis
// Large application state is now managed via API calls to backend Redis service
// instead of in-memory storage, enabling stateless horizontal scaling in AKS
export const stateApi = {
  async getState(key) {
    try {
      const response = await fetch(`/api/state?key=${encodeURIComponent(key)}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch state');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching state:', error);
      return null;
    }
  },

  async setState(key, value) {
    try {
      const response = await fetch('/api/state', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key, value })
      });
      if (!response.ok) {
        throw new Error('Failed to save state');
      }
      return await response.json();
    } catch (error) {
      console.error('Error saving state:', error);
      throw error;
    }
  },

  async deleteState(key) {
    try {
      const response = await fetch(`/api/state?key=${encodeURIComponent(key)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to delete state');
      }
      return await response.json();
    } catch (error) {
      console.error('Error deleting state:', error);
      throw error;
    }
  }
};

// Empty context for backward compatibility - actual state managed via stateApi
export const AppContext = createContext({});

// cz-js-1031 FIXED: Externalized session state to Azure Cache for Redis
// Session state is now managed via API calls to backend Redis service
// instead of in-memory storage, enabling stateless horizontal scaling
export const sessionApi = {
  async getSession() {
    try {
      const response = await fetch('/api/session', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch session');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching session:', error);
      return { userId: null, token: null };
    }
  },

  async setSession(sessionData) {
    try {
      const response = await fetch('/api/session', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(sessionData)
      });
      if (!response.ok) {
        throw new Error('Failed to save session');
      }
      return await response.json();
    } catch (error) {
      console.error('Error saving session:', error);
      throw error;
    }
  },

  async clearSession() {
    try {
      const response = await fetch('/api/session', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to clear session');
      }
      return await response.json();
    } catch (error) {
      console.error('Error clearing session:', error);
      throw error;
    }
  }
};

// cz-js-1032 FIXED: Migrated localStorage-based critical state to Azure Cache for Redis
// Order state is now managed via backend API calls to Redis service on AKS
// using Workload Identity and Azure Key Vault CSI Driver for secure credential injection
export const orderApi = {
  async saveOrder(order) {
    try {
      const response = await fetch('/api/state', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ key: 'pendingOrder', value: order })
      });
      if (!response.ok) {
        throw new Error('Failed to save order');
      }
      return await response.json();
    } catch (error) {
      console.error('Error saving order:', error);
      throw error;
    }
  },

  async getOrder() {
    try {
      const response = await fetch(`/api/state?key=pendingOrder`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch order');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching order:', error);
      return null;
    }
  }
};

// Backward compatibility wrapper - delegates to orderApi
export function saveOrder(order) {
  return orderApi.saveOrder(order);
}
