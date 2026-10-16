# =============================================================================
# Multi-Stage Dockerfile for react-nextjs-host (Java 17 Maven Application)
# Builder : maven:3.9.4-eclipse-temurin-17
# Runtime : amazoncorretto:17
# Target  : Azure Kubernetes Service (AKS)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build – Maven + Eclipse Temurin 17
# Compiles the Java application and produces the executable JAR.
# This stage is discarded in the final image, keeping Maven/source out of
# the runtime container and reducing image size significantly.
# -----------------------------------------------------------------------------
FROM maven:3.9.4-eclipse-temurin-17 AS builder

WORKDIR /workspace

# Copy dependency manifest first to leverage Docker layer caching.
# Dependencies are downloaded before source code is copied, so they are
# cached as long as pom.xml does not change.
COPY pom.xml .

RUN mvn dependency:go-offline -B

# Copy the rest of the source code
COPY src ./src

# Build the application JAR (skip tests for Docker build)
RUN mvn clean package -DskipTests -B

# -----------------------------------------------------------------------------
# Stage 2: Runtime – Amazon Corretto 17
# Runs the pre-built JAR with a minimal JRE footprint.
# Final image contains ONLY the JRE + application JAR.
# -----------------------------------------------------------------------------
FROM amazoncorretto:17

# Set working directory
WORKDIR /app

# Create a non-root user for security best practices
RUN groupadd --system appgroup && \
    useradd --system --gid appgroup --no-create-home appuser

# Set timezone
ENV TZ=UTC

# JVM tuning: container-aware memory management
ENV JAVA_OPTS="-XX:+UseContainerSupport \
               -XX:MaxRAMPercentage=75.0 \
               -XX:+UnlockExperimentalVMOptions \
               -Xms256m \
               -Xmx512m \
               -Djava.security.egd=file:/dev/./urandom"

# Copy the built JAR from the builder stage
COPY --from=builder /workspace/target/react-nextjs-host.jar app.jar

# Change ownership to non-root user
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose the application port
EXPOSE 8080

# Run the application with JVM options
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
