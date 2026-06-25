"""Notification dispatch (CHOS-406).

Thin orchestration over the in-app inbox (:class:`NotificationService`) and the
transactional-email queue (:func:`enqueue_email`). It is the single place the
business flows call to "tell someone something happened".

Hard rule: dispatch is a SIDE EFFECT and must never break the action that
triggered it. Every public function here swallows its own errors (logs them) so
a failed notification/email can never turn a successful registration or review
into a 500. The in-app write is committed on the passed-in session AFTER the
caller has already committed its own work.
"""

from __future__ import annotations

import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from src.models.user import User
from src.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


def _abs_link(path: str | None) -> str | None:
    """Build an absolute URL from a relative path when PUBLIC_APP_URL is set,
    else return the relative path (still useful for in-app routing)."""
    if not path:
        return None
    base = settings.PUBLIC_APP_URL
    if base:
        return f"{base.rstrip('/')}{path}"
    return path


async def _org_users(db: AsyncSession, org_id: int) -> list[User]:
    rows = await db.execute(
        select(User).where(User.organization_id == org_id, User.is_active.is_(True))
    )
    return list(rows.scalars().all())


async def notify_registration_confirmation(
    db: AsyncSession,
    *,
    recipient: User,
    participant_name: str,
    event_name: str,
    organization_name: str | None = None,
    role: str = "participant",
    link: str | None = None,
) -> None:
    """Confirm to the registrar that a participant registration was received."""
    if getattr(recipient, "id", None) is not None:
        try:
            svc = NotificationService(db)
            await svc.create(
                user_id=recipient.id,
                type="registration_confirmation",
                title="Registration received",
                body=f"{participant_name} ({role}) was registered for {event_name}.",
                link=link,
            )
            await db.commit()
        except Exception:
            logger.warning("registration notification failed", exc_info=True)
            try:
                await db.rollback()
            except Exception:
                pass

    if getattr(recipient, "email", None):
        await _enqueue_email_safe(
            to=recipient.email,
            template="registration_confirmation",
            context={
                "recipient_name": _display_name(recipient),
                "participant_name": participant_name,
                "event_name": event_name,
                "organization_name": organization_name,
                "role": role,
            },
        )


async def notify_review_outcome(
    db: AsyncSession,
    *,
    org_id: int,
    participant_name: str,
    event_name: str,
    sport_name: str | None,
    outcome: str,
    note: str | None = None,
    link: str | None = None,
) -> None:
    """Notify the reviewed org's users that a submission was approved/rejected."""
    try:
        recipients = await _org_users(db, org_id)
    except Exception:
        logger.warning(
            "review notification: failed to resolve org users", exc_info=True
        )
        recipients = []

    abs_link = _abs_link(link)
    outcome_word = {"approve": "approved", "reject": "rejected"}.get(
        outcome.lower(), outcome.lower()
    )

    recipients = [u for u in recipients if getattr(u, "id", None) is not None]
    if recipients:
        try:
            svc = NotificationService(db)
            for user in recipients:
                await svc.create(
                    user_id=user.id,
                    type="review_outcome",
                    title=f"Submission {outcome_word}",
                    body=f"{participant_name} for {event_name}"
                    + (f" ({sport_name})" if sport_name else "")
                    + f" was {outcome_word}."
                    + (f" Note: {note}" if note else ""),
                    link=link,
                )
            await db.commit()
        except Exception:
            logger.warning("review notification failed", exc_info=True)
            try:
                await db.rollback()
            except Exception:
                pass

    for user in recipients:
        if getattr(user, "email", None):
            await _enqueue_email_safe(
                to=user.email,
                template="review_outcome",
                context={
                    "recipient_name": _display_name(user),
                    "participant_name": participant_name,
                    "event_name": event_name,
                    "sport_name": sport_name,
                    "outcome": outcome_word,
                    "note": note,
                    "link": abs_link,
                },
            )


async def notify_user(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
) -> None:
    """Generic in-app notification (no email). Best-effort."""
    if user_id is None:
        return
    try:
        svc = NotificationService(db)
        await svc.create(user_id=user_id, type=type, title=title, body=body, link=link)
        await db.commit()
    except Exception:
        logger.warning("notify_user failed", exc_info=True)
        try:
            await db.rollback()
        except Exception:
            pass


async def _enqueue_email_safe(*, to: str, template: str, context: dict) -> None:
    # Imported lazily so importing this module doesn't pull arq/redis in contexts
    # that only need the in-app inbox (and so enqueue stays fully optional).
    try:
        from app.workers.queue import enqueue_email

        await enqueue_email(to=to, template=template, context=context)
    except Exception:
        logger.warning("email enqueue failed (to=%s template=%s)", to, template)


def _display_name(user: User) -> str:
    return (
        getattr(user, "full_name", None)
        or " ".join(
            filter(
                None,
                [
                    getattr(user, "en_given_name", None),
                    getattr(user, "en_family_name", None),
                ],
            )
        ).strip()
        or getattr(user, "username", None)
        or "colleague"
    )
