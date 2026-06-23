#!/usr/bin/env bash
# CHOS-201: configure Vault to mint DYNAMIC, short-lived Postgres credentials
# for the MOEYS backend, so no static DB password exists anywhere.
#
# Run ONCE by an operator with an admin Vault token, against the real cluster.
# This touches live Vault + Postgres, so it is NOT run by CI.
#
# Prereqs (TODO(infra) — supply real values, never commit them):
#   export VAULT_ADDR=...                # real Vault endpoint
#   export VAULT_TOKEN=...               # admin token (or `vault login`)
#   export PG_HOST=...                   # managed Postgres host (infra/terraform, CHOS-205)
#   export PG_VAULT_ADMIN_USER=...       # dedicated DB role Vault uses to CREATE ROLE
#   export PG_VAULT_ADMIN_PASS=...
set -euo pipefail

: "${VAULT_ADDR:?set VAULT_ADDR}"
: "${VAULT_TOKEN:?set VAULT_TOKEN (or vault login)}"
: "${PG_HOST:?set PG_HOST (managed Postgres host)}"
: "${PG_VAULT_ADMIN_USER:?set PG_VAULT_ADMIN_USER}"
: "${PG_VAULT_ADMIN_PASS:?set PG_VAULT_ADMIN_PASS}"

# 1. Enable the database secrets engine (idempotent).
vault secrets enable -path=database database 2>/dev/null || true

# 2. Point Vault at Postgres using a dedicated high-privilege "vault admin" DB
#    role (NOT the app role) that can CREATE ROLE. TLS is required.
vault write database/config/moeys-postgres \
  plugin_name=postgresql-database-plugin \
  allowed_roles="moeys-backend" \
  connection_url="postgresql://{{username}}:{{password}}@${PG_HOST}:5432/moeys?sslmode=require" \
  username="${PG_VAULT_ADMIN_USER}" \
  password="${PG_VAULT_ADMIN_PASS}"

# 3. Define the dynamic role: each read of database/creds/moeys-backend mints a
#    fresh login with exactly the app's grants, auto-revoked after the TTL.
vault write database/roles/moeys-backend \
  db_name=moeys-postgres \
  creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; \
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO \"{{name}}\";" \
  revocation_statements="DROP ROLE IF EXISTS \"{{name}}\";" \
  default_ttl="1h" \
  max_ttl="24h"

echo "Dynamic DB role ready. Test with: vault read database/creds/moeys-backend"
