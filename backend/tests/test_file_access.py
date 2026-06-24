"""Object-level authorization for file download + reference validation (P1-3).

Authorization is OWNERSHIP-based: a file's scope is derived from its uploader's
org/sport (not from any user-supplied reference). Covers the full allow/deny
matrix plus the registration-time reference guard.
"""

import uuid

import pytest

from fastapi import HTTPException

from src.models.enum.user import UserRole
from src.models.uploaded_file import UploadedFile
from src.models.user import User
from src.services.file_access import assert_can_reference_files, user_can_access_file
from src.services.user_service import UserService
from src.schemas.user import UserCreate, UserUpdate
from tests.factories import make_org, make_sport


async def _user_row(db, role, *, org_id=None, sport_id=None) -> User:
    """A persisted user (so uploaded_by -> org/sport resolves)."""
    u = User(
        kh_family_name="x",
        kh_given_name="x",
        en_family_name="x",
        en_given_name="x",
        email=f"{uuid.uuid4().hex}@t.local",
        username=uuid.uuid4().hex[:14],
        hashed_password="x",
        role=role,
        organization_id=org_id,
        sport_id=sport_id,
    )
    db.add(u)
    await db.flush()
    return u


async def _file(db, uploader_id) -> UploadedFile:
    f = UploadedFile(
        content_type="image/png", size=3, data=b"abc", uploaded_by=uploader_id
    )
    db.add(f)
    await db.flush()
    return f


def _inmem_user(role, *, uid=None, org_id=None, sport_id=None) -> User:
    return User(
        id=uid or uuid.uuid4(), role=role, organization_id=org_id, sport_id=sport_id
    )


# ── ALLOWED ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_admin_can_access_any_file(db_session):
    uploader = await _user_row(
        db_session, UserRole.ORGANIZATION, org_id=(await make_org(db_session)).id
    )
    f = await _file(db_session, uploader.id)
    assert (
        await user_can_access_file(db_session, _inmem_user(UserRole.ADMIN), f) is True
    )
    assert (
        await user_can_access_file(db_session, _inmem_user(UserRole.SUPER_ADMIN), f)
        is True
    )


@pytest.mark.asyncio
async def test_uploader_can_access_own_file(db_session):
    uploader = await _user_row(db_session, UserRole.ORGANIZATION)
    f = await _file(db_session, uploader.id)
    assert await user_can_access_file(db_session, uploader, f) is True


@pytest.mark.asyncio
async def test_same_org_user_can_access(db_session):
    org = await make_org(db_session)
    uploader = await _user_row(db_session, UserRole.ORGANIZATION, org_id=org.id)
    f = await _file(db_session, uploader.id)
    colleague = _inmem_user(UserRole.ORGANIZATION, org_id=org.id)
    assert await user_can_access_file(db_session, colleague, f) is True


@pytest.mark.asyncio
async def test_same_sport_federation_can_access(db_session):
    sport = await make_sport(db_session)
    uploader = await _user_row(db_session, UserRole.FEDERATION, sport_id=sport.id)
    f = await _file(db_session, uploader.id)
    fed = _inmem_user(UserRole.FEDERATION, sport_id=sport.id)
    assert await user_can_access_file(db_session, fed, f) is True


# ── DENIED ─────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_different_org_denied(db_session):
    org_a, org_b = await make_org(db_session), await make_org(db_session)
    uploader = await _user_row(db_session, UserRole.ORGANIZATION, org_id=org_a.id)
    f = await _file(db_session, uploader.id)
    attacker = _inmem_user(UserRole.ORGANIZATION, org_id=org_b.id)
    assert await user_can_access_file(db_session, attacker, f) is False


@pytest.mark.asyncio
async def test_different_sport_denied(db_session):
    s1, s2 = await make_sport(db_session), await make_sport(db_session, name_kh="ហែលទឹក")
    uploader = await _user_row(db_session, UserRole.FEDERATION, sport_id=s1.id)
    f = await _file(db_session, uploader.id)
    other = _inmem_user(UserRole.FEDERATION, sport_id=s2.id)
    assert await user_can_access_file(db_session, other, f) is False


@pytest.mark.asyncio
async def test_org_user_without_org_denied(db_session):
    uploader = await _user_row(
        db_session, UserRole.ORGANIZATION, org_id=(await make_org(db_session)).id
    )
    f = await _file(db_session, uploader.id)
    assert (
        await user_can_access_file(
            db_session, _inmem_user(UserRole.ORGANIZATION, org_id=None), f
        )
        is False
    )


@pytest.mark.asyncio
async def test_orphan_file_denied_to_non_admin(db_session):
    f = await _file(db_session, None)  # no uploader recorded
    assert (
        await user_can_access_file(
            db_session, _inmem_user(UserRole.ORGANIZATION, org_id=1), f
        )
        is False
    )
    assert (
        await user_can_access_file(db_session, _inmem_user(UserRole.ADMIN), f) is True
    )


