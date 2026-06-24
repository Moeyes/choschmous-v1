# CHOS-303: outputs (no secrets).

output "app_record_hostname" {
  description = "Proxied hostname served by Cloudflare."
  value       = cloudflare_record.app.hostname
}

output "managed_waf_ruleset_id" {
  description = "ID of the managed WAF ruleset (OWASP CRS + Cloudflare Managed)."
  value       = cloudflare_ruleset.managed_waf.id
}

output "origin_lock_header" {
  description = "Header the origin must verify to enforce the edge lock."
  value       = var.origin_lock_header
}
