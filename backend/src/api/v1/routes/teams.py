from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.ratelimit import sports_event_write_limiter
from src.database.deps import (
    get_db,
    get_current_user,
    get_effective_org_id,
    enforce_org_access,
)
from src.models.user import User
from src.schemas.team import (
    TeamCreate,
    TeamUpdate,
    TeamPublic,
    TeamDetail,
    TeamList,
    AddMemberRequest,
)
from src.services.team_service import TeamService

router = APIRouter()


async def get_team_service(db: AsyncSession = Depends(get_db)) -> TeamService:
    return TeamService(db)


@router.post("", response_model=TeamPublic, status_code=status.HTTP_201_CREATED)
async def create_team(
    request: Request,
    response: Response,
    payload: TeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Create a new team for an event / sport / org.**

    Org users are forced to their own org (``org_id`` in the body is silently
    overridden). Validates the sport's mode allows teams, and checks the
    per-org team quota.
    """
    await sports_event_write_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    effective_org_id = get_effective_org_id(current_user, payload.org_id)
    if effective_org_id is None:
        raise HTTPException(status_code=400, detail="org_id is required")
    payload.org_id = effective_org_id

    service = TeamService(db)
    team = await service.create_team(payload)

    count = await service.member_count(team.id)
    return {
        "id": team.id,
        "event_id": team.event_id,
        "sport_id": team.sport_id,
        "org_id": team.org_id,
        "category_id": team.category_id,
        "name": team.name,
        "member_count": count,
        "created_at": team.created_at,
    }


@router.get("", response_model=TeamList)
async def list_teams(
    event_id: int | None = Query(None),
    organization_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **List teams**, optionally filtered by event and/or organization.

    Org users are always scoped to their own org.
    """
    effective_org_id = get_effective_org_id(current_user, organization_id)
    service = TeamService(db)
    teams = await service.list_teams(event_id, effective_org_id)
    return {"data": teams, "count": len(teams)}


@router.get("/{team_id}", response_model=TeamDetail)
async def get_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Get a single team** with its full member roster.
    """
    service = TeamService(db)
    detail = await service.get_team_detail(team_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Team not found.")
    enforce_org_access(current_user, detail["org_id"])
    return detail


@router.patch("/{team_id}", response_model=TeamPublic)
async def update_team(
    team_id: int,
    payload: TeamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Update team** metadata (name, category).
    """
    service = TeamService(db)
    team = await service.get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    enforce_org_access(current_user, team.org_id)

    updated = await service.update_team(team_id, payload)
    count = await service.member_count(team_id)
    return {
        "id": updated.id,
        "event_id": updated.event_id,
        "sport_id": updated.sport_id,
        "org_id": updated.org_id,
        "category_id": updated.category_id,
        "name": updated.name,
        "member_count": count,
        "created_at": updated.created_at,
    }


@router.delete("/{team_id}", status_code=status.HTTP_200_OK)
async def delete_team(
    request: Request,
    response: Response,
    team_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Delete a team** and detach all its members.

    Org users may only delete their own org's teams.
    """
    await sports_event_write_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    service = TeamService(db)
    team = await service.get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    enforce_org_access(current_user, team.org_id)

    success = await service.delete_team(team_id)
    if not success:
        raise HTTPException(status_code=404, detail="Team not found.")
    return {"message": "Team deleted."}


@router.post("/{team_id}/members", status_code=status.HTTP_200_OK)
async def add_team_member(
    request: Request,
    response: Response,
    team_id: int,
    body: AddMemberRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Add an athlete to a team.**

    Validates the athlete is registered in the same event/sport/org as the
    team, the team is not full, and the athlete is not already on another team.
    """
    await sports_event_write_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    service = TeamService(db)
    team = await service.get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    enforce_org_access(current_user, team.org_id)

    await service.add_member(team_id, body.enroll_id)
    return {"message": "Member added."}


@router.post("/{team_id}/finalize", status_code=status.HTTP_200_OK)
async def finalize_team(
    request: Request,
    response: Response,
    team_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Finalize a team for registration.**

    Enforces the sport's configured minimum roster size (``team_size_min``) — the
    lower-bound counterpart to the ``TEAM_FULL`` (max) gate applied on member-add.
    Raises ``409 TEAM_BELOW_MIN`` when the roster is below the minimum; the check
    is skipped when no minimum is configured. Org users may only finalize their
    own org's teams.
    """
    await sports_event_write_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    service = TeamService(db)
    team = await service.get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    enforce_org_access(current_user, team.org_id)

    await service.finalize_team(team_id)
    return {"message": "Team finalized."}


@router.delete("/{team_id}/members/{enroll_id}", status_code=status.HTTP_200_OK)
async def remove_team_member(
    team_id: int,
    enroll_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Remove an athlete from a team** (sets ``team_id`` to null).
    """
    service = TeamService(db)
    team = await service.get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found.")
    enforce_org_access(current_user, team.org_id)

    await service.remove_member(team_id, enroll_id)
    return {"message": "Member removed."}
