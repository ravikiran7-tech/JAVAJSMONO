#!/bin/bash
set -e
set -o pipefail

APP_NAME="react-nextjs-host"
NAMESPACE="react-nextjs-host"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "============================================"
echo "  Deploy to AWS EKS"
echo "  Application: $APP_NAME"
echo "============================================"
echo ""

# Prompt for AWS region
read -p "Enter AWS Region (e.g. us-east-1): " AWS_REGION
if [ -z "$AWS_REGION" ]; then
  echo "ERROR: AWS Region is required."
  exit 1
fi

# Prompt for EKS cluster name
read -p "Enter EKS Cluster Name: " CLUSTER_NAME
if [ -z "$CLUSTER_NAME" ]; then
  echo "ERROR: EKS Cluster Name is required."
  exit 1
fi

# Prompt for Docker image URI
read -p "Enter full Docker image URI (e.g. 123456789.dkr.ecr.us-east-1.amazonaws.com/react-nextjs-host:latest): " IMAGE_URI
if [ -z "$IMAGE_URI" ]; then
  echo "ERROR: Docker image URI is required."
  exit 1
fi

echo ""
echo "Configuring kubectl for EKS cluster: $CLUSTER_NAME in $AWS_REGION..."
aws eks update-kubeconfig --region "$AWS_REGION" --name "$CLUSTER_NAME"

echo "Verifying cluster connectivity..."
kubectl cluster-info || { echo "ERROR: Cannot connect to EKS cluster."; exit 1; }

echo ""
echo "Updating Kubernetes manifests with image URI..."
cd "$PROJECT_ROOT"

# Replace {{IMAGE_URI}} placeholder in deployment.yaml
sed -i "s|{{IMAGE_URI}}|${IMAGE_URI}|g" kubernetes/deployment.yaml

echo ""
echo "Applying Kubernetes manifests..."

echo "  -> Applying namespace..."
kubectl apply -f kubernetes/namespace.yaml

echo "  -> Applying deployment..."
kubectl apply -f kubernetes/deployment.yaml

echo "  -> Applying service..."
kubectl apply -f kubernetes/service.yaml

echo "  -> Applying ingress..."
kubectl apply -f kubernetes/ingress.yaml

echo ""
echo "Waiting for deployment rollout..."
kubectl rollout status deployment/$APP_NAME -n $NAMESPACE --timeout=300s

echo ""
echo "Verifying deployed resources..."
kubectl get pods,svc,ingress -n $NAMESPACE

echo ""
echo "============================================"
echo "  Deployment complete!"
echo "  Application: $APP_NAME"
echo "  Namespace:   $NAMESPACE"
echo "  Image:       $IMAGE_URI"
echo "============================================"
echo ""
echo "To get the application URL:"
echo "  kubectl get ingress -n $NAMESPACE"
echo ""
echo "To rollback if needed:"
echo "  kubectl rollout undo deployment/$APP_NAME -n $NAMESPACE"
