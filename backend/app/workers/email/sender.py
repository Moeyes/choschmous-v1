"""Email sender boundary (CHOS-406).

A tiny ``EmailSender`` protocol with two implementations:

* :class:`LoggingEmailSender` — the default. Logs that an email *would* be sent
  and returns. Used in local/CI and whenever ``EMAIL_ENABLED`` is off or no SMTP
  host is configured, so the worker is always safe to run with no mail server and
  nothing actually leaves the box.
* :class:`SmtpEmailSender` — stdlib ``smtplib`` over (optionally) STARTTLS. Used
  when ``EMAIL_ENABLED`` is on and ``SMTP_HOST`` is set.

``smtplib`` is synchronous; the arq job runs the send in a thread executor so it
never blocks the worker's event loop.

TODO(infra/CHOS-406): inject SMTP_HOST/PORT/USERNAME/PASSWORD (Vault) and flip
EMAIL_ENABLED on. To use SES/SendGrid instead, add a provider here behind the
same ``EmailSender`` protocol — callers and templates stay unchanged.
"""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from typing import Protocol, runtime_checkable

from core.config import settings
from app.workers.email.templates import EmailContent

logger = logging.getLogger(__name__)


@runtime_checkable
class EmailSender(Protocol):
    def send(self, *, to: str, content: EmailContent) -> None: ...


class LoggingEmailSender:
    """No-op sender: records intent, sends nothing. Safe default for local/CI."""

    def send(self, *, to: str, content: EmailContent) -> None:
        logger.info(
            "email suppressed (EMAIL_ENABLED off / no SMTP host): to=%s subject=%r",
            to,
            content.subject,
        )


class SmtpEmailSender:
    """SMTP sender using the stdlib. Builds a multipart text+html message."""

    def __init__(
        self,
        *,
        host: str,
        port: int,
        username: str | None,
        password: str | None,
        use_tls: bool,
        from_addr: str,
        from_name: str,
    ) -> None:
        self._host = host
        self._port = port
        self._username = username
        self._password = password
        self._use_tls = use_tls
        self._from = formataddr((from_name, from_addr))

    def send(self, *, to: str, content: EmailContent) -> None:
        msg = EmailMessage()
        msg["From"] = self._from
        msg["To"] = to
        msg["Subject"] = content.subject
        msg.set_content(content.text_body)
        if content.html_body:
            msg.add_alternative(content.html_body, subtype="html")

        with smtplib.SMTP(self._host, self._port, timeout=30) as smtp:
            if self._use_tls:
                smtp.starttls()
            if self._username and self._password:
                smtp.login(self._username, self._password)
            smtp.send_message(msg)
        logger.info("email sent: to=%s subject=%r", to, content.subject)


def get_email_sender() -> EmailSender:
    """Pick the sender from config. Logging no-op unless email is enabled AND an
    SMTP host is configured — so a half-configured deploy fails safe (logs)
    rather than erroring on every send."""
    if settings.EMAIL_ENABLED and settings.SMTP_HOST:
        return SmtpEmailSender(
            host=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            use_tls=settings.SMTP_USE_TLS,
            from_addr=settings.EMAIL_FROM,
            from_name=settings.EMAIL_FROM_NAME,
        )
    return LoggingEmailSender()
