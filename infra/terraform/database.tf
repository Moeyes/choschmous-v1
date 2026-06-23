# CHOS-205: managed PostgreSQL (RDS).
#
# Note: the application never receives a static DB password — Vault mints dynamic
# credentials at runtime (CHOS-201, infra/vault). The master password created
# here is used only to bootstrap the Vault-admin DB role; it is generated and
# stored in Vault/Secrets Manager, never in tfvars or git (TODO(infra)).

resource "aws_db_subnet_group" "postgres" {
  name       = "${local.name}-pg"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "postgres" {
  name   = "${local.name}-pg"
  vpc_id = var.vpc_id

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
