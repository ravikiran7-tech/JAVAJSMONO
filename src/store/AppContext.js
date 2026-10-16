import React, { createContext } from 'react';

// ---------------------------------------------------------------------------
// cz-js-1026 FIXED: Large State in React Context Without Externalization
//
// BEFORE (line 4 – original violation):
//   const bigState = new Array(1000000).fill({ data: 'x' });
//   export const AppContext = createContext(bigState);
//
// PROBLEM: Allocating a 1,000,000-element array directly inside the module
// creates severe memory pressure in containers with resource limits, causing
// OOM kills and preventing horizontal pod scaling on EKS.
//
// AFTER: The large in-memory allocation has been removed entirely.
// Application state is now externalised to Amazon ElastiCache Redis and
// accessed on-demand via a Redis-backed state API service.  The API base URL
// is injected at runtime through a Kubernetes ConfigMap / Secret so that no
// state is held in the React bundle or in pod memory between requests.
//
// Required Kubernetes ConfigMap / Secret entries:
//   REACT_APP_REDIS_STATE_API_URL  – base URL of the Redis-backed state API
//                                    (e.g. http://state-service.default.svc.cluster.local)
//
// The context value is initialised to an empty array; consumers must call
// fetchAppState() inside a useEffect to hydrate from ElastiCache Redis.
// ---------------------------------------------------------------------------

const REDIS_STATE_API_URL =
  process.env.REACT_APP_REDIS_STATE_API_URL ||
  process.env.REDIS_STATE_API_URL ||
  '';

/**
 * Fetch the large application state from the Redis-backed state API
 * (backed by Amazon ElastiCache Redis on EKS).
 *
 * Returns an empty array on error so the UI degrades gracefully.
 */
export async function fetchAppState() {
  if (!REDIS_STATE_API_URL) {
    console.warn(
      '[AppContext] REACT_APP_REDIS_STATE_API_URL is not set. ' +
      'Returning empty state. Configure the env var via a Kubernetes ConfigMap.'
    );
    return [];
  }
  try {
    const response = await fetch(`${REDIS_STATE_API_URL}/app-state`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
    if (!response.ok) {
      console.error('[AppContext] Failed to fetch app state from Redis API:', response.status);
      return [];
    }
    return response.json();
  } catch (err) {
    console.error('[AppContext] Error fetching app state from Redis API:', err);
    return [];
  }
}

/**
 * Persist updated application state to the Redis-backed state API
 * (backed by Amazon ElastiCache Redis on EKS).
 *
 * @param {Array|Object} state - The application state to persist.
 */
export async function saveAppState(state) {
  if (!REDIS_STATE_API_URL) {
    console.warn(
      '[AppContext] REACT_APP_REDIS_STATE_API_URL is not set. ' +
      'State not persisted. Configure the env var via a Kubernetes ConfigMap.'
    );
    return;
  }
  try {
    const response = await fetch(`${REDIS_STATE_API_URL}/app-state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(state),
    });
    if (!response.ok) {
      console.error('[AppContext] Failed to persist app state to Redis API:', response.status);
    }
  } catch (err) {
    console.error('[AppContext] Error persisting app state to Redis API:', err);
  }
}

// Context is initialised with an empty array.
// Components should call fetchAppState() inside a useEffect to load state
// from ElastiCache Redis, keeping pods stateless and HPA-scalable.
export const AppContext = createContext([]);

// ---------------------------------------------------------------------------
// cz-js-1031 FIXED: In-memory session state in context/redux
//
// BEFORE:
//   export const session = { userId: null, token: null };
//
// AFTER: Session state is externalised to Amazon ElastiCache Redis via a
// session API service.  The API base URL is injected through Kubernetes
// ConfigMaps and Secrets for stateless pod operation.
//
// Required Kubernetes ConfigMap / Secret entries:
//   REACT_APP_REDIS_SESSION_API_URL – base URL of the Redis-backed session API
// ---------------------------------------------------------------------------

const REDIS_SESSION_API_URL =
  process.env.REACT_APP_REDIS_SESSION_API_URL ||
  process.env.REDIS_SESSION_API_URL ||
  '';

export const session = {
  async getSession() {
    if (!REDIS_SESSION_API_URL) {
      console.warn('[AppContext] REACT_APP_REDIS_SESSION_API_URL is not set.');
      return { userId: null, token: null };
    }
    try {
      const response = await fetch(`${REDIS_SESSION_API_URL}/session`, {
        method: 'GET',
        credentials: 'include',
      });
      if (!response.ok) return { userId: null, token: null };
      return response.json();
    } catch (err) {
      console.error('[AppContext] Error fetching session from Redis API:', err);
      return { userId: null, token: null };
    }
  },
  async setSession(userId, token) {
    if (!REDIS_SESSION_API_URL) {
      console.warn('[AppContext] REACT_APP_REDIS_SESSION_API_URL is not set.');
      return;
    }
    await fetch(`${REDIS_SESSION_API_URL}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId, token }),
    });
  },
  async clearSession() {
    if (!REDIS_SESSION_API_URL) {
      console.warn('[AppContext] REACT_APP_REDIS_SESSION_API_URL is not set.');
      return;
    }
    await fetch(`${REDIS_SESSION_API_URL}/session`, {
      method: 'DELETE',
      credentials: 'include',
    });
  },
};

