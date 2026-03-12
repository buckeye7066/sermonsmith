FROM node:20-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

FROM node:20-alpine

RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY prisma ./prisma/
RUN npx prisma generate

COPY src ./src/

ENV NODE_ENV=production

USER app
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["sh", "-c", "npx prisma db push --skip-generate && node src/index.js"]
