// cz-js-1058 FIXED: replaced build-time jQuery/webpack configuration with
// runtime environment variable injection via AKS ConfigMaps and Azure Key
// Vault CSI Driver.
//
// Previously, configuration values were baked into the JavaScript bundle at
// build time using process.env.REACT_APP_* variables (resolved by webpack
// during 'npm run build'), which required a separate image build per
// environment and prevented container image reuse across dev/staging/prod.
//
// Remediation (AKS ConfigMaps + Azure Key Vault CSI Driver):
//   - Non-sensitive values (e.g. API_URL) are supplied via a Kubernetes
//     ConfigMap that is mounted as /usr/share/nginx/html/config.js and
//     served by Nginx before the application bundle loads.
//   - Sensitive values (e.g. secrets) are injected via the Azure Key Vault
//     CSI Driver (secrets-store.csi.k8s.io) and exposed as environment
//     variables or mounted files at container startup.
//   - The window.__ENV__ object is populated at runtime from the ConfigMap-
//     mounted config.js, enabling a single container image to be deployed
//     across all AKS environments without rebuilding.
//
// AKS ConfigMap example (kubernetes/configmap.yaml):
//   apiVersion: v1
//   kind: ConfigMap
//   metadata:
//     name: app-runtime-config
//   data:
//     config.js: |
//       window.__ENV__ = {
//         API_URL: "https://api.example.com",
//         FEATURE_FLAG: "true"
//       };
//
// Azure Key Vault CSI Driver SecretProviderClass example:
//   apiVersion: secrets-store.csi.x-k8s.io/v1
//   kind: SecretProviderClass
//   metadata:
//     name: app-secrets
//   spec:
//     provider: azure
//     parameters:
//       keyvaultName: "<your-keyvault-name>"
//       objects: |
//         array:
//           - |
//             objectName: APP-SECRET-KEY
//             objectType: secret
//       tenantId: "<your-tenant-id>"

const env = (typeof window !== 'undefined' && window.__ENV__) ? window.__ENV__ : {};

export const config = {
  // Non-sensitive: injected at container startup via AKS ConfigMap-mounted config.js
  apiUrl: env.API_URL || '',
  feature: env.FEATURE_FLAG || '',
};
