FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm.yaml pnpm-workspace.yaml ./

# ── Development ──────────────────────────────────
FROM base AS development
RUN pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["pnpm", "dev"]

# ── Builder (production assets) ──────────────────
FROM base AS builder
# Next.js evaluates next.config rewrites() at BUILD time and bakes the proxy
# destination into the route manifest, so the API target must be present now —
# setting it only at runtime is ignored.
ARG API_PROXY_TARGET=http://backend:8000
ENV API_PROXY_TARGET=$API_PROXY_TARGET
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ── Production ───────────────────────────────────
FROM node:22-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
WORKDIR /app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3000
ENV NODE_ENV=production PORT=3000 HOSTNAME="0.0.0.0"
# Use 127.0.0.1 (not localhost): the Next.js standalone server binds IPv4
# 0.0.0.0 only, so "localhost" resolving to IPv6 ::1 would be refused.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1
CMD ["node", "server.js"]
