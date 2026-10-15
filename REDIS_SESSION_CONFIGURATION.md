# Redis Session Storage Configuration for EKS

## Overview
This application uses Amazon ElastiCache Redis for externalized session storage, enabling stateless operation and horizontal scaling in Kubernetes/EKS environments.

## Architecture
- **Frontend (React)**: Communicates with backend API for session operations
- **Backend (Java)**: Handles Redis operations via ElastiCache
- **Redis (ElastiCache)**: Centralized session storage accessible by all pods

## Kubernetes Configuration

### 1. ConfigMap for Redis Connection
Create a ConfigMap with Redis connection details:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: redis-config
  namespace: default
data:
  REDIS_HOST: "your-elasticache-endpoint.cache.amazonaws.com"
  REDIS_PORT: "6379"
  REDIS_DB: "0"
  REDIS_SSL_ENABLED: "true"
```

### 2. Secret for Redis Authentication
Create a Secret for Redis password (if authentication is enabled):

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: redis-secret
  namespace: default
type: Opaque
data:
  REDIS_PASSWORD: <base64-encoded-password>
```

### 3. Deployment Configuration
Reference ConfigMap and Secret in your deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: react-app
spec:
  replicas: 3  # Multiple replicas enabled by stateless design
  template:
    spec:
      containers:
      - name: app
        image: your-app-image:latest
        env:
        - name: BACKEND_URL
          value: "http://backend-service:8080"
        envFrom:
        - configMapRef:
            name: redis-config
        - secretRef:
            name: redis-secret
```

## Backend Implementation Requirements

The backend service must implement the following REST API endpoints for session management:

### GET /api/session/{key}
Retrieve session data from Redis.

**Response:**
```json
{
  "key": "user_session",
  "value": {
    "userId": "12345",
    "token": "abc123",
    "timestamp": 1234567890
  }
}
```

### POST /api/session
Store session data in Redis.

**Request:**
```json
{
  "key": "user_session",
  "value": {
    "userId": "12345",
    "token": "abc123"
  },
  "ttl": 3600
}
```

### DELETE /api/session/{key}
Delete session data from Redis.

### PUT /api/session/{key}/refresh
Refresh session TTL.

**Request:**
```json
{
  "ttl": 3600
}
```

## ElastiCache Setup

### 1. Create ElastiCache Redis Cluster
```bash
aws elasticache create-replication-group \
  --replication-group-id my-redis-cluster \
  --replication-group-description "Session storage for EKS" \
  --engine redis \
  --cache-node-type cache.t3.micro \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token <your-auth-token>
```

### 2. Security Group Configuration
Ensure EKS worker nodes can access ElastiCache:
- Allow inbound traffic on port 6379 from EKS security group
- Enable VPC peering if ElastiCache is in different VPC

### 3. Get ElastiCache Endpoint
```bash
aws elasticache describe-replication-groups \
  --replication-group-id my-redis-cluster \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address'
```

## Usage in React Components

### Using the Session Hook
```javascript
import { useSession } from './store/AppContext';

function MyComponent() {
  const session = useSession();
  
  // Set user session
  const handleLogin = async (userId, token) => {
    await session.setUserSession(userId, token);
  };
  
  // Get user session
  const handleGetSession = async () => {
    const userData = await session.getUserSession();
    console.log(userData);
  };
  
  // Clear session
  const handleLogout = async () => {
    await session.clearUserSession();
  };
  
  return (
    <div>
      <button onClick={() => handleLogin('user123', 'token456')}>Login</button>
      <button onClick={handleGetSession}>Get Session</button>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
```

### Using SessionProvider
Wrap your app with SessionProvider:

```javascript
import { SessionProvider } from './store/AppContext';

function App() {
  return (
    <SessionProvider>
      <YourAppComponents />
    </SessionProvider>
  );
}
```

## Benefits

1. **Stateless Pods**: Session data stored externally, pods can be replaced without data loss
2. **Horizontal Scaling**: Multiple replicas share same session store
3. **High Availability**: ElastiCache provides automatic failover
4. **Session Persistence**: Sessions survive pod restarts and deployments
5. **Cross-Pod Sessions**: Users maintain session across different pod instances

## Monitoring

Monitor Redis performance and session metrics:
```bash
# CloudWatch metrics to monitor
- CPUUtilization
- DatabaseMemoryUsagePercentage
- CurrConnections
- Evictions
- CacheHits
- CacheMisses
```

## Troubleshooting

### Connection Issues
1. Verify security group rules allow traffic from EKS
2. Check VPC configuration and subnet routing
3. Verify ElastiCache endpoint in ConfigMap
4. Check pod logs for connection errors

### Session Not Persisting
1. Verify backend API is correctly storing in Redis
2. Check TTL configuration (default: 3600 seconds)
3. Monitor Redis memory usage and eviction policy
4. Verify Redis authentication credentials

### Performance Issues
1. Monitor Redis CPU and memory usage
2. Consider scaling ElastiCache node type
3. Enable Redis cluster mode for better distribution
4. Implement connection pooling in backend
