import hashlib
import logging
import time
import json
from typing import Optional

from fastapi import Request
from starlette.responses import JSONResponse
from redis.exceptions import RedisError

from core.redis_client import get_redis

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
            logger.warning("Idempotency check degraded to in-memory (Redis down): %s", exc)

    # In-memory fallback (per-process; acceptable degradation when Redis is down).
    _prune_memory(time.time())
    return _memory_lookup(hashed)


async def store_idempotency_result(key_hash: str, status_code: int, body: dict):
    body["_status"] = status_code
    body["_ts"] = time.time()
    redis = await get_redis()
    if redis is not None:
        try:
            await redis.setex(f"idempotency:{key_hash}", IDEMPOTENCY_TTL, json.dumps(body))
            return
        except (RedisError, ConnectionError, OSError) as exc:
            logger.warning("Idempotency store degraded to in-memory (Redis down): %s", exc)
    _used_keys[key_hash] = body
