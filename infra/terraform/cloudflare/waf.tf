# ─────────────────────────────────────────────────────────────────────────────
# WAF — Managed Rulesets (CHOS-303)
# ─────────────────────────────────────────────────────────────────────────────

# Cloudflare Managed Ruleset + OWASP Core Ruleset.
# Requires Enterprise or equivalent plan for full ruleset access.

resource "cloudflare_ruleset" "managed_waf" {
  zone_id     = cloudflare_zone.moeys.id
  name        = "Managed WAF rulesets — CHOS-303"
  description = "OWASP + Cloudflare Managed Rules + custom application rules"
  kind        = "zone"
  phase       = "http_request_firewall_managed"

  # ── Cloudflare Managed Ruleset (id: efb7b8c949ac4650a09736fc376e9aee) ──────
  rules {
    action      = "execute"
    description = "Cloudflare Managed Ruleset"
    enabled     = true
    expression  = "true"

    action_parameters {
      id      = "efb7b8c949ac4650a09736fc376e9aee"
      version = "latest"

      overrides {
        # Set default action to block (not log) for high-confidence matches.
        action  = "block"
        enabled = true

        # Paranoia level 2 — good balance for a government web app.
        # Level 3+ has higher false-positive rate on JSON APIs.
        categories {
          category = "paranoia-level-2"
          action   = "block"
          enabled  = true
        }
        categories {
          category = "paranoia-level-1"
          action   = "block"
          enabled  = true
        }

        # Disable rules that conflict with Next.js / FastAPI normal operation
        # (add rule IDs here after reviewing managed ruleset hit logs for 1 week)
        # rules {
        #   id      = "RULE_ID"
        #   enabled = false
        # }
      }
    }
  }

  # ── Cloudflare OWASP Core Ruleset (id: 4814384a9e5d4991b9815dcfc25d2f1f) ──
  rules {
    action      = "execute"
    description = "OWASP Core Ruleset"
    enabled     = true
    expression  = "true"

    action_parameters {
      id      = "4814384a9e5d4991b9815dcfc25d2f1f"
      version = "latest"

      overrides {
        action  = "block"
        enabled = true

        # Sensitivity: medium → high for this app (government PII data)
        rules {
          id              = "6179ae15870a4bb7b2d480d4843b323c"  # OWASP score threshold
          action          = "block"
          score_threshold = 60  # Block at score ≥ 60 (medium sensitivity)
          enabled         = true
        }
      }
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Custom WAF Rules (application-specific)
# ─────────────────────────────────────────────────────────────────────────────

resource "cloudflare_ruleset" "custom_waf" {
  zone_id     = cloudflare_zone.moeys.id
  name        = "Custom WAF rules — CHOS-303"
  description = "App-specific firewall rules for MoEYS platform"
  kind        = "zone"
  phase       = "http_request_firewall_custom"

  # Rule 1: Block direct-origin access (requests missing CF origin secret)
  # Belt-and-suspenders: ALB SG blocks non-CF IPs; this rule blocks at WAF layer.
  rules {
    action      = "block"
    description = "CHOS-303: block requests bypassing Cloudflare"
    enabled     = true
    # This rule fires at Cloudflare edge — requests reaching here already came
    # through CF, so this rule is for documentation. The real enforcement is in
    # the BFF middleware validating X-CF-Origin-Secret on the origin side.
    # This rule blocks known scanner/attacker User-Agents probing for origin IPs.
    expression = <<-EOT
      (http.user_agent contains "masscan") or
      (http.user_agent contains "zgrab") or
      (http.user_agent contains "shodan") or
      (http.user_agent contains "censys") or
      (http.user_agent contains "nmap")
    EOT
  }

  # Rule 2: SQLi — additional protection layer beyond managed ruleset
  rules {
    action      = "block"
    description = "SQL injection patterns in URI / body"
    enabled     = true
    expression  = <<-EOT
      (http.request.uri.query contains "UNION SELECT") or
      (http.request.uri.query contains "union select") or
      (http.request.uri.query matches "(?i)(select|insert|update|delete|drop|truncate).*(from|into|table)") or
      (http.request.uri.query matches "(?i)(1=1|1 = 1|'1'='1'|admin'--)")
    EOT
  }

  # Rule 3: XSS — supplement managed rules
  rules {
    action      = "block"
    description = "XSS patterns in URI"
    enabled     = true
    expression  = <<-EOT
      (http.request.uri.query matches "(?i)<script") or
      (http.request.uri.query matches "(?i)javascript:") or
      (http.request.uri.query matches "(?i)on(load|error|click|mouse)\\s*=") or
      (http.request.uri.query matches "(?i)<iframe")
    EOT
  }

  # Rule 4: Path traversal
  rules {
    action      = "block"
    description = "Path traversal attempts"
    enabled     = true
    expression  = <<-EOT
      (http.request.uri.path matches "\\.\\./") or
      (http.request.uri.path matches "\\.\\.%2[Ff]") or
      (http.request.uri.path matches "%2[Ee]%2[Ee]%2[Ff]") or
      (http.request.uri.path matches "(?i)/etc/passwd") or
      (http.request.uri.path matches "(?i)/proc/self")
    EOT
  }

  # Rule 5: Command injection
  rules {
    action      = "block"
    description = "Command injection patterns"
    enabled     = true
    expression  = <<-EOT
      (http.request.uri.query matches "(?i);\\s*(ls|cat|wget|curl|chmod|bash|sh|python|perl)\\s") or
      (http.request.uri.query matches "(?i)\\|\\s*(ls|cat|wget|curl|id|whoami)") or
      (http.request.uri.query matches "(?i)`[^`]*`")
    EOT
  }

  # Rule 6: Credential stuffing — challenge on auth endpoint anomalies
  # Note: Rate limiting (bot_ddos.tf) handles volume; this handles known patterns.
  rules {
    action      = "managed_challenge"
    description = "Challenge suspicious auth requests (unusual UA, no referer)"
    enabled     = true
    expression  = <<-EOT
      (http.request.uri.path eq "/api/v1/auth/login") and
      (http.request.method eq "POST") and
      (
        (not http.request.headers["user-agent"] exists) or
        (http.user_agent eq "") or
        (http.user_agent matches "^(python-requests|curl|wget|Go-http|Java|libwww)")
      )
    EOT
  }

  # Rule 7: Block sensitive paths that should never be externally reachable
  # /maintenance routes are excluded from prod build (CHOS-102) but WAF adds defense-in-depth.
  rules {
    action      = "block"
    description = "Block maintenance and internal routes at WAF"
    enabled     = true
    expression  = <<-EOT
      (http.request.uri.path matches "^/api/v1/maintenance/") or
      (http.request.uri.path eq "/metrics") or
      (http.request.uri.path matches "^/api/v1/openapi\\.json") or
      (http.request.uri.path eq "/docs") or
      (http.request.uri.path eq "/redoc")
    EOT
  }

  # Rule 8: Block HTTP methods not used by this API
  rules {
    action      = "block"
    description = "Block unused HTTP methods"
    enabled     = true
    expression  = <<-EOT
      (http.request.method eq "CONNECT") or
      (http.request.method eq "TRACE") or
      (http.request.method eq "TRACK")
    EOT
  }

  # Rule 9: Geo-block — Cambodia government platform; optionally restrict
  # countries with no legitimate user base. Uncomment and tune as needed.
  # rules {
  #   action      = "managed_challenge"
  #   description = "Challenge traffic from high-risk regions"
  #   enabled     = true
  #   expression  = "(ip.geoip.country in {\"CN\" \"RU\" \"KP\" \"IR\"})"
  # }
}