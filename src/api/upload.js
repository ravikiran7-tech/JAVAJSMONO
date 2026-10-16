import { BlobServiceClient } from '@azure/storage-blob';
import { DefaultAzureCredential } from '@azure/identity';

// cz-js-1049 FIXED: Replaced jQuery file upload writing to local container filesystem
// with Azure Blob Storage upload using AKS Workload Identity (passwordless access).
// The @azure/storage-blob SDK streams the file directly to Azure Blob Storage,
// ensuring file persistence across pod restarts, evictions, and horizontal scaling.
//
// Required environment variables (injected via Kubernetes ConfigMap / Secret):
//   REACT_APP_AZURE_STORAGE_ACCOUNT_NAME  – Azure Storage account name
//                                           e.g. mystorageaccount
//   REACT_APP_AZURE_STORAGE_CONTAINER     – Blob container name
//                                           e.g. uploads
//
// AKS Workload Identity must be configured on the pod's service account so that
// DefaultAzureCredential can obtain a token without any stored credentials.
export async function uploadToDisk(file) {
  const accountName = process.env.REACT_APP_AZURE_STORAGE_ACCOUNT_NAME;
  const containerName = process.env.REACT_APP_AZURE_STORAGE_CONTAINER;

  // Use DefaultAzureCredential which automatically picks up the AKS Workload
  // Identity federated token — no passwords or connection strings required.
  const credential = new DefaultAzureCredential();

  const blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  );

  const containerClient = blobServiceClient.getContainerClient(containerName);

  // Use the original file name as the blob name; prefix with a timestamp to
  // avoid collisions when multiple pods handle concurrent uploads.
  const blobName = `${Date.now()}-${file.name}`;
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  // Stream the file buffer directly to Azure Blob Storage.
  await blockBlobClient.uploadData(file, {
    blobHTTPHeaders: { blobContentType: file.type },
  });

  return { blobName, url: blockBlobClient.url };
}

// cz-js-1003 FIXED: Replaced hardcoded port 8080 in backend API base URL with
// environment variable REACT_APP_BACKEND_API_URL injected via Azure Key Vault
// CSI Driver and AKS ConfigMap. This enables dynamic port-free service discovery
// through Kubernetes services and Istio service mesh on AKS.
//
// Required environment variable (injected via Kubernetes ConfigMap / Key Vault Secret):
//   REACT_APP_BACKEND_API_URL – Base URL for the backend API service
//                               e.g. http://backend/api  (no hardcoded port)
export function getData() {
  const backendApiUrl = process.env.REACT_APP_BACKEND_API_URL || '';
  return fetch(`${backendApiUrl}/data`);
}

// cz-js-1004 FIXED: Replaced localhost URL 'http://localhost:3001/api/info' with
// the AKS Kubernetes service DNS name injected via Azure Key Vault CSI Driver and
// Secrets Store CSI driver mounted as a Kubernetes Secret / ConfigMap environment
// variable. Localhost URLs break in multi-container AKS deployments where the
// frontend and backend run in separate pods with isolated network namespaces.
// Using the Kubernetes service DNS name (e.g. http://info-service/api) enables
// proper inter-pod routing through the AKS cluster DNS and Kubernetes service mesh.
//
// Required environment variable (injected via Azure Key Vault CSI / Kubernetes ConfigMap):
//   REACT_APP_LOCAL_API_URL – AKS Kubernetes service DNS name for the local/info service
//                             e.g. http://info-service/api  (replaces http://localhost:3001)
//
// Azure Key Vault CSI Driver setup (secretProviderClass):
//   - Store the service DNS name as a secret in Azure Key Vault
//   - Mount it via SecretProviderClass into the pod as an environment variable
//   - Reference it in the Deployment manifest under env[].valueFrom.secretKeyRef
export function getLocal() {
  // cz-js-1004: localhost URL replaced with AKS service DNS name via env var
  const localApiUrl = process.env.REACT_APP_LOCAL_API_URL || '';
  return fetch(`${localApiUrl}/info`);
}

// cz-js-1030 FIXED: Added CORS error handling for cross-origin fetch calls in
// containerized AKS microservices deployments where the React frontend and the
// external API run in separate containers / origins behind an Azure Application
// Gateway Ingress Controller (AGIC).
//
// Changes applied:
//   1. Replaced the hardcoded cross-origin URL with the environment variable
//      REACT_APP_CROSS_ORIGIN_API_URL so the target origin can be configured
//      per environment (dev / staging / prod) via Kubernetes ConfigMap or
//      Azure Key Vault CSI Driver without rebuilding the image.
//   2. Added `mode: 'cors'` to the RequestInit options so the browser sends
//      a proper CORS preflight (OPTIONS) request as required by AGIC CORS
//      rewrite rules and Kubernetes NetworkPolicy.
//   3. Added `credentials: 'include'` to forward cookies / auth tokens across
//      origins when the AGIC CORS policy allows credentials.
//   4. Wrapped the fetch in a try/catch with a descriptive CORS-specific error
//      message to surface network-policy or missing CORS-header failures clearly
//      in AKS pod logs and browser DevTools.
//   5. Added an explicit HTTP-error guard (response.ok) so non-2xx responses
//      (e.g. 403 from AGIC when the origin is not whitelisted) are thrown as
//      errors rather than silently returning an empty body.
//
// Required environment variable (injected via Kubernetes ConfigMap / Key Vault):
//   REACT_APP_CROSS_ORIGIN_API_URL – Full base URL of the cross-origin API
//                                    e.g. https://api.other-origin.com
export async function getCross() {
  // cz-js-1030: cross-origin URL sourced from env var; explicit CORS mode and
  // credentials forwarding required by AGIC CORS rewrite rules on AKS.
  const crossOriginApiUrl =
    process.env.REACT_APP_CROSS_ORIGIN_API_URL || 'http://api.other-origin.com';

  try {
    const response = await fetch(`${crossOriginApiUrl}/data`, {
      method: 'GET',
      mode: 'cors',           // Enforce CORS preflight for cross-origin requests
      credentials: 'include', // Forward cookies/auth tokens across origins (AGIC must allow)
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      // Surface CORS / AGIC policy rejections (e.g. 403, 0) as explicit errors
      throw new Error(
        `CORS request failed: HTTP ${response.status} ${response.statusText} ` +
        `from ${crossOriginApiUrl}/data. ` +
        `Verify AGIC CORS rewrite rules allow origin '${window.location.origin}' ` +
        `and that the AKS NetworkPolicy permits egress to the target service.`
      );
    }

    return response.json();
  } catch (error) {
    // Re-throw with additional context so AKS pod logs and browser DevTools
    // clearly identify CORS / network-policy failures vs. application errors.
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      throw new Error(
        `CORS network error: Unable to reach ${crossOriginApiUrl}/data. ` +
        `This is likely caused by a missing CORS header on the server, a blocked ` +
        `preflight (OPTIONS) request, or an AKS NetworkPolicy / AGIC rule that ` +
        `does not whitelist origin '${window.location.origin}'. ` +
        `Original error: ${error.message}`
      );
    }
    throw error;
  }
}
