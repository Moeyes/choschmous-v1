from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.deps import (
    get_db,
    get_current_user,
    get_effective_sport_id,
    require_staff,
)
from src.models.user import User
from src.schemas.category_survey import (
    CategorySurveyUpsert,
    CategorySurveyEntry,
)
from src.services.category_survey_service import CategorySurveyService

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
