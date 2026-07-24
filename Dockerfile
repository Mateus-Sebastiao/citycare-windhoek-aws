# ========================================================
# STAGE 1: BUILD (Compilation of native dependencies)
# ========================================================
FROM node:20-slim AS builder

# Install tools required to compile better-sqlite3 native addon
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests to leverage Docker layer caching
COPY package*.json ./

# Install ALL dependencies (including devDependencies if needed for build)
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Prune development dependencies to keep only production packages
RUN npm prune --omit=dev

# ========================================================
# STAGE 2: PRODUCTION (Lightweight and secure final image)
# ========================================================
FROM node:20-slim

WORKDIR /app

# Security: Create a non-privileged user and group (Non-root user)
RUN groupadd -r appgroup && useradd -r -g appgroup -m -s /sbin/nologin appuser

# Set default production environment variables
ENV NODE_ENV=production
ENV PORT=4000

# Copy only the required artifacts from the builder stage with correct ownership
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/src ./src
COPY --from=builder --chown=appuser:appgroup /app/public ./public

# Create directories for persistent volumes and assign ownership to appuser
RUN mkdir -p data uploads && chown -R appuser:appgroup data uploads

# Switch to the non-root user
USER appuser

# Declare volumes for data and media persistence on the EC2 host
VOLUME ["/app/data", "/app/uploads"]

EXPOSE 4000

CMD ["node", "src/server.js"]