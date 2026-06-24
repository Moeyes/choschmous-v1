# ─────────────────────────────────────────────────────────────────────────────
# ALB Security Group: restrict HTTPS ingress to Cloudflare IPs only.
# CHOS-303: origin must only be reachable through Cloudflare.
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_security_group" "alb_bff" {
  name        = "${local.name}-alb-bff"
  description = "BFF ALB — HTTPS ingress from Cloudflare IPs only (CHOS-303)"
  vpc_id      = var.vpc_id

  # HTTPS from Cloudflare IPv4 ranges
  dynamic "ingress" {
    for_each = data.cloudflare_ip_ranges.cf.ipv4_cidr_blocks
    content {
      description = "Cloudflare IPv4 → BFF"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  # HTTPS from Cloudflare IPv6 ranges
  dynamic "ingress" {
    for_each = data.cloudflare_ip_ranges.cf.ipv6_cidr_blocks
    content {
      description      = "Cloudflare IPv6 → BFF"
      from_port        = 443
      to_port          = 443
      protocol         = "tcp"
      ipv6_cidr_blocks = [ingress.value]
    }
  }

  # HTTP (port 80) from Cloudflare — Cloudflare always upgrades to HTTPS
  # but origin must respond on 80 for the redirect to work during CF SSL handshake.
  # Remove this if Cloudflare is set to Full (Strict) and origin has a valid cert.
  dynamic "ingress" {
    for_each = data.cloudflare_ip_ranges.cf.ipv4_cidr_blocks
    content {
      description = "Cloudflare IPv4 HTTP → BFF (redirect)"
      from_port   = 80
      to_port     = 80
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  # Internal VPC traffic (health checks from EKS nodes, internal ALB target checks)
  ingress {
    description = "Internal VPC health checks"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    description = "All outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "${local.name}-alb-bff"
    Environment = var.environment
    ManagedBy   = "terraform"
    Ticket      = "CHOS-303"
  }
}