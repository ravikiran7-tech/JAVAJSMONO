import React, { createContext } from 'react';

// cz-js-1026 FIXED: Large in-memory state externalized to Google Cloud Memorystore for Redis
// via GKE Workload Identity and Secret Manager add-on.
//
// Previously (line 4), a large array (new Array(1_000_000).fill({ data: 'x' })) was held
// in process memory and passed directly to React Context:
//
//   const bigState = new Array(1000000).fill({ data: 'x' });
//   export const AppContext = createContext(bigState);
//
// This caused OOM kills under Kubernetes container resource limits and prevented
// horizontal pod scaling because each pod replica held its own independent copy
// of the large state in memory.
//
// Remediation (GKE Workload Identity + Google Cloud Memorystore for Redis):
//   - The large application state is no longer allocated in-memory inside the container.
//   - State is stored in Google Cloud Memorystore for Redis and fetched on demand via
//     the server-side /api/app-state endpoint, keeping pods stateless.
//   - Redis connection parameters are injected at pod startup via GKE Workload Identity
//     and Secret Manager, so no credentials are bundled into the client bundle.
//   - AppContext is initialised with null; components call loadAppState() to hydrate
//     from Redis via the /api/app-state server route.
//
// Required environment variables (injected via GKE Workload Identity / Secret Manager):
//   REDIS_HOST            - Memorystore Redis host
//   REDIS_PORT            - Memorystore Redis port (default: 6379)
//   REDIS_PASSWORD        - Redis AUTH password
//   APP_STATE_TTL_SECONDS - TTL for app-state keys in Redis (default: 3600)

// AppContext is initialised with null (no large array in container memory).
// Components must call loadAppState() to hydrate from Redis via /api/app-state.
export const AppContext = createContext(null);

/**
 * Fetches the application state slice identified by `stateKey` from
 * Google Cloud Memorystore for Redis via the server-side /api/app-state route.
 * Pods remain stateless – no large arrays are allocated in container memory.
 *
 * @param {string} stateKey - Logical key identifying the state slice in Redis
 * @returns {Promise<any|null>} The stored state value, or null if not found
 */
export async function loadAppState(stateKey) {
  const res = await fetch(`/api/app-state?stateKey=${encodeURIComponent(stateKey)}`);
  if (!res.ok) return null;
  const { stateValue } = await res.json();
  return stateValue !== undefined ? stateValue : null;
}

/**
 * Persists an application state slice to Google Cloud Memorystore for Redis
 * via the server-side /api/app-state route.
 * TTL defaults to APP_STATE_TTL_SECONDS env var (server-side) or 3600 s.
 *
 * @param {string} stateKey   - Logical key identifying the state slice in Redis
 * @param {any}    stateValue - Serialisable state value to store
 * @returns {Promise<void>}
 */
export async function saveAppState(stateKey, stateValue) {
  await fetch('/api/app-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stateKey, stateValue }),
  });
}

// cz-js-1031: in-memory session state in context/redux
// Session state is externalized to Google Cloud Memorystore for Redis
// via a stateless API layer. GKE Workload Identity authenticates pods to Secret Manager
// for Redis credential injection, enabling horizontal pod scaling on GKE Autopilot.
//
// Redis connection config is injected via environment variables:
//   REDIS_HOST          - Memorystore Redis host (e.g. from Secret Manager / GKE env)
//   REDIS_PORT          - Memorystore Redis port (default: 6379)
//   REDIS_PASSWORD      - Redis AUTH password (injected by Workload Identity / Secret Manager)
//   SESSION_TTL_SECONDS - TTL for session keys in Redis (default: 3600)

const SESSION_TTL = parseInt(process.env.SESSION_TTL_SECONDS || '3600', 10);

/**
 * Persists a session object to Google Cloud Memorystore for Redis.
 * Calls the server-side /api/session endpoint so that Redis credentials
 * are never exposed to the browser.
 *
 * @param {string} sessionId - Unique session identifier
 * @param {{ userId: string|null, token: string|null }} sessionData - Session payload
 * @returns {Promise<void>}
 */
export async function saveSession(sessionId, sessionData) {
  await fetch('/api/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, sessionData, ttl: SESSION_TTL }),
  });
}

/**
 * Retrieves a session object from Google Cloud Memorystore for Redis.
 * Calls the server-side /api/session endpoint to keep Redis credentials
 * server-side only.
 *
 * @param {string} sessionId - Unique session identifier
 * @returns {Promise<{ userId: string|null, token: string|null }|null>}
 */
export async function getSession(sessionId) {
  const res = await fetch(`/api/session?sessionId=${encodeURIComponent(sessionId)}`);
  if (!res.ok) return null;
  const { sessionData } = await res.json();
  return sessionData || null;
}

// cz-js-1032: critical app state in localStorage
// Critical backend state (pendingOrder) migrated from browser localStorage to
// Google Cloud Memorystore for Redis via GKE Workload Identity.
//
// Previously, saveOrder() wrote the pending order directly to browser localStorage,
// which is client-local and invisible to other pods, preventing horizontal scaling
// and causing data inconsistency in containerised GKE deployments.
//
// Remediation:
//   - localStorage.setItem('pendingOrder', ...) is replaced by a POST to the
//     server-side /api/app-state route, which persists the order in
//     Google Cloud Memorystore for Redis under the key "app-state:pendingOrder".
//   - Redis credentials (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD) are injected at
//     pod startup via GKE Workload Identity and Secret Manager; no credentials are
//     bundled into the client bundle.
//   - All GKE pods share the same Redis instance, so the pending order is visible
//     across replicas and survives pod restarts, enabling stateless horizontal scaling.
//
// Required environment variables (server-side, injected via GKE Workload Identity):
//   REDIS_HOST            - Memorystore Redis host
//   REDIS_PORT            - Memorystore Redis port (default: 6379)
//   REDIS_PASSWORD        - Redis AUTH password
//   APP_STATE_TTL_SECONDS - TTL for order keys in Redis (default: 3600)

/**
 * Persists a pending order to Google Cloud Memorystore for Redis via the
 * server-side /api/app-state route, replacing the previous localStorage pattern.
 * All GKE pods share the same Redis store, enabling stateless horizontal scaling.
 *
 * @param {Object} order - The order object to persist
 * @returns {Promise<void>}
 */
export async function saveOrder(order) {
  await fetch('/api/app-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stateKey: 'pendingOrder', stateValue: order }),
  });
}

/**
 * Retrieves the pending order from Google Cloud Memorystore for Redis via the
 * server-side /api/app-state route.
 *
 * @returns {Promise<Object|null>} The stored order, or null if not found
 */
export async function loadOrder() {
  return loadAppState('pendingOrder');
}
