#!/bin/bash
set -e
set -o pipefail

# Deploy Docker image to AWS EKS
# This script configures kubectl and deploys the application to EKS

echo "=========================================="
echo "AWS EKS Deployment Script"
echo "=========================================="
echo ""

# Prompt for AWS EKS configuration
read -p "Enter AWS Region (e.g., us-east-1): " AWS_REGION
read -p "Enter EKS Cluster Name: " CLUSTER_NAME
read -p "Enter Docker Image URI (with tag): " IMAGE_URI

echo ""
echo "=== Optional Environment Variables ==="
echo "Press Enter to skip any variable you don't need to configure"
echo ""

# Prompt for application-specific environment variables
read -p "Enter API_URL (or press Enter to skip): " API_URL
read -p "Enter BACKEND_URL (or press Enter to skip): " BACKEND_URL
read -p "Enter S3_BUCKET_NAME (or press Enter to skip): " S3_BUCKET_NAME
read -p "Enter FEATURE_FLAG (or press Enter to skip): " FEATURE_FLAG
read -p "Enter REDIS_HOST (or press Enter to skip): " REDIS_HOST
read -p "Enter REDIS_PORT (default: 6379): " REDIS_PORT
REDIS_PORT=${REDIS_PORT:-6379}
read -p "Enter AWS_REGION for S3 (default: $AWS_REGION): " S3_AWS_REGION
S3_AWS_REGION=${S3_AWS_REGION:-$AWS_REGION}

echo ""
echo "=========================================="
echo "Configuring kubectl for EKS cluster..."
echo "=========================================="

# Configure kubectl to use EKS cluster
aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME"

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to configure kubectl for EKS cluster"
    exit 1
fi

# Verify cluster connectivity
echo ""
echo "Verifying cluster connectivity..."
kubectl cluster-info

if [ $? -ne 0 ]; then
    echo "ERROR: Cannot connect to Kubernetes cluster"
    exit 1
fi

echo ""
echo "=========================================="
echo "Updating Kubernetes manifests..."
echo "=========================================="

# Create temporary directory for processed manifests
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy manifests to temp directory
cp -r kubernetes/* "$TEMP_DIR/"

# Replace placeholders in deployment.yaml
sed -i.bak "s|{{IMAGE_URI}}|$IMAGE_URI|g" "$TEMP_DIR/deployment.yaml"
sed -i.bak "s|{{API_URL}}|${API_URL:-}|g" "$TEMP_DIR/deployment.yaml"
sed -i.bak "s|{{BACKEND_URL}}|${BACKEND_URL:-}|g" "$TEMP_DIR/deployment.yaml"
sed -i.bak "s|{{S3_BUCKET_NAME}}|${S3_BUCKET_NAME:-}|g" "$TEMP_DIR/deployment.yaml"
sed -i.bak "s|{{FEATURE_FLAG}}|${FEATURE_FLAG:-false}|g" "$TEMP_DIR/deployment.yaml"
sed -i.bak "s|{{REDIS_HOST}}|${REDIS_HOST:-}|g" "$TEMP_DIR/deployment.yaml"
sed -i.bak "s|{{REDIS_PORT}}|${REDIS_PORT}|g" "$TEMP_DIR/deployment.yaml"
sed -i.bak "s|{{AWS_REGION}}|${S3_AWS_REGION}|g" "$TEMP_DIR/deployment.yaml"

# Remove backup files
rm -f "$TEMP_DIR"/*.bak

echo "Manifests updated successfully"

echo ""
echo "=========================================="
echo "Deploying to EKS cluster..."
echo "=========================================="

# Apply Kubernetes manifests in order
echo ""
echo "Creating namespace..."
kubectl apply -f "$TEMP_DIR/namespace.yaml"

echo ""
echo "Deploying application..."
kubectl apply -f "$TEMP_DIR/deployment.yaml"

echo ""
echo "Creating service..."
kubectl apply -f "$TEMP_DIR/service.yaml"

echo ""
echo "Creating ingress..."
kubectl apply -f "$TEMP_DIR/ingress.yaml"

echo ""
echo "=========================================="
echo "Waiting for deployment to complete..."
echo "=========================================="

# Wait for deployment rollout
kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host --timeout=5m

if [ $? -ne 0 ]; then
    echo "ERROR: Deployment rollout failed"
    echo ""
    echo "Checking pod status..."
    kubectl get pods -n react-nextjs-host
    echo ""
    echo "Checking pod logs..."
    kubectl logs -n react-nextjs-host -l app=react-nextjs-host --tail=50
    exit 1
fi

echo ""
echo "=========================================="
echo "Deployment successful!"
echo "=========================================="

# Display deployment information
echo ""
echo "=== Deployment Status ==="
kubectl get pods -n react-nextjs-host
echo ""
kubectl get svc -n react-nextjs-host
echo ""
kubectl get ingress -n react-nextjs-host

echo ""
echo "=========================================="
echo "Application Access Information"
echo "=========================================="
echo ""
echo "To get the application URL, run:"
echo "  kubectl get ingress react-nextjs-host-ingress -n react-nextjs-host -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'"
echo ""
echo "To view application logs:"
echo "  kubectl logs -n react-nextjs-host -l app=react-nextjs-host -f"
echo ""
echo "To scale the deployment:"
echo "  kubectl scale deployment/react-nextjs-host -n react-nextjs-host --replicas=3"
echo ""
echo "To rollback the deployment:"
echo "  kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host"
echo ""
echo "=========================================="
