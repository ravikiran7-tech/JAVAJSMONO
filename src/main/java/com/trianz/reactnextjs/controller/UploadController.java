package com.trianz.reactnextjs.controller;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.trianz.reactnextjs.service.GcsSignedUrlService;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Handles POST /api/upload/signed-url requests to generate GCS signed URLs.
 * Uses GKE Workload Identity for credential-free GCS access.
 */
public class UploadController implements HttpHandler {

    private final GcsSignedUrlService gcsService = new GcsSignedUrlService();

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
            return;
        }

        try {
            // Read request body
            InputStream is = exchange.getRequestBody();
            String requestBody = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            
            // Parse JSON manually (no external dependencies)
            String fileName = extractJsonValue(requestBody, "fileName");
            String contentType = extractJsonValue(requestBody, "contentType");
            
            if (fileName == null || fileName.isEmpty()) {
                sendResponse(exchange, 400, "{\"error\":\"fileName is required\"}");
                return;
            }
            
            // Generate signed URL using GKE Workload Identity
            String signedUrl = gcsService.generateSignedUrl(fileName, contentType);
            String bucketName = gcsService.getBucketName();
            
            // Return response
            String response = String.format(
                "{\"signedUrl\":\"%s\",\"fileName\":\"%s\",\"bucket\":\"%s\"}",
                signedUrl, fileName, bucketName
            );
            
            sendResponse(exchange, 200, response);
            
        } catch (Exception e) {
            String errorResponse = String.format(
                "{\"error\":\"Failed to generate signed URL: %s\"}",
                e.getMessage().replace("\"", "\\\"")
            );
            sendResponse(exchange, 500, errorResponse);
        }
    }
    
    private void sendResponse(HttpExchange exchange, int statusCode, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
    
    private String extractJsonValue(String json, String key) {
        String searchKey = "\"" + key + "\"";
        int keyIndex = json.indexOf(searchKey);
        if (keyIndex == -1) return null;
        
        int colonIndex = json.indexOf(":", keyIndex);
        if (colonIndex == -1) return null;
        
        int startQuote = json.indexOf("\"", colonIndex);
        if (startQuote == -1) return null;
        
        int endQuote = json.indexOf("\"", startQuote + 1);
        if (endQuote == -1) return null;
        
        return json.substring(startQuote + 1, endQuote);
    }
}
