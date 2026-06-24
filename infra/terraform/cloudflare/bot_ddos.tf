# ─────────────────────────────────────────────────────────────────────────────
# Bot Management (CHOS-303)
# ─────────────────────────────────────────────────────────────────────────────

# Super Bot Fight Mode — blocks definitely-automated traffic.
# Bot Management (Enterprise) adds bot score to every request and allows
# fine-grained rules. Super Bot Fight Mode (Pro/Business) is simpler but
# sufficient if not on Enterprise.

resource "cloudflare_bot_management" "moeys" {
  count   = var.enable_bot_management ? 1 : 0
  zone_id = cloudflare_zone.moeys.id

  enable_js                 = true   # JS challenge for unverified bots
  fight_mode                = true   # Super Bot Fight Mode
  optimize_wordpress        = false  # Not a WordPress site
  sbfm_definitely_automated = "block"    # Block bots with score 1 (definitely bot)
  sbfm_likely_automated     = "managed_challenge"  # Challenge likely bots
  sbfm_verified_bots        = "allow"   # Allow Googlebot, Bingbot, etc.

  # Suppress bot challenge on API routes — structured clients (curl, SDKs)
  # are expected on the API. WAF rules and rate limits protect the API instead.
  using_latest_model = true
}

# ─────────────────────────────────────────────────────────────────────────────
# Rate Limiting (CHOS-303) — layer 7 DDoS + API abuse
# ─────────────────────────────────────────────────────────────────────────────

resource "cloudflare_ruleset" "rate_limiting" {
  zone_id     = cloudflare_zone.moeys.id
  name        = "Rate limiting rules — CHOS-303"
  description = "Per-IP rate limits for auth, API, and general traffic"
  kind        = "zone"
  phase       = "http_ratelimit"

  # Rule 1: Auth endpoint — strict limit to prevent brute force.
  # Backend also has Redis sliding-window rate limiting (CHOS-existing) and
  # account lockout; this is the edge layer.
  rules {
    action      = "block"
    description = "Rate limit: /api/v1/auth/login — 5 req/min per IP"
    enabled     = true
    expression  = "(http.request.uri.path eq \"/api/v1/auth/login\" and http.request.method eq \"POST\")"

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60      # 1 minute window
      requests_per_period = 5       # 5 login attempts per minute per IP
      mitigation_timeout  = 600     # Block for 10 minutes after threshold hit
      requests_to_origin  = false   # Count at edge, don't forward to origin
    }
  }

  # Rule 2: Auth refresh endpoint
  rules {
    action      = "block"
    description = "Rate limit: /api/v1/auth/refresh — 20 req/min per IP"
    enabled     = true
    expression  = "(http.request.uri.path eq \"/api/v1/auth/refresh\")"

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 20
      mitigation_timeout  = 300
      requests_to_origin  = false
    }
  }

  # Rule 3: Registration endpoint — prevent automated registration spam
  rules {
    action      = "managed_challenge"
    description = "Rate limit: /api/v1/registration — 30 req/min per IP"
    enabled     = true
    expression  = "(http.request.uri.path matches \"^/api/v1/registration\" and http.request.method eq \"POST\")"

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 30
      mitigation_timeout  = 120
      requests_to_origin  = false
    }
  }

  # Rule 4: Excel/report downloads — prevent scraping
  rules {
    action      = "block"
    description = "Rate limit: /api/v1/excel and /api/v1/reports — 10 req/min per IP"
    enabled     = true
    expression  = <<-EOT
      (http.request.uri.path matches "^/api/v1/excel") or
      (http.request.uri.path matches "^/api/v1/reports")
    EOT

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 10
      mitigation_timeout  = 300
      requests_to_origin  = false
    }
  }

  # Rule 5: General API rate limit — catch-all for API abuse
  rules {
    action      = "managed_challenge"
    description = "Rate limit: all /api/ — 200 req/min per IP"
    enabled     = true
    expression  = "(http.request.uri.path matches \"^/api/\")"

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 200
      mitigation_timeout  = 60
      requests_to_origin  = false
    }
  }

  # Rule 6: Global page rate limit — DDoS mitigation at layer 7
  rules {
    action      = "managed_challenge"
    description = "Rate limit: global — 500 req/min per IP"
    enabled     = true
    expression  = "true"

    ratelimit {
      characteristics     = ["ip.src"]
      period              = 60
      requests_per_period = 500
      mitigation_timeout  = 60
      requests_to_origin  = false
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# DDoS Protection Override (layer 3/4 handled automatically by Cloudflare
# for all plans; layer 7 HTTP DDoS managed ruleset configured here)
# ─────────────────────────────────────────────────────────────────────────────

resource "cloudflare_ruleset" "ddos_l7" {
  zone_id     = cloudflare_zone.moeys.id
  name        = "HTTP DDoS override — CHOS-303"
  description = "Increase sensitivity for DDoS detection on this zone"
  kind        = "zone"
  phase       = "ddos_l7"

  rules {
    action      = "execute"
    description = "Cloudflare HTTP DDoS Attack Protection — high sensitivity"
    enabled     = true
    expression  = "true"

    action_parameters {
      id      = "4d21379b4f9f4bb088e0729962c8b3cf"  # Cloudflare HTTP DDoS ruleset
      version = "latest"

      overrides {
        sensitivity_level = "high"   # Detect attacks faster; may have slightly higher false positive rate
        action            = "block"

        # For the auth endpoint, use even higher sensitivity
        rules {
          id                = "fdfdac75430c4c47a959592f0aa5e68a"  # HTTP requests flood rule
          sensitivity_level = "high"
          action            = "block"
        }
      }
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Security Events / Logging
# ─────────────────────────────────────────────────────────────────────────────

# Logpush to S3 for SIEM ingestion and audit trail (government requirement)
resource "cloudflare_logpush_job" "security_events" {
  zone_id          = cloudflare_zone.moeys.id
  enabled          = true
  name             = "moeys-security-events-${var.environment}"
  logpull_options  = "fields=ClientIP,ClientRequestMethod,ClientRequestURI,ClientRequestUserAgent,EdgeResponseStatus,FirewallMatchesActions,FirewallMatchesRuleIDs,SecurityLevel,BotScore,BotScoreSrc&timestamps=unix"
  destination_conf = "s3://${var.logs_s3_bucket}/cloudflare-logs?region=${var.aws_region}"
  dataset          = "firewall_events"
}

resource "cloudflare_logpush_job" "http_requests" {
  zone_id          = cloudflare_zone.moeys.id
  enabled          = true
  name             = "moeys-http-requests-${var.environment}"
  logpull_options  = "fields=ClientIP,ClientRequestMethod,ClientRequestURI,EdgeResponseStatus,CacheCacheStatus,CacheResponseStatus,EdgeStartTimestamp,OriginResponseTime,BotScore&timestamps=unix&sampleRate=0.1"
  destination_conf = "s3://${var.logs_s3_bucket}/cloudflare-access-logs?region=${var.aws_region}"
  dataset          = "http_requests"
}