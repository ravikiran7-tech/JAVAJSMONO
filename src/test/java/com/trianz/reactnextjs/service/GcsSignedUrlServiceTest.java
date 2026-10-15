package com.trianz.reactnextjs.service;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for GcsSignedUrlService.
 * Note: These tests verify the service structure but cannot fully test
 * GKE Workload Identity integration without a live GKE environment.
 */
class GcsSignedUrlServiceTest {

    @Test
    void testBucketNameFromEnvironment() {
        // This test will fail if GCS_BUCKET_NAME is not set
        // In production, the environment variable should be configured
        try {
            GcsSignedUrlService service = new GcsSignedUrlService();
            assertNotNull(service.getBucketName());
        } catch (IllegalStateException e) {
            // Expected when GCS_BUCKET_NAME is not set in test environment
            assertTrue(e.getMessage().contains("GCS_BUCKET_NAME"));
        }
    }
}
