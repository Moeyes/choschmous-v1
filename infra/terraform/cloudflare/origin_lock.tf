# CHOS-303: origin lock (mTLS layer).
#
# Complements the shared-secret header injected in main.tf
# (cloudflare_ruleset.inject_origin_secret → X-CF-Origin-Secret, verified by the
# BFF middleware). This adds the SECOND, independent layer: Authenticated Origin
# Pulls (mTLS) — Cloudflare presents a client certificate the origin verifies, so
# a request that did not come through Cloudflare cannot complete the TLS handshake.
#
# TODO(infra) — the THIRD layer lives on the origin, not here: restrict the
# ALB/ingress security group to Cloudflare's published IP ranges
# (https://www.cloudflare.com/ips/), and configure the ALB/origin to require +
# verify the Cloudflare Authenticated Origin Pull CA certificate.

resource "cloudflare_authenticated_origin_pulls" "this" {
  zone_id = cloudflare_zone.moeys.id
  enabled = true
}
