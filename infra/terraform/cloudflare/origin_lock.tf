# CHOS-303: origin lock — ensure the origin only ever serves traffic that came
# THROUGH Cloudflare (so attackers can't hit the ALB directly and skip the WAF).
#
# Two independent layers (defense in depth):
#   1. Authenticated Origin Pulls (mTLS) — Cloudflare presents a client cert the
#      origin verifies.
#   2. A shared-secret header Cloudflare injects on every edge->origin request;
#      the origin rejects any request missing/with the wrong value.
#
# TODO(infra) — the THIRD layer lives on the origin, not here: restrict the
# ALB/ingress security group to Cloudflare's published IP ranges
# (https://www.cloudflare.com/ips/) and have the app/ingress verify the
# `${var.origin_lock_header}` header equals the injected secret.

resource "cloudflare_authenticated_origin_pulls" "this" {
  zone_id = var.zone_id
  enabled = true
}

# Inject the shared secret on every request forwarded to the origin.
resource "cloudflare_ruleset" "origin_lock_header" {
  zone_id     = var.zone_id
  name        = "moeys-origin-lock"
  description = "Inject shared-secret header on edge->origin requests"
  kind        = "zone"
  phase       = "http_request_late_transform"

  rules {
    ref         = "set_origin_lock_header"
    description = "Set ${var.origin_lock_header}"
    expression  = "true"
    action      = "rewrite"
    action_parameters {
      headers {
        name      = var.origin_lock_header
        operation = "set"
        value     = var.origin_lock_secret
      }
    }
  }
}
