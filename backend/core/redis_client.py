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
            )
        except (RedisError, ValueError, OSError) as e:
            logger.debug("Redis connection pool creation failed: %s", e)
            return None
    try:
        return Redis(connection_pool=_pool)
    except (RedisError, ConnectionError) as e:
        logger.debug("Redis client creation failed: %s", e)
        return None


async def close_redis() -> None:
    global _pool
    if _pool is not None:
        try:
            await _pool.disconnect()
        except (RedisError, ConnectionError) as e:
            logger.debug("Redis pool disconnect failed: %s", e)
        _pool = None
