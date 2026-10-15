// Runtime configuration via window.__ENV__ for GKE Autopilot deployment
// This file is mounted as a ConfigMap volume, enabling single image deployment across environments
window.__ENV__ = {
  API_URL: '${API_URL}',  // injected at container startup via ConfigMap
  BACKEND_URL: '${BACKEND_URL}',  // injected at container startup via ConfigMap
  FEATURE_FLAG: '${FEATURE_FLAG}',  // injected at container startup via ConfigMap
};
