@echo off
setlocal enabledelayedexpansion

REM Deploy Docker image to AWS EKS (Windows)
REM This script configures kubectl and deploys the application to EKS

echo ==========================================
echo AWS EKS Deployment Script
echo ==========================================
echo.

REM Prompt for AWS EKS configuration
set /p AWS_REGION="Enter AWS Region (e.g., us-east-1): "
set /p CLUSTER_NAME="Enter EKS Cluster Name: "
set /p IMAGE_URI="Enter Docker Image URI (with tag): "

echo.
echo === Optional Environment Variables ===
echo Press Enter to skip any variable you don't need to configure
echo.

REM Prompt for application-specific environment variables
set /p API_URL="Enter API_URL (or press Enter to skip): "
set /p BACKEND_URL="Enter BACKEND_URL (or press Enter to skip): "
set /p S3_BUCKET_NAME="Enter S3_BUCKET_NAME (or press Enter to skip): "
set /p FEATURE_FLAG="Enter FEATURE_FLAG (or press Enter to skip): "
set /p REDIS_HOST="Enter REDIS_HOST (or press Enter to skip): "
set /p REDIS_PORT="Enter REDIS_PORT (default: 6379): "
if "!REDIS_PORT!"=="" set REDIS_PORT=6379
set /p S3_AWS_REGION="Enter AWS_REGION for S3 (default: !AWS_REGION!): "
if "!S3_AWS_REGION!"=="" set S3_AWS_REGION=!AWS_REGION!

echo.
echo ==========================================
echo Configuring kubectl for EKS cluster...
echo ==========================================

REM Configure kubectl to use EKS cluster
aws eks update-kubeconfig --region "!AWS_REGION!" --name "!CLUSTER_NAME!"

if !ERRORLEVEL! neq 0 (
    echo ERROR: Failed to configure kubectl for EKS cluster
    exit /b 1
)

REM Verify cluster connectivity
echo.
echo Verifying cluster connectivity...
kubectl cluster-info

if !ERRORLEVEL! neq 0 (
    echo ERROR: Cannot connect to Kubernetes cluster
    exit /b 1
)

echo.
echo ==========================================
echo Updating Kubernetes manifests...
echo ==========================================

REM Create temporary directory for processed manifests
set TEMP_DIR=%TEMP%\k8s-deploy-%RANDOM%
mkdir "!TEMP_DIR!"

REM Copy manifests to temp directory
xcopy /E /I /Y kubernetes "!TEMP_DIR!" >nul

REM Replace placeholders in deployment.yaml using PowerShell
powershell -Command "(Get-Content '!TEMP_DIR!\deployment.yaml') -replace '{{IMAGE_URI}}', '!IMAGE_URI!' | Set-Content '!TEMP_DIR!\deployment.yaml'"
powershell -Command "(Get-Content '!TEMP_DIR!\deployment.yaml') -replace '{{API_URL}}', '!API_URL!' | Set-Content '!TEMP_DIR!\deployment.yaml'"
powershell -Command "(Get-Content '!TEMP_DIR!\deployment.yaml') -replace '{{BACKEND_URL}}', '!BACKEND_URL!' | Set-Content '!TEMP_DIR!\deployment.yaml'"
powershell -Command "(Get-Content '!TEMP_DIR!\deployment.yaml') -replace '{{S3_BUCKET_NAME}}', '!S3_BUCKET_NAME!' | Set-Content '!TEMP_DIR!\deployment.yaml'"
powershell -Command "(Get-Content '!TEMP_DIR!\deployment.yaml') -replace '{{FEATURE_FLAG}}', '!FEATURE_FLAG!' | Set-Content '!TEMP_DIR!\deployment.yaml'"
powershell -Command "(Get-Content '!TEMP_DIR!\deployment.yaml') -replace '{{REDIS_HOST}}', '!REDIS_HOST!' | Set-Content '!TEMP_DIR!\deployment.yaml'"
powershell -Command "(Get-Content '!TEMP_DIR!\deployment.yaml') -replace '{{REDIS_PORT}}', '!REDIS_PORT!' | Set-Content '!TEMP_DIR!\deployment.yaml'"
powershell -Command "(Get-Content '!TEMP_DIR!\deployment.yaml') -replace '{{AWS_REGION}}', '!S3_AWS_REGION!' | Set-Content '!TEMP_DIR!\deployment.yaml'"

echo Manifests updated successfully

echo.
echo ==========================================
echo Deploying to EKS cluster...
echo ==========================================

REM Apply Kubernetes manifests in order
echo.
echo Creating namespace...
kubectl apply -f "!TEMP_DIR!\namespace.yaml"

echo.
echo Deploying application...
kubectl apply -f "!TEMP_DIR!\deployment.yaml"

echo.
echo Creating service...
kubectl apply -f "!TEMP_DIR!\service.yaml"

echo.
echo Creating ingress...
kubectl apply -f "!TEMP_DIR!\ingress.yaml"

echo.
echo ==========================================
echo Waiting for deployment to complete...
echo ==========================================

REM Wait for deployment rollout
kubectl rollout status deployment/react-nextjs-host -n react-nextjs-host --timeout=5m

if !ERRORLEVEL! neq 0 (
    echo ERROR: Deployment rollout failed
    echo.
    echo Checking pod status...
    kubectl get pods -n react-nextjs-host
    echo.
    echo Checking pod logs...
    kubectl logs -n react-nextjs-host -l app=react-nextjs-host --tail=50
    rmdir /S /Q "!TEMP_DIR!"
    exit /b 1
)

echo.
echo ==========================================
echo Deployment successful!
echo ==========================================

REM Display deployment information
echo.
echo === Deployment Status ===
kubectl get pods -n react-nextjs-host
echo.
kubectl get svc -n react-nextjs-host
echo.
kubectl get ingress -n react-nextjs-host

echo.
echo ==========================================
echo Application Access Information
echo ==========================================
echo.
echo To get the application URL, run:
echo   kubectl get ingress react-nextjs-host-ingress -n react-nextjs-host -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"
echo.
echo To view application logs:
echo   kubectl logs -n react-nextjs-host -l app=react-nextjs-host -f
echo.
echo To scale the deployment:
echo   kubectl scale deployment/react-nextjs-host -n react-nextjs-host --replicas=3
echo.
echo To rollback the deployment:
echo   kubectl rollout undo deployment/react-nextjs-host -n react-nextjs-host
echo.
echo ==========================================

REM Cleanup temp directory
rmdir /S /Q "!TEMP_DIR!"

endlocal
