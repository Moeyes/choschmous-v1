"""Email templates (CHOS-406).

Two transactional templates — ``registration_confirmation`` and
``review_outcome``. Rendered with plain Python string formatting (no template
engine dependency); each returns an :class:`EmailContent` with a plain-text body
and a matching minimal HTML body.

Adding a template = add a render function + register it in ``_TEMPLATES``. The
worker and the enqueue helper reference templates by name only, so callers never
import the render functions directly.
"""

from __future__ import annotations

from dataclasses import dataclass
from html import escape


@dataclass(frozen=True)
class EmailContent:
    subject: str
    text_body: str
    html_body: str | None = None


class UnknownTemplate(ValueError):
    """Raised when an email template name is not registered."""


def _html_document(title: str, paragraphs: list[str]) -> str:
    body = "\n".join(f"<p>{escape(p)}</p>" for p in paragraphs)
    return (
        "<!doctype html><html><body "
        'style="font-family:Arial,Helvetica,sans-serif;color:#1b2a32;line-height:1.5">'
        f'<h2 style="color:#1B4B65">{escape(title)}</h2>'
        f"{body}"
        '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0">'
        '<p style="font-size:12px;color:#64748b">'
        "MoEYS Sports Registration — this is an automated message, please do not "
        "reply.</p>"
        "</body></html>"
    )


def _registration_confirmation(ctx: dict) -> EmailContent:
    name = ctx.get("participant_name", "the participant")
    event = ctx.get("event_name", "the event")
    org = ctx.get("organization_name")
    role = ctx.get("role", "participant")

    subject = f"Registration received — {event}"
    lines = [
        f"Dear {ctx.get('recipient_name', 'colleague')},",
        f"The registration of {name} ({role}) for {event} has been received"
        + (f" on behalf of {org}." if org else ".")
        + " It is now pending review.",
        "You will be notified when a review decision is made.",
    ]
    return EmailContent(
        subject=subject,
        text_body="\n\n".join(lines),
        html_body=_html_document(subject, lines),
    )


def _review_outcome(ctx: dict) -> EmailContent:
    name = ctx.get("participant_name", "A participant")
    event = ctx.get("event_name", "the event")
    sport = ctx.get("sport_name")
    outcome = str(ctx.get("outcome", "")).lower()
    note = ctx.get("note")
    link = ctx.get("link")

    outcome_word = {"approved": "approved", "rejected": "rejected"}.get(
        outcome, "reviewed"
    )
    where = f"{event}" + (f" ({sport})" if sport else "")
    subject = f"Registration {outcome_word} — {event}"
    lines = [
        f"Dear {ctx.get('recipient_name', 'colleague')},",
        f"The registration of {name} for {where} has been {outcome_word}.",
    ]
    if note:
        lines.append(f"Reviewer note: {note}")
    if link:
        lines.append(f"View details: {link}")
    return EmailContent(
        subject=subject,
        text_body="\n\n".join(lines),
        html_body=_html_document(subject, lines),
    )


_TEMPLATES = {
    "registration_confirmation": _registration_confirmation,
    "review_outcome": _review_outcome,
}


def render_template(template: str, context: dict) -> EmailContent:
    render = _TEMPLATES.get(template)
    if render is None:
        raise UnknownTemplate(template)
    return render(context or {})
