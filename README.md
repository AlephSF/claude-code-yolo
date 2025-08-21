# Claude Code API

A production-ready REST API wrapper for Anthropic's Claude Code, built with the official SDK. Execute AI-powered coding tasks programmatically with enterprise-grade reliability and performance.

## 🚀 Features

- **Official SDK Integration**: Uses `@anthropic-ai/claude-code` for maximum reliability
- **REST API**: Simple HTTP endpoints for automation and integration
- **Docker Ready**: Multi-platform containers with health checks
- **Cost Tracking**: Built-in API usage and cost monitoring
- **Git Integration**: Automatic change tracking and diff reporting
- **Session Management**: Multi-turn conversations with context preservation
- **Production Grade**: Proper error handling, logging, and graceful shutdown

## 🏃‍♂️ Quick Start

### Using Docker (Recommended)

```bash
docker run -d \
  --name claude-code-api \
  -p 8080:8080 \
  -e ANTHROPIC_API_KEY=your-anthropic-api-key \
  -e CLAUDE_CODE_API_KEY=your-secure-api-key \
  -v $(pwd):/workspace \
  ghcr.io/alephsf/claude-code-yolo:latest
```

### Using Docker Compose

1. Create `.env` file:
```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
CLAUDE_CODE_API_KEY=your-secure-api-key
```

2. Run:
```bash
docker-compose up -d
```

## 📡 API Reference

### Health Check
```bash
curl http://localhost:8080/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-08-21T04:30:30.009Z",
  "version": "2.0.0-sdk",
  "sdk": "claude-code"
}
```

### Execute Coding Task
```bash
curl -X POST http://localhost:8080/api/claude-code \
  -H "Authorization: Bearer your-secure-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Add error handling to all functions in main.py",
    "codebase_path": "/workspace",
    "context": "Use try-catch blocks and log errors appropriately"
  }'
```

**Response:**
```json
{
  "success": true,
  "result": "Added comprehensive error handling to 5 functions in main.py with proper logging and exception handling.",
  "summary": "Task completed successfully in 3 turn(s)",
  "cost": 0.051476,
  "duration_ms": 11083,
  "changes": {
    "hasChanges": true,
    "changedFiles": ["main.py", "utils.py"]
  }
}
```

### Validate Installation
```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:8080/api/claude-code/validate
```

### Test Endpoint
```bash
curl -X POST \
  -H "Authorization: Bearer your-api-key" \
  http://localhost:8080/api/claude-code/test
```

## 🔧 Configuration

### Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | ✅ Yes | Your Anthropic API key | - |
| `CLAUDE_CODE_API_KEY` | No | API authentication token | `your-secure-api-key-here` |
| `CLAUDE_CODE_API_PORT` | No | Server port | `8080` |
| `GIT_USER_NAME` | No | Git commit author name | - |
| `GIT_USER_EMAIL` | No | Git commit author email | - |
| `GITHUB_TOKEN` | No | GitHub token for private repos | - |

### Request Format

```typescript
{
  "task": string,           // Required: The coding task to execute
  "codebase_path": string, // Required: Path to your code (usually /workspace)
  "context"?: string       // Optional: Additional context or instructions
}
```

### Response Format

```typescript
{
  "success": boolean,
  "result": string,        // Claude's response about what was accomplished
  "summary": string,       // Brief summary of the task completion
  "cost": number,         // API cost in USD
  "duration_ms": number,  // Execution time in milliseconds
  "changes": {
    "hasChanges": boolean,
    "changedFiles": string[] // List of files that were modified
  }
}
```

## 📚 Integration Examples

### Python
```python
import requests

def claude_code_task(task, path="/workspace"):
    response = requests.post(
        "http://localhost:8080/api/claude-code",
        headers={
            "Authorization": "Bearer your-secure-api-key",
            "Content-Type": "application/json"
        },
        json={
            "task": task,
            "codebase_path": path
        }
    )
    return response.json()

# Usage
result = claude_code_task("Optimize database queries in models.py")
print(f"✅ {result['summary']} (Cost: ${result['cost']:.4f})")
```

