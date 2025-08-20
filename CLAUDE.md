# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a REST API wrapper for Anthropic's Claude Code CLI, enabling programmatic access to AI-powered coding tasks. The project containerizes Claude Code and exposes it through HTTP endpoints for automation in CI/CD pipelines and workflow tools.

## Key Commands

### Running the API
```bash
# Start API server locally
node claude-code-api.js

# Build Docker image
docker build -t claude-code-yolo .

# Run with Docker Compose (recommended)
docker-compose up -d

# Check health status
curl http://localhost:8080/health
```

### Testing Claude Code Integration
```bash
# Validate installation (requires auth)
curl -H "Authorization: Bearer your-api-key" http://localhost:8080/api/claude-code/validate

# Run test task
curl -X POST -H "Authorization: Bearer your-api-key" http://localhost:8080/api/claude-code/test
```

## Architecture

### Core Components
- **claude-code-api.js**: Express server that spawns Claude Code CLI processes for each request
- **Dockerfile**: Container setup with Node.js 20, git, ripgrep, and Claude Code CLI
- **docker-compose.yml**: Orchestration with volume mounting and environment configuration

### API Design Pattern
The API wraps the Claude Code CLI by:
1. Spawning `claude -p --output=json` processes with user prompts
2. Capturing stdout/stderr with 5-minute timeout
3. Parsing JSON output (with text fallback)
4. Running git diff to track changes
5. Returning structured JSON responses

### Security Model
- Bearer token authentication via `CLAUDE_CODE_API_KEY` environment variable
- API key validation on startup
- Process isolation for each request
- Git credential handling for private repos

## Environment Configuration

Required environment variables:
- `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude Code
- `CLAUDE_CODE_API_KEY`: API authentication token (defaults to 'your-secure-api-key-here')

Optional:
- `GITHUB_TOKEN`: For private repository access
- `GIT_USER_NAME` / `GIT_USER_EMAIL`: Git commit configuration
- `CLAUDE_CODE_API_PORT`: Server port (default: 8080)

## Development Notes

### When modifying the API
- The API uses process spawning, not the Claude Code SDK
- JSON output parsing has fallback text extraction for compatibility
- 5-minute timeout is hardcoded in claude-code-api.js:98
- Health checks run every 30 seconds (configured in Dockerfile)

### Volume Mounting
- `/workspace`: Mount your codebase here for Claude Code to operate on
- `/tmp/repos`: Temporary directory for test operations

### GitHub Actions
The `.github/workflows/docker-publish.yml` workflow publishes Docker images to GitHub Container Registry on push to main branch.

### Error Handling
The API handles:
- Claude Code process failures
- JSON parsing errors
- Authentication failures
- Timeout scenarios (5 minutes)
- Git operation failures

## Testing Approach

No formal test suite exists. Testing is done through:
1. `/health` endpoint for basic connectivity
2. `/api/claude-code/validate` for Claude Code installation check
3. `/api/claude-code/test` for end-to-end validation in temporary directory
4. Manual testing with curl or API clients

When adding features, test through the API endpoints rather than unit tests.