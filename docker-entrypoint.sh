#!/bin/bash
set -e

# Generate runtime configuration from environment variables
cat > /app/public/config.js << EOF
// Runtime configuration injected at container startup
window.__ENV__ = {
  API_URL: '${API_URL:-}',
  BACKEND_URL: '${BACKEND_URL:-}',
  S3_BUCKET_NAME: '${S3_BUCKET_NAME:-}',
  FEATURE_FLAG: '${FEATURE_FLAG:-}'
};
EOF

echo "Runtime configuration generated:"
cat /app/public/config.js

# Start the Java application
exec java $JAVA_OPTS -jar /app/app.jar
