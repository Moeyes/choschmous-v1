from typing import List
from typing import Any

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Known-bad JWT secret values. As of CHOS-201 the secrets carry NO in-source
# default (they are required env injection — see Settings below), but these
# historically-shipped / obviously-placeholder values are still rejected so a
# copied-but-unedited config can never silently boot a non-local environment.
_INSECURE_JWT_SECRETS = {
    "",
    "change-me",
    "change-me-too",
    "change-me-change-me-change-me-change-me",
    "change-me-too-change-me-too-change-me-too",
    # Known-compromised dev secret: it was committed to git via
    # backend/.env.example (commit 53f27a3) and is >=32 chars, so without this
    # entry it would silently pass the length + placeholder guards. Block it so
    # any non-local environment that reuses it refuses to start.
    "dev-secret-aB3xK9mP2qR7nL5wT8vY1cF4hJ6kD0sG",
    # New obvious placeholder shipped in backend/.env.example after scrubbing the
    # value above — reject it too so a copied-but-unedited .env fails fast.
    "REPLACE_ME_WITH_A_32_CHAR_RANDOM_SECRET",
}

# The app signs/verifies with a shared secret (HMAC). Restrict JWT_ALGORITHM to
# the symmetric HS family so a misconfiguration can never select "none"
# (unsigned tokens) or an asymmetric alg whose verification semantics would not
# match how tokens are signed here.
_ALLOWED_JWT_ALGORITHMS = {"HS256", "HS384", "HS512"}


