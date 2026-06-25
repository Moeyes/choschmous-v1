# CHOS-205: input variables. All environment-specific / sensitive values are
# placeholders supplied per-environment via a *.tfvars file (see
# terraform.tfvars.example) — nothing real is committed.

variable "project" {
  description = "Project slug used to name/tag all resources."
  type        = string
  default     = "moeys"
}

variable "environment" {
  description = "Deployment environment (dev | uat | staging | prod)."
  type        = string
  # No default: must be set per-env so resources are never created ambiguously.
}

variable "region" {
  description = "Cloud region. TODO(infra): set the real region."
  type        = string
  default     = "ap-southeast-1"
}

# --- Networking (reference existing network; this scaffold does not build a VPC)
variable "vpc_id" {
  description = "Existing VPC id to deploy into. Ignored when create_vpc=true."
  type        = string
  default     = "" # set when bringing-your-own VPC (create_vpc=false)
}

variable "private_subnet_ids" {
  description = "Private subnet ids (must span >=2 AZs). Ignored when create_vpc=true."
  type        = list(string)
  default     = [] # set when bringing-your-own VPC (create_vpc=false)
}

# CHOS-502: let Terraform own a fresh multi-AZ VPC instead of consuming an
# existing one. Default false keeps every current environment on its passed-in
# vpc_id/private_subnet_ids unchanged.
variable "create_vpc" {
  description = "Create a managed multi-AZ VPC (infra/terraform/vpc.tf) instead of using vpc_id/private_subnet_ids."
  type        = bool
  default     = false
}

variable "availability_zones" {
  description = "AZs to spread the VPC across when create_vpc=true (>=3 recommended for prod)."
  type        = list(string)
  default     = [] # e.g. ["ap-southeast-1a","ap-southeast-1b","ap-southeast-1c"]
}

# --- Kubernetes cluster -------------------------------------------------------
variable "cluster_version" {
  description = "Kubernetes control-plane version."
  type        = string
  default     = "1.30"
}

variable "node_instance_types" {
  description = "Worker node instance types."
  type        = list(string)
  default     = ["t3.large"]
}

variable "node_min_size" {
  description = "Minimum worker node count."
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum worker node count."
  type        = number
  default     = 6
}

# --- Managed PostgreSQL -------------------------------------------------------
variable "db_instance_class" {
  description = "Managed Postgres instance class."
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Initial Postgres storage (GiB)."
  type        = number
  default     = 50
}

variable "db_engine_version" {
  description = "PostgreSQL engine version (match local/CI: 16)."
  type        = string
  default     = "16"
}

# --- Read replicas + PgBouncer (CHOS-301) ------------------------------------
variable "db_read_replica_count" {
  description = "Number of managed Postgres read replicas for the read path."
  type        = number
  default     = 2
}

variable "db_read_instance_class" {
  description = "Instance class for read replicas (often == primary)."
  type        = string
  default     = "db.t3.medium"
}

variable "pgbouncer_image" {
  description = "PgBouncer container image fronting the read replicas (txn pooling)."
  type        = string
  default     = "bitnami/pgbouncer:1.23.1"
}

variable "pgbouncer_replicas" {
  description = "PgBouncer Deployment replica count (HA)."
  type        = number
  default     = 2
}

variable "pgbouncer_namespace" {
  description = "Kubernetes namespace PgBouncer is deployed into."
  type        = string
  default     = "moeys"
}

# --- Managed Redis (cache, cluster mode — CHOS-302) ---------------------------
variable "redis_node_type" {
  description = "ElastiCache node type for the application cache Redis."
  type        = string
  default     = "cache.t3.small"
}

variable "redis_cache_shards" {
  description = "Number of shards (node groups) for the cluster-mode cache Redis."
  type        = number
  default     = 3
}

variable "redis_cache_replicas_per_shard" {
  description = "Read replicas per shard (intra-shard failover) in prod."
  type        = number
  default     = 1
}

variable "redis_cluster_parameter_group" {
  description = "Cluster-mode-enabled ElastiCache parameter group."
  type        = string
  default     = "default.redis7.cluster.on"
}

# --- Message broker (arq job queue, CHOS-202) ---------------------------------
# arq speaks the Redis protocol, so the broker is a SEPARATE Redis dedicated to
# the job queue (isolated from the cache so a queue backlog can't evict cache
# entries and vice-versa). Swap this resource if a non-Redis broker is adopted.
variable "broker_node_type" {
  description = "ElastiCache node type for the arq broker Redis."
  type        = string
  default     = "cache.t3.small"
}

variable "tags" {
  description = "Extra tags merged onto every resource."
  type        = map(string)
  default     = {}
}

# ── Cloudflare (CHOS-303) ────────────────────────────────────────────────────

variable "cloudflare_api_token" {
  description = "Cloudflare API token (Zone:Edit, Firewall Services:Edit, Cache Purge:Purge). From Vault."
  type        = string
  sensitive   = true
  default     = null  # Injected by Vault Agent at runtime; never in tfvars
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID (not sensitive — visible in dashboard URL)"
  type        = string
  default     = ""  # TODO(infra): set in terraform.tfvars
}

variable "cloudflare_zone_name" {
  description = "Primary DNS zone (e.g. moeys.gov.kh)"
  type        = string
  default     = ""  # TODO(infra): set in terraform.tfvars
}

variable "cf_origin_secret" {
  description = ">=32-char random secret shared between Cloudflare (origin rule) and Next.js middleware. From Vault."
  type        = string
  sensitive   = true
  default     = null
}

variable "bff_alb_dns" {
  description = "AWS ALB DNS name for the BFF (Next.js) service"
  type        = string
  default     = ""  # Exported from EKS/ALB Terraform, or set manually
}

variable "logs_s3_bucket" {
  description = "S3 bucket name for Cloudflare Logpush (security events + HTTP logs)"
  type        = string
  default     = ""  # TODO(infra): create bucket in s3.tf
}

variable "vpc_cidr" {
  description = "VPC CIDR block (for internal health check ingress rule)"
  type        = string
  default     = "10.0.0.0/16"
}

# NOTE: `environment` is already declared at the top of this file (no default,
# set per-env). A second declaration here would be a duplicate-variable error.

variable "enable_bot_management" {
  description = "Enable full Cloudflare Bot Management (Enterprise). Set false for Pro/Business (Super Bot Fight Mode only)."
  type        = bool
  default     = false
}