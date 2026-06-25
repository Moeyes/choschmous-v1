"""CHOS-406: transactional email — templates, sender, and the arq job."""

import pytest

from app.workers.email import sender as sender_mod
from app.workers.email.sender import (
    LoggingEmailSender,
    SmtpEmailSender,
    get_email_sender,
)
from app.workers.email.templates import (
    EmailContent,
    UnknownTemplate,
    render_template,
)
from app.workers.email.worker import send_email_job


# ── Templates ────────────────────────────────────────────────────────────────


def test_render_registration_confirmation():
    content = render_template(
        "registration_confirmation",
        {
            "recipient_name": "Dara",
            "participant_name": "Sok Dara",
            "event_name": "National Games",
            "organization_name": "Phnom Penh",
            "role": "athlete",
        },
    )
    assert isinstance(content, EmailContent)
    assert "National Games" in content.subject
    assert "Sok Dara" in content.text_body
    assert content.html_body and "National Games" in content.html_body


def test_render_review_outcome_approved_with_note():
    content = render_template(
        "review_outcome",
        {
            "participant_name": "Phnom Penh",
            "event_name": "National Games",
            "sport_name": "Football",
            "outcome": "approved",
            "note": "All good",
            "link": "https://app/x",
        },
    )
    assert "approved" in content.subject.lower()
    assert "All good" in content.text_body
    assert "https://app/x" in content.text_body


def test_render_review_outcome_escapes_html():
    content = render_template(
        "review_outcome",
        {"participant_name": "<script>", "event_name": "E", "outcome": "rejected"},
    )
    # HTML body must escape the injected markup.
    assert "<script>" not in content.html_body
    assert "&lt;script&gt;" in content.html_body


def test_unknown_template_raises():
    with pytest.raises(UnknownTemplate):
        render_template("does_not_exist", {})


# ── Sender ───────────────────────────────────────────────────────────────────


def test_logging_sender_is_noop():
    # Must not raise and must not require any SMTP connection.
    LoggingEmailSender().send(
        to="x@y.z", content=EmailContent(subject="s", text_body="b")
    )


def test_get_email_sender_default_is_logging(monkeypatch):
    monkeypatch.setattr(sender_mod.settings, "EMAIL_ENABLED", False, raising=False)
    assert isinstance(get_email_sender(), LoggingEmailSender)


def test_get_email_sender_smtp_when_configured(monkeypatch):
    monkeypatch.setattr(sender_mod.settings, "EMAIL_ENABLED", True, raising=False)
    monkeypatch.setattr(sender_mod.settings, "SMTP_HOST", "smtp.example", raising=False)
    assert isinstance(get_email_sender(), SmtpEmailSender)


# ── Worker job ───────────────────────────────────────────────────────────────


async def test_send_email_job_uses_sender(monkeypatch):
    sent = {}

    class _Capture:
        def send(self, *, to, content):
            sent["to"] = to
            sent["subject"] = content.subject

    monkeypatch.setattr("app.workers.email.worker.get_email_sender", lambda: _Capture())
    result = await send_email_job(
        {},
        to="a@b.c",
        template="registration_confirmation",
        context={"event_name": "Games"},
    )
    assert result["status"] == "sent"
    assert sent["to"] == "a@b.c"
    assert "Games" in sent["subject"]


async def test_send_email_job_unknown_template_returns_failed(monkeypatch):
    monkeypatch.setattr(
        "app.workers.email.worker.get_email_sender",
        lambda: LoggingEmailSender(),
    )
    result = await send_email_job({}, to="a@b.c", template="nope", context={})
    assert result["status"] == "failed"
