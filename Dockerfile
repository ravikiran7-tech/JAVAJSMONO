# =============================================================================
# Multi-Stage Dockerfile for Angular Application on Azure Kubernetes Service
# Rule: cz-js-1014 – Missing Multi-Stage Dockerfile for Angular Apps
# Strategy: Build stage (Node.js + Angular CLI) → Runtime stage (nginx:alpine)
# Registry: Azure Container Registry (ACR) with Azure Workload Identity
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build – Node.js + Angular CLI
# Compiles the Angular application and produces the optimised dist/ artefacts.
# This stage is discarded in the final image, keeping Node/npm/source out of
# the runtime container and reducing image size by ~10x.
# -----------------------------------------------------------------------------
FROM node:18-alpine AS build

# Build-time argument for the Angular output directory (default: dist/app)
ARG ANGULAR_OUTPUT_PATH=dist/app

WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package.json package-lock.json* ./

# Install all dependencies (including devDependencies needed for the build)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the Angular application in production mode
# NODE_ENV=production ensures AOT compilation, tree-shaking, and minification
RUN NODE_ENV=production npx ng build --configuration=production --output-path=${ANGULAR_OUTPUT_PATH}

# -----------------------------------------------------------------------------
# Stage 2: Runtime – nginx:alpine
# Serves the pre-built static assets from dist/.
# Final image contains ONLY nginx + compiled assets (~20-40 MB).
# -----------------------------------------------------------------------------
FROM nginx:alpine AS runtime

# Build-time argument must be re-declared in the new stage
ARG ANGULAR_OUTPUT_PATH=dist/app

# Remove the default nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled Angular artefacts from the build stage
COPY --from=build /app/${ANGULAR_OUTPUT_PATH} /usr/share/nginx/html

# Copy custom nginx configuration for Angular HTML5 routing support
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80 (standard HTTP – mapped by K8s Service / AKS Ingress)
EXPOSE 80

# Run nginx in the foreground (required for container process management)
CMD ["nginx", "-g", "daemon off;"]