### Node.js/TypeScript
```typescript
import axios from 'axios';

interface ClaudeCodeResponse {
  success: boolean;
  result: string;
  summary: string;
  cost: number;
  duration_ms: number;
  changes: {
    hasChanges: boolean;
    changedFiles: string[];
  };
}

async function claudeCode(task: string, path = "/workspace"): Promise<ClaudeCodeResponse> {
  const { data } = await axios.post<ClaudeCodeResponse>(
    'http://localhost:8080/api/claude-code',
    { task, codebase_path: path },
    {
      headers: {
        'Authorization': 'Bearer your-secure-api-key',
        'Content-Type': 'application/json'
      }
    }
  );
  return data;
}
```

### GitHub Actions
```yaml
name: Auto-improve Code
on: [push]

jobs:
  claude-code:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Claude Code
        run: |
          curl -X POST http://your-server:8080/api/claude-code \
            -H "Authorization: Bearer ${{ secrets.CLAUDE_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{
              "task": "Review and optimize the code for performance",
              "codebase_path": "/workspace"
            }'
```

### Curl Examples
```bash
# Simple task
curl -X POST http://localhost:8080/api/claude-code \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"task": "Add docstrings to all functions", "codebase_path": "/workspace"}'

# Complex refactoring
curl -X POST http://localhost:8080/api/claude-code \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Refactor the authentication system to use JWT tokens",
    "codebase_path": "/workspace",
    "context": "Keep backward compatibility and add comprehensive tests"
  }'
```

## 🏗️ Architecture

### Claude Code SDK Integration
This API uses the official `@anthropic-ai/claude-code` SDK instead of CLI process spawning, providing:

- **Reliability**: No process timeouts or hanging
- **Performance**: Direct SDK calls are faster and more efficient
- **Features**: Access to advanced SDK features like session management
- **Monitoring**: Built-in cost tracking and usage analytics
- **Error Handling**: Proper error types and structured responses

### Container Architecture
- **Base**: Node.js 20 on Debian Slim
- **User**: Runs as non-root `claudeuser` for security
- **Dependencies**: Git, curl, ripgrep, jq for Claude Code functionality
- **Health Checks**: Built-in health monitoring every 30 seconds

## 🔒 Security

- **Authentication**: Bearer token authentication on all API endpoints
- **Non-root**: Container runs as non-privileged user
- **Secrets**: Environment variables for sensitive data
- **Isolation**: File operations contained within mounted volumes
- **Permissions**: Configurable permission handling for automation

## 🐛 Troubleshooting

### Check Container Status
```bash
docker logs claude-code-api
docker exec claude-code-api curl http://localhost:8080/health
```

### Common Issues

**"Unauthorized" errors:**
- Verify `CLAUDE_CODE_API_KEY` is set correctly
- Check Authorization header format: `Bearer your-api-key`

**"ANTHROPIC_API_KEY required" errors:**
- Ensure your Anthropic API key is valid and has sufficient credits
- Check environment variable is passed to container

**SDK errors:**
- Verify your Anthropic API key has Claude Code access
- Check the task format and codebase_path

### Debug Mode
```bash
# Run with verbose logging
docker run -it --rm \
  -e ANTHROPIC_API_KEY=your-key \
  -v $(pwd):/workspace \
  claude-code-yolo:latest
```

## 🏁 Building from Source

```bash
git clone https://github.com/AlephSF/claude-code-yolo
cd claude-code-yolo
docker build -t claude-code-yolo .

# Or for multi-platform
docker buildx build --platform linux/amd64,linux/arm64 -t claude-code-yolo .
```

## 📦 Available Images

- `ghcr.io/alephsf/claude-code-yolo:latest` - Latest stable release
- `ghcr.io/alephsf/claude-code-yolo:main` - Main branch builds
- `ghcr.io/alephsf/claude-code-yolo:v1.0.0` - Specific version tags

Multi-platform support: `linux/amd64`, `linux/arm64`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Docker
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Credits

Built on [Anthropic's Claude Code SDK](https://docs.anthropic.com/en/docs/claude-code) with ❤️