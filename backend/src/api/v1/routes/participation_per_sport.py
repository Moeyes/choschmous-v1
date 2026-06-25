import logging

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession
from src.services.participation_per_sport_service import (
    ParticipationPerSportService,
    ParticipationReviewError,
)
from src.schemas.participation_per_sport import (
    ParticipationPerSportCreate,
    ParticipationPerSportUpdate,
    ParticipationPerSportPublic,
    ParticipationPerSportPublicList,
    ParticipationReviewRequest,
)
from core.ratelimit import participation_write_limiter, participation_review_limiter
from src.database.deps import (
    get_db,
    require_admin,
    get_current_user,
    get_effective_org_id,
    enforce_org_access,
)
from src.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


async def _dispatch_review_outcome(
    db: AsyncSession, id: int, obj: dict, action: str, note: str | None
) -> None:
    """CHOS-406 best-effort: notify the reviewed org of an approve/reject."""
    try:
        from src.services.notification_dispatch import notify_review_outcome

        org_id = obj.get("org_id")
        if org_id is None:
            return
        await notify_review_outcome(
            db,
            org_id=org_id,
            participant_name=obj.get("org_name") or "Your organization",
            event_name=obj.get("event_name") or "the event",
            sport_name=None,
            outcome=action,
            note=note,
            link=f"/participation-per-sport/{id}",
        )
    except Exception:
        logger.warning("review outcome dispatch failed", exc_info=True)


