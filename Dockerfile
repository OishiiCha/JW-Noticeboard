# ─────────────────────────────────────────────────────────────
# Noticeboard App — Standalone Dockerfile
# Multi-arch (AMD64 + ARM64), optimized for Raspberry Pi 5.
# ─────────────────────────────────────────────────────────────

# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl python3
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma/

RUN npm install --legacy-peer-deps
RUN npx prisma@6 generate

# Stage 2: Build the application
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl python3
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma@6 generate

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/noticeboard.db"

RUN npm run build

# Generate init.sql for runtime database setup
RUN npx prisma@6 migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script \
    | sed 's/CREATE TABLE /CREATE TABLE IF NOT EXISTS /g' \
    | sed 's/CREATE INDEX /CREATE INDEX IF NOT EXISTS /g' \
    | sed 's/CREATE UNIQUE INDEX /CREATE UNIQUE INDEX IF NOT EXISTS /g' \
    > prisma/init.sql

# Stage 3: Production image
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl wget sqlite dcron unzip
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=2424
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

COPY docker-entrypoint.sh /app/docker-entrypoint.sh
COPY scripts/backup.sh /app/scripts/backup.sh
RUN chmod +x /app/docker-entrypoint.sh /app/scripts/backup.sh

RUN mkdir -p /app/data /app/data/backups /app/public/uploads/notices /app/public/uploads/schedules /app/public/uploads/events /app/public/uploads/roles && \
    chown -R nextjs:nodejs /app/data /app/public/uploads

RUN apk add --no-cache su-exec

EXPOSE 2424

ENTRYPOINT ["/app/docker-entrypoint.sh"]