@pytest.mark.asyncio
async def test_unknown_uploader_denied(db_session):
    f = await _file(db_session, uuid.uuid4())  # uploaded_by points to no real user
    assert (
        await user_can_access_file(
            db_session, _inmem_user(UserRole.ORGANIZATION, org_id=1), f
        )
        is False
    )


# ── Reference validation (registration / update / organizer) ────────────


@pytest.mark.asyncio
async def test_reference_validation_allows_owned_and_freeform(db_session):
    org = await make_org(db_session)
    uploader = await _user_row(db_session, UserRole.ORGANIZATION, org_id=org.id)
    f = await _file(db_session, uploader.id)
    # Owner referencing own managed file + external/legacy/None all pass.
    await assert_can_reference_files(
        db_session,
        uploader,
        [f"/api/v1/files/{f.id}", "https://example.com/x.jpg", "/uploads/y.jpg", None],
    )
    # Same-org colleague may also reference it.
    await assert_can_reference_files(
        db_session,
        _inmem_user(UserRole.ORGANIZATION, org_id=org.id),
        [f"/api/v1/files/{f.id}"],
    )


@pytest.mark.asyncio
async def test_reference_validation_rejects_forged_uuid(db_session):
    caller = _inmem_user(UserRole.ORGANIZATION, org_id=1)
    with pytest.raises(HTTPException) as e:
        await assert_can_reference_files(
            db_session, caller, [f"/api/v1/files/{uuid.uuid4()}"]
        )
    assert e.value.status_code == 400


@pytest.mark.asyncio
async def test_reference_validation_rejects_stolen_file(db_session):
    org_a, org_b = await make_org(db_session), await make_org(db_session)
    victim = await _user_row(db_session, UserRole.ORGANIZATION, org_id=org_a.id)
    f = await _file(db_session, victim.id)
    attacker = _inmem_user(UserRole.ORGANIZATION, org_id=org_b.id)
    with pytest.raises(HTTPException) as e:
        await assert_can_reference_files(db_session, attacker, [f"/api/v1/files/{f.id}"])
    assert e.value.status_code == 403


# ── Cross-role boundary checks ──────────────────────────────────────────


@pytest.mark.asyncio
async def test_org_user_cannot_access_federation_file(db_session):
    """ORGANIZATION users must NOT see files uploaded by a FEDERATION user
    (different scope dimension), even if the federation user's uploader row
    shares no org with the caller."""
    sport = await make_sport(db_session)
    fed_uploader = await _user_row(db_session, UserRole.FEDERATION, sport_id=sport.id)
    f = await _file(db_session, fed_uploader.id)
    org_user = _inmem_user(UserRole.ORGANIZATION, org_id=999)
    assert await user_can_access_file(db_session, org_user, f) is False


@pytest.mark.asyncio
async def test_federation_user_cannot_access_org_file(db_session):
    """FEDERATION users must NOT see files uploaded by an ORGANIZATION user
    (different scope dimension)."""
    org = await make_org(db_session)
    org_uploader = await _user_row(db_session, UserRole.ORGANIZATION, org_id=org.id)
    f = await _file(db_session, org_uploader.id)
    fed_user = _inmem_user(UserRole.FEDERATION, sport_id=1)
    assert await user_can_access_file(db_session, fed_user, f) is False


@pytest.mark.asyncio
async def test_federation_user_without_sport_denied(db_session):
    """A FEDERATION user with no sport_id must not access any file."""
    org = await make_org(db_session)
    uploader = await _user_row(db_session, UserRole.ORGANIZATION, org_id=org.id)
    f = await _file(db_session, uploader.id)
    fed_no_sport = _inmem_user(UserRole.FEDERATION, sport_id=None)
    assert await user_can_access_file(db_session, fed_no_sport, f) is False


# ── User-service write-time reference validation ──────────────────────


@pytest.mark.asyncio
async def test_user_create_rejects_stolen_file_ref(db_session):
    """UserService.create_user must reject a photo_path that references a file
    the caller (superadmin) does not own or have scope for."""
    org_a, org_b = await make_org(db_session), await make_org(db_session)
    victim = await _user_row(db_session, UserRole.ORGANIZATION, org_id=org_a.id)
    f = await _file(db_session, victim.id)
    attacker = _inmem_user(UserRole.ORGANIZATION, org_id=org_b.id)

    svc = UserService(db_session)
    payload = UserCreate(
        kh_family_name="a",
        kh_given_name="b",
        en_family_name="c",
        en_given_name="d",
        email="test@example.org",
        username="testuser",
        password="Str0ng!Passw0rd",
        role=UserRole.ORGANIZATION,
        organization_id=org_b.id,
        photo_path=f"/api/v1/files/{f.id}",
    )
    with pytest.raises(HTTPException) as e:
        await svc.create_user(payload, attacker)
    assert e.value.status_code == 403


