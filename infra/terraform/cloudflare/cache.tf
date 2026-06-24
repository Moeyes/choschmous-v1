# CHOS-303: edge cache rules. Mirrors the Next.js Cache-Control headers
# (frontend/next.config.ts): cache immutable build assets hard, never cache the
# API (authenticated / PII).

resource "cloudflare_ruleset" "cache" {
  zone_id     = var.zone_id
  name        = "moeys-cache"
  description = "Edge cache policy"
  kind        = "zone"
  phase       = "http_request_cache_settings"

  # Never cache the API — it carries authenticated and PII responses.
  rules {
    ref         = "bypass_api"
    description = "Bypass cache for /api/*"
    expression  = "starts_with(http.request.uri.path, \"/api/\")"
    action      = "set_cache_settings"
    action_parameters {
      cache = false
    }
  }

  # Cache content-hashed static assets aggressively at the edge.
  rules {
    ref         = "cache_static"
    description = "Cache immutable build assets"
    expression  = "starts_with(http.request.uri.path, \"/_next/static/\") or http.request.uri.path matches \"(?i)\\.(?:js|css|woff2?|ttf|otf|eot|svg|png|jpe?g|gif|webp|avif|ico)$\""
    action      = "set_cache_settings"
    action_parameters {
      cache = true
      edge_ttl {
        mode    = "override_origin"
        default = 31536000
      }
      browser_ttl {
        mode    = "override_origin"
        default = 31536000
      }
    }
  }
}

# Tiered Cache reduces origin fetches by having edge data centers pull through a
# regional tier rather than each hitting the origin.
resource "cloudflare_tiered_cache" "smart" {
  zone_id    = var.zone_id
  cache_type = "smart"
}
