"""CHOS-304: global search (⌘K palette) — DB provider + role scoping.

Verifies events/orgs search, athlete PII scoping (an ORGANIZATION user only sees
its own org's athletes; an admin sees all), type filtering, and that the default
provider is the DB one.
"""

from datetime import date

import pytest

from app.infrastructure.search.db_provider import DbSearchProvider
from app.infrastructure.search.factory import get_search_provider
from src.models.athlete_participation import athlete_participation as AthleteParticipation
from src.models.athletes import athletes as Athlete
from src.models.enroll import Enroll
from src.models.enum.user import IdDocumentType, UserRole, genderEnum
from tests.conftest import make_user
from tests.factories import make_event, make_org, make_sport


async def _make_athlete(db, org, *, family: str, given: str, event=None, sport=None):
    enroll = Enroll(
        kh_family_name=family,
        kh_given_name=given,
        en_family_name=family,
        en_given_name=given,
        phonenumber="012000000",
        gender=genderEnum.MALE,
        date_of_birth=date(2008, 1, 1),
        id_document_type=IdDocumentType.CAM_NID,
    )
    db.add(enroll)
    await db.flush()
    athlete = Athlete(enroll_id=enroll.id)
    db.add(athlete)
    await db.flush()
    part = AthleteParticipation(
        athletes_id=athlete.id,
        organization_id=org.id,
        events_id=event.id if event else None,
        sports_id=sport.id if sport else None,
    )
    db.add(part)
    await db.flush()
    return enroll


# --------------------------------------------------------------------------- #
def test_factory_default_is_db_provider(db_session):
    assert isinstance(get_search_provider(db_session), DbSearchProvider)


@pytest.mark.asyncio
async def test_search_events_and_orgs(client, db_session, as_user):
    await make_event(db_session)  # name "ព្រឹត្តិការណ៍សាកល្បង"
    await make_org(db_session, name_kh="សហព័ន្ធកីឡាជាតិ")
    as_user(make_user(UserRole.ADMIN))

    res = await client.post("/api/v1/search", json={"query": "សហព័ន្ធ"})
    assert res.status_code == 200
    body = res.json()
    assert body["count"] >= 1
    assert all(h["type"] in ("event", "organization", "athlete") for h in body["data"])
    assert any(h["type"] == "organization" for h in body["data"])


@pytest.mark.asyncio
async def test_type_filter_returns_only_requested(client, db_session, as_user):
    await make_event(db_session)
    await make_org(db_session, name_kh="ព្រឹត្តិការណ៍កីឡា")  # also matches query below
    as_user(make_user(UserRole.ADMIN))

    res = await client.post(
        "/api/v1/search", json={"query": "ព្រឹត្តិការណ៍", "types": ["event"]}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["count"] >= 1
    assert {h["type"] for h in body["data"]} == {"event"}


@pytest.mark.asyncio
async def test_athlete_search_is_org_scoped(client, db_session, as_user):
    org_a = await make_org(db_session, name_kh="អង្គការ-A")
    org_b = await make_org(db_session, name_kh="អង្គការ-B")
    await _make_athlete(db_session, org_a, family="SOK", given="DARA")
    await _make_athlete(db_session, org_b, family="SOK", given="VEASNA")

    # ORGANIZATION user of org_a only sees its own athlete.
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org_a.id))
    res = await client.post(
        "/api/v1/search", json={"query": "SOK", "types": ["athlete"]}
    )
    assert res.status_code == 200
    athletes = [h for h in res.json()["data"] if h["type"] == "athlete"]
    assert len(athletes) == 1
    assert athletes[0]["subtitle"] == "អង្គការ-A"

    # Admin sees both.
    as_user(make_user(UserRole.ADMIN))
    res = await client.post(
        "/api/v1/search", json={"query": "SOK", "types": ["athlete"]}
    )
    athletes = [h for h in res.json()["data"] if h["type"] == "athlete"]
    assert len(athletes) == 2


@pytest.mark.asyncio
async def test_org_user_without_org_gets_no_athletes(client, db_session, as_user):
    org = await make_org(db_session, name_kh="អង្គការ-C")
    await _make_athlete(db_session, org, family="CHAN", given="DARA")
    # Org user with no org linked must not be able to enumerate athletes.
    as_user(make_user(UserRole.ORGANIZATION, organization_id=None))

    res = await client.post(
        "/api/v1/search", json={"query": "CHAN", "types": ["athlete"]}
    )
    assert res.status_code == 200
    assert [h for h in res.json()["data"] if h["type"] == "athlete"] == []


@pytest.mark.asyncio
async def test_search_requires_nonempty_query(client, as_user):
    as_user(make_user(UserRole.ADMIN))
    res = await client.post("/api/v1/search", json={"query": ""})
    assert res.status_code == 422
