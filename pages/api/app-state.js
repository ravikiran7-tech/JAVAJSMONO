/**
 * pages/api/app-state.js
 *
 * Server-side API route for externalizing large application state to
 * Google Cloud Memorystore for Redis on GKE Autopilot.
 *
 * Replaces the previous pattern of allocating large arrays (e.g. new Array(1_000_000))
 * inside the React/Next.js container, which caused OOM kills under Kubernetes resource
 * limits and prevented horizontal pod scaling.
 *
 * Redis connection parameters are injected at pod startup via GKE Workload Identity
 * and Secret Manager so that no credentials are bundled into the container image:
 *
 *   REDIS_HOST            - Memorystore Redis host (resolved via Workload Identity /
 *                           Secret Manager at pod startup)
 *   REDIS_PORT            - Memorystore Redis port (default: 6379)
 *   REDIS_PASSWORD        - Redis AUTH password (injected by Secret Manager)
 *   APP_STATE_TTL_SECONDS - Key TTL in seconds (default: 3600)
 *
 * Supported methods:
 *   POST   { stateKey, stateValue, ttl? }  -> stores state slice in Redis
 *   GET    ?stateKey=<key>                 -> retrieves state slice from Redis
 *   DELETE ?stateKey=<key>                 -> removes state slice from Redis
 */

import { createClient } from 'redis';

// ---------------------------------------------------------------------------
// Redis client (lazy singleton – one instance per serverless function container)
// ---------------------------------------------------------------------------
let redisClient = null;

async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT || '6379';
  const password = process.env.REDIS_PASSWORD;

  if (!host) {
    throw new Error(
      'REDIS_HOST environment variable is not set. ' +
      'Configure it via GKE Workload Identity / Secret Manager.'
    );
  }

  redisClient = createClient({
    socket: {
      host,
      port: parseInt(port, 10),
      tls: false, // Memorystore for Redis on private VPC does not require TLS by default
    },
    ...(password ? { password } : {}),
  });

  redisClient.on('error', (err) => {
    console.error('[Redis] app-state client error:', err);
  });

  await redisClient.connect();
  return redisClient;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  const DEFAULT_TTL = parseInt(process.env.APP_STATE_TTL_SECONDS || '3600', 10);

  try {
    const client = await getRedisClient();

    if (req.method === 'POST') {
      // -----------------------------------------------------------------------
      // Store a state slice in Redis
      // -----------------------------------------------------------------------
      const { stateKey, stateValue, ttl } = req.body;

      if (!stateKey) {
        return res.status(400).json({ error: 'stateKey is required' });
      }

      const key = `app-state:${stateKey}`;
      const expiry = typeof ttl === 'number' && ttl > 0 ? ttl : DEFAULT_TTL;

      await client.set(key, JSON.stringify(stateValue), { EX: expiry });

      return res.status(200).json({ status: 'saved', stateKey });

    } else if (req.method === 'GET') {
      // -----------------------------------------------------------------------
      // Retrieve a state slice from Redis
      // -----------------------------------------------------------------------
      const { stateKey } = req.query;

      if (!stateKey) {
        return res.status(400).json({ error: 'stateKey query parameter is required' });
      }

      const key = `app-state:${stateKey}`;
      const raw = await client.get(key);

      if (raw === null) {
        return res.status(404).json({ stateValue: null });
      }

      return res.status(200).json({ stateValue: JSON.parse(raw) });

    } else if (req.method === 'DELETE') {
      // -----------------------------------------------------------------------
      // Remove a state slice from Redis
      // -----------------------------------------------------------------------
      const { stateKey } = req.query;

      if (!stateKey) {
        return res.status(400).json({ error: 'stateKey query parameter is required' });
      }

      const key = `app-state:${stateKey}`;
      await client.del(key);

      return res.status(200).json({ status: 'deleted', stateKey });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }

  } catch (err) {
    console.error('[app-state API] Error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
