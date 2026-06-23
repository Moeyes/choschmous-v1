#!/usr/bin/env bash
# CHOS-201: bootstrap the MOEYS backend's STATIC secrets + AppRole login.
#
# Run ONCE by an operator with an admin Vault token, against the real cluster.
# This touches live Vault, so it is NOT run by CI.
#
# Prereqs (TODO(infra) — supply real values, never commit them):
#   export VAULT_ADDR=...                  # real Vault endpoint
#   export VAULT_TOKEN=...                 # admin token (or run `vault login`)
#   export JWT_SECRET_KEY=...              # >= 32 chars, strong + unique
#   export JWT_REFRESH_SECRET_KEY=...      # >= 32 chars, strong + unique, != above
#   export REDIS_URL=redis://:<pass>@<host>:6379/0
set -euo pipefail

: "${VAULT_ADDR:?set VAULT_ADDR}"
: "${VAULT_TOKEN:?set VAULT_TOKEN (or vault login)}"
: "${JWT_SECRET_KEY:?set JWT_SECRET_KEY}"
: "${JWT_REFRESH_SECRET_KEY:?set JWT_REFRESH_SECRET_KEY}"
: "${REDIS_URL:?set REDIS_URL}"

POLICY_DIR="$(cd "$(dirname "$0")/.." && pwd)/policies"

# 1. KV v2 for static app secrets (idempotent).
vault secrets enable -path=secret -version=2 kv 2>/dev/null || true

# 2. Write the static secrets. Values come from the operator's env, never git.
vault kv put secret/moeys/backend \
  jwt_secret_key="${JWT_SECRET_KEY}" \
  jwt_refresh_secret_key="${JWT_REFRESH_SECRET_KEY}" \
  redis_url="${REDIS_URL}"

# 3. Install the least-privilege policy.
vault policy write moeys-backend "${POLICY_DIR}/moeys-backend.hcl"

# 4. Enable AppRole and bind the role to the policy. Short token TTLs so a
#    leaked token expires quickly; the agent renews while alive.
vault auth enable approle 2>/dev/null || true
vault write auth/approle/role/moeys-backend \
  token_policies="moeys-backend" \
  token_ttl="1h" \
  token_max_ttl="4h" \
  secret_id_ttl="24h" \
  secret_id_num_uses=1

# 5. Output the role_id (safe to deliver to the deploy). The secret_id is
#    issued separately and delivered out-of-band (response-wrapped), NOT here.
echo "role_id:"
vault read -field=role_id auth/approle/role/moeys-backend/role-id
echo
echo "Next: issue a wrapped secret_id and deliver it to the Vault Agent:"
echo "  vault write -wrap-ttl=120s -f auth/approle/role/moeys-backend/secret-id"
