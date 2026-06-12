from datetime import datetime
from pydantic import BaseModel, Field


class TeamCreate(BaseModel):
    event_id: int
    sport_id: int
    org_id: int
    category_id: int | None = None
    name: str = Field(..., min_length=1, max_length=200)


class TeamUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    category_id: int | None = None


class TeamMember(BaseModel):
    enroll_id: int
    kh_family_name: str
    kh_given_name: str
    en_family_name: str
    en_given_name: str
    gender: str | None = None
    photo_url: str | None = None

    model_config = {"from_attributes": True}


class TeamPublic(BaseModel):
    id: int
    event_id: int
    sport_id: int
    org_id: int
    category_id: int | None = None
    name: str
    member_count: int = 0
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class TeamDetail(BaseModel):
    id: int
    event_id: int
    sport_id: int
    org_id: int
    category_id: int | None = None
    name: str
    member_count: int
    members: list[TeamMember] = []
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class TeamList(BaseModel):
    data: list[TeamPublic]
    count: int


class AddMemberRequest(BaseModel):
    enroll_id: int


class TeamNameCheck(BaseModel):
    available: bool
