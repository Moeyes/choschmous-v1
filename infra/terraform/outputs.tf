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

# CHOS-301: read path. Replica endpoints are informational; the app connects to
# the PgBouncer service (DATABASE_READ_URL), not the replicas directly.
output "postgres_replica_hosts" {
  description = "Read-replica hostnames (fronted by PgBouncer)."
  value       = aws_db_instance.postgres_replica[*].address
}

output "pgbouncer_service" {
  description = "In-cluster PgBouncer DNS for the read path (DATABASE_READ_URL host)."
  value       = "${kubernetes_service.pgbouncer.metadata[0].name}.${var.pgbouncer_namespace}.svc:6432"
}

output "redis_cache_configuration_endpoint" {
  description = "Cluster configuration endpoint for the cache Redis (CHOS-302). Feed into REDIS_URL with REDIS_CLUSTER=1."
  value       = aws_elasticache_replication_group.cache.configuration_endpoint_address
}

output "redis_broker_endpoint" {
  description = "Primary endpoint for the arq broker Redis (CHOS-202)."
  value       = aws_elasticache_replication_group.broker.primary_endpoint_address
}
