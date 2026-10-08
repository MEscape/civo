# syntax=docker/dockerfile:1.7
# Used for CI validation and for any non-Vercel target.
# Vercel does NOT use this file.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app

# ---- dependencies ----
FROM base AS deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---- build ----
FROM base AS builder
ARG NEXT_PUBLIC_APP_URL

# NEXT_PUBLIC_* values are inlined into the browser bundle.
# Never pass secrets here.
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_TELEMETRY_DISABLED=1 \
    DOCKER_BUILD=true

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-only placeholders.
# These exist only during this RUN and are not stored in the image.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    AUTH_ENABLED=true \
    AUTH_SECRET=build-placeholder-not-a-secret-0000000000 \
    AUTH_DATABASE_URL=postgresql://build:build@localhost:5432/build_auth \
    npm run build

# ---- runtime ----
FROM base AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Runtime secrets are injected by Docker Compose / `docker run`.
# Use `init: true` in Compose so SIGTERM reaches node correctly.
CMD ["node", "server.js"]