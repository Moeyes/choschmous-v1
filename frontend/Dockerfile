# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
# npmmirror is usually faster from SE Asia but currently flaky; npmjs responds
# fast and serves identical tarballs. Flip back when it recovers.
ENV npm_config_registry=https://registry.npmjs.org/
# Global pnpm, not corepack: corepack re-downloads pnpm on first use and crashes
# at container start when the bridge network can't reach the registry.
RUN npm install -g pnpm@11.7.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm.yaml pnpm-workspace.yaml .npmrc ./

# ── Development ──
FROM base AS development
ENV PORT=3003
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
EXPOSE 3003
CMD ["pnpm", "dev"]

# ── Builder ──
FROM base AS builder
# next.config rewrites() are evaluated at BUILD time and baked into the route
# manifest, so the API target must be set now — runtime env is ignored.
ARG API_PROXY_TARGET=http://backend:8000
ENV API_PROXY_TARGET=$API_PROXY_TARGET
# NEXT_PUBLIC_* are inlined into the client bundle at BUILD time, so the public
# app URL must be present now. Prod is REQUIRED (compose passes
# ${NEXT_PUBLIC_APP_URL:?}); the default below is only for local/dev builds.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3003
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ── Production ──
FROM node:22-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
WORKDIR /app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
USER nextjs
EXPOSE 3003
ENV NODE_ENV=production PORT=3003 HOSTNAME="0.0.0.0"
# 127.0.0.1, not localhost: standalone server binds IPv4 0.0.0.0 only.
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3003/ || exit 1
CMD ["node", "server.js"]