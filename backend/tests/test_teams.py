"""Tests for Phase 3 — Teams CRUD, membership, scoping, and team-gated registration."""

from src.models.enum.event import SportMode, PhaseStatus
from src.models.enum.user import UserRole, genderEnum
from tests.conftest import make_user
from tests.factories import (
    link_org_sport,
    make_event,
    make_org,
    make_sport,
    make_sports_event,
    make_category,
)

TEAMS_URL = "/api/teams"


async def _register_athlete(
    client, db_session, event, sport, org, category, user, suffix: str = ""
):
    """Helper: register an athlete for team membership tests."""
    from src.schemas.enroll import FullRegistrationRequest
    from datetime import date

    payload = FullRegistrationRequest(
        eventId=event.id,
        organizationId=org.id,
        sportId=sport.id,
        categoryId=category.id,
        lastNameKhmer="សុខ",
        firstNameKhmer=f"សប្បាយ{suffix}",
        lastNameLatin="Sok",
        firstNameLatin=f"Sabbay{suffix}",
        gender="Male",
        dateOfBirth="2010-05-20",
        phone=f"01234567{suffix}" if suffix else "012345678",
        idDocType="IDCard",
        role="athlete",
        photoUrl="/uploads/photo.jpg",
        birthCertificateUrl="/uploads/birth.jpg",
        nationalIdUrl=None,
        passportUrl=None,
    )
    from src.database.deps import get_current_user
    from main import app
    api_reg_url = "/api/registration"
    prev = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        resp = await client.post(api_reg_url, json=payload.model_dump(by_alias=True, mode="json"))
    finally:
        if prev is not None:
            app.dependency_overrides[get_current_user] = prev
        else:
            app.dependency_overrides.pop(get_current_user, None)
    return resp


async def test_create_team_success(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    org = await make_org(db_session)
    se = await make_sports_event(db_session, event, sport, mode=SportMode.TEAM)
    await link_org_sport(db_session, event, sport, org)

    admin = make_user(UserRole.ADMIN)
    as_user(admin)

    resp = await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "org_id": org.id,
            "name": "ក្រុមអ្នកមានជ័យ",
        },
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["name"] == "ក្រុមអ្នកមានជ័យ"
    assert body["member_count"] == 0
    assert body["event_id"] == event.id


async def test_create_team_rejects_individual_mode(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    org = await make_org(db_session)
    await make_sports_event(db_session, event, sport, mode=SportMode.INDIVIDUAL)
    await link_org_sport(db_session, event, sport, org)

    as_user(make_user(UserRole.ADMIN))
    resp = await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "org_id": org.id,
            "name": "Should Fail",
        },
    )
    assert resp.status_code == 422, resp.text


async def test_create_team_enforces_org_scope(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    org = await make_org(db_session)
    await make_sports_event(db_session, event, sport, mode=SportMode.TEAM)
    await link_org_sport(db_session, event, sport, org)

    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))
    resp = await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "org_id": 999_999,
            "name": "Org Scoped",
        },
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["org_id"] == org.id


async def test_create_team_quota_full(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    org = await make_org(db_session)
    await make_sports_event(
        db_session, event, sport, mode=SportMode.TEAM, quota_teams_per_org=1
    )
    await link_org_sport(db_session, event, sport, org)

    as_user(make_user(UserRole.ADMIN))
    resp1 = await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "org_id": org.id,
            "name": "Team 1",
        },
    )
    assert resp1.status_code == 201, resp1.text

    resp2 = await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "org_id": org.id,
            "name": "Team 2",
        },
    )
    assert resp2.status_code == 409, resp2.text


