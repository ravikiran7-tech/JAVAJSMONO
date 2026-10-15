# Deployment Guide for react-nextjs-host

This guide provides comprehensive instructions for deploying the react-nextjs-host Java application to AWS EKS (Elastic Kubernetes Service).

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Overview](#project-overview)
3. [Local Development Setup](#local-development-setup)
4. [Building and Pushing Docker Images](#building-and-pushing-docker-images)
5. [AWS EKS Prerequisites](#aws-eks-prerequisites)
6. [EKS Cluster Setup](#eks-cluster-setup)
7. [Kubernetes Deployment](#kubernetes-deployment)
8. [Configuration Management](#configuration-management)
9. [Troubleshooting](#troubleshooting)
10. [Scaling and Management](#scaling-and-management)
11. [Security Considerations](#security-considerations)

---

## Prerequisites

### Required Tools

- **Java 17**: Application runtime
- **Maven 3.9+**: Build tool
- **Docker**: Container runtime (20.10+)
- **AWS CLI**: AWS command-line interface (v2.x)
- **kubectl**: Kubernetes command-line tool (v1.28+)
- **eksctl** (optional): EKS cluster management tool

### AWS Account Requirements

- AWS account with appropriate IAM permissions
- Access to AWS ECR (Elastic Container Registry)
- Access to AWS EKS (Elastic Kubernetes Service)
- Access to AWS ElastiCache (Redis) for session management
- Access to AWS S3 for file uploads

### IAM Permissions Required

Your AWS user/role needs the following permissions:
- `ecr:*` - ECR repository management
- `eks:*` - EKS cluster access
- `ec2:*` - VPC and networking
- `iam:*` - IAM role management for EKS
- `elasticache:*` - Redis cluster management
- `s3:*` - S3 bucket operations

---

## Project Overview

### Technology Stack

- **Language**: Java 17
- **Build Tool**: Maven
- **Framework**: Java HTTP Server (com.sun.net.httpserver)
- **Packaging**: JAR
- **Application Type**: REST API microservice
- **Target Platform**: AWS EKS (Kubernetes)

### Application Architecture

The application is a Java-based REST API that provides:
- Health check endpoints (`/api/health`)
- Session management via Redis (`/api/session`)
- Application state management via Redis (`/api/state`)
- S3 pre-signed URL generation (`/api/upload/presigned-url`)

### External Dependencies

- **Redis/ElastiCache**: Session and state management
- **AWS S3**: File upload storage
- **AWS IAM**: Authentication for S3 operations

### Application Ports

- **HTTP Port**: 8080 (configurable via `SERVER_PORT` environment variable)

---

## Local Development Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AWS_EKS1_MONO
```

### 2. Build the Application

```bash
# Using Maven
mvn clean package -DskipTests

# The JAR file will be created at: target/react-nextjs-host.jar
```

### 3. Run Locally

```bash
# Set environment variables
export SERVER_PORT=8080
export REDIS_HOST=localhost
export REDIS_PORT=6379
export AWS_REGION=us-east-1
export S3_BUCKET_NAME=my-bucket

# Run the application
java -jar target/react-nextjs-host.jar
```

### 4. Test the Application

```bash
# Health check
curl http://localhost:8080/api/health

# Expected response:
# {"status":"UP","timestamp":"2024-01-01T00:00:00Z"}
```

### 5. Docker Compose (Local Testing)

```bash
# Start the application with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

**Note**: Docker Compose configuration assumes external Redis and S3 services. Update environment variables in `docker-compose.yml` accordingly.

---

## Building and Pushing Docker Images

### Option 1: AWS ECR (Recommended for EKS)

#### Linux/macOS

```bash
# Make script executable
chmod +x scripts/build-push.sh

# Run the script
./scripts/build-push.sh

# Follow the prompts:
# 1. Select "1" for AWS ECR
# 2. Enter AWS Region (e.g., us-east-1)
# 3. Enter AWS Account ID
# 4. Enter ECR Repository Name (default: react-nextjs-host)
# 5. Enter image tag (default: latest)
```

#### Windows

```cmd
# Run the script
scripts\build-push.bat

# Follow the prompts (same as above)
```

### Option 2: Docker Hub

#### Linux/macOS

```bash
./scripts/build-push.sh

# Follow the prompts:
# 1. Select "2" for Docker Hub
# 2. Enter Docker Hub username
# 3. Enter Docker Hub password
# 4. Enter image tag (default: latest)
```

#### Windows

```cmd
scripts\build-push.bat

# Follow the prompts (same as above)
```

### Manual Build and Push

```bash
# Build the image
docker build -t react-nextjs-host:latest .

# Tag for ECR
docker tag react-nextjs-host:latest <account-id>.dkr.ecr.<region>.amazonaws.com/react-nextjs-host:latest

# Login to ECR
aws ecr get-login-password --region <region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

# Push to ECR
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/react-nextjs-host:latest
```

---

## AWS EKS Prerequisites

### 1. Install AWS CLI

```bash
# Linux/macOS
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Verify installation
aws --version
```

### 2. Configure AWS CLI

```bash
aws configure

# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (e.g., us-east-1)
# - Default output format (json)
```

### 3. Install kubectl

```bash
# Linux
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# macOS
brew install kubectl

# Windows (using Chocolatey)
choco install kubernetes-cli

# Verify installation
kubectl version --client
```

### 4. Install eksctl (Optional)

```bash
# Linux/macOS
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin

# Verify installation
eksctl version
```

---

## EKS Cluster Setup

### Option 1: Create EKS Cluster with eksctl

```bash
# Create a new EKS cluster
eksctl create cluster \
  --name react-nextjs-host-cluster \
  --region us-east-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 4 \
  --managed

# This will take 15-20 minutes
```

### Option 2: Use Existing EKS Cluster

```bash
# Configure kubectl to use existing cluster
aws eks update-kubeconfig --region <region> --name <cluster-name>

# Verify connectivity
kubectl cluster-info
kubectl get nodes
```

### Install AWS Load Balancer Controller

The AWS Load Balancer Controller is required for Ingress resources:

```bash
# Create IAM policy
curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.6.0/docs/install/iam_policy.json

aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam_policy.json

# Create IAM role and service account
eksctl create iamserviceaccount \
  --cluster=<cluster-name> \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::<account-id>:policy/AWSLoadBalancerControllerIAMPolicy \
  --approve

# Install the controller using Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update

helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=<cluster-name> \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

---

## Kubernetes Deployment

### Automated Deployment

#### Linux/macOS

```bash
# Make script executable
chmod +x scripts/deploy-image.sh

# Run the deployment script
./scripts/deploy-image.sh

# Follow the prompts:
# 1. Enter AWS Region
# 2. Enter EKS Cluster Name
# 3. Enter Docker Image URI (e.g., <account-id>.dkr.ecr.<region>.amazonaws.com/react-nextjs-host:latest)
# 4. Enter environment variables (or press Enter to skip)
```

#### Windows

```cmd
# Run the deployment script
scripts\deploy-image.bat

# Follow the prompts (same as above)
```

### Manual Deployment

#### 1. Update Kubernetes Manifests

Edit `kubernetes/deployment.yaml` and replace placeholders:

```yaml
# Replace {{IMAGE_URI}} with your actual image URI
image: <account-id>.dkr.ecr.<region>.amazonaws.com/react-nextjs-host:latest

# Update environment variables
env:
- name: API_URL
  value: "https://api.example.com"
- name: BACKEND_URL
  value: "https://backend.example.com"
- name: REDIS_HOST
  value: "redis.example.com"
# ... etc
```

#### 2. Create Kubernetes Secrets

```bash
# Create Redis credentials secret
kubectl create secret generic redis-credentials \
  --from-literal=password=<redis-password> \
  -n react-nextjs-host

# Create AWS credentials secret
kubectl create secret generic aws-credentials \
  --from-literal=access-key-id=<aws-access-key> \
  --from-literal=secret-access-key=<aws-secret-key> \
  -n react-nextjs-host
```

#### 3. Apply Kubernetes Manifests

```bash
# Create namespace
kubectl apply -f kubernetes/namespace.yaml

# Deploy application
kubectl apply -f kubernetes/deployment.yaml

# Create service
kubectl apply -f kubernetes/service.yaml

# Create ingress
kubectl apply -f kubernetes/ingress.yaml
```

#### 4. Verify Deployment

```bash
# Check deployment status
kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host

# Check pods
kubectl get pods -n react-nextjs-host

# Check services
kubectl get svc -n react-nextjs-host

# Check ingress
kubectl get ingress -n react-nextjs-host
```

#### 5. Get Application URL

```bash
# Get the ALB hostname
kubectl get ingress react-nextjs-host-ingress -n react-nextjs-host -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'

# The application will be accessible at:
# http://<alb-hostname>/api/health
```

---

## Configuration Management

### Environment Variables

The application requires the following environment variables:

#### Server Configuration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `SERVER_PORT` | HTTP server port | No | 8080 |

#### Frontend Runtime Configuration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `API_URL` | Frontend API URL | Yes | - |
| `BACKEND_URL` | Backend service URL | Yes | - |
| `S3_BUCKET_NAME` | S3 bucket name | Yes | - |
| `FEATURE_FLAG` | Feature flag | No | false |

#### Redis Configuration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `REDIS_HOST` | Redis/ElastiCache endpoint | Yes | - |
| `REDIS_PORT` | Redis port | No | 6379 |
| `REDIS_PASSWORD` | Redis password | No | - |

#### AWS S3 Configuration

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `AWS_REGION` | AWS region | Yes | - |
| `AWS_ACCESS_KEY_ID` | AWS access key | Yes | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Yes | - |

### Kubernetes ConfigMaps

Create a ConfigMap for non-sensitive configuration:

```bash
kubectl create configmap app-config \
  --from-literal=API_URL=https://api.example.com \
  --from-literal=BACKEND_URL=https://backend.example.com \
  --from-literal=S3_BUCKET_NAME=my-bucket \
  -n react-nextjs-host
```

Update `deployment.yaml` to use ConfigMap:

```yaml
env:
- name: API_URL
  valueFrom:
    configMapKeyRef:
      name: app-config
      key: API_URL
```

### Kubernetes Secrets

Store sensitive data in Secrets:

```bash
# Create secrets
kubectl create secret generic redis-credentials \
  --from-literal=password=<redis-password> \
  -n react-nextjs-host

kubectl create secret generic aws-credentials \
  --from-literal=access-key-id=<aws-access-key> \
  --from-literal=secret-access-key=<aws-secret-key> \
  -n react-nextjs-host
```

---

## Troubleshooting

### Pod Failures

#### Check Pod Status

```bash
kubectl get pods -n react-nextjs-host
```

#### View Pod Logs

```bash
# View logs for a specific pod
kubectl logs <pod-name> -n react-nextjs-host

# View logs for all pods with label
kubectl logs -n react-nextjs-host -l app=react-nextjs-host --tail=100

# Follow logs in real-time
kubectl logs -n react-nextjs-host -l app=react-nextjs-host -f
```

#### Describe Pod

```bash
kubectl describe pod <pod-name> -n react-nextjs-host
```

#### Common Issues

**Issue**: Pod stuck in `ImagePullBackOff`
- **Cause**: Cannot pull Docker image from registry
- **Solution**: 
  - Verify image URI is correct
  - Check ECR permissions
  - Ensure EKS nodes have IAM role with ECR access

**Issue**: Pod stuck in `CrashLoopBackOff`
- **Cause**: Application crashes on startup
- **Solution**:
  - Check pod logs: `kubectl logs <pod-name> -n react-nextjs-host`
  - Verify environment variables are set correctly
  - Check Redis and S3 connectivity

**Issue**: Liveness/Readiness probe failures
- **Cause**: Health check endpoint not responding
- **Solution**:
  - Verify `/api/health` endpoint is accessible
  - Increase `initialDelaySeconds` in probe configuration
  - Check application logs for errors

### Service Issues

#### Check Service

```bash
kubectl get svc -n react-nextjs-host
kubectl describe svc react-nextjs-host-service -n react-nextjs-host
```

#### Test Service Connectivity

```bash
# Port-forward to test locally
kubectl port-forward svc/react-nextjs-host-service 8080:80 -n react-nextjs-host

# Test in another terminal
curl http://localhost:8080/api/health
```

### Ingress Issues

#### Check Ingress

```bash
kubectl get ingress -n react-nextjs-host
kubectl describe ingress react-nextjs-host-ingress -n react-nextjs-host
```

#### Common Issues

**Issue**: Ingress not creating ALB
- **Cause**: AWS Load Balancer Controller not installed
- **Solution**: Install AWS Load Balancer Controller (see EKS Cluster Setup)

**Issue**: ALB created but not routing traffic
- **Cause**: Security group or target group misconfiguration
- **Solution**:
  - Check ALB target groups in AWS Console
  - Verify security groups allow traffic on port 80/443
  - Check ALB health checks

### Redis Connection Issues

#### Test Redis Connectivity

```bash
# Exec into pod
kubectl exec -it <pod-name> -n react-nextjs-host -- /bin/bash

# Test Redis connection (if redis-cli is available)
redis-cli -h <redis-host> -p 6379 ping
```

#### Common Issues

**Issue**: Cannot connect to Redis
- **Cause**: Network connectivity or security group issues
- **Solution**:
  - Verify Redis endpoint is correct
  - Check security groups allow traffic from EKS nodes
  - Verify Redis is in the same VPC or VPC peering is configured

### S3 Access Issues

#### Check IAM Permissions

```bash
# Test S3 access from pod
kubectl exec -it <pod-name> -n react-nextjs-host -- /bin/bash
aws s3 ls s3://<bucket-name>
```

#### Common Issues

**Issue**: Access Denied errors
- **Cause**: IAM permissions insufficient
- **Solution**:
  - Verify AWS credentials are correct
  - Check IAM policy allows S3 operations
  - Use IAM roles for service accounts (IRSA) instead of access keys

---

## Scaling and Management

### Horizontal Pod Autoscaling (HPA)

#### Create HPA

```bash
kubectl autoscale deployment react-nextjs-host \
  --cpu-percent=70 \
  --min=2 \
  --max=10 \
  -n react-nextjs-host
```

#### Check HPA Status

```bash
kubectl get hpa -n react-nextjs-host
```

### Manual Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment/react-nextjs-host --replicas=5 -n react-nextjs-host

# Verify scaling
kubectl get pods -n react-nextjs-host
```

### Rolling Updates

```bash
# Update image
kubectl set image deployment/react-nextjs-host \
  react-nextjs-host=<new-image-uri> \
  -n react-nextjs-host

# Check rollout status
kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host

# View rollout history
kubectl rollout history deployment/react-nextjs-host -n react-nextjs-host
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host

# Rollback to specific revision
kubectl rollout undo deployment/react-nextjs-host --to-revision=2 -n react-nextjs-host
```

### Resource Monitoring

```bash
# View resource usage
kubectl top pods -n react-nextjs-host
kubectl top nodes

# View detailed metrics
kubectl describe node <node-name>
```

---

## Security Considerations

### 1. Use Non-Root User

The Dockerfile already configures a non-root user (`appuser`). Verify in deployment:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  allowPrivilegeEscalation: false
```

### 2. Use Kubernetes Secrets

Never store sensitive data in ConfigMaps or environment variables directly. Use Secrets:

```bash
kubectl create secret generic app-secrets \
  --from-literal=redis-password=<password> \
  --from-literal=aws-secret-key=<secret> \
  -n react-nextjs-host
```

### 3. Use IAM Roles for Service Accounts (IRSA)

Instead of using AWS access keys, use IRSA:

```bash
# Create IAM role for service account
eksctl create iamserviceaccount \
  --name react-nextjs-host-sa \
  --namespace react-nextjs-host \
  --cluster <cluster-name> \
  --attach-policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess \
  --approve

# Update deployment to use service account
kubectl patch deployment react-nextjs-host \
  -n react-nextjs-host \
  -p '{"spec":{"template":{"spec":{"serviceAccountName":"react-nextjs-host-sa"}}}}'
```

### 4. Network Policies

Implement network policies to restrict pod-to-pod communication:

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
      port: 6379  # Redis
    - protocol: TCP
      port: 443   # HTTPS (S3)
```

### 5. Enable Pod Security Standards

```bash
kubectl label namespace react-nextjs-host \
  pod-security.kubernetes.io/enforce=restricted \
  pod-security.kubernetes.io/audit=restricted \
  pod-security.kubernetes.io/warn=restricted
```

### 6. Regular Security Updates

- Keep base images updated
- Scan images for vulnerabilities using tools like Trivy or Snyk
- Update dependencies regularly

```bash
# Scan image with Trivy
trivy image <image-uri>
```

### 7. Enable Encryption

- Enable encryption at rest for EKS secrets
- Use TLS/SSL for all external communication
- Enable encryption for ElastiCache Redis
- Enable encryption for S3 buckets

---

## Additional Resources

### AWS Documentation

- [Amazon EKS User Guide](https://docs.aws.amazon.com/eks/latest/userguide/)
- [AWS Load Balancer Controller](https://kubernetes-sigs.github.io/aws-load-balancer-controller/)
- [Amazon ElastiCache for Redis](https://docs.aws.amazon.com/elasticache/latest/red-ug/)
- [Amazon S3 User Guide](https://docs.aws.amazon.com/s3/index.html)

### Kubernetes Documentation

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)

### Java Documentation

- [Java 17 Documentation](https://docs.oracle.com/en/java/javase/17/)
- [Maven Documentation](https://maven.apache.org/guides/)

---

## Support and Maintenance

### Monitoring

Set up monitoring using:
- **AWS CloudWatch**: Container Insights for EKS
- **Prometheus + Grafana**: Metrics collection and visualization
- **ELK Stack**: Log aggregation and analysis

### Backup and Disaster Recovery

- Regular backups of Redis data
- S3 bucket versioning and lifecycle policies
- EKS cluster backup using Velero

### Cost Optimization

- Use Spot Instances for non-critical workloads
- Implement cluster autoscaling
- Right-size pod resource requests and limits
- Use S3 lifecycle policies for old data

---

## Conclusion

This deployment guide provides comprehensive instructions for deploying the react-nextjs-host application to AWS EKS. Follow the steps carefully and refer to the troubleshooting section if you encounter any issues.

For additional support, consult the AWS and Kubernetes documentation or contact your DevOps team.
