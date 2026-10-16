#!/bin/bash
# =============================================================================
# deploy-image.sh – Deploy react-nextjs-host to Azure AKS
# Usage: bash scripts/deploy-image.sh
# Run from the repository root directory.
# Prerequisites: azure-cli, kubectl
# =============================================================================
set -e
set -o pipefail

APP_NAME="react-nextjs-host"
NAMESPACE="react-nextjs-host"

echo "=============================================="
echo "  AKS Deployment – ${APP_NAME}"
echo "=============================================="

# ── Collect inputs ────────────────────────────────────────────────────────────
read -rp "Enter Azure Resource Group name: " RESOURCE_GROUP
if [ -z "${RESOURCE_GROUP}" ]; then
  echo "ERROR: Resource group cannot be empty." >&2
  exit 1
fi

read -rp "Enter AKS Cluster name: " CLUSTER_NAME
if [ -z "${CLUSTER_NAME}" ]; then
  echo "ERROR: AKS cluster name cannot be empty." >&2
  exit 1
fi

read -rp "Enter full Docker image URI (e.g. myregistry.azurecr.io/react-nextjs-host:latest): " IMAGE_URI
if [ -z "${IMAGE_URI}" ]; then
  echo "ERROR: Image URI cannot be empty." >&2
  exit 1
fi

# ── Configure kubectl ─────────────────────────────────────────────────────────
echo ""
echo "Configuring kubectl for AKS cluster: ${CLUSTER_NAME} ..."
az aks get-credentials --resource-group "${RESOURCE_GROUP}" --name "${CLUSTER_NAME}" --overwrite-existing
if [ $? -ne 0 ]; then
  echo "ERROR: Failed to get AKS credentials." >&2
  exit 1
fi

echo ""
echo "Verifying cluster connectivity ..."
kubectl cluster-info || { echo "ERROR: Cannot connect to cluster." >&2; exit 1; }

# ── Substitute placeholders in manifests ─────────────────────────────────────
echo ""
echo "Updating Kubernetes manifests with image URI ..."
sed -i "s|{{IMAGE_URI}}|${IMAGE_URI}|g" kubernetes/deployment.yaml

# ── Apply manifests ───────────────────────────────────────────────────────────
echo ""
echo "Applying Kubernetes manifests ..."

echo "  [1/4] Applying namespace ..."
kubectl apply -f kubernetes/namespace.yaml

echo "  [2/4] Applying deployment ..."
kubectl apply -f kubernetes/deployment.yaml

echo "  [3/4] Applying service ..."
kubectl apply -f kubernetes/service.yaml

echo "  [4/4] Applying ingress ..."
kubectl apply -f kubernetes/ingress.yaml

# ── Wait for rollout ──────────────────────────────────────────────────────────
echo ""
echo "Waiting for deployment rollout ..."
kubectl rollout status deployment/${APP_NAME} -n ${NAMESPACE} --timeout=300s
if [ $? -ne 0 ]; then
  echo "ERROR: Deployment rollout failed. Running rollback ..." >&2
  kubectl rollout undo deployment/${APP_NAME} -n ${NAMESPACE}
  echo "Rollback initiated. Check pod status with:"
  echo "  kubectl get pods -n ${NAMESPACE}"
  exit 1
fi

# ── Verify resources ──────────────────────────────────────────────────────────
echo ""
echo "Verifying deployed resources ..."
kubectl get pods,svc,ingress -n ${NAMESPACE}

# ── Display access URL ────────────────────────────────────────────────────────
echo ""
INGRESS_HOST=$(kubectl get ingress ${APP_NAME}-ingress -n ${NAMESPACE} -o jsonpath='{.spec.rules[0].host}' 2>/dev/null || echo "")
if [ -n "${INGRESS_HOST}" ]; then
  echo "=============================================="
  echo "  Application URL: http://${INGRESS_HOST}"
  echo "  Health Check:    http://${INGRESS_HOST}/api/health"
  echo "=============================================="
else
  echo "=============================================="
  echo "  Deployment complete. Ingress host not yet resolved."
  echo "  Run: kubectl get ingress -n ${NAMESPACE}"
  echo "=============================================="
fi

echo ""
echo "Rollback command (if needed):"
echo "  kubectl rollout undo deployment/${APP_NAME} -n ${NAMESPACE}"
