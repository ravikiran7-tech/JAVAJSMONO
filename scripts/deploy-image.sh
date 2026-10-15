#!/bin/bash
set -e
set -o pipefail

# Deploy to Azure AKS Script
# Deploys the react-nextjs-host application to Azure Kubernetes Service

echo "=========================================="
echo "Azure AKS Deployment Script"
echo "Application: react-nextjs-host"
echo "=========================================="
echo ""

# Prompt for Azure resource group
read -r -p "Enter Azure Resource Group name: " RESOURCE_GROUP

if [ -z "$RESOURCE_GROUP" ]; then
    echo "Error: Resource Group name cannot be empty"
    exit 1
fi

# Prompt for AKS cluster name
read -r -p "Enter AKS Cluster name: " CLUSTER_NAME

if [ -z "$CLUSTER_NAME" ]; then
    echo "Error: AKS Cluster name cannot be empty"
    exit 1
fi

# Prompt for Docker image URI
read -r -p "Enter Docker image URI (e.g., myregistry.azurecr.io/react-nextjs-host:latest): " IMAGE_URI

if [ -z "$IMAGE_URI" ]; then
    echo "Error: Docker image URI cannot be empty"
    exit 1
fi

echo ""
echo "=========================================="
echo "Configuring kubectl for AKS cluster..."
echo "=========================================="

az aks get-credentials --resource-group "$RESOURCE_GROUP" --name "$CLUSTER_NAME" --overwrite-existing

if [ $? -ne 0 ]; then
    echo "Error: Failed to get AKS credentials"
    exit 1
fi

echo ""
echo "Verifying cluster connectivity..."
kubectl cluster-info

if [ $? -ne 0 ]; then
    echo "Error: Failed to connect to Kubernetes cluster"
    exit 1
fi

echo ""
echo "=========================================="
echo "Updating Kubernetes manifests..."
echo "=========================================="

# Update deployment.yaml with the provided image URI
sed -i.bak "s|{{IMAGE_URI}}|$IMAGE_URI|g" kubernetes/deployment.yaml

echo "✓ Manifests updated with image: $IMAGE_URI"

echo ""
echo "=========================================="
echo "Applying Kubernetes manifests..."
echo "=========================================="

# Apply namespace
echo "Creating namespace..."
kubectl apply -f kubernetes/namespace.yaml

if [ $? -ne 0 ]; then
    echo "Error: Failed to create namespace"
    exit 1
fi

# Apply deployment
echo "Creating deployment..."
kubectl apply -f kubernetes/deployment.yaml

if [ $? -ne 0 ]; then
    echo "Error: Failed to create deployment"
    exit 1
fi

# Apply service
echo "Creating service..."
kubectl apply -f kubernetes/service.yaml

if [ $? -ne 0 ]; then
    echo "Error: Failed to create service"
    exit 1
fi

# Apply ingress
echo "Creating ingress..."
kubectl apply -f kubernetes/ingress.yaml

if [ $? -ne 0 ]; then
    echo "Error: Failed to create ingress"
    exit 1
fi

echo ""
echo "=========================================="
echo "Waiting for deployment rollout..."
echo "=========================================="

kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host --timeout=5m

if [ $? -ne 0 ]; then
    echo "Warning: Deployment rollout did not complete successfully"
    echo "Check pod status with: kubectl get pods -n react-nextjs-host"
fi

echo ""
echo "=========================================="
echo "Deployment Status"
echo "=========================================="

kubectl get pods,svc,ingress -n react-nextjs-host

echo ""
echo "=========================================="
echo "✓ Deployment completed successfully!"
echo "=========================================="
echo ""
echo "Application Details:"
echo "  Namespace: react-nextjs-host"
echo "  Deployment: react-nextjs-host"
echo "  Service: react-nextjs-host-service"
echo "  Ingress: react-nextjs-host-ingress"
echo ""
echo "To view logs:"
echo "  kubectl logs -f deployment/react-nextjs-host -n react-nextjs-host"
echo ""
echo "To check pod status:"
echo "  kubectl get pods -n react-nextjs-host"
echo ""
echo "To access the application:"
echo "  Update your DNS to point react-nextjs-host.example.com to the ingress IP"
echo "  Or use port-forward: kubectl port-forward svc/react-nextjs-host-service 8080:80 -n react-nextjs-host"
echo ""
echo "Rollback command (if needed):"
echo "  kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host"
echo ""
