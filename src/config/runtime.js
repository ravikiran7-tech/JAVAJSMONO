// Runtime configuration loaded from window.__ENV__ (injected at container startup)
// Replaces build-time REACT_APP_* variables for container image reuse across environments
export const config = {
  apiUrl: window.__ENV__?.API_URL,
  feature: window.__ENV__?.FEATURE_FLAG,
};
