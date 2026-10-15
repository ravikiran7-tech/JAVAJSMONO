/**
 * Redis-backed session storage utility for containerized React applications.
 * Externalizes session state to Amazon ElastiCache Redis for stateless operation
 * and horizontal scaling in Kubernetes/EKS environments.
 * 
 * Configuration is injected via Kubernetes ConfigMaps/Secrets through environment variables.
 */

/**
 * Session storage API that communicates with backend Redis service.
 * The backend service handles actual Redis operations.
 */
class RedisSessionStorage {
  constructor() {
    // Redis connection details injected via Kubernetes ConfigMaps/Secrets
    this.backendUrl = window.__ENV__.BACKEND_URL;
    this.sessionEndpoint = `${this.backendUrl}/api/session`;
  }

  /**
   * Get session data from Redis via backend API
   * @param {string} key - Session key
   * @returns {Promise<any>} - Session data
   */
  async getSession(key) {
    try {
      const response = await fetch(`${this.sessionEndpoint}/${key}`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Session not found
        }
        throw new Error(`Failed to get session: ${response.statusText}`);
      }

      const data = await response.json();
      return data.value;
    } catch (error) {
      console.error('Error getting session from Redis:', error);
      throw error;
    }
  }

  /**
   * Set session data in Redis via backend API
   * @param {string} key - Session key
   * @param {any} value - Session data to store
   * @param {number} ttl - Time to live in seconds (default: 3600)
   * @returns {Promise<void>}
   */
  async setSession(key, value, ttl = 3600) {
    try {
      const response = await fetch(this.sessionEndpoint, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          key,
          value,
          ttl
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to set session: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error setting session in Redis:', error);
      throw error;
    }
  }

  /**
   * Delete session data from Redis via backend API
   * @param {string} key - Session key
   * @returns {Promise<void>}
   */
  async deleteSession(key) {
    try {
      const response = await fetch(`${this.sessionEndpoint}/${key}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to delete session: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error deleting session from Redis:', error);
      throw error;
    }
  }

  /**
   * Update session TTL (refresh session expiration)
   * @param {string} key - Session key
   * @param {number} ttl - New time to live in seconds
   * @returns {Promise<void>}
   */
  async refreshSession(key, ttl = 3600) {
    try {
      const response = await fetch(`${this.sessionEndpoint}/${key}/refresh`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ttl })
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh session: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error refreshing session in Redis:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const sessionStorage = new RedisSessionStorage();

/**
 * React Hook for managing Redis-backed session state
 * @param {string} sessionKey - Unique session key
 * @param {any} initialValue - Initial value if session doesn't exist
 * @returns {[any, Function, Function]} - [sessionData, setSessionData, clearSession]
 */
export function useRedisSession(sessionKey, initialValue = null) {
  const [sessionData, setSessionDataState] = React.useState(initialValue);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(null);

  // Load session on mount
  React.useEffect(() => {
    async function loadSession() {
      try {
        setLoading(true);
        const data = await sessionStorage.getSession(sessionKey);
        if (data !== null) {
          setSessionDataState(data);
        }
        setError(null);
      } catch (err) {
        setError(err);
        console.error('Failed to load session:', err);
      } finally {
        setLoading(false);
      }
    }

    loadSession();
  }, [sessionKey]);

  // Update session in Redis
  const setSessionData = React.useCallback(async (value) => {
    try {
      await sessionStorage.setSession(sessionKey, value);
      setSessionDataState(value);
      setError(null);
    } catch (err) {
      setError(err);
      console.error('Failed to update session:', err);
      throw err;
    }
  }, [sessionKey]);

  // Clear session from Redis
  const clearSession = React.useCallback(async () => {
    try {
      await sessionStorage.deleteSession(sessionKey);
      setSessionDataState(initialValue);
      setError(null);
    } catch (err) {
      setError(err);
      console.error('Failed to clear session:', err);
      throw err;
    }
  }, [sessionKey, initialValue]);

  return [sessionData, setSessionData, clearSession, { loading, error }];
}

export default sessionStorage;
