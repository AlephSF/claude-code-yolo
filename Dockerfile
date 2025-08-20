FROM node:20-slim

LABEL org.opencontainers.image.source="https://github.com/alephsf/claude-code-yolo"
LABEL org.opencontainers.image.description="Dockerized Claude Code for non-interactive cowbot coding tasks"
LABEL org.opencontainers.image.licenses="MIT"

# Install essential tools and dependencies
RUN apt-get update && apt-get install -y \
    git \
    openssh-client \
    curl \
    bash \
    ripgrep \
    jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Install Claude Code CLI globally via npm
RUN npm install -g @anthropic-ai/claude-code@latest

# Create directory for Claude Code configuration
RUN mkdir -p /root/.claude /workspace /tmp/repos

# Create package.json for the API wrapper
RUN echo '{\n\
  "name": "claude-code-api",\n\
  "version": "1.0.0",\n\
  "description": "API wrapper for Claude Code CLI",\n\
  "main": "claude-code-api.js",\n\
  "scripts": {\n\
    "start": "node claude-code-api.js"\n\
  },\n\
  "dependencies": {\n\
    "express": "^4.18.2"\n\
  }\n\
}' > package.json

# Install Node.js dependencies
RUN npm install

# Copy application files
COPY claude-code-api.js ./

# Create a default settings file for Claude Code
RUN echo '{\n\
  "permissions": {\n\
    "allow": ["*"]\n\
  },\n\
  "env": {\n\
    "CLAUDE_CODE_NON_INTERACTIVE": "true",\n\
    "CLAUDE_CODE_AUTO_APPROVE": "true"\n\
  }\n\
}' > /root/.claude/settings.json

# Create entrypoint script
RUN echo '#!/bin/bash\n\
set -e\n\
\n\
# Check for required environment variables\n\
if [ -z "$ANTHROPIC_API_KEY" ]; then\n\
    echo "ERROR: ANTHROPIC_API_KEY environment variable is required"\n\
    echo "Please set it when running the container:"\n\
    echo "  docker run -e ANTHROPIC_API_KEY=your-key ..."\n\
    exit 1\n\
fi\n\
\n\
# Configure git if credentials provided\n\
if [ ! -z "$GIT_USER_NAME" ]; then\n\
    git config --global user.name "$GIT_USER_NAME"\n\
fi\n\
\n\
if [ ! -z "$GIT_USER_EMAIL" ]; then\n\
    git config --global user.email "$GIT_USER_EMAIL"\n\
fi\n\
\n\
if [ ! -z "$GITHUB_TOKEN" ]; then\n\
    git config --global credential.helper store\n\
    echo "https://${GITHUB_TOKEN}:x-oauth-basic@github.com" > ~/.git-credentials\n\
fi\n\
\n\
# Start the API server\n\
exec node claude-code-api.js\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Use entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]