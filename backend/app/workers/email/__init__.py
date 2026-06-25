"""Transactional email worker (CHOS-406).

Sends the two transactional templates — registration confirmation and review
outcome — OFF the request path via arq (same pattern as the report worker,
CHOS-202). The API enqueues ``send_email_job`` (see ``app/workers/queue.py``
:func:`enqueue_email`); this package renders the template and hands it to the
configured :class:`EmailSender`.

Provider boundary: :mod:`sender` defines the ``EmailSender`` protocol with an
SMTP implementation and a no-op logging default, so local/CI need no mail server
and nothing leaves the box until ``EMAIL_ENABLED`` + SMTP creds are injected.
"""

from app.workers.email.templates import EmailContent, render_template
from app.workers.email.sender import EmailSender, get_email_sender

__all__ = ["EmailContent", "render_template", "EmailSender", "get_email_sender"]
