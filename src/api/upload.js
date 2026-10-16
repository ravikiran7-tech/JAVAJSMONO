import axios from 'axios';

// cz-js-1049 remediated: replaced jQuery File Upload local container filesystem
// write with direct-to-S3 upload via AWS SDK v3 presigned URLs.
//
// Previously the uploadToDisk function used Node.js `fs.writeFileSync` to persist
// uploaded files at '/app/build/uploads/<filename>' inside the container.  Because
// containers are ephemeral, those files were lost on every pod restart, eviction,
// or scale-in event, making the approach incompatible with Kubernetes deployments
// that run multiple replicas.
//
// The new implementation follows the EKS-recommended pattern:
//   1. The React/jQuery frontend requests a presigned S3 PUT URL from the Node.js
//      backend (which uses @aws-sdk/s3-request-presigner + @aws-sdk/client-s3).
//   2. The file is uploaded directly from the browser to S3 using that presigned
//      URL, so the container never touches the file bytes and no local storage is
//      required.
//   3. The permanent S3 object URL is returned to the caller for downstream use.
//
// Required environment variables (set in Kubernetes Deployment / ConfigMap):
//   REACT_APP_UPLOAD_PRESIGN_URL – backend endpoint that returns a presigned S3
//                                   PUT URL for the given filename/contentType.
//   Example: https://api.example.com/api/s3/presign
//
// Backend Node.js snippet (AWS SDK v3) for reference:
//   import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
//   import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
//   const s3 = new S3Client({ region: process.env.AWS_REGION });
//   const command = new PutObjectCommand({
//     Bucket: process.env.S3_BUCKET_NAME,
//     Key: `uploads/${filename}`,
//     ContentType: contentType,
//   });
//   const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

/**
 * Uploads a file directly to Amazon S3 via a presigned PUT URL.
 *
 * The jQuery File Upload plugin (or any FormData-based uploader) can call this
 * function instead of posting to a local endpoint that writes to the container
 * filesystem.  File persistence is guaranteed by S3 regardless of pod lifecycle.
 *
 * @param {File} file - The File object selected by the user.
 * @returns {Promise<string>} Resolves with the permanent S3 object URL.
 */
export async function uploadToS3(file) {
  // Resolve the presign endpoint from the runtime environment.
  // Supports both Create-React-App (REACT_APP_*) and runtime injection
  // via window.__ENV__ (useful for Kubernetes ConfigMap-driven config).
  const presignEndpoint =
    process.env.REACT_APP_UPLOAD_PRESIGN_URL ||
    (typeof window !== 'undefined' &&
      window.__ENV__ &&
      window.__ENV__.REACT_APP_UPLOAD_PRESIGN_URL);

  if (!presignEndpoint) {
    throw new Error(
      'REACT_APP_UPLOAD_PRESIGN_URL environment variable is not set. ' +
        'Configure it in your Kubernetes Deployment or ConfigMap before deploying.'
    );
  }

  // Step 1: Ask the backend for a short-lived presigned S3 PUT URL.
  const presignResponse = await axios.get(presignEndpoint, {
    params: { filename: file.name, contentType: file.type },
  });

  const { presignedUrl, fileUrl } = presignResponse.data;

  // Step 2: PUT the file bytes directly to S3 – the container is bypassed entirely.
  await axios.put(presignedUrl, file, {
    headers: { 'Content-Type': file.type },
  });

  // Return the permanent S3 object URL so callers can store or display it.
  return fileUrl;
}

