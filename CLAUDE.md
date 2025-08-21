# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a production-ready REST API wrapper for Anthropic's Claude Code, built using the official `@anthropic-ai/claude-code` SDK. The project provides HTTP endpoints to execute AI-powered coding tasks programmatically, designed for automation in CI/CD pipelines and workflow tools.

## Key Commands

### Development
```bash
# Install dependencies
npm install

# Start API server locally
npm start
# or
node claude-code-api.js

# Development with auto-reload
npm run dev
```

### Docker Operations
```bash
# Build image
docker build -t claude-code-yolo .

# Run container
docker run -d \
  --name claude-code-api \
  -p 8080:8080 \
  -e ANTHROPIC_API_KEY=your-key \
  -e CLAUDE_CODE_API_KEY=your-api-key \
  -v $(pwd):/workspace \
  claude-code-yolo

# Check container logs
docker logs claude-code-api

# Multi-platform build
docker buildx build --platform linux/amd64,linux/arm64 -t claude-code-yolo .
```

### Testing
```bash
# Health check
curl http://localhost:8080/health

# Validate SDK installation
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:8080/api/claude-code/validate

# Test task execution
curl -X POST http://localhost:8080/api/claude-code \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"task": "Create a test file", "codebase_path": "/workspace"}'
```

## Architecture

### Core Components
- **claude-code-api.js**: Express server using `@anthropic-ai/claude-code` SDK
- **package.json**: ES module configuration with SDK dependencies
- **Dockerfile**: Multi-stage build with Node.js 20 and security hardening

### SDK Integration Pattern
The API uses the official Claude Code SDK through the `query` function:
```javascript
import { query } from '@anthropic-ai/claude-code';

for await (const message of query({
  prompt: userTask,
  options: {
    systemPrompt: "You are a helpful coding assistant...",
    maxTurns: 5,
    cwd: codebasePath,
    permissionMode: 'acceptEdits' // Auto-approve for automation
  }
})) {
  if (message.type === "result") {
    // Handle successful completion
  }
}
```

### Key Architectural Decisions
1. **SDK over CLI**: Uses `@anthropic-ai/claude-code` instead of spawning CLI processes
2. **ES Modules**: Modern JavaScript module system for better tooling
3. **Non-root Container**: Runs as `claudeuser` for security
4. **Structured Responses**: Consistent JSON with cost tracking and change detection
5. **Permission Auto-approval**: Uses `permissionMode: 'acceptEdits'` for automation

## Environment Configuration

Required environment variables:
- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude Code SDK

Optional configuration:
- `CLAUDE_CODE_API_KEY`: API authentication token (default: 'your-secure-api-key-here')
- `CLAUDE_CODE_API_PORT`: Server port (default: 8080)
- `GIT_USER_NAME` / `GIT_USER_EMAIL`: Git commit configuration
- `GITHUB_TOKEN`: For private repository access

## API Design

### Endpoints
- `GET /health`: Health check with version info
- `POST /api/claude-code`: Execute coding tasks (authenticated)
- `GET /api/claude-code/validate`: Validate SDK installation (authenticated)
- `POST /api/claude-code/test`: Run test in temporary directory (authenticated)

### Request/Response Format
```typescript
// Request
{
  "task": string,           // Required: Coding instruction
  "codebase_path": string, // Required: Working directory path
  "context"?: string       // Optional: Additional context
}

// Response
{
  "success": boolean,
  "result": string,        // Claude's output
  "summary": string,       // Task completion summary
  "cost": number,         // API cost in USD
  "duration_ms": number,  // Execution time
  "changes": {            // Git change tracking
    "hasChanges": boolean,
    "changedFiles": string[]
  }
}
```

## Development Notes

### When modifying the API
- The SDK provides structured responses with cost tracking
- All file operations go through Claude Code's permission system
- Git diff tracking runs after each task to detect changes
- Use `permissionMode: 'acceptEdits'` for automation scenarios

### Error Handling
The API handles multiple error types:
- SDK execution failures (malformed requests, permission denials)
- Authentication failures (missing/invalid API keys)
- Network/timeout issues (with 15-minute max execution time)
- Git operation failures (graceful degradation)

### Container Security
- Runs as non-root user `claudeuser` (UID 1001)
- Volume mounting for workspace access (`/workspace`)
- Health checks every 30 seconds
- Graceful shutdown handling (SIGTERM/SIGINT)

### GitHub Actions
The `.github/workflows/docker-publish.yml` workflow:
- Builds multi-platform images (linux/amd64, linux/arm64)
- Publishes to GitHub Container Registry
- Tags with version, branch, and SHA
- Uses Docker Buildx with GitHub Actions cache

## Performance Characteristics

### SDK vs CLI Benefits
- **Startup time**: ~2-3 seconds vs 10+ seconds for CLI spawn
- **Memory usage**: Lower overhead, no process spawning
- **Reliability**: No process hanging or timeout issues
- **Features**: Access to SDK-specific features like session management
- **Cost tracking**: Built-in usage monitoring and cost reporting

### Typical Response Times
- Simple tasks (file creation): 8-12 seconds
- Complex refactoring: 15-30 seconds
- Multi-file operations: 20-45 seconds

## Testing Approach

No formal test suite - testing through API endpoints:
1. `/health` for basic connectivity
2. `/api/claude-code/validate` for SDK functionality
3. `/api/claude-code/test` for end-to-end validation
4. Manual integration testing with real coding tasks

When adding features, test through the API endpoints and verify:
- Proper cost tracking in responses
- Git change detection accuracy
- Error handling for edge cases
- Multi-turn conversation support