class Settings(BaseSettings):
    """Application configuration loaded from environment and `.env`.

    Attributes provide API prefixes, Sentry DSN, environment name, CORS origins,
    and JWT settings. Extra env vars are allowed to keep DB_* and other values
    available without breaking validation.
    """

    PROJECT_NAME: str = "Backend"
    # CHOS-203: the canonical API prefix is now versioned. Legacy /api/* requests
    # are 307-redirected to /api/v1/* by the backward-compat router mounted in
    # src/api/main.py, so existing clients keep working during the migration.
    API_V1_STR: str = "/api/v1"
    SENTRY_DSN: str | None = None
    ENVIRONMENT: str = "local"
    # Store raw origins as a plain string to avoid dotenv/json decoding issues.
    # Example: "http://localhost:3000,http://localhost:3002" or a JSON array.
    BACKEND_CORS_ORIGINS: str = ""
    # CHOS-201: these carry no in-source default — they are REQUIRED and must be
    # injected from the environment (a Vault Agent-rendered env file in prod; see
    # infra/vault/). With no default, instantiating Settings() raises if any are
    # missing, so the app refuses to boot without real secrets rather than
    # silently running on a placeholder. The validator below still enforces
    # strength/placeholder rules on whatever value is injected.
    JWT_SECRET_KEY: str
    JWT_REFRESH_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    BCRYPT_ROUNDS: int = 13
    # Required (no default): the connection target for rate limiting / idempotency
    # / dashboard cache must be configured explicitly, not assumed to be localhost.
    REDIS_URL: str
    # CHOS-302: run against a Redis Cluster (3 shards) instead of a single node.
    # When true, redis_client builds a RedisCluster that discovers every shard
    # from the seed REDIS_URL. Off in local dev (single Redis). The seed URL may
    # point at any one shard; the client learns the rest of the topology.
    REDIS_CLUSTER: bool = False
    # Search (CHOS-304). "db" (default) runs ILIKE queries straight against
    # Postgres — always available, no extra infra. "opensearch" uses a managed
    # OpenSearch cluster for scale/typo-tolerance; it falls back to "db" if the
    # URL is unset or opensearch-py is missing.
    # TODO(infra): provision OpenSearch + inject OPENSEARCH_* (creds from Vault).
    SEARCH_BACKEND: str = "db"
    OPENSEARCH_URL: str | None = None
    OPENSEARCH_INDEX_PREFIX: str = "moeys"
    OPENSEARCH_USERNAME: str | None = None
    OPENSEARCH_PASSWORD: str | None = None
    # Build-time guard (CHOS-102): the destructive maintenance routes
    # (/maintenance/sync-schema, /maintenance/drop) are excluded from the prod
    # image unless this is explicitly enabled. Always available in local dev.
    ENABLE_MAINTENANCE: bool = False
    # Observability (CHOS-105): expose Prometheus metrics at /metrics when the
    # optional instrumentator package is installed. No-op if it is absent.
    ENABLE_METRICS: bool = True
    # Observability (CHOS-204): OpenTelemetry distributed tracing. Disabled by
    # default so neither local dev nor CI needs a collector. Enable with
    # OTEL_ENABLED=1 and point OTEL_EXPORTER_OTLP_ENDPOINT at the OTLP/HTTP
    # collector or Tempo (e.g. http://tempo:4318). Spans are correlated to the
    # request id / error id; see core/observability.py.
    # TODO(CHOS-204 / infra): inject OTEL_EXPORTER_OTLP_ENDPOINT in deployed envs.
    OTEL_ENABLED: bool = False
    OTEL_EXPORTER_OTLP_ENDPOINT: str | None = None
    OTEL_SERVICE_NAME: str = "moeys-api"
    # Emit structured (JSON) logs carrying request_id + trace_id/span_id so logs
    # correlate with traces in Loki/Tempo (CHOS-204). Set LOG_JSON=0 for plain
    # human-readable logs in local dev.
    LOG_JSON: bool = True

    # ── Multi-factor authentication (CHOS-401) ──────────────────────────────
    # Issuer label shown in the authenticator app (the "Account" prefix in the
    # otpauth:// provisioning URI / QR code).
    MFA_ISSUER: str = "MoEYS Sports"
    # Roles for which a second factor is offered/enforced. Privileged roles only —
    # plain ORGANIZATION users are out of scope.
    MFA_REQUIRED_ROLES: str = "super_admin,admin,federation"
    # When True, a user in a required role who has NOT enrolled a second factor is
    # blocked from completing login until they enrol (hard enforcement). Default
    # False so enrolment is opt-in and pre-existing accounts are never locked out;
    # an enrolled user is ALWAYS challenged regardless of this flag.
    # TODO(ops): flip MFA_ENFORCED=1 in the government production environment once
    # all privileged operators have enrolled.
    MFA_ENFORCED: bool = False
    # Lifetime of the short-lived "password verified, awaiting second factor"
    # token returned by /auth/login and consumed by /auth/mfa/verify.
    MFA_CHALLENGE_EXPIRE_MINUTES: int = 5
    # Relying-Party id/name for WebAuthn (the registrable domain). Defaults are
    # dev-only; set WEBAUTHN_RP_ID to the public host in deployed envs.
    # TODO(infra): set WEBAUTHN_RP_ID / WEBAUTHN_RP_ORIGIN to the production host.
    WEBAUTHN_RP_ID: str = "localhost"
    WEBAUTHN_RP_NAME: str = "MoEYS Sports"
    WEBAUTHN_RP_ORIGIN: str = "http://localhost:3003"

    # ── OIDC login for a government IdP (CHOS-401) ──────────────────────────
    # Authorization-code + PKCE flow against the national IdP. All fields are
    # optional: when OIDC_CLIENT_ID / OIDC_DISCOVERY_URL are unset the OIDC routes
    # return 503 (feature disabled) and password+MFA login is unaffected.
    # TODO(infra/IdP): register this app with the government IdP and inject
    # OIDC_CLIENT_ID / OIDC_CLIENT_SECRET (Vault) + OIDC_DISCOVERY_URL.
    OIDC_ENABLED: bool = False
    OIDC_DISCOVERY_URL: str | None = None
    OIDC_CLIENT_ID: str | None = None
    OIDC_CLIENT_SECRET: str | None = None
    OIDC_REDIRECT_URI: str | None = None
    # Comma-separated scopes; "openid" is mandatory and always included.
    OIDC_SCOPES: str = "openid,email,profile"

    # ── Field-level PII encryption (CHOS-403) ───────────────────────────────
    # Envelope encryption of national-id / phone at rest. Provider "local" uses
    # an in-process KEK (dev/offline); "aws" uses AWS KMS (TODO: needs boto3 +
    # creds). PII_ENCRYPTION_KEY is the base64 KEK for the local provider; it is
    # REQUIRED in non-local environments (no silent dev-key fallback) and should
    # be Vault-injected. PII_KMS_KEY_ID is the AWS KMS key id for the aws provider.
    # TODO(infra/CHOS-403): inject PII_ENCRYPTION_KEY (or KMS key id + IAM creds).
    PII_KMS_PROVIDER: str = "local"
    PII_ENCRYPTION_KEY: str | None = None
    PII_KMS_KEY_ID: str | None = None

    # ── Audit log → SIEM shipping (CHOS-403) ────────────────────────────────
    # Each append to the hash-chained audit_log is mirrored to the SIEM. Disabled
    # by default (local/CI); enable + point at the collector in deployed envs.
    # TODO(infra/CHOS-403): provision the SIEM HTTP collector and inject
    # AUDIT_SIEM_ENDPOINT + AUDIT_SIEM_TOKEN (Vault).
    AUDIT_SIEM_ENABLED: bool = False
    AUDIT_SIEM_ENDPOINT: str | None = None
    AUDIT_SIEM_TOKEN: str | None = None

    # ── Transactional email (CHOS-406) ──────────────────────────────────────
    # The email worker (app/workers/email) sends registration-confirmation and
    # review-outcome messages. Disabled by default (local/CI): with EMAIL_ENABLED
    # off the sender is a no-op that only logs, so nothing leaves the box and the
    # tests need no SMTP server. Turn it on + provide SMTP creds in deployed envs.
    # TODO(infra/CHOS-406): provision the SMTP relay (or SES) and inject
    # SMTP_HOST/PORT/USERNAME/PASSWORD (Vault). EMAIL_FROM is the From: address.
    EMAIL_ENABLED: bool = False
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_USE_TLS: bool = True
    EMAIL_FROM: str = "no-reply@moeys.gov.kh"
    EMAIL_FROM_NAME: str = "MoEYS Sports Registration"
    # Absolute base URL used to build deep links in emails/notifications (e.g.
    # the review page). Falls back to a relative path when unset.
    PUBLIC_APP_URL: str | None = None

    @property
    def mfa_required_roles(self) -> set[str]:
        return {
            r.strip().lower() for r in self.MFA_REQUIRED_ROLES.split(",") if r.strip()
        }

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="allow",  # allow unrelated env vars like DB_* already used elsewhere
    )

    @property
    def all_cors_origins(self) -> List[str]:
        """Return a list of origins.

        Handles multiple formats safely:
        - empty string -> []
        - comma-separated string -> split by comma
        - JSON array string -> parsed via json.loads
        - already a list (rare) -> returned as-is
        """
        raw: Any = self.BACKEND_CORS_ORIGINS
        # If already a list, normalize and return
        if isinstance(raw, list):
            return [str(x).strip() for x in raw if str(x).strip()]

        if not isinstance(raw, str):
            return []

        val = raw.strip()
        if not val:
            return []

        # Try JSON array first
        try:
            import json

            parsed = json.loads(val)
            if isinstance(parsed, list):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            pass

        # Fallback to comma-separated
        return [origin.strip() for origin in val.split(",") if origin.strip()]

    @model_validator(mode="after")
    def _require_secure_jwt_secrets(self) -> "Settings":
        if self.JWT_ALGORITHM not in _ALLOWED_JWT_ALGORITHMS:
            raise ValueError(
                f"JWT_ALGORITHM must be one of {sorted(_ALLOWED_JWT_ALGORITHMS)} "
                f"(got {self.JWT_ALGORITHM!r}). Refusing to start with an "
                "unsupported or unsafe signing algorithm."
            )
        key = self.JWT_SECRET_KEY.strip()
        refresh_key = self.JWT_REFRESH_SECRET_KEY.strip()
        if len(key) < 32:
            raise ValueError(
                f"JWT_SECRET_KEY must be at least 32 characters (got {len(key)}). "
                "Refusing to start with a weak secret."
            )
        if len(refresh_key) < 32:
            raise ValueError(
                f"JWT_REFRESH_SECRET_KEY must be at least 32 characters (got {len(refresh_key)}). "
                "Refusing to start with a weak secret."
            )
        if self.ENVIRONMENT.lower() != "local" and key in _INSECURE_JWT_SECRETS:
            raise ValueError(
                "JWT_SECRET_KEY must be set to a strong, unique value in "
                f"non-local environments (ENVIRONMENT={self.ENVIRONMENT!r}). "
                "Refusing to start with the default placeholder secret."
            )
        if self.ENVIRONMENT.lower() != "local" and refresh_key in _INSECURE_JWT_SECRETS:
            raise ValueError(
                "JWT_REFRESH_SECRET_KEY must be set to a strong, unique value in "
                f"non-local environments (ENVIRONMENT={self.ENVIRONMENT!r}). "
                "Refusing to start with the default placeholder secret."
            )
        return self


settings: Settings = Settings()
__all__ = ["Settings", "settings"]
