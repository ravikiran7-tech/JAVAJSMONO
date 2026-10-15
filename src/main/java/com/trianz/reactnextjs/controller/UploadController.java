package com.trianz.reactnextjs.controller;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.trianz.reactnextjs.service.BlobStorageService;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Controller for generating Azure Blob Storage SAS tokens.
 * Responds to POST /api/upload/sas-token with a SAS URL for file upload.
 */
public class UploadController implements HttpHandler {

    private final BlobStorageService blobStorageService = new BlobStorageService();

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        // Only accept POST requests
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
            return;
        }

        try {
            // Read request body
            String requestBody = new String(
                exchange.getRequestBody().readAllBytes(), 
                StandardCharsets.UTF_8
            );
            
            // Parse JSON manually (no external dependencies)
            String fileName = extractFileName(requestBody);
            
            if (fileName == null || fileName.isEmpty()) {
                sendResponse(exchange, 400, "{\"error\":\"fileName is required\"}");
                return;
            }
            
            // Generate SAS token
            String response = blobStorageService.generateSasToken(fileName);
            
            sendResponse(exchange, 200, response);
            
        } catch (Exception e) {
            String errorResponse = String.format(
                "{\"error\":\"Failed to generate SAS token: %s\"}", 
                e.getMessage().replace("\"", "\\\"")
            );
            sendResponse(exchange, 500, errorResponse);
        }
    }
    
    /**
     * Extracts fileName from JSON request body.
     * Simple JSON parsing without external dependencies.
     */
    private String extractFileName(String json) {
        // Simple JSON parsing for {"fileName":"value"}
        int fileNameIndex = json.indexOf("\"fileName\"");
        if (fileNameIndex == -1) {
            return null;
        }
        
        int colonIndex = json.indexOf(":", fileNameIndex);
        if (colonIndex == -1) {
            return null;
        }
        
        int startQuote = json.indexOf("\"", colonIndex);
        if (startQuote == -1) {
            return null;
        }
        
        int endQuote = json.indexOf("\"", startQuote + 1);
        if (endQuote == -1) {
            return null;
        }
        
        return json.substring(startQuote + 1, endQuote);
    }
    
    /**
     * Sends HTTP response with JSON content type.
     */
    private void sendResponse(HttpExchange exchange, int statusCode, String body) 
            throws IOException {
        byte[] responseBytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "POST, OPTIONS");
        exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type");
        exchange.sendResponseHeaders(statusCode, responseBytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(responseBytes);
        }
    }
}
