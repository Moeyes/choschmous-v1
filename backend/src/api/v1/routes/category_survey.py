from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.deps import (
    get_db,
    get_current_user,
    get_effective_sport_id,
    require_admin,
    require_staff,
)
from src.models.user import User
from src.schemas.category_survey import (
    CategorySurveyUpsert,
    CategorySurveyEntry,
    CategorySubmissionDetail,
    CategorySubmissionsPublic,
    CategoryReviewRequest,
)
from src.services.category_survey_service import (
    CategorySurveyService,
    CategoryReviewError,
)

router = APIRouter()


@router.post("/category", response_model=list[CategorySurveyEntry])
async def upsert_category_survey(
    payload: CategorySurveyUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_staff),
):
    """
    **Submit categories for a sport in an event (federation-only).**

    Federation users are forced to their own ``sport_id``; the ``sport_id`` in
    the body is silently overridden. Admin / super_admin may set any sport.

    Gates on ``event.survey_category_is_open`` (403 if closed).
    """
    effective_sport_id = get_effective_sport_id(current_user, payload.sport_id)
    payload.sport_id = effective_sport_id

    service = CategorySurveyService(db)

    event = await service.check_event_phase_open(payload.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if not event.survey_category_is_open:
        raise HTTPException(
            status_code=403,
            detail="Survey by category phase is not currently open for this event.",
        )

    cats = await service.upsert_categories(payload)
    return cats


@router.get("/category", response_model=list[CategorySurveyEntry])
async def list_category_survey(
    event_id: int = Query(...),
    sport_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """**Get current categories for a (event, sport).**"""
    get_effective_sport_id(current_user, sport_id)

    service = CategorySurveyService(db)
    return await service.list_categories(event_id, sport_id)


@router.get("/category/submissions", response_model=CategorySubmissionsPublic)
async def list_category_submissions(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    event_id: int | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    **Admin review queue for by-category submissions.**

    Lists one row per (event, sport) submission with its declared-category count
    and review status. Optional ``event_id`` / ``status`` filters. Admin only.

    **Error Cases:**
    - `403 Forbidden`: Caller is not an admin.
    - `422 Unprocessable Entity`: Invalid query parameters.
    """
    service = CategorySurveyService(db)
    rows = await service.list_submissions(
        skip=skip, limit=limit, event_id=event_id, status=status
    )
    return CategorySubmissionsPublic(data=rows, count=len(rows))


@router.get("/category/submissions/{id}", response_model=CategorySubmissionDetail)
async def get_category_submission(
    id: int,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    **Retrieve a by-category submission with its declared categories (admin).**

    **Error Cases:**
    - `403 Forbidden`: Caller is not an admin.
    - `404 Not Found`: Submission ID does not exist.
    """
    service = CategorySurveyService(db)
    obj = await service.get_submission(id)
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj


@router.patch(
    "/category/submissions/{id}/review", response_model=CategorySubmissionDetail
)
async def review_category_submission(
    id: int,
    body: CategoryReviewRequest,
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """
    **Apply a review decision to a by-category submission (admin only).**

    Drives the status FSM:
    `DRAFT -> SUBMITTED -> APPROVED | REJECTED | FLAGGED | REVISION_REQUESTED`.

    **Body:** `action` (submit | approve | reject | flag | request_revision)
    and an optional `note` (required for reject / flag / request_revision).

    **Error Cases:**
    - `400 Bad Request`: Unknown action, or a required note is missing.
    - `403 Forbidden`: Caller is not an admin.
    - `404 Not Found`: Submission ID does not exist.
    - `409 Conflict`: Transition not allowed from the current status.
    """
    service = CategorySurveyService(db)
    try:
        obj = await service.review(id, body.action, body.note)
    except CategoryReviewError as exc:
        raise HTTPException(status_code=exc.code, detail=str(exc))
    if not obj:
        raise HTTPException(status_code=404, detail="Not found")
    return obj
