// Runtime configuration using window.__ENV__ for containerized deployment
// This enables single image deployment across Kubernetes environments
export const config = {
  apiUrl: window.__ENV__.API_URL,  // loaded at runtime from ConfigMap
  feature: window.__ENV__.FEATURE_FLAG,
};
