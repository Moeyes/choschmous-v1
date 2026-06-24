from __future__ import annotations

import json
import logging
from typing import Any, Callable, TypeVar

from redis.exceptions import RedisError

from core.redis_client import get_redis, iter_keys

logger = logging.getLogger(__name__)
T = TypeVar("T")


async def cache_get(key: str) -> Any | None:
    r = await get_redis()
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
    r = await get_redis()
    if r is None:
        return
    try:
        await r.set(key, json.dumps(value, default=str), ex=ttl_seconds)
    except (RedisError, ConnectionError) as e:
        logger.debug("cache_set failed (Redis unavailable): %s", e)


async def cache_delete(key: str) -> None:
    r = await get_redis()
    if r is None:
        return
    try:
        await r.delete(key)
    except (RedisError, ConnectionError) as e:
        logger.debug("cache_delete failed (Redis unavailable): %s", e)


async def cache_delete_pattern(pattern: str) -> None:
    r = await get_redis()
    if r is None:
        return
    try:
        # ``iter_keys`` scans every shard in cluster mode and the single instance
        # otherwise (CHOS-302). In cluster mode the matched keys may live on
        # different shards (different hash slots), so a multi-key DELETE could
        # CROSSSLOT — delete one key at a time, which is slot-safe everywhere.
        async for key in iter_keys(r, pattern):
            await r.delete(key)
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
