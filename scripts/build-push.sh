#!/bin/bash
set -e
set -o pipefail

# Build and Push Script for Docker Images
# Supports Azure ACR and Docker Hub

PROJECT_NAME="react-nextjs-host"
echo "=========================================="
echo "Docker Build and Push Script"
echo "Project: $PROJECT_NAME"
echo "=========================================="
echo ""

# Sanitize project name for Docker image naming
IMAGE_NAME=$(echo "$PROJECT_NAME" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-*//;s/-*$//')

# Prompt for image tag
echo "Enter image tag (default: latest):"
read -r IMAGE_TAG
IMAGE_TAG=${IMAGE_TAG:-latest}

# Sanitize tag
IMAGE_TAG=$(echo "$IMAGE_TAG" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9.-' '-' | sed 's/^-*//;s/-*$//')

echo ""
echo "Select Docker Registry:"
echo "1. Azure Container Registry (ACR)"
echo "2. Docker Hub"
read -r -p "Enter choice (1 or 2): " REGISTRY_CHOICE

if [ "$REGISTRY_CHOICE" = "1" ]; then
    # Azure ACR
    echo ""
    echo "--- Azure Container Registry ---"
    read -r -p "Enter ACR name (e.g., myregistry): " ACR_NAME
    
    if [ -z "$ACR_NAME" ]; then
        echo "Error: ACR name cannot be empty"
        exit 1
    fi
    
    FULL_IMAGE_NAME="${ACR_NAME}.azurecr.io/${IMAGE_NAME}:${IMAGE_TAG}"
    
    echo ""
    echo "Logging into Azure Container Registry..."
    az acr login --name "$ACR_NAME"
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to login to Azure ACR"
        exit 1
    fi
    
elif [ "$REGISTRY_CHOICE" = "2" ]; then
    # Docker Hub
    echo ""
    echo "--- Docker Hub ---"
    read -r -p "Enter Docker Hub username: " DOCKER_USERNAME
    read -r -s -p "Enter Docker Hub password: " DOCKER_PASSWORD
    echo ""
    
    if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_PASSWORD" ]; then
        echo "Error: Docker Hub credentials cannot be empty"
        exit 1
    fi
    
    FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}"
    
    echo ""
    echo "Logging into Docker Hub..."
    echo "$DOCKER_PASSWORD" | docker login --username "$DOCKER_USERNAME" --password-stdin
    
    if [ $? -ne 0 ]; then
        echo "Error: Failed to login to Docker Hub"
        exit 1
    fi
    
else
    echo "Error: Invalid choice. Please select 1 or 2."
    exit 1
fi

echo ""
echo "=========================================="
echo "Building Docker image..."
echo "Image: $FULL_IMAGE_NAME"
echo "=========================================="

docker build -t "$FULL_IMAGE_NAME" .

if [ $? -ne 0 ]; then
    echo "Error: Docker build failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "Pushing Docker image to registry..."
echo "=========================================="

docker push "$FULL_IMAGE_NAME"

if [ $? -ne 0 ]; then
    echo "Error: Docker push failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "✓ Build and push completed successfully!"
echo "Image: $FULL_IMAGE_NAME"
echo "=========================================="
