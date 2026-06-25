"""CHOS-501 — minors' PII guardian-consent enforcement in the registration flow.

Reuses the registration-validation helpers (_valid_setup / _athlete_body) so the
setup matches the real POST /api/v1/registration path. Enforcement is gated by
``settings.MINOR_CONSENT_ENFORCED`` (ships dark), so the default-off behaviour is
asserted too.
"""

from sqlalchemy import select

from core.config import settings
from src.models.enum.user import UserRole
from src.models.minor_consent import MinorConsent
from tests.conftest import make_user
from tests.test_registration_validation import _athlete_body, _valid_setup, REG_URL

# A clearly-minor and a clearly-adult date of birth (today = 2026).
MINOR_DOB = "2012-01-01"
ADULT_DOB = "1990-01-01"


async def test_minor_without_consent_allowed_when_enforcement_off(
    client, db_session, as_user
):
    """Default (MINOR_CONSENT_ENFORCED off): a minor registers with no consent."""
    event, sport, org, category = await _valid_setup(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    body = _athlete_body(event, sport, org, category, dob=MINOR_DOB)
    resp = await client.post(REG_URL, json=body)
    assert resp.status_code == 201, resp.text


async def test_minor_without_consent_rejected_when_enforced(
    client, db_session, as_user, monkeypatch
):
    monkeypatch.setattr(settings, "MINOR_CONSENT_ENFORCED", True)
    event, sport, org, category = await _valid_setup(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    body = _athlete_body(event, sport, org, category, dob=MINOR_DOB)
    resp = await client.post(REG_URL, json=body)
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"]["code"] == "GUARDIAN_CONSENT_REQUIRED"


async def test_minor_with_consent_accepted_and_recorded(
    client, db_session, as_user, monkeypatch
):
    monkeypatch.setattr(settings, "MINOR_CONSENT_ENFORCED", True)
    event, sport, org, category = await _valid_setup(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    body = _athlete_body(event, sport, org, category, dob=MINOR_DOB)
    body.update(
        {
            "guardianConsent": True,
            "guardianName": "Sok Mealea",
            "guardianRelationship": "mother",
            "guardianPhone": "0123999888",
        }
    )
    resp = await client.post(REG_URL, json=body)
    assert resp.status_code == 201, resp.text
    enroll_id = resp.json()["enroll_id"]

    consent = (
        await db_session.execute(
            select(MinorConsent).where(MinorConsent.enroll_id == enroll_id)
        )
    ).scalar_one()
    assert consent.guardian_name == "Sok Mealea"
    assert consent.guardian_relationship == "mother"
    assert consent.consent_version == settings.MINOR_CONSENT_POLICY_VERSION
    # Guardian phone round-trips through the transparent encrypted column.
    assert consent.guardian_phone == "0123999888"


async def test_incomplete_consent_rejected_when_enforced(
    client, db_session, as_user, monkeypatch
):
    """guardianConsent=True but no guardian name/relationship is still a reject."""
    monkeypatch.setattr(settings, "MINOR_CONSENT_ENFORCED", True)
    event, sport, org, category = await _valid_setup(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    body = _athlete_body(event, sport, org, category, dob=MINOR_DOB)
    body["guardianConsent"] = True  # but no guardianName/Relationship
    resp = await client.post(REG_URL, json=body)
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"]["code"] == "GUARDIAN_CONSENT_REQUIRED"


async def test_adult_unaffected_when_enforced(
    client, db_session, as_user, monkeypatch
):
    """An adult registers with no guardian consent even when enforcement is on."""
    monkeypatch.setattr(settings, "MINOR_CONSENT_ENFORCED", True)
    event, sport, org, category = await _valid_setup(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))

    body = _athlete_body(
        event,
        sport,
        org,
        category,
        dob=ADULT_DOB,
        docs={"nationalIdUrl": "https://x/nid.pdf"},
    )
    resp = await client.post(REG_URL, json=body)
    assert resp.status_code == 201, resp.text
    # No consent record written for an adult.
    rows = (
        await db_session.execute(
            select(MinorConsent).where(
                MinorConsent.enroll_id == resp.json()["enroll_id"]
            )
        )
    ).scalars().all()
    assert rows == []
