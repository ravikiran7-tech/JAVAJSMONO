// Session manager using Redis for externalized session storage
// Connects to Google Cloud Memorystore for Redis on GKE Autopilot

class SessionManager {
  constructor() {
    // Redis connection configuration from environment variables
    this.redisHost = window.__ENV__?.REDIS_HOST || 'localhost';
    this.redisPort = window.__ENV__?.REDIS_PORT || '6379';
    this.redisPassword = window.__ENV__?.REDIS_PASSWORD;
    this.sessionPrefix = 'session:';
    this.defaultTTL = 3600; // 1 hour default session TTL
  }

  /**
   * Initialize session manager with Redis connection
   * In production, this connects to Google Cloud Memorystore for Redis
   * using GKE Workload Identity for authentication
   */
  async initialize() {
    // Connection will be established via backend API
    // Frontend communicates with backend API which manages Redis connection
    this.initialized = true;
  }

  /**
   * Get session data from Redis via backend API
   * @param {string} sessionId - Session identifier
   * @returns {Promise<Object|null>} Session data or null if not found
   */
  async getSession(sessionId) {
    if (!sessionId) return null;
    
    try {
      const response = await fetch(`/api/session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (error) {
      console.error('Error fetching session from Redis:', error);
      return null;
    }
  }

  /**
   * Set session data in Redis via backend API
   * @param {string} sessionId - Session identifier
   * @param {Object} sessionData - Session data to store
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} Success status
   */
  async setSession(sessionId, sessionData, ttl = this.defaultTTL) {
    if (!sessionId) return false;
    
    try {
      const response = await fetch(`/api/session/${sessionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: sessionData,
          ttl: ttl,
        }),
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error setting session in Redis:', error);
      return false;
    }
  }

  /**
   * Delete session from Redis via backend API
   * @param {string} sessionId - Session identifier
   * @returns {Promise<boolean>} Success status
   */
  async deleteSession(sessionId) {
    if (!sessionId) return false;
    
    try {
      const response = await fetch(`/api/session/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error deleting session from Redis:', error);
      return false;
    }
  }

  /**
   * Update session TTL in Redis via backend API
   * @param {string} sessionId - Session identifier
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} Success status
   */
  async refreshSession(sessionId, ttl = this.defaultTTL) {
    if (!sessionId) return false;
    
    try {
      const response = await fetch(`/api/session/${sessionId}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl }),
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error refreshing session in Redis:', error);
      return false;
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
export default sessionManager;
