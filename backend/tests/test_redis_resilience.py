"""Resilience tests for Redis-backed controls (P0-2).

When Redis is unavailable the application must keep working: the rate limiter
falls back to an in-memory limiter (still enforcing limits, never 500-ing) and
idempotency degrades to in-memory. These simulate a Redis outage by injecting a
client whose commands raise ConnectionError.
"""

import types

import pytest
from fastapi import HTTPException
from redis.exceptions import ConnectionError as RedisConnectionError

from core import ratelimit
from core.ratelimit import RateLimiter

# conftest's autouse `_disable_rate_limits` no-ops RateLimiter.check for every
# test. Capture the REAL method at import time (before any fixture runs) so these
# resilience tests can restore and exercise the genuine limiter logic.
_REAL_CHECK = RateLimiter.check


@pytest.fixture
def real_rate_limiter(monkeypatch):
    """Undo conftest's global rate-limit disabling for this test."""
    monkeypatch.setattr(RateLimiter, "check", _REAL_CHECK)


def _fake_request(ip: str = "203.0.113.7"):
    return types.SimpleNamespace(client=types.SimpleNamespace(host=ip))


class _DownPipe:
    """A redis pipeline whose buffered commands are no-ops but execute() fails."""

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


@pytest.mark.asyncio
async def test_ratelimiter_falls_back_to_memory_when_redis_down(monkeypatch, real_rate_limiter):
    async def _down_get_redis():
        return _DownRedis()

    monkeypatch.setattr(ratelimit, "get_redis", _down_get_redis)

    limiter = RateLimiter(max_requests=3, window_seconds=60, prefix="rl:test:down")
    req = _fake_request()

    # First 3 succeed via the in-memory fallback (no exception leaks from Redis).
    for _ in range(3):
        limit, remaining, reset = await limiter.check(req)
        assert limit == 3

    # 4th is correctly rate-limited (limit still enforced while Redis is down).
    with pytest.raises(HTTPException) as exc:
        await limiter.check(req)
    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_ratelimiter_falls_back_when_get_redis_returns_none(monkeypatch, real_rate_limiter):
    async def _none_get_redis():
        return None

    monkeypatch.setattr(ratelimit, "get_redis", _none_get_redis)

    limiter = RateLimiter(max_requests=2, window_seconds=60, prefix="rl:test:none")
    req = _fake_request("198.51.100.4")

    await limiter.check(req)
    await limiter.check(req)
    with pytest.raises(HTTPException) as exc:
        await limiter.check(req)
    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_redis_connection_error_does_not_become_500(monkeypatch, real_rate_limiter):
    """A Redis ConnectionError must be swallowed (degrade), never surface."""
    async def _down_get_redis():
        return _DownRedis()

    monkeypatch.setattr(ratelimit, "get_redis", _down_get_redis)

    limiter = RateLimiter(max_requests=5, window_seconds=60, prefix="rl:test:noerr")
    # Should not raise RedisConnectionError — only (much later) a 429 if exceeded.
    limit, remaining, reset = await limiter.check(_fake_request("192.0.2.1"))
    assert limit == 5


@pytest.mark.asyncio
async def test_idempotency_degrades_to_memory_when_redis_down(monkeypatch):
    from core import idempotency

    async def _down_get_redis():
        return _DownRedis()

    monkeypatch.setattr(idempotency, "get_redis", _down_get_redis)

    req = types.SimpleNamespace(headers={"Idempotency-Key": "abc-123"})
    # Must not raise despite Redis being down; returns the hash to proceed.
    result = await idempotency.check_idempotency(req)
    assert isinstance(result, str)

    # Storing also must not raise.
    await idempotency.store_idempotency_result(result, 201, {"ok": True})
