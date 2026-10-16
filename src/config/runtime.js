// cz-js-1058 FIXED: Replaced build-time process.env.REACT_APP_* configuration with
// GKE runtime injection via ConfigMaps (non-sensitive values) and the GKE Secret Manager
// add-on / Secrets Store CSI Driver (sensitive values).
//
// HOW IT WORKS:
//   Non-sensitive config  → GKE ConfigMap mounted as /usr/share/nginx/html/config.js
//                           (loaded via <script src="/config.js"></script> in index.html
//                            BEFORE the application bundle, populating window.__ENV__)
//
//   Sensitive config      → GKE Secret Manager add-on (Secrets Store CSI Driver) mounts
//                           secrets as files under /etc/secrets/ at pod startup; the
//                           nginx entrypoint script reads those files and writes their
//                           values into window.__ENV__ inside config.js before nginx
//                           serves the first request.
//
// This pattern enables a SINGLE container image to be promoted across all GKE
// environments (dev / staging / prod) without rebuilding — satisfying the
// containerization portability requirement for cz-js-1058.
//
// GKE ConfigMap example (non-sensitive values):
//   apiVersion: v1
//   kind: ConfigMap
//   metadata:
//     name: app-runtime-config
//     namespace: <env-namespace>
//   data:
//     config.js: |
//       window.__ENV__ = {
//         API_URL: "https://api.<env>.example.com",
//         FEATURE_FLAG: "true"
//       };
//
// GKE SecretProviderClass example (sensitive values via Secret Manager add-on):
//   apiVersion: secrets-store.csi.x-k8s.io/v1
//   kind: SecretProviderClass
//   metadata:
//     name: app-secrets
//     namespace: <env-namespace>
//   spec:
//     provider: gcp
//     parameters:
//       secrets: |
//         - resourceName: "projects/<PROJECT_ID>/secrets/APP_SECRET_KEY/versions/latest"
//           fileName: "APP_SECRET_KEY"
//
// Deployment volume mounts:
//   volumes:
//     - name: runtime-config
//       configMap:
//         name: app-runtime-config
//     - name: secrets-store
//       csi:
//         driver: secrets-store.csi.k8s.io
//         readOnly: true
//         volumeAttributes:
//           secretProviderClass: app-secrets
//   volumeMounts:
//     - name: runtime-config
//       mountPath: /usr/share/nginx/html/config.js
//       subPath: config.js
//     - name: secrets-store
//       mountPath: /etc/secrets
//       readOnly: true

/**
 * Reads runtime configuration injected by GKE at container startup.
 *
 * window.__ENV__ is populated by the ConfigMap-mounted /config.js script
 * (non-sensitive values) and optionally enriched by the nginx entrypoint
 * with Secret Manager CSI-mounted secrets (sensitive values).
 *
 * Falls back to empty strings so the application starts cleanly in local
 * development when window.__ENV__ has not been injected; developers should
 * create a local public/config.js that sets window.__ENV__ for their
 * environment.
 */
const runtimeEnv =
  typeof window !== 'undefined' && window.__ENV__ ? window.__ENV__ : {};

export const config = {
  // Non-sensitive runtime value — sourced from GKE ConfigMap
  apiUrl: runtimeEnv.API_URL || '',

  // Non-sensitive runtime value — sourced from GKE ConfigMap
  feature: runtimeEnv.FEATURE_FLAG || '',

  // Sensitive runtime value — sourced from GKE Secret Manager add-on (CSI Driver)
  // The nginx entrypoint reads /etc/secrets/APP_SECRET_KEY and injects it into
  // window.__ENV__ before serving the bundle.
  secretKey: runtimeEnv.APP_SECRET_KEY || '',
};
