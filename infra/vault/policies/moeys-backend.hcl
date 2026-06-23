# Vault policy for the MOEYS backend (CHOS-201).
#
# Least privilege: the backend may read ONLY its own static app secrets and mint
# its own dynamic Postgres credentials. It cannot list, write, or read anything
# else. Apply with:
#   vault policy write moeys-backend policies/moeys-backend.hcl

# --- Static application secrets (KV v2) ---------------------------------------
# JWT signing keys + Redis URL. KV v2 nests reads under data/ and metadata/.
path "secret/data/moeys/backend" {
  capabilities = ["read"]
}
path "secret/metadata/moeys/backend" {
  capabilities = ["read"]
}

# --- Dynamic database credentials --------------------------------------------
# Each read mints a fresh, expiring Postgres login (see
# config/02-database-secrets-engine.sh). No static DB password ever exists.
path "database/creds/moeys-backend" {
  capabilities = ["read"]
}

# --- Lease + token self-management -------------------------------------------
# Let the agent renew/revoke the leases it owns and renew its own token, so
# long-running processes keep valid credentials without a static secret.
path "sys/leases/renew" {
  capabilities = ["update"]
}
path "sys/leases/revoke" {
  capabilities = ["update"]
}
path "auth/token/renew-self" {
  capabilities = ["update"]
}
path "auth/token/lookup-self" {
  capabilities = ["read"]
}
