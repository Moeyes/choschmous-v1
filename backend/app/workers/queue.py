"""arq job-queue access for the API process (CHOS-202).

The FastAPI process only ENQUEUES jobs and reads their status; the heavy render
runs in a separate ``arq`` worker (``app/workers/report_worker.py``). This module
owns the Redis connection pool used to enqueue + poll, derived from the same
``REDIS_URL`` the rest of the app uses (CHOS-201: required, no default).

# TODO(CHOS-205): the worker Deployment (deploy/helm/workers) and the API share
# this Redis/broker. Point both at the managed instance via REDIS_URL.
"""

from __future__ import annotations

import asyncio

from arq import create_pool
from arq.connections import RedisSettings
from arq.jobs import Job, JobStatus

from core.config import settings

REPORT_JOB = "render_report_job"

# One pool per running event loop. The test suite and the app run on different
# loops across sessions; keying by loop id avoids reusing a pool bound to a
# closed loop (asyncpg/redis both reject cross-loop reuse).
_pools: dict[int, object] = {}


def redis_settings() -> RedisSettings:
    """RedisSettings parsed from REDIS_URL — shared by the API (enqueue) and the
    worker so both connect to the same broker."""
    return RedisSettings.from_dsn(settings.REDIS_URL)


async def get_arq_pool():
    loop = asyncio.get_running_loop()
    pool = _pools.get(id(loop))
    if pool is None:
        pool = await create_pool(redis_settings())
        _pools[id(loop)] = pool
    return pool


async def enqueue_report(
    *, key: str, event_id: int, actor: dict, source: str | None, fmt: str
) -> str:
    """Enqueue a report render and return the arq job id. Returns fast — the
    render itself happens in the worker."""
    pool = await get_arq_pool()
    job = await pool.enqueue_job(
        REPORT_JOB,
        key=key,
        event_id=event_id,
        actor=actor,
        source=source,
        fmt=fmt,
    )
    # enqueue_job returns None if a job with the same id already exists; for our
    # auto-id jobs that does not happen, but guard anyway.
    return job.job_id if job is not None else ""


async def get_report_job(job_id: str) -> dict:
    """Poll a report job. Shape:

    ``{"job_id", "status": queued|in_progress|complete|failed|not_found,
       "result": <worker return dict | None>}``

    A ``complete`` arq job whose worker returned a typed failure carries
    ``status: "failed"`` inside ``result`` — the route maps that to the right
    HTTP code."""
    pool = await get_arq_pool()
    job = Job(job_id, pool)
    status = await job.status()

    if status == JobStatus.not_found:
        return {"job_id": job_id, "status": "not_found", "result": None}

    if status != JobStatus.complete:
        # queued / deferred / in_progress -> still pending from the caller's view.
        normalized = "in_progress" if status == JobStatus.in_progress else "queued"
        return {"job_id": job_id, "status": normalized, "result": None}

    try:
        result = await job.result(timeout=0)
    except Exception as exc:  # worker raised (unexpected) -> arq re-raises here
        return {
            "job_id": job_id,
            "status": "failed",
            "result": {"status": "failed", "code": 500, "error": str(exc)},
        }

    # Worker returned normally. It may carry its own status ("complete" or a
    # typed "failed"); surface that to the caller.
    inner_status = (
        result.get("status", "complete") if isinstance(result, dict) else "complete"
    )
    return {"job_id": job_id, "status": inner_status, "result": result}
