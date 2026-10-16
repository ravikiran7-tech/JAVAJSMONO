# Stage 1: Build stage - Node.js + Angular/React CLI build environment
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG BUILD_OUTPUT_DIR=dist
RUN NODE_ENV=production npm run build

# Stage 2: Runtime stage - minimal nginx:alpine serving dist/
FROM nginx:alpine
ARG BUILD_OUTPUT_DIR=dist
COPY --from=build /app/${BUILD_OUTPUT_DIR} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
