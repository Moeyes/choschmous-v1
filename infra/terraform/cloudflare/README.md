# Cloudflare edge (CHOS-303)

CDN + WAF (OWASP CRS) + DDoS/bot protection + origin lock for the MOEYS app, plus
edge cache rules that mirror the Next.js `Cache-Control` headers
(`frontend/next.config.ts`).

> **Scaffold only.** `terraform apply` here mutates the live Cloudflare zone and
> must **not** run in CI. Fill the placeholders, then run
> `init → validate → plan` manually and have the plan reviewed before `apply`.

## What this module configures

| File | Resource(s) | Purpose |
| --- | --- | --- |
| `main.tf` | `cloudflare_zone`, zone settings, DNS (root + www), `inject_origin_secret`, `cache_rules`, `origin_rules`, `certificate_pack`, HSTS | Zone + TLS + DNS + cache + origin routing + the X-CF-Origin-Secret header. |
| `waf.tf` | managed + custom firewall rulesets | Cloudflare Managed Ruleset + **OWASP Core Rule Set**, plus app-specific SQLi/XSS/traversal/method/sensitive-path rules. |
| `bot_ddos.tf` | bot management, rate limiting, `ddos_l7`, logpush | Bot mitigation, per-endpoint edge rate limits, HTTP DDoS ruleset, security log export. |
| `origin_lock.tf` | authenticated origin pulls (mTLS) | Second origin-lock layer on top of the shared-secret header. |

## Required credentials / inputs

- `TF_VAR_cloudflare_api_token` (env) — scoped token: Zone, WAF, DNS, Cache Rules,
  Bot Management : Edit on the single zone. From Vault; never committed.
- `TF_VAR_cf_origin_secret` (env) — random shared secret (`openssl rand -hex 32`).
- `cloudflare_account_id`, `zone_name`, `origin_alb_dns`, `environment`,
  `logs_s3_bucket`, `aws_region` — via tfvars (see `terraform.tfvars.example`).

## Origin-side follow-ups (NOT in this module — TODO infra)

The edge lock is only complete when the origin cooperates:

1. **Restrict ingress** (ALB/ingress security group) to Cloudflare's published IP
   ranges — <https://www.cloudflare.com/ips/>.
2. **Verify the secret header** `X-CF-Origin-Secret` (== `cf_origin_secret`) in the
   BFF middleware, returning 403 when absent/wrong.
3. **Trust Cloudflare's client cert** for Authenticated Origin Pulls (mTLS).

## Provider note

Written for the Cloudflare provider `~> 4.40` (pinned in `versions.tf` — the
single `terraform{}` block for this module). Managed ruleset IDs (OWASP CRS,
Cloudflare Managed, HTTP DDoS) are global Cloudflare constants referenced by id.
