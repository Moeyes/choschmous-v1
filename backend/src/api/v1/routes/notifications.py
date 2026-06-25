"""In-app notification inbox routes (CHOS-406).

Every endpoint is scoped to the authenticated user — a user can only see and
mutate their own notifications. Mounted under /notifications with the standard
auth dependency (see src/api/main.py).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.deps import get_current_user, get_db
from src.models.user import User
from src.schemas.notification import (
    MarkReadResult,
    NotificationList,
    NotificationOut,
    UnreadCount,
)
from src.services.notification_service import NotificationService

router = APIRouter()


@router.get("", response_model=NotificationList)
async def list_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NotificationList:
    """List the current user's notifications, newest first. ``unread_only``
    filters to unread; ``total`` reflects the active filter, ``unread`` is always
    the user's full unread count (for the badge)."""
    items, total, unread = await NotificationService(db).list_for_user(
        current_user.id, skip=skip, limit=limit, unread_only=unread_only
    )
    return NotificationList(
        items=[NotificationOut.model_validate(n) for n in items],
        total=total,
        unread=unread,
    )


@router.get("/unread-count", response_model=UnreadCount)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UnreadCount:
    """Unread count for the inbox badge (cheap; polled by the UI)."""
    return UnreadCount(
        unread=await NotificationService(db).unread_count(current_user.id)
    )


@router.post("/{notification_id}/read", response_model=MarkReadResult)
async def mark_read(
    notification_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MarkReadResult:
    """Mark one notification read. 404 if it does not exist, is not the caller's,
    or was already read."""
    updated = await NotificationService(db).mark_read(current_user.id, notification_id)
    if updated == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return MarkReadResult(updated=updated)


@router.post("/read-all", response_model=MarkReadResult)
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MarkReadResult:
    """Mark all of the caller's notifications read."""
    return MarkReadResult(
        updated=await NotificationService(db).mark_all_read(current_user.id)
    )
