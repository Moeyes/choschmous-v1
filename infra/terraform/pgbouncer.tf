# CHOS-301: PgBouncer — connection pooler (TRANSACTION pooling) in front of the
# Postgres read replicas. The app's read path (core/database.py get_read_db)
# connects here instead of straight to a replica, so thousands of short-lived
# read connections collapse onto a small, warm server-side pool.
#
# SCAFFOLD ONLY — not applied by CI. Filling the TODO(infra) placeholders +
# `terraform apply` provisions live infra.
#
# IMPORTANT (asyncpg + txn pooling): server-side prepared statements are NOT
# supported in transaction pooling mode. The read engine therefore sets
# `statement_cache_size=0` (see core/database.py) — keep these two in lockstep.

# --- Kubernetes provider wired to the EKS cluster created in cluster.tf --------
data "aws_eks_cluster_auth" "this" {
  name = module.eks.cluster_name
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.this.token
}

locals {
  # Round-robin / failover across every read replica. PgBouncer 1.23 accepts a
  # comma-separated host list and spreads new server connections across them.
  pgbouncer_replica_hosts = join(",", aws_db_instance.postgres_replica[*].address)

  pgbouncer_ini = <<-EOT
    [databases]
    moeys = host=${local.pgbouncer_replica_hosts} port=5432 dbname=moeys

    [pgbouncer]
    listen_addr = 0.0.0.0
    listen_port = 6432
    # Transaction pooling: a server connection is returned to the pool at the end
    # of every transaction — maximal reuse for the read workload.
    pool_mode = transaction
    max_client_conn = 5000
    default_pool_size = 25
    min_pool_size = 5
    reserve_pool_size = 5
    server_tls_sslmode = require
    # TODO(infra): auth_type=scram-sha-256 with an auth_query (or a Vault-rendered
    # auth_file). Credentials are the Vault-minted dynamic DB role (CHOS-201) — a
    # read-only Postgres user — never a static password baked into this config.
    auth_type = scram-sha-256
    auth_file = /etc/pgbouncer/userlist.txt
    ignore_startup_parameters = extra_float_digits
  EOT
}

resource "kubernetes_config_map" "pgbouncer" {
  metadata {
    name      = "pgbouncer-config"
    namespace = var.pgbouncer_namespace
  }
  data = {
    "pgbouncer.ini" = local.pgbouncer_ini
  }
}

resource "kubernetes_deployment" "pgbouncer" {
  metadata {
    name      = "pgbouncer"
    namespace = var.pgbouncer_namespace
    labels    = { app = "pgbouncer" }
  }

  spec {
    replicas = var.pgbouncer_replicas

    selector {
      match_labels = { app = "pgbouncer" }
    }

    template {
      metadata {
        labels = { app = "pgbouncer" }
      }

      spec {
        container {
          name  = "pgbouncer"
          image = var.pgbouncer_image

          port {
            container_port = 6432
            name           = "pgbouncer"
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/pgbouncer"
          }

          # TODO(infra): a Vault Agent sidecar (CHOS-201) renders the read-only DB
          # credentials into /etc/pgbouncer/userlist.txt. The pooler reloads on
          # change; no static secret is ever committed here.

          resources {
            requests = { cpu = "50m", memory = "64Mi" }
            limits   = { cpu = "250m", memory = "128Mi" }
          }
        }

        volume {
          name = "config"
          config_map {
            name = kubernetes_config_map.pgbouncer.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "pgbouncer" {
  metadata {
    name      = "pgbouncer"
    namespace = var.pgbouncer_namespace
    labels    = { app = "pgbouncer" }
  }
  spec {
    selector = { app = "pgbouncer" }
    port {
      port        = 6432
      target_port = 6432
    }
    # ClusterIP: the read path is reached only from inside the cluster. The app
    # sets DATABASE_READ_URL=postgresql+asyncpg://.../moeys at
    # pgbouncer.<ns>.svc:6432 (see core/database.py).
    type = "ClusterIP"
  }
}
