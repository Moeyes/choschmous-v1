from __future__ import annotations

import logging

from redis.asyncio import Redis, ConnectionPool
from redis.asyncio.cluster import RedisCluster
from redis.exceptions import RedisError

from core.config import settings

logger = logging.getLogger(__name__)

# Single-node pool (REDIS_CLUSTER=0) and cluster client (REDIS_CLUSTER=1) are
# mutually exclusive per process; only one is ever populated.
_pool: ConnectionPool | None = None
_cluster: RedisCluster | None = None

RedisClient = Redis | RedisCluster


def inmemory_fallback_enabled() -> bool:
    """Whether rate-limit / idempotency may degrade to a per-process in-memory
    store when Redis is unreachable (CHOS-302).

    Allowed ONLY in local dev. In every other environment Redis (Cluster) is a
    hard dependency: an in-memory limiter is per-process (useless across many
    workers) and an in-memory idempotency store cannot dedupe a retry that lands
    on a different worker. So outside local we fail closed rather than silently
    run those controls without their backing store.
    """
    return settings.ENVIRONMENT.lower() == "local"


async def get_redis() -> RedisClient | None:
    """Return a shared async Redis client.

    * ``REDIS_CLUSTER=1`` → a ``RedisCluster`` that discovers all shards (the
      3-shard cluster, CHOS-302) from the seed ``REDIS_URL``.
    * otherwise          → a pooled single-node ``Redis``.

    Returns ``None`` only when the client object cannot be constructed at all;
    command-time outages surface as ``RedisError`` to the caller (which then
    degrades or fails closed per :func:`inmemory_fallback_enabled`).
    """
    global _pool, _cluster

    if settings.REDIS_CLUSTER:
        if _cluster is None:
            try:
                _cluster = RedisCluster.from_url(
                    settings.REDIS_URL,
                    decode_responses=True,
                    # Fail fast so a shard outage can never block the event loop.
                    socket_connect_timeout=0.5,
                    socket_timeout=0.5,
                )
            except (RedisError, ValueError, OSError) as e:
                logger.debug("Redis Cluster client creation failed: %s", e)
                return None
        return _cluster

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


async def iter_keys(client: RedisClient, pattern: str, count: int = 100):
    """Yield keys matching ``pattern``, transparently across modes.

    In cluster mode a SCAN of one node only sees that shard's keyspace, so we scan
    every primary; in single-node mode we cursor-scan the one instance.
    """
    if isinstance(client, RedisCluster):
        async for key in client.scan_iter(
            match=pattern, count=count, target_nodes=RedisCluster.PRIMARIES
        ):
            yield key
        return
    cursor = 0
    while True:
        cursor, keys = await client.scan(cursor=cursor, match=pattern, count=count)
        for key in keys:
            yield key
        if cursor == 0:
            break


async def ping_redis() -> bool:
    """Liveness probe for Redis. Returns False (never raises) when unavailable.

    Used by the readiness health check so operators can see Redis is down while
    the app keeps serving (in local; outside local those controls fail closed)."""
    client = await get_redis()
    if client is None:
        return False
    try:
        return bool(await client.ping())
    except (RedisError, ConnectionError, OSError) as e:
        logger.debug("Redis ping failed: %s", e)
        return False


async def close_redis() -> None:
    global _pool, _cluster
    if _cluster is not None:
        try:
            await _cluster.aclose()
        except (RedisError, ConnectionError) as e:
            logger.debug("Redis cluster close failed: %s", e)
        _cluster = None
    if _pool is not None:
        try:
            await _pool.disconnect()
        except (RedisError, ConnectionError) as e:
            logger.debug("Redis pool disconnect failed: %s", e)
        _pool = None
