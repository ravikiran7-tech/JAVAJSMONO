# Deployment Guide - react-nextjs-host

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [Docker Deployment](#docker-deployment)
5. [Azure AKS Deployment](#azure-aks-deployment)
6. [Configuration Management](#configuration-management)
7. [Troubleshooting](#troubleshooting)
8. [Security Considerations](#security-considerations)

---

## Overview

This guide provides comprehensive instructions for deploying the **react-nextjs-host** Java application to various environments, with a focus on Azure Kubernetes Service (AKS).

### Application Details
- **Technology Stack**: Java 17, Maven
- **Framework**: Java HTTP Server (com.sun.net.httpserver)
- **Application Port**: 8080
- **Health Endpoint**: `/api/health`
- **Package Type**: JAR (executable)

---

## Prerequisites

### Required Tools
- **Java Development Kit (JDK) 17** or higher
- **Maven 3.9+** for building the application
- **Docker** (version 20.10+) for containerization
- **Azure CLI** (version 2.50+) for Azure operations
- **kubectl** (version 1.27+) for Kubernetes management

### Azure Requirements
- Active Azure subscription
- Azure Container Registry (ACR) or Docker Hub account
- Azure Kubernetes Service (AKS) cluster (or permissions to create one)
- Appropriate RBAC permissions for AKS deployment

### Installation Links
- Java JDK: https://adoptium.net/
- Maven: https://maven.apache.org/download.cgi
- Docker: https://docs.docker.com/get-docker/
- Azure CLI: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli
- kubectl: https://kubernetes.io/docs/tasks/tools/

---

## Local Development Setup

### 1. Clone and Build the Application

```bash
# Navigate to project directory
cd /path/to/Azure_AKS1_MONOCMP

# Build the application
mvn clean package

# Run the application locally
java -jar target/react-nextjs-host.jar
```

The application will start on port 8080. Test the health endpoint:

```bash
curl http://localhost:8080/api/health
```

Expected response:
```json
{"status":"UP","timestamp":"2024-01-15T10:30:00Z"}
```

### 2. Local Docker Development

Build and run the application using Docker Compose:

```bash
# Build and start the container
docker-compose up --build

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

Access the application at `http://localhost:8080/api/health`

---

## Docker Deployment

### Build Docker Image

#### Linux/macOS
```bash
cd /path/to/Azure_AKS1_MONOCMP
chmod +x scripts/build-push.sh
./scripts/build-push.sh
```

#### Windows
```cmd
cd C:\path\to\Azure_AKS1_MONOCMP
scripts\build-push.bat
```

The script will prompt you to:
1. Select registry type (Azure ACR or Docker Hub)
2. Enter registry credentials
3. Specify image tag (default: latest)

### Manual Docker Build

```bash
# Build the image
docker build -t react-nextjs-host:latest .

# Run the container
docker run -d -p 8080:8080 --name react-nextjs-host react-nextjs-host:latest

# View logs
docker logs -f react-nextjs-host

# Stop and remove
docker stop react-nextjs-host
docker rm react-nextjs-host
```

---

## Azure AKS Deployment

### Step 1: Prepare Azure Environment

#### Login to Azure
```bash
az login
az account set --subscription "YOUR_SUBSCRIPTION_ID"
```

#### Create Resource Group (if needed)
```bash
az group create --name myResourceGroup --location eastus
```

#### Create AKS Cluster (if needed)
```bash
az aks create \
  --resource-group myResourceGroup \
  --name myAKSCluster \
  --node-count 2 \
  --node-vm-size Standard_DS2_v2 \
  --enable-managed-identity \
  --generate-ssh-keys
```

#### Create Azure Container Registry (if needed)
```bash
az acr create \
  --resource-group myResourceGroup \
  --name myContainerRegistry \
  --sku Basic

# Attach ACR to AKS
az aks update \
  --resource-group myResourceGroup \
  --name myAKSCluster \
  --attach-acr myContainerRegistry
```

### Step 2: Build and Push Docker Image

Run the build-push script and select Azure ACR:

```bash
./scripts/build-push.sh
# Select option 1 (Azure ACR)
# Enter ACR name: myContainerRegistry
# Enter image tag: v1.0.0
```

This will build and push the image to:
`myContainerRegistry.azurecr.io/react-nextjs-host:v1.0.0`

### Step 3: Deploy to AKS

#### Linux/macOS
```bash
chmod +x scripts/deploy-image.sh
./scripts/deploy-image.sh
```

#### Windows
```cmd
scripts\deploy-image.bat
```

The script will prompt you for:
1. **Resource Group name**: myResourceGroup
2. **AKS Cluster name**: myAKSCluster
3. **Docker image URI**: myContainerRegistry.azurecr.io/react-nextjs-host:v1.0.0

### Step 4: Verify Deployment

```bash
# Check pod status
kubectl get pods -n react-nextjs-host

# Check service
kubectl get svc -n react-nextjs-host

# Check ingress
kubectl get ingress -n react-nextjs-host

# View logs
kubectl logs -f deployment/react-nextjs-host -n react-nextjs-host
```

### Step 5: Access the Application

#### Option 1: Port Forward (for testing)
```bash
kubectl port-forward svc/react-nextjs-host-service 8080:80 -n react-nextjs-host
```
Access at: `http://localhost:8080/api/health`

#### Option 2: Configure Ingress DNS
1. Get the ingress IP address:
   ```bash
   kubectl get ingress -n react-nextjs-host
   ```
2. Update your DNS to point `react-nextjs-host.example.com` to the ingress IP
3. Access at: `http://react-nextjs-host.example.com/api/health`

---

## Configuration Management

### Environment Variables

The application supports the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `JAVA_OPTS` | JVM options for memory and performance | `-Xmx512m -Xms256m` |
| `TZ` | Timezone setting | `UTC` |

### Kubernetes ConfigMap (Optional)

Create a ConfigMap for application configuration:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: react-nextjs-host-config
  namespace: react-nextjs-host
data:
  application.properties: |
    server.port=8080
    logging.level.root=INFO
```

Mount the ConfigMap in deployment.yaml:

```yaml
spec:
  containers:
  - name: react-nextjs-host
    volumeMounts:
    - name: config
      mountPath: /app/config
  volumes:
  - name: config
    configMap:
      name: react-nextjs-host-config
```

### Kubernetes Secrets (for sensitive data)

```bash
# Create secret
kubectl create secret generic app-secrets \
  --from-literal=api-key=YOUR_API_KEY \
  -n react-nextjs-host

# Reference in deployment
env:
- name: API_KEY
  valueFrom:
    secretKeyRef:
      name: app-secrets
      key: api-key
```

---

## Troubleshooting

### Common Issues

#### 1. Pod CrashLoopBackOff

**Symptoms**: Pods continuously restart

**Diagnosis**:
```bash
kubectl describe pod <pod-name> -n react-nextjs-host
kubectl logs <pod-name> -n react-nextjs-host
```

**Common Causes**:
- Insufficient memory/CPU resources
- Application startup failure
- Missing environment variables

**Solutions**:
- Increase resource limits in deployment.yaml
- Check application logs for errors
- Verify all required environment variables are set

#### 2. ImagePullBackOff

**Symptoms**: Cannot pull Docker image

**Diagnosis**:
```bash
kubectl describe pod <pod-name> -n react-nextjs-host
```

**Solutions**:
- Verify image URI is correct
- Check ACR is attached to AKS: `az aks check-acr --resource-group myResourceGroup --name myAKSCluster --acr myContainerRegistry`
- Ensure image exists in registry: `az acr repository list --name myContainerRegistry`

#### 3. Service Not Accessible

**Symptoms**: Cannot access application via service

**Diagnosis**:
```bash
kubectl get svc -n react-nextjs-host
kubectl get endpoints -n react-nextjs-host
```

**Solutions**:
- Verify pods are running: `kubectl get pods -n react-nextjs-host`
- Check service selector matches pod labels
- Test from within cluster: `kubectl run -it --rm debug --image=busybox --restart=Never -- wget -O- http://react-nextjs-host-service.react-nextjs-host.svc.cluster.local/api/health`

#### 4. Ingress Not Working

**Symptoms**: Cannot access application via ingress

**Diagnosis**:
```bash
kubectl describe ingress react-nextjs-host-ingress -n react-nextjs-host
```

**Solutions**:
- Verify Application Gateway Ingress Controller is installed
- Check ingress annotations are correct
- Ensure DNS is configured properly
- Verify backend service is healthy

### Health Check Failures

If liveness/readiness probes fail:

```bash
# Check probe configuration
kubectl describe pod <pod-name> -n react-nextjs-host

# Test health endpoint manually
kubectl exec -it <pod-name> -n react-nextjs-host -- curl http://localhost:8080/api/health
```

Adjust probe timings in deployment.yaml if needed:
- Increase `initialDelaySeconds` for slow startup
- Increase `timeoutSeconds` for slow responses
- Adjust `failureThreshold` for tolerance

### Viewing Logs

```bash
# View current logs
kubectl logs deployment/react-nextjs-host -n react-nextjs-host

# Follow logs
kubectl logs -f deployment/react-nextjs-host -n react-nextjs-host

# View previous container logs (after crash)
kubectl logs <pod-name> -n react-nextjs-host --previous

# View logs from all pods
kubectl logs -l app=react-nextjs-host -n react-nextjs-host --all-containers=true
```

### Rollback Deployment

If a deployment fails:

```bash
# View rollout history
kubectl rollout history deployment/react-nextjs-host -n react-nextjs-host

# Rollback to previous version
kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host

# Rollback to specific revision
kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host --to-revision=2
```

---

## Security Considerations

### 1. Container Security

- **Non-root user**: The Dockerfile creates and uses a non-root user (`appuser`)
- **Minimal base image**: Uses Amazon Corretto 17 (optimized for production)
- **No unnecessary tools**: Runtime image contains only JRE, not full JDK

### 2. Kubernetes Security

#### Network Policies

Restrict network traffic to the application:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: react-nextjs-host-netpol
  namespace: react-nextjs-host
spec:
  podSelector:
    matchLabels:
      app: react-nextjs-host
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 53  # DNS
```

#### Pod Security Standards

Apply pod security standards:

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: react-nextjs-host
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

#### RBAC

Create service account with minimal permissions:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: react-nextjs-host-sa
  namespace: react-nextjs-host
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: react-nextjs-host-role
  namespace: react-nextjs-host
rules:
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: react-nextjs-host-rolebinding
  namespace: react-nextjs-host
subjects:
- kind: ServiceAccount
  name: react-nextjs-host-sa
roleRef:
  kind: Role
  name: react-nextjs-host-role
  apiGroup: rbac.authorization.k8s.io
```

### 3. Secrets Management

- Use Azure Key Vault for sensitive data
- Enable Azure Key Vault Provider for Secrets Store CSI Driver
- Never commit secrets to version control

### 4. Image Scanning

Scan Docker images for vulnerabilities:

```bash
# Using Azure Container Registry
az acr task create \
  --registry myContainerRegistry \
  --name securityScan \
  --image react-nextjs-host:{{.Run.ID}} \
  --context /dev/null \
  --file Dockerfile \
  --commit-trigger-enabled false \
  --base-image-trigger-enabled true

# Enable vulnerability scanning
az acr task run --registry myContainerRegistry --name securityScan
```

### 5. TLS/SSL

Enable HTTPS for ingress:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: react-nextjs-host-ingress
  namespace: react-nextjs-host
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - react-nextjs-host.example.com
    secretName: react-nextjs-host-tls
  rules:
  - host: react-nextjs-host.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: react-nextjs-host-service
            port:
              number: 80
```

---

## Scaling and Performance

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: react-nextjs-host-hpa
  namespace: react-nextjs-host
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: react-nextjs-host
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### JVM Tuning

Adjust JVM settings in deployment.yaml:

```yaml
env:
- name: JAVA_OPTS
  value: "-Xmx1g -Xms512m -XX:+UseG1GC -XX:MaxGCPauseMillis=200 -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
```

---

## Monitoring and Observability

### Azure Monitor Integration

Enable Container Insights for AKS:

```bash
az aks enable-addons \
  --resource-group myResourceGroup \
  --name myAKSCluster \
  --addons monitoring
```

### Application Metrics

The application exposes a health endpoint at `/api/health`. Consider adding:
- Prometheus metrics endpoint
- Application Performance Monitoring (APM) integration
- Distributed tracing with Azure Application Insights

---

## Additional Resources

- [Azure AKS Documentation](https://docs.microsoft.com/en-us/azure/aks/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Java Container Best Practices](https://docs.oracle.com/en/java/javase/17/docs/specs/man/java.html)

---

## Support and Maintenance

### Regular Maintenance Tasks

1. **Update base images regularly**
   ```bash
   docker pull amazoncorretto:17
   docker build -t react-nextjs-host:latest .
   ```

2. **Monitor resource usage**
   ```bash
   kubectl top pods -n react-nextjs-host
   kubectl top nodes
   ```

3. **Review and rotate secrets**
   ```bash
   kubectl get secrets -n react-nextjs-host
   ```

4. **Update Kubernetes manifests**
   - Review and update resource limits
   - Update image tags to latest stable versions
   - Review and update security policies

### Backup and Disaster Recovery

1. **Backup Kubernetes resources**
   ```bash
   kubectl get all -n react-nextjs-host -o yaml > backup.yaml
   ```

2. **Export configurations**
   ```bash
   kubectl get configmap,secret -n react-nextjs-host -o yaml > configs-backup.yaml
   ```

3. **Document recovery procedures**
   - Keep deployment scripts in version control
   - Document manual configuration steps
   - Test recovery procedures regularly

---

## Conclusion

This deployment guide provides comprehensive instructions for deploying the react-nextjs-host Java application to Azure AKS. Follow the security best practices and monitoring recommendations to ensure a stable and secure production deployment.

For questions or issues, refer to the troubleshooting section or consult the Azure and Kubernetes documentation.
