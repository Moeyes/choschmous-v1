import hashlib
import time
import json
from collections import defaultdict
from typing import Optional

from fastapi import HTTPException, Request
from starlette.responses import JSONResponse

from core.redis_client import get_redis

IDEMPOTENCY_TTL = 86400

_used_keys: dict[str, dict] = {}

def _key_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()

async def check_idempotency(request: Request) -> Optional[dict]:
    key = request.headers.get("Idempotency-Key")
    if not key:
        return None
    hashed = _key_hash(key)
    redis = await get_redis()
    if redis is not None:
        existing = await redis.get(f"idempotency:{hashed}")
        if existing:
            body = json.loads(existing)
            return JSONResponse(status_code=body.get("_status", 200), content=body)
        return hashed
    now = time.time()
    cutoff = now - IDEMPOTENCY_TTL
    _used_keys.clear()
    for k, v in list(_used_keys.items()):
        if v.get("_ts", 0) < cutoff:
            del _used_keys[k]
    cached = _used_keys.get(hashed)
    if cached:
        return JSONResponse(status_code=cached.get("_status", 200), content=cached)
    return hashed

async def store_idempotency_result(key_hash: str, status_code: int, body: dict):
    body["_status"] = status_code
    body["_ts"] = time.time()
    redis = await get_redis()
    if redis is not None:
        await redis.setex(f"idempotency:{key_hash}", IDEMPOTENCY_TTL, json.dumps(body))
    else:
        _used_keys[key_hash] = body
