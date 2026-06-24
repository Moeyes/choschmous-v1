# CHOS-303: WAF. Three rulesets, each pinned to its phase:
#   1. managed   — Cloudflare Managed Ruleset + OWASP Core Rule Set (CRS)
#   2. custom    — bespoke deny rules (method allow-list, sensitive paths)
#   3. ratelimit — per-IP edge rate limit (defense-in-depth over CHOS-302)

# 1) Managed rulesets (OWASP CRS + Cloudflare Managed). The managed ruleset IDs
# are global Cloudflare constants; we deploy them by reference (no rule copying).
resource "cloudflare_ruleset" "managed_waf" {
  zone_id     = var.zone_id
  name        = "moeys-managed-waf"
  description = "Cloudflare Managed Ruleset + OWASP CRS"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  rules {
    ref         = "exec_cloudflare_managed"
    description = "Cloudflare Managed Ruleset"
    expression  = "true"
    action      = "execute"
    action_parameters {
      id = "efb7b8c949ac4650a09736fc376e9aee" # Cloudflare Managed Ruleset
    }
  }

  rules {
    ref         = "exec_owasp_crs"
    description = "OWASP Core Rule Set"
    expression  = "true"
    action      = "execute"
    action_parameters {
      id = "4814384a9e5d4991b9815dcfc25d2f1f" # OWASP Core Ruleset
      # TODO(infra): tune the paranoia level / anomaly score threshold via
      # `overrides` once a baseline of false positives is measured (start in log).
    }
  }
}

# 2) Custom firewall rules — explicit denies the managed rulesets don't cover.
resource "cloudflare_ruleset" "custom_waf" {
  zone_id     = var.zone_id
  name        = "moeys-custom-waf"
  description = "Bespoke deny rules"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # Only allow the HTTP methods the API actually uses; block the rest at the edge.
  rules {
    ref         = "block_unexpected_methods"
    description = "Block methods the app never uses"
    expression  = "not http.request.method in {\"GET\" \"POST\" \"PUT\" \"PATCH\" \"DELETE\" \"OPTIONS\" \"HEAD\"}"
    action      = "block"
  }

  # The destructive maintenance + internal endpoints must never be reachable from
  # the public internet even if accidentally exposed by the app.
  rules {
    ref         = "block_internal_paths"
    description = "Block maintenance/metrics/docs from the edge"
    expression  = "http.request.uri.path in {\"/metrics\"} or starts_with(http.request.uri.path, \"/api/v1/maintenance\")"
    action      = "block"
  }
}

# 3) Edge rate limiting — coarse per-IP cap. The app's Redis limiter (CHOS-302)
# stays the fine-grained, per-route control; this just sheds volumetric abuse
# before it reaches the origin.
resource "cloudflare_ruleset" "ratelimit" {
  zone_id     = var.zone_id
  name        = "moeys-ratelimit"
  description = "Per-IP edge rate limit"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules {
    ref         = "ip_rate_limit"
    description = "Per-IP request cap"
    expression  = "true"
    action      = "block"
    ratelimit {
      characteristics     = ["ip.src", "cf.colo.id"]
      period              = var.edge_rate_limit_period
      requests_per_period = var.edge_rate_limit_requests
      mitigation_timeout  = 60
    }
  }
}
