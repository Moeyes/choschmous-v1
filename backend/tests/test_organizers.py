"""Tests for Phase 4 — organizer roles (admin-extensible) and event-level
organizer registration with the same document rules as participants."""

from src.models.enum.event import PhaseStatus
from src.models.enum.user import UserRole
from tests.conftest import make_user
from tests.factories import make_event, make_org

ROLES_URL = "/api/v1/organizer-roles"
ORG_REG_URL = "/api/v1/registration/organizer"


async def _make_role(
    db_session, *, name_en="Referee", name_kh="អាជ្ញាកណ្ដាល", active=True
):
    from src.models.organizer_role import OrganizerRole

    role = OrganizerRole(name_en=name_en, name_kh=name_kh, active=active)
    db_session.add(role)
    await db_session.flush()
    return role


def _person(**over):
    base = {
        "lastNameKhmer": "សុខ",
        "firstNameKhmer": "ដារា",
        "lastNameLatin": "Sok",
        "firstNameLatin": "Dara",
        "gender": "Male",
        "dateOfBirth": "1990-01-01",
        "phone": "012000111",
        "idDocType": "IDCard",
        "nationalIdPath": "/uploads/nid.jpg",
    }
    base.update(over)
    return base


async def test_admin_creates_and_lists_role(client, db_session, as_user):
    as_user(make_user(UserRole.ADMIN))
    resp = await client.post(
        ROLES_URL, json={"name_kh": "អ្នកថត", "name_en": "Photographer"}
    )
    assert resp.status_code == 201, resp.text
    rid = resp.json()["id"]

    list_resp = await client.get(ROLES_URL)
    assert list_resp.status_code == 200
    assert any(r["id"] == rid for r in list_resp.json())


async def test_create_role_rejects_duplicate(client, db_session, as_user):
    await _make_role(db_session, name_en="Medic", name_kh="វេជ្ជបណ្ឌិត")
    as_user(make_user(UserRole.ADMIN))
    resp = await client.post(
        ROLES_URL, json={"name_kh": "វេជ្ជបណ្ឌិត", "name_en": "Medic"}
    )
    assert resp.status_code == 409, resp.text


async def test_create_role_rejects_non_staff(client, db_session, as_user):
    as_user(make_user(UserRole.ORGANIZATION, organization_id=1))
    resp = await client.post(ROLES_URL, json={"name_kh": "X", "name_en": "Y"})
    assert resp.status_code in (401, 403), resp.text


async def test_list_roles_excludes_inactive_by_default(client, db_session, as_user):
    active = await _make_role(db_session, name_en="Active1", name_kh="សកម្ម")
    inactive = await _make_role(
        db_session, name_en="Inactive1", name_kh="អសកម្ម", active=False
    )
    as_user(make_user(UserRole.ADMIN))

    default = await client.get(ROLES_URL)
    ids = {r["id"] for r in default.json()}
    assert active.id in ids
    assert inactive.id not in ids

    all_resp = await client.get(f"{ROLES_URL}?all=true")
    all_ids = {r["id"] for r in all_resp.json()}
    assert inactive.id in all_ids


async def test_register_organizer_success(client, db_session, as_user):
    event = await make_event(db_session)  # registration OPEN by default
    org = await make_org(db_session)
    role = await _make_role(db_session)
    as_user(make_user(UserRole.ADMIN))

    resp = await client.post(
        ORG_REG_URL,
        json={
            "eventId": event.id,
            "organizationId": org.id,
            "organizerRoleId": role.id,
            **_person(),
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["event_id"] == event.id
    assert body["organizer_role_id"] == role.id
    assert body["role_name_en"] == "Referee"


async def test_register_organizer_under_18_requires_birth_cert(
    client, db_session, as_user
):
    event = await make_event(db_session)
    role = await _make_role(db_session)
    as_user(make_user(UserRole.ADMIN))

    resp = await client.post(
        ORG_REG_URL,
        json={
            "eventId": event.id,
            "organizerRoleId": role.id,
            **_person(dateOfBirth="2015-01-01", nationalIdPath=None),
        },
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"]["code"] == "DOCUMENT_REQUIRED"


async def test_register_organizer_inactive_role_rejected(client, db_session, as_user):
    event = await make_event(db_session)
    role = await _make_role(db_session, active=False)
    as_user(make_user(UserRole.ADMIN))

    resp = await client.post(
        ORG_REG_URL,
        json={"eventId": event.id, "organizerRoleId": role.id, **_person()},
    )
    assert resp.status_code == 422, resp.text
    assert resp.json()["detail"]["code"] == "ROLE_INACTIVE"


async def test_register_organizer_closed_registration_rejected(
    client, db_session, as_user
):
    event = await make_event(db_session, registration=PhaseStatus.CLOSED)
    role = await _make_role(db_session)
    as_user(make_user(UserRole.ADMIN))

    resp = await client.post(
        ORG_REG_URL,
        json={"eventId": event.id, "organizerRoleId": role.id, **_person()},
    )
    assert resp.status_code == 403, resp.text


async def test_register_organizer_org_user_scoped_to_own_org(
    client, db_session, as_user
):
    """An ORGANIZATION user's organizer is forced onto their own org regardless
    of the organizationId they send."""
    event = await make_event(db_session)
    own = await make_org(db_session, "Own Org")
    role = await _make_role(db_session)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=own.id))

    resp = await client.post(
        ORG_REG_URL,
        json={
            "eventId": event.id,
            "organizationId": 999_999,
            "organizerRoleId": role.id,
            **_person(),
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["organization_id"] == own.id
