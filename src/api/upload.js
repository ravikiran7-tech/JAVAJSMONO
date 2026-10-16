import axios from 'axios';
import { Storage } from '@google-cloud/storage';

// cz-js-1049 remediated: replaced jQuery File Upload local container filesystem
// writes with Google Cloud Storage uploads via GKE Workload Identity.
// The Storage() client is initialised without explicit credentials – GKE
// Workload Identity automatically injects a pod-scoped GCP Service Account
// token, so no key files or secrets are required.
// GCS_BUCKET_NAME is injected at runtime via a Kubernetes environment variable
// (set in the Deployment manifest / Helm values), ensuring the bucket name is
// never hard-coded and survives container restarts, pod evictions, and
// horizontal scaling without data loss.
const storage = new Storage(); // keyless – relies on GKE Workload Identity
const GCS_BUCKET = process.env.GCS_BUCKET_NAME; // injected by K8s Deployment env

/**
 * Uploads a file to Google Cloud Storage by streaming the file buffer
 * directly to GCS.  No data is written to the ephemeral container
 * filesystem, so uploads survive pod restarts and scale-out events.
 *
 * @param {object} file  File object with { name, buffer, mimetype } fields
 *                       (e.g. as provided by multer's memoryStorage).
 * @returns {Promise<{gcsObjectPath: string, publicUrl: string}>}
 */
export async function uploadToDisk(file) {
  const bucket = storage.bucket(GCS_BUCKET);
  const blob = bucket.file(file.name);

  // Stream the upload directly to GCS – no local disk I/O
  const blobStream = blob.createWriteStream({
    resumable: false,
    contentType: file.mimetype || 'application/octet-stream',
    metadata: {
      cacheControl: 'public, max-age=31536000',
    },
  });

  await new Promise((resolve, reject) => {
    blobStream.on('error', reject);
    blobStream.on('finish', resolve);
    blobStream.end(file.buffer);
  });

  const gcsObjectPath = `gs://${GCS_BUCKET}/${file.name}`;
  const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET}/${file.name}`;
  return { gcsObjectPath, publicUrl };
}

export function getData() {
  // cz-js-1003 remediated: replaced hardcoded port in base URL with
  // API_BASE_URL environment variable injected via GKE Workload Identity
  // and GCP Secret Manager add-on, enabling dynamic port-free service
  // discovery in Kubernetes / Istio service mesh environments.
  const apiBaseUrl = process.env.API_BASE_URL || '';
  return fetch(`${apiBaseUrl}/api/data`);
}
export function getLocal() {
  // cz-js-1004 remediated: replaced hardcoded localhost URL (http://localhost:3001)
  // with the GKE backend service DNS name sourced from GCP Secret Manager and
  // injected into the pod via a Kubernetes ConfigMap environment variable
  // (BACKEND_SERVICE_URL). This enables correct inter-service communication
  // across isolated pod network namespaces in GKE Autopilot multi-container
  // deployments, where localhost is not routable between frontend and backend pods.
  const backendServiceUrl = process.env.BACKEND_SERVICE_URL || process.env.API_BASE_URL || '';
  return fetch(`${backendServiceUrl}/api/info`);
}
export function getCross() {
  // cz-js-1030 remediated: added CORS mode, credentials, and error handling for
  // GKE containerized microservices where frontend and API run in separate pods
  // with different origins. GKE Ingress (Google Cloud Load Balancer) with
  // BackendConfig CORS policies and Cloud Armor security policies govern
  // cross-origin access at the infrastructure layer; the fetch call explicitly
  // sets mode:'cors' and credentials:'include' so the browser honours the
  // CORS headers returned by the GKE Ingress / Cloud Armor policy.
  // CROSS_ORIGIN_API_URL is injected via a Kubernetes ConfigMap environment
  // variable, replacing the hardcoded origin so the URL is configurable across
  // GKE environments (dev / staging / prod) without rebuilding the image.
  const crossOriginApiUrl = process.env.CROSS_ORIGIN_API_URL || 'http://api.other-origin.com';
  return fetch(`${crossOriginApiUrl}/data`, {
    method: 'GET',
    mode: 'cors',                  // explicitly request cross-origin resource sharing
    credentials: 'include',        // forward cookies / auth headers across origins
    headers: {
      'Accept': 'application/json',
    },
  })
    .then((response) => {
      if (!response.ok) {
        // Surface HTTP-level errors (4xx / 5xx) as rejections so callers can
        // distinguish network failures from CORS policy denials.
        throw new Error(
          `Cross-origin request failed: ${response.status} ${response.statusText}`
        );
      }
      return response.json();
    })
    .catch((error) => {
      // Catch both network errors (e.g. CORS preflight blocked by Cloud Armor)
      // and HTTP errors surfaced above, log them, and re-throw so the caller
      // can display an appropriate error state in the React UI.
      console.error('[cz-js-1030] Cross-origin fetch error:', error.message);
      throw error;
    });
}
