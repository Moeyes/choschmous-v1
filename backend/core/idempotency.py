import hashlib
import logging
import time
import json
from typing import Optional

from fastapi import HTTPException, Request
from starlette.responses import JSONResponse
from redis.exceptions import RedisError

from core.redis_client import get_redis, inmemory_fallback_enabled

# Surfaced when Redis is down outside local dev — see store/check below.
_UNAVAILABLE_DETAIL = (
    "Idempotency store is temporarily unavailable. Please retry shortly."
)

logger = logging.getLogger(__name__)

IDEMPOTENCY_TTL = 86400

_used_keys: dict[str, dict] = {}


def _key_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _prune_memory(now: float) -> None:
    cutoff = now - IDEMPOTENCY_TTL
    for k, v in list(_used_keys.items()):
        if v.get("_ts", 0) < cutoff:
            del _used_keys[k]


def _memory_lookup(hashed: str):
    cached = _used_keys.get(hashed)
    if cached:
        return JSONResponse(status_code=cached.get("_status", 200), content=cached)
    return hashed


async def check_idempotency(request: Request) -> Optional[dict]:
    key = request.headers.get("Idempotency-Key")
    if not key:
        return None
    hashed = _key_hash(key)

    redis = await get_redis()
    if redis is not None:
        try:
            existing = await redis.get(f"idempotency:{hashed}")
            if existing:
                body = json.loads(existing)
                return JSONResponse(status_code=body.get("_status", 200), content=body)
            return hashed
        except (RedisError, ConnectionError, OSError) as exc:
            logger.warning("Idempotency check degraded (Redis down): %s", exc)
            # Fail closed outside local (CHOS-302): an in-memory store can't dedupe
            # a retry landing on another worker, so we must not silently proceed.
            if not inmemory_fallback_enabled():
                raise HTTPException(status_code=503, detail=_UNAVAILABLE_DETAIL) from exc
    elif not inmemory_fallback_enabled():
        raise HTTPException(status_code=503, detail=_UNAVAILABLE_DETAIL)

    # In-memory fallback (per-process; local dev only — see inmemory_fallback_enabled).
    _prune_memory(time.time())
    return _memory_lookup(hashed)


async def store_idempotency_result(key_hash: str, status_code: int, body: dict):
    body["_status"] = status_code
    body["_ts"] = time.time()
    redis = await get_redis()
    if redis is not None:
        try:
            await redis.setex(
                f"idempotency:{key_hash}", IDEMPOTENCY_TTL, json.dumps(body)
            )
            return
        except (RedisError, ConnectionError, OSError) as exc:
            logger.warning("Idempotency store degraded (Redis down): %s", exc)
    # Outside local, do NOT persist to a per-process dict: it can't dedupe across
    # workers and would give a false sense of safety. The next retry fails closed
    # at check_idempotency while Redis is down (CHOS-302).
    if inmemory_fallback_enabled():
        _used_keys[key_hash] = body
