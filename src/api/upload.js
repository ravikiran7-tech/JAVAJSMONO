import axios from 'axios';

// Migrated from local filesystem to Google Cloud Storage using Signed URLs
// The backend generates signed URLs using GKE Workload Identity for keyless authentication

export async function uploadToGcs(file) {
  // Step 1: Request a signed URL from the backend
  // The backend uses GKE Workload Identity to generate the signed URL
  const backendUrl = window.__ENV__.BACKEND_URL;
  const signedUrlResponse = await axios.post(`${backendUrl}/api/upload/signed-url`, {
    fileName: file.name,
    contentType: file.type || 'application/octet-stream'
  });
  
  const { signedUrl, fileName, bucket } = signedUrlResponse.data;
  
  // Step 2: Upload the file directly to GCS using the signed URL
  await axios.put(signedUrl, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream'
    }
  });
  
  return {
    success: true,
    fileName: fileName,
    bucket: bucket,
    path: `uploads/${fileName}`
  };
}

export function getData() {
  // cz-js-1027 hardcoded API port
  return fetch(`${window.__ENV__.API_URL}/api/data`);
}
export function getLocal() {
  // cz-js-1028 localhost URL
  return fetch(`${window.__ENV__.API_URL}/api/info`);
}
export async function getCross() {
  // cz-js-1030 FIXED: Added CORS error handling for containerized microservices
  try {
    const response = await fetch('http://api.other-origin.com/data', {
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.error('CORS error or network failure:', error);
      throw new Error('Cross-origin request failed. Please check CORS configuration on the API server.');
    }
    console.error('Fetch error:', error);
    throw error;
  }
}
