"""CHOS-302: Redis Cluster support + fail-closed degradation outside local.

Two behaviours are locked down here:

* In **local** dev, a Redis outage still degrades to the in-memory limiter /
  idempotency store (covered by test_redis_resilience.py).
* In **every other** environment the in-memory fallback is disabled, so a Redis
  outage fails CLOSED (503) instead of silently running the control without its
  shared backing store.

Plus the cluster client wiring (get_redis builds a RedisCluster) and the
cluster-aware key scan used by the dashboard cache invalidation.
"""

import types

import pytest
from fastapi import HTTPException
from redis.exceptions import ConnectionError as RedisConnectionError

import core.redis_client as rc
from core import idempotency, ratelimit
from core.config import settings
from core.ratelimit import RateLimiter

# Capture the REAL limiter method before conftest's autouse fixture no-ops it.
_REAL_CHECK = RateLimiter.check


@pytest.fixture
def real_rate_limiter(monkeypatch):
    monkeypatch.setattr(RateLimiter, "check", _REAL_CHECK)


def _fake_request(ip: str = "203.0.113.9"):
    return types.SimpleNamespace(client=types.SimpleNamespace(host=ip))


class _DownPipe:
    def zremrangebyscore(self, *a, **k):
        return self

    def zcard(self, *a, **k):
        return self

    def zadd(self, *a, **k):
        return self

    def expire(self, *a, **k):
        return self

    async def execute(self):
        raise RedisConnectionError("Redis is down")


class _DownRedis:
    def pipeline(self):
        return _DownPipe()

    async def get(self, *a, **k):
        raise RedisConnectionError("Redis is down")

    async def setex(self, *a, **k):
        raise RedisConnectionError("Redis is down")


# --------------------------------------------------------------------------- #
# inmemory_fallback_enabled tracks the environment
# --------------------------------------------------------------------------- #
def test_fallback_enabled_only_in_local(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "local")
    assert rc.inmemory_fallback_enabled() is True
    monkeypatch.setattr(settings, "ENVIRONMENT", "prod")
    assert rc.inmemory_fallback_enabled() is False
    monkeypatch.setattr(settings, "ENVIRONMENT", "UAT")
    assert rc.inmemory_fallback_enabled() is False


# --------------------------------------------------------------------------- #
# Rate limiter fails CLOSED (503) outside local when Redis is unreachable
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_ratelimiter_fails_closed_outside_local_on_redis_error(
    monkeypatch, real_rate_limiter
):
    monkeypatch.setattr(settings, "ENVIRONMENT", "prod")

    async def _down_get_redis():
        return _DownRedis()

    monkeypatch.setattr(ratelimit, "get_redis", _down_get_redis)
    limiter = RateLimiter(max_requests=3, window_seconds=60, prefix="rl:cl:err")

    with pytest.raises(HTTPException) as exc:
        await limiter.check(_fake_request())
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_ratelimiter_fails_closed_outside_local_when_client_none(
    monkeypatch, real_rate_limiter
):
    monkeypatch.setattr(settings, "ENVIRONMENT", "prod")

    async def _none_get_redis():
        return None

    monkeypatch.setattr(ratelimit, "get_redis", _none_get_redis)
    limiter = RateLimiter(max_requests=3, window_seconds=60, prefix="rl:cl:none")

    with pytest.raises(HTTPException) as exc:
        await limiter.check(_fake_request("198.51.100.9"))
    assert exc.value.status_code == 503


# --------------------------------------------------------------------------- #
# Idempotency fails CLOSED (503) outside local when Redis is unreachable
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_idempotency_fails_closed_outside_local_on_error(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "prod")

    async def _down_get_redis():
        return _DownRedis()

    monkeypatch.setattr(idempotency, "get_redis", _down_get_redis)
    req = types.SimpleNamespace(headers={"Idempotency-Key": "abc-302"})

    with pytest.raises(HTTPException) as exc:
        await idempotency.check_idempotency(req)
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_idempotency_fails_closed_outside_local_when_client_none(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "prod")

    async def _none_get_redis():
        return None

    monkeypatch.setattr(idempotency, "get_redis", _none_get_redis)
    req = types.SimpleNamespace(headers={"Idempotency-Key": "abc-302b"})

    with pytest.raises(HTTPException) as exc:
        await idempotency.check_idempotency(req)
    assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_idempotency_store_outside_local_does_not_touch_memory(monkeypatch):
    """A failed store outside local must NOT seed the per-process dict (it would
    give a false sense of dedupe across workers)."""
    monkeypatch.setattr(settings, "ENVIRONMENT", "prod")

    async def _down_get_redis():
        return _DownRedis()

    monkeypatch.setattr(idempotency, "get_redis", _down_get_redis)
    monkeypatch.setattr(idempotency, "_used_keys", {})

    await idempotency.store_idempotency_result("k302", 201, {"ok": True})
    assert idempotency._used_keys == {}


# --------------------------------------------------------------------------- #
# Cluster client construction
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_get_redis_builds_cluster_when_enabled(monkeypatch):
    monkeypatch.setattr(rc.settings, "REDIS_CLUSTER", True)
    monkeypatch.setattr(rc, "_cluster", None)
    monkeypatch.setattr(rc, "_pool", None)

    sentinel = object()

    def _from_url(cls, *a, **k):
        return sentinel

    monkeypatch.setattr(rc.RedisCluster, "from_url", classmethod(_from_url))

    client = await rc.get_redis()
    assert client is sentinel
    # Cached: a second call returns the same client without rebuilding.
    assert await rc.get_redis() is sentinel


# --------------------------------------------------------------------------- #
# iter_keys cursor-scans a single node (cluster mode is exercised in deploy)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_iter_keys_single_node_cursor_scan():
    class _FakeRedis:
        def __init__(self):
            self.calls = 0

        async def scan(self, cursor=0, match=None, count=100):
            # Two pages, then cursor 0 to stop.
            if self.calls == 0:
                self.calls += 1
                return 42, ["dashboard:a", "dashboard:b"]
            return 0, ["dashboard:c"]

    keys = [k async for k in rc.iter_keys(_FakeRedis(), "dashboard:*")]
    assert keys == ["dashboard:a", "dashboard:b", "dashboard:c"]
