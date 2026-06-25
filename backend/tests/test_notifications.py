"""CHOS-406: in-app notification inbox — service + routes."""

import uuid

import pytest

from src.models.enum.user import UserRole
from src.models.user import User
from src.services.notification_service import NotificationService

pytestmark = pytest.mark.asyncio


async def _persist_user(db, *, email: str | None = None) -> User:
    uid = uuid.uuid4()
    user = User(
        id=uid,
        kh_family_name="ត",
        kh_given_name="ត",
        en_family_name="Test",
        en_given_name="User",
        email=email or f"user-{uid}@test.local",
        username=f"user-{uid}",
        hashed_password="x",
        role=UserRole.ADMIN,
    )
    db.add(user)
    await db.flush()
    return user


# ── Service ────────────────────────────────────────────────────────────────


async def test_create_and_list(db_session):
    user = await _persist_user(db_session)
    svc = NotificationService(db_session)
    await svc.create(user_id=user.id, type="t", title="First", body="b1")
    await svc.create(user_id=user.id, type="t", title="Second", link="/x")

    items, total, unread = await svc.list_for_user(user.id)
    assert total == 2
    assert unread == 2
    # newest first
    assert [n.title for n in items] == ["Second", "First"]


async def test_unread_count_and_mark_read(db_session):
    user = await _persist_user(db_session)
    svc = NotificationService(db_session)
    n1 = await svc.create(user_id=user.id, type="t", title="a")
    await svc.create(user_id=user.id, type="t", title="b")

    assert await svc.unread_count(user.id) == 2

    updated = await svc.mark_read(user.id, n1.id)
    assert updated == 1
    assert await svc.unread_count(user.id) == 1

    # marking an already-read row again is a no-op
    assert await svc.mark_read(user.id, n1.id) == 0


async def test_mark_all_read(db_session):
    user = await _persist_user(db_session)
    svc = NotificationService(db_session)
    await svc.create(user_id=user.id, type="t", title="a")
    await svc.create(user_id=user.id, type="t", title="b")

    assert await svc.mark_all_read(user.id) == 2
    assert await svc.unread_count(user.id) == 0


async def test_isolation_between_users(db_session):
    alice = await _persist_user(db_session, email="alice@test.local")
    bob = await _persist_user(db_session, email="bob@test.local")
    svc = NotificationService(db_session)
    n_alice = await svc.create(user_id=alice.id, type="t", title="for alice")
    await svc.create(user_id=bob.id, type="t", title="for bob")

    # Bob cannot mark Alice's notification read.
    assert await svc.mark_read(bob.id, n_alice.id) == 0
    assert await svc.unread_count(alice.id) == 1

    items, total, _ = await svc.list_for_user(bob.id)
    assert total == 1
    assert items[0].title == "for bob"


async def test_unread_only_filter(db_session):
    user = await _persist_user(db_session)
    svc = NotificationService(db_session)
    n1 = await svc.create(user_id=user.id, type="t", title="read me")
    await svc.create(user_id=user.id, type="t", title="unread")
    await svc.mark_read(user.id, n1.id)

    items, total, unread = await svc.list_for_user(user.id, unread_only=True)
    assert total == 1  # filtered total
    assert unread == 1  # full unread count
    assert items[0].title == "unread"


# ── Routes ─────────────────────────────────────────────────────────────────


async def test_routes_list_count_and_read(client, db_session, as_user):
    user = await _persist_user(db_session)
    as_user(user)
    svc = NotificationService(db_session)
    n1 = await svc.create(user_id=user.id, type="t", title="hello")
    await svc.create(user_id=user.id, type="t", title="world")

    r = await client.get("/api/v1/notifications")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 2 and body["unread"] == 2
    assert {i["title"] for i in body["items"]} == {"hello", "world"}

    r = await client.get("/api/v1/notifications/unread-count")
    assert r.json() == {"unread": 2}

    r = await client.post(f"/api/v1/notifications/{n1.id}/read")
    assert r.status_code == 200 and r.json()["updated"] == 1

    r = await client.get("/api/v1/notifications/unread-count")
    assert r.json() == {"unread": 1}

    r = await client.post("/api/v1/notifications/read-all")
    assert r.status_code == 200 and r.json()["updated"] == 1


async def test_route_mark_read_foreign_is_404(client, db_session, as_user):
    owner = await _persist_user(db_session, email="owner@test.local")
    other = await _persist_user(db_session, email="other@test.local")
    svc = NotificationService(db_session)
    n = await svc.create(user_id=owner.id, type="t", title="secret")

    as_user(other)
    r = await client.post(f"/api/v1/notifications/{n.id}/read")
    assert r.status_code == 404
