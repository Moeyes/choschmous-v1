from datetime import datetime
from pydantic import BaseModel
from pydantic import ConfigDict

class SportsEventOrgPublic(BaseModel):
    id: int
    events_id: int | None = None
    sports_id: int | None = None
    organization_id: int | None = None
    status: str = "SUBMITTED"
    review_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime
    org_name: str | None = None
    sport_name: str | None = None
    event_name: str | None = None
    model_config = ConfigDict(from_attributes=True)

class SportEventOrgOnly(BaseModel):
    id: int
    organization_id: int
    organization_name: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SportsEventOrgPublicList(BaseModel):
    data: list[SportEventOrgOnly]
    count: int

class EventOrgNamesPublic(BaseModel):
    organization_id: int
    organization_name: str
    model_config = ConfigDict(from_attributes=True)
