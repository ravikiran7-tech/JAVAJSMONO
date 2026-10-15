# Azure Cache for Redis State & Session Management

## Overview
This application has been configured to use Azure Cache for Redis for both application state and session management, enabling stateless horizontal scaling in AKS (Azure Kubernetes Service).

## Architecture
- **Frontend**: React Context API calls backend state and session API endpoints
- **Backend**: Next.js API routes manage Redis connections
- **Storage**: Azure Cache for Redis stores state and session data externally
- **Security**: Redis credentials injected via Azure Key Vault CSI driver

## Required Environment Variables

The following environment variables must be configured in your AKS deployment:

### Redis Connection
```bash
REDIS_HOST=<your-azure-redis-cache>.redis.cache.windows.net
REDIS_PORT=6380
REDIS_PASSWORD=<injected-from-key-vault>
REDIS_DB=0
```

### State & Session Configuration
```bash
SESSION_TTL=86400   # Session timeout in seconds (default: 24 hours)
STATE_TTL=604800    # Application state timeout in seconds (default: 7 days)
```

## Azure Key Vault CSI Driver Setup

### 1. Install CSI Driver
```bash
helm repo add csi-secrets-store-provider-azure https://azure.github.io/secrets-store-csi-driver-provider-azure/charts
helm install csi csi-secrets-store-provider-azure/csi-secrets-store-provider-azure
```

### 2. Create SecretProviderClass
```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: azure-redis-secrets
spec:
  provider: azure
  parameters:
    usePodIdentity: "false"
    useVMManagedIdentity: "true"
    userAssignedIdentityID: "<your-managed-identity-client-id>"
    keyvaultName: "<your-key-vault-name>"
    objects: |
      array:
        - |
          objectName: redis-password
          objectType: secret
          objectVersion: ""
    tenantId: "<your-tenant-id>"
  secretObjects:
  - secretName: redis-credentials
    type: Opaque
    data:
    - objectName: redis-password
      key: REDIS_PASSWORD
```

### 3. Update Deployment to Mount Secrets
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: react-nextjs-app
spec:
  template:
    spec:
      containers:
      - name: app
        image: <your-image>
        env:
        - name: REDIS_HOST
          value: "<your-redis>.redis.cache.windows.net"
        - name: REDIS_PORT
          value: "6380"
        - name: REDIS_DB
          value: "0"
        - name: STATE_TTL
          value: "604800"
        - name: SESSION_TTL
          value: "86400"
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: REDIS_PASSWORD
        volumeMounts:
        - name: secrets-store
          mountPath: "/mnt/secrets-store"
          readOnly: true
      volumes:
      - name: secrets-store
        csi:
          driver: secrets-store.csi.k8s.io
          readOnly: true
          volumeAttributes:
            secretProviderClass: "azure-redis-secrets"
```

## State API Usage (cz-js-1002 Fix)

### Get Application State
```javascript
import { stateApi } from './store/AppContext';

const state = await stateApi.getState('myStateKey');
console.log(state);
```

### Set Application State
```javascript
await stateApi.setState('myStateKey', {
  data: 'large application state',
  items: [1, 2, 3, 4, 5]
});
```

### Delete Application State
```javascript
await stateApi.deleteState('myStateKey');
```

## Session API Usage

### Get Session
```javascript
import { sessionApi } from './store/AppContext';

const session = await sessionApi.getSession();
console.log(session.userId, session.token);
```

### Set Session
```javascript
await sessionApi.setSession({
  userId: '12345',
  token: 'abc-xyz-token'
});
```

### Clear Session
```javascript
await sessionApi.clearSession();
```

## Benefits
- **Stateless Pods**: State and session data stored externally, pods can be replaced without data loss
- **Horizontal Scaling**: Multiple pod replicas share state via Redis
- **High Availability**: Azure Cache for Redis provides built-in replication and failover
- **Security**: Credentials managed by Azure Key Vault, not hardcoded
- **Memory Efficiency**: Large application state no longer stored in-memory, preventing OOM kills

## Migration Notes

### Application State (cz-js-1002)
- Previous large in-memory state (`const bigState = new Array(1000000).fill({ data: 'x' })`) has been replaced with API-based state management
- All state reads/writes now go through the `/api/state` endpoint
- State data is automatically expired after STATE_TTL seconds
- Prevents container memory pressure and OOM kills in resource-constrained environments

### Session State (cz-js-1031)
- Previous in-memory session storage (`export const session = { userId: null, token: null }`) has been replaced with API-based session management
- All session reads/writes now go through the `/api/session` endpoint
- Session data is automatically expired after SESSION_TTL seconds
- HttpOnly cookies prevent XSS attacks on session IDs

## API Endpoints

### `/api/state` - Application State Management
- **GET** `/api/state?key=<key>` - Retrieve state by key
- **POST** `/api/state` - Save state (body: `{ key: string, value: any }`)
- **DELETE** `/api/state?key=<key>` - Delete state by key

### `/api/session` - Session Management
- **GET** `/api/session` - Retrieve current session
- **POST** `/api/session` - Save session data
- **DELETE** `/api/session` - Clear session

### `/api/health` - Health Check
- **GET** `/api/health` - Returns `{ status: 'UP' }` for container health checks
