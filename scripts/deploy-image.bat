@echo off
setlocal enabledelayedexpansion

rem =============================================================================
rem deploy-image.bat – Deploy react-nextjs-host to GCP GKE (Windows)
rem =============================================================================

set "APP_NAME=react-nextjs-host"
set "NAMESPACE=react-nextjs-host"

echo ==============================================
echo   Deploy to GCP GKE: %APP_NAME%
echo ==============================================

rem ── Collect GCP / cluster details ─────────────────────────────────────────
set /p "GCP_PROJECT=Enter GCP Project ID: "
if "!GCP_PROJECT!"=="" (
    echo ERROR: GCP Project ID is required.
    exit /b 1
)

set /p "GCP_ZONE=Enter GCP Zone (e.g. us-central1-a): "
if "!GCP_ZONE!"=="" (
    echo ERROR: GCP Zone is required.
    exit /b 1
)

set /p "CLUSTER_NAME=Enter GKE Cluster Name: "
if "!CLUSTER_NAME!"=="" (
    echo ERROR: GKE Cluster Name is required.
    exit /b 1
)

set /p "IMAGE_URI=Enter full Docker image URI (e.g. us-central1-docker.pkg.dev/my-project/my-repo/react-nextjs-host:latest): "
if "!IMAGE_URI!"=="" (
    echo ERROR: Docker image URI is required.
    exit /b 1
)

rem ── Update Kubernetes manifests with the provided image URI ───────────────
echo.
echo Updating Kubernetes manifests...
powershell -NoProfile -Command "(Get-Content kubernetes\deployment.yaml) -replace '{{IMAGE_URI}}', '!IMAGE_URI!' | Set-Content kubernetes\deployment.yaml"
if !ERRORLEVEL! neq 0 (
    echo ERROR: Failed to update deployment.yaml
    exit /b 1
)

rem ── Configure kubectl for GKE ─────────────────────────────────────────────
echo.
echo Configuring kubectl for GKE cluster: !CLUSTER_NAME!...
gcloud container clusters get-credentials !CLUSTER_NAME! --zone !GCP_ZONE! --project !GCP_PROJECT!
if !ERRORLEVEL! neq 0 (
    echo ERROR: Failed to configure kubectl.
    exit /b 1
)

echo.
echo Verifying cluster connectivity...
kubectl cluster-info
if !ERRORLEVEL! neq 0 (
    echo ERROR: Cannot connect to cluster.
    exit /b 1
)

rem ── Apply Kubernetes manifests ────────────────────────────────────────────
echo.
echo Applying Kubernetes manifests...

echo   [1/4] Applying namespace...
kubectl apply -f kubernetes\namespace.yaml
if !ERRORLEVEL! neq 0 ( echo ERROR: Failed to apply namespace. & exit /b 1 )

echo   [2/4] Applying deployment...
kubectl apply -f kubernetes\deployment.yaml
if !ERRORLEVEL! neq 0 ( echo ERROR: Failed to apply deployment. & exit /b 1 )

echo   [3/4] Applying service...
kubectl apply -f kubernetes\service.yaml
if !ERRORLEVEL! neq 0 ( echo ERROR: Failed to apply service. & exit /b 1 )

echo   [4/4] Applying ingress...
kubectl apply -f kubernetes\ingress.yaml
if !ERRORLEVEL! neq 0 ( echo ERROR: Failed to apply ingress. & exit /b 1 )

rem ── Wait for rollout ──────────────────────────────────────────────────────
echo.
echo Waiting for deployment rollout...
kubectl rollout status deployment/!APP_NAME! -n !NAMESPACE! --timeout=300s
if !ERRORLEVEL! neq 0 (
    echo ERROR: Deployment rollout failed.
    echo Rollback: kubectl rollout undo deployment/!APP_NAME! -n !NAMESPACE!
    exit /b 1
)

rem ── Verify resources ──────────────────────────────────────────────────────
echo.
echo Verifying deployed resources...
kubectl get pods,svc,ingress -n !NAMESPACE!

rem ── Display access URL ────────────────────────────────────────────────────
echo.
echo ==============================================
echo   Deployment complete!
echo   Application : !APP_NAME!
echo   Namespace   : !NAMESPACE!
echo   Image       : !IMAGE_URI!
echo.
echo   Access URL  : http://react-nextjs-host.example.com
echo   Health      : http://react-nextjs-host.example.com/api/health
echo.
echo   Rollback    : kubectl rollout undo deployment/!APP_NAME! -n !NAMESPACE!
echo ==============================================

endlocal
