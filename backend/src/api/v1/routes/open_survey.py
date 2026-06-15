from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.deps import (
    get_db,
    get_current_user,
    get_effective_org_id,
    require_admin,
)
from src.models.user import User
from src.schemas.open_survey import (
    OpenSurveyFieldCreate,
    OpenSurveyFieldUpdate,
    OpenSurveyFieldPublic,
    OpenSurveyFieldsPublic,
    OpenSurveyBulkFieldsCreate,
    OpenSurveyResponseUpsert,
    OpenSurveyResponsePublic,
    OpenSurveyFillView,
    OpenSurveyOrgStatus,
)
from src.services.open_survey_service import OpenSurveyService, OpenSurveyError

router = APIRouter()


# ---- Field management (admin only) ------------------------------------
@router.get("/fields", response_model=OpenSurveyFieldsPublic)
async def list_open_survey_fields(
    event_id: int = Query(...),
    include_inactive: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """**List an event's open-survey fields (admin).**

    Active only by default; pass ``include_inactive=true`` to see soft-deleted
    fields too.
    """
    service = OpenSurveyService(db)
    fields = await service.list_fields(event_id, include_inactive=include_inactive)
    return OpenSurveyFieldsPublic(data=fields, count=len(fields))


@router.post("/fields", response_model=OpenSurveyFieldPublic)
async def create_open_survey_field(
    obj_in: OpenSurveyFieldCreate,
    event_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """**Add a single open-survey field to an event (admin).**"""
    service = OpenSurveyService(db)
    return await service.create_field(event_id, obj_in)


@router.post("/fields/bulk", response_model=OpenSurveyFieldsPublic)
async def bulk_create_open_survey_fields(
    payload: OpenSurveyBulkFieldsCreate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """**Add many open-survey fields to an event in one call (admin).**

    ``event_id`` is taken from the body so all fields land on the same event.
    """
    service = OpenSurveyService(db)
    fields = await service.bulk_create_fields(payload)
    return OpenSurveyFieldsPublic(data=fields, count=len(fields))


@router.patch("/fields/{field_id}", response_model=OpenSurveyFieldPublic)
async def update_open_survey_field(
    field_id: int,
    obj_in: OpenSurveyFieldUpdate,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """**Edit an open-survey field — partial update (admin).**"""
    service = OpenSurveyService(db)
    field = await service.update_field(field_id, obj_in)
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    return field


@router.delete("/fields/{field_id}", response_model=OpenSurveyFieldPublic)
async def deactivate_open_survey_field(
    field_id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """**Deactivate (soft-delete) an open-survey field (admin).**

    Sets ``active = false`` so existing org answers are preserved but the field
    no longer counts toward completion or accepts new submissions.
    """
    service = OpenSurveyService(db)
    field = await service.deactivate_field(field_id)
    if not field:
        raise HTTPException(status_code=404, detail="Field not found")
    return field


# ---- Org responses (org fills values; phase-gated) --------------------
@router.get("/responses", response_model=OpenSurveyFillView)
async def get_open_survey_fill_view(
    event_id: int = Query(...),
    organization_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """**Load an org's fill view for an event's open survey.**

    Returns every ACTIVE field (ordered by ``sort_order, id``) merged with the
    caller-org's current answer — ``value`` is null for fields not yet answered.

    **Access control:** ORGANIZATION users are forced to their own org (the
    ``organization_id`` query param is ignored); admin / super_admin / federation
    may target any org via ``organization_id``.

    **Not phase-gated** — an org may review its own answers after the open-survey
    phase closes. (The write side, ``POST /responses``, stays phase-gated.)

    **Errors:**
    - `400`: no org resolved (non-org caller without ``organization_id``).
    """
    effective_org_id = get_effective_org_id(current_user, organization_id)
    if effective_org_id is None:
        raise HTTPException(
            status_code=400,
            detail="organization_id is required for this action.",
        )

    service = OpenSurveyService(db)
    data = await service.get_org_fill_view(event_id, effective_org_id)
    return OpenSurveyFillView(data=data, count=len(data))


@router.post("/responses", response_model=list[OpenSurveyResponsePublic])
async def upsert_open_survey_responses(
    payload: OpenSurveyResponseUpsert,
    event_id: int = Query(...),
    organization_id: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """**Fill / update this organization's answers for an event's open survey.**

    Upserts one row per ``(field_id, organization_id)``.

    **Access control:** ORGANIZATION users are forced to their own org (the
    ``organization_id`` query param is ignored); admin / super_admin / federation
    may target any org via ``organization_id``.

    **Gated** on the event's ``survey_open`` phase being open (403 if closed),
    mirroring the category-survey phase gate.

    **Errors:**
    - `400`: no org resolved, or a field id is unknown / inactive for this event.
    - `403`: the open-survey phase is closed for this event.
    - `404`: event not found.
    """
    effective_org_id = get_effective_org_id(current_user, organization_id)
    if effective_org_id is None:
        raise HTTPException(
            status_code=400,
            detail="organization_id is required for this action.",
        )

    service = OpenSurveyService(db)

    event = await service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if not event.survey_open_is_open:
        raise HTTPException(
            status_code=403,
            detail="Open survey phase is not currently open for this event.",
        )

    try:
        return await service.upsert_responses(event_id, effective_org_id, payload)
    except OpenSurveyError as exc:
        raise HTTPException(status_code=exc.code, detail=str(exc))


# ---- Completion overview (admin only) ---------------------------------
@router.get("/overview", response_model=list[OpenSurveyOrgStatus])
async def open_survey_overview(
    event_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """**Per-organization completion overview for an event (admin).**

    Returns, for every organization, how many of the event's active fields it has
    answered and whether it is fully complete.
    """
    service = OpenSurveyService(db)
    return await service.org_status_overview(event_id)
