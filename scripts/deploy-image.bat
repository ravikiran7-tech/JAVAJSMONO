@echo off
setlocal enabledelayedexpansion

REM Deploy to Azure AKS Script (Windows)
REM Deploys the react-nextjs-host application to Azure Kubernetes Service

echo ==========================================
echo Azure AKS Deployment Script
echo Application: react-nextjs-host
echo ==========================================
echo.

REM Prompt for Azure resource group
set /p RESOURCE_GROUP="Enter Azure Resource Group name: "

if "!RESOURCE_GROUP!"=="" (
    echo Error: Resource Group name cannot be empty
    exit /b 1
)

REM Prompt for AKS cluster name
set /p CLUSTER_NAME="Enter AKS Cluster name: "

if "!CLUSTER_NAME!"=="" (
    echo Error: AKS Cluster name cannot be empty
    exit /b 1
)

REM Prompt for Docker image URI
set /p IMAGE_URI="Enter Docker image URI (e.g., myregistry.azurecr.io/react-nextjs-host:latest): "

if "!IMAGE_URI!"=="" (
    echo Error: Docker image URI cannot be empty
    exit /b 1
)

echo.
echo ==========================================
echo Configuring kubectl for AKS cluster...
echo ==========================================

az aks get-credentials --resource-group !RESOURCE_GROUP! --name !CLUSTER_NAME! --overwrite-existing

if !ERRORLEVEL! neq 0 (
    echo Error: Failed to get AKS credentials
    exit /b 1
)

echo.
echo Verifying cluster connectivity...
kubectl cluster-info

if !ERRORLEVEL! neq 0 (
    echo Error: Failed to connect to Kubernetes cluster
    exit /b 1
)

echo.
echo ==========================================
echo Updating Kubernetes manifests...
echo ==========================================

REM Update deployment.yaml with the provided image URI using PowerShell
powershell -Command "(Get-Content kubernetes\deployment.yaml) -replace '{{IMAGE_URI}}', '!IMAGE_URI!' | Set-Content kubernetes\deployment.yaml"

echo Success: Manifests updated with image: !IMAGE_URI!

echo.
echo ==========================================
echo Applying Kubernetes manifests...
echo ==========================================

REM Apply namespace
echo Creating namespace...
kubectl apply -f kubernetes\namespace.yaml

if !ERRORLEVEL! neq 0 (
    echo Error: Failed to create namespace
    exit /b 1
)

REM Apply deployment
echo Creating deployment...
kubectl apply -f kubernetes\deployment.yaml

if !ERRORLEVEL! neq 0 (
    echo Error: Failed to create deployment
    exit /b 1
)

REM Apply service
echo Creating service...
kubectl apply -f kubernetes\service.yaml

if !ERRORLEVEL! neq 0 (
    echo Error: Failed to create service
    exit /b 1
)

REM Apply ingress
echo Creating ingress...
kubectl apply -f kubernetes\ingress.yaml

if !ERRORLEVEL! neq 0 (
    echo Error: Failed to create ingress
    exit /b 1
)

echo.
echo ==========================================
echo Waiting for deployment rollout...
echo ==========================================

kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host --timeout=5m

if !ERRORLEVEL! neq 0 (
    echo Warning: Deployment rollout did not complete successfully
    echo Check pod status with: kubectl get pods -n react-nextjs-host
)

echo.
echo ==========================================
echo Deployment Status
echo ==========================================

kubectl get pods,svc,ingress -n react-nextjs-host

echo.
echo ==========================================
echo Success: Deployment completed successfully!
echo ==========================================
echo.
echo Application Details:
echo   Namespace: react-nextjs-host
echo   Deployment: react-nextjs-host
echo   Service: react-nextjs-host-service
echo   Ingress: react-nextjs-host-ingress
echo.
echo To view logs:
echo   kubectl logs -f deployment/react-nextjs-host -n react-nextjs-host
echo.
echo To check pod status:
echo   kubectl get pods -n react-nextjs-host
echo.
echo To access the application:
echo   Update your DNS to point react-nextjs-host.example.com to the ingress IP
echo   Or use port-forward: kubectl port-forward svc/react-nextjs-host-service 8080:80 -n react-nextjs-host
echo.
echo Rollback command (if needed):
echo   kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host
echo.

endlocal