@router.post("", response_model=ParticipationPerSportPublic)
async def create_participation_per_sport(
    request: Request,
    response: Response,
    obj_in: ParticipationPerSportCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Register an Organization's intent to partcipate in a Sport.**

    **Scenario:**
    Used by a Federation or Province to officially state they will send athletes for a specific sport in an event (e.g., "Siem Reap Province will partake in Basketball for the 2024 National Games").

    **Success Response:**
    - `201 Created`: The record of participation intent is successfully stored.

    **Error Cases:**
    - `400 Bad Request`: If the organization is already registered for this sport-event combo (duplicate entry).
    - `404 Not Found`: If Sport, Event, or Organization IDs are invalid.

    **Access control:** ORGANIZATION users may only register their own org;
    admin / super_admin / federation may register any.
    """
    await participation_write_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    enforce_org_access(current_user, obj_in.org_id)
    service = ParticipationPerSportService(db)

    event = await service.get_event(obj_in.events_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not event.survey_number_is_open:
        raise HTTPException(
            status_code=403,
            detail="Survey by number phase is not currently open for this event.",
        )

    return await service.create(obj_in)


@router.get("/{id}", response_model=ParticipationPerSportPublic)
async def get_participation_per_sport(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Retrieve participation details by ID.**

    **Scenario:**
    Requested when the UI needs to show which sport an organization has signed up for. Uses the unique record ID.

    **Access control:** ORGANIZATION users may only read their own org's records;
    admin / super_admin / federation may read any.

    **Success Response:**
    - `200 OK`: Returns the record details.

    **Error Cases:**
    - `403 Forbidden`: Record belongs to another organization.
    - `404 Not Found`: Participation ID does not exist.
    """
    service = ParticipationPerSportService(db)
    owner_org_id = await service.get_owner_org_id(id)
    if owner_org_id is None:
        raise HTTPException(status_code=404, detail="Not found")
    enforce_org_access(current_user, owner_org_id)
    obj = await service.get(id)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj


@router.patch("/{id}", response_model=ParticipationPerSportPublic)
async def patch_participation_per_sport(
    request: Request,
    response: Response,
    id: int,
    obj_in: ParticipationPerSportUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Modify an existing participation request.**

    **Scenario:**
    Used when an organization needs to update their participation status or linked details. It supports partial updates.

    **Access control:** ORGANIZATION users may only modify their own org's records;
    admin / super_admin / federation may modify any.

    **Success Response:**
    - `200 OK`: Record patched successfully.

    **Error Cases:**
    - `403 Forbidden`: Record belongs to another organization.
    - `404 Not Found`: Record ID not found.
    """
    await participation_write_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    service = ParticipationPerSportService(db)
    owner_org_id = await service.get_owner_org_id(id)
    if owner_org_id is None:
        raise HTTPException(status_code=404, detail="Not found")
    enforce_org_access(current_user, owner_org_id)
    obj = await service.patch(id, obj_in)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj


@router.patch("/{id}/review", response_model=ParticipationPerSportPublic)
async def review_participation_per_sport(
    request: Request,
    response: Response,
    id: int,
    body: ParticipationReviewRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    **Apply a review decision to a submission (admin only).**

    Drives the status FSM:
    `DRAFT -> SUBMITTED -> APPROVED | REJECTED | FLAGGED | REVISION_REQUESTED`.

    **Body:** `action` (submit | approve | reject | flag | request_revision)
    and an optional `note` (required for reject / flag / request_revision).

    **Error Cases:**
    - `400 Bad Request`: Unknown action, or a required note is missing.
    - `403 Forbidden`: Caller is not an admin.
    - `404 Not Found`: Submission ID does not exist.
    - `409 Conflict`: Transition not allowed from the current status
      (e.g. approving a DRAFT).
    """
    await participation_review_limiter.check(request, response=response)
    service = ParticipationPerSportService(db)
    try:
        obj = await service.review(id, body.action, body.note)
    except ParticipationReviewError as exc:
        raise HTTPException(status_code=exc.code, detail=str(exc))
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")

    # CHOS-406: notify the reviewed org of a terminal decision (in-app + email).
    # Best-effort — never let a notification failure affect the review response.
    if body.action in ("approve", "reject"):
        await _dispatch_review_outcome(db, id, obj, body.action, body.note)

    return obj


@router.patch("/org/{org_id}/review")
async def review_participation_bulk_by_org(
    org_id: int,
    action: str = Body(..., embed=True),
    note: str | None = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """**Bulk approve/reject all of an organization's pending submissions** (admin
    only). Only SUBMITTED rows are affected — already-decided rows (approved /
    rejected / flagged / revision-requested) are left untouched. ``action``:
    approve | reject. Returns the number of rows updated."""
    service = ParticipationPerSportService(db)
    try:
        updated = await service.review_bulk_by_org(org_id, action, note)
    except ParticipationReviewError as exc:
        raise HTTPException(status_code=exc.code, detail=str(exc))
    return {
        "updated": updated,
        "status": "APPROVED" if action == "approve" else "REJECTED",
    }


@router.delete("/{id}", response_model=ParticipationPerSportPublic)
async def delete_participation_per_sport(
    request: Request,
    response: Response,
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Withdraw a participation request.**

    **Scenario:**
    Requested when an organization decides to cancel their participation in a specific sport. This is a permanent removal from the list.

    **Access control:** ORGANIZATION users may only delete their own org's records;
    admin / super_admin / federation may delete any.

    **Success Response:**
    - `200 OK`: Record successfully deleted.

    **Error Cases:**
    - `403 Forbidden`: Record belongs to another organization.
    - `404 Not Found`: Record ID does not exist.
    """
    await participation_write_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    service = ParticipationPerSportService(db)
    owner_org_id = await service.get_owner_org_id(id)
    if owner_org_id is None:
        raise HTTPException(status_code=404, detail="Not found")
    enforce_org_access(current_user, owner_org_id)
    obj = await service.delete(id)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj


@router.get("", response_model=ParticipationPerSportPublicList)
async def list_participation_per_sport(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    organization_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Retrieve a list of participation status.**

    **Scenario:**
    Used by event organizers to see which organizations have signed up for which sports. Supports pagination.

    **Access control:** ORGANIZATION users always see only their own org's records
    (the `organization_id` filter is forced); admin / super_admin / federation may
    optionally filter by `organization_id`.

    **Success Response:**
    - `200 OK`: Returns the JSON list and the record count.

    **Error Cases:**
    - `422 Unprocessable Entity`: Invalid query parameters.
    """
    effective_org_id = get_effective_org_id(current_user, organization_id)
    service = ParticipationPerSportService(db)
    objs = await service.list(skip=skip, limit=limit, org_id=effective_org_id)
    return ParticipationPerSportPublicList(data=objs, count=len(objs))
