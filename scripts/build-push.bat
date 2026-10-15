@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo Docker Build and Push Script
echo ==========================================
echo.

REM Project configuration
set PROJECT_NAME=react-nextjs-host

REM Sanitize project name for Docker tag (lowercase, hyphenate)
set IMAGE_NAME=!PROJECT_NAME!
for %%i in (A B C D E F G H I J K L M N O P Q R S T U V W X Y Z) do (
    set IMAGE_NAME=!IMAGE_NAME:%%i=%%i!
)
set IMAGE_NAME=%IMAGE_NAME: =-%
set IMAGE_NAME=%IMAGE_NAME%
powershell -Command "$name='%IMAGE_NAME%'; $name=$name.ToLower(); $name=$name -replace '[^a-z0-9-]','-'; $name=$name -replace '^-+',''; $name=$name -replace '-+$',''; Write-Output $name" > temp_name.txt
set /p IMAGE_NAME=<temp_name.txt
del temp_name.txt

echo Project: %PROJECT_NAME%
echo Image name: %IMAGE_NAME%
echo.

REM Prompt for registry selection
echo Select Docker Registry:
echo 1. Google Artifact Registry
echo 2. Docker Hub
set /p REGISTRY_CHOICE="Enter choice (1 or 2): "

if "!REGISTRY_CHOICE!"=="1" (
    echo.
    echo === Google Artifact Registry Configuration ===
    set /p GCP_PROJECT="Enter GCP Project ID: "
    set /p GCP_REGION="Enter GCP Region (e.g., us-central1): "
    set /p AR_REPO="Enter Artifact Registry Repository Name: "
    set /p IMAGE_TAG="Enter image tag (default: latest): "
    
    if "!IMAGE_TAG!"=="" set IMAGE_TAG=latest
    
    REM Sanitize tag
    powershell -Command "$tag='!IMAGE_TAG!'; $tag=$tag.ToLower(); $tag=$tag -replace '[^a-z0-9.-]','-'; $tag=$tag -replace '^-+',''; $tag=$tag -replace '-+$',''; Write-Output $tag" > temp_tag.txt
    set /p IMAGE_TAG=<temp_tag.txt
    del temp_tag.txt
    
    set FULL_IMAGE_NAME=!GCP_REGION!-docker.pkg.dev/!GCP_PROJECT!/!AR_REPO!/!IMAGE_NAME!:!IMAGE_TAG!
    
    echo.
    echo Authenticating with Google Cloud...
    call gcloud auth login
    
    echo.
    echo Configuring Docker for Artifact Registry...
    call gcloud auth configure-docker !GCP_REGION!-docker.pkg.dev
    
    if !ERRORLEVEL! neq 0 (
        echo ERROR: Artifact Registry authentication failed
        exit /b 1
    )
    
) else if "!REGISTRY_CHOICE!"=="2" (
    echo.
    echo === Docker Hub Configuration ===
    set /p DOCKER_USERNAME="Enter Docker Hub username: "
    set /p DOCKER_PASSWORD="Enter Docker Hub password/token: "
    set /p IMAGE_TAG="Enter image tag (default: latest): "
    
    if "!IMAGE_TAG!"=="" set IMAGE_TAG=latest
    
    REM Sanitize tag
    powershell -Command "$tag='!IMAGE_TAG!'; $tag=$tag.ToLower(); $tag=$tag -replace '[^a-z0-9.-]','-'; $tag=$tag -replace '^-+',''; $tag=$tag -replace '-+$',''; Write-Output $tag" > temp_tag.txt
    set /p IMAGE_TAG=<temp_tag.txt
    del temp_tag.txt
    
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

echo.
echo ==========================================
echo Building Docker Image
echo ==========================================
echo Image: !FULL_IMAGE_NAME!
echo.

docker build -t "!FULL_IMAGE_NAME!" .

if !ERRORLEVEL! neq 0 (
    echo ERROR: Docker build failed
    exit /b 1
)

echo.
echo ==========================================
echo Pushing Docker Image
echo ==========================================
echo.

docker push "!FULL_IMAGE_NAME!"

if !ERRORLEVEL! neq 0 (
    echo ERROR: Docker push failed
    exit /b 1
)

echo.
echo ==========================================
echo Build and Push Completed Successfully!
echo ==========================================
echo Image: !FULL_IMAGE_NAME!
echo.
echo Next steps:
echo 1. Use this image URI in your deployment scripts
echo 2. Run deploy-image.bat to deploy to GKE
echo.

endlocal
