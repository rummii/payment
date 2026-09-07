# Multi-stage Dockerfile for Next.js 15 on Cloud Run
# Uses standalone output for minimal image size

# ─── Base stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Install openssl for Prisma (required for migrations at runtime)
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci --only=production

# ─── Builder stage ───────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
# Generate Prisma client
RUN npx prisma generate

# Build Next.js with standalone output
RUN npm run build

# ─── Runner stage ────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/next.config.mjs ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma files for migrations at runtime
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the server
CMD ["node", "server.js"]