# =============================================================================
# Multi-Stage Dockerfile for Angular/React App on GKE Autopilot
# Rule: cz-js-1014 – Missing Multi-Stage Dockerfile for Angular Apps
#
# Stage 1 – BUILD: installs dependencies and compiles the production bundle.
# Stage 2 – RUNTIME: copies only the compiled static assets into nginx:alpine,
#            producing a minimal image (~10x smaller) suitable for Artifact
#            Registry and GKE Autopilot per-pod billing.
# =============================================================================

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:18-alpine AS build

WORKDIR /app

# Copy dependency manifests first to leverage Docker layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies needed for the build)
RUN npm ci

# Copy the rest of the source code
COPY . .

# Build the production bundle (outputs to /app/dist for Angular, /app/build for React)
RUN NODE_ENV=production npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# Remove the default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy compiled assets from the build stage
# Angular outputs to dist/<project-name>; React outputs to build/
# Adjust the source path below to match your project's actual output directory.
COPY --from=build /app/dist /usr/share/nginx/html

# Expose HTTP port
EXPOSE 80

# Start nginx in the foreground (required for container health)
CMD ["nginx", "-g", "daemon off;"]
