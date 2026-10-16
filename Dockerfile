# =============================================================================
# Multi-Stage Dockerfile for react-nextjs-host (Java 17 / Maven)
# Builder : maven:3.9.4-eclipse-temurin-17
# Runtime : amazoncorretto:17
# =============================================================================

# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM maven:3.9.4-eclipse-temurin-17 AS builder

WORKDIR /workspace

# Copy dependency manifest first to leverage Docker layer caching
COPY pom.xml .

# Download all dependencies (cached layer unless pom.xml changes)
RUN mvn dependency:go-offline -B

# Copy the rest of the source code
COPY src ./src

# Build the application JAR (skip tests for Docker build)
RUN mvn clean package -DskipTests -B

# ── Stage 2: Runtime ──────────────────────────────────────────────────────────
FROM amazoncorretto:17

# Set timezone
ENV TZ=UTC

# Create a non-root user for security
RUN groupadd -r appgroup && useradd -r -g appgroup -s /bin/false appuser

WORKDIR /app

# Copy the built JAR from the builder stage
COPY --from=builder /workspace/target/react-nextjs-host.jar app.jar

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

USER appuser

# Expose application port
EXPOSE 8080

# JVM optimizations for containerized environments
ENV JAVA_OPTS="-Xmx512m -Xms256m -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -XX:+UnlockExperimentalVMOptions"

# Start the application
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
