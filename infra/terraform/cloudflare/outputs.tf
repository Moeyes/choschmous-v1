output "zone_id" {
  description = "Cloudflare Zone ID — needed for external Terraform modules"
  value       = cloudflare_zone.moeys.id
  sensitive   = false
}

output "nameservers" {
  description = "Cloudflare nameservers — delegate DNS from registrar to these"
  value       = cloudflare_zone.moeys.name_servers
}

output "cf_origin_secret_reminder" {
  description = "Reminder: cf_origin_secret is in Vault at secret/moeys/cloudflare"
  value       = "secret/moeys/cloudflare/cf_origin_secret"
  sensitive   = false
}