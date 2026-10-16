// cz-js-1058 FIXED: Replaced build-time jQuery/webpack configuration with
// runtime environment variable injection via Kubernetes ConfigMaps on EKS.
//
// Previously, configuration values were baked into the JavaScript bundle at
// build time using process.env.REACT_APP_* variables (webpack DefinePlugin /
// Create-React-App substitution). This prevented container image reuse across
// environments because each environment required a separate build and image.
//
// Solution – Runtime Config via Kubernetes ConfigMaps and Environment Variables:
//   1. A Kubernetes ConfigMap holds environment-specific values (API_URL,
//      FEATURE_FLAG, etc.).
//   2. An init-container or entrypoint script renders those ConfigMap values
//      into /usr/share/nginx/html/config.js at container startup using
//      environment variable substitution (e.g. envsubst).
//   3. The rendered config.js is served as a static asset by Nginx and loaded
//      by the browser BEFORE the application bundle via:
//        <script src="/config.js"></script>
//      in public/index.html.
//   4. This module reads configuration exclusively from window.__ENV__ at
//      runtime, so the same container image runs in dev, staging, and prod
//      without any rebuild.
//
// Kubernetes ConfigMap example (k8s/configmap.yaml):
//   apiVersion: v1
//   kind: ConfigMap
//   metadata:
//     name: frontend-config
//   data:
//     config.js: |
//       window.__ENV__ = {
//         API_URL: "https://api.example.com",
//         FEATURE_FLAG: "true"
//       };
//
// The ConfigMap is mounted as a volume at /usr/share/nginx/html/config.js
// in the Deployment spec, or the entrypoint script uses envsubst to render
// the template in public/config.js (see public/config.js for the template).

const env =
  typeof window !== 'undefined' && window.__ENV__
    ? window.__ENV__
    : {};

export const config = {
  apiUrl: env.API_URL || '',
  feature: env.FEATURE_FLAG || '',
};
