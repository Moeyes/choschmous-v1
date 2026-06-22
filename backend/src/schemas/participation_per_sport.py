from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ParticipationPerSportCreate(BaseModel):
    org_id: int
    events_id: int
    sports_id: int
    organization_id: int
    athlete_female_count: int | None = 0
    leader_female_count: int | None = 0
    athlete_male_count: int | None = 0
    leader_male_count: int | None = 0

    model_config = ConfigDict(populate_by_name=True)


class ParticipationPerSportUpdate(BaseModel):
    org_id: int | None = None
    events_id: int | None = None
    sports_id: int | None = None
    organization_id: int | None = None
    athlete_female_count: int | None = None
    leader_female_count: int | None = None
    athlete_male_count: int | None = None
    leader_male_count: int | None = None

    model_config = ConfigDict(populate_by_name=True)


class ParticipationPerSportPublic(BaseModel):
    id: int
    org_id: int
    org_name: str | None = None
    event_name: str | None = None
    event_id: int | None = None
    sport_id: int | None = None
    sport_name: str | None = None
    sports_events_id: int | None = Field(None, alias="sports_Events_id")
    athlete_female_count: int | None
    leader_female_count: int | None
    athlete_male_count: int | None
    leader_male_count: int | None
    status: str = "SUBMITTED"
    review_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class ParticipationPerSportPublicList(BaseModel):
    data: list[ParticipationPerSportPublic]
    count: int


class ParticipationReviewRequest(BaseModel):
    """Drive an FSM transition on a participation submission.

    action: one of submit | approve | reject | flag | request_revision
    note:   reason text (required for reject / flag / request_revision)
    """

    action: str
    note: str | None = None
