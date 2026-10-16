@echo off
setlocal enabledelayedexpansion

REM =============================================================================
REM build-push.bat – Build and push Docker image for react-nextjs-host
REM Usage: scripts\build-push.bat
REM Run from the repository root directory.
REM =============================================================================

set "PROJECT_NAME=react-nextjs-host"

echo ==============================================
echo   Docker Build ^& Push – %PROJECT_NAME%
echo ==============================================

REM Sanitize image name using PowerShell (lowercase + replace non-alnum with -)
for /f "delims=" %%I in ('powershell -NoProfile -Command "$n = '%PROJECT_NAME%'.ToLower() -replace '[^a-z0-9]+','-'; $n.Trim('-')"') do set "IMAGE_NAME=%%I"

REM Prompt for image tag
set /p "IMAGE_TAG_INPUT=Enter image tag [latest]: "
if "!IMAGE_TAG_INPUT!"=="" (
  set "IMAGE_TAG=latest"
) else (
  for /f "delims=" %%T in ('powershell -NoProfile -Command "$t = '!IMAGE_TAG_INPUT!'.ToLower() -replace '[^a-z0-9._-]+','-'; $t.Trim('-')"') do set "IMAGE_TAG=%%T"
  if "!IMAGE_TAG!"=="" set "IMAGE_TAG=latest"
)

echo.
echo Select container registry:
echo   1) Azure Container Registry (ACR)
echo   2) Docker Hub
set /p "REGISTRY_CHOICE=Enter choice [1 or 2]: "

if "!REGISTRY_CHOICE!"=="1" (
  REM ── Azure Container Registry ──────────────────────────────────────────────
  set /p "ACR_NAME=Enter ACR name (e.g. myregistry): "
  if "!ACR_NAME!"=="" (
    echo ERROR: ACR name cannot be empty.
    exit /b 1
  )
  set "REGISTRY=!ACR_NAME!.azurecr.io"
  set "FULL_IMAGE_NAME=!REGISTRY!/!IMAGE_NAME!:!IMAGE_TAG!"

  echo.
  echo Logging in to Azure Container Registry: !ACR_NAME! ...
  az acr login --name !ACR_NAME!
  if !ERRORLEVEL! neq 0 (
    echo ERROR: ACR login failed.
    exit /b 1
  )

) else if "!REGISTRY_CHOICE!"=="2" (
  REM ── Docker Hub ────────────────────────────────────────────────────────────
  set /p "DOCKER_USERNAME=Enter Docker Hub username: "
  set /p "DOCKER_PASSWORD=Enter Docker Hub password/token: "
  if "!DOCKER_USERNAME!"=="" (
    echo ERROR: Docker Hub username cannot be empty.
    exit /b 1
  )
  if "!DOCKER_PASSWORD!"=="" (
    echo ERROR: Docker Hub password cannot be empty.
    exit /b 1
  )
  set "FULL_IMAGE_NAME=!DOCKER_USERNAME!/!IMAGE_NAME!:!IMAGE_TAG!"

  echo.
  echo Logging in to Docker Hub ...
  echo !DOCKER_PASSWORD! | docker login --username !DOCKER_USERNAME! --password-stdin
  if !ERRORLEVEL! neq 0 (
    echo ERROR: Docker Hub login failed.
    exit /b 1
  )

) else (
  echo ERROR: Invalid choice '!REGISTRY_CHOICE!'. Please enter 1 or 2.
  exit /b 1
)

echo.
echo Building Docker image: !FULL_IMAGE_NAME!
echo Build context: . (repository root)
docker build -f Dockerfile -t "!FULL_IMAGE_NAME!" .
if !ERRORLEVEL! neq 0 (
  echo ERROR: Docker build failed.
  exit /b 1
)

echo.
echo Pushing image: !FULL_IMAGE_NAME!
docker push "!FULL_IMAGE_NAME!"
if !ERRORLEVEL! neq 0 (
  echo ERROR: Docker push failed.
  exit /b 1
)

echo.
echo ==============================================
echo   SUCCESS: Image pushed successfully!
echo   Image: !FULL_IMAGE_NAME!
echo ==============================================

endlocal
