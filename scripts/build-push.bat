@echo off
setlocal enabledelayedexpansion

REM Build and Push Script for Docker Images (Windows)
REM Supports Azure ACR and Docker Hub

set PROJECT_NAME=react-nextjs-host
echo ==========================================
echo Docker Build and Push Script
echo Project: %PROJECT_NAME%
echo ==========================================
echo.

REM Sanitize project name for Docker image naming
set IMAGE_NAME=%PROJECT_NAME%
set IMAGE_NAME=!IMAGE_NAME: =-!
for %%i in (A B C D E F G H I J K L M N O P Q R S T U V W X Y Z) do set IMAGE_NAME=!IMAGE_NAME:%%i=%%i!
set IMAGE_NAME=%IMAGE_NAME: =-%

REM Prompt for image tag
set /p IMAGE_TAG="Enter image tag (default: latest): "
if "!IMAGE_TAG!"=="" set IMAGE_TAG=latest

echo.
echo Select Docker Registry:
echo 1. Azure Container Registry (ACR)
echo 2. Docker Hub
set /p REGISTRY_CHOICE="Enter choice (1 or 2): "

if "!REGISTRY_CHOICE!"=="1" (
    REM Azure ACR
    echo.
    echo --- Azure Container Registry ---
    set /p ACR_NAME="Enter ACR name (e.g., myregistry): "
    
    if "!ACR_NAME!"=="" (
        echo Error: ACR name cannot be empty
        exit /b 1
    )
    
    set FULL_IMAGE_NAME=!ACR_NAME!.azurecr.io/!IMAGE_NAME!:!IMAGE_TAG!
    
    echo.
    echo Logging into Azure Container Registry...
    az acr login --name !ACR_NAME!
    
    if !ERRORLEVEL! neq 0 (
        echo Error: Failed to login to Azure ACR
        exit /b 1
    )
    
) else if "!REGISTRY_CHOICE!"=="2" (
    REM Docker Hub
    echo.
    echo --- Docker Hub ---
    set /p DOCKER_USERNAME="Enter Docker Hub username: "
    set /p DOCKER_PASSWORD="Enter Docker Hub password: "
    
    if "!DOCKER_USERNAME!"=="" (
        echo Error: Docker Hub username cannot be empty
        exit /b 1
    )
    if "!DOCKER_PASSWORD!"=="" (
        echo Error: Docker Hub password cannot be empty
        exit /b 1
    )
    
    set FULL_IMAGE_NAME=!DOCKER_USERNAME!/!IMAGE_NAME!:!IMAGE_TAG!
    
    echo.
    echo Logging into Docker Hub...
    echo !DOCKER_PASSWORD! | docker login --username !DOCKER_USERNAME! --password-stdin
    
    if !ERRORLEVEL! neq 0 (
        echo Error: Failed to login to Docker Hub
        exit /b 1
    )
    
) else (
    echo Error: Invalid choice. Please select 1 or 2.
    exit /b 1
)

echo.
echo ==========================================
echo Building Docker image...
echo Image: !FULL_IMAGE_NAME!
echo ==========================================

docker build -t !FULL_IMAGE_NAME! .

if !ERRORLEVEL! neq 0 (
    echo Error: Docker build failed
    exit /b 1
)

echo.
echo ==========================================
echo Pushing Docker image to registry...
echo ==========================================

docker push !FULL_IMAGE_NAME!

if !ERRORLEVEL! neq 0 (
    echo Error: Docker push failed
    exit /b 1
)

echo.
echo ==========================================
echo Success: Build and push completed successfully!
echo Image: !FULL_IMAGE_NAME!
echo ==========================================

endlocal
