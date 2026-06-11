from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from src.database.deps import get_db
from src.services.sports_service import SportService
from src.schemas.sport import SportPublic, SportsPublic

router = APIRouter()


@router.get("", response_model=SportsPublic)
async def list_public_sports(
    skip: int = 0,
    limit: int = 100,
    sport_type: str | None = Query(None),
    name_kh: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    service = SportService(db)
    filters = {}
    if sport_type is not None:
        filters["sport_type"] = sport_type
    if name_kh is not None:
        filters["name_kh"] = name_kh
    sports = await service.get_sports(skip=skip, limit=limit, filters=filters)
    return {"data": sports, "count": len(sports)}


@router.get("/{sport_id}", response_model=SportPublic)
async def get_public_sport(sport_id: int, db: AsyncSession = Depends(get_db)):
    service = SportService(db)
    sport = await service.get_sport(sport_id)
    if not sport:
        raise HTTPException(status_code=404, detail="Sport not found")
    return sport
