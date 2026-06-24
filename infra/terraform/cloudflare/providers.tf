# CHOS-303: provider auth comes from the environment, never committed.
#   export CLOUDFLARE_API_TOKEN=...   (scoped token — see README)
# A scoped API token (Zone:Edit, WAF:Edit, DNS:Edit, Cache Rules:Edit, Bot
# Management:Edit on the single zone) is strongly preferred over a global key.

provider "cloudflare" {
  # api_token is read from CLOUDFLARE_API_TOKEN automatically.
}
