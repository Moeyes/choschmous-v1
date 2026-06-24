# infra/observability — Metrics, traces, logs & alerting (CHOS-105 / CHOS-204)

**Scaffold** for a Prometheus + Tempo + Loki + Grafana + Alertmanager stack — the
three pillars (metrics, traces, logs) correlated by `trace_id`.

| Path | Purpose |
| ---- | ------- |
| `docker-compose.observability.yml` | Prometheus, Alertmanager, Grafana, Tempo, Loki, Promtail |
| `prometheus/prometheus.yml` | scrape targets (incl. backend `/metrics`) + alerting |
| `prometheus/alerts.yml` | starter alert rules (down / 5xx / latency) |
| `alertmanager/alertmanager.yml` | routing + PagerDuty receiver (key is a TODO) |
| `tempo/tempo.yaml` | Tempo trace backend (OTLP receiver on 4317/4318) — CHOS-204 |
| `loki/loki-config.yaml` | Loki log backend — CHOS-204 |
| `promtail/promtail-config.yaml` | ships container JSON logs into Loki — CHOS-204 |
| `grafana/provisioning/` | Prometheus + Tempo + Loki datasources (log↔trace links) |

## Tracing & structured logs (CHOS-204)

The backend uses the **OpenTelemetry SDK + OTLP/HTTP exporter** and instruments
FastAPI (`backend/core/observability.py`). Every request is a server span stamped
with the `request_id`; an unhandled error records the exception and the
`error_id` on the span. Logs are emitted as **structured JSON**
(`backend/core/logging_config.py`) carrying `request_id`, `trace_id`, `span_id`,
so a log line links to its trace in Tempo and back via Loki derived fields.

Enable on the backend (off by default — local/CI need no collector):

```bash
OTEL_ENABLED=1
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318   # Tempo OTLP/HTTP
OTEL_SERVICE_NAME=moeys-api
LOG_JSON=1                                       # structured logs (default on)
```

The frontend propagates a W3C `traceparent` + `X-Request-Id` on each API call
(`frontend/core/lib/logger/`), so a browser action and its backend trace share a
trace id.

## Backend metrics

`backend/main.py` wires
[`prometheus-fastapi-instrumentator`](https://github.com/trallnag/prometheus-fastapi-instrumentator)
to expose request metrics at **`/metrics`** (gated by `ENABLE_METRICS`, default on).
The import is guarded, so the app still runs if the package is not installed.

> ⚠️ **Dependency TODO(CHOS-105):** the current
> `prometheus-fastapi-instrumentator` release pins `starlette<1.0`, which
> conflicts with this project's `starlette>=1.3.1`. It is therefore **not yet in
> `backend/pyproject.toml`**. Resolve by upgrading to a release that supports
> starlette ≥1.x, or expose a minimal `/metrics` via `prometheus-client`
> directly. Until then `/metrics` is inert (the guarded import logs a warning).

## Run

```bash
docker compose \
  -f docker-compose.yml \
  -f infra/observability/docker-compose.observability.yml up -d
```

- Grafana: http://127.0.0.1:3001 (admin / `GF_SECURITY_ADMIN_PASSWORD`)
- Prometheus: http://127.0.0.1:9090
- Alertmanager: http://127.0.0.1:9093
- Tempo (query API): http://127.0.0.1:3200 · OTLP/HTTP in: `tempo:4318`
- Loki: http://127.0.0.1:3100

All bind to loopback only — expose them through an authenticated reverse proxy,
never directly to the internet.

## TODOs

- [ ] Resolve the instrumentator/starlette version conflict and add the dep.
- [ ] Set Grafana admin password from a secret; put Grafana behind SSO.
- [ ] Inject the PagerDuty routing key into Alertmanager from a secret.
- [ ] Add postgres-exporter / redis-exporter / node-exporter + dashboards.
- [ ] CHOS-204: move Tempo/Loki to object storage + retention for prod; run the
      Loki/Tempo Helm charts (with an Alloy/Promtail DaemonSet) in Kubernetes;
      inject `OTEL_EXPORTER_OTLP_ENDPOINT` into the API + workers deployments.
