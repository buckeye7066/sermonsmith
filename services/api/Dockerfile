# Production image for the @sermonsmith/api Express service.
#
# IMPORTANT: this Dockerfile MUST be built from the monorepo root so the
# workspace package-lock.json and services/api/* live inside the build
# context. The previous version copied package-lock.json* from "." which
# silently produced wildly different images depending on whether Railway
# used the repo root or services/api as the context.
#
#   docker build -f services/api/Dockerfile .
#
# Multi-stage: the runtime image carries only production deps + the API
# source + the generated Prisma client.

FROM node:20-alpine AS deps
WORKDIR /app

# Copy the root manifest + lockfile and the API workspace manifest, then
# install ONLY the API workspace's production deps. `npm ci --workspace`
# resolves transitive deps through the root lockfile so we get the same
# versions CI runs against.
COPY package.json package-lock.json ./
COPY services/api/package.json services/api/package.json

RUN npm ci --workspace @sermonsmith/api --omit=dev


FROM node:20-alpine AS runtime
# Run as a non-root user. addgroup/adduser come from Alpine's busybox.
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

# Copy the resolved node_modules from the deps stage. Both the root and
# the workspace's local node_modules layers must come along — npm v10+
# hoists most deps to the root but workspace-local copies still exist for
# version-pinned packages.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/services/api/node_modules ./services/api/node_modules

# Bring in the manifests and the workspace source.
COPY package.json package-lock.json ./
COPY services/api/package.json ./services/api/package.json
COPY services/api/prisma ./services/api/prisma
COPY services/api/src ./services/api/src

WORKDIR /app/services/api

# Generate the Prisma client against the runtime engine.
RUN npx prisma generate

USER app
EXPOSE 3001

# /readyz pings the database; /healthz is a cheap liveness check.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/readyz || exit 1

# Apply committed migrations against $DATABASE_URL, then start the server.
# `prisma migrate deploy` is non-interactive and refuses to run if the
# schema diverges from migration history — which is the desired behaviour
# for production.
CMD ["sh", "-c", "npx prisma migrate deploy && node src/index.js"]
