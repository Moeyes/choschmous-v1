# CHOS-303: Cloudflare edge (CDN + WAF/OWASP-CRS + DDoS/bot + origin lock).
#
# SEPARATE root module from the AWS platform (../) because it uses a different
# provider and is owned by a different credential. SCAFFOLD ONLY — `terraform
# apply` here touches the live Cloudflare zone and must NOT be run by CI. Fill the
# TODO(infra) placeholders, then run init/validate/plan manually.
#
# Written for the Cloudflare provider 4.x resource schema.

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.40"
    }
  }

  # TODO(infra): remote state with locking (separate key from the AWS module).
  # backend "s3" { ... key = "edge/cloudflare.tfstate" ... }
}
