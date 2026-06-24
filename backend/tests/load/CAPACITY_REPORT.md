# Capacity & Load Test — CHOS-306

Load model and capacity plan for the MOEYS API, targeting a sustained
**3,000 RPS** across a realistic mix. The Locust scenarios live in
`locustfile.py`; this document is the methodology, the capacity model, and the
results template to fill in after a run against staging.

> **Status:** the scenarios + CI smoke are in the repo and run. A full 3k-RPS run
> must be executed against a **staging** environment that mirrors prod
> (CHOS-301 replicas + PgBouncer, CHOS-302 Redis Cluster, CHOS-303 Cloudflare).
> It must **not** be run against prod or a local single-node box. Fill in the
> "Results" table from that run. TODO(infra): provision the staging load target.

## Scenario mix

| Scenario | Endpoint | Weight | Path characteristics |
| --- | --- | ---: | --- |
| Login | `POST /api/v1/auth/login` | once/user | write + bcrypt (CPU); 5/60s **per IP** |
| Dashboard | `GET /api/v1/dashboard` | 6 | read → **replica** (CHOS-301), Redis-cached (CHOS-302); 30/60s per user |
| Events list | `GET /api/v1/events` | 4 | read → replica |
| Report | `GET /api/v1/reports/{key}` | 2 | enqueue → **arq** (CHOS-202), render off the request path; 10/60s per user |
| Register | `POST /api/v1/registration` | 1 | write → **primary**; multi-row tx; 10/60s per user |

The weights model a read-heavy admin/portal workload (reads ≫ writes).

## Why the test needs MANY distinct users

The app rate-limits aggressively (`core/ratelimit.py`):

* **login: 5 / 60s per IP** — generate load from **many source IPs**
  (distributed Locust workers / a cloud load-generator). Each simulated user
  logs in exactly once (`on_start`).
* **dashboard 30, report 10, register 10 — per USER / 60s.** A handful of users
  would just measure the limiter. To put 3k RPS of *successful* traffic through,
  use **thousands of distinct accounts** (`LOAD_TEST_USER_COUNT`, seeded by
  `seed_load_users.py`), each well under its per-user budget — which is exactly
  how real traffic is shaped.

If a capacity run instead wants to measure raw backend throughput *without* the
limiter, raise/disable the relevant limiters in the staging build — but the
default, realistic test keeps them on.

## How the CHOS-301/302/303 work feeds capacity

* **CHOS-301 (read replicas + PgBouncer):** dashboard/report/list reads go to the
  replicas, so the read mix (weight 12 of 13) never competes with writes on the
  primary. PgBouncer transaction pooling collapses thousands of short read
  connections onto a small server-side pool — the key to high read RPS.
* **CHOS-302 (Redis Cluster):** rate limiting, idempotency and the dashboard
  cache shard across 3 nodes; the dashboard cache absorbs most dashboard reads.
* **CHOS-303 (Cloudflare):** static assets + cacheable GETs are served at the
  edge and never reach the origin; the WAF/rate-limit sheds volumetric abuse
  before it hits the app. Point the load host at the Cloudflare hostname to
  measure end-to-end edge+origin; point it at the origin to isolate the app.

## Running

```bash
# 1. seed distinct accounts (non-prod env only)
export LOAD_TEST_PASSWORD='<password>' LOAD_TEST_USER_COUNT=3000
uv run python tests/load/seed_load_users.py

# 2. (optional) reference ids so register/report scenarios fire
export LOAD_EVENT_ID=1 LOAD_SPORT_ID=1 LOAD_ORG_ID=1 LOAD_CATEGORY_ID=1

# 3. drive ~3k RPS (distribute workers across IPs for the login cap)
uv run locust -f tests/load/locustfile.py --host https://staging.example \
    --users 3000 --spawn-rate 100 --run-time 10m --headless
```

## SLOs (run is a failure if breached)

* error (non-2xx/202, excluding expected 429) ratio **< 2%**
* p95 latency **< 2000 ms** for reads at target load

`locustfile.py` enforces these in its `quitting` hook (non-zero exit), so both a
manual run and the CI smoke fail loudly on a regression.

## Results (fill in from the staging run)

| Metric | Target | Observed |
| --- | --- | --- |
| Sustained RPS | 3,000 | _TODO_ |
| Error ratio | < 2% | _TODO_ |
| p50 / p95 / p99 latency (reads) | p95 < 2s | _TODO_ |
| Dashboard cache hit rate | high | _TODO_ |
| Primary vs replica CPU | replica-heavy | _TODO_ |
| arq report queue depth | bounded | _TODO_ |
| First saturated resource | — | _TODO_ |

## CI smoke

`.github/workflows/load-smoke.yml` boots the app against ephemeral Postgres +
Redis, seeds 5 users, and runs the **read** tag at low concurrency for ~30s,
failing the build on the SLOs above. It is a regression tripwire (does the app
serve the hot endpoints under a little load), **not** the capacity run.
