// cz-js-1042 runtime configuration via window.__ENV__
window.__ENV__ = {
  API_URL: '${API_URL}',  // injected at container startup
  BACKEND_URL: '${BACKEND_URL}',  // backend service URL for S3 pre-signed URLs
  S3_BUCKET_NAME: '${S3_BUCKET_NAME}',  // S3 bucket for file uploads
  FEATURE_FLAG: '${FEATURE_FLAG}',  // feature flag configuration
};
