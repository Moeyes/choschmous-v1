# CHOS-205: Kubernetes cluster (EKS) via the community module.
#
# Uses terraform-aws-modules so the scaffold stays concise and idiomatic; the
# module is pinned and downloaded by `terraform init` (not run here). All
# sizing/networking comes from variables — nothing environment-specific is baked.

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.0"

  cluster_name    = local.name
  cluster_version = var.cluster_version

  vpc_id     = var.vpc_id
  subnet_ids = var.private_subnet_ids

  # Private API endpoint by default; expose publicly only with an explicit,
  # reviewed change (this is a government system).
  cluster_endpoint_public_access  = false
  cluster_endpoint_private_access = true

  eks_managed_node_groups = {
    default = {
      instance_types = var.node_instance_types
      min_size       = var.node_min_size
      max_size       = var.node_max_size
      desired_size   = var.node_min_size
    }
  }
}
