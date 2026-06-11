from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict


class SportsEventCreate(BaseModel):
    events_id: int | None = None
    sports_id: int | None = None


class SportsEventPublic(BaseModel):
    id: int | None = None
    event_name: str | None = None
    sport_name: str | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class SportsEventOrgPublicList(BaseModel):
    data: list[SportsEventPublic]
    count: int
