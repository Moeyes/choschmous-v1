from __future__ import annotations

import json
import logging
from typing import Any, Callable, TypeVar

from redis.exceptions import RedisError

from core.redis_client import get_redis

logger = logging.getLogger(__name__)
T = TypeVar("T")


async def cache_get(key: str) -> Any | None:
    r = get_redis()
    if r is None:
        return None
    try:
        val = await r.get(key)
        if val is None:
            return None
        return json.loads(val)
    except (RedisError, ConnectionError):
        return None


async def cache_set(key: str, value: Any, ttl_seconds: int = 300) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await r.set(key, json.dumps(value, default=str), ex=ttl_seconds)
    except (RedisError, ConnectionError) as e:
        logger.debug("cache_set failed (Redis unavailable): %s", e)


async def cache_delete(key: str) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        await r.delete(key)
    except (RedisError, ConnectionError) as e:
        logger.debug("cache_delete failed (Redis unavailable): %s", e)


async def cache_delete_pattern(pattern: str) -> None:
    r = get_redis()
    if r is None:
        return
    try:
        cursor = 0
        while True:
            cursor, keys = await r.scan(cursor=cursor, match=pattern, count=100)
            if keys:
                await r.delete(*keys)
            if cursor == 0:
                break
    except (RedisError, ConnectionError) as e:
        logger.debug("cache_delete_pattern failed (Redis unavailable): %s", e)


async def cache_or_compute(
    key: str,
    factory: Callable[[], T],
    ttl_seconds: int = 300,
) -> T:
    cached = await cache_get(key)
    if cached is not None:
        return cached
    value = await factory() if hasattr(factory, "__call__") else factory
    await cache_set(key, value, ttl_seconds)
    return value
