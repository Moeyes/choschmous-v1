# CHOS-502: multi-AZ network foundation.
#
# Spreads the cluster + data stores across >=3 Availability Zones so the loss of a
# single AZ cannot take the system down (RDS Multi-AZ, ElastiCache Multi-AZ, and
# EKS node groups all consume the per-AZ private subnets created here).
#
# Optional by design: `create_vpc` defaults false, so existing environments that
# already pass `vpc_id` / `private_subnet_ids` are unchanged (module count 0 →
# the locals below resolve straight to those vars). Set `create_vpc = true` +
# `availability_zones = [...]` to have Terraform own a fresh multi-AZ VPC.
#
# The module is pinned and fetched by `terraform init` (not run here).

module "vpc" {
  count   = var.create_vpc ? 1 : 0
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${local.name}-vpc"
  cidr = var.vpc_cidr
  azs  = var.availability_zones

  # One private + one public subnet per AZ. /20 private, /20 public carved from
  # the VPC /16 — plenty of address space per AZ for nodes + data stores.
  private_subnets = [
    for i in range(length(var.availability_zones)) : cidrsubnet(var.vpc_cidr, 4, i)
  ]
  public_subnets = [
    for i in range(length(var.availability_zones)) : cidrsubnet(var.vpc_cidr, 4, i + 8)
  ]

  # AZ-independent egress: one NAT gateway PER AZ in prod (a single NAT would make
  # all private subnets depend on one AZ, defeating the point). Single NAT
  # elsewhere to save cost.
  enable_nat_gateway     = true
  single_nat_gateway     = var.environment != "prod"
  one_nat_gateway_per_az = var.environment == "prod"

  enable_dns_hostnames = true
  enable_dns_support   = true

  # Subnet tags the AWS Load Balancer Controller + EKS rely on for AZ-aware
  # placement of internal/internet-facing LBs.
  private_subnet_tags = { "kubernetes.io/role/internal-elb" = "1" }
  public_subnet_tags  = { "kubernetes.io/role/elb" = "1" }

  tags = var.tags
}

# Network selection: managed VPC when create_vpc, otherwise the passed-in ids.
# one(<splat>) is empty-list-safe (returns null when the module has count 0), so
# the disabled branch never indexes a non-existent module instance.
locals {
  vpc_id = var.create_vpc ? one(module.vpc[*].vpc_id) : var.vpc_id
  private_subnet_ids = (
    var.create_vpc ? one(module.vpc[*].private_subnets) : var.private_subnet_ids
  )
  # AZ count actually backing the system — asserted >=2 by the check below.
  az_count = var.create_vpc ? length(var.availability_zones) : length(var.private_subnet_ids)
}

# Guardrail: refuse to plan a single-AZ topology for a system that claims HA.
check "multi_az_minimum" {
  assert {
    condition     = local.az_count >= 2
    error_message = "CHOS-502 requires >=2 AZs (>=3 recommended); got ${local.az_count}."
  }
}
