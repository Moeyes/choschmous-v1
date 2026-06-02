# Staging Deployment — Single VPS (Docker)

Manual, copy-paste steps to stand up staging on one VPS using Docker Compose
(Postgres + FastAPI backend + Next.js frontend + nginx/TLS). Run these **on the
VPS**. They were authored on 2026-06-02; nothing here was executed automatically
(the build environment has no cloud access), so treat this as the runbook.

> Frontend: Next.js 16 (pnpm). Backend: FastAPI + uv (Python 3.14). DB: Postgres 16.

---

## 0. Prerequisites (on the VPS)

```bash
# Docker + compose plugin
curl -fsSL https://get.docker.com | sh
sudo apt-get install -y docker-compose-plugin git
# A DNS A-record pointing staging.example.com -> VPS IP (for TLS)
```

Clone both repos (or the umbrella repo with submodules):

```bash
git clone git@github.com:satpanha/choschmous.git app && cd app
git submodule update --init --recursive   # pulls frontend/ and backend/
```

---

## 1. Backend image — `backend/Dockerfile`

```dockerfile
FROM python:3.14-slim
RUN pip install --no-cache-dir uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY . .
EXPOSE 8001
CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
```

## 2. Frontend image — `frontend/Dockerfile`

```dockerfile
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN pnpm build

FROM node:22-alpine AS run
RUN corepack enable
WORKDIR /app
COPY --from=build /app ./
EXPOSE 3000
CMD ["pnpm", "start"]
```

> Confirm the frontend's API base-URL env var name in `frontend/core/api/client.ts`
> and `frontend/.env*`; substitute the correct `NEXT_PUBLIC_*` name below if it differs.

## 3. `docker-compose.yml` (repo root)

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
      POSTGRES_DB: ${DB_NAME}
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 5s
      retries: 10

  backend:
    build: ./backend
    env_file: ./backend/.env.staging
    depends_on:
      db: { condition: service_healthy }
    expose: ["8001"]

  frontend:
    build:
      context: ./frontend
      args:
        NEXT_PUBLIC_API_BASE_URL: https://staging.example.com/api
    depends_on: [backend]
    expose: ["3000"]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs:/etc/letsencrypt:ro
    depends_on: [frontend, backend]

volumes: { pgdata: {} }
```

## 4. `backend/.env.staging`

```env
DB_USER=moeys
DB_PASS=__STRONG_DB_PASSWORD__
DB_HOST=db
DB_PORT=5432
DB_NAME=moeys
JWT_SECRET_KEY=__GENERATE_64_RANDOM_CHARS__      # openssl rand -hex 32
ENVIRONMENT=staging
BACKEND_CORS_ORIGINS=https://staging.example.com
# SENTRY_DSN=...        # optional; active when ENVIRONMENT != local
```

> `ENVIRONMENT=staging` disables the dev CORS shim **and** unmounts the `/maintenance`
> drop/sync routes (they only mount when `ENVIRONMENT=local`). Set CORS to the exact
> staging frontend origin — this is the Phase A3 CORS requirement.

## 5. `nginx.conf` (reverse proxy + cookie passthrough)

```nginx
server {
  listen 80;
  server_name staging.example.com;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl;
  server_name staging.example.com;
  ssl_certificate     /etc/letsencrypt/live/staging.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/staging.example.com/privkey.pem;

  location /api/ {            # backend (note: API is served under /api)
    proxy_pass http://backend:8001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass_request_headers on;     # forward Cookie / Set-Cookie (auth)
  }
  location / {                # frontend
    proxy_pass http://frontend:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

> Auth uses **HttpOnly cookies**. For cross-origin to work the backend cookies must be
> `Secure` + `SameSite=None` when frontend and API are on different hosts. Serving both
> under one domain (as above, `/api` vs `/`) avoids that — **preferred for the demo.**

## 6. Bring it up + seed

```bash
mkdir -p certs && sudo certbot certonly --standalone -d staging.example.com \
  --config-dir ./certs   # or your preferred ACME flow
docker compose build
docker compose up -d
docker compose exec backend uv run python seed.py    # loads demo data (see CREDENTIALS.md)
```

## 7. Verify (Phase B1 F + D1)

```bash
curl -s https://staging.example.com/api/openapi.json | head -c 80      # API reachable
# Login from the actual frontend origin and confirm Set-Cookie returns:
curl -i -X POST https://staging.example.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"password123"}'
```

Then open `https://staging.example.com`, log in as each of the 5 users from
`final/_rebuild/reskin/demo/CREDENTIALS.md`, and walk `DEMO_SCRIPT.md` end-to-end.

---

## Checklist before calling staging "ready"

- [ ] `JWT_SECRET_KEY` is a fresh 64-char random value (not the dev default).
- [ ] `BACKEND_CORS_ORIGINS` = exact staging frontend origin.
- [ ] `ENVIRONMENT=staging` (maintenance/drop routes NOT mounted).
- [ ] DB is a persistent volume; `seed.py` run exactly once.
- [ ] TLS valid; login returns `Set-Cookie`; cookies survive navigation.
- [ ] All 5 demo logins work from the browser.
- [ ] Khmer (Kantumruy Pro) renders on the deployed frontend.
