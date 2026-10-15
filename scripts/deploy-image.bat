@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo GKE Deployment Script
echo ==========================================
echo.

REM Prompt for GCP configuration
echo === GCP Configuration ===
set /p GCP_PROJECT="Enter GCP Project ID: "
set /p GCP_ZONE="Enter GCP Zone (e.g., us-central1-a): "
set /p CLUSTER_NAME="Enter GKE Cluster Name: "

echo.
echo === Docker Image Configuration ===
set /p IMAGE_URI="Enter Docker Image URI (with tag): "

if "!IMAGE_URI!"=="" (
    echo ERROR: Image URI cannot be empty
    exit /b 1
)

echo.
echo ==========================================
echo Configuring kubectl for GKE
echo ==========================================
echo.

REM Configure kubectl to use the GKE cluster
call gcloud container clusters get-credentials "!CLUSTER_NAME!" --zone "!GCP_ZONE!" --project "!GCP_PROJECT!"

if !ERRORLEVEL! neq 0 (
    echo ERROR: Failed to configure kubectl for GKE cluster
    exit /b 1
)

REM Verify cluster connectivity
echo.
echo Verifying cluster connectivity...
kubectl cluster-info
if !ERRORLEVEL! neq 0 (
    echo ERROR: Failed to connect to cluster
    exit /b 1
)

echo.
echo ==========================================
echo Updating Kubernetes Manifests
echo ==========================================
echo.

REM Update deployment.yaml with the image URI using PowerShell
powershell -Command "(Get-Content kubernetes\deployment.yaml) -replace '{{IMAGE_URI}}', '!IMAGE_URI!' | Set-Content kubernetes\deployment.yaml"

echo Updated deployment.yaml with image: !IMAGE_URI!

echo.
echo ==========================================
echo Deploying to GKE
echo ==========================================
echo.

REM Apply Kubernetes manifests in order
echo Creating namespace...
kubectl apply -f kubernetes\namespace.yaml

echo.
echo Deploying application...
kubectl apply -f kubernetes\deployment.yaml

echo.
echo Creating service...
kubectl apply -f kubernetes\service.yaml

echo.
echo Creating ingress...
kubectl apply -f kubernetes\ingress.yaml

echo.
echo ==========================================
echo Waiting for Deployment Rollout
echo ==========================================
echo.

kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host --timeout=5m

if !ERRORLEVEL! neq 0 (
    echo ERROR: Deployment rollout failed
    echo.
    echo Checking pod status...
    kubectl get pods -n react-nextjs-host
    echo.
    echo Checking pod logs...
    kubectl logs -n react-nextjs-host -l app=react-nextjs-host --tail=50
    exit /b 1
)

echo.
echo ==========================================
echo Deployment Status
echo ==========================================
echo.

kubectl get pods,svc,ingress -n react-nextjs-host

echo.
echo ==========================================
echo Deployment Completed Successfully!
echo ==========================================
echo.
echo Application Details:
echo   Namespace: react-nextjs-host
echo   Deployment: react-nextjs-host
echo   Service: react-nextjs-host-service
echo   Ingress: react-nextjs-host-ingress
echo.
echo To check application logs:
echo   kubectl logs -n react-nextjs-host -l app=react-nextjs-host -f
echo.
echo To check pod status:
echo   kubectl get pods -n react-nextjs-host
echo.
echo To access the application:
echo   1. Get the ingress IP: kubectl get ingress -n react-nextjs-host
echo   2. Configure DNS or use the IP directly
echo   3. Access: http://react-nextjs-host.example.com
echo.
echo To rollback if needed:
echo   kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host
echo.

endlocal
