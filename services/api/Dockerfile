# Production image for the @sermonsmith/api Express service.
# Multi-stage so the runtime image carries only built artefacts + prod deps.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma/

# Generate the Prisma client against the runtime engine.
RUN npx prisma generate

COPY src ./src/

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
