# Deployment Guide – react-nextjs-host on GCP GKE

## Overview

This guide covers building, pushing, and deploying the **react-nextjs-host** Java application to **Google Kubernetes Engine (GKE)**.

| Property | Value |
|---|---|
| Application | react-nextjs-host |
| Language | Java 17 |
| Build Tool | Maven 3.9.x |
| Packaging | JAR |
| Runtime Image | amazoncorretto:17 |
| Application Port | 8080 |
| Health Endpoint | `/api/health` |
| Target Platform | GCP GKE |

---

## Prerequisites

### Local Tools Required

| Tool | Version | Install |
|---|---|---|
| Docker | 24+ | https://docs.docker.com/get-docker/ |
| gcloud CLI | Latest | https://cloud.google.com/sdk/docs/install |
| kubectl | 1.28+ | `gcloud components install kubectl` |
| Java JDK | 17+ | https://aws.amazon.com/corretto/ |
| Maven | 3.9+ | https://maven.apache.org/download.cgi |

### GCP Requirements

- Active GCP project with billing enabled
- GKE cluster created and running
- Google Artifact Registry repository (if using GAR)
- IAM roles: `roles/container.developer`, `roles/artifactregistry.writer`

---

## Project Structure

```
GCP_MONO1CMP/
├── Dockerfile                  # Multi-stage build (builder + amazoncorretto:17 runtime)
├── .dockerignore               # Excludes target/, .git/, mvnw, etc.
├── docker-compose.yml          # Local development (application only)
├── pom.xml                     # Maven build descriptor
├── src/
│   └── main/java/com/trianz/reactnextjs/
│       ├── Application.java    # Main entry point (port 8080)
│       ├── controller/HealthController.java
│       └── service/HealthService.java
├── kubernetes/
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
├── scripts/
│   ├── build-push.sh           # Linux/macOS build & push
│   ├── build-push.bat          # Windows build & push
│   ├── deploy-image.sh         # Linux/macOS GKE deploy
│   └── deploy-image.bat        # Windows GKE deploy
└── docs/
    └── DEPLOYMENT.md           # This file
```

---

## Local Development with Docker Compose

### 1. Build and run locally

```bash
# Build the image and start the container
docker-compose up --build

# Run in background
docker-compose up --build -d

# View logs
docker-compose logs -f react-nextjs-host

# Stop
docker-compose down
```

### 2. Verify the application

```bash
# Health check
curl http://localhost:8080/api/health
# Expected: {"status":"UP"}
```

---

## Build and Push Docker Image

### Linux / macOS

```bash
# Make the script executable
chmod +x scripts/build-push.sh

# Run from project root
./scripts/build-push.sh
```

The script will prompt you to:
1. Choose registry type (Google Artifact Registry or Docker Hub)
2. Enter registry credentials and details
3. Enter an image tag (defaults to `latest`)

### Windows

```cmd
scripts\build-push.bat
```

### Manual Build (Google Artifact Registry)

```bash
# Authenticate
gcloud auth configure-docker us-central1-docker.pkg.dev

# Build
docker build -t us-central1-docker.pkg.dev/MY_PROJECT/MY_REPO/react-nextjs-host:latest .

# Push
docker push us-central1-docker.pkg.dev/MY_PROJECT/MY_REPO/react-nextjs-host:latest
```

---

## GCP GKE Deployment

### Step 1: Set up GCP Authentication

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
```

### Step 2: Create a GKE Cluster (if not already created)

```bash
gcloud container clusters create react-nextjs-host-cluster \
  --zone us-central1-a \
  --num-nodes 2 \
  --machine-type e2-standard-2 \
  --project YOUR_GCP_PROJECT_ID
```

### Step 3: Configure kubectl

```bash
gcloud container clusters get-credentials react-nextjs-host-cluster \
  --zone us-central1-a \
  --project YOUR_GCP_PROJECT_ID
```

### Step 4: Deploy using the script

#### Linux / macOS

```bash
chmod +x scripts/deploy-image.sh
./scripts/deploy-image.sh
```

#### Windows

```cmd
scripts\deploy-image.bat
```

The script will prompt for:
- GCP Project ID
- GCP Zone
- GKE Cluster Name
- Full Docker image URI

### Step 5: Manual Kubernetes Deployment

If you prefer to deploy manually:

```bash
# 1. Update the image URI in deployment.yaml
sed -i 's|{{IMAGE_URI}}|YOUR_FULL_IMAGE_URI|g' kubernetes/deployment.yaml

# 2. Apply manifests in order
kubectl apply -f kubernetes/namespace.yaml
kubectl apply -f kubernetes/deployment.yaml
kubectl apply -f kubernetes/service.yaml
kubectl apply -f kubernetes/ingress.yaml

