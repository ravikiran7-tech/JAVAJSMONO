@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM deploy-image.bat – Deploy react-nextjs-host to Azure AKS (Windows)
REM Usage: scripts\deploy-image.bat
REM Run from the repository root directory.
REM Prerequisites: azure-cli, kubectl
REM =============================================================================

set "APP_NAME=react-nextjs-host"
set "NAMESPACE=react-nextjs-host"

echo ==============================================
echo   AKS Deployment – %APP_NAME%
echo ==============================================

REM ── Collect inputs ────────────────────────────────────────────────────────────
set /p "RESOURCE_GROUP=Enter Azure Resource Group name: "
if "!RESOURCE_GROUP!"=="" (
  echo ERROR: Resource group cannot be empty.
  exit /b 1
)

set /p "CLUSTER_NAME=Enter AKS Cluster name: "
if "!CLUSTER_NAME!"=="" (
  echo ERROR: AKS cluster name cannot be empty.
  exit /b 1
)

set /p "IMAGE_URI=Enter full Docker image URI (e.g. myregistry.azurecr.io/react-nextjs-host:latest): "
if "!IMAGE_URI!"=="" (
  echo ERROR: Image URI cannot be empty.
  exit /b 1
)

REM ── Configure kubectl ─────────────────────────────────────────────────────────
echo.
echo Configuring kubectl for AKS cluster: !CLUSTER_NAME! ...
az aks get-credentials --resource-group "!RESOURCE_GROUP!" --name "!CLUSTER_NAME!" --overwrite-existing
if !ERRORLEVEL! neq 0 (
  echo ERROR: Failed to get AKS credentials.
  exit /b 1
)

echo.
echo Verifying cluster connectivity ...
kubectl cluster-info
if !ERRORLEVEL! neq 0 (
  echo ERROR: Cannot connect to cluster.
  exit /b 1
)

REM ── Substitute placeholders in manifests ─────────────────────────────────────
echo.
echo Updating Kubernetes manifests with image URI ...
powershell -NoProfile -Command "(Get-Content kubernetes\deployment.yaml) -replace '\{\{IMAGE_URI\}\}', '!IMAGE_URI!' | Set-Content kubernetes\deployment.yaml"
if !ERRORLEVEL! neq 0 (
  echo ERROR: Failed to update deployment.yaml.
  exit /b 1
)

REM ── Apply manifests ───────────────────────────────────────────────────────────
echo.
echo Applying Kubernetes manifests ...

echo   [1/4] Applying namespace ...
kubectl apply -f kubernetes\namespace.yaml
if !ERRORLEVEL! neq 0 (
  echo ERROR: Failed to apply namespace.
  exit /b 1
)

echo   [2/4] Applying deployment ...
kubectl apply -f kubernetes\deployment.yaml
if !ERRORLEVEL! neq 0 (
  echo ERROR: Failed to apply deployment.
  exit /b 1
)

echo   [3/4] Applying service ...
kubectl apply -f kubernetes\service.yaml
if !ERRORLEVEL! neq 0 (
  echo ERROR: Failed to apply service.
  exit /b 1
)

echo   [4/4] Applying ingress ...
kubectl apply -f kubernetes\ingress.yaml
if !ERRORLEVEL! neq 0 (
  echo ERROR: Failed to apply ingress.
  exit /b 1
)

REM ── Wait for rollout ──────────────────────────────────────────────────────────
echo.
echo Waiting for deployment rollout ...
kubectl rollout status deployment/!APP_NAME! -n !NAMESPACE! --timeout=300s
if !ERRORLEVEL! neq 0 (
  echo ERROR: Deployment rollout failed. Running rollback ...
  kubectl rollout undo deployment/!APP_NAME! -n !NAMESPACE!
  echo Rollback initiated. Check pod status with:
  echo   kubectl get pods -n !NAMESPACE!
  exit /b 1
)

REM ── Verify resources ──────────────────────────────────────────────────────────
echo.
echo Verifying deployed resources ...
kubectl get pods,svc,ingress -n !NAMESPACE!

echo.
echo ==============================================
echo   Deployment complete!
echo   Run the following to get the ingress host:
echo     kubectl get ingress -n !NAMESPACE!
echo   Health Check endpoint: /api/health
echo ==============================================
echo.
echo Rollback command (if needed):
echo   kubectl rollout undo deployment/!APP_NAME! -n !NAMESPACE!

endlocal
