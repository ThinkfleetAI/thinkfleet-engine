---
name: docker-expert
description: "Advanced Docker: multi-stage builds, BuildKit, image optimization, security scanning, layer caching, and production patterns."
metadata: {"thinkfleetbot":{"emoji":"🐳","requires":{"bins":["docker"]}}}
---

# Docker Expert

Advanced Docker patterns beyond basic container operations.

## Multi-Stage Builds

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production (minimal image)
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER node
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

## Image Optimization

```bash
# Check image size
docker images --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | sort -k2 -h

# Analyze image layers
docker history myapp:latest --format "table {{.CreatedBy}}\t{{.Size}}" --no-trunc

# Dive — interactive layer explorer
docker run --rm -it -v /var/run/docker.sock:/var/run/docker.sock wagoodman/dive myapp:latest
```

### Size reduction techniques

```dockerfile
# Use alpine base images
FROM node:20-alpine  # ~180MB vs node:20 ~1GB

# Install only production dependencies
RUN npm ci --production

# Clean up in the same layer
RUN apk add --no-cache build-base python3 \
    && npm ci \
    && apk del build-base python3

# Use .dockerignore
# .dockerignore:
# node_modules
# .git
# .env
# *.md
# dist
```

## BuildKit Features

```bash
# Enable BuildKit
export DOCKER_BUILDKIT=1

# Build with cache mount (speeds up dependency install)
docker build --build-arg BUILDKIT_INLINE_CACHE=1 -t myapp .

# Secret mounting (don't bake secrets into layers)
docker build --secret id=npmrc,src=$HOME/.npmrc -t myapp .
# In Dockerfile: RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ci

# SSH forwarding for private repos
docker build --ssh default -t myapp .

# Cache export/import for CI
docker build --cache-from myapp:cache --cache-to type=inline -t myapp .
```

## Security

```bash
# Scan image for vulnerabilities
docker scout cves myapp:latest

# Trivy scan
trivy image myapp:latest

# Run as non-root (in Dockerfile)
# USER node   or   USER 1001:1001

# Read-only filesystem
docker run --read-only --tmpfs /tmp myapp:latest

# Drop capabilities
docker run --cap-drop ALL --cap-add NET_BIND_SERVICE myapp:latest

# No new privileges
docker run --security-opt no-new-privileges myapp:latest
```

## Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' myapp
```

## Compose Patterns

```yaml
# docker-compose.yml — production patterns
services:
  app:
    build:
      context: .
      target: production  # Multi-stage target
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 5s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
```

## Notes

- Order Dockerfile instructions by change frequency: OS packages → dependencies → app code.
- Each `RUN`, `COPY`, `ADD` creates a layer. Combine related operations.
- Never store secrets in environment variables in Dockerfiles — they're visible in `docker history`.
- Pin base image versions: `node:20.11-alpine` not `node:latest`.
- `.dockerignore` is critical — without it, `docker build` copies your entire directory including `node_modules` and `.git`.
