/**
 * pages/api/session.js
 *
 * Server-side session API route for GKE Autopilot / GCP Memorystore for Redis.
 *
 * Redis connection parameters are injected via environment variables so that
 * credentials are never bundled into the client-side bundle:
 *
 *   REDIS_HOST            - Memorystore Redis host (resolved via GKE Workload Identity
 *                           / Secret Manager at pod startup)
 *   REDIS_PORT            - Memorystore Redis port (default: 6379)
 *   REDIS_PASSWORD        - Redis AUTH password (injected by Secret Manager)
 *   SESSION_TTL_SECONDS   - Key TTL in seconds (default: 3600)
 *
 * Supported methods:
 *   POST  { sessionId, sessionData, ttl? }  -> stores session in Redis
 *   GET   ?sessionId=<id>                   -> retrieves session from Redis
 *   DELETE ?sessionId=<id>                  -> removes session from Redis
 */

import { createClient } from 'redis';

// ---------------------------------------------------------------------------
// Redis client (lazy singleton – created once per serverless function instance)
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
    console.error('[Redis] Client error:', err);
  });

  await redisClient.connect();
  return redisClient;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export default async function handler(req, res) {
  const DEFAULT_TTL = parseInt(process.env.SESSION_TTL_SECONDS || '3600', 10);

  try {
    const client = await getRedisClient();

    if (req.method === 'POST') {
      // -----------------------------------------------------------------------
      // Store session data in Redis
      // -----------------------------------------------------------------------
      const { sessionId, sessionData, ttl } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      const key = `session:${sessionId}`;
      const expiry = typeof ttl === 'number' && ttl > 0 ? ttl : DEFAULT_TTL;

      await client.set(key, JSON.stringify(sessionData), { EX: expiry });

      return res.status(200).json({ status: 'saved', sessionId });

    } else if (req.method === 'GET') {
      // -----------------------------------------------------------------------
      // Retrieve session data from Redis
      // -----------------------------------------------------------------------
      const { sessionId } = req.query;

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId query parameter is required' });
      }

      const key = `session:${sessionId}`;
      const raw = await client.get(key);

      if (raw === null) {
        return res.status(404).json({ sessionData: null });
      }

      return res.status(200).json({ sessionData: JSON.parse(raw) });

    } else if (req.method === 'DELETE') {
      // -----------------------------------------------------------------------
      // Remove session data from Redis
      // -----------------------------------------------------------------------
      const { sessionId } = req.query;

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId query parameter is required' });
      }

      const key = `session:${sessionId}`;
      await client.del(key);

      return res.status(200).json({ status: 'deleted', sessionId });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
      return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }

  } catch (err) {
    console.error('[session API] Error:', err);
    return res.status(500).json({ error: 'Internal server error', detail: err.message });
  }
}
