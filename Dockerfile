FROM node:20-slim

LABEL org.opencontainers.image.source="https://github.com/alephsf/claude-code-yolo"
LABEL org.opencontainers.image.description="Claude Code API wrapper using official SDK for automated coding tasks"
LABEL org.opencontainers.image.licenses="MIT"

# Install essential tools and dependencies
RUN apt-get update && apt-get install -y \
    git \
    openssh-client \
    curl \
    bash \
    ripgrep \
    jq \
    sudo \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -s /bin/bash claudeuser && \
    echo "claudeuser ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/claudeuser

# Set working directory
WORKDIR /app

# Create necessary directories with proper ownership
RUN mkdir -p /home/claudeuser/.claude /workspace /tmp/repos && \
    chown -R claudeuser:claudeuser /home/claudeuser /workspace /tmp/repos /app

# Copy package.json first for better caching
COPY --chown=claudeuser:claudeuser package.json ./

# Install Node.js dependencies (including Claude Code SDK)
RUN npm install && chown -R claudeuser:claudeuser /app

# Copy application files
COPY --chown=claudeuser:claudeuser claude-code-api.js ./

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
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh && \
chown claudeuser:claudeuser /app/entrypoint.sh

# Switch to non-root user
USER claudeuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Use entrypoint script
ENTRYPOINT ["/app/entrypoint.sh"]