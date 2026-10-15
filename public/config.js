// Runtime configuration via window.__ENV__ for AKS deployment
// This file should be mounted as a ConfigMap in Kubernetes
window.__ENV__ = {
  API_URL: '${API_URL}',  // injected at container startup
  FEATURE_FLAG: '${FEATURE_FLAG}',  // injected at container startup
};
