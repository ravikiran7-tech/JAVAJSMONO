#!/bin/bash
set -e

# =============================================================================
# build-push.sh – Build and push the react-nextjs-host Docker image
# Supports: Google Artifact Registry | Docker Hub
# =============================================================================

PROJECT_NAME="react-nextjs-host"

echo "=============================================="
echo "  Build & Push: ${PROJECT_NAME}"
echo "=============================================="

# Sanitize image name: lowercase, replace non-alphanumeric with hyphens
IMAGE_NAME=$(echo "${PROJECT_NAME}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-*//;s/-*$//')

# Prompt for image tag
read -rp "Enter image tag [latest]: " IMAGE_TAG_INPUT
IMAGE_TAG=$(echo "${IMAGE_TAG_INPUT}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-' | sed 's/^-*//;s/-*$//')
if [ -z "${IMAGE_TAG}" ]; then
  IMAGE_TAG="latest"
fi

echo ""
echo "Select container registry:"
echo "  1) Google Artifact Registry"
echo "  2) Docker Hub"
read -rp "Enter choice [1]: " REGISTRY_CHOICE
REGISTRY_CHOICE="${REGISTRY_CHOICE:-1}"

if [ "${REGISTRY_CHOICE}" = "1" ]; then
  # ── Google Artifact Registry ──────────────────────────────────────────────
  echo ""
  read -rp "Enter GCP Project ID: " GCP_PROJECT
  read -rp "Enter GCP Region (e.g. us-central1): " GCP_REGION
  read -rp "Enter Artifact Registry repository name: " AR_REPO

  FULL_IMAGE_NAME="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${AR_REPO}/${IMAGE_NAME}:${IMAGE_TAG}"

  echo ""
  echo "Authenticating with Google Artifact Registry..."
  gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet

elif [ "${REGISTRY_CHOICE}" = "2" ]; then
  # ── Docker Hub ────────────────────────────────────────────────────────────
  echo ""
  read -rp "Enter Docker Hub username: " DOCKER_USERNAME
  read -rsp "Enter Docker Hub password/token: " DOCKER_PASSWORD
  echo ""

  FULL_IMAGE_NAME="${DOCKER_USERNAME}/${IMAGE_NAME}:${IMAGE_TAG}"

  echo ""
  echo "Authenticating with Docker Hub..."
  echo "${DOCKER_PASSWORD}" | docker login --username "${DOCKER_USERNAME}" --password-stdin

else
  echo "Invalid choice. Exiting."
  exit 1
fi

echo ""
echo "Building Docker image: ${FULL_IMAGE_NAME}"
docker build -f Dockerfile -t "${FULL_IMAGE_NAME}" .

echo ""
echo "Pushing Docker image: ${FULL_IMAGE_NAME}"
docker push "${FULL_IMAGE_NAME}"

echo ""
echo "=============================================="
echo "  Image pushed successfully!"
echo "  ${FULL_IMAGE_NAME}"
echo "=============================================="
