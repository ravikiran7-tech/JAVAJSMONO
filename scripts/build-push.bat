@echo off
setlocal enabledelayedexpansion

rem =============================================================================
rem build-push.bat – Build and push the react-nextjs-host Docker image
rem Supports: Google Artifact Registry | Docker Hub
rem =============================================================================

set "PROJECT_NAME=react-nextjs-host"

echo ==============================================
echo   Build ^& Push: %PROJECT_NAME%
echo ==============================================

rem Sanitize image name via PowerShell
for /f "delims=" %%i in ('powershell -NoProfile -Command "$n = '%PROJECT_NAME%'.ToLower() -replace '[^a-z0-9]+','-'; $n.Trim('-')"') do set "IMAGE_NAME=%%i"

rem Prompt for image tag
set /p "IMAGE_TAG_INPUT=Enter image tag [latest]: "
if "!IMAGE_TAG_INPUT!"=="" (
    set "IMAGE_TAG=latest"
) else (
    for /f "delims=" %%t in ('powershell -NoProfile -Command "$t = '!IMAGE_TAG_INPUT!'.ToLower() -replace '[^a-z0-9._-]+','-'; $t.Trim('-'); if ($t -eq '') { 'latest' }"') do set "IMAGE_TAG=%%t"
)

echo.
echo Select container registry:
echo   1^) Google Artifact Registry
echo   2^) Docker Hub
set /p "REGISTRY_CHOICE=Enter choice [1]: "
if "!REGISTRY_CHOICE!"=="" set "REGISTRY_CHOICE=1"

if "!REGISTRY_CHOICE!"=="1" (
    rem ── Google Artifact Registry ──────────────────────────────────────────
    echo.
    set /p "GCP_PROJECT=Enter GCP Project ID: "
    set /p "GCP_REGION=Enter GCP Region (e.g. us-central1): "
    set /p "AR_REPO=Enter Artifact Registry repository name: "

    set "FULL_IMAGE_NAME=!GCP_REGION!-docker.pkg.dev/!GCP_PROJECT!/!AR_REPO!/!IMAGE_NAME!:!IMAGE_TAG!"

    echo.
    echo Authenticating with Google Artifact Registry...
    gcloud auth configure-docker !GCP_REGION!-docker.pkg.dev
    if !ERRORLEVEL! neq 0 (
        echo Artifact Registry login failed
        exit /b 1
    )

) else if "!REGISTRY_CHOICE!"=="2" (
    rem ── Docker Hub ────────────────────────────────────────────────────────
    echo.
    set /p "DOCKER_USERNAME=Enter Docker Hub username: "
    set /p "DOCKER_PASSWORD=Enter Docker Hub password/token: "

    set "FULL_IMAGE_NAME=!DOCKER_USERNAME!/!IMAGE_NAME!:!IMAGE_TAG!"

    echo.
    echo Authenticating with Docker Hub...
    echo !DOCKER_PASSWORD! | docker login --username !DOCKER_USERNAME! --password-stdin
    if !ERRORLEVEL! neq 0 (
        echo Docker Hub login failed
        exit /b 1
    )

) else (
    echo Invalid choice. Exiting.
    exit /b 1
)

echo.
echo Building Docker image: !FULL_IMAGE_NAME!
docker build -f Dockerfile -t "!FULL_IMAGE_NAME!" .
if !ERRORLEVEL! neq 0 (
    echo Docker build failed
    exit /b 1
)

echo.
echo Pushing Docker image: !FULL_IMAGE_NAME!
docker push "!FULL_IMAGE_NAME!"
if !ERRORLEVEL! neq 0 (
    echo Docker push failed
    exit /b 1
)

echo.
echo ==============================================
echo   Image pushed successfully!
echo   !FULL_IMAGE_NAME!
echo ==============================================

endlocal
