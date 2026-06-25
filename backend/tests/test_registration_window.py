"""registration-window: GET /dashboard/registration-window aggregates the
per-event registration phases into one system-wide headline.
"""

from datetime import date, timedelta

from src.models.enum.event import PhaseStatus
from src.models.enum.user import UserRole
from tests.conftest import make_user
from tests.factories import make_event


async def test_window_unknown_when_no_events(client, db_session, as_user):
    as_user(make_user(UserRole.ADMIN))
    resp = await client.get("/api/v1/dashboard/registration-window")
    assert resp.status_code == 200, resp.text
    assert resp.json()["data"]["status"] == "unknown"


async def test_window_open_reports_soonest_close(client, db_session, as_user):
    # AUTO event whose window includes today → open; close date surfaced.
    today = date.today()
    ev = await make_event(db_session, registration=PhaseStatus.AUTO)
    ev.registration_open_date = today - timedelta(days=2)
    ev.registration_close_date = today + timedelta(days=5)
    await db_session.commit()
    as_user(make_user(UserRole.ORGANIZATION))

    resp = await client.get("/api/v1/dashboard/registration-window")
    data = resp.json()["data"]
    assert data["status"] == "open"
    assert data["closesOn"] == (today + timedelta(days=5)).isoformat()


async def test_window_scheduled_reports_nearest_open(client, db_session, as_user):
    today = date.today()
    ev = await make_event(db_session, registration=PhaseStatus.AUTO)
    ev.registration_open_date = today + timedelta(days=10)
    ev.registration_close_date = today + timedelta(days=20)
    await db_session.commit()
    as_user(make_user(UserRole.ADMIN))

    resp = await client.get("/api/v1/dashboard/registration-window")
    data = resp.json()["data"]
    assert data["status"] == "scheduled"
    assert data["opensOn"] == (today + timedelta(days=10)).isoformat()


async def test_window_closed_when_all_past(client, db_session, as_user):
    today = date.today()
    ev = await make_event(db_session, registration=PhaseStatus.AUTO)
    ev.registration_open_date = today - timedelta(days=30)
    ev.registration_close_date = today - timedelta(days=10)
    await db_session.commit()
    as_user(make_user(UserRole.ADMIN))

    resp = await client.get("/api/v1/dashboard/registration-window")
    assert resp.json()["data"]["status"] == "closed"


async def test_window_open_via_manual_status_without_dates(client, db_session, as_user):
    # Manual OPEN with no dates is still "open" (closesOn stays null).
    await make_event(db_session, registration=PhaseStatus.OPEN)
    as_user(make_user(UserRole.ADMIN))

    resp = await client.get("/api/v1/dashboard/registration-window")
    data = resp.json()["data"]
    assert data["status"] == "open"
    assert data["closesOn"] is None
