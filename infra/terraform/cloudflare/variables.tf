# CHOS-303: inputs for the Cloudflare edge module. Real values come from a
# per-env *.tfvars (never committed); secrets are injected from the environment /
# a secret store (Vault) and carry no default.

variable "cloudflare_api_token" {
  description = "Cloudflare API token (Zone:Edit, Firewall Services:Edit, Cache Rules:Edit, Bot Management:Edit). Injected from Vault — never committed."
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID (not secret — visible in the dashboard URL)."
  type        = string
}

variable "zone_name" {
  description = "The DNS zone managed by Cloudflare (e.g. moeys.gov.kh)."
  type        = string
}

variable "origin_alb_dns" {
  description = "AWS ALB DNS name for the BFF origin Cloudflare proxies to."
  type        = string
}

# Shared secret Cloudflare injects (X-CF-Origin-Secret) on every edge->origin
# request; the BFF middleware rejects any request missing it, so traffic that
# bypasses Cloudflare is dropped. >= 32 random chars; injected from Vault.
variable "cf_origin_secret" {
  description = "Shared origin-lock secret sent in X-CF-Origin-Secret. From Vault; never committed."
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Deployment environment (uat | staging | prod)."
  type        = string
}

variable "enable_bot_management" {
  description = "Enable Cloudflare Bot Management (Enterprise). false on Pro/Business (Super Bot Fight Mode only)."
  type        = bool
  default     = false
}

variable "logs_s3_bucket" {
  description = "S3 bucket for Cloudflare Logpush (security events + sampled HTTP logs)."
  type        = string
}

variable "aws_region" {
  description = "AWS region of the Logpush destination bucket."
  type        = string
  default     = "ap-southeast-1"
}
