# Redis Session Management for GKE Autopilot

## Overview

This application has been configured to use externalized session storage with Google Cloud Memorystore for Redis, enabling stateless horizontal pod scaling on GKE Autopilot.

## Architecture

### Session Storage Flow
1. **Frontend (React)**: Uses `SessionContext` and `sessionManager` to interact with sessions
2. **Backend API**: Next.js API routes (`/api/session/*`) handle Redis operations
3. **Redis**: Google Cloud Memorystore for Redis stores session data

### Key Components

#### Frontend
- **`src/store/AppContext.js`**: Provides `SessionContext` and `SessionProvider` for React components
- **`src/utils/sessionManager.js`**: Client-side session manager that communicates with backend API

#### Backend
- **`pages/api/session/[sessionId].js`**: Handles GET, POST, DELETE operations for sessions
- **`pages/api/session/[sessionId]/refresh.js`**: Handles session TTL refresh

## GKE Deployment Configuration

### 1. Create Google Cloud Memorystore for Redis

```bash
# Create Redis instance in the same region as your GKE cluster
gcloud redis instances create session-store \
  --size=1 \
  --region=us-central1 \
  --redis-version=redis_6_x \
  --tier=basic

# Get the Redis host and port
gcloud redis instances describe session-store \
  --region=us-central1 \
  --format="value(host,port)"
```

### 2. Configure GKE Workload Identity

```bash
# Create a service account for the application
gcloud iam service-accounts create gke-app-sa \
  --display-name="GKE Application Service Account"

# Grant Secret Manager access
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:gke-app-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Bind Kubernetes service account to Google service account
gcloud iam service-accounts add-iam-policy-binding \
  gke-app-sa@PROJECT_ID.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:PROJECT_ID.svc.id.goog[NAMESPACE/KSA_NAME]"
```

### 3. Store Redis Credentials in Secret Manager

```bash
# Create secret for Redis password (if authentication is enabled)
echo -n "YOUR_REDIS_PASSWORD" | gcloud secrets create redis-password \
  --data-file=- \
  --replication-policy="automatic"

# Grant access to the service account
gcloud secrets add-iam-policy-binding redis-password \
  --member="serviceAccount:gke-app-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 4. Kubernetes Deployment Configuration

Update your Kubernetes deployment YAML:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: react-app
spec:
  replicas: 3  # Horizontal scaling enabled
  selector:
    matchLabels:
      app: react-app
  template:
    metadata:
      labels:
        app: react-app
    spec:
      serviceAccountName: gke-app-ksa  # Kubernetes service account
      containers:
      - name: app
        image: gcr.io/PROJECT_ID/react-app:latest
        env:
        - name: REDIS_HOST
          value: "10.0.0.3"  # Replace with your Redis instance IP
        - name: REDIS_PORT
          value: "6379"
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: password
        ports:
        - containerPort: 3000
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### 5. Create Kubernetes Secret for Redis

```bash
# Create secret from Secret Manager
kubectl create secret generic redis-credentials \
  --from-literal=password="YOUR_REDIS_PASSWORD"
```

## Environment Variables

The following environment variables must be configured in your GKE deployment:

| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_HOST` | Redis instance host IP | `10.0.0.3` |
| `REDIS_PORT` | Redis instance port | `6379` |
| `REDIS_PASSWORD` | Redis authentication password | `<from Secret Manager>` |

## Usage in React Components

### Using SessionContext

```javascript
import React, { useContext, useEffect } from 'react';
import { SessionContext } from './store/AppContext';

function MyComponent() {
  const { sessionData, updateSession, clearSession } = useContext(SessionContext);

  useEffect(() => {
    // Load user data into session
    updateSession({ userId: '123', username: 'john' });
  }, []);

  const handleLogout = async () => {
    await clearSession();
  };

  return (
    <div>
      <p>User: {sessionData?.username}</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
```

## Benefits

1. **Stateless Pods**: Session data is externalized, allowing any pod to handle any request
2. **Horizontal Scaling**: Add/remove pods without losing session data
3. **High Availability**: Redis replication ensures session data persistence
4. **Pod Replacement**: Seamless pod restarts and updates without session loss
5. **Load Balancing**: No need for session affinity/sticky sessions

## Production Considerations

### Redis Client Implementation

The current implementation includes placeholder Redis operations. For production deployment, install and configure a Redis client:

```bash
npm install ioredis
```

Update the API routes to use the actual Redis client:

```javascript
const Redis = require('ioredis');

const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  tls: {
    rejectUnauthorized: false  // Required for Cloud Memorystore
  },
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});
```

### Session Security

1. **Use HTTPS**: Ensure all communication is encrypted
2. **HttpOnly Cookies**: Set session cookies as HttpOnly to prevent XSS attacks
3. **Secure Flag**: Enable Secure flag for cookies in production
4. **CSRF Protection**: Implement CSRF tokens for session operations
5. **Session Rotation**: Rotate session IDs after authentication

### Monitoring

Monitor Redis performance and session metrics:

```bash
# View Redis metrics in Cloud Console
gcloud redis instances describe session-store \
  --region=us-central1

# Set up Cloud Monitoring alerts for:
# - Redis memory usage
# - Connection count
# - Operation latency
# - Error rate
```

## Troubleshooting

### Connection Issues

If pods cannot connect to Redis:

1. Verify Redis instance is in the same VPC as GKE cluster
2. Check firewall rules allow traffic from GKE nodes to Redis
3. Verify environment variables are correctly set
4. Check pod logs: `kubectl logs <pod-name>`

### Session Not Persisting

1. Verify Redis is running: `gcloud redis instances list`
2. Check API endpoint logs for errors
3. Verify session TTL is appropriate (default: 3600 seconds)
4. Test Redis connectivity from a pod

## References

- [Google Cloud Memorystore for Redis](https://cloud.google.com/memorystore/docs/redis)
- [GKE Workload Identity](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)
- [Secret Manager](https://cloud.google.com/secret-manager/docs)
- [GKE Autopilot](https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview)
