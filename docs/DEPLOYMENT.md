# Deployment Guide — react-nextjs-host on AWS EKS

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Project Overview](#project-overview)
3. [Local Development with Docker Compose](#local-development-with-docker-compose)
4. [Build & Push Docker Image](#build--push-docker-image)
5. [AWS EKS Prerequisites](#aws-eks-prerequisites)
6. [EKS Cluster Setup](#eks-cluster-setup)
7. [Kubernetes Deployment](#kubernetes-deployment)
8. [Verification & Monitoring](#verification--monitoring)
9. [Scaling & Management](#scaling--management)
10. [Troubleshooting](#troubleshooting)
11. [Security Considerations](#security-considerations)
12. [Configuration Management](#configuration-management)

---

## Prerequisites

### Local Tools Required
| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 20.10+ | Build and run containers |
| Docker Compose | 2.x | Local development |
| AWS CLI | 2.x | AWS authentication and ECR |
| kubectl | 1.27+ | Kubernetes cluster management |
| eksctl | 0.150+ | EKS cluster provisioning (optional) |
| Java | 17 | Local development (optional) |
| Maven | 3.9+ | Local build (optional) |

### AWS Permissions Required
- `ecr:GetAuthorizationToken`
- `ecr:BatchCheckLayerAvailability`
- `ecr:PutImage`
- `ecr:InitiateLayerUpload`
- `ecr:UploadLayerPart`
- `ecr:CompleteLayerUpload`
- `ecr:CreateRepository`
- `eks:DescribeCluster`
- `eks:UpdateKubeconfig`

---

## Project Overview

| Property | Value |
|----------|-------|
| **Application Name** | react-nextjs-host |
| **Artifact ID** | react-nextjs-host |
| **Java Version** | 17 |
| **Build Tool** | Maven 3.9.x |
| **Package Type** | JAR |
| **Application Port** | 8080 |
| **Health Endpoint** | `/api/health` |
| **Base Image (Runtime)** | `amazoncorretto:17` |
| **Builder Image** | `maven:3.9.4-eclipse-temurin-17` |
| **Main Class** | `com.trianz.reactnextjs.Application` |

---

## Local Development with Docker Compose

### Start the Application
```bash
# Build and start the application container
docker-compose up --build

# Run in detached mode
docker-compose up --build -d

# View logs
docker-compose logs -f react-nextjs-host

# Stop the application
docker-compose down
```

### Verify the Application
```bash
# Check health endpoint
curl http://localhost:8080/api/health
# Expected: {"status":"UP"}
```

---

## Build & Push Docker Image

### Linux / macOS
```bash
# Make the script executable
chmod +x scripts/build-push.sh

# Run the build and push script
./scripts/build-push.sh
```

The script will prompt you to:
1. Enter an image tag (defaults to `latest`)
2. Select registry type: **AWS ECR** or **Docker Hub**
3. Provide registry credentials and repository details

### Windows
```cmd
scripts\build-push.bat
```

### Manual Docker Build
```bash
# Build the image
docker build -t react-nextjs-host:latest .

# Tag for ECR
docker tag react-nextjs-host:latest <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/react-nextjs-host:latest

# Push to ECR
docker push <ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/react-nextjs-host:latest
```

---

## AWS EKS Prerequisites

### 1. Configure AWS CLI
```bash
aws configure
# Enter: AWS Access Key ID, Secret Access Key, Region, Output format
```

### 2. Verify AWS Identity
```bash
aws sts get-caller-identity
```

### 3. Install kubectl
```bash
# macOS
brew install kubectl

# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/

# Windows (via Chocolatey)
choco install kubernetes-cli
```

### 4. Install AWS Load Balancer Controller (for Ingress)
The ingress manifest uses the AWS Load Balancer Controller. Install it on your EKS cluster:
```bash
# Add the EKS chart repo
helm repo add eks https://aws.github.io/eks-charts
helm repo update

# Install the controller
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=<YOUR_CLUSTER_NAME> \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

---

## EKS Cluster Setup

### Create a New EKS Cluster (if needed)
```bash
eksctl create cluster \
  --name react-nextjs-host-cluster \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed
```

### Configure kubectl for Existing Cluster
```bash
aws eks update-kubeconfig --region <AWS_REGION> --name <CLUSTER_NAME>

# Verify connectivity
kubectl cluster-info
kubectl get nodes
```

---

## Kubernetes Deployment

### Automated Deployment (Recommended)

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
- AWS Region
- EKS Cluster Name
- Full Docker image URI (with tag)

### Manual Deployment

#### Step 1: Update the Image URI in deployment.yaml
```bash
sed -i 's|{{IMAGE_URI}}|<YOUR_IMAGE_URI>|g' kubernetes/deployment.yaml
```

#### Step 2: Apply Manifests in Order
```bash
# 1. Create namespace
kubectl apply -f kubernetes/namespace.yaml

# 2. Deploy the application
kubectl apply -f kubernetes/deployment.yaml

# 3. Create the service
kubectl apply -f kubernetes/service.yaml

# 4. Create the ingress
kubectl apply -f kubernetes/ingress.yaml
```

#### Step 3: Wait for Rollout
```bash
kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host --timeout=300s
```

---

## Verification & Monitoring

### Check Pod Status
```bash
kubectl get pods -n react-nextjs-host
kubectl describe pod <POD_NAME> -n react-nextjs-host
```

### Check Logs
```bash
kubectl logs -f deployment/react-nextjs-host -n react-nextjs-host
```

### Check Service and Ingress
```bash
kubectl get svc,ingress -n react-nextjs-host
```

### Get Application URL
```bash
kubectl get ingress react-nextjs-host-ingress -n react-nextjs-host -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'
```

### Test Health Endpoint
```bash
# Replace <INGRESS_HOST> with the actual hostname from above
curl http://<INGRESS_HOST>/api/health
# Expected: {"status":"UP"}
```

---

## Scaling & Management

### Manual Scaling
```bash
# Scale to 3 replicas
kubectl scale deployment react-nextjs-host --replicas=3 -n react-nextjs-host
```

### Horizontal Pod Autoscaler (HPA)
```bash
kubectl autoscale deployment react-nextjs-host \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n react-nextjs-host
```

### Rolling Update (New Image)
```bash
kubectl set image deployment/react-nextjs-host \
  react-nextjs-host=<NEW_IMAGE_URI> \
  -n react-nextjs-host

kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host
```

### Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host

# Rollback to specific revision
kubectl rollout history deployment/react-nextjs-host -n react-nextjs-host
kubectl rollout undo deployment/react-nextjs-host --to-revision=<REVISION> -n react-nextjs-host
```

---

## Troubleshooting

### Pod Not Starting
```bash
# Check pod events
kubectl describe pod <POD_NAME> -n react-nextjs-host

# Check pod logs
kubectl logs <POD_NAME> -n react-nextjs-host --previous
```

### ImagePullBackOff
- Verify the image URI is correct
- Ensure the EKS node IAM role has ECR pull permissions (`AmazonEC2ContainerRegistryReadOnly`)
- Check ECR repository exists in the correct region

### CrashLoopBackOff
```bash
# Check application logs
kubectl logs <POD_NAME> -n react-nextjs-host

# Common causes:
# - JVM out of memory: increase memory limits in deployment.yaml
# - Port conflict: verify containerPort matches application port (8080)
# - Missing environment variables
```

### Health Probe Failures
- The application exposes `/api/health` on port 8080
- Increase `initialDelaySeconds` if JVM startup is slow (default: 30s for liveness, 20s for readiness)
- Check that the application started successfully in logs

### Ingress Not Accessible
```bash
# Check ingress status
kubectl describe ingress react-nextjs-host-ingress -n react-nextjs-host

# Verify AWS Load Balancer Controller is running
kubectl get pods -n kube-system | grep aws-load-balancer-controller

# Check ALB is provisioned
kubectl get ingress -n react-nextjs-host
```

### Service Not Routing
```bash
# Verify service endpoints
kubectl get endpoints react-nextjs-host-service -n react-nextjs-host

# Test service from within cluster
kubectl run test-pod --image=busybox --rm -it --restart=Never -- \
  wget -qO- http://react-nextjs-host-service.react-nextjs-host.svc.cluster.local/api/health
```

---

## Security Considerations

1. **Non-root Container**: The application runs as a non-root user (`appuser`) inside the container.
2. **Image Scanning**: Enable ECR image scanning to detect vulnerabilities.
3. **Secrets Management**: Use Kubernetes Secrets or AWS Secrets Manager for sensitive configuration.
4. **Network Policies**: Apply Kubernetes NetworkPolicies to restrict pod-to-pod communication.
5. **RBAC**: Use least-privilege IAM roles for EKS node groups and service accounts.
6. **TLS**: Configure HTTPS on the ALB ingress using ACM certificates:
   ```yaml
   annotations:
     alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:<REGION>:<ACCOUNT>:certificate/<CERT_ID>
     alb.ingress.kubernetes.io/listen-ports: '[{"HTTPS":443}]'
   ```

---

## Configuration Management

### Environment Variables
The application uses the following environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `TZ` | `UTC` | Timezone setting |
| `JAVA_OPTS` | See Dockerfile | JVM tuning flags |

### JVM Tuning
The default JVM options are:
```
-XX:+UseContainerSupport
-XX:MaxRAMPercentage=75.0
-XX:+UnlockExperimentalVMOptions
-Xms256m
-Xmx512m
-Dfile.encoding=UTF-8
-Duser.timezone=UTC
```

Adjust `JAVA_OPTS` in `kubernetes/deployment.yaml` or `docker-compose.yml` as needed.

### Resource Limits
Default Kubernetes resource configuration:
```yaml
resources:
  requests:
    cpu: "250m"
    memory: "512Mi"
  limits:
    cpu: "500m"
    memory: "1Gi"
```

Adjust these values in `kubernetes/deployment.yaml` based on observed usage.

---

## Technology-Specific Notes

### Java 17 on Amazon Corretto
- The runtime image uses `amazoncorretto:17` (Amazon's OpenJDK distribution)
- Container-aware JVM flags (`-XX:+UseContainerSupport`) ensure the JVM respects cgroup memory/CPU limits
- `-XX:MaxRAMPercentage=75.0` allows the JVM to use up to 75% of the container's memory limit

### Maven Build
- The builder stage uses `maven:3.9.4-eclipse-temurin-17`
- Dependencies are cached in a separate Docker layer (copy `pom.xml` → download deps → copy source)
- Build command: `mvn clean package -DskipTests -B`
- Output artifact: `target/react-nextjs-host.jar`

### Health Check
- Endpoint: `GET /api/health`
- Response: `{"status":"UP"}`
- Used for both Kubernetes liveness and readiness probes
