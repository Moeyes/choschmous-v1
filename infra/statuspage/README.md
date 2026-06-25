# infra/statuspage — Public status page (CHOS-504)

A [Gatus](https://gatus.io) status page that actively probes the platform's
public endpoints and shows citizens/schools whether the service is up.

| File | Purpose |
| ---- | ------- |
| `gatus-config.yaml` | endpoints to probe, pass/fail conditions, alert routing |
| `docker-compose.statuspage.yml` | run Gatus (status-page host) |

## Why Gatus (vs a SaaS)

- **Data sovereignty** — a government service's availability data stays on
  infrastructure we control rather than a third-party SaaS.
- **Config as code** — the whole page is one reviewed YAML file in this repo.
- **Active checks** — it probes `/health/ready`, `/health`, the web app, and the
  auth endpoint, applying the same 750ms latency bar as the latency SLO.

## Critical deployment rule

Deploy the status page **outside the main cluster** — ideally a different
provider/region. A status page co-located with the system it monitors goes dark
exactly when it is most needed (a full-region/AZ outage). It must be able to
report — and page — independently.

> Not deployed here: there is no live status-page host. The config is committed;
> the endpoints below are `REPLACE_ME` placeholders.

## `TODO(infra)` / cred notes

- Replace `REPLACE_ME.moeys.gov.kh` with the real public hostnames.
- Provide `PAGERDUTY_INTEGRATION_KEY` and `SLACK_STATUS_WEBHOOK_URL` from the
  secret store (compose reads them from the environment) — **never commit them**.
- Set the MOEYS crest `ui.logo` asset URL.
- Put the page behind the CDN/WAF (CHOS-303) with its own origin, separate from
  the API origin lock.
- Optional: add a `/api/v1/auth/health` lightweight liveness route if one does
  not already exist (the OIDC canary endpoint referenced in the config).
