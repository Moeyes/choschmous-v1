from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from core.ratelimit import create_event_limiter
from src.database.deps import (
    get_db,
    get_current_user,
    get_effective_org_id,
    enforce_org_access,
    require_staff,
    require_admin,
)
from src.models.user import User
from src.schemas.category import CategoryPublic
from src.schemas.event import (
    DeleteEventBody,
    DeleteEventSportOrgLinkBody,
    EventCreate,
    EventPublic,
    EventSportOrgLink,
    EventsPublic,
    EventUpdate,
    PhaseUpdate,
    RemoveOrgCompletelyFromEventBody,
)
from src.schemas.sports_event import (
    SportsEventPublic,
    EligibleSportPublic,
)
from src.schemas.sports_event_org import (
    EventOrgNamesPublic,
    SportEventOrgOnly,
    SportsEventOrgPublic,
    SportsEventOrgPublicList,
    SportsEventOrgReviewList,
)
from src.schemas.report import SurveyStatusResponse
from src.services.events_service import EventService

router = APIRouter()


@router.post("", response_model=EventPublic, status_code=status.HTTP_201_CREATED)
async def create_event(
    request: Request,
    response: Response,
    payload: EventCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    """
    **Launch a new Tournament or Multi-Sport Event.**

    **Scenario:**
    Admin sets up a major competition (e.g., "National Games 2024").
    Includes primary schedule (start/end dates) and descriptions in Khmer/English.

    **Success Response:**
    - `201 Created`: Event record created with a unique ID.

    **Error Cases:**
    - `400 Bad Request`: Validation failure (e.g., end date before start date).
    """
    await create_event_limiter.check(request, response=response)
    service = EventService(db)
    return await service.create_event(payload)


@router.get("", response_model=EventsPublic)
async def list_events(
    skip: int = 0,
    limit: int = 100,
    name: str | None = Query(None),
    survey_category_open: bool | None = Query(None),
    survey_sport_open: bool | None = Query(None),
    survey_number_open: bool | None = Query(None),
    survey_open_open: bool | None = Query(None),
    registration_open: bool | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    **Retrieve a list of all events.**

    **Scenario:**
    Used by the landing page or admin dashboard to show a list of competitions.
    Supports searching by Khmer name, pagination, and filtering by whether a
    given lifecycle phase is currently open.

    **Success Response:**
    - `200 OK`: Returns a paginated list of event records.

    **Error Cases:**
    - `422 Unprocessable Entity`: Invalid query parameters.
    """
    service = EventService(db)
    filters = {}
    if name:
        filters["name_kh"] = name
    phase_open_filters = {
        "survey_category": survey_category_open,
        "survey_sport": survey_sport_open,
        "survey_number": survey_number_open,
        "survey_open": survey_open_open,
        "registration": registration_open,
    }
    events = await service.get_events(
        skip=skip,
        limit=limit,
        filters=filters,
        phase_open_filters=phase_open_filters,
    )
    return {"data": events, "count": len(events)}


@router.get("/{event_id}", response_model=EventPublic)
async def get_event(event_id: int, db: AsyncSession = Depends(get_db)):
    """
    **Get details of a specific event.**

    **Scenario:**
    Requested when the user clicks on a tournament card to see detailed info, registration deadlines, and descriptions.

    **Success Response:**
    - `200 OK`: Returns the comprehensive event object.

    **Error Cases:**
    - `404 Not Found`: The specified Event ID does not exist.
    """
    service = EventService(db)
    event = await service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.patch("/{event_id}", response_model=EventPublic)
async def update_event(
    event_id: int,
    payload: EventUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    """
    **Modify existing event details.**

    **Scenario:**
    Used by admins to update registration dates, descriptions, or names for an active event. Supports partial updates.

    **Success Response:**
    - `200 OK`: Event updated successfully.

    **Error Cases:**
    - `404 Not Found`: Event ID not found.
    - `422 Unprocessable Entity`: Invalid date format or malformed data.
    """
    service = EventService(db)
    event = await service.update_event(event_id, payload)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.patch("/{event_id}/phase", response_model=EventPublic)
async def update_event_phase(
    event_id: int,
    payload: PhaseUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    **Open or close a single lifecycle phase of an event.**

    **Scenario:**
    An admin manually forces a phase (survey by category/sport/number, or
    registration) OPEN or CLOSED, or sets it back to AUTO with an
    open/close date window. Only admin / super_admin may do this.

    **Success Response:**
    - `200 OK`: Returns the updated event with recomputed `*_is_open` flags.

    **Error Cases:**
    - `403 Forbidden`: Caller is not admin / super_admin.
    - `404 Not Found`: Event ID does not exist.
    - `422 Unprocessable Entity`: Unknown phase or invalid status.
    """
    service = EventService(db)
    event = await service.update_phase(
        event_id,
        payload.phase,
        payload.status,
        payload.open_date,
        payload.close_date,
    )
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.delete("/delete", status_code=status.HTTP_200_OK)
async def delete_event(
    body: DeleteEventBody = Body(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_staff),
):
    service = EventService(db)
    success = await service.delete_event(body.event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Event not found")
    return {"message": "Event deleted"}


@router.get("/{event_id}/sports", response_model=List[SportsEventPublic])
async def list_event_sports(event_id: int, db: AsyncSession = Depends(get_db)):
    """
    **List sports assigned to an Event.**

    **Scenario:**
    Requested to show which sports (e.g., Football, Karate) are available for registration in a specific competition.

    **Success Response:**
    - `200 OK`: Returns a list of sport-event association objects.

    **Error Cases:**
    - `404 Not Found`: Event ID does not exist.
    """
    service = EventService(db)

    event = await service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return await service.get_event_sports(event_id)


@router.get(
    "/{event_id}/my-eligible-sports", response_model=list[EligibleSportPublic]
)
async def list_my_eligible_sports(
    event_id: int,
    organization_id: int | None = Query(
        None, description="Org filter (ignored for org-role users — derived from token)"
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Sports the caller's organization may register for in this event.**

    Returns the sports the org selected in survey ② (``sports_event_org``) with
    each sport's per-sport config (mode / team size / quotas) and the org's
    current athlete count attached for the quota meter. Org-scoped: ORGANIZATION
    users are forced to their own org.
    """
    effective_org_id = get_effective_org_id(current_user, organization_id)
    if effective_org_id is None:
        raise HTTPException(status_code=400, detail="organization_id is required")
    service = EventService(db)
    return await service.get_my_eligible_sports(event_id, effective_org_id)


@router.post(
    "/add-org-to-sport",
    response_model=SportsEventOrgPublic,
    status_code=status.HTTP_201_CREATED,
)
async def add_org_to_event_sport(
    payload: EventSportOrgLink,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Register an Organization for a specific Sport in an Event.**

    **Scenario:**
    Requested when an organization (e.g., federation or province) officially applies to participate in a specific sport for a competition. Assigns the organization to the sport-event link.

    **Access control:** ORGANIZATION users may only register their own org;
    admin / super_admin / federation may register any org.

    **Success Response:**
    - `201 Created`: Organization successfully linked to the sport in that event.

    **Error Cases:**
    - `400 Bad Request`: If the link already exists (duplicate registration).
    - `422 Unprocessable Entity`: Malformed body IDs.
    """
    enforce_org_access(current_user, payload.org_id)
    service = EventService(db)

    event = await service.get_event(payload.events_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not event.survey_sport_is_open:
        raise HTTPException(
            status_code=403,
            detail="Survey by sport phase is not currently open for this event.",
        )

    return await service.add_org_to_event_sport(
        payload.events_id, payload.sports_id, payload.org_id
    )


@router.get(
    "/{event_id}/sports/{sport_id}/orgs", response_model=list[SportEventOrgOnly]
)
async def list_event_sport_orgs(
    event_id: int, sport_id: int, db: AsyncSession = Depends(get_db)
):
    """
    **Show organizations signed up for a Sport-Event combo.**

    **Scenario:**
    Used to identify which Provinces/Federations are competing in "Football" for the "National Games 2024".

    **Success Response:**
    - `200 OK`: Returns the organization names and metadata.

    **Error Cases:**
    - `404 Not Found`: Event or Sport ID does not exist.
    """
    service = EventService(db)
    return await service.get_event_sport_orgs(event_id, sport_id)


@router.get("/{event_id}/org-sports/{org_id}")
async def list_org_event_sports(
    event_id: int, org_id: int, db: AsyncSession = Depends(get_db)
):
    service = EventService(db)
    return await service.get_org_event_sports(event_id, org_id)


@router.get(
    "/{event_id}/sports/{sport_id}/categories", response_model=list[CategoryPublic]
)
async def list_event_sport_categories(
    event_id: int, sport_id: int, db: AsyncSession = Depends(get_db)
):
    """
    **Show sub-categories (age/gender groups) for a Sport in an Event.**

    **Scenario:**
    Used when a user needs to see which divisions (e.g., "Men's Singles", "Women's 18+") are available for a given sport in that event.

    **Success Response:**
    - `200 OK`: Returns the list of categories.

    **Error Cases:**
    - `404 Not Found`: Sport or Event ID not found.
    """
    from src.services.sports_service import SportService

    service = SportService(db)
    return await service.get_sport_categories(event_id, sport_id)


@router.get("/sport-org/submissions", response_model=SportsEventOrgReviewList)
async def list_sport_org_submissions(
    event_id: int | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """List all org sport selections for admin review."""
    from sqlalchemy import select as sa_select
    from src.models.sports_event_org import sports_event_org as SeoModel
    from src.models.organization import Organization
    from src.models.sports import Sport
    from src.models.events import Events
    query = (
        sa_select(
            SeoModel.id,
            SeoModel.events_id,
            SeoModel.sports_id,
            SeoModel.organization_id,
            SeoModel.status,
            SeoModel.review_note,
            SeoModel.reviewed_at,
            SeoModel.created_at,
            Organization.name_kh.label("org_name"),
            Sport.name_kh.label("sport_name"),
            Events.name_kh.label("event_name"),
        )
        .join(Organization, Organization.id == SeoModel.organization_id)
        .join(Sport, Sport.id == SeoModel.sports_id)
        .join(Events, Events.id == SeoModel.events_id)
    )
    if event_id:
        query = query.where(SeoModel.events_id == event_id)
    if status:
        query = query.where(SeoModel.status == status)
    result = await db.execute(query)
    rows = result.mappings().all()
    return {"data": [dict(r) for r in rows], "count": len(rows)}

@router.patch("/sport-org/{id}/review", response_model=SportsEventOrgPublic)
async def review_sport_org(
    id: int,
    action: str = Body(..., embed=True),
    note: str | None = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Approve or reject an org sport selection (admin only).
    action: approve | reject
    """
    from src.models.sports_event_org import sports_event_org as SeoModel
    from datetime import datetime as dt

    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be approve or reject")
    obj = await db.get(SeoModel, id)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    obj.status = "APPROVED" if action == "approve" else "REJECTED"
    obj.review_note = note
    obj.reviewed_at = dt.utcnow()
    await db.commit()
    await db.refresh(obj)
    return obj

@router.delete("/delete-event-sport-org-link", status_code=status.HTTP_200_OK)
async def delete_event_sport_org_link(
    body: DeleteEventSportOrgLinkBody = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _: User = Depends(require_staff),
):
    """
    **Break the link between an Organization and a Sport-Event.**

    **Scenario:**
    Used when an organization pulls out of a specific sport but remains in the overall event.

    **Success Response:**
    - `204 No Content`: Link successfully removed.

    **Error Cases:**
    - `404 Not Found`: The association ID provided does not exist.
    """
    service = EventService(db)

    # Load the ACTUAL target row first so authorization binds to that row's real
    # owner org — not an attacker-supplied body.org_id (IDOR). 404 if it's gone.
    link = await service.get_event_sport_org_link(body.association_id)
    if not link:
        raise HTTPException(
            status_code=404,
            detail="The requested organization association was not found.",
        )
    enforce_org_access(current_user, link.organization_id)

    success = await service.remove_org_from_event_sport(body.association_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="The requested organization association was not found.",
        )
    return {"message": "Organization deleted from sport in event"}


@router.get("/{event_id}/organizations", response_model=list[EventOrgNamesPublic])
async def list_unique_orgs_in_event(event_id: int, db: AsyncSession = Depends(get_db)):
    """
    **List all unique participating Organizations in an Event.**

    **Scenario:**
    Used by event organizers to get a total list of all participating federations or provinces across all sports in a single tournament.

    **Success Response:**
    - `200 OK`: Returns the list of unique organization names.

    **Error Cases:**
    - `404 Not Found`: Event ID not found.
    """
    service = EventService(db)
    return await service.get_organizations_in_event(event_id)


@router.delete(
    "/remove-org-completely-from-event", status_code=status.HTTP_200_OK
)
async def remove_org_completely_from_event(
    body: RemoveOrgCompletelyFromEventBody = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Withdraw an Organization from all sports in an Event.**

    **Scenario:**
    Requested when an organization (e.g., province) is disqualified or withdraws from an entire competition. It purges all their sport/registration records related to that Event ID.

    **Access control:** ORGANIZATION users may only withdraw their own org;
    admin / super_admin / federation may withdraw any org.

    **Success Response:**
    - `204 No Content`: Organization and all their sport links are removed from the event.

    **Error Cases:**
    - `404 Not Found`: Organization was not part of this event.
    """
    enforce_org_access(current_user, body.org_id)
    service = EventService(db)
    success = await service.remove_org_from_entire_event(body.event_id, body.org_id)
    if not success:
        raise HTTPException(
            status_code=404, detail="Organization was not found in this event."
        )
    return {"message": "Organization deleted from event"}


@router.get("/{event_id}/survey-status", response_model=SurveyStatusResponse)
async def get_event_survey_status(
    event_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    service = EventService(db)
    return await service.get_event_survey_status(event_id)
