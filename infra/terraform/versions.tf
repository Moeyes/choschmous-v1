# CHOS-205: Terraform provider + backend pinning for the MOEYS platform.
#
# SCAFFOLD ONLY — `terraform apply` provisions live cloud infra and must NOT be
# run by CI or by this change. Run `terraform init && terraform validate` (and
# `plan`) manually once the TODO(infra) placeholders below are filled in.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }

  # TODO(infra): remote state with locking. Replace bucket/table/region with the
  # real values and uncomment. Keep state OUT of git.
  # backend "s3" {
  #   bucket         = "moeys-tfstate"
  #   key            = "platform/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   dynamodb_table = "moeys-tflock"
  #   encrypt        = true
  # }
}
