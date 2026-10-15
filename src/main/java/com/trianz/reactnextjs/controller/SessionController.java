package com.trianz.reactnextjs.controller;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.trianz.reactnextjs.service.RedisService;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.stream.Collectors;

/**
 * Session Controller for managing Redis-backed session state.
 * Provides RESTful API endpoints for session management in containerized environments.
 * 
 * Endpoints:
 * - GET /api/session/{key} - Get session data
 * - POST /api/session - Set session data
 * - DELETE /api/session/{key} - Delete session data
 * - PUT /api/session/{key}/refresh - Refresh session TTL
 * 
 * cz-js-1032 REMEDIATION: Backend API for Redis-backed session management
 */
public class SessionController implements HttpHandler {
    
    private final RedisService redisService;
    
    public SessionController(RedisService redisService) {
        this.redisService = redisService;
    }
    
    @Override
    public void handle(HttpExchange exchange) throws IOException {
        // Enable CORS for frontend requests
        exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
        exchange.getResponseHeaders().add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        exchange.getResponseHeaders().add("Access-Control-Allow-Headers", "Content-Type");
        exchange.getResponseHeaders().add("Access-Control-Allow-Credentials", "true");
        
        String method = exchange.getRequestMethod();
        String path = exchange.getRequestURI().getPath();
        
        // Handle preflight OPTIONS request
        if ("OPTIONS".equals(method)) {
            exchange.sendResponseHeaders(200, -1);
            return;
        }
        
        try {
            if ("GET".equals(method)) {
                handleGet(exchange, path);
            } else if ("POST".equals(method)) {
                handlePost(exchange);
            } else if ("DELETE".equals(method)) {
                handleDelete(exchange, path);
            } else if ("PUT".equals(method)) {
                handlePut(exchange, path);
            } else {
                sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}");
            }
        } catch (Exception e) {
            e.printStackTrace();
            sendResponse(exchange, 500, "{\"error\":\"Internal server error: " + e.getMessage() + "\"}");
        }
    }
    
    /**
     * GET /api/session/{key} - Get session data from Redis
     */
    private void handleGet(HttpExchange exchange, String path) throws IOException {
        String key = extractKeyFromPath(path);
        if (key == null) {
            sendResponse(exchange, 400, "{\"error\":\"Session key is required\"}");
            return;
        }
        
        String value = redisService.get(key);
        if (value == null) {
            sendResponse(exchange, 404, "{\"error\":\"Session not found\"}");
            return;
        }
        
        String response = "{\"key\":\"" + escapeJson(key) + "\",\"value\":" + value + "}";
        sendResponse(exchange, 200, response);
    }
    
    /**
     * POST /api/session - Set session data in Redis
     * Request body: {"key":"session_key","value":{...},"ttl":3600}
     */
    private void handlePost(HttpExchange exchange) throws IOException {
        String requestBody = readRequestBody(exchange);
        
        // Simple JSON parsing (in production, use a proper JSON library)
        String key = extractJsonValue(requestBody, "key");
        String value = extractJsonObject(requestBody, "value");
        int ttl = extractJsonInt(requestBody, "ttl", 3600);
        
        if (key == null || value == null) {
            sendResponse(exchange, 400, "{\"error\":\"Key and value are required\"}");
            return;
        }
        
        redisService.set(key, value, ttl);
        
        String response = "{\"success\":true,\"key\":\"" + escapeJson(key) + "\"}";
        sendResponse(exchange, 200, response);
    }
    
    /**
     * DELETE /api/session/{key} - Delete session data from Redis
     */
    private void handleDelete(HttpExchange exchange, String path) throws IOException {
        String key = extractKeyFromPath(path);
        if (key == null) {
            sendResponse(exchange, 400, "{\"error\":\"Session key is required\"}");
            return;
        }
        
        boolean deleted = redisService.delete(key);
        if (!deleted) {
            sendResponse(exchange, 404, "{\"error\":\"Session not found\"}");
            return;
        }
        
        String response = "{\"success\":true,\"key\":\"" + escapeJson(key) + "\"}";
        sendResponse(exchange, 200, response);
    }
    
    /**
     * PUT /api/session/{key}/refresh - Refresh session TTL
     * Request body: {"ttl":3600}
     */
    private void handlePut(HttpExchange exchange, String path) throws IOException {
        if (!path.endsWith("/refresh")) {
            sendResponse(exchange, 404, "{\"error\":\"Endpoint not found\"}");
            return;
        }
        
        String key = extractKeyFromPath(path.replace("/refresh", ""));
        if (key == null) {
            sendResponse(exchange, 400, "{\"error\":\"Session key is required\"}");
            return;
        }
        
        String requestBody = readRequestBody(exchange);
        int ttl = extractJsonInt(requestBody, "ttl", 3600);
        
        boolean refreshed = redisService.refresh(key, ttl);
        if (!refreshed) {
            sendResponse(exchange, 404, "{\"error\":\"Session not found or expired\"}");
            return;
        }
        
        String response = "{\"success\":true,\"key\":\"" + escapeJson(key) + "\"}";
        sendResponse(exchange, 200, response);
    }
    
    /**
     * Extract key from path like /api/session/{key}
     */
    private String extractKeyFromPath(String path) {
        String[] parts = path.split("/");
        if (parts.length >= 4) {
            return parts[3];
        }
        return null;
    }
    
    /**
     * Read request body as string
     */
    private String readRequestBody(HttpExchange exchange) throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(exchange.getRequestBody(), StandardCharsets.UTF_8))) {
            return reader.lines().collect(Collectors.joining("\n"));
        }
    }
    
    /**
     * Simple JSON value extraction (for string values)
     */
    private String extractJsonValue(String json, String key) {
        String pattern = "\"" + key + "\"\\s*:\\s*\"([^\"]+)\"";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        return null;
    }
    
    /**
     * Extract JSON object value (preserves the object structure)
     */
    private String extractJsonObject(String json, String key) {
        String pattern = "\"" + key + "\"\\s*:\\s*(\\{[^}]+\\}|\\[[^\\]]+\\]|\"[^\"]+\"|[0-9]+|true|false|null)";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(json);
        if (m.find()) {
            return m.group(1);
        }
        return null;
    }
    
    /**
     * Extract integer value from JSON
     */
    private int extractJsonInt(String json, String key, int defaultValue) {
        String pattern = "\"" + key + "\"\\s*:\\s*([0-9]+)";
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
        java.util.regex.Matcher m = p.matcher(json);
        if (m.find()) {
            try {
                return Integer.parseInt(m.group(1));
            } catch (NumberFormatException e) {
                return defaultValue;
            }
        }
        return defaultValue;
    }
    
    /**
     * Escape JSON string
     */
    private String escapeJson(String str) {
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\n", "\\n")
                  .replace("\r", "\\r")
                  .replace("\t", "\\t");
    }
    
    /**
     * Send HTTP response
     */
    private void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
