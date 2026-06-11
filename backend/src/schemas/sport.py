from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict


class SportCreate(BaseModel):
    name_kh: str
    sport_type: str


class SportUpdate(BaseModel):
    name_kh: str | None = None
    sport_type: str | None = None


class SportPublic(BaseModel):
    id: int
    name_kh: str
    sport_type: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SportsPublic(BaseModel):
    data: list[SportPublic]
    count: int
