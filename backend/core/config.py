from typing import List
from typing import Any

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Placeholder value shipped in source; must be overridden via the JWT_SECRET_KEY
# environment variable in any non-local environment.
_INSECURE_JWT_SECRETS = {"", "change-me", "change-me-too", "change-me-change-me-change-me-change-me", "change-me-too-change-me-too-change-me-too"}


class Settings(BaseSettings):
	"""Application configuration loaded from environment and `.env`.

	Attributes provide API prefixes, Sentry DSN, environment name, CORS origins,
	and JWT settings. Extra env vars are allowed to keep DB_* and other values
	available without breaking validation.
	"""
	PROJECT_NAME: str = "Backend"
	API_V1_STR: str = "/api"
	SENTRY_DSN: str | None = None
	ENVIRONMENT: str = "local"
	# Store raw origins as a plain string to avoid dotenv/json decoding issues.
	# Example: "http://localhost:3000,http://localhost:3002" or a JSON array.
	BACKEND_CORS_ORIGINS: str = ""
	JWT_SECRET_KEY: str = "change-me-change-me-change-me-change-me"
	JWT_REFRESH_SECRET_KEY: str = "change-me-too-change-me-too-change-me-too"
	JWT_ALGORITHM: str = "HS256"
	ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
	REFRESH_TOKEN_EXPIRE_DAYS: int = 14
	BCRYPT_ROUNDS: int = 13
	REDIS_URL: str = "redis://localhost:6379/0"

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
		if (
			self.ENVIRONMENT.lower() != "local"
			and key in _INSECURE_JWT_SECRETS
		):
			raise ValueError(
				"JWT_SECRET_KEY must be set to a strong, unique value in "
				f"non-local environments (ENVIRONMENT={self.ENVIRONMENT!r}). "
				"Refusing to start with the default placeholder secret."
			)
		if (
			self.ENVIRONMENT.lower() != "local"
			and refresh_key in _INSECURE_JWT_SECRETS
		):
			raise ValueError(
				"JWT_REFRESH_SECRET_KEY must be set to a strong, unique value in "
				f"non-local environments (ENVIRONMENT={self.ENVIRONMENT!r}). "
				"Refusing to start with the default placeholder secret."
			)
		return self

settings: Settings = Settings()
__all__ = ["Settings", "settings"]