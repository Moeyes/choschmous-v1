# Fetch Cloudflare's published IP ranges so Security Groups stay current.
# These are the ranges Cloudflare uses to contact origins; restricting ALB
# ingress to only these CIDRs locks out direct-origin access.
data "cloudflare_ip_ranges" "cf" {}