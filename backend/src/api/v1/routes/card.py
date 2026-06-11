from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from src.services.card_service import get_card_by_p_id, get_cards_by_org_event
from src.database.deps import get_db, get_current_user, enforce_org_access
from src.models.user import User

router = APIRouter()


class CardResponse(BaseModel):
    id: int
    name: str
    gender: str
    sport: str
    role: str
    org_name: str
    card_type: str
    profile_image: str | None = None


class PaginatedCardsResponse(BaseModel):
    cards: List[CardResponse]
    total: int

@router.get(
    "/card/{p_id}/{org_id}/{event_id}",
    summary="Retrieve card by participant ID, organization, and event",
    description="Returns the generated card for the participant matching the given p_id, ensuring they participate in the specified organization and event.",
    response_model=CardResponse,
    responses={
        200: {
            "description": "Card retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "id": 1,
                        "name": "សុវណ្ណ រាជ",
                        "gender": "MALE",
                        "sport": "បាល់ទាត់",
                        "role": "Athlete",
                        "org_name": "ក្រសួងអប់រំ យុវជន និងកីឡា",
                        "card_type": "F",
                        "profile_image": "/uploads/photos/photo1.jpg",
                    }
                }
            },
        },
        404: {
            "description": "Card not found or participant not in specified org/event"
        },
    },
)
async def get_card(
    p_id: str,
    org_id: int,
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enforce_org_access(current_user, org_id)
    card_data = await get_card_by_p_id(p_id, org_id, event_id, db=db)
    if not card_data:
        raise HTTPException(
            status_code=404,
            detail="Card not found for this p_id or participant not in specified org/event",
        )

    return card_data


@router.get(
    "/cards/{org_id}/{event_id}",
    summary="Retrieve paginated cards by organization and event",
    description="Returns a paginated list of cards for all participants in the specified organization and event.",
    response_model=PaginatedCardsResponse,
    responses={
        200: {
            "description": "Cards retrieved successfully",
            "content": {
                "application/json": {
                    "example": {
                        "cards": [
                            {
                                "id": 1,
                                "name": "សុវណ្ណ រាជ",
                                "gender": "MALE",
                                "sport": "បាល់ទាត់",
                                "role": "Athlete",
                                "org_name": "ក្រសួងអប់រំ យុវជន និងកីឡា",
                                "card_type": "F",
                                "profile_image": "/uploads/photos/photo1.jpg",
                            },
                            {
                                "id": 2,
                                "name": "សុខា សុខា",
                                "gender": "FEMALE",
                                "sport": "វិញ្ញាសា",
                                "role": "coach",
                                "org_name": "ក្រសួងអប់រំ យុវជន និងកីឡា",
                                "card_type": "Fo",
                                "profile_image": "/uploads/photos/photo2.jpg",
                            },
                        ],
                        "total": 150,
                        "total_pages": 15,
                    }
                }
            },
        },
        404: {"description": "No cards found for this org/event"},
    },
)
async def get_cards(
    org_id: int,
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    enforce_org_access(current_user, org_id)
    result = await get_cards_by_org_event(org_id, event_id, db=db)
    if not result["cards"]:
        raise HTTPException(
            status_code=404,
            detail="No cards found for this org/event",
        )

    return result
