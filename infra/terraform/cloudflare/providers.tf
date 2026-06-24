# CHOS-303: provider auth. The token is sensitive and injected from Vault via
# the `cloudflare_api_token` variable (TF_VAR_cloudflare_api_token), never
# committed. A scoped token (Zone / WAF / DNS / Cache Rules / Bot Management :
# Edit on the single zone) is strongly preferred over the global key.

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
