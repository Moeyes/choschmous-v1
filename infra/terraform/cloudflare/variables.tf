# CHOS-303: inputs. Real values come from a per-env *.tfvars (never committed);
# secrets are injected from the environment / a secret store.

variable "zone_id" {
  description = "TODO(infra): Cloudflare Zone ID for the app domain."
  type        = string
}

variable "account_id" {
  description = "TODO(infra): Cloudflare Account ID."
  type        = string
}

variable "app_hostname" {
  description = "Public hostname served by Cloudflare (e.g. moeys.gov.kh)."
  type        = string
}

variable "origin_hostname" {
  description = "Origin hostname behind Cloudflare (the ingress/ALB DNS)."
  type        = string
}

variable "environment" {
  description = "Deployment environment (uat | staging | prod)."
  type        = string
}

# Shared secret Cloudflare injects on every edge->origin request; the origin
# rejects any request missing it, so traffic that bypasses Cloudflare is dropped.
variable "origin_lock_secret" {
  description = "TODO(infra): inject from a secret store (Vault/SM). The origin verifies this header."
  type        = string
  sensitive   = true
}

variable "origin_lock_header" {
  description = "Header name carrying the origin-lock secret."
  type        = string
  default     = "X-Edge-Auth"
}

# Edge rate limit (defense-in-depth on top of the app's Redis limiter, CHOS-302).
variable "edge_rate_limit_requests" {
  description = "Requests per period per client IP before the edge mitigates."
  type        = number
  default     = 600
}

variable "edge_rate_limit_period" {
  description = "Rate-limit window in seconds (10, 60, 120, ...)."
  type        = number
  default     = 60
}
