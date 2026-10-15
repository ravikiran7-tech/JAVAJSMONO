package com.trianz.reactnextjs.controller;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.trianz.reactnextjs.service.S3UploadService;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Responds to POST /api/upload/presigned-url with a pre-signed S3 URL
 * for direct client-side file uploads.
 */
public class UploadController implements HttpHandler {

    private final S3UploadService s3UploadService = new S3UploadService();

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.sendResponseHeaders(405, -1);
            return;
        }

        try {
            // Read request body to get filename
            String requestBody = new String(
                exchange.getRequestBody().readAllBytes(),
                StandardCharsets.UTF_8
            );
            
            // Generate pre-signed URL
            String presignedUrl = s3UploadService.generatePresignedUrl(requestBody);
            
            // Return JSON response
            String jsonResponse = String.format(
                "{\"presignedUrl\":\"%s\",\"status\":\"success\"}",
                presignedUrl
            );
            
            byte[] body = jsonResponse.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.sendResponseHeaders(200, body.length);
            
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        } catch (Exception e) {
            String errorResponse = String.format(
                "{\"error\":\"%s\",\"status\":\"failed\"}",
                e.getMessage()
            );
            byte[] body = errorResponse.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(500, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        }
    }
}
