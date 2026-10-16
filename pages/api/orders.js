// ---------------------------------------------------------------------------
// cz-js-1032 DEPENDENT CHANGE: /api/orders – Pending Order persistence via
// Azure Cache for Redis (AKS Workload Identity, no static secrets)
// ---------------------------------------------------------------------------
// This Next.js API route replaces the previous client-side
//   localStorage.setItem('pendingOrder', JSON.stringify(order))
// pattern with a server-side write to Azure Cache for Redis.
//
// Redis connection details are injected into the AKS pod as environment
// variables by the Azure Key Vault CSI Driver (Workload Identity):
//
//   REDIS_HOST      – Azure Cache for Redis hostname  (from Key Vault secret)
//   REDIS_PORT      – Redis TLS port, default 6380    (from Key Vault secret)
//   REDIS_PASSWORD  – Redis access key                (from Key Vault secret)
//
// The client calls this route from saveOrderToRedis() in AppContext.js.
// ---------------------------------------------------------------------------

import { createClient } from 'redis';

/**
 * Lazily-initialised Redis client.
 * Re-used across hot-reloads in development; a new connection is established
 * per pod in production (one connection per container replica).
 */
let redisClient = null;

async function getRedisClient() {
  if (redisClient && redisClient.isOpen) {
    return redisClient;
  }

  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT || '6380';
  const password = process.env.REDIS_PASSWORD;

  if (!host || !password) {
    throw new Error(
      'Redis configuration is missing. ' +
      'Ensure REDIS_HOST and REDIS_PASSWORD are set via Azure Key Vault CSI Driver.'
    );
  }

  redisClient = createClient({
    socket: {
      host,
      port: parseInt(port, 10),
      tls: true,
    },
    password,
  });

  redisClient.on('error', (err) => {
    console.error('[orders] Redis client error:', err);
  });

  await redisClient.connect();
  return redisClient;
}

/**
 * POST /api/orders
 *   Body: { pendingOrder: <order object> }
 *   Persists the pending order to Redis under the key `pendingOrder:<userId>`
 *   (falls back to the generic key `pendingOrder` when no session is present).
 *
 * GET /api/orders
 *   Returns the pending order stored in Redis for the current session.
 *
 * DELETE /api/orders
 *   Removes the pending order from Redis.
 */
export default async function handler(req, res) {
  const redisKey = req.headers['x-user-id']
    ? `pendingOrder:${req.headers['x-user-id']}`
    : 'pendingOrder';

  try {
    const client = await getRedisClient();

    if (req.method === 'POST') {
      const { pendingOrder } = req.body;
      if (pendingOrder === undefined) {
        return res.status(400).json({ error: 'pendingOrder is required in the request body.' });
      }
      // Persist to Redis with a 24-hour TTL (86400 seconds)
      await client.set(redisKey, JSON.stringify(pendingOrder), { EX: 86400 });
      return res.status(200).json({ message: 'Pending order saved to Redis.' });
    }

    if (req.method === 'GET') {
      const raw = await client.get(redisKey);
      if (raw === null) {
        return res.status(404).json({ error: 'No pending order found.' });
      }
      return res.status(200).json({ pendingOrder: JSON.parse(raw) });
    }

    if (req.method === 'DELETE') {
      await client.del(redisKey);
      return res.status(200).json({ message: 'Pending order removed from Redis.' });
    }

    return res.status(405).json({ error: `Method ${req.method} not allowed.` });
  } catch (err) {
    console.error('[orders] Handler error:', err);
    return res.status(500).json({ error: 'Internal server error while accessing Redis.' });
  }
}
