from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.ratelimit import create_sport_limiter, create_category_limiter
from src.database.deps import get_db
from src.schemas.category import CategoryPublic
from src.schemas.sport import SportCreate, SportUpdate
from src.schemas import sport as sport_schema
from src.services.sports_service import SportService


router = APIRouter()


async def get_sport_service(db: AsyncSession = Depends(get_db)) -> SportService:
    return SportService(db)


@router.get("", response_model=sport_schema.SportsPublic)
async def list_sports(
    skip: int = 0,
    limit: int = 100,
    sport_type: str | None = Query(None),
    name_kh: str | None = Query(None),
    service: SportService = Depends(get_sport_service),
):
    """
    Retrieve a paginated list of all sports.

    - **sport_type**: Filter by type of sport (e.g., individual, team).
    - **name_kh**: Search by Khmer name of the sport.
    """
    filters = {}

    for field, value in [
        ("sport_type", sport_type),
        ("name_kh", name_kh),
    ]:
        if value is not None:
            filters[field] = value

    sports = await service.get_sports(skip=skip, limit=limit, filters=filters)

    return {
        "data": [sport_schema.SportPublic.model_validate(s) for s in sports],
        "count": len(sports),
    }


@router.get("/{sport_id}", response_model=sport_schema.SportPublic)
async def get_sport(sport_id: int, service: SportService = Depends(get_sport_service)):
    """
    Get core details for a specific sport by ID.
    """
    sport = await service.get_sport(sport_id)

    if not sport:
        raise HTTPException(status_code=404, detail="Sport not found")

    return sport


@router.get("/{sport_id}/categories", response_model=list[CategoryPublic])
async def get_categories_for_sport(sport_id: int, service: SportService = Depends(get_sport_service)):
    """Return categories associated with a sport across events."""
    categories = await service.get_categories_by_sport(sport_id)
    return categories


@router.post("", response_model=sport_schema.SportPublic)
async def create_sport(
    request: Request,
    response: Response,
    payload: SportCreate, service: SportService = Depends(get_sport_service)
):
    """
    **Register a new Sport (e.g., Football, Basketball, Karate).**

    **Scenario:**
    Used by admins to add a new sport to the system.
    Once created, this sport can be assigned to events and categories.

    **Success Response:**
    - `200 OK`: Sport successfully registered.

    **Error Cases:**
    - `400 Bad Request`: If sport details are invalid or missing.
    """
    await create_sport_limiter.check(request, response=response)
    return await service.create_sport(payload)


from fastapi import Body
from pydantic import BaseModel, field_validator
from src.models.enum.user import genderEnum


class AddCategoryBody(BaseModel):
    sport_id: int
    category: str
    gender: str | None = None
    event_id: int | None = None

    @field_validator("gender", mode="before")
    @classmethod
    def normalize_gender(cls, v):
        if isinstance(v, str):
            val = v.upper()
            if val in [e.value for e in genderEnum]:
                return val
            return None
        return v


class SportUpdateBody(BaseModel):
    sport_id: int
    data: SportUpdate


class SportDeleteBody(BaseModel):
    sport_id: int


@router.get("/category/{category_id}", response_model=CategoryPublic)
async def get_category_by_id(
    category_id: int, service: SportService = Depends(get_sport_service)
):
    """
    Retrieve a specific sport category by ID.

    Returns details such as category name and gender classification.
    """
    category = await service.get_category_by_id(category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return category


@router.post("/category", response_model=CategoryPublic)
async def add_sport_category(
    request: Request,
    response: Response,
    body: AddCategoryBody,
    service: SportService = Depends(get_sport_service),
):
    """
    **Create a Sub-Category for a specific Sport in an Event.**

    **Scenario:**
    Used to define groupings such as "U-18 Boys", "Mens Singles", "Womens Doubles".
    Each category is specifically linked to a **Sport** and optionally an **Event**.

    **Success Response:**
    - `201 Created`: Category successfully added.

    **Error Cases:**
    - `404 Not Found`: If the Sport or Event IDs are invalid.
    """
    await create_category_limiter.check(request, response=response)
    return await service.add_category_to_sport(
        event_id=body.event_id,
        sport_id=body.sport_id,
        category_name=body.category,
        gender=body.gender,
    )


class DeleteCategoryBody(BaseModel):
    category_id: int


@router.delete("/category")
async def delete_category(
    body: DeleteCategoryBody,
    service: SportService = Depends(get_sport_service),
):
    """
    **Permanently delete a Sport Category.**

    **Scenario:**
    Used when a specific division or weight class is canceled.

    **Warning**: This action is IRREVERSIBLE. Any athletes currently registered in this specific category will be **automatically disqualified** or their registration will become invalid.

    **Success Response:**
    - `204 No Content`: Category successfully removed.

    **Error Cases:**
    - `404 Not Found`: Category ID does not exist.
    """
    success = await service.delete_category(body.category_id)
    if not success:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}


class UpdateCategoryBody(BaseModel):
    id: int
    category: str | None = None
    gender: str | None = None
    sport_id: int | None = None

    @field_validator("gender", mode="before")
    @classmethod
    def normalize_gender(cls, v):
        if isinstance(v, str):
            val = v.upper()
            if val in [e.value for e in genderEnum]:
                return val
            return None
        return v


@router.patch("/category", response_model=CategoryPublic)
async def update_category(
    body: UpdateCategoryBody,
    service: SportService = Depends(get_sport_service),
):
    """
    Update the descriptive fields of an existing category.
    """
    updated = await service.update_category(body.id, body.model_dump(exclude_unset=True, exclude={"id"}))
    if not updated:
        raise HTTPException(status_code=404, detail="Category not found")
    return updated


# NOTE: these dynamic /{sport_id} routes are declared AFTER the static /category
# routes above so FastAPI matches "/category" before treating it as a sport_id.
@router.patch("/{sport_id}", response_model=sport_schema.SportPublic)
async def update_sport(
    sport_id: int,
    payload: SportUpdate,
    service: SportService = Depends(get_sport_service),
):
    """
    **Update an existing Sport** (Khmer name and/or sport type).

    **Error Cases:**
    - `404 Not Found`: Sport ID does not exist.
    """
    updated = await service.update_sport(sport_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Sport not found")
    return updated


@router.delete("/{sport_id}")
async def delete_sport(
    sport_id: int,
    service: SportService = Depends(get_sport_service),
):
    """
    **Permanently delete a Sport.**

    **Warning**: This is IRREVERSIBLE. Categories, event assignments and
    registrations that depend on this sport may be affected.

    **Error Cases:**
    - `404 Not Found`: Sport ID does not exist.
    """
    success = await service.delete_sport(sport_id)
    if not success:
        raise HTTPException(status_code=404, detail="Sport not found")
    return {"message": "Sport deleted"}
