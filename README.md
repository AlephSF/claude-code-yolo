# claude-code-yolo

A simple Docker container that runs Claude Code as an API service. Execute AI-powered coding tasks programmatically via REST API.

## What is this?

This wraps Anthropic's Claude Code CLI tool in a simple Express-based HTTP API, making it easy to:
- Automate coding tasks
- Integrate with CI/CD pipelines  
- Build custom automation workflows
- Use with any tool that can make HTTP requests (n8n, Zapier, GitHub Actions, etc.)

## Quick Start

### Option 1: Docker Run

```bash
docker run -d \
  -p 8080:8080 \
  -e ANTHROPIC_API_KEY=your-anthropic-api-key \
  -e CLAUDE_CODE_API_KEY=your-secure-api-key \
  -v $(pwd):/workspace \
  ghcr.io/YOUR_USERNAME/claude-code-yolo:latest
```

### Option 2: Docker Compose

1. Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  claude-code-api:
    image: ghcr.io/YOUR_USERNAME/claude-code-yolo:latest
    container_name: claude-code-yolo
    ports:
      - "8080:8080"
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - CLAUDE_CODE_API_KEY=${CLAUDE_CODE_API_KEY}
    volumes:
      - ./workspace:/workspace
```

2. Create `.env` file:

```env
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
CLAUDE_CODE_API_KEY=your-secure-api-key
```

3. Run:

```bash
docker-compose up -d
```

## API Usage

### Health Check

```bash
curl http://localhost:8080/health
```

### Execute Claude Code Task

```bash
curl -X POST http://localhost:8080/api/claude-code \
  -H "Authorization: Bearer your-secure-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "task": "Refactor getLolCatPhotos to get more recent photos",
    "codebase_path": "/workspace",
    "context": "Add unit tests in jest"
  }'
```

### Validate Installation

```bash
curl http://localhost:8080/api/claude-code/validate \
  -H "Authorization: Bearer your-secure-api-key"
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/claude-code` | POST | Execute a Claude Code task |
| `/api/claude-code/validate` | GET | Validate Claude Code installation |
| `/api/claude-code/test` | POST | Run a simple test task |

## Request Body Format

```json
{
  "task": "Your coding instruction here",
  "codebase_path": "/workspace/your-project",
  "context": "Optional additional context"
}
```

## Response Format

```json
{
  "success": true,
  "taskId": "abc123",
  "summary": "Created the requested function with tests",
  "changes": "Files modified: example.py, test_example.py",
  "output": "Claude's execution output",
  "executionTime": 5234
}
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key | - |
| `CLAUDE_CODE_API_KEY` | No | API authentication key | - |
| `GITHUB_TOKEN` | No | GitHub personal access token for private repos | - |
| `GIT_USER_NAME` | No | Git commit author name | Claude Bot |
| `GIT_USER_EMAIL` | No | Git commit author email | claude@example.com |

## Examples

### Python Script Example

```python
import requests
import json

API_URL = "http://localhost:8080/api/claude-code"
API_KEY = "your-secure-api-key"

def run_claude_task(task, path="/workspace"):
    response = requests.post(
        API_URL,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json"
        },
        json={
            "task": task,
            "codebase_path": path
        }
    )
    return response.json()

# Example usage
result = run_claude_task("Add error handling to all functions in main.py")
print(f"Task completed: {result['summary']}")
```

### GitHub Actions Example

```yaml
- name: Run Claude Code
  run: |
    curl -X POST http://your-server:8080/api/claude-code \
      -H "Authorization: Bearer ${{ secrets.CLAUDE_API_KEY }}" \
      -H "Content-Type: application/json" \
      -d '{
        "task": "Update documentation for all public functions",
        "codebase_path": "/workspace"
      }'
```

### Node.js Example

```javascript
const axios = require('axios');

async function runClaudeTask(task) {
  const response = await axios.post('http://localhost:8080/api/claude-code', {
    task: task,
    codebase_path: '/workspace'
  }, {
    headers: {
      'Authorization': 'Bearer your-secure-api-key',
      'Content-Type': 'application/json'
    }
  });
  
  return response.data;
}

// Usage
runClaudeTask('Refactor this code to use async/await')
  .then(result => console.log(result.summary));
```

## Security Notes

- Always use a strong `CLAUDE_CODE_API_KEY` in production
- Keep your `ANTHROPIC_API_KEY` secret
- Consider using HTTPS with a reverse proxy for production
- The container needs access to the code directories you want to modify

## Troubleshooting

### Check logs
```bash
docker logs claude-code-yolo
```

### Test without API auth
```bash
docker exec claude-code-yolo claude --version
```

### Interactive shell
```bash
docker exec -it claude-code-yolo bash
```

## Building from Source

```bash
git clone https://github.com/YOUR_USERNAME/claude-code-yolo
cd claude-code-yolo
docker build -t claude-code-yolo .
```

## License

MIT

## Credits

Built on top of [Anthropic's Claude Code](https://www.anthropic.com/claude-code)