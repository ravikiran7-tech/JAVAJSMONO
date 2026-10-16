// cz-js-1058: Kubernetes ConfigMap template for runtime environment injection.
//
// This file is the TEMPLATE that is rendered at container startup by the
// entrypoint script using envsubst (or a similar tool). The rendered output
// is served as /config.js by Nginx so the browser can read window.__ENV__
// before the application bundle executes.
//
// Kubernetes ConfigMap (k8s/configmap.yaml) mounts this file or the rendered
// version at /usr/share/nginx/html/config.js inside the container.
//
// Environment variables are supplied via the EKS Deployment spec:
//   env:
//     - name: API_URL
//       valueFrom:
//         configMapKeyRef:
//           name: frontend-config
//           key: API_URL
//     - name: REACT_APP_BACKEND_URL
//       valueFrom:
//         configMapKeyRef:
//           name: frontend-config
//           key: REACT_APP_BACKEND_URL
//     - name: REACT_APP_LOCAL_SERVICE_URL
//       valueFrom:
//         configMapKeyRef:
//           name: frontend-config
//           key: REACT_APP_LOCAL_SERVICE_URL
//     - name: FEATURE_FLAG
//       valueFrom:
//         configMapKeyRef:
//           name: frontend-config
//           key: FEATURE_FLAG
window.__ENV__ = {
  API_URL: '${API_URL}',                                    // injected at container startup via ConfigMap
  REACT_APP_BACKEND_URL: '${REACT_APP_BACKEND_URL}',        // e.g. http://backend/api  (Kubernetes DNS)
  REACT_APP_LOCAL_SERVICE_URL: '${REACT_APP_LOCAL_SERVICE_URL}', // e.g. http://local-service/api
  FEATURE_FLAG: '${FEATURE_FLAG}',                          // e.g. true / false
};
