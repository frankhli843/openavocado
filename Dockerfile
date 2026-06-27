# AvocadoCore — multi-platform container (amd64 and arm64)
# Used for devavo (local Docker testing) and as reference for prodavo VPS.
FROM node:24-slim AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# ── Dependencies stage ────────────────────────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm install --frozen-lockfile

# ── Build stage ───────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js (standalone output)
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Only copy what next start needs
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/db/schema.sql ./src/db/schema.sql

# Create data and runtime_artifacts directories (mount volumes over these)
RUN mkdir -p /data /app/runtime_artifacts

# Default env — override in docker-compose or deployment env file
ENV AVOCADOCORE_DB_PATH=/data/avocadocore.db
ENV AVOCADOCORE_AUTH_REQUIRED=true
ENV PORT=3001

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD \
  wget -qO- http://localhost:3001/api/health | grep '"ok":true' || exit 1

CMD ["pnpm", "start", "--", "-p", "3001"]
