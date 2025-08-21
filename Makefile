# Claude Code API - Development & Testing Makefile

.PHONY: help build test test-quick test-production clean dev logs health check-env

# Default target
help: ## Show this help message
	@echo "Claude Code API - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

check-env: ## Check if .env file exists with required variables
	@if [ ! -f .env ]; then \
		echo "❌ .env file not found"; \
		echo "Please copy .env.example to .env and set your ANTHROPIC_API_KEY"; \
		exit 1; \
	fi
	@if ! grep -q "ANTHROPIC_API_KEY=sk-" .env; then \
		echo "⚠️  ANTHROPIC_API_KEY not properly set in .env"; \
		echo "Please set a valid Anthropic API key"; \
		exit 1; \
	fi
	@echo "✅ Environment configuration validated"

build: ## Build Docker image
	@echo "🏗️  Building Docker image..."
	@docker build -t claude-code-yolo:latest .
	@echo "✅ Build complete"

dev: check-env ## Start development server locally
	@echo "🚀 Starting development server..."
	@npm start

test-quick: build ## Run quick container test (no API calls)
	@echo "🧪 Running quick container test..."
	@docker run --rm \
		-e ANTHROPIC_API_KEY=test-key \
		-e CLAUDE_CODE_API_KEY=test-key \
		--health-cmd="curl -f http://localhost:8080/health || exit 1" \
		--health-interval=5s \
		--health-timeout=3s \
		--health-retries=3 \
		claude-code-yolo:latest &
	@sleep 10
	@echo "✅ Quick test complete"

test-production: check-env build ## Run full production test suite
	@echo "🧪 Running production test suite..."
	@./test-production.sh

test: test-production ## Alias for production tests

clean: ## Clean up Docker containers and images
	@echo "🧹 Cleaning up..."
	@docker stop claude-code-api-test 2>/dev/null || true
	@docker rm claude-code-api-test 2>/dev/null || true
	@docker stop claude-code-api 2>/dev/null || true
	@docker rm claude-code-api 2>/dev/null || true
	@docker image prune -f
	@echo "✅ Cleanup complete"

run: check-env build ## Build and run container locally
	@echo "🚀 Starting Claude Code API..."
	@docker run -d \
		--name claude-code-api \
		-p 8080:8080 \
		--env-file .env \
		-v $$(pwd):/workspace \
		claude-code-yolo:latest
	@echo "✅ Container started on http://localhost:8080"
	@echo "Use 'make logs' to view logs or 'make health' to check status"

stop: ## Stop running container
	@echo "🛑 Stopping container..."
	@docker stop claude-code-api 2>/dev/null || true
	@docker rm claude-code-api 2>/dev/null || true
	@echo "✅ Container stopped"

logs: ## View container logs
	@docker logs -f claude-code-api

health: ## Check API health
	@echo "🏥 Checking API health..."
	@curl -s http://localhost:8080/health | jq . || echo "❌ API not responding"

validate: check-env ## Test API validation endpoint
	@echo "🔍 Testing API validation..."
	@curl -s -H "Authorization: Bearer $$(grep CLAUDE_CODE_API_KEY .env | cut -d'=' -f2)" \
		http://localhost:8080/api/claude-code/validate | jq .

# Docker Compose shortcuts
compose-up: check-env ## Start with docker-compose
	@docker-compose up -d

compose-down: ## Stop docker-compose
	@docker-compose down

compose-logs: ## View docker-compose logs
	@docker-compose logs -f

# Release helpers
build-multi: ## Build multi-platform image
	@echo "🏗️  Building multi-platform image..."
	@docker buildx build --platform linux/amd64,linux/arm64 -t claude-code-yolo:multi .

tag-version: ## Tag current commit with version (usage: make tag-version VERSION=v2.0.0)
	@if [ -z "$(VERSION)" ]; then \
		echo "❌ VERSION required. Usage: make tag-version VERSION=v2.0.0"; \
		exit 1; \
	fi
	@git tag -a $(VERSION) -m "Release $(VERSION)"
	@echo "✅ Tagged $(VERSION)"

# Development helpers
install: ## Install npm dependencies
	@npm install

lint: ## Run linting (if available)
	@if [ -f node_modules/.bin/eslint ]; then \
		npm run lint; \
	else \
		echo "ℹ️  No linting configured"; \
	fi

format: ## Format code (if available)
	@if [ -f node_modules/.bin/prettier ]; then \
		npm run format; \
	else \
		echo "ℹ️  No formatting configured"; \
	fi

# Cost estimation
estimate-cost: check-env ## Estimate API costs for basic operations
	@echo "💰 Estimating API costs..."
	@echo "This will make actual API calls and incur small costs (~$0.10)"
	@read -p "Continue? (y/N): " confirm && [ "$$confirm" = "y" ] || exit 1
	@make run
	@sleep 10
	@echo "Testing validation endpoint..."
	@curl -s -H "Authorization: Bearer $$(grep CLAUDE_CODE_API_KEY .env | cut -d'=' -f2)" \
		http://localhost:8080/api/claude-code/validate | jq '.cost' | sed 's/^/Validation cost: $/'
	@make stop