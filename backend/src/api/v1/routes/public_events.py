from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.deps import get_db
from src.schemas.event import EventPublic, EventsPublic
from src.services.events_service import EventService

router = APIRouter()


@router.get("", response_model=EventsPublic)
async def list_public_events(
    skip: int = 0,
    limit: int = 100,
    name: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    service = EventService(db)
    filters = {}
    if name:
        filters["name_kh"] = name
    events = await service.get_events(skip=skip, limit=limit, filters=filters)
    return {"data": events, "count": len(events)}


@router.get("/{event_id}", response_model=EventPublic)
async def get_public_event(event_id: int, db: AsyncSession = Depends(get_db)):
    service = EventService(db)
    event = await service.get_event(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event
