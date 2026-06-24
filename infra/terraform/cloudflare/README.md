# Cloudflare edge (CHOS-303)

CDN + WAF (OWASP CRS) + DDoS/bot protection + origin lock for the MOEYS app, plus
edge cache rules that mirror the Next.js `Cache-Control` headers.

> **Scaffold only.** `terraform apply` here mutates the live Cloudflare zone and
> must **not** run in CI. Fill the `TODO(infra)` placeholders, then run
> `init → validate → plan` manually and have the plan reviewed before `apply`.

## What this module configures

| File | Resource | Purpose |
| --- | --- | --- |
| `dns.tf` | `cloudflare_record.app` | Proxied (orange-cloud) hostname — puts the CDN/WAF in front of the origin. |
| `waf.tf` | managed/custom/ratelimit rulesets | Cloudflare Managed Ruleset + **OWASP Core Rule Set**, method allow-list + sensitive-path blocks, per-IP edge rate limit. |
| `bot_ddos.tf` | zone settings, `cloudflare_bot_management`, `ddos_l7` ruleset | Bot mitigation + HTTP DDoS managed ruleset. |
| `origin_lock.tf` | authenticated origin pulls + secret-header transform | Ensure the origin only serves traffic that came through Cloudflare. |
| `cache.tf` | cache-settings ruleset + tiered cache | Cache immutable assets hard; **never** cache `/api/*`. |

## Required credentials / inputs

- `CLOUDFLARE_API_TOKEN` (env) — scoped token: Zone, WAF, DNS, Cache Rules, Bot
  Management : Edit on the single zone. **Prefer a scoped token over the global key.**
- `TF_VAR_origin_lock_secret` (env) — random shared secret (`openssl rand -hex 32`).
- `zone_id`, `account_id`, `app_hostname`, `origin_hostname`, `environment` — via tfvars.

## Origin-side follow-ups (NOT in this module — TODO infra)

The edge lock is only complete when the origin cooperates:

1. **Restrict ingress** (ALB/ingress security group) to Cloudflare's published IP
   ranges — <https://www.cloudflare.com/ips/>.
2. **Verify the secret header** `X-Edge-Auth` (== `origin_lock_secret`) at the
   ingress or app, rejecting requests without it.
3. **Trust Cloudflare's client cert** for Authenticated Origin Pulls (mTLS).

## Provider note

Written for the Cloudflare provider `~> 4.40`. Managed ruleset IDs (OWASP CRS,
Cloudflare Managed, HTTP DDoS) are global Cloudflare constants referenced by id.
