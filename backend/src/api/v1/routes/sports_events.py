from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from core.ratelimit import sports_event_write_limiter
from src.database.deps import get_db, require_staff
from src.models.sports_event import sports_event
from src.models.user import User
from src.schemas.sports_event import (
    SportsEventCreate,
    SportsEventPublic,
    SportsEventConfigUpdate,
    SportsEventOrgPublicList,
)
from src.services.events_service import EventService

router = APIRouter()


async def get_event_service(db: AsyncSession = Depends(get_db)) -> EventService:
    return EventService(db)


@router.get("", response_model=SportsEventOrgPublicList)
async def list_sports_events(
    skip: int = 0, limit: int = 100, db: AsyncSession = Depends(get_db)
):
    """
    Retrieve a paginated list of all sports events associations.

    - **skip**: Number of items to skip.
    - **limit**: Maximum number of items to return.
    """
    stmt = select(sports_event).offset(skip).limit(limit)
    result = await db.execute(stmt)
    items = result.scalars().all()

    data = [
        {
            "id": i.id,
            "events_id": i.events_id,
            "sports_id": i.sports_id,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in items
    ]
    return {"data": data, "count": len(items)}


@router.post(
    "",
    response_model=SportsEventPublic,
    status_code=status.HTTP_201_CREATED,
    summary="Add sport to event",
)
async def create_sports_event(
    request: Request,
    response: Response,
    payload: SportsEventCreate, service: EventService = Depends(get_event_service),
    _: User = Depends(require_staff),
):
    """
    Associate a sport with an event.

    - **events_id**: ID of the event.
    - **sports_id**: ID of the sport.
    """
    await sports_event_write_limiter.check(request, response=response)
    try:
        return await service.add_sport_to_event(payload.events_id, payload.sports_id)
    except IntegrityError:
        raise HTTPException(status_code=404, detail="Event or sport not found.")


@router.patch(
    "/{id}/config",
    response_model=SportsEventPublic,
    summary="Set per-sport competition config (mode / team size / quotas)",
)
async def update_sports_event_config(
    id: int,
    payload: SportsEventConfigUpdate,
    service: EventService = Depends(get_event_service),
    _: User = Depends(require_staff),
):
    """
    **Configure a sport within an event** — mode (individual / team / both),
    team size bounds, and per-org quotas. Staff only. Only the fields present in
    the body are updated.
    """
    return await service.update_sport_event_config(id, payload)


@router.delete(
    "/{id}", status_code=status.HTTP_200_OK, summary="Remove sport from event"
)
async def delete_sports_event(
    request: Request,
    response: Response,
    id: int, service: EventService = Depends(get_event_service),
    _: User = Depends(require_staff),
):
    """
    Remove the association between a sport and an event.

    - **id**: ID of the sports event association.
    """
    await sports_event_write_limiter.check(request, response=response)
    success = await service.remove_sport_from_event(id)
    if not success:
        raise HTTPException(status_code=404, detail="Association not found")
    return {"message": "Deleted"}