# 3. Wait for rollout
kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host

# 4. Verify
kubectl get pods,svc,ingress -n react-nextjs-host
```

---

## Kubernetes Manifest Descriptions

### namespace.yaml
Creates the `react-nextjs-host` namespace to isolate all application resources.

### deployment.yaml
- **Replicas**: 2 (high availability)
- **Image**: Pulled from `{{IMAGE_URI}}` (replaced at deploy time)
- **Resources**: requests: 250m CPU / 512Mi RAM; limits: 500m CPU / 1Gi RAM
- **Liveness Probe**: `GET /api/health` on port 8080 (initial delay: 30s)
- **Readiness Probe**: `GET /api/health` on port 8080 (initial delay: 20s)
- **JVM Flags**: `-Xmx512m -Xms256m -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0`

### service.yaml
- **Type**: ClusterIP (internal cluster access)
- **Port mapping**: 80 → 8080

### ingress.yaml
- **Class**: `gce` (GKE native HTTP(S) Load Balancer)
- **Host**: `react-nextjs-host.example.com` (update to your domain)
- **Path**: `/` → `react-nextjs-host-service:80`

---

## Scaling and Management

### Scale replicas

```bash
kubectl scale deployment react-nextjs-host --replicas=3 -n react-nextjs-host
```

### Rolling update (new image)

```bash
kubectl set image deployment/react-nextjs-host \
  react-nextjs-host=NEW_IMAGE_URI \
  -n react-nextjs-host

kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host
```

### Rollback

```bash
kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host
```

### Horizontal Pod Autoscaler

```bash
kubectl autoscale deployment react-nextjs-host \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n react-nextjs-host
```

---

## Troubleshooting

### Pods not starting

```bash
# Check pod status
kubectl get pods -n react-nextjs-host

# Describe a failing pod
kubectl describe pod <POD_NAME> -n react-nextjs-host

# View pod logs
kubectl logs <POD_NAME> -n react-nextjs-host
kubectl logs <POD_NAME> -n react-nextjs-host --previous
```

### Health check failures

```bash
# Verify the health endpoint is reachable inside the pod
kubectl exec -it <POD_NAME> -n react-nextjs-host -- \
  java -cp app.jar com.trianz.reactnextjs.Application &

# Or port-forward and test locally
kubectl port-forward pod/<POD_NAME> 8080:8080 -n react-nextjs-host
curl http://localhost:8080/api/health
```

### Image pull errors

```bash
# Verify image exists in registry
gcloud artifacts docker images list us-central1-docker.pkg.dev/MY_PROJECT/MY_REPO

# Check imagePullSecrets if using private registry
kubectl get secrets -n react-nextjs-host
```

### Ingress not routing traffic

```bash
# Check ingress status
kubectl describe ingress react-nextjs-host-ingress -n react-nextjs-host

# Verify GKE Load Balancer is provisioned (may take 2-5 minutes)
kubectl get ingress -n react-nextjs-host -w
```

---

## Configuration Management

### Environment Variables

The application reads the following environment variables:

| Variable | Default | Description |
|---|---|---|
| `TZ` | `UTC` | Container timezone |
| `JAVA_OPTS` | `-Xmx512m -Xms256m ...` | JVM startup flags |

### Updating environment variables

Edit `kubernetes/deployment.yaml` under `spec.template.spec.containers[0].env` and re-apply:

```bash
kubectl apply -f kubernetes/deployment.yaml
kubectl rollout restart deployment/react-nextjs-host -n react-nextjs-host
```

---

## Security Considerations

1. **Non-root user**: The container runs as `appuser` (non-root) for security.
2. **No secrets in images**: Never bake API keys or passwords into the Docker image.
3. **Kubernetes Secrets**: Use `kubectl create secret` for sensitive values.
4. **Network Policies**: Consider adding `NetworkPolicy` resources to restrict pod-to-pod traffic.
5. **Image scanning**: Enable Artifact Registry vulnerability scanning for the pushed image.
6. **RBAC**: Apply least-privilege IAM roles for GKE service accounts.

---

## Java-Specific Notes

- **JVM Container Support**: `-XX:+UseContainerSupport` ensures the JVM respects cgroup memory limits.
- **MaxRAMPercentage**: Set to 75% so the JVM heap does not exceed container memory limits.
- **Startup time**: The plain `com.sun.net.httpserver.HttpServer` starts in under 1 second; liveness probe initial delay is set to 30s as a conservative buffer.
- **Graceful shutdown**: The JVM handles `SIGTERM` from Kubernetes; no additional shutdown hooks are required for this application.
- **Build reproducibility**: Maven builds use `-B` (batch mode) for consistent, non-interactive CI/CD builds.
