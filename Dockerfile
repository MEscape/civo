# syntax=docker/dockerfile:1.7

# ==============================================================================
# CIVO - PRODUCTION MULTI-STAGE DOCKERFILE
# Hardened build pipeline for CI validation and container runtimes (Docker/K8s).
# Strictly non-root, least-privilege permissions, and minimal attack surface.
# ==============================================================================

ARG NODE_VERSION=24

# ------------------------------------------------------------------------------
# 1. Base Image (Shared OS & OpenSSL Layer)
# ------------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base

# Ensure OpenSSL and CA certificates are present and patched for Prisma & TLS,
# then strip apt caches to keep the base layer minimal.
RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && apt-get upgrade -y \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ------------------------------------------------------------------------------
# 2. Dependencies Stage
# ------------------------------------------------------------------------------
FROM base AS deps

COPY --link package.json package-lock.json ./

# `--ignore-scripts` prevents supply-chain attacks from third-party postinstall
# hooks during dependency installation.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --ignore-scripts

# ------------------------------------------------------------------------------
# 3. Database Migrator Target (`--target migrator`)
# Ephemeral one-off runner for Docker Compose / Kubernetes initContainers.
# ------------------------------------------------------------------------------
FROM base AS migrator

ENV NODE_ENV=production \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_CACHE=/tmp/.npm

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json prisma.config.ts tsconfig.json ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node scripts ./scripts

# Generate Prisma client if needed by migration/seed scripts before dropping root
RUN npm run db:generate && chown -R node:node /app

USER node

CMD ["npm", "run", "db:migrate"]

# ------------------------------------------------------------------------------
# 4. Application Builder Stage
# ------------------------------------------------------------------------------
FROM base AS builder

ARG NEXT_PUBLIC_APP_URL

# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
# Never pass private keys or runtime secrets as build arguments.
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_TELEMETRY_DISABLED=1 \
    DOCKER_BUILD=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Emit Prisma client & byte-exact database contracts (`src/lib/db/contract.*`)
RUN npm run db:generate

# Build Next.js standalone output using scoped, ephemeral build-only placeholders.
# Scoped to this single RUN instruction so they never persist in image ENV layers.
RUN --mount=type=cache,target=/app/.next/cache \
    DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    AUTH_ENABLED="true" \
    AUTH_SECRET="build-placeholder-not-a-secret-0000000000" \
    AUTH_DATABASE_URL="postgresql://build:build@localhost:5432/build_auth" \
    MAIL_PROVIDER="smtp" \
    MAIL_SMTP_HOST="localhost" \
    MAIL_FROM="build@example.invalid" \
    UPSTASH_REDIS_REST_URL="https://build-placeholder.upstash.invalid" \
    UPSTASH_REDIS_REST_TOKEN="build-placeholder-not-a-secret" \
    npm run build

# ------------------------------------------------------------------------------
# 5. Production Runtime Target (`--target runner`)
# ------------------------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Remove package managers (npm/corepack/yarn) from the runtime image so that
# an attacker cannot download or install packages if RCE occurs.
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm \
           /usr/local/bin/npx \
           /usr/local/bin/corepack \
           /usr/local/bin/yarn \
           /usr/local/bin/yarnpkg \
    && chown node:node /app

# Copy build artifacts as root:root with read-only permissions (0555/0444) so the
# runtime `node` user can read/execute the app but CANNOT modify server code.
COPY --from=builder --chown=root:root --chmod=555 /app/public ./public
COPY --from=builder --chown=root:root --chmod=555 /app/.next/standalone ./
COPY --from=builder --chown=root:root --chmod=555 /app/.next/static ./.next/static

# Pre-create a writable cache directory exclusively for Next.js runtime ISR/image cache
RUN mkdir -p /app/.next/cache && chown -R node:node /app/.next/cache

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]

# Runtime secrets are injected externally via `.env.docker` in Docker Compose.
# `init: true` in `docker-compose.yml` ensures PID 1 forwards SIGTERM cleanly.
CMD ["node", "server.js"]
