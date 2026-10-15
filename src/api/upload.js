import axios from 'axios';

/**
 * Upload file to S3 using pre-signed URL from backend.
 * This replaces local filesystem writes with cloud object storage.
 * 
 * @param {File} file - The file to upload
 * @returns {Promise} - Resolves when upload is complete
 */
export async function uploadToS3(file) {
  try {
    // Step 1: Request pre-signed URL from backend
    const backendUrl = window.__ENV__.BACKEND_URL;
    const response = await axios.post(
      `${backendUrl}/api/upload/presigned-url`,
      { filename: file.name },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const { presignedUrl } = response.data;

    // Step 2: Upload file directly to S3 using pre-signed URL
    await axios.put(presignedUrl, file, {
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      }
    });

    return { success: true, message: 'File uploaded to S3 successfully' };
  } catch (error) {
    console.error('S3 upload failed:', error);
    throw new Error(`Upload failed: ${error.message}`);
  }
}

export function getData() {
  const backendUrl = window.__ENV__.BACKEND_URL;
  return fetch(`${backendUrl}/api/data`);
}
export function getLocal() {
  // Fixed: cz-js-1004 - Use environment variable for backend URL instead of localhost
  const backendUrl = window.__ENV__.BACKEND_URL;
  return fetch(`${backendUrl}/api/info`);
}
export async function getCross() {
  // Fixed: cz-js-1030 - Added CORS error handling for containerized microservices
  try {
    const response = await fetch('http://api.other-origin.com/data', {
      mode: 'cors',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    // Handle CORS and network errors for containerized environments
    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
      console.error('CORS or network error - check Ingress CORS configuration:', error);
      throw new Error('Cross-origin request failed. Verify NGINX Ingress CORS annotations are configured.');
    }
    console.error('API request failed:', error);
    throw error;
  }
}
