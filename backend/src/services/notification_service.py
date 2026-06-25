"""In-app notification inbox service (CHOS-406).

Owns reads/writes of the per-user notification inbox. Creation is intentionally
forgiving: ``create`` flushes but does NOT commit, so it can either join the
caller's transaction or be committed by the caller — and the higher-level
dispatcher (``notification_dispatch``) wraps it so a notification failure can
never break the business action that triggered it.
"""

from __future__ import annotations

import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.notification import Notification


class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        *,
        user_id: uuid.UUID,
        type: str,
        title: str,
        body: str | None = None,
        link: str | None = None,
    ) -> Notification:
        """Add a notification to a user's inbox. Flushes (so the row gets an id)
        but leaves the commit to the caller."""
        note = Notification(
            user_id=user_id,
            type=type,
            title=title,
            body=body,
            link=link,
        )
        self.db.add(note)
        await self.db.flush()
        return note

    async def list_for_user(
        self,
        user_id: uuid.UUID,
        *,
        skip: int = 0,
        limit: int = 20,
        unread_only: bool = False,
    ) -> tuple[list[Notification], int, int]:
        """Return ``(items, total, unread)`` for the user's inbox, newest first."""
        base = select(Notification).where(Notification.user_id == user_id)
        if unread_only:
            base = base.where(Notification.read_at.is_(None))

        total = (
            await self.db.execute(select(func.count()).select_from(base.subquery()))
        ).scalar() or 0

        unread = (
            await self.db.execute(
                select(func.count())
                .select_from(Notification)
                .where(
                    Notification.user_id == user_id,
                    Notification.read_at.is_(None),
                )
            )
        ).scalar() or 0

        rows = (
            (
                await self.db.execute(
                    base.order_by(
                        Notification.created_at.desc(), Notification.id.desc()
                    )
                    .offset(skip)
                    .limit(limit)
                )
            )
            .scalars()
            .all()
        )
        return list(rows), int(total), int(unread)

    async def unread_count(self, user_id: uuid.UUID) -> int:
        return int(
            (
                await self.db.execute(
                    select(func.count())
                    .select_from(Notification)
                    .where(
                        Notification.user_id == user_id,
                        Notification.read_at.is_(None),
                    )
                )
            ).scalar()
            or 0
        )

    async def mark_read(self, user_id: uuid.UUID, notification_id: int) -> int:
        """Stamp one notification read. Scoped to the owner so a user can never
        mark someone else's notification. Returns rows updated (0 or 1)."""
        result = await self.db.execute(
            update(Notification)
            .where(
                Notification.id == notification_id,
                Notification.user_id == user_id,
                Notification.read_at.is_(None),
            )
            .values(read_at=func.now())
        )
        await self.db.commit()
        return result.rowcount or 0

    async def mark_all_read(self, user_id: uuid.UUID) -> int:
        result = await self.db.execute(
            update(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.read_at.is_(None),
            )
            .values(read_at=func.now())
        )
        await self.db.commit()
        return result.rowcount or 0
