# Deployment Guide for react-nextjs-host

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Overview](#project-overview)
3. [Local Development Setup](#local-development-setup)
4. [Building and Pushing Docker Images](#building-and-pushing-docker-images)
5. [GCP GKE Deployment](#gcp-gke-deployment)
6. [Configuration Management](#configuration-management)
7. [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
8. [Scaling and Management](#scaling-and-management)
9. [Security Considerations](#security-considerations)
10. [Technology-Specific Notes](#technology-specific-notes)

---

## Prerequisites

### Required Tools
- **Docker**: Version 20.10 or higher
  - Install: https://docs.docker.com/get-docker/
- **Docker Compose**: Version 2.0 or higher
  - Install: https://docs.docker.com/compose/install/
- **Google Cloud SDK (gcloud)**: Latest version
  - Install: https://cloud.google.com/sdk/docs/install
- **kubectl**: Version 1.24 or higher
  - Install: https://kubernetes.io/docs/tasks/tools/

### GCP Requirements
- Active GCP account with billing enabled
- GCP project with the following APIs enabled:
  - Kubernetes Engine API
  - Container Registry API or Artifact Registry API
  - Compute Engine API
- Appropriate IAM permissions:
  - Kubernetes Engine Admin
  - Storage Admin (for Container/Artifact Registry)
  - Service Account User

### System Requirements
- **Operating System**: Linux, macOS, or Windows 10/11
- **Memory**: Minimum 8GB RAM (16GB recommended)
- **Disk Space**: Minimum 10GB free space
- **Network**: Stable internet connection for pulling base images and pushing to registries

---

## Project Overview

### Application Details
- **Name**: react-nextjs-host
- **Type**: Java HTTP Server Application
- **Framework**: Java 17 with built-in HttpServer
- **Build Tool**: Maven 3.9.4
- **Package Type**: Executable JAR
- **Main Class**: com.trianz.reactnextjs.Application
- **Default Port**: 8080

### Application Endpoints
- **Health Check**: `GET /api/health`
  - Returns: `{"status":"UP"}`
  - Used for liveness and readiness probes
- **Upload Signed URL**: `POST /api/upload/signed-url`
  - Provides signed URL functionality

### Architecture
This is a lightweight Java application that uses the JDK's built-in `HttpServer` class to serve HTTP requests. The application is designed to be containerized and deployed on Google Kubernetes Engine (GKE).

---

## Local Development Setup

### 1. Clone the Repository
```bash
cd /path/to/project
```

### 2. Build the Application Locally
```bash
# Using Maven
mvn clean package

# The JAR file will be created at: target/react-nextjs-host.jar
```

### 3. Run Locally (Without Docker)
```bash
java -jar target/react-nextjs-host.jar
```

The application will start on port 8080. Test it:
```bash
curl http://localhost:8080/api/health
# Expected response: {"status":"UP"}
```

### 4. Run with Docker Compose
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

Access the application at: http://localhost:8080

---

## Building and Pushing Docker Images

### Option 1: Using build-push.sh (Linux/macOS)

```bash
# Make the script executable
chmod +x scripts/build-push.sh

# Run the script
./scripts/build-push.sh
```

The script will prompt you for:
1. **Registry Type**: Choose between Google Artifact Registry or Docker Hub
2. **Registry Details**: Provide credentials and repository information
3. **Image Tag**: Specify a tag (default: latest)

#### Example: Google Artifact Registry
```
Select Docker Registry:
1. Google Artifact Registry
2. Docker Hub
Enter choice (1 or 2): 1

Enter GCP Project ID: my-gcp-project
Enter GCP Region (e.g., us-central1): us-central1
Enter Artifact Registry Repository Name: my-repo
Enter image tag (default: latest): v1.0.0
```

#### Example: Docker Hub
```
Select Docker Registry:
1. Google Artifact Registry
2. Docker Hub
Enter choice (1 or 2): 2

Enter Docker Hub username: myusername
Enter Docker Hub password/token: ********
Enter image tag (default: latest): v1.0.0
```

### Option 2: Using build-push.bat (Windows)

```cmd
# Run the script
scripts\build-push.bat
```

Follow the same prompts as the Linux/macOS version.

### Manual Docker Build (Alternative)

```bash
# Build the image
docker build -t react-nextjs-host:latest .

# Tag for your registry
docker tag react-nextjs-host:latest <registry>/<repo>/react-nextjs-host:latest

# Push to registry
docker push <registry>/<repo>/react-nextjs-host:latest
```

---

## GCP GKE Deployment

### Step 1: Set Up GKE Cluster

#### Create a GKE Cluster (if not exists)
```bash
# Set your GCP project
gcloud config set project YOUR_PROJECT_ID

# Create a GKE cluster
gcloud container clusters create react-nextjs-cluster \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-2 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 5

# Get cluster credentials
gcloud container clusters get-credentials react-nextjs-cluster \
  --zone us-central1-a \
  --project YOUR_PROJECT_ID
```

#### Verify Cluster Access
```bash
kubectl cluster-info
kubectl get nodes
```

### Step 2: Deploy Using deploy-image.sh (Linux/macOS)

```bash
# Make the script executable
chmod +x scripts/deploy-image.sh

# Run the deployment script
./scripts/deploy-image.sh
```

The script will prompt you for:
1. **GCP Project ID**: Your GCP project
2. **GCP Zone**: The zone where your GKE cluster is located
3. **GKE Cluster Name**: The name of your cluster
4. **Docker Image URI**: Full image path with tag

#### Example Deployment
```
Enter GCP Project ID: my-gcp-project
Enter GCP Zone (e.g., us-central1-a): us-central1-a
Enter GKE Cluster Name: react-nextjs-cluster
Enter Docker Image URI (with tag): us-central1-docker.pkg.dev/my-gcp-project/my-repo/react-nextjs-host:v1.0.0
```

### Step 3: Deploy Using deploy-image.bat (Windows)

```cmd
# Run the deployment script
scripts\deploy-image.bat
```

Follow the same prompts as the Linux/macOS version.

### Step 4: Verify Deployment

```bash
# Check namespace
kubectl get namespace react-nextjs-host

# Check pods
kubectl get pods -n react-nextjs-host

# Check services
kubectl get svc -n react-nextjs-host

# Check ingress
kubectl get ingress -n react-nextjs-host

# View pod logs
kubectl logs -n react-nextjs-host -l app=react-nextjs-host -f
```

### Step 5: Access the Application

#### Get Ingress IP Address
```bash
kubectl get ingress -n react-nextjs-host
```

Wait for the ingress to provision an external IP (may take 5-10 minutes).

#### Configure DNS (Production)
Point your domain to the ingress IP:
```
react-nextjs-host.example.com -> <INGRESS_IP>
```

#### Test Access
```bash
# Using the ingress IP
curl http://<INGRESS_IP>/api/health

# Using the domain (after DNS configuration)
curl http://react-nextjs-host.example.com/api/health
```

---

## Configuration Management

### Environment Variables

The application uses the following environment variables (configured in `kubernetes/deployment.yaml`):

| Variable | Default Value | Description |
|----------|---------------|-------------|
| `JAVA_OPTS` | `-Xmx512m -Xms256m -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0` | JVM memory and optimization settings |

### Updating Configuration

#### Method 1: Edit Deployment YAML
```bash
# Edit the deployment
kubectl edit deployment react-nextjs-host -n react-nextjs-host

# Or update the YAML file and apply
kubectl apply -f kubernetes/deployment.yaml
```

#### Method 2: Using kubectl set env
```bash
kubectl set env deployment/react-nextjs-host \
  JAVA_OPTS="-Xmx1g -Xms512m" \
  -n react-nextjs-host
```

### Resource Limits

Current resource configuration:
```yaml
resources:
  requests:
    cpu: "250m"
    memory: "512Mi"
  limits:
    cpu: "500m"
    memory: "1Gi"
```

Adjust based on your application's needs by editing `kubernetes/deployment.yaml`.

---

## Monitoring and Troubleshooting

### Viewing Logs

```bash
# View logs from all pods
kubectl logs -n react-nextjs-host -l app=react-nextjs-host

# Follow logs in real-time
kubectl logs -n react-nextjs-host -l app=react-nextjs-host -f

# View logs from a specific pod
kubectl logs -n react-nextjs-host <pod-name>

# View previous container logs (if pod crashed)
kubectl logs -n react-nextjs-host <pod-name> --previous
```

### Checking Pod Status

```bash
# Get pod status
kubectl get pods -n react-nextjs-host

# Describe a pod for detailed information
kubectl describe pod <pod-name> -n react-nextjs-host

# Get events
kubectl get events -n react-nextjs-host --sort-by='.lastTimestamp'
```

### Common Issues and Solutions

#### Issue 1: Pods Not Starting (ImagePullBackOff)
**Symptoms**: Pods stuck in `ImagePullBackOff` or `ErrImagePull` state

**Solutions**:
```bash
# Check pod events
kubectl describe pod <pod-name> -n react-nextjs-host

# Verify image URI is correct
kubectl get deployment react-nextjs-host -n react-nextjs-host -o yaml | grep image:

# Ensure GKE has access to the registry
# For Artifact Registry, create a service account and configure image pull secrets
```

#### Issue 2: Pods Crashing (CrashLoopBackOff)
**Symptoms**: Pods repeatedly restarting

**Solutions**:
```bash
# Check logs
kubectl logs -n react-nextjs-host <pod-name> --previous

# Check resource limits
kubectl describe pod <pod-name> -n react-nextjs-host | grep -A 5 Limits

# Increase memory/CPU if needed
kubectl edit deployment react-nextjs-host -n react-nextjs-host
```

#### Issue 3: Health Check Failures
**Symptoms**: Pods not becoming ready

**Solutions**:
```bash
# Check health endpoint manually
kubectl port-forward -n react-nextjs-host <pod-name> 8080:8080
curl http://localhost:8080/api/health

# Adjust probe timing in deployment.yaml
# Increase initialDelaySeconds or periodSeconds
```

#### Issue 4: Service Not Accessible
**Symptoms**: Cannot access application via service or ingress

**Solutions**:
```bash
# Check service endpoints
kubectl get endpoints -n react-nextjs-host

# Check ingress status
kubectl describe ingress react-nextjs-host-ingress -n react-nextjs-host

# Test service internally
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl http://react-nextjs-host-service.react-nextjs-host.svc.cluster.local/api/health
```

### Health Checks

The application exposes a health endpoint at `/api/health`:

```bash
# Check health via port-forward
kubectl port-forward -n react-nextjs-host svc/react-nextjs-host-service 8080:80
curl http://localhost:8080/api/health
```

Expected response:
```json
{"status":"UP"}
```

---

## Scaling and Management

### Manual Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment react-nextjs-host -n react-nextjs-host --replicas=5

# Verify scaling
kubectl get pods -n react-nextjs-host
```

### Horizontal Pod Autoscaling (HPA)

Create an HPA to automatically scale based on CPU usage:

```bash
# Create HPA
kubectl autoscale deployment react-nextjs-host \
  -n react-nextjs-host \
  --cpu-percent=70 \
  --min=2 \
  --max=10

# Check HPA status
kubectl get hpa -n react-nextjs-host

# Describe HPA
kubectl describe hpa react-nextjs-host -n react-nextjs-host
```

### Rolling Updates

```bash
# Update the image
kubectl set image deployment/react-nextjs-host \
  react-nextjs-host=<new-image-uri> \
  -n react-nextjs-host

# Watch rollout status
kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host

# Check rollout history
kubectl rollout history deployment/react-nextjs-host -n react-nextjs-host
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host

# Rollback to specific revision
kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host --to-revision=2

# Verify rollback
kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host
```

### Restarting Pods

```bash
# Restart all pods (rolling restart)
kubectl rollout restart deployment/react-nextjs-host -n react-nextjs-host

# Delete a specific pod (will be recreated)
kubectl delete pod <pod-name> -n react-nextjs-host
```

---

## Security Considerations

### 1. Non-Root User
The Dockerfile creates and uses a non-root user (`appuser`) for running the application, following security best practices.

### 2. Image Security
- Use specific image tags (avoid `latest` in production)
- Regularly update base images for security patches
- Scan images for vulnerabilities:
  ```bash
  gcloud container images scan <image-uri>
  ```

### 3. Network Policies
Consider implementing Kubernetes Network Policies to restrict pod-to-pod communication:

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
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to:
    - namespaceSelector: {}
```

### 4. Secrets Management
For sensitive data, use Kubernetes Secrets:

```bash
# Create a secret
kubectl create secret generic app-secrets \
  --from-literal=api-key=your-api-key \
  -n react-nextjs-host

# Reference in deployment
# Add to env section in deployment.yaml:
# - name: API_KEY
#   valueFrom:
#     secretKeyRef:
#       name: app-secrets
#       key: api-key
```

### 5. RBAC (Role-Based Access Control)
Implement RBAC to control access to Kubernetes resources:

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
  resources: ["pods", "services"]
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

### 6. TLS/SSL Configuration
For production, configure TLS on the ingress:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: react-nextjs-host-ingress
  namespace: react-nextjs-host
  annotations:
    kubernetes.io/ingress.class: "gce"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
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

## Technology-Specific Notes

### Java 17 Considerations

1. **JVM Memory Management**
   - The application uses container-aware JVM settings
   - `-XX:+UseContainerSupport` enables container memory detection
   - `-XX:MaxRAMPercentage=75.0` limits heap to 75% of container memory
   - Adjust `JAVA_OPTS` based on your workload

2. **Startup Time**
   - Java applications typically take 20-30 seconds to start
   - Health probe `initialDelaySeconds` is set to 30 seconds
   - Adjust if your application takes longer to initialize

3. **Garbage Collection**
   - Default GC is G1GC (good for most workloads)
   - For low-latency requirements, consider ZGC:
     ```
     JAVA_OPTS="-XX:+UseZGC -Xmx512m -Xms256m"
     ```

### Maven Build Optimization

1. **Dependency Caching**
   - The Dockerfile copies `pom.xml` first to cache dependencies
   - Rebuilds are faster as dependencies are reused

2. **Build Performance**
   - Tests are skipped during Docker build (`-DskipTests`)
   - Run tests in CI/CD pipeline before building images

3. **Multi-Module Projects**
   - If you have a multi-module Maven project, adjust the Dockerfile:
     ```dockerfile
     COPY pom.xml .
     COPY module1/pom.xml module1/
     COPY module2/pom.xml module2/
     RUN mvn dependency:go-offline -B
     COPY . .
     RUN mvn clean package -DskipTests
     ```

### HttpServer Specifics

1. **Built-in HTTP Server**
   - Uses JDK's `com.sun.net.httpserver.HttpServer`
   - Lightweight, no external dependencies
   - Suitable for simple REST APIs and microservices

2. **Port Configuration**
   - Port is hardcoded to 8080 in `Application.java`
   - To make it configurable, modify the code to read from environment variable:
     ```java
     int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
     ```

3. **Performance Tuning**
   - For production, consider using a more robust server (Tomcat, Jetty)
   - Or migrate to Spring Boot for better features and ecosystem

### GKE-Specific Optimizations

1. **Node Affinity**
   - Use node affinity to schedule pods on specific node pools:
     ```yaml
     affinity:
       nodeAffinity:
         requiredDuringSchedulingIgnoredDuringExecution:
           nodeSelectorTerms:
           - matchExpressions:
             - key: workload-type
               operator: In
               values:
               - java-apps
     ```

2. **Pod Disruption Budget**
   - Ensure high availability during node maintenance:
     ```yaml
     apiVersion: policy/v1
     kind: PodDisruptionBudget
     metadata:
       name: react-nextjs-host-pdb
       namespace: react-nextjs-host
     spec:
       minAvailable: 1
       selector:
         matchLabels:
           app: react-nextjs-host
     ```

3. **GKE Workload Identity**
   - Use Workload Identity for secure access to GCP services:
     ```bash
     # Enable Workload Identity on cluster
     gcloud container clusters update react-nextjs-cluster \
       --workload-pool=PROJECT_ID.svc.id.goog
     
     # Create service account and bind
     kubectl annotate serviceaccount default \
       iam.gke.io/gcp-service-account=GSA_NAME@PROJECT_ID.iam.gserviceaccount.com \
       -n react-nextjs-host
     ```

---

## Additional Resources

### Documentation
- [Google Kubernetes Engine Documentation](https://cloud.google.com/kubernetes-engine/docs)
- [Kubernetes Documentation](https://kubernetes.io/docs/home/)
- [Docker Documentation](https://docs.docker.com/)
- [Maven Documentation](https://maven.apache.org/guides/)

### Monitoring and Observability
- **Google Cloud Monitoring**: Built-in monitoring for GKE
- **Prometheus + Grafana**: For custom metrics and dashboards
- **ELK Stack**: For centralized logging

### CI/CD Integration
Consider integrating with:
- **Google Cloud Build**: Native GCP CI/CD
- **Jenkins**: Popular open-source automation server
- **GitLab CI/CD**: Integrated with GitLab repositories
- **GitHub Actions**: For GitHub-hosted projects

### Cost Optimization
- Use **Preemptible VMs** for non-critical workloads
- Enable **Cluster Autoscaler** to scale nodes based on demand
- Use **Vertical Pod Autoscaler** to optimize resource requests
- Monitor costs with **GCP Cost Management**

---

## Support and Troubleshooting

For issues or questions:
1. Check the [Troubleshooting](#monitoring-and-troubleshooting) section above
2. Review GKE logs in Google Cloud Console
3. Consult Kubernetes and GKE documentation
4. Contact your DevOps or platform team

---

## Changelog

### Version 1.0.0 (Initial Release)
- Initial containerization setup
- GKE deployment configuration
- Basic monitoring and health checks
- Documentation and deployment scripts

---

**Last Updated**: 2024
**Maintained By**: DevOps Team
