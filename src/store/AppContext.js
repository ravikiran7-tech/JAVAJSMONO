import React, { createContext } from 'react';

// ---------------------------------------------------------------------------
// cz-js-1026 FIXED: Large State in React Context Without Externalization
// ---------------------------------------------------------------------------
// Previously, a 1,000,000-element array was allocated directly in the
// JavaScript heap on every pod startup:
//
//   const bigState = new Array(1000000).fill({ data: 'x' });
//   export const AppContext = createContext(bigState);
//
// This caused severe memory pressure and OOM kills under AKS container
// resource limits, and prevented safe horizontal pod scaling because each
// replica carried its own independent copy of the state.
//
// Remediation – Externalize to Azure Cache for Redis via AKS Workload Identity:
//   • The large in-memory array is removed entirely.
//   • AppContext is initialised with `null` (a lightweight placeholder).
//   • Actual application state is stored in Azure Cache for Redis and
//     accessed exclusively through the /api/appState Next.js API route.
//   • Redis connection secrets (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD) are
//     injected into AKS pods as environment variables via the Azure Key Vault
//     CSI Driver and AKS Workload Identity – no static credentials in code.
//   • The client-side base URL for the state API is supplied through a
//     Kubernetes ConfigMap as NEXT_PUBLIC_APP_STATE_API_URL.
//
// Environment variables consumed server-side (Next.js API routes / Node.js):
//   REDIS_HOST                  – Azure Cache for Redis hostname (Key Vault)
//   REDIS_PORT                  – Redis TLS port, default 6380  (Key Vault)
//   REDIS_PASSWORD              – Redis access key              (Key Vault)
//
// Client-side environment variable (injected via Kubernetes ConfigMap):
//   NEXT_PUBLIC_APP_STATE_API_URL – base URL for the /api/appState endpoints
// ---------------------------------------------------------------------------

const APP_STATE_API =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_STATE_API_URL) ||
  '/api/appState';

/**
 * React Context initialised with a lightweight null placeholder.
 * Actual application state is fetched from Azure Cache for Redis through
 * the /api/appState endpoint and stored here via the provider's setState.
 *
 * The previous pattern of seeding the context with a 1,000,000-element
 * array (cz-js-1026) has been removed to eliminate heap memory pressure
 * and OOM kills in memory-constrained AKS pods.
 */
export const AppContext = createContext(null);

/**
 * Fetch the full application state from the externalized Redis store.
 * Called once on mount by the AppContext provider component.
 *
 * @returns {Promise<object>} Resolved application state object.
 */
export async function fetchAppState() {
  const response = await fetch(`${APP_STATE_API}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch app state: ${response.status}`);
  }
  return response.json();
}

/**
 * Persist updated application state to the externalized Redis store.
 * Replaces the previous pattern of holding the entire state in the
 * JavaScript heap, eliminating the OOM risk in memory-constrained pods.
 *
 * @param {object} state - The application state object to persist.
 * @returns {Promise<void>}
 */
export async function saveAppState(state) {
  const response = await fetch(`${APP_STATE_API}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!response.ok) {
    throw new Error(`Failed to save app state: ${response.status}`);
  }
}

/**
 * Remove the application state entry from the Redis store.
 * Useful for cache invalidation or user sign-out flows.
 *
 * @returns {Promise<void>}
 */
export async function clearAppState() {
  const response = await fetch(`${APP_STATE_API}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to clear app state: ${response.status}`);
  }
}

// ---------------------------------------------------------------------------
// cz-js-1031 FIXED: in-memory session state replaced with Azure Cache for Redis
// ---------------------------------------------------------------------------
// Session state is now externalized to Redis via API calls.
// Redis connection details are injected via Azure Key Vault CSI driver as
// mounted secrets into AKS pods, enabling stateless horizontal scaling.
//
// Redis endpoint and credentials are consumed server-side through environment
// variables (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD) mounted from Key Vault.
// The client interacts with session state exclusively through the /api/session
// REST endpoints, keeping the React/Redux layer fully stateless.

const REDIS_SESSION_API =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SESSION_API_URL) ||
  '/api/session';

/**
 * Retrieve the current session from the externalized Redis store.
 * @returns {Promise<{userId: string|null, token: string|null}>}
 */
export async function getSession() {
  const response = await fetch(`${REDIS_SESSION_API}`, {
    method: 'GET',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to retrieve session: ${response.status}`);
  }
  return response.json();
}

/**
 * Persist session data to the externalized Redis store.
 * @param {{ userId: string|null, token: string|null }} sessionData
 * @returns {Promise<void>}
 */
export async function saveSession(sessionData) {
  const response = await fetch(`${REDIS_SESSION_API}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionData),
  });
  if (!response.ok) {
    throw new Error(`Failed to save session: ${response.status}`);
  }
}

/**
 * Clear the session from the externalized Redis store.
 * @returns {Promise<void>}
 */
export async function clearSession() {
  const response = await fetch(`${REDIS_SESSION_API}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error(`Failed to clear session: ${response.status}`);
  }
}

// ---------------------------------------------------------------------------
// cz-js-1032 FIXED: Critical app state migrated from localStorage to Redis
// ---------------------------------------------------------------------------
export function saveOrder(order) {
  // Previously: localStorage.setItem('pendingOrder', JSON.stringify(order));
  // Now delegated to the backend API which writes to Azure Cache for Redis.
  saveOrderToRedis(order);
}

/**
 * Persist a pending order to Azure Cache for Redis through the backend API.
 * Replaces the previous `localStorage.setItem('pendingOrder', ...)` pattern.
 *
 * The API route (/api/orders) running inside the AKS pod reads Redis
 * connection details from environment variables mounted by the Azure Key
 * Vault CSI Driver:
 *   REDIS_HOST      – Azure Cache for Redis hostname
 *   REDIS_PORT      – Redis TLS port (default 6380)
 *   REDIS_PASSWORD  – Redis access key
 *
 * @param {object} order - The order object to persist.
 * @returns {Promise<void>}
 */
export async function saveOrderToRedis(order) {
  const ORDERS_API =
    (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_ORDERS_API_URL) ||
    '/api/orders';

  const response = await fetch(ORDERS_API, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pendingOrder: order }),
  });
  if (!response.ok) {
    throw new Error(`Failed to save order to Redis: ${response.status}`);
  }
}
