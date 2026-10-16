// cz-js-1058: Runtime configuration injected via AKS ConfigMap.
// This file is mounted into the container at
//   /usr/share/nginx/html/config.js
// by a Kubernetes ConfigMap (kubernetes/configmap.yaml) and served by Nginx
// before the application bundle loads, enabling a single container image to
// be reused across all AKS environments (dev / staging / prod).
//
// Non-sensitive values are stored in the ConfigMap.
// Sensitive values (secrets) are supplied via the Azure Key Vault CSI Driver
// (secrets-store.csi.k8s.io) and referenced separately.
//
// The placeholder tokens below (${VAR_NAME}) are replaced at container
// startup by an init-container or entrypoint script using envsubst:
//   envsubst < /config/config.js.tmpl > /usr/share/nginx/html/config.js
window.__ENV__ = {
  API_URL: '${API_URL}',           // non-sensitive: from AKS ConfigMap
  FEATURE_FLAG: '${FEATURE_FLAG}', // non-sensitive: from AKS ConfigMap
};
