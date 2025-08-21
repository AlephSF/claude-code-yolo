#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if ANTHROPIC_API_KEY is set
if [ -z "$ANTHROPIC_API_KEY" ] || [ "$ANTHROPIC_API_KEY" = "your-anthropic-api-key-here" ]; then
    echo "ERROR: Please set your ANTHROPIC_API_KEY in the .env file"
    echo "Edit .env and replace 'your-anthropic-api-key-here' with your actual API key"
    exit 1
fi

echo "Starting Claude Code API container..."
echo "API Key: ${ANTHROPIC_API_KEY:0:10}..."
echo "API will be available at http://localhost:8080"
echo ""

# Run the container
docker run -d \
    --name claude-code-api \
    -p 8080:8080 \
    -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
    -e CLAUDE_CODE_API_KEY="${CLAUDE_CODE_API_KEY:-test-api-key-123}" \
    -e CLAUDE_CODE_API_PORT="${CLAUDE_CODE_API_PORT:-8080}" \
    -v "$(pwd)":/workspace \
    claude-code-yolo:local

echo "Container started. Checking logs..."
sleep 2
docker logs claude-code-api

echo ""
echo "To test the API, run: ./test-api.sh"
echo "To view logs: docker logs -f claude-code-api"
echo "To stop: docker stop claude-code-api && docker rm claude-code-api"
