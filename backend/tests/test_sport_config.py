"""Tests for PATCH /sports-events/{id}/config and GET /events/{id}/my-eligible-sports."""

from src.models.enum.event import SportMode
from src.models.enum.user import UserRole
from src.models.sports_event import sports_event
from tests.conftest import make_user
from tests.factories import (
    link_org_sport,
    make_event,
    make_org,
    make_sport,
    make_sports_event,
)

CONFIG_URL = "/api/sports-events/{id}/config"


async def test_staff_sets_sport_config(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    se = await make_sports_event(db_session, event, sport)
    as_user(make_user(UserRole.ADMIN))

    resp = await client.patch(
        CONFIG_URL.format(id=se.id),
        json={
            "mode": "team",
            "team_size_min": 11,
            "team_size_max": 18,
            "quota_athletes_per_org": 23,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["mode"] == "team"
    assert body["team_size_max"] == 18
    assert body["quota_athletes_per_org"] == 23

    refreshed = await db_session.get(sports_event, se.id)
    await db_session.refresh(refreshed)
    assert refreshed.mode == SportMode.TEAM
    assert refreshed.team_size_min == 11


async def test_config_rejects_inverted_team_size(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    se = await make_sports_event(db_session, event, sport)
    as_user(make_user(UserRole.ADMIN))

    resp = await client.patch(
        CONFIG_URL.format(id=se.id),
        json={"team_size_min": 20, "team_size_max": 10},
    )
    assert resp.status_code == 422, resp.text


async def test_config_org_user_forbidden(client, db_session, as_user):
    event = await make_event(db_session)
    sport = await make_sport(db_session)
    se = await make_sports_event(db_session, event, sport)
    as_user(make_user(UserRole.ORGANIZATION, organization_id=1))

    resp = await client.patch(
        CONFIG_URL.format(id=se.id), json={"quota_athletes_per_org": 5}
    )
    assert resp.status_code == 403, resp.text


async def test_config_not_found(client, db_session, as_user):
    as_user(make_user(UserRole.ADMIN))
    resp = await client.patch(
        CONFIG_URL.format(id=999_999), json={"quota_athletes_per_org": 5}
    )
    assert resp.status_code == 404, resp.text


async def test_my_eligible_sports_returns_surveyed_with_config(
    client, db_session, as_user
):
    event = await make_event(db_session)
    surveyed = await make_sport(db_session, "បាល់ទាត់")
    other = await make_sport(db_session, "បាល់ទះ")
    org = await make_org(db_session)

    await make_sports_event(
        db_session, event, surveyed, quota_athletes_per_org=23, team_size_max=18
    )
    await make_sports_event(db_session, event, other)  # config exists but not surveyed
    # only surveyed is linked, and its selection has been approved by staff
    await link_org_sport(db_session, event, surveyed, org, status="APPROVED")

    as_user(make_user(UserRole.ORGANIZATION, organization_id=org.id))
    resp = await client.get(f"/api/events/{event.id}/my-eligible-sports")

    assert resp.status_code == 200, resp.text
    rows = resp.json()
    assert len(rows) == 1
    assert rows[0]["sports_id"] == surveyed.id
    assert rows[0]["quota_athletes_per_org"] == 23
    assert rows[0]["athletes_used"] == 0
