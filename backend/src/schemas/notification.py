"""Notification inbox schemas (CHOS-406)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    body: str | None = None
    link: str | None = None
    read_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationList(BaseModel):
    items: list[NotificationOut]
    total: int
    unread: int


class UnreadCount(BaseModel):
    unread: int


class MarkReadResult(BaseModel):
    updated: int
