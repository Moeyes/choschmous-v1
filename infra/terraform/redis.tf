# CHOS-205: managed Redis instances.
#
# Two separate ElastiCache replication groups:
#   * cache  — application cache / rate limiting / idempotency / dashboard cache
#   * broker — the arq job queue (CHOS-202), isolated from the cache so a queue
#              backlog can never evict cache entries (and vice-versa).

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name}-redis"
  subnet_ids = local.private_subnet_ids # CHOS-502: multi-AZ for ElastiCache Multi-AZ
}

resource "aws_security_group" "redis" {
  name   = "${local.name}-redis"
  vpc_id = local.vpc_id

  # TODO(infra): restrict ingress to the EKS node security group only.
  ingress {
    description     = "Redis from cluster"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_elasticache_replication_group" "cache" {
  replication_group_id = "${local.name}-cache"
  description          = "Application cache / rate-limit / idempotency (CHOS-302 cluster)"
  engine               = "redis"
  node_type            = var.redis_node_type
  port                 = 6379

  # CHOS-302: cluster mode enabled — the app cache / rate-limit / idempotency run
  # against a 3-shard Redis Cluster. Set REDIS_CLUSTER=1 + REDIS_URL=<config
  # endpoint> on the app (the client discovers the other shards from the seed).
  parameter_group_name = var.redis_cluster_parameter_group
  num_node_groups      = var.redis_cache_shards
  # A replica per shard gives intra-shard failover; 0 outside prod to save cost.
  replicas_per_node_group   = var.environment == "prod" ? var.redis_cache_replicas_per_shard : 0
  automatic_failover_enabled = true
  multi_az_enabled           = var.environment == "prod"

  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  # TODO(infra): auth token (AUTH password) sourced from Vault/Secrets Manager.
}

resource "aws_elasticache_replication_group" "broker" {
  replication_group_id = "${local.name}-broker"
  description          = "arq job queue broker (CHOS-202)"
  engine               = "redis"
  node_type            = var.broker_node_type
  num_cache_clusters   = var.environment == "prod" ? 2 : 1
  port                 = 6379

  # CHOS-502: the broker is now multi-AZ in prod — a primary + replica in
  # separate AZs with automatic failover, so an AZ loss promotes the replica and
  # the arq queue keeps draining. Single-node (no failover) outside prod, where a
  # second node would just add cost. (The cache group above is already Multi-AZ.)
  automatic_failover_enabled = var.environment == "prod"
  multi_az_enabled           = var.environment == "prod"

  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  # TODO(infra): auth token (AUTH password) sourced from Vault/Secrets Manager.
}
