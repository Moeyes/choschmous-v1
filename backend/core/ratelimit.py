import asyncio
import logging
import time
from collections import defaultdict
from typing import Optional

from fastapi import HTTPException, Request, Response
from redis.exceptions import RedisError

from core.redis_client import get_redis, inmemory_fallback_enabled

logger = logging.getLogger(__name__)

# Throttle the "Redis unavailable" warning so an outage doesn't flood the logs.
_REDIS_WARN_INTERVAL = 30.0
_last_redis_warn = 0.0


def _warn_redis_unavailable(exc: Exception) -> None:
    global _last_redis_warn
    now = time.monotonic()
    if now - _last_redis_warn >= _REDIS_WARN_INTERVAL:
        _last_redis_warn = now
        logger.warning(
            "Redis unavailable for rate limiting — degrading to in-memory limiter "
            "(per-process; weaker under multiple workers): %s",
            exc,
        )


class RateLimiter:
    """True sliding-window rate limiter with per-user key support.

    Redis implementation uses a sorted set per key (ZADD timestamps,
    ZREMRANGEBYSCORE to expire old entries, ZCOUNT for the window count).
    Falls back to an in-memory per-process list when Redis is unavailable
    (acceptable for dev; degrades under multi-worker deployments).

    Returns rate-limit metadata as a tuple (limit, remaining, reset_epoch)
    so callers can attach ``X-RateLimit-*`` response headers.
    """

    def __init__(
        self,
        max_requests: int = 5,
        window_seconds: int = 60,
        burst_multiplier: float = 1.0,
        prefix: str = "rl",
    ):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        # When burst is allowed the effective limit is ``max_requests * burst_multiplier``
        # for the first ``window_seconds // 4`` portion of the window.
        self.burst_limit = int(max_requests * burst_multiplier)
        self.prefix = prefix
        self._fallback: dict[str, list[float]] = defaultdict(list)
        self._last_cleanup = 0.0

    def _key(self, client_ip: str, suffix: Optional[str] = None) -> str:
        parts = [self.prefix, client_ip]
        if suffix:
            parts.append(suffix)
        return ":".join(parts)

    async def check(
        self,
        request: Request,
        key_suffix: Optional[str] = None,
        response: Optional[Response] = None,
    ) -> tuple[int, int, int]:
        """Evaluate the current request against the rate limit.

        Returns ``(limit, remaining, reset_epoch)``.

        * ``limit`` — the maximum requests allowed in the window.
        * ``remaining`` — how many of those remain (may be negative if over).
        * ``reset_epoch`` — Unix timestamp when the window resets.

        When ``key_suffix`` is provided (e.g. the authenticated user's id) the
        limiter keys on that value **instead of** the client IP. For auth-optional
        endpoints pass ``None`` to fall back to IP-only.

        Raises ``HTTPException(429)`` if the limit is exceeded.
        """
        client_ip = request.client.host if request.client else "unknown"
        key = self._key(client_ip, key_suffix)

        # Try Redis (shared, accurate across workers). A 429 (HTTPException) from
        # the Redis path is a real limit hit and must propagate unchanged.
        #
        # On a Redis outage the behaviour depends on the environment (CHOS-302):
        #   * local  → degrade to the per-process in-memory limiter so dev keeps
        #     working without Redis.
        #   * else   → fail CLOSED with 503. The per-process limiter is useless
        #     across many workers, so silently degrading to it would drop the
        #     control; in a Redis-Cluster deployment an outage is the rare case we
        #     would rather surface than quietly run unprotected.
        fallback_ok = inmemory_fallback_enabled()
        try:
            redis = await get_redis()
            if redis is not None:
                return await self._check_redis(redis, key, response)
            if not fallback_ok:
                raise HTTPException(
                    status_code=503,
                    detail="Rate limiting is temporarily unavailable. Please retry shortly.",
                )
        except HTTPException:
            raise
        except (RedisError, ConnectionError, OSError, asyncio.TimeoutError) as exc:
            _warn_redis_unavailable(exc)
            if not fallback_ok:
                raise HTTPException(
                    status_code=503,
                    detail="Rate limiting is temporarily unavailable. Please retry shortly.",
                ) from exc

        return self._check_memory(key, response)

    # ------- Redis-backed (true sliding window via sorted set) ----------

    async def _check_redis(
        self, redis, key: str, response: Optional[Response] = None
    ) -> tuple[int, int, int]:
        now = time.time()
        window_start = now - self.window_seconds
        pipe = redis.pipeline()
        pipe.zremrangebyscore(key, 0, window_start)
        pipe.zcard(key)
        pipe.zadd(key, {str(now): now})
        pipe.expire(key, self.window_seconds * 2)  # TTL 2x window for safety
        _, count, _, _ = await pipe.execute()

        limit = self.burst_limit if count < self.burst_limit else self.max_requests
        reset_epoch = int(now) + self.window_seconds

        self._attach_headers(response, limit, max(0, limit - count), reset_epoch)

        if count >= limit:
            remaining = max(0, limit - count)
            logger.warning("Rate limit hit for key %s (%d/%d)", key, count, limit)
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests. Limit: {limit} per {self.window_seconds}s",
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(reset_epoch),
                    "Retry-After": str(self.window_seconds),
                },
            )

        return limit, max(0, limit - count), reset_epoch

    # ------- In-memory fallback (per-process, approximate) -------------

    def _check_memory(
        self, key: str, response: Optional[Response] = None
    ) -> tuple[int, int, int]:
        now = time.time()
        window_start = now - self.window_seconds

        # Periodic cleanup every 60s to stop the dict from growing unbounded.
        if now - self._last_cleanup > 60:
            self._last_cleanup = now
            for k in list(self._fallback.keys()):
                self._fallback[k][:] = [
                    t for t in self._fallback[k] if t > window_start
                ]
                if not self._fallback[k]:
                    del self._fallback[k]

        bucket = self._fallback[key]
        bucket[:] = [t for t in bucket if t > window_start]

        count = len(bucket)
        limit = self.burst_limit if count < self.burst_limit else self.max_requests
        reset_epoch = int(now) + self.window_seconds

        self._attach_headers(response, limit, max(0, limit - count), reset_epoch)

        if count >= limit:
            remaining = max(0, limit - count)
            logger.warning("Rate limit hit (mem) for key %s (%d/%d)", key, count, limit)
            raise HTTPException(
                status_code=429,
                detail=f"Too many requests. Limit: {limit} per {self.window_seconds}s",
                headers={
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(reset_epoch),
                    "Retry-After": str(self.window_seconds),
                },
            )

        bucket.append(now)
        return limit, max(0, limit - count), reset_epoch

    # ------- Helpers ---------------------------------------------------

    @staticmethod
    def _attach_headers(
        response: Optional[Response], limit: int, remaining: int, reset_epoch: int
    ) -> None:
        if response is None:
            return
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(reset_epoch)

    def reset(self) -> None:
        """Clear the in-memory fallback buckets (useful in tests)."""
        self._fallback.clear()