@pytest.mark.asyncio
async def test_user_create_rejects_forged_uuid(db_session):
    """UserService.create_user must reject a photo_path pointing to a
    non-existent managed file UUID."""
    svc = UserService(db_session)
    admin = _inmem_user(UserRole.SUPER_ADMIN)
    payload = UserCreate(
        kh_family_name="a",
        kh_given_name="b",
        en_family_name="c",
        en_given_name="d",
        email="test2@example.org",
        username="testuser2",
        password="Str0ng!Passw0rd",
        role=UserRole.SUPER_ADMIN,
        photo_path=f"/api/v1/files/{uuid.uuid4()}",
    )
    with pytest.raises(HTTPException) as e:
        await svc.create_user(payload, admin)
    assert e.value.status_code == 400


@pytest.mark.asyncio
async def test_user_create_allows_external_url(db_session):
    """Non-managed references (external URLs, legacy paths) must pass
    validation without error."""
    svc = UserService(db_session)
    admin = _inmem_user(UserRole.SUPER_ADMIN)
    payload = UserCreate(
        kh_family_name="a",
        kh_given_name="b",
        en_family_name="c",
        en_given_name="d",
        email="test3@example.org",
        username="testuser3",
        password="Str0ng!Passw0rd",
        role=UserRole.SUPER_ADMIN,
        photo_path="https://example.com/photo.jpg",
    )
    user = await svc.create_user(payload, admin)
    assert user is not None


@pytest.mark.asyncio
async def test_user_create_allows_own_file_ref(db_session):
    """A caller may reference a managed file they own."""
    admin = await _user_row(db_session, UserRole.SUPER_ADMIN)
    f = await _file(db_session, admin.id)
    svc = UserService(db_session)
    payload = UserCreate(
        kh_family_name="a",
        kh_given_name="b",
        en_family_name="c",
        en_given_name="d",
        email="test4@example.org",
        username="testuser4",
        password="Str0ng!Passw0rd",
        role=UserRole.SUPER_ADMIN,
        photo_path=f"/api/v1/files/{f.id}",
    )
    user = await svc.create_user(payload, admin)
    assert user is not None


@pytest.mark.asyncio
async def test_user_update_rejects_stolen_file_ref(db_session):
    """UserService.update_user must reject a photo_path the caller may not
    reference."""
    org_a, org_b = await make_org(db_session), await make_org(db_session)
    victim = await _user_row(db_session, UserRole.ORGANIZATION, org_id=org_a.id)
    f = await _file(db_session, victim.id)
    attacker = _inmem_user(UserRole.ORGANIZATION, org_id=org_b.id)

    svc = UserService(db_session)
    payload = UserUpdate(photo_path=f"/api/v1/files/{f.id}")
    with pytest.raises(HTTPException) as e:
        # user_id doesn't matter for this test — validation happens before lookup
        await svc.update_user(uuid.uuid4(), payload, attacker)
    assert e.value.status_code == 403


# ── Self-reference bypass (re-audit confirmation) ──────────────────────


@pytest.mark.asyncio
async def test_self_reference_bypass_should_be_denied(db_session):
    """The original security finding: forging an enrollment that references a
    victim's file UUID must NOT grant access to that file.

    This is the re-audit acceptance test. MUST pass for the finding to be
    considered fixed.
    """
    org_victim = await make_org(db_session)
    org_attacker = await make_org(db_session)
    sport = await make_sport(db_session)

    victim = await _user_row(db_session, UserRole.ORGANIZATION, org_id=org_victim.id)
    f = await _file(db_session, victim.id)

    # Create an enrollment in the attacker's org that references the victim's file.
    from src.models.enroll import Enroll
    from src.models.athletes import athletes as Athlete
    from src.models.athlete_participation import (
        athlete_participation as AthleteParticipation,
    )
    from src.models.enum.user import IdDocumentType, genderEnum
    from datetime import date

    enroll = Enroll(
        kh_family_name="x",
        kh_given_name="x",
        en_family_name="x",
        en_given_name="x",
        phonenumber="012345678",
        gender=genderEnum.MALE,
        date_of_birth=date(2000, 1, 1),
        id_document_type=list(IdDocumentType)[0],
        national_id_path=f"/api/v1/files/{f.id}",
    )
    db_session.add(enroll)
    await db_session.flush()
    ath = Athlete(enroll_id=enroll.id)
    db_session.add(ath)
    await db_session.flush()
    ap = AthleteParticipation(
        athletes_id=ath.id, organization_id=org_attacker.id, sports_id=sport.id
    )
    db_session.add(ap)
    await db_session.flush()

    attacker = _inmem_user(UserRole.ORGANIZATION, org_id=org_attacker.id)
    assert await user_can_access_file(db_session, attacker, f) is False
