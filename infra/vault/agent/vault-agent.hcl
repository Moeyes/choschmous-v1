# Vault Agent configuration for the MOEYS backend (CHOS-201).
#
# The agent authenticates to Vault with AppRole (no static token), then renders
# templates/backend.env.ctmpl to /vault/secrets/backend.env. The backend
# container sources that file before launching uvicorn (docker-compose.vault.yml).
#
# TODO(infra): no token is — or should be — hard-coded here. role_id/secret_id
# are mounted at deploy time and never committed.

pid_file = "/vault/agent/pidfile"

vault {
  # TODO(infra): replace with the real cluster Vault endpoint, e.g.
  # "https://vault.internal.gov.kh:8200". Overridable via the VAULT_ADDR env var
  # on the vault-agent service.
  address = "https://vault.example.internal:8200"

  retry {
    num_retries = 5
  }
}

auto_auth {
  method "approle" {
    mount_path = "auth/approle"

    config = {
      # TODO(infra): mount real, tightly-permissioned files. The role_id is
      # provided at deploy time; the secret_id is delivered via a
      # response-wrapped token or a short-TTL secret. NEVER commit these.
      role_id_file_path                   = "/vault/agent/role-id"
      secret_id_file_path                 = "/vault/agent/secret-id"
      remove_secret_id_file_after_reading = true
    }
  }

  sink "file" {
    config = {
      path = "/vault/agent/token"
    }
  }
}

# Render the backend env file from Vault secrets. perms 0640 so only the agent
# (and the backend, via shared group) can read it.
template {
  source      = "/vault/templates/backend.env.ctmpl"
  destination = "/vault/secrets/backend.env"
  perms       = "0640"
}

# Fail fast on startup if Vault is unreachable or auth fails, rather than
# rendering a stale/empty env file and letting the backend boot mis-configured.
template_config {
  exit_on_retry_failure = true
}