# ---- Pre-configured limiters used across the application -------------

# Auth — strict limits, login is per-IP (no user context yet)
login_limiter = RateLimiter(max_requests=5, window_seconds=60, prefix="rl:login")
refresh_limiter = RateLimiter(max_requests=10, window_seconds=60, prefix="rl:refresh")
logout_limiter = RateLimiter(max_requests=10, window_seconds=60, prefix="rl:logout")

# Dashboard — moderate (many sub-queries per request)
dashboard_limiter = RateLimiter(max_requests=30, window_seconds=60, prefix="rl:dash")

# CRUD — wider limits for admin/staff operations
create_user_limiter = RateLimiter(max_requests=10, window_seconds=60, prefix="rl:user")
create_org_limiter = RateLimiter(max_requests=20, window_seconds=60, prefix="rl:org")
create_event_limiter = RateLimiter(
    max_requests=20, window_seconds=60, prefix="rl:event"
)
create_sport_limiter = RateLimiter(
    max_requests=30, window_seconds=60, prefix="rl:sport"
)
create_category_limiter = RateLimiter(
    max_requests=30, window_seconds=60, prefix="rl:cat"
)

# Uploads — prevent storage exhaustion
upload_limiter = RateLimiter(max_requests=20, window_seconds=60, prefix="rl:upload")

# Cloudinary — moderate to avoid runaway asset creation
cloudinary_limiter = RateLimiter(max_requests=30, window_seconds=60, prefix="rl:cld")

# Participants — tight per-user to prevent enumeration / bulk registration
participant_limiter = RateLimiter(
    max_requests=30, window_seconds=60, prefix="rl:participant"
)
participant_write_limiter = RateLimiter(
    max_requests=10, window_seconds=60, prefix="rl:participant:w"
)

# Participation per sport — prevent rapid create/update/delete/review
participation_write_limiter = RateLimiter(
    max_requests=20, window_seconds=60, prefix="rl:pps:w"
)
participation_review_limiter = RateLimiter(
    max_requests=30, window_seconds=60, prefix="rl:pps:r"
)

# Sports-events associations
sports_event_write_limiter = RateLimiter(
    max_requests=30, window_seconds=60, prefix="rl:se:w"
)

# Reports — CPU-heavy (XLSX/PDF rendering). Tight per-user cap to prevent a
# single user from exhausting render workers.
report_limiter = RateLimiter(max_requests=10, window_seconds=60, prefix="rl:report")

# PII reveal — very tight; a burst is a sign of bulk exfiltration. Per-user.
reveal_limiter = RateLimiter(max_requests=15, window_seconds=60, prefix="rl:reveal")
