#!/bin/bash

# Test script for Claude Code API
# Make sure the API is running first: node claude-code-api.js

API_URL="http://localhost:8080"
API_KEY="${CLAUDE_CODE_API_KEY:-your-secure-api-key-here}"

echo "Testing Claude Code API at $API_URL"
echo "Using API Key: ${API_KEY:0:10}..."
echo ""

# Test 1: Health check
echo "1. Testing health endpoint..."
curl -s "$API_URL/health" | jq .
echo ""

# Test 2: Validate endpoint
echo "2. Testing validate endpoint..."
curl -s -H "Authorization: Bearer $API_KEY" \
  "$API_URL/api/claude-code/validate" | jq .
echo ""

# Test 3: Simple task in current directory
echo "3. Testing simple task in current directory..."
curl -s -X POST \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Create a file called test-output.txt with the text: Hello from Claude Code API",
    "codebasePath": "."
  }' \
  "$API_URL/api/claude-code" | jq .
echo ""

# Test 4: Test endpoint (runs in temp directory)
echo "4. Testing test endpoint..."
curl -s -X POST \
  -H "Authorization: Bearer $API_KEY" \
  "$API_URL/api/claude-code/test" | jq .
echo ""

# Clean up test file if created
if [ -f "test-output.txt" ]; then
  echo "Cleaning up test-output.txt"
  rm test-output.txt
fi

echo "Tests complete!"