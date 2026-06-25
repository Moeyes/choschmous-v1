"""arq email worker (CHOS-406).

Runs transactional email sends OFF the API request path. The API enqueues
``send_email_job`` (see ``app/workers/queue.py`` :func:`enqueue_email`); this
process renders the named template and hands it to the configured sender.

Run it with::

    uv run arq app.workers.email.worker.EmailWorkerSettings

``send_email_job`` is also registered on the report worker's function list so a
single worker process can serve both queues in small deployments — see
``app/workers/report_worker.py``.

# TODO(CHOS-205): the workers Helm chart runs this command; it needs REDIS_URL +
# (when EMAIL_ENABLED) SMTP_* injected (Vault Agent, CHOS-201).
"""

from __future__ import annotations

import asyncio
import logging

from app.workers.email.sender import get_email_sender
from app.workers.email.templates import UnknownTemplate, render_template
from app.workers.queue import redis_settings

logger = logging.getLogger(__name__)


async def send_email_job(
    ctx: dict,
    *,
    to: str,
    template: str,
    context: dict,
) -> dict:
    """Render ``template`` with ``context`` and send it to ``to``.

    Returns a small result descriptor. A bad template name is a permanent
    failure (returned, not raised, so arq does not retry it forever); a transient
    send error is raised so arq's retry policy can re-run the job.
    """
    try:
        content = render_template(template, context)
    except UnknownTemplate:
        logger.error("send_email_job: unknown template %r", template)
        return {"status": "failed", "error": f"unknown template: {template}"}

    sender = get_email_sender()
    # smtplib is blocking — keep it off the event loop.
    await asyncio.to_thread(sender.send, to=to, content=content)
    return {"status": "sent", "to": to, "template": template}


class EmailWorkerSettings:
    """arq worker entrypoint. ``arq app.workers.email.worker.EmailWorkerSettings``."""

    functions = [send_email_job]
    redis_settings = redis_settings()
    job_timeout = 60
    max_jobs = 10
    keep_result = 3600
