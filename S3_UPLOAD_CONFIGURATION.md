# S3 File Upload Configuration

## Overview
This application has been migrated from local filesystem uploads to Amazon S3 for containerization compatibility. File uploads now use pre-signed URLs for direct client-to-S3 uploads.

## Architecture
1. **Frontend (React)**: Requests a pre-signed URL from the backend
2. **Backend (Java)**: Generates S3 pre-signed URLs using AWS credentials
3. **S3**: Stores uploaded files persistently across container restarts

## Required Environment Variables

### Backend (Java Application)
```bash
AWS_REGION=us-east-1                    # AWS region for S3 bucket
S3_BUCKET_NAME=my-upload-bucket         # S3 bucket name for uploads
AWS_ACCESS_KEY_ID=your-access-key       # AWS access key (use IAM role in EKS)
AWS_SECRET_ACCESS_KEY=your-secret-key   # AWS secret key (use IAM role in EKS)
```

### Frontend (React Application)
```bash
BACKEND_URL=http://backend:8080         # Backend service URL
S3_BUCKET_NAME=my-upload-bucket         # S3 bucket name (for reference)
```

## Kubernetes Deployment

### Option 1: Using IAM Roles for Service Accounts (IRSA) - Recommended
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT_ID:role/S3UploadRole
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: react-nextjs-app
spec:
  template:
    spec:
      serviceAccountName: app-service-account
      containers:
      - name: app
        image: your-image:tag
        env:
        - name: AWS_REGION
          value: "us-east-1"
        - name: S3_BUCKET_NAME
          value: "my-upload-bucket"
        - name: BACKEND_URL
          value: "http://backend:8080"
```

### Option 2: Using Kubernetes Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: aws-credentials
type: Opaque
stringData:
  AWS_ACCESS_KEY_ID: your-access-key
  AWS_SECRET_ACCESS_KEY: your-secret-key
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: react-nextjs-app
spec:
  template:
    spec:
      containers:
      - name: app
        image: your-image:tag
        env:
        - name: AWS_REGION
          value: "us-east-1"
        - name: S3_BUCKET_NAME
          value: "my-upload-bucket"
        - name: BACKEND_URL
          value: "http://backend:8080"
        - name: AWS_ACCESS_KEY_ID
          valueFrom:
            secretKeyRef:
              name: aws-credentials
              key: AWS_ACCESS_KEY_ID
        - name: AWS_SECRET_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: aws-credentials
              key: AWS_SECRET_ACCESS_KEY
```

## S3 Bucket Configuration

### Bucket Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPresignedUploads",
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT_ID:role/S3UploadRole"
      },
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::my-upload-bucket/uploads/*"
    }
  ]
}
```

### CORS Configuration
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

## API Endpoints

### POST /api/upload/presigned-url
Generates a pre-signed URL for uploading a file to S3.

**Request:**
```json
{
  "filename": "example.pdf"
}
```

**Response:**
```json
{
  "presignedUrl": "https://my-upload-bucket.s3.us-east-1.amazonaws.com/uploads/example.pdf?X-Amz-Algorithm=...",
  "status": "success"
}
```

### GET /api/health
Health check endpoint for Kubernetes liveness/readiness probes.

**Response:**
```json
{
  "status": "UP"
}
```

## Usage Example

```javascript
import { uploadToDisk } from './api/upload';

// Upload a file
const fileInput = document.getElementById('fileInput');
const file = fileInput.files[0];

try {
  const result = await uploadToDisk(file);
  console.log('Upload successful:', result);
} catch (error) {
  console.error('Upload failed:', error);
}
```

## Migration Notes

### What Changed
- **Before**: Files were written to local container filesystem using `fs.writeFileSync()`
- **After**: Files are uploaded directly to S3 using pre-signed URLs

### Benefits
- ✅ Files persist across container restarts
- ✅ Files are accessible from all pod replicas
- ✅ Horizontal scaling works correctly
- ✅ No data loss on pod eviction
- ✅ Centralized storage with S3 durability

### Considerations
- Ensure S3 bucket exists before deployment
- Configure appropriate IAM permissions
- Set up S3 lifecycle policies for cost optimization
- Monitor S3 costs and usage
- Implement file size limits in the backend
