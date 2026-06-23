# MOEYS National Sports-Event Platform

A nation-level system for the Ministry of Education, Youth and Sport to run
sports events end to end: events and their sports, participating organizations
and federations, athlete **registration**, **participation** records, multi-phase
**surveys** (by category / by sport / by number / open), and official **reports**.

> This is public-sector software handling citizen/athlete **PII** and official
> records. Security and data-handling discipline are first-class requirements —
> see [Security](#security) and `backend/.claude/skills/national-backend-architecture`.

## Architecture

```
┌────────────┐     HTTPS      ┌─────────────────────┐      ┌────────────┐
│  Next.js   │ ─────────────▶ │  FastAPI (async)    │ ───▶ │ PostgreSQL │
│  frontend  │   JSON / cookie│  hexagonal layers   │      │  (asyncpg) │
└────────────┘   auth (JWT)   │  routes→services→ORM│      └────────────┘
                              │                     │ ───▶ ┌────────────┐
                              │  rate-limit / cache │      │   Redis    │
                              └─────────────────────┘      └────────────┘
```

- **Backend** — FastAPI (async) · SQLAlchemy 2.0 async ORM · asyncpg · Pydantic v2 ·
  Alembic · PostgreSQL · Redis · pytest. Strict layering: **routes are thin**
  (parse + authz dependency + service call + error mapping), **services hold all
  business logic and own every query/commit**, **models are ORM-only**. Auth is
  cookie-based JWT with role dependencies (`require_admin`, `require_superadmin`,
  `require_staff`) and org/federation scoping guards in `src/database/deps.py`.
- **Frontend** — Next.js (React + TypeScript + Tailwind), pnpm. Talks to the API
  over cookie auth with CSRF double-submit tokens.
- **Cross-cutting middleware** — CSRF, security headers (CSP/HSTS), request-size
  limits, content-type validation, GZip, cache-control, and a logging middleware
  (`core/logging_mw.py`) that keeps PII out of logs.

## Repository layout

```
backend/      FastAPI service (core/ config+middleware, src/ api+services+models, alembic/, tests/)
frontend/     Next.js app (pnpm)
infra/        Operational scaffolds — backup/ (pgBackRest + DR runbook), observability/ (Prometheus/Grafana/Alertmanager)
docs/         Project & design docs
.github/      CI workflows (ci, e2e, migrations, codeql, docker, security-scan)
docker-compose.yml            Base stack (db, redis, backend, frontend)
docker-compose.override.yml   Local-dev overrides (applied automatically)
docker-compose.prod.yml       Production overlay
uat.yml                       UAT stack (internal-only ports; see CHOS-101)
```

## Local setup

Prerequisites: Docker + Docker Compose, Python ≥ 3.14 with [`uv`](https://docs.astral.sh/uv/),
Node 22 + pnpm.

1. **Environment** — copy and fill the example env files (never commit real secrets):
   ```bash
   cp .env.example .env            # DB_*, REDIS_URL, JWT_* , BACKEND_CORS_ORIGINS, ...
   ```
2. **Whole stack (recommended)** — base + dev overrides are merged automatically:
   ```bash
   docker compose up --build
   ```
   Frontend, backend, Postgres and Redis come up together with healthchecks.
3. **Backend only (local venv)**:
   ```bash
   cd backend
   uv sync
   uv run alembic upgrade head        # apply migrations
   uv run uvicorn main:app --reload   # http://localhost:8000  (docs at /docs in local)
   ```
4. **Frontend only**:
   ```bash
   cd frontend && pnpm install && pnpm dev
   ```

### Key environment variables

| Var | Purpose |
| --- | --- |
| `DB_USER` / `DB_PASS` / `DB_HOST` / `DB_PORT` / `DB_NAME` | PostgreSQL connection |
| `REDIS_URL` | Redis (rate limiting, idempotency, dashboard cache) |
| `JWT_SECRET_KEY` / `JWT_REFRESH_SECRET_KEY` | token signing — **must** be strong in non-local envs |
| `BACKEND_CORS_ORIGINS` | comma-separated or JSON list of allowed origins |
| `ENVIRONMENT` | `local` enables docs + dev CORS; anything else is treated as deployed |
| `ENABLE_MAINTENANCE` | `1` registers the destructive `/maintenance` routes; off by default (CHOS-102) |
| `SENTRY_DSN` | optional error reporting (ignored when `ENVIRONMENT=local`) |

## Testing

```bash
cd backend && uv run pytest          # backend test suite (needs a reachable test DB)
cd backend && uv run ruff check .    # lint
cd frontend && pnpm test             # frontend tests
```

## Deploy

Production runs the same images via the base compose plus the prod overlay:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec backend uv run alembic upgrade head   # run migrations on release
```

Operational notes:
- **Ports** — in UAT/prod, Postgres and Redis are **internal-only** (no host port
  published); reach them over the compose network or an SSH tunnel (CHOS-101).
- **Maintenance routes** are excluded from prod images unless `ENABLE_MAINTENANCE=1`
  and require `SUPER_ADMIN` (CHOS-102).
- **Backups & DR** — see `infra/backup/` (pgBackRest config, cron job,
  `docs/DR_RUNBOOK.md`). *TODO: wire S3 credentials.*
- **Observability** — see `infra/observability/` (Prometheus + Grafana +
  Alertmanager; `/metrics` exposed via the FastAPI instrumentator).
  *TODO: wire PagerDuty / Alertmanager routing keys.*

## Security

- **Secrets** never enter git: `.gitleaks.toml` + a gitleaks pre-commit hook
  (`.pre-commit-config.yaml`) and a CI secret scan. Install the hook with
  `pip install pre-commit && pre-commit install`.
- **Supply chain** — `.github/workflows/security-scan.yml` runs pip-audit, pnpm
  audit, a Trivy image scan, and publishes a CycloneDX SBOM; it fails on
  High/Critical findings. Dependabot opens upgrade PRs.
- **PII** — restricted-field reveals are admin-gated, rate-limited, and audited;
  list endpoints return a minimized projection; PII is kept out of logs and URLs.
- The backend architecture contract lives in
  `backend/.claude/skills/national-backend-architecture` — read it before backend work.
```

