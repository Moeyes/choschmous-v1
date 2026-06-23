# CHOS-205: outputs consumed by downstream wiring (Helm values, Vault DB config).
# Endpoints are not secret; credentials are never output.

output "cluster_name" {
  description = "EKS cluster name."
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint."
  value       = module.eks.cluster_endpoint
}

output "postgres_host" {
  description = "Managed Postgres host (feed into infra/vault DB secrets engine)."
  value       = aws_db_instance.postgres.address
}

output "postgres_port" {
  value = aws_db_instance.postgres.port
}

output "redis_cache_endpoint" {
  description = "Primary endpoint for the application cache Redis."
  value       = aws_elasticache_replication_group.cache.primary_endpoint_address
}

output "redis_broker_endpoint" {
  description = "Primary endpoint for the arq broker Redis (CHOS-202)."
  value       = aws_elasticache_replication_group.broker.primary_endpoint_address
}
