// Runtime configuration using window.__ENV__ for containerized deployment
// Configuration is loaded from public/config.js at runtime via ConfigMap
export const config = {
  apiUrl: window.__ENV__.API_URL,  // injected at container startup via ConfigMap
  feature: window.__ENV__.FEATURE_FLAG,  // injected at container startup via ConfigMap
};
