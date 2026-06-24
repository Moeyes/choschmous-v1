"""Tests for the federation Survey-by-Category endpoints (`/api/v1/surveys/category`).

Covers: federation scoping (own sport forced, body sport_id ignored), org block,
phase gating, admin free-targeting, the upsert delete-removed behaviour, and the
read endpoint.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from src.models.enum.event import PhaseStatus, eventType
from src.models.enum.user import UserRole
from src.models.events import Events
from src.models.sport import Sport
from tests.conftest import make_user

CATEGORY_URL = "/api/v1/surveys/category"


async def _make_sport(db: AsyncSession, name_kh: str = "បាល់ទាត់") -> Sport:
    sport = Sport(name_kh=name_kh, sport_type=name_kh)
    db.add(sport)
    await db.flush()
    return sport


async def _make_event(
    db: AsyncSession, *, category_phase: PhaseStatus = PhaseStatus.OPEN
) -> Events:
    event = Events(
        name_kh="ព្រឹត្តិការណ៍សាកល្បង",
        type=eventType.NATIONAL,
        survey_category_status=category_phase,
    )
    db.add(event)
    await db.flush()
    return event


async def test_federation_upsert_scopes_to_own_sport(client, db_session, as_user):
    own = await _make_sport(db_session, "បាល់ទាត់")
    other = await _make_sport(db_session, "បាល់ទះ")
    event = await _make_event(db_session)
    as_user(make_user(UserRole.FEDERATION, sport_id=own.id))

    # Federation deliberately submits a *different* sport_id — it must be
    # silently overridden to the federation's own sport.
    resp = await client.post(
        CATEGORY_URL,
        json={
            "event_id": event.id,
            "sport_id": other.id,
            "categories": [
                {"name": "បាល់ទាត់បុរស", "gender": "MALE"},
                {"name": "បាល់ទាត់នារី", "gender": "FEMALE"},
            ],
        },
    )

    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert {r["category"] for r in rows} == {"បាល់ទាត់បុរស", "បាល់ទាត់នារី"}
    assert all(r["sports_id"] == own.id for r in rows)


async def test_upsert_deletes_removed_rows(client, db_session, as_user):
    sport = await _make_sport(db_session)
    event = await _make_event(db_session)
    as_user(make_user(UserRole.FEDERATION, sport_id=sport.id))

    first = await client.post(
        CATEGORY_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "categories": [
                {"name": "A", "gender": "MALE"},
                {"name": "B", "gender": "FEMALE"},
                {"name": "C", "gender": "MIXED"},
            ],
        },
    )
    assert first.status_code == 200, first.text
    assert len(first.json()) == 3

    # Resubmit without "B" — it must be deleted.
    second = await client.post(
        CATEGORY_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "categories": [
                {"name": "A", "gender": "MALE"},
                {"name": "C", "gender": "MIXED"},
            ],
        },
    )
    assert second.status_code == 200, second.text
    assert {r["category"] for r in second.json()} == {"A", "C"}


async def test_organization_user_forbidden(client, db_session, as_user):
    sport = await _make_sport(db_session)
    event = await _make_event(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=1))

    resp = await client.post(
        CATEGORY_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "categories": [{"name": "A", "gender": "MALE"}],
        },
    )
    assert resp.status_code == 403, resp.text


async def test_phase_closed_forbidden(client, db_session, as_user):
    sport = await _make_sport(db_session)
    event = await _make_event(db_session, category_phase=PhaseStatus.CLOSED)
    as_user(make_user(UserRole.FEDERATION, sport_id=sport.id))

    resp = await client.post(
        CATEGORY_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "categories": [{"name": "A", "gender": "MALE"}],
        },
    )
    assert resp.status_code == 403, resp.text
    assert "not currently open" in resp.json()["detail"]


async def test_admin_can_target_any_sport(client, db_session, as_user):
    sport = await _make_sport(db_session)
    event = await _make_event(db_session)
    as_user(make_user(UserRole.ADMIN))

    resp = await client.post(
        CATEGORY_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "categories": [{"name": "A", "gender": "MALE"}],
        },
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()[0]["sports_id"] == sport.id


async def test_federation_without_sport_rejected(client, db_session, as_user):
    sport = await _make_sport(db_session)
    event = await _make_event(db_session)
    as_user(make_user(UserRole.FEDERATION, sport_id=None))

    resp = await client.post(
        CATEGORY_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "categories": [{"name": "A", "gender": "MALE"}],
        },
    )
    assert resp.status_code == 400, resp.text


async def test_event_not_found(client, db_session, as_user):
    sport = await _make_sport(db_session)
    as_user(make_user(UserRole.FEDERATION, sport_id=sport.id))

    resp = await client.post(
        CATEGORY_URL,
        json={
            "event_id": 999_999,
            "sport_id": sport.id,
            "categories": [{"name": "A", "gender": "MALE"}],
        },
    )
    assert resp.status_code == 404, resp.text


async def test_get_returns_current_list(client, db_session, as_user):
    sport = await _make_sport(db_session)
    event = await _make_event(db_session)
    as_user(make_user(UserRole.FEDERATION, sport_id=sport.id))

    await client.post(
        CATEGORY_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "categories": [
                {"name": "A", "gender": "MALE"},
                {"name": "B", "gender": "FEMALE"},
            ],
        },
    )

    resp = await client.get(
        CATEGORY_URL, params={"event_id": event.id, "sport_id": sport.id}
    )
    assert resp.status_code == 200, resp.text
    assert {r["category"] for r in resp.json()} == {"A", "B"}
