from __future__ import annotations

import logging

from redis.asyncio import Redis, ConnectionPool
from redis.exceptions import RedisError

from core.config import settings

logger = logging.getLogger(__name__)
_pool: ConnectionPool | None = None


def get_redis() -> Redis | None:
    global _pool
    if _pool is None:
        try:
            _pool = ConnectionPool.from_url(
                settings.REDIS_URL,
                max_connections=20,
                decode_responses=True,
                # Fail fast when Redis is unreachable so a dependency outage can
                # never block the event loop / hang a request. Callers
                # (ratelimit, idempotency, cache) catch the error and degrade.
                socket_connect_timeout=0.5,
                socket_timeout=0.5,
                retry_on_timeout=False,
                health_check_interval=30,
            )
        except (RedisError, ValueError, OSError) as e:
            logger.debug("Redis connection pool creation failed: %s", e)
            return None
    try:
        return Redis(connection_pool=_pool)
    except (RedisError, ConnectionError) as e:
        logger.debug("Redis client creation failed: %s", e)
        return None


async def ping_redis() -> bool:
    """Liveness probe for Redis. Returns False (never raises) when unavailable.

    Used by the readiness health check so operators can see Redis is down while
    the app keeps serving (rate limiting / idempotency degrade gracefully)."""
    client = get_redis()
    if client is None:
        return False
    try:
        return bool(await client.ping())
    except (RedisError, ConnectionError, OSError) as e:
        logger.debug("Redis ping failed: %s", e)
        return False


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        try:
            await _pool.disconnect()
        except (RedisError, ConnectionError) as e:
            logger.debug("Redis pool disconnect failed: %s", e)
        _pool = None