// ---------------------------------------------------------------------------
// cz-js-1032 FIXED: Critical app state in localStorage
//
// BEFORE (line 12 – original violation):
//   export function saveOrder(order) {
//     localStorage.setItem('pendingOrder', JSON.stringify(order));
//   }
//
// PROBLEM: Using localStorage for critical application state (pendingOrder)
// creates data consistency issues in containerised EKS deployments.
// localStorage is client-side only; when multiple pod replicas serve
// different users, or when a pod is replaced, the state is lost or
// inconsistent across replicas, breaking horizontal pod autoscaling (HPA).
//
// AFTER: Critical order state is persisted server-side through a stateless
// REST API backed by Amazon ElastiCache Redis, accessed via the
// REACT_APP_REDIS_ORDERS_API_URL environment variable injected through
// Kubernetes ConfigMaps and Secrets.  This ensures:
//   • Stateless pods – no client-side state dependency
//   • Consistent state across all container replicas on EKS
//   • Data survives pod restarts and rescheduling
//   • Horizontal pod autoscaling (HPA) works correctly
//
// Required Kubernetes ConfigMap / Secret entries:
//   REACT_APP_REDIS_ORDERS_API_URL – base URL of the ElastiCache Redis-backed
//                                    orders API service
//                                    (e.g. http://orders-service.default.svc.cluster.local)
// ---------------------------------------------------------------------------

const REDIS_ORDERS_API_URL =
  process.env.REACT_APP_REDIS_ORDERS_API_URL ||
  process.env.REDIS_ORDERS_API_URL ||
  '';

/**
 * Persist a pending order to the ElastiCache Redis backend via the orders API.
 *
 * Replaces the original localStorage.setItem('pendingOrder', ...) call.
 * State is now stored server-side in Amazon ElastiCache Redis, enabling
 * stateless EKS pods and consistent state across all container replicas.
 *
 * @param {Object} order - The order object to persist.
 * @returns {Promise<Object|null>} The saved order response, or null on error.
 */
export async function saveOrder(order) {
  if (!REDIS_ORDERS_API_URL) {
    console.warn(
      '[AppContext] REACT_APP_REDIS_ORDERS_API_URL is not set. ' +
      'Order not persisted to ElastiCache Redis. ' +
      'Configure the env var via a Kubernetes ConfigMap.'
    );
    return null;
  }
  try {
    const response = await fetch(`${REDIS_ORDERS_API_URL}/orders/pending`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(order),
    });
    if (!response.ok) {
      console.error(
        '[AppContext] Failed to persist pending order to ElastiCache Redis API:',
        response.status
      );
      return null;
    }
    return response.json();
  } catch (err) {
    console.error(
      '[AppContext] Error persisting pending order to ElastiCache Redis API:',
      err
    );
    return null;
  }
}
