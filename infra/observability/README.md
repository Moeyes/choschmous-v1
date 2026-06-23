# infra/observability — Metrics, dashboards & alerting (CHOS-105)

**Scaffold** for a Prometheus + Grafana + Alertmanager stack.

| Path | Purpose |
| ---- | ------- |
| `docker-compose.observability.yml` | Prometheus, Alertmanager, Grafana services |
| `prometheus/prometheus.yml` | scrape targets (incl. backend `/metrics`) + alerting |
| `prometheus/alerts.yml` | starter alert rules (down / 5xx / latency) |
| `alertmanager/alertmanager.yml` | routing + PagerDuty receiver (key is a TODO) |
| `grafana/provisioning/` | auto-provisioned Prometheus datasource + dashboard provider |

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

All three bind to loopback only — expose them through an authenticated reverse
proxy, never directly to the internet.

## TODOs

- [ ] Resolve the instrumentator/starlette version conflict and add the dep.
- [ ] Set Grafana admin password from a secret; put Grafana behind SSO.
- [ ] Inject the PagerDuty routing key into Alertmanager from a secret.
- [ ] Add postgres-exporter / redis-exporter / node-exporter + dashboards.
