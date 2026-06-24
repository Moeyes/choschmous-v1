# Provider + version pinning live in versions.tf (single terraform{} block per
# module). This file owns the zone, settings, DNS, cache, origin and TLS config.

# ─────────────────────────────────────────────────────────────────────────────
# Zone
# ─────────────────────────────────────────────────────────────────────────────

resource "cloudflare_zone" "moeys" {
  account_id = var.cloudflare_account_id
  zone       = var.zone_name
  plan       = "enterprise" # Required for full WAF + Bot Management
  type       = "full"       # Full DNS management; NS records delegated to Cloudflare
}

# ─────────────────────────────────────────────────────────────────────────────
# Zone settings
# ─────────────────────────────────────────────────────────────────────────────

resource "cloudflare_zone_settings_override" "moeys" {
  zone_id = cloudflare_zone.moeys.id

  settings {
    # TLS
    ssl                      = "strict"   # Full (Strict): validates origin cert
    tls_1_3                  = "on"
    min_tls_version          = "1.2"
    always_use_https         = "on"       # HTTP → HTTPS redirect at edge
    automatic_https_rewrites = "on"       # Rewrite mixed-content links
    opportunistic_encryption = "on"

    # Performance
    http2              = "on"
    http3              = "on"
    zero_rtt           = "on"
    websockets         = "on"
    brotli             = "on"
    rocket_loader      = "off" # Off: Next.js bundles own JS; rocket loader breaks hydration
    minify {
      css  = "off" # Next.js already minifies
      js   = "off"
      html = "off"
    }

    # Security
    security_level       = "medium"
    challenge_ttl        = 1800
    browser_check        = "on"
    hotlink_protection   = "off" # Off: Cloudinary handles media
    email_obfuscation    = "off" # Off: no email in HTML
    server_side_exclude  = "on"

    # Headers
    h2_prioritization = "on"

    # Cache
    cache_level          = "aggressive"
    browser_cache_ttl    = 14400       # 4h browser cache for non-immutable assets
    always_online        = "on"        # Serve stale from Cloudflare if origin down

    # Privacy / trust
    privacy_pass         = "on"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# DNS Records
# ─────────────────────────────────────────────────────────────────────────────

# Root domain → ALB (proxied through Cloudflare)
resource "cloudflare_record" "root" {
  zone_id = cloudflare_zone.moeys.id
  name    = var.zone_name
  type    = "CNAME"
  value   = var.origin_alb_dns
  proxied = true   # Traffic flows through Cloudflare edge (WAF, cache, DDoS)
  ttl     = 1      # Auto (managed by Cloudflare when proxied=true)

  comment = "CHOS-303: BFF ALB origin, proxied"
}

# www subdomain
resource "cloudflare_record" "www" {
  zone_id = cloudflare_zone.moeys.id
  name    = "www"
  type    = "CNAME"
  value   = var.zone_name
  proxied = true
  ttl     = 1
}

# API subdomain — NOT proxied (internal; backend is not public-facing)
# The API is only reached by the BFF internally. This record is for
# documentation / future use; keep proxied=false to prevent accidental exposure.
# Remove entirely if the API must never have a public DNS record.
# resource "cloudflare_record" "api" { ... }  # Intentionally omitted CHOS-303

# ─────────────────────────────────────────────────────────────────────────────
# Origin secret: injected by Cloudflare on every request to origin.
# The BFF Next.js middleware validates this header and returns 403 if absent,
# blocking direct-origin access even if the ALB IP is discovered.
# ─────────────────────────────────────────────────────────────────────────────

resource "cloudflare_ruleset" "inject_origin_secret" {
  zone_id     = cloudflare_zone.moeys.id
  name        = "Inject origin secret header"
  description = "CHOS-303: add X-CF-Origin-Secret to all origin requests"
  kind        = "zone"
  phase       = "http_request_late_transform"

  rules {
    action      = "rewrite"
    description = "Add origin secret header"
    enabled     = true
    expression  = "true"

    action_parameters {
      headers {
        name      = "X-CF-Origin-Secret"
        operation = "set"
        value     = var.cf_origin_secret
      }
      # Strip Cloudflare-added debug headers in prod
      headers {
        name      = "CF-Cache-Status"
        operation = "remove"
      }
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Cache Rules (replaces legacy Page Rules)
# ─────────────────────────────────────────────────────────────────────────────

resource "cloudflare_ruleset" "cache_rules" {
  zone_id     = cloudflare_zone.moeys.id
  name        = "Cache rules — CHOS-303"
  description = "Static assets immutable 1yr; SSR pages 60s SWR; API/auth bypass"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  # Rule 1: API and auth routes — never cache
  rules {
    action      = "set_cache_settings"
    description = "API and auth: bypass cache"
    enabled     = true
    expression  = <<-EOT
      (http.request.uri.path matches "^/api/") or
      (http.request.uri.path matches "^/_next/webpack-hmr") or
      (http.cookie contains "access_token") or
      (http.request.method ne "GET" and http.request.method ne "HEAD")
    EOT

    action_parameters {
      cache = false
    }
  }

  # Rule 2: Next.js content-hashed static assets — immutable 1 year
  rules {
    action      = "set_cache_settings"
    description = "Next.js static assets: immutable 1yr"
    enabled     = true
    expression  = <<-EOT
      (http.request.uri.path matches "^/_next/static/") or
      (http.request.uri.path matches "\\.(woff2|woff|ttf|otf|eot|ico)$") or
      (http.request.uri.path matches "\\.(png|jpg|jpeg|gif|webp|avif|svg)$" and
       not http.request.uri.path matches "^/api/")
    EOT

    action_parameters {
      cache = true

      edge_ttl {
        mode    = "override_origin"
        default = 31536000  # 1 year
      }

      browser_ttl {
        mode    = "override_origin"
        default = 31536000
      }

      serve_stale {
        disable_stale_while_updating = false
      }

      respect_strong_etags = true
      cache_key {
        ignore_query_strings_order = false
        cache_deception_armor      = true

        custom_key {
          query_string {
            # For hashed assets, query string is the cache buster — include it
            include {
              list = ["v", "_rsc"]
            }
          }
        }
      }
    }
  }

  # Rule 3: SSR pages (public, unauthenticated GET) — 60s edge, SWR 30s
  # Only cache when NO access_token cookie present (anonymous traffic).
  rules {
    action      = "set_cache_settings"
    description = "SSR public pages: 60s edge TTL, stale-while-revalidate 30s"
    enabled     = true
    expression  = <<-EOT
      (http.request.method eq "GET") and
      (not http.cookie contains "access_token") and
      (not http.request.uri.path matches "^/api/") and
      (not http.request.uri.path matches "^/_next/static/") and
      (not http.request.uri.path matches "^/login") and
      (not http.request.uri.path matches "^/dashboard") and
      (not http.request.uri.path matches "^/register") and
      (not http.request.uri.path matches "^/registrations") and
      (not http.request.uri.path matches "^/organizations") and
      (not http.request.uri.path matches "^/users") and
      (not http.request.uri.path matches "^/cards") and
      (not http.request.uri.path matches "^/reports") and
      (not http.request.uri.path matches "^/participation") and
      (not http.request.uri.path matches "^/by-number") and
      (not http.request.uri.path matches "^/by-category") and
      (not http.request.uri.path matches "^/by-sport") and
      (not http.request.uri.path matches "^/leader-registration") and
      (not http.request.uri.path matches "^/sports/") and
      (not http.request.uri.path matches "^/events/") and
      (http.request.uri.path matches "^/(privacy|$)")
    EOT

    action_parameters {
      cache = true

      edge_ttl {
        mode    = "override_origin"
        default = 60  # 60s edge TTL

        status_code_ttl {
          status_code = 200
          value       = 60
        }
        status_code_ttl {
          status_code = 404
          value       = 30
        }
        status_code_ttl {
          status_code = 500
          value       = 0
        }
      }

      browser_ttl {
        mode    = "respect_origin"  # Let Next.js control browser cache
      }

      serve_stale {
        disable_stale_while_updating = false  # Enable SWR
      }

      cache_key {
        cache_deception_armor = true
        custom_key {
          query_string {
            include { list = [] }  # Ignore query strings for SSR pages
          }
        }
      }
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Origin Rules: set Host header and connection settings toward origin
# ─────────────────────────────────────────────────────────────────────────────

resource "cloudflare_ruleset" "origin_rules" {
  zone_id     = cloudflare_zone.moeys.id
  name        = "Origin rules — CHOS-303"
  description = "Route to ALB, set SNI"
  kind        = "zone"
  phase       = "http_request_origin"

  rules {
    action      = "route"
    description = "Route all traffic to BFF ALB"
    enabled     = true
    expression  = "true"

    action_parameters {
      host_header = var.zone_name  # Send correct Host header to origin (ALB)
      sni {
        value = var.zone_name
      }
      origin {
        host = var.origin_alb_dns
        port = 443
      }
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# SSL/TLS Certificate
# ─────────────────────────────────────────────────────────────────────────────

resource "cloudflare_certificate_pack" "moeys" {
  zone_id               = cloudflare_zone.moeys.id
  type                  = "advanced"
  validation_method     = "txt"
  validity_days         = 90
  certificate_authority = "google"   # or "lets_encrypt" — Google Trust Services preferred for .gov.kh
  cloudflare_branding   = false

  hosts = [
    var.zone_name,
    "www.${var.zone_name}",
  ]

  wait_for_active_status = true
}

# ─────────────────────────────────────────────────────────────────────────────
# HSTS preload (supplements Next.js HSTS header already set)
# ─────────────────────────────────────────────────────────────────────────────

resource "cloudflare_zone_settings_override" "hsts" {
  zone_id = cloudflare_zone.moeys.id

  settings {
    security_header {
      enabled            = true
      preload            = true
      max_age            = 63072000  # Matches existing Next.js header: 2 years
      include_subdomains = true
      nosniff            = true      # X-Content-Type-Options: nosniff
    }
  }
}