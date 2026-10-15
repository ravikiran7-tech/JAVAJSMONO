// State API endpoint for Azure Cache for Redis integration
// This endpoint manages large application state externally in Redis for stateless horizontal scaling
// Redis connection details are injected via Azure Key Vault CSI driver as environment variables

const redis = require('redis');

// Redis client configuration using environment variables
// These should be injected by Azure Key Vault CSI driver in AKS
const redisClient = redis.createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10)
  },
  password: process.env.REDIS_PASSWORD,
  database: parseInt(process.env.REDIS_DB || '0', 10)
});

// Connect to Redis
redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().catch(console.error);

// State TTL in seconds (default 7 days for application state)
const STATE_TTL = parseInt(process.env.STATE_TTL || '604800', 10);

export default async function handler(req, res) {
  try {
    const { key } = req.query;
    const stateKey = `appstate:${key}`;

    if (req.method === 'GET') {
      // Retrieve state from Redis
      if (!key) {
        return res.status(400).json({ error: 'Key parameter is required' });
      }

      const stateData = await redisClient.get(stateKey);
      
      if (stateData) {
        res.status(200).json(JSON.parse(stateData));
      } else {
        // Return null if not found
        res.status(200).json(null);
      }
    } else if (req.method === 'POST') {
      // Save state to Redis
      const { key: bodyKey, value } = req.body;
      
      if (!bodyKey) {
        return res.status(400).json({ error: 'Key is required' });
      }

      const stateKeyPost = `appstate:${bodyKey}`;
      await redisClient.setEx(stateKeyPost, STATE_TTL, JSON.stringify(value));
      
      res.status(200).json({ success: true, key: bodyKey });
    } else if (req.method === 'DELETE') {
      // Delete state from Redis
      if (!key) {
        return res.status(400).json({ error: 'Key parameter is required' });
      }

      await redisClient.del(stateKey);
      res.status(200).json({ success: true });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('State API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
