# Performance Test Report — MOEYS

## Test Environment

- **Backend:** FastAPI, uvicorn (single worker), SQLAlchemy + asyncpg, PostgreSQL 16 (Docker)
- **Database:** 68 enrollments, 44 events, 36 athlete_participations, 63 participation_per_sport, 5 organizations
- **Test User:** `perftest` (super_admin role)
- **Rate Limiter:** Login: 5 req/60s per IP (Redis-backed, fallback in-memory)
- **Pool Config:** pool_size=10, max_overflow=20, pool_timeout=30s

---

## Run 3 — 50 users, 90s (All Fixes Applied)

Date: 2026-06-04

### Results

| Endpoint | Requests | Failures | Avg (ms) | p50 (ms) | p95 (ms) | Max (ms) |
|---|---|---|---|---|---|---|
| `POST /api/auth/login` | 155 | 150 (96.77%) | 1110 | 340 | 5800 | 6698 |
| `GET /api/dashboard` | 43 | 0 | 45 | 36 | 55 | 320 |
| `GET /api/excel/org-sport?events_id=1&org_id=1` | 26 | 0 | 39 | 29 | 68 | 230 |
| `GET /api/excel/org-sport-participant?events_id=1&org_id=1` | 26 | 0 | 52 | 41 | 96 | 140 |
| `GET /api/participation-per-sport/?limit=100` | 29 | 0 | 44 | 28 | 230 | 240 |
| `GET /api/participation-per-sport/1` | 29 | 0 | 41 | 26 | 210 | 250 |
| `GET /api/registration/?search=smith&limit=20&offset=0&role=athlete` | 51 | 0 | 46 | 40 | 59 | 250 |
| `GET /api/registration/?search=%25&limit=20&offset=0&role=athlete` | 51 | 0 | 46 | 45 | 58 | 75 |
| `GET /api/registration/?limit=20&offset=0&role=athlete` | 18 | 0 | 44 | 41 | 80 | 80 |
| **Aggregated** | **428** | **150 (35.05%)** | **431** | **47** | **2900** | **6698** |

### Error Report

- 150x `POST /api/auth/login`: 429 Too Many Requests (rate limiter — expected)

### Key Improvements from Run 2 (Before Fixes)

- Excel endpoints: **100% failure → 0% failure** (added `org_id` param)
- Registration endpoints: **no 404s** with `role=athlete` (lowercase)
- Overall failure rate: **41.19% → 35.05%** (remaining failures all login rate-limiting)

### Analysis

1. **Login rate-limiting dominates (96.77% failure):** 5 successful logins/60s window. With 50 users all trying to log in simultaneously, only 5 succeed. This is working as designed — the rate limiter should prevent credential stuffing. For load testing, consider a dedicated test token or bypass.

2. **Dashboard is fast:** avg 45ms, p95 55ms. No issues at current dataset size.

3. **Participant search is fast:** avg 44-46ms across all search variants. At current dataset size, the ILIKE searches complete in under 1ms DB-time.

4. **Participation-per-sport is fast:** avg 41-44ms. The N+1 issue flagged in the audit is real but only manifests at larger scales (1000+ records).

5. **Excel endpoints now work correctly:** avg 39-52ms with proper params.

6. **No pool exhaustion:** 40 concurrent requests handled without timeouts (pool_timeout=30s fix).

### Database Benchmarks

| Benchmark | Avg (ms) | p95 (ms) | Verdict |
|---|---|---|---|
| Participant ILIKE search (100x) | 2.5 | 3.7 | OK |
| Phone ILIKE search (100x) | 2.5 | 3.8 | OK |
| Dashboard 7 COUNT queries (50x) | 17.0 | 28.9 | OK |
| Participation join LIMIT 100 (50x) | 3.5 | 5.5 | OK |

### Slow Query Analysis (pg_stat_statements)

| Query | Calls | Avg (ms) | Total (ms) |
|---|---|---|---|
| User auth lookup (all request auth) | 917 | 0.1 | 56.2 |
| Enrollment SELECT (participant list) | 231 | 0.8 | 174.5 |
| Enrollment COUNT (participant list) | 231 | 0.4 | 92.1 |
| Participation SELECT (list + N+1) | 110 | 0.3 | 37.0 |
| Events SELECT (reference data) | 98 | 0.2 | 19.0 |

### Recommendations

1. **For high-accuracy load testing:** Create a test endpoint that bypasses login, or share one JWT among all locust users (set `PERF_TOKEN` env var and skip `on_start` login).
2. **Scale concern:** The N+1 in `ParticipationPerSportService` (3N queries per list operation) will become a problem beyond 1000 participation records. Add JOIN-based query.
3. **Data size concern:** In-memory pagination in participant search will OOM at 50K+ participants. Needs SQL-level pagination.
4. **Indexing:** Add `pg_trgm` extension + GIN indexes on enrollment name/phone columns for production-scale ILIKE performance.
