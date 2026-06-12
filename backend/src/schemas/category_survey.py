from datetime import datetime
from pydantic import BaseModel, ConfigDict

from src.models.enum.user import genderEnum


class CategorySurveyItem(BaseModel):
    name: str
    gender: genderEnum


class CategorySurveyUpsert(BaseModel):
    event_id: int
    sport_id: int
    categories: list[CategorySurveyItem]


class CategorySurveyEntry(BaseModel):
    id: int
    sports_id: int | None = None
    category: str
    gender: genderEnum | None = None
    events_id: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
