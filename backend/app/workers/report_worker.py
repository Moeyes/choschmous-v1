"""arq report-render worker (CHOS-202).

Runs the CPU-heavy XLSX/PDF render OFF the API request path. The API enqueues a
``render_report_job`` (see ``app/workers/queue.py``); this process picks it up,
opens its own DB session, runs the *unchanged* render pipeline
(``app/application/reports/render.render_report_document``), stores the bytes
(``app/workers/storage.py``), and returns a result descriptor the job-status
endpoint surfaces.

Run it with::

    uv run arq app.workers.report_worker.WorkerSettings

# TODO(CHOS-205): the workers Helm chart (deploy/helm/workers) runs this command;
# it needs DB_* + REDIS_URL + JWT secrets injected (Vault Agent, CHOS-201) and,
# for real artifact storage, REPORTS_S3_BUCKET + credentials (CHOS-202 storage).
"""

from __future__ import annotations

import logging

from core.database import ReadSessionLocal
from app.application.reports.render import (
    ReportRenderError,
    actor_from_payload,
    render_report_document,
)
from app.workers.queue import redis_settings
from app.workers.storage import store_artifact

logger = logging.getLogger(__name__)


async def render_report_job(
    ctx: dict,
    *,
    key: str,
    event_id: int,
    actor: dict,
    source: str | None,
    fmt: str,
) -> dict:
    """Render one report and persist it. Returns a result dict for the status
    endpoint. A domain failure (bad key / missing event) is returned as a typed
    ``{"status": "failed", "code": ...}`` rather than raised, so the API can map
    it to the right HTTP status instead of treating it as an internal error."""
    job_id = ctx["job_id"]
    # Report rendering is read-only, so the worker opens a READ-replica session
    # (CHOS-301): the heavy report queries are served off the replicas, never the
    # primary. ReadSessionLocal falls back to the primary factory when no replica
    # is configured, so this is the documented cross-process pattern either way.
    async with ReadSessionLocal() as db:
        try:
            artifact = await render_report_document(
                db,
                key=key,
                event_id=event_id,
                actor=actor_from_payload(actor),
                source=source,
                fmt=fmt,
            )
        except ReportRenderError as exc:
            logger.info("report job %s failed (%s): %s", job_id, exc.code, exc)
            return {"status": "failed", "code": exc.code, "error": str(exc)}

    stored = store_artifact(
        job_id, artifact.content, artifact.media_type, artifact.filename
    )
    return {"status": "complete", **stored}


class WorkerSettings:
    """arq worker entrypoint. ``arq app.workers.report_worker.WorkerSettings``."""

    functions = [render_report_job]
    redis_settings = redis_settings()
    # A render can take a few seconds (WeasyPrint); allow generous headroom but
    # keep it bounded so a pathological job cannot pin a worker forever.
    job_timeout = 120
    max_jobs = 4
    keep_result = 3600  # seconds the result stays pollable after completion
