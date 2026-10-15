#!/bin/bash
set -e
set -o pipefail

echo "=========================================="
echo "GKE Deployment Script"
echo "=========================================="
echo ""

# Prompt for GCP configuration
echo "=== GCP Configuration ==="
read -p "Enter GCP Project ID: " GCP_PROJECT
read -p "Enter GCP Zone (e.g., us-central1-a): " GCP_ZONE
read -p "Enter GKE Cluster Name: " CLUSTER_NAME

echo ""
echo "=== Docker Image Configuration ==="
read -p "Enter Docker Image URI (with tag): " IMAGE_URI

if [ -z "$IMAGE_URI" ]; then
    echo "ERROR: Image URI cannot be empty"
    exit 1
fi

echo ""
echo "=========================================="
echo "Configuring kubectl for GKE"
echo "=========================================="
echo ""

# Configure kubectl to use the GKE cluster
gcloud container clusters get-credentials "$CLUSTER_NAME" --zone "$GCP_ZONE" --project "$GCP_PROJECT"

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to configure kubectl for GKE cluster"
    exit 1
fi

# Verify cluster connectivity
echo ""
echo "Verifying cluster connectivity..."
kubectl cluster-info || exit 1

echo ""
echo "=========================================="
echo "Updating Kubernetes Manifests"
echo "=========================================="
echo ""

# Update deployment.yaml with the image URI
sed -i.bak "s|{{IMAGE_URI}}|$IMAGE_URI|g" kubernetes/deployment.yaml

echo "Updated deployment.yaml with image: $IMAGE_URI"

echo ""
echo "=========================================="
echo "Deploying to GKE"
echo "=========================================="
echo ""

# Apply Kubernetes manifests in order
echo "Creating namespace..."
kubectl apply -f kubernetes/namespace.yaml

echo ""
echo "Deploying application..."
kubectl apply -f kubernetes/deployment.yaml

echo ""
echo "Creating service..."
kubectl apply -f kubernetes/service.yaml

echo ""
echo "Creating ingress..."
kubectl apply -f kubernetes/ingress.yaml

echo ""
echo "=========================================="
echo "Waiting for Deployment Rollout"
echo "=========================================="
echo ""

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
echo "Deployment Status"
echo "=========================================="
echo ""

kubectl get pods,svc,ingress -n react-nextjs-host

echo ""
echo "=========================================="
echo "Deployment Completed Successfully!"
echo "=========================================="
echo ""
echo "Application Details:"
echo "  Namespace: react-nextjs-host"
echo "  Deployment: react-nextjs-host"
echo "  Service: react-nextjs-host-service"
echo "  Ingress: react-nextjs-host-ingress"
echo ""
echo "To check application logs:"
echo "  kubectl logs -n react-nextjs-host -l app=react-nextjs-host -f"
echo ""
echo "To check pod status:"
echo "  kubectl get pods -n react-nextjs-host"
echo ""
echo "To access the application:"
echo "  1. Get the ingress IP: kubectl get ingress -n react-nextjs-host"
echo "  2. Configure DNS or use the IP directly"
echo "  3. Access: http://react-nextjs-host.example.com"
echo ""
echo "To rollback if needed:"
echo "  kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host"
echo ""
