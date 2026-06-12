"""Tests for the Phase-2 server-side registration validation rules in
ParticipantService.register_participant (POST /api/registration)."""

from datetime import date

from src.models.athlete_participation import athlete_participation
from src.models.enum.event import AgeMode, PhaseStatus
from src.models.enum.user import UserRole
from tests.conftest import make_user
from tests.factories import (
    link_org_sport,
    make_category,
    make_event,
    make_org,
    make_sport,
    make_sports_event,
)

REG_URL = "/api/registration"


async def _valid_setup(db, **event_kwargs):
    """Event (registration open) + sport + org + sports_event + survey-② link +
    category. Returns (event, sport, org, category)."""
    event_kwargs.setdefault("registration", PhaseStatus.OPEN)
    event = await make_event(db, **event_kwargs)
    sport = await make_sport(db)
    org = await make_org(db)
    await make_sports_event(db, event, sport)
    await link_org_sport(db, event, sport, org)
    category = await make_category(db, event, sport)
    return event, sport, org, category


def _athlete_body(event, sport, org, category, *, dob="2010-01-01", docs=None, force=False):
    body = {
        "eventId": event.id,
        "organizationId": org.id,
        "sportId": sport.id,
        "categoryId": category.id if category else None,
        "lastNameKhmer": "សុខ",
        "firstNameKhmer": "ដារ៉ា",
        "lastNameLatin": "Sok",
        "firstNameLatin": "Dara",
        "phone": "012345678",
        "gender": "MALE",
        "dateOfBirth": dob,
        "idDocType": "BirthCertificate",
        "role": "Athlete",
        "force": force,
    }
    body.update({"birthCertificateUrl": "https://x/bc.pdf"} if docs is None else docs)
    return body


async def test_happy_path_athlete(client, db_session, as_user):
    event, sport, org, category = await _valid_setup(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    resp = await client.post(REG_URL, json=_athlete_body(event, sport, org, category))
    assert resp.status_code == 201, resp.text
    assert resp.json()["status"] == "success"


async def test_registration_closed(client, db_session, as_user):
    event, sport, org, category = await _valid_setup(
        db_session, registration=PhaseStatus.CLOSED
    )
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    resp = await client.post(REG_URL, json=_athlete_body(event, sport, org, category))
    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"]["code"] == "REGISTRATION_CLOSED"


async def test_sport_not_eligible(client, db_session, as_user):
    # event + sport + org but NO survey-② link
    event = await make_event(db_session, registration=PhaseStatus.OPEN)
    sport = await make_sport(db_session)
    org = await make_org(db_session)
    await make_sports_event(db_session, event, sport)
    category = await make_category(db_session, event, sport)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    resp = await client.post(REG_URL, json=_athlete_body(event, sport, org, category))
    assert resp.status_code == 403, resp.text
    assert resp.json()["detail"]["code"] == "SPORT_NOT_ELIGIBLE"


async def test_category_invalid(client, db_session, as_user):
    event, sport, org, _ = await _valid_setup(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    body = _athlete_body(event, sport, org, None)
    body["categoryId"] = 999_999  # does not exist
    resp = await client.post(REG_URL, json=body)
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"]["code"] == "CATEGORY_INVALID"


async def test_age_out_of_range_birth_year(client, db_session, as_user):
    event, sport, org, category = await _valid_setup(
        db_session, age_mode=AgeMode.BIRTH_YEAR, age_min=2008, age_max=2012
    )
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    body = _athlete_body(event, sport, org, category, dob="2000-01-01")
    resp = await client.post(REG_URL, json=body)
    assert resp.status_code == 422, resp.text
    detail = resp.json()["detail"]
    assert detail["code"] == "AGE_OUT_OF_RANGE"
    assert detail["params"]["min"] == 2008 and detail["params"]["max"] == 2012


async def test_document_required_minor(client, db_session, as_user):
    event, sport, org, category = await _valid_setup(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    # under-18 (born 2010) without a birth certificate
    body = _athlete_body(event, sport, org, category, dob="2010-01-01", docs={})
    resp = await client.post(REG_URL, json=body)
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"]["code"] == "DOCUMENT_REQUIRED"


async def test_document_required_adult(client, db_session, as_user):
    event, sport, org, category = await _valid_setup(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    # adult (born 1990) with neither national ID nor passport
    body = _athlete_body(
        event, sport, org, category, dob="1990-01-01",
        docs={"birthCertificateUrl": "https://x/bc.pdf"},
    )
    resp = await client.post(REG_URL, json=body)
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"]["code"] == "DOCUMENT_REQUIRED"


async def test_quota_full(client, db_session, as_user):
    event = await make_event(db_session, registration=PhaseStatus.OPEN)
    sport = await make_sport(db_session)
    org = await make_org(db_session)
    await make_sports_event(db_session, event, sport, quota_athletes_per_org=1)
    await link_org_sport(db_session, event, sport, org)
    category = await make_category(db_session, event, sport)

    # one athlete already registered for (org, event, sport) → quota of 1 is full
    db_session.add(
        athlete_participation(
            events_id=event.id, sports_id=sport.id, organization_id=org.id,
            category_id=category.id,
        )
    )
    await db_session.flush()

    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))
    resp = await client.post(REG_URL, json=_athlete_body(event, sport, org, category))
    assert resp.status_code == 409, resp.text
    assert resp.json()["detail"]["code"] == "QUOTA_FULL"


async def test_duplicate_suspect_then_force(client, db_session, as_user):
    event, sport, org, category = await _valid_setup(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))
    # Build the body once (plain JSON): the duplicate request's rollback expires
    # the shared ORM objects, so re-reading their attributes afterward would fail.
    body = _athlete_body(event, sport, org, category)

    first = await client.post(REG_URL, json=body)
    assert first.status_code == 201, first.text

    # same name + DoB again → soft-duplicate 409
    dup = await client.post(REG_URL, json=body)
    assert dup.status_code == 409, dup.text
    assert dup.json()["detail"]["duplicate_suspect"] is True

    # override with force
    forced = await client.post(REG_URL, json={**body, "force": True})
    assert forced.status_code == 201, forced.text
