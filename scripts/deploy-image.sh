#!/bin/bash
set -e
set -o pipefail

# =============================================================================
# deploy-image.sh – Deploy react-nextjs-host to GCP GKE
# =============================================================================

APP_NAME="react-nextjs-host"
NAMESPACE="react-nextjs-host"

echo "=============================================="
echo "  Deploy to GCP GKE: ${APP_NAME}"
echo "=============================================="

# ── Collect GCP / cluster details ─────────────────────────────────────────────
read -rp "Enter GCP Project ID: " GCP_PROJECT
if [ -z "${GCP_PROJECT}" ]; then
  echo "ERROR: GCP Project ID is required."
  exit 1
fi

read -rp "Enter GCP Zone (e.g. us-central1-a): " GCP_ZONE
if [ -z "${GCP_ZONE}" ]; then
  echo "ERROR: GCP Zone is required."
  exit 1
fi

read -rp "Enter GKE Cluster Name: " CLUSTER_NAME
if [ -z "${CLUSTER_NAME}" ]; then
  echo "ERROR: GKE Cluster Name is required."
  exit 1
fi

read -rp "Enter full Docker image URI (e.g. us-central1-docker.pkg.dev/my-project/my-repo/react-nextjs-host:latest): " IMAGE_URI
if [ -z "${IMAGE_URI}" ]; then
  echo "ERROR: Docker image URI is required."
  exit 1
fi

# ── Update Kubernetes manifests with the provided image URI ───────────────────
echo ""
echo "Updating Kubernetes manifests..."
sed -i "s|{{IMAGE_URI}}|${IMAGE_URI}|g" kubernetes/deployment.yaml

# ── Configure kubectl for GKE ─────────────────────────────────────────────────
echo ""
echo "Configuring kubectl for GKE cluster: ${CLUSTER_NAME}..."
gcloud container clusters get-credentials "${CLUSTER_NAME}" \
  --zone "${GCP_ZONE}" \
  --project "${GCP_PROJECT}"

echo ""
echo "Verifying cluster connectivity..."
kubectl cluster-info || { echo "ERROR: Cannot connect to cluster."; exit 1; }

# ── Apply Kubernetes manifests ────────────────────────────────────────────────
echo ""
echo "Applying Kubernetes manifests..."

echo "  [1/4] Applying namespace..."
kubectl apply -f kubernetes/namespace.yaml

echo "  [2/4] Applying deployment..."
kubectl apply -f kubernetes/deployment.yaml

echo "  [3/4] Applying service..."
kubectl apply -f kubernetes/service.yaml

echo "  [4/4] Applying ingress..."
kubectl apply -f kubernetes/ingress.yaml

# ── Wait for rollout ──────────────────────────────────────────────────────────
echo ""
echo "Waiting for deployment rollout..."
kubectl rollout status deployment/${APP_NAME} -n ${NAMESPACE} --timeout=300s

# ── Verify resources ──────────────────────────────────────────────────────────
echo ""
echo "Verifying deployed resources..."
kubectl get pods,svc,ingress -n ${NAMESPACE}

# ── Display access URL ────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  Deployment complete!"
echo "  Application: ${APP_NAME}"
echo "  Namespace  : ${NAMESPACE}"
echo "  Image      : ${IMAGE_URI}"
echo ""
echo "  Access URL : http://react-nextjs-host.example.com"
echo "  Health     : http://react-nextjs-host.example.com/api/health"
echo ""
echo "  Rollback   : kubectl rollout undo deployment/${APP_NAME} -n ${NAMESPACE}"
echo "=============================================="
