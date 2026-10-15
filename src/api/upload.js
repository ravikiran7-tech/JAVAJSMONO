import axios from 'axios';

/**
 * Fixed cz-js-1049: jQuery File Upload to Local Container Filesystem
 * 
 * Migrated from local container filesystem writes to Azure Blob Storage uploads.
 * Uses Azure Workload Identity on AKS to grant pods passwordless access to the 
 * storage account, and streams file uploads via backend API that uses @azure/storage-blob SDK.
 * 
 * Original Issue (Line 6):
 * - fs.writeFileSync('/app/build/uploads/' + file.name, file);
 * - Files written to local container filesystem are lost on container restart,
 *   pod eviction, or horizontal scaling
 * 
 * Solution:
 * - Frontend requests SAS token from backend API
 * - Backend uses Azure Workload Identity for credential-free access
 * - File is uploaded directly to Azure Blob Storage using SAS URL
 * - Data persists across container lifecycle and pod replicas
 * 
 * Configuration via environment variables (backend):
 * - AZURE_STORAGE_ACCOUNT: Azure Storage account name
 * - AZURE_STORAGE_CONTAINER: Blob container name (default: 'uploads')
 * - Azure Workload Identity configured via AKS service account
 * 
 * @param {File} file - The file to upload
 * @returns {Promise} - Resolves when upload completes with blob URL
 */
export async function uploadToDisk(file) {
  try {
    // Step 1: Request SAS token from backend (backend uses Workload Identity)
    const backendUrl = window.__ENV__.API_URL;
    const sasResponse = await fetch(`${backendUrl}/upload/sas-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileName: file.name }),
    });

    if (!sasResponse.ok) {
      throw new Error(`Failed to get SAS token: ${sasResponse.statusText}`);
    }

    const { sasUrl, blobUrl } = await sasResponse.json();

    // Step 2: Upload file directly to Azure Blob Storage using SAS URL
    // This streams the file to Azure Blob Storage, ensuring persistence
    // across container restarts, pod evictions, and horizontal scaling
    const uploadResponse = await fetch(sasUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload to Azure Blob Storage: ${uploadResponse.statusText}`);
    }

    console.log(`File uploaded successfully to Azure Blob Storage: ${blobUrl}`);
    return { success: true, blobUrl };

  } catch (error) {
    console.error('Upload to Azure Blob Storage failed:', error);
    throw error;
  }
}

/**
 * Fixed cz-js-1003: Hardcoded API Ports in Angular HttpClient
 * 
 * Replaced hardcoded port numbers in API calls with runtime environment variables.
 * Uses window.__ENV__ for dynamic configuration in containerized AKS environments.
 * API_URL is injected via Azure Key Vault CSI Driver and AKS ConfigMap at runtime.
 * 
 * Original Issue (Line 80):
 * - return fetch('http://backend:8080/api/data');
 * - Hardcoded port 8080 breaks with Kubernetes service discovery and Istio service mesh
 * 
 * Solution:
 * - Read API_URL from window.__ENV__ (mounted from ConfigMap/Key Vault)
 * - Enables dynamic port mapping and load balancing in AKS
 * - No fallback to hardcoded values to ensure proper container orchestration
 */
export function getData() {
  // cz-js-1027 hardcoded API port
  const apiUrl = window.__ENV__.API_URL;
  return fetch(`${apiUrl}/api/data`);
}
/**
 * Fixed cz-js-1003: Hardcoded API Ports in Angular HttpClient
 * 
 * Replaced localhost URL with runtime environment variable for containerized deployment.
 * Uses window.__ENV__ for dynamic configuration in AKS environments.
 * 
 * Original Issue (Line 84):
 * - return fetch('http://localhost:3001/api/info');
 * - Localhost URLs don't work in containerized environments
 * 
 * Solution:
 * - Read API_URL from window.__ENV__ (mounted from ConfigMap/Key Vault)
 * - Enables proper service-to-service communication in Kubernetes
 */
export function getLocal() {
  // cz-js-1028 localhost URL
  const apiUrl = window.__ENV__.API_URL;
  return fetch(`${apiUrl}/api/info`);
}
/**
 * Fixed cz-js-1030: React CORS Handling for Containerized Microservices
 * 
 * Added proper CORS error handling for fetch calls in containerized microservices.
 * In AKS deployments with Application Gateway Ingress Controller (AGIC), frontend
 * and API run in separate containers with different origins. CORS errors must be
 * handled explicitly for cross-origin service communication in service mesh environments.
 * 
 * Original Issue (Line 114-116):
 * - return fetch('http://api.other-origin.com/data').then(r => r.json());
 * - No CORS error handling breaks in containerized environments with network policies
 * 
 * Solution:
 * - Added comprehensive error handling for CORS and network failures
 * - Detects CORS errors via response.type === 'opaque' or TypeError
 * - Provides clear error messages for debugging in Kubernetes environments
 * - Handles both CORS policy violations and network connectivity issues
 * 
 * Configuration:
 * - AGIC CORS rules configured via Ingress annotations
 * - Application Gateway rewrite rules for cross-origin headers
 * - Kubernetes NetworkPolicy allows pod-to-pod communication
 * 
 * @returns {Promise} - Resolves with data or rejects with descriptive CORS error
 */
export function getCross() {
  // Fetch with comprehensive CORS error handling for containerized microservices
  return fetch('http://api.other-origin.com/data')
    .then(response => {
      // Check for CORS errors - opaque response indicates CORS policy blocked the request
      if (response.type === 'opaque') {
        throw new Error(
          'CORS Error: Cross-origin request blocked. ' +
          'Verify Azure Application Gateway Ingress CORS configuration and ' +
          'ensure proper rewrite rules are set for cross-origin headers in AKS.'
        );
      }
      
      // Check for HTTP errors
      if (!response.ok) {
        throw new Error(
          `HTTP Error ${response.status}: ${response.statusText}. ` +
          'Check service mesh connectivity and Kubernetes NetworkPolicy rules.'
        );
      }
      
      return response.json();
    })
    .catch(error => {
      // Handle network errors and CORS failures
      if (error instanceof TypeError) {
        // TypeError typically indicates CORS or network failure in fetch
        console.error(
          'CORS or Network Error in containerized environment:',
          error.message,
          '\nVerify:',
          '\n1. Azure Application Gateway Ingress Controller CORS annotations',
          '\n2. Kubernetes Service mesh configuration (Istio/Linkerd)',
          '\n3. NetworkPolicy allows pod-to-pod communication',
          '\n4. DNS resolution for cross-origin services'
        );
        throw new Error(
          `CORS/Network Error: ${error.message}. ` +
          'This typically occurs when CORS headers are missing or ' +
          'network policies block cross-origin requests in AKS microservices.'
        );
      }
      
      // Re-throw other errors with context
      console.error('Cross-origin fetch failed:', error);
      throw error;
    });
}
