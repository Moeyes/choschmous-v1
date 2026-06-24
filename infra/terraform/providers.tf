# CHOS-205: provider configuration. Credentials come from the environment
# (e.g. AWS_PROFILE / IRSA / OIDC), never from committed values.

provider "aws" {
  region = var.region

  api_token = var.cloudflare_api_token

  default_tags {
    tags = merge(
      {
        Project     = var.project
        Environment = var.environment
        ManagedBy   = "terraform"
      },
      var.tags,
    )
  }
}

locals {
  name = "${var.project}-${var.environment}"
}
