// Runtime configuration injected at container startup via GKE ConfigMap volume mount.
//
// cz-js-1058: This file is the GKE ConfigMap template for non-sensitive runtime values.
// It is mounted as a ConfigMap at /usr/share/nginx/html/config.js and loaded via
// <script src="/config.js"></script> in index.html BEFORE the application bundle,
// so window.__ENV__ is available to all modules at runtime.
//
// Sensitive values (e.g. APP_SECRET_KEY) are injected by the nginx entrypoint script
// after reading them from Secret Manager CSI Driver mounts at /etc/secrets/.
//
// Each GKE namespace/environment supplies its own ConfigMap with the correct values,
// enabling a single container image to be promoted across dev / staging / prod without
// rebuilding — satisfying the containerization portability requirement for cz-js-1058.
//
// GKE ConfigMap definition (apply per environment namespace):
//   kubectl create configmap app-runtime-config \
//     --from-literal=API_URL="https://api.<env>.example.com" \
//     --from-literal=FEATURE_FLAG="true" \
//     -n <env-namespace>
//
// The nginx entrypoint (docker-entrypoint.sh) appends Secret Manager values:
//   SECRET_KEY=$(cat /etc/secrets/APP_SECRET_KEY)
//   sed -i "s|__APP_SECRET_KEY__|${SECRET_KEY}|g" /usr/share/nginx/html/config.js

window.__ENV__ = {
  // Non-sensitive values — provided by GKE ConfigMap at pod startup
  API_URL: '${API_URL}',           // replaced by ConfigMap value at container startup
  FEATURE_FLAG: '${FEATURE_FLAG}', // replaced by ConfigMap value at container startup

  // Sensitive value — provided by GKE Secret Manager add-on (Secrets Store CSI Driver)
  // The nginx entrypoint reads /etc/secrets/APP_SECRET_KEY and substitutes this placeholder
  APP_SECRET_KEY: '__APP_SECRET_KEY__', // replaced by entrypoint from /etc/secrets/APP_SECRET_KEY
};
