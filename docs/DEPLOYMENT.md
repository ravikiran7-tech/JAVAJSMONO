# Deployment Guide – react-nextjs-host on Azure AKS

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Project Structure](#project-structure)
4. [Local Development with Docker Compose](#local-development-with-docker-compose)
5. [Build and Push Docker Image](#build-and-push-docker-image)
6. [Azure AKS Deployment](#azure-aks-deployment)
7. [Kubernetes Manifest Reference](#kubernetes-manifest-reference)
8. [Configuration Management](#configuration-management)
9. [Scaling and Management](#scaling-and-management)
10. [Troubleshooting](#troubleshooting)
11. [Security Considerations](#security-considerations)
12. [Java-Specific Notes](#java-specific-notes)

---

## Overview

**Application**: `react-nextjs-host`  
**Technology**: Java 17 (Maven), plain JDK HTTP server (`com.sun.net.httpserver`)  
**Packaging**: Executable JAR (`react-nextjs-host.jar`)  
**Application Port**: `8080`  
**Health Endpoint**: `GET /api/health` → `{"status":"UP"}`  
**Target Platform**: Azure Kubernetes Service (AKS)  
**Runtime Base Image**: `amazoncorretto:17`  
**Builder Image**: `maven:3.9.4-eclipse-temurin-17`

---

## Prerequisites

### Local Development
| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Docker Desktop | 24.x | Build and run containers |
| Docker Compose | 2.x | Local multi-container orchestration |
| Java JDK | 17 | Local builds (optional) |
| Maven | 3.9.x | Local builds (optional) |

### Azure AKS Deployment
| Tool | Minimum Version | Purpose |
|------|----------------|---------|
| Azure CLI (`az`) | 2.50+ | Azure resource management |
| `kubectl` | 1.27+ | Kubernetes cluster management |
| Docker | 24.x | Image build and push |
| Azure Subscription | — | AKS cluster hosting |

Install Azure CLI:
```bash
# macOS
brew install azure-cli

# Ubuntu/Debian
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Windows
winget install Microsoft.AzureCLI
```

Install kubectl:
```bash
az aks install-cli
```

---

## Project Structure

```
AKS_Mono1_javajsCMP/
├── Dockerfile                  # Multi-stage build (Maven → Amazon Corretto 17)
├── .dockerignore               # Excludes build artifacts, wrapper files, IDE files
├── docker-compose.yml          # Local development (application only)
├── pom.xml                     # Maven build descriptor
├── src/
│   └── main/java/com/trianz/reactnextjs/
│       ├── Application.java    # Entry point – starts HTTP server on :8080
│       ├── controller/
│       │   └── HealthController.java
│       └── service/
│           └── HealthService.java
├── kubernetes/
│   ├── namespace.yaml          # Kubernetes namespace
│   ├── deployment.yaml         # Deployment (2 replicas, health probes)
│   ├── service.yaml            # ClusterIP service (port 80 → 8080)
│   └── ingress.yaml            # Azure Application Gateway Ingress
├── scripts/
│   ├── build-push.sh           # Linux/macOS: build & push to ACR or Docker Hub
│   ├── build-push.bat          # Windows: build & push to ACR or Docker Hub
│   ├── deploy-image.sh         # Linux/macOS: deploy to AKS
│   └── deploy-image.bat        # Windows: deploy to AKS
└── docs/
    └── DEPLOYMENT.md           # This file
```

---

## Local Development with Docker Compose

### 1. Build and Start

```bash
# From repository root
docker compose up --build
```

### 2. Verify the Application

```bash
# Health check
curl http://localhost:8080/api/health
# Expected: {"status":"UP"}
```

### 3. Stop the Application

```bash
docker compose down
```

### 4. Rebuild After Code Changes

```bash
docker compose up --build --force-recreate
```

---

## Build and Push Docker Image

### Linux / macOS

```bash
chmod +x scripts/build-push.sh
bash scripts/build-push.sh
```

The script will prompt you to:
1. Enter an image tag (defaults to `latest`)
2. Select registry type: **Azure ACR** or **Docker Hub**
3. Provide registry credentials

### Windows

```cmd
scripts\build-push.bat
```

### Manual Build (Advanced)

```bash
# Build image
docker build -f Dockerfile -t myregistry.azurecr.io/react-nextjs-host:1.0.0 .

# Push to ACR
az acr login --name myregistry
docker push myregistry.azurecr.io/react-nextjs-host:1.0.0
```

---

## Azure AKS Deployment

### Step 1: Login to Azure

```bash
az login
az account set --subscription "<YOUR_SUBSCRIPTION_ID>"
```

### Step 2: Create or Identify AKS Cluster

```bash
# Create a new resource group (if needed)
az group create --name my-rg --location eastus

# Create AKS cluster (if needed)
az aks create \
  --resource-group my-rg \
  --name my-aks-cluster \
  --node-count 2 \
  --enable-addons monitoring \
  --generate-ssh-keys

# Enable Application Gateway Ingress Controller (AGIC)
az aks enable-addons \
  --resource-group my-rg \
  --name my-aks-cluster \
  --addons ingress-appgw \
  --appgw-name my-appgw \
  --appgw-subnet-cidr "10.225.0.0/16"
```

### Step 3: Push Image to ACR

```bash
# Create ACR (if needed)
az acr create --resource-group my-rg --name myregistry --sku Basic

# Attach ACR to AKS
az aks update --resource-group my-rg --name my-aks-cluster --attach-acr myregistry

# Build and push
bash scripts/build-push.sh
```

### Step 4: Deploy to AKS

```bash
# Linux/macOS
chmod +x scripts/deploy-image.sh
bash scripts/deploy-image.sh

# Windows
scripts\deploy-image.bat
```

The script will prompt for:
- Azure Resource Group name
- AKS Cluster name
- Full Docker image URI (e.g., `myregistry.azurecr.io/react-nextjs-host:latest`)

### Step 5: Verify Deployment

```bash
# Check pods
kubectl get pods -n react-nextjs-host

# Check services
kubectl get svc -n react-nextjs-host

# Check ingress
kubectl get ingress -n react-nextjs-host

# View pod logs
kubectl logs -l app=react-nextjs-host -n react-nextjs-host --tail=50

# Test health endpoint (port-forward for quick test)
kubectl port-forward svc/react-nextjs-host-service 8080:80 -n react-nextjs-host
curl http://localhost:8080/api/health
```

---

## Kubernetes Manifest Reference

### namespace.yaml
Creates the `react-nextjs-host` namespace to isolate all application resources.

### deployment.yaml
- **Replicas**: 2 (high availability)
- **Image**: `{{IMAGE_URI}}` placeholder replaced by `deploy-image.sh`
- **Resources**: requests `250m CPU / 512Mi RAM`, limits `500m CPU / 1Gi RAM`
- **Liveness Probe**: `GET /api/health` on port 8080, initial delay 30s
- **Readiness Probe**: `GET /api/health` on port 8080, initial delay 20s
- **Security**: Runs as non-root user (UID 1000)

### service.yaml
- **Type**: ClusterIP (internal cluster access)
- **Port mapping**: `80 → 8080`
- **Selector**: `app: react-nextjs-host`

### ingress.yaml
- **Class**: `azure/application-gateway` (AGIC)
- **Host**: `react-nextjs-host.example.com` (update to your domain)
- **Path**: `/` (all traffic routed to the service)

**Update the ingress host before deploying:**
```bash
sed -i 's|react-nextjs-host.example.com|your-actual-domain.com|g' kubernetes/ingress.yaml
```

---

## Configuration Management

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TZ` | `UTC` | Container timezone |
| `JAVA_OPTS` | See Dockerfile | JVM tuning flags |

### Kubernetes Secrets (for sensitive values)

```bash
# Create a secret
kubectl create secret generic react-nextjs-host-secrets \
  --from-literal=API_KEY=your-api-key \
  -n react-nextjs-host

# Reference in deployment.yaml
# env:
#   - name: API_KEY
#     valueFrom:
#       secretKeyRef:
#         name: react-nextjs-host-secrets
#         key: API_KEY
```

### ConfigMaps (for non-sensitive configuration)

```bash
kubectl create configmap react-nextjs-host-config \
  --from-literal=TZ=UTC \
  -n react-nextjs-host
```

---

## Scaling and Management

### Manual Scaling

```bash
kubectl scale deployment react-nextjs-host --replicas=4 -n react-nextjs-host
```

### Horizontal Pod Autoscaler (HPA)

```bash
kubectl autoscale deployment react-nextjs-host \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n react-nextjs-host
```

### Rolling Update

```bash
# Update image
kubectl set image deployment/react-nextjs-host \
  react-nextjs-host=myregistry.azurecr.io/react-nextjs-host:2.0.0 \
  -n react-nextjs-host

# Monitor rollout
kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host

# Rollback to specific revision
kubectl rollout history deployment/react-nextjs-host -n react-nextjs-host
kubectl rollout undo deployment/react-nextjs-host --to-revision=2 -n react-nextjs-host
```

---

## Troubleshooting

### Pod Not Starting

```bash
# Describe pod for events
kubectl describe pod -l app=react-nextjs-host -n react-nextjs-host

# Check logs
kubectl logs -l app=react-nextjs-host -n react-nextjs-host --previous
```

### Common Issues

| Symptom | Likely Cause | Resolution |
|---------|-------------|------------|
| `ImagePullBackOff` | ACR credentials not attached | `az aks update --attach-acr <acr-name>` |
| `CrashLoopBackOff` | JVM OOM or startup failure | Increase memory limits; check logs |
| `Pending` pods | Insufficient node resources | Scale node pool or reduce resource requests |
| Health probe failing | App not ready in time | Increase `initialDelaySeconds` in probes |
| Ingress not resolving | AGIC not configured | Verify AGIC addon is enabled on AKS |

### Useful Diagnostic Commands

```bash
# Get all resources in namespace
kubectl get all -n react-nextjs-host

# Describe deployment
kubectl describe deployment react-nextjs-host -n react-nextjs-host

# Get pod resource usage
kubectl top pods -n react-nextjs-host

# Get node resource usage
kubectl top nodes

# Check ingress controller logs
kubectl logs -n kube-system -l app=ingress-appgw --tail=50

# Execute shell in running pod
kubectl exec -it $(kubectl get pod -l app=react-nextjs-host -n react-nextjs-host -o jsonpath='{.items[0].metadata.name}') -n react-nextjs-host -- /bin/sh
```

---

## Security Considerations

1. **Non-root container**: The application runs as UID 1000 (`appuser`) — never as root.
2. **Read-only filesystem**: Consider adding `readOnlyRootFilesystem: true` to the security context.
3. **Secrets management**: Use Kubernetes Secrets or Azure Key Vault for sensitive values — never hardcode credentials.
4. **Network policies**: Restrict pod-to-pod communication with Kubernetes NetworkPolicy.
5. **Image scanning**: Enable Azure Defender for Containers to scan ACR images for vulnerabilities.
6. **RBAC**: Use least-privilege service accounts for the deployment.
7. **TLS**: Configure TLS termination at the Application Gateway level for HTTPS.

---

## Java-Specific Notes

### JVM Container Awareness
The Dockerfile sets the following JVM flags for optimal container behaviour:
```
-XX:+UseContainerSupport       # Respect container CPU/memory limits
-XX:MaxRAMPercentage=75.0      # Use 75% of container memory for heap
-XX:+UnlockExperimentalVMOptions
-Xms256m                       # Initial heap size
-Xmx512m                       # Maximum heap size
-Djava.security.egd=file:/dev/./urandom  # Faster SecureRandom on Linux
```

### Startup Time
The JVM typically takes 5–15 seconds to start. The liveness probe has a 30-second initial delay and the readiness probe has a 20-second initial delay to accommodate this.

### Garbage Collection
Java 17 uses G1GC by default, which is well-suited for containerized workloads. No additional GC flags are required for this application size.

### Build Reproducibility
The Dockerfile uses `mvn dependency:go-offline` before copying source code. This ensures that Maven dependencies are cached in a separate Docker layer, significantly speeding up rebuilds when only source code changes.

### Maven Wrapper
The project's `mvnw`/`mvnw.cmd` wrapper files are **excluded** from the Docker build context via `.dockerignore`. The Dockerfile uses the system `mvn` command from the `maven:3.9.4-eclipse-temurin-17` builder image instead, which is more reliable in CI/CD environments.