async def test_team_member_add_remove(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    org = await make_org(db_session)
    cat = await make_category(db_session, event, sport)
    se = await make_sports_event(
        db_session, event, sport, mode=SportMode.TEAM, team_size_max=5
    )
    await link_org_sport(db_session, event, sport, org)

    admin = make_user(UserRole.ADMIN)
    as_user(admin)

    # Create team
    team_resp = await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "org_id": org.id,
            "name": "Test Team",
        },
    )
    assert team_resp.status_code == 201
    team_id = team_resp.json()["id"]

    # Register an athlete
    reg_resp = await _register_athlete(
        client, db_session, event, sport, org, cat, admin
    )
    assert reg_resp.status_code == 201, reg_resp.text
    enroll_id = reg_resp.json()["enroll_id"]

    # Assign athlete to team
    as_user(admin)
    add_resp = await client.post(
        f"{TEAMS_URL}/{team_id}/members",
        json={"enroll_id": enroll_id},
    )
    assert add_resp.status_code == 200, add_resp.text

    # Verify team roster
    detail_resp = await client.get(f"{TEAMS_URL}/{team_id}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["member_count"] == 1
    assert len(detail["members"]) == 1

    # Remove member
    remove_resp = await client.delete(
        f"{TEAMS_URL}/{team_id}/members/{enroll_id}",
        headers={"Content-Type": "application/json"},
    )
    assert remove_resp.status_code == 200, remove_resp.text

    detail_resp2 = await client.get(f"{TEAMS_URL}/{team_id}")
    assert detail_resp2.json()["member_count"] == 0


async def test_team_member_quota_full(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    org = await make_org(db_session)
    cat = await make_category(db_session, event, sport)
    await make_sports_event(
        db_session, event, sport, mode=SportMode.TEAM, team_size_max=1
    )
    await link_org_sport(db_session, event, sport, org)

    admin = make_user(UserRole.ADMIN)
    as_user(admin)

    team_resp = await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "org_id": org.id,
            "name": "Full Team",
        },
    )
    team_id = team_resp.json()["id"]

    reg_resp = await _register_athlete(
        client, db_session, event, sport, org, cat, admin
    )
    enroll1 = reg_resp.json()["enroll_id"]
    await client.post(f"{TEAMS_URL}/{team_id}/members", json={"enroll_id": enroll1})
    assert (await client.get(f"{TEAMS_URL}/{team_id}")).json()["member_count"] == 1

    reg_resp2 = await _register_athlete(
        client, db_session, event, sport, org, cat, admin, suffix="2"
    )
    enroll2 = reg_resp2.json()["enroll_id"]
    add_resp = await client.post(
        f"{TEAMS_URL}/{team_id}/members", json={"enroll_id": enroll2}
    )
    assert add_resp.status_code == 409, add_resp.text


async def test_list_teams_with_filters(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    org = await make_org(db_session)
    await make_sports_event(db_session, event, sport, mode=SportMode.TEAM)
    await link_org_sport(db_session, event, sport, org)

    as_user(make_user(UserRole.ADMIN))
    await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "org_id": org.id,
            "name": "Alpha",
        },
    )
    await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id,
            "sport_id": sport.id,
            "org_id": org.id,
            "name": "Beta",
        },
    )

    list_resp = await client.get(f"{TEAMS_URL}?event_id={event.id}&organization_id={org.id}")
    assert list_resp.status_code == 200
    assert list_resp.json()["count"] == 2


async def test_org_user_only_sees_own_teams(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    org1 = await make_org(db_session, "Org 1")
    org2 = await make_org(db_session, "Org 2")
    await make_sports_event(db_session, event, sport, mode=SportMode.TEAM)
    await link_org_sport(db_session, event, sport, org1)
    await link_org_sport(db_session, event, sport, org2)

    as_user(make_user(UserRole.ADMIN))
    await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id, "sport_id": sport.id,
            "org_id": org1.id, "name": "Org1 Team",
        },
    )
    await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id, "sport_id": sport.id,
            "org_id": org2.id, "name": "Org2 Team",
        },
    )

    as_user(make_user(UserRole.ORGANIZATION, organization_id=org1.id))
    list_resp = await client.get(f"{TEAMS_URL}?event_id={event.id}")
    assert list_resp.status_code == 200
    names = [t["name"] for t in list_resp.json()["data"]]
    assert "Org1 Team" in names
    assert "Org2 Team" not in names


async def test_delete_team_detaches_members(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    org = await make_org(db_session)
    cat = await make_category(db_session, event, sport)
    await make_sports_event(db_session, event, sport, mode=SportMode.TEAM)
    await link_org_sport(db_session, event, sport, org)

    admin = make_user(UserRole.ADMIN)
    as_user(admin)

    team_resp = await client.post(
        TEAMS_URL,
        json={
            "event_id": event.id, "sport_id": sport.id,
            "org_id": org.id, "name": "Del Team",
        },
    )
    team_id = team_resp.json()["id"]

    reg_resp = await _register_athlete(
        client, db_session, event, sport, org, cat, admin
    )
    enroll_id = reg_resp.json()["enroll_id"]
    await client.post(f"{TEAMS_URL}/{team_id}/members", json={"enroll_id": enroll_id})

    del_resp = await client.delete(
        f"{TEAMS_URL}/{team_id}",
        headers={"Content-Type": "application/json"},
    )
    assert del_resp.status_code == 200

    get_resp = await client.get(f"{TEAMS_URL}/{team_id}")
    assert get_resp.status_code == 404
