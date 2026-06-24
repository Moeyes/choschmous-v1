"""Report generation routes (CHOS-202).

Rendering XLSX/PDF reports is CPU-heavy (openpyxl / WeasyPrint) and used to run
inline on the request, holding a worker thread for the whole render. It now runs
in an ``arq`` worker off the request path: ``GET /reports/{key}`` validates +
authorizes + ENQUEUES and returns a ``job_id`` (fast); the client polls
``GET /reports/jobs/{job_id}`` and downloads from the returned URL once complete.

The render pipeline itself is unchanged — it lives in
``app/application/reports/render.py`` and is invoked by
``app/workers/report_worker.py``. This module is now a thin edge: parse, authz,
enqueue, map status.

NOTE (frontend follow-up): the report download UI must switch from "GET returns
the file" to "enqueue -> poll job -> download". Tracked as the FE wiring for
CHOS-202; the legacy synchronous contract is intentionally retired here.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.ratelimit import report_limiter
from src.database.deps import (
    get_read_db,
    get_current_user,
    get_effective_org_id,
)
from src.models.user import User
from src.services.report_service import ReportService

# Single source of truth for the report catalogue + render pipeline (CHOS-202).
from app.application.reports.render import REPORT_KEYS, actor_to_payload
from app.workers.queue import enqueue_report, get_report_job
from app.workers.storage import load_artifact

router = APIRouter()


@router.get("/reports/{key}", status_code=202)
async def generate_report(
    request: Request,
    response: Response,
    key: str,
    event_id: int = Query(...),
    org_id: int | None = Query(None),
    source: str | None = Query(None, pattern="^(planned|actual)$"),
    format: str = Query("xlsx", pattern="^(xlsx|pdf)$"),
    db: AsyncSession = Depends(get_read_db),
    current_user: User = Depends(get_current_user),
):
    """**Enqueue a report render and return a job id.** Org users auto-scope to
    their own org; admin may pass any ``org_id`` or omit it for event-wide
    reports.

    Returns ``202`` with ``{"job_id", "status": "queued"}`` in well under the
    request budget — the heavy render runs in the arq worker. Poll
    ``GET /reports/jobs/{job_id}`` for the result.

    Errors: ``400`` unknown key, ``404`` event not found, ``422`` bad
    format/source, ``403`` org user with no linked org.

    Supported keys: sport-list, totals, counts, album, name-list, leaders,
    coach-athlete, delegation.
    """
    await report_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )

    if key not in REPORT_KEYS:
        raise HTTPException(status_code=400, detail=f"Unknown report key: {key}")

    # Authorization side effect: org-role users are forced to their own org (and
    # rejected if none is linked). Per-row scoping happens in the worker via the
    # serialized actor. Pure (no DB) — keeps the enqueue path fast.
    get_effective_org_id(current_user, org_id)

    # Fail fast on a missing event so the client gets a 404 immediately rather
    # than discovering it via a failed job. Single PK lookup — cheap.
    service = ReportService(db)
    event = await service._get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    job_id = await enqueue_report(
        key=key,
        event_id=event_id,
        actor=actor_to_payload(current_user),
        source=source,
        fmt=format,
    )
    return {"job_id": job_id, "status": "queued"}


@router.get("/reports/jobs/{job_id}")
async def report_job_status(
    job_id: str,
    _current_user: User = Depends(get_current_user),
):
    """**Poll a report job.** While pending: ``{"status": "queued"|"in_progress"}``.
    On success: ``{"status": "complete", "result": {"url", "filename",
    "media_type", "size_bytes", "storage"}}`` — fetch the document from ``url``
    (relative to the API prefix when stored locally). A domain failure in the
    worker (bad key / missing event) surfaces as that error's HTTP status."""
    info = await get_report_job(job_id)

    if info["status"] == "not_found":
        raise HTTPException(status_code=404, detail="Report job not found")

    if info["status"] == "failed":
        result = info.get("result") or {}
        raise HTTPException(
            status_code=result.get("code", 500),
            detail=result.get("error", "Report generation failed"),
        )

    return info


@router.get("/reports/jobs/{job_id}/download")
async def download_report_artifact(
    job_id: str,
    _current_user: User = Depends(get_current_user),
):
    """**Stream a completed report artifact** from local storage. Used when no
    object store is configured (S3 would hand back a presigned URL instead — see
    ``app/workers/storage.py`` TODO). 404 if the artifact is absent/expired."""
    loaded = load_artifact(job_id)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Report artifact not available")
    content, media_type, filename = loaded
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
