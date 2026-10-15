@echo off
setlocal enabledelayedexpansion

REM Build and push Docker image script for react-nextjs-host (Windows)
REM This script supports AWS ECR and Docker Hub registries

set PROJECT_NAME=react-nextjs-host
echo ==========================================
echo Docker Build and Push Script
echo Project: %PROJECT_NAME%
echo ==========================================
echo.

REM Prompt for registry type
echo Select Docker Registry:
echo 1. AWS ECR (Elastic Container Registry)
echo 2. Docker Hub
set /p REGISTRY_CHOICE="Enter choice (1 or 2): "

REM Sanitize image name using PowerShell
for /f "delims=" %%i in ('powershell -Command "('%PROJECT_NAME%' -replace '[^a-zA-Z0-9]', '-').ToLower() -replace '^-+', '' -replace '-+$', ''"') do set IMAGE_NAME=%%i

REM Prompt for image tag
set /p IMAGE_TAG="Enter image tag (default: latest): "
if "!IMAGE_TAG!"=="" set IMAGE_TAG=latest
REM Sanitize tag
for /f "delims=" %%i in ('powershell -Command "('!IMAGE_TAG!' -replace '[^a-zA-Z0-9.-]', '-').ToLower() -replace '^-+', '' -replace '-+$', ''"') do set IMAGE_TAG=%%i

if "!REGISTRY_CHOICE!"=="1" (
    REM AWS ECR
    echo.
    echo === AWS ECR Configuration ===
    set /p AWS_REGION="Enter AWS Region (e.g., us-east-1): "
    set /p AWS_ACCOUNT_ID="Enter AWS Account ID: "
    set /p ECR_REPO="Enter ECR Repository Name (default: !IMAGE_NAME!): "
    if "!ECR_REPO!"=="" set ECR_REPO=!IMAGE_NAME!
    
    set REGISTRY_URL=!AWS_ACCOUNT_ID!.dkr.ecr.!AWS_REGION!.amazonaws.com
    set FULL_IMAGE_NAME=!REGISTRY_URL!/!ECR_REPO!:!IMAGE_TAG!
    
    echo.
    echo Authenticating with AWS ECR...
    for /f "delims=" %%p in ('aws ecr get-login-password --region !AWS_REGION!') do (
        echo %%p | docker login --username AWS --password-stdin !REGISTRY_URL!
    )
    
    if !ERRORLEVEL! neq 0 (
        echo ERROR: ECR authentication failed
        exit /b 1
    )
    
    REM Check if repository exists, create if not
    echo Checking if ECR repository exists...
    aws ecr describe-repositories --repository-names !ECR_REPO! --region !AWS_REGION! >nul 2>&1
    if !ERRORLEVEL! neq 0 (
        echo Creating ECR repository: !ECR_REPO!
        aws ecr create-repository --repository-name !ECR_REPO! --region !AWS_REGION!
    )
    
) else if "!REGISTRY_CHOICE!"=="2" (
    REM Docker Hub
    echo.
    echo === Docker Hub Configuration ===
    set /p DOCKER_USERNAME="Enter Docker Hub username: "
    set /p DOCKER_PASSWORD="Enter Docker Hub password: "
    
    set FULL_IMAGE_NAME=!DOCKER_USERNAME!/!IMAGE_NAME!:!IMAGE_TAG!
    
    echo.
    echo Authenticating with Docker Hub...
    echo !DOCKER_PASSWORD! | docker login --username !DOCKER_USERNAME! --password-stdin
    
    if !ERRORLEVEL! neq 0 (
        echo ERROR: Docker Hub authentication failed
        exit /b 1
    )
) else (
    echo ERROR: Invalid choice. Please select 1 or 2.
    exit /b 1
)

REM Build Docker image
echo.
echo ==========================================
echo Building Docker image: !FULL_IMAGE_NAME!
echo ==========================================
docker build -t "!FULL_IMAGE_NAME!" .

if !ERRORLEVEL! neq 0 (
    echo ERROR: Docker build failed
    exit /b 1
)

echo.
echo Build successful!

REM Push Docker image
echo.
echo ==========================================
echo Pushing Docker image: !FULL_IMAGE_NAME!
echo ==========================================
docker push "!FULL_IMAGE_NAME!"

if !ERRORLEVEL! neq 0 (
    echo ERROR: Docker push failed
    exit /b 1
)

echo.
echo ==========================================
echo SUCCESS!
echo ==========================================
echo Image: !FULL_IMAGE_NAME!
echo Tag: !IMAGE_TAG!
echo.
echo To deploy this image to Kubernetes, run:
echo   scripts\deploy-image.bat
echo ==========================================

endlocal
