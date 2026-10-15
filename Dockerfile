# Multi-stage Dockerfile for Next.js application on GKE Autopilot
# Stage 1: Build stage - Install dependencies and build the application
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install dependencies (including devDependencies needed for build)
RUN npm ci

# Copy application source code
COPY . .

# Build the Next.js application with production optimization
RUN npm run build

# Stage 2: Runtime stage - Minimal production image
FROM node:18-alpine AS runner

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV=production

# Copy package files and install only production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/pages ./pages
COPY --from=builder /app/server.js ./server.js

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app

USER nextjs

# Use environment variable for port configuration
ENV PORT=3000
EXPOSE 3000

# Start the Next.js application
CMD ["node", "server.js"]
