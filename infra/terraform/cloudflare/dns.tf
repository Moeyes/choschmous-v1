# CHOS-303: proxied DNS record. `proxied = true` is what puts Cloudflare's CDN +
# WAF + DDoS protection in front of the origin (orange-cloud). Without it none of
# the edge rules below apply.

resource "cloudflare_record" "app" {
  zone_id = var.zone_id
  name    = var.app_hostname
  type    = "CNAME"
  content = var.origin_hostname
  proxied = true
  ttl     = 1 # 1 = automatic (required when proxied)
}
