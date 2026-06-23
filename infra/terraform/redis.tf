# CHOS-205: managed Redis instances.
#
# Two separate ElastiCache replication groups:
#   * cache  — application cache / rate limiting / idempotency / dashboard cache
#   * broker — the arq job queue (CHOS-202), isolated from the cache so a queue
#              backlog can never evict cache entries (and vice-versa).

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name}-redis"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "redis" {
  name   = "${local.name}-redis"
  vpc_id = var.vpc_id

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
  description          = "Application cache / rate-limit / idempotency"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_clusters   = var.environment == "prod" ? 2 : 1
  port                 = 6379

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

  subnet_group_name          = aws_elasticache_subnet_group.redis.name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  # TODO(infra): auth token (AUTH password) sourced from Vault/Secrets Manager.
}
