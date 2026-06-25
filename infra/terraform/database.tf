# CHOS-205: managed PostgreSQL (RDS).
#
# Note: the application never receives a static DB password — Vault mints dynamic
# credentials at runtime (CHOS-201, infra/vault). The master password created
# here is used only to bootstrap the Vault-admin DB role; it is generated and
# stored in Vault/Secrets Manager, never in tfvars or git (TODO(infra)).

resource "aws_db_subnet_group" "postgres" {
  name       = "${local.name}-pg"
  subnet_ids = local.private_subnet_ids # CHOS-502: multi-AZ for RDS Multi-AZ failover
}

resource "aws_security_group" "postgres" {
  name   = "${local.name}-pg"
  vpc_id = local.vpc_id

  # TODO(infra): restrict ingress to the EKS node security group only.
  ingress {
    description = "Postgres from cluster"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "postgres" {
  identifier     = "${local.name}-pg"
  engine         = "postgres"
  engine_version = var.db_engine_version
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 4
  storage_encrypted     = true

  db_name  = "moeys"
  username = "moeys_admin"
  # TODO(infra): inject from Secrets Manager / a generated secret — never set a
  # literal password in tfvars. `manage_master_user_password` hands the master
  # secret to AWS Secrets Manager so no plaintext password exists in state.
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.postgres.name
  vpc_security_group_ids = [aws_security_group.postgres.id]

  multi_az                = var.environment == "prod"
  backup_retention_period = var.environment == "prod" ? 30 : 7
  deletion_protection     = var.environment == "prod"
  skip_final_snapshot     = var.environment != "prod"
}

# CHOS-301: read replicas. The app splits read/write sessions — dashboards,
# reports and list/search reads are served from these replicas (via PgBouncer,
# below) so heavy read traffic never competes with writes on the primary.
#
# Replicas stream from the primary asynchronously, so they lag slightly: the app
# only routes READ-ONLY handlers here (see core/database.py get_read_db); any
# read-after-write path stays on the primary.
resource "aws_db_instance" "postgres_replica" {
  count = var.db_read_replica_count

  identifier          = "${local.name}-pg-ro-${count.index + 1}"
  replicate_source_db = aws_db_instance.postgres.identifier
  instance_class      = var.db_read_instance_class

  vpc_security_group_ids = [aws_security_group.postgres.id]
  storage_encrypted      = true

  # A replica is not its own backup source of truth (the primary is) and is
  # disposable, so no backups / final snapshot / deletion protection here.
  backup_retention_period = 0
  multi_az                = false
  deletion_protection     = false
  skip_final_snapshot     = true

  # Avoid an apply blocking on a maintenance window outside prod.
  apply_immediately = var.environment != "prod"

  tags = { Role = "read-replica" }
}