export function getData() {
  // cz-js-1003 remediated: replaced hardcoded port :8080 with environment-variable-driven
  // base URL injected via Kubernetes ConfigMap / window.__ENV__.
  // Set REACT_APP_BACKEND_URL (e.g. http://backend/api or https://api.example.com/api)
  // in your Kubernetes Deployment or ConfigMap so the port is resolved dynamically
  // through Kubernetes DNS and Istio service mesh on EKS.
  const backendUrl =
    (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.REACT_APP_BACKEND_URL) ||
    process.env.REACT_APP_BACKEND_URL ||
    '';
  return fetch(`${backendUrl}/api/data`);
}
export function getLocal() {
  // cz-js-1004 remediated: replaced hardcoded localhost URL 'http://localhost:3001/api/info'
  // with a Kubernetes service DNS name injected via environment variable / ConfigMap.
  // Localhost URLs break in multi-container EKS deployments where the frontend and backend
  // run in separate pods with isolated network namespaces.
  //
  // Set REACT_APP_LOCAL_SERVICE_URL to the Kubernetes service DNS name of the target service
  // (e.g. http://local-service or http://local-service.default.svc.cluster.local) in your
  // Kubernetes Deployment or ConfigMap.  The URL is resolved dynamically through Kubernetes
  // DNS and Istio service mesh on EKS, enabling proper inter-pod communication.
  //
  // Previously: return fetch('http://localhost:3001/api/info');
  const localServiceUrl =
    (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__.REACT_APP_LOCAL_SERVICE_URL) ||
    process.env.REACT_APP_LOCAL_SERVICE_URL ||
    '';
  return fetch(`${localServiceUrl}/api/info`);
}
export function getCross() {
  // cz-js-1030 fetch without CORS error handling
  // cz-js-1030 remediated: added CORS-aware fetch with proper error handling for
  // containerized microservices deployed on EKS where the React frontend and the
  // API run in separate pods with different origins.
  //
  // Key changes:
  //   1. The cross-origin API base URL is now driven by the environment variable
  //      REACT_APP_CROSS_ORIGIN_API_URL (injected via Kubernetes ConfigMap /
  //      window.__ENV__) so the URL is not hardcoded and can differ per environment.
  //   2. fetch() is called with `mode: 'cors'` and `credentials: 'include'` to
  //      explicitly opt-in to CORS and forward cookies / auth headers across origins.
  //   3. A dedicated CORS-error guard checks for opaque responses (status 0) and
  //      non-OK HTTP status codes, throwing descriptive errors so callers can
  //      surface meaningful messages instead of silent failures.
  //   4. The NGINX Ingress on EKS must be annotated with the appropriate CORS
  //      headers (nginx.ingress.kubernetes.io/enable-cors: "true", etc.) to allow
  //      the browser to complete the preflight OPTIONS request.
  //
  // Required environment variable (set in Kubernetes Deployment or ConfigMap):
  //   REACT_APP_CROSS_ORIGIN_API_URL – base URL of the cross-origin API service.
  //   Example: https://api.other-origin.com
  const crossOriginApiUrl =
    (typeof window !== 'undefined' &&
      window.__ENV__ &&
      window.__ENV__.REACT_APP_CROSS_ORIGIN_API_URL) ||
    process.env.REACT_APP_CROSS_ORIGIN_API_URL ||
    '';

  if (!crossOriginApiUrl) {
    return Promise.reject(
      new Error(
        'REACT_APP_CROSS_ORIGIN_API_URL environment variable is not set. ' +
          'Configure it in your Kubernetes Deployment or ConfigMap before deploying.'
      )
    );
  }

  return fetch(`${crossOriginApiUrl}/data`, {
    method: 'GET',
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
    },
  })
    .then((response) => {
      // Guard against opaque responses caused by CORS policy rejections.
      // An opaque response has status 0 and no readable body; treat it as a
      // CORS failure so the caller receives a clear, actionable error message.
      if (response.type === 'opaque' || response.status === 0) {
        throw new Error(
          'CORS error: the cross-origin request was blocked by the browser. ' +
            'Ensure the NGINX Ingress on EKS is annotated with ' +
            'nginx.ingress.kubernetes.io/enable-cors: "true" and that the ' +
            'Access-Control-Allow-Origin header is set to the frontend origin.'
        );
      }
      if (!response.ok) {
        throw new Error(
          `Cross-origin API request failed with HTTP ${response.status} ${response.statusText}. ` +
            `URL: ${crossOriginApiUrl}/data`
        );
      }
      return response.json();
    })
    .catch((error) => {
      // Re-throw with additional context so upstream error boundaries or
      // logging middleware can distinguish CORS failures from other network errors.
      if (error.message && error.message.startsWith('CORS error:')) {
        throw error;
      }
      throw new Error(
        `Cross-origin fetch failed: ${error.message}. ` +
          'Verify that REACT_APP_CROSS_ORIGIN_API_URL is correct and that the ' +
          'target service allows cross-origin requests from this frontend origin.'
      );
    });
}
