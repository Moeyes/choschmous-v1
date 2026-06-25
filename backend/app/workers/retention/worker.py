"""arq retention worker entrypoint (CHOS-501).

Runs the data-governance jobs OFF the API:

* a daily **cron** that runs the per-data-class retention purge
  (:func:`app.workers.retention.purge.run_retention_purge`), dry-run unless
  ``RETENTION_ENABLED``;
* an on-demand **subject-erasure** job an admin DSAR action can enqueue.

Run it with::

    uv run arq app.workers.retention.worker.RetentionWorkerSettings

Each job opens its own primary-DB session (writes go to the primary, never a
read replica) and commits on success / rolls back on failure.

# TODO(CHOS-205): the workers Helm chart runs this command; it needs DB_* +
# REDIS_URL injected (Vault Agent, CHOS-201). Set RETENTION_ENABLED=1 only after
# the restore drill (CHOS-502) has validated backups.
"""

from __future__ import annotations

import logging

from arq import cron

from app.workers.queue import redis_settings
from app.workers.retention.erasure import ErasureError, SubjectEraser
from app.workers.retention.purge import run_retention_purge
from core.config import settings
from core.database import SessionLocal

logger = logging.getLogger(__name__)


async def retention_purge_job(ctx: dict) -> dict:
    """Run the scheduled retention purge once. Returns the report dict."""
    async with SessionLocal() as db:
        try:
            report = await run_retention_purge(db)
            await db.commit()
        except Exception:
            await db.rollback()
            logger.error("retention purge job failed", exc_info=True)
            raise
    return report.as_dict()


async def subject_erasure_job(
    ctx: dict,
    *,
    enroll_id: int,
    actor_user_id: str | None = None,
    actor_role: str | None = None,
    reason: str | None = None,
    hard: bool = False,
) -> dict:
    """Erase one subject's PII (anonymise by default). A missing enrollment is a
    permanent failure (returned, not raised, so arq does not retry forever)."""
    async with SessionLocal() as db:
        try:
            result = await SubjectEraser(db).erase(
                enroll_id,
                actor_user_id=actor_user_id,
                actor_role=actor_role,
                reason=reason,
                hard=hard,
            )
            await db.commit()
            return {"status": "ok", **result}
        except ErasureError as exc:
            await db.rollback()
            logger.info("subject erasure %s failed: %s", enroll_id, exc)
            return {"status": "failed", "code": exc.code, "error": str(exc)}
        except Exception:
            await db.rollback()
            logger.error("subject erasure job failed", exc_info=True)
            raise


class RetentionWorkerSettings:
    """arq worker entrypoint.
    ``arq app.workers.retention.worker.RetentionWorkerSettings``."""

    functions = [subject_erasure_job]
    cron_jobs = [
        cron(
            retention_purge_job,
            hour=settings.RETENTION_PURGE_HOUR,
            minute=settings.RETENTION_PURGE_MINUTE,
            run_at_startup=False,
        )
    ]
    redis_settings = redis_settings()
    job_timeout = 300
    max_jobs = 2
    keep_result = 3600
