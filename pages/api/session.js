// Session API endpoint for Azure Cache for Redis integration
// This endpoint manages session state externally in Redis for stateless horizontal scaling
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

// Session TTL in seconds (default 24 hours)
const SESSION_TTL = parseInt(process.env.SESSION_TTL || '86400', 10);

export default async function handler(req, res) {
  try {
    // Extract session ID from cookie or generate new one
    const sessionId = req.cookies?.sessionId || generateSessionId();
    const sessionKey = `session:${sessionId}`;

    if (req.method === 'GET') {
      // Retrieve session from Redis
      const sessionData = await redisClient.get(sessionKey);
      
      if (sessionData) {
        res.status(200).json(JSON.parse(sessionData));
      } else {
        // Return empty session if not found
        res.status(200).json({ userId: null, token: null });
      }
    } else if (req.method === 'POST') {
      // Save session to Redis
      const sessionData = req.body;
      await redisClient.setEx(sessionKey, SESSION_TTL, JSON.stringify(sessionData));
      
      // Set session cookie
      res.setHeader('Set-Cookie', `sessionId=${sessionId}; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL}`);
      res.status(200).json({ success: true, sessionId });
    } else if (req.method === 'DELETE') {
      // Clear session from Redis
      await redisClient.del(sessionKey);
      
      // Clear session cookie
      res.setHeader('Set-Cookie', 'sessionId=; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      res.status(200).json({ success: true });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Session API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function generateSessionId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}
