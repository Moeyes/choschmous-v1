from datetime import datetime, date
from pydantic import BaseModel, ConfigDict, model_validator

from src.models.enum.event import eventType, AgeMode, PhaseStatus


class EventCreate(BaseModel):
    name_kh: str
    type: eventType

    # Required scheduling + age rule.
    start_date: date
    end_date: date
    age_mode: AgeMode
    age_min: int
    age_max: int

    # Optional metadata.
    description: str | None = None
    location: str | None = None

    # Phase gates — accepted on create; status defaults to AUTO.
    survey_category_status: PhaseStatus = PhaseStatus.AUTO
    survey_category_open_date: date | None = None
    survey_category_close_date: date | None = None

    survey_sport_status: PhaseStatus = PhaseStatus.AUTO
    survey_sport_open_date: date | None = None
    survey_sport_close_date: date | None = None

    survey_number_status: PhaseStatus = PhaseStatus.AUTO
    survey_number_open_date: date | None = None
    survey_number_close_date: date | None = None

    registration_status: PhaseStatus = PhaseStatus.AUTO
    registration_open_date: date | None = None
    registration_close_date: date | None = None

    @model_validator(mode="after")
    def _validate(self) -> "EventCreate":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date.")
        if self.age_min > self.age_max:
            raise ValueError("age_min must be less than or equal to age_max.")
        return self


class EventUpdate(BaseModel):
    name_kh: str | None = None
    type: eventType | None = None

    start_date: date | None = None
    end_date: date | None = None
    description: str | None = None
    location: str | None = None
    age_mode: AgeMode | None = None
    age_min: int | None = None
    age_max: int | None = None

    survey_category_status: PhaseStatus | None = None
    survey_category_open_date: date | None = None
    survey_category_close_date: date | None = None

    survey_sport_status: PhaseStatus | None = None
    survey_sport_open_date: date | None = None
    survey_sport_close_date: date | None = None

    survey_number_status: PhaseStatus | None = None
    survey_number_open_date: date | None = None
    survey_number_close_date: date | None = None

    registration_status: PhaseStatus | None = None
    registration_open_date: date | None = None
    registration_close_date: date | None = None

    @model_validator(mode="after")
    def _validate(self) -> "EventUpdate":
        if (
            self.start_date is not None
            and self.end_date is not None
            and self.end_date < self.start_date
        ):
            raise ValueError("end_date must be on or after start_date.")
        if (
            self.age_min is not None
            and self.age_max is not None
            and self.age_min > self.age_max
        ):
            raise ValueError("age_min must be less than or equal to age_max.")
        return self


class EventPublic(BaseModel):
    id: int
    name_kh: str
    type: eventType

    start_date: date | None = None
    end_date: date | None = None
    description: str | None = None
    location: str | None = None
    age_mode: AgeMode | None = None
    age_min: int | None = None
    age_max: int | None = None

    survey_category_status: PhaseStatus
    survey_category_open_date: date | None = None
    survey_category_close_date: date | None = None

    survey_sport_status: PhaseStatus
    survey_sport_open_date: date | None = None
    survey_sport_close_date: date | None = None

    survey_number_status: PhaseStatus
    survey_number_open_date: date | None = None
    survey_number_close_date: date | None = None

    registration_status: PhaseStatus
    registration_open_date: date | None = None
    registration_close_date: date | None = None

    # Computed gates (sourced from Events model properties).
    survey_category_is_open: bool
    survey_sport_is_open: bool
    survey_number_is_open: bool
    registration_is_open: bool

    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EventsPublic(BaseModel):
    data: list[EventPublic]
    count: int


class PhaseUpdate(BaseModel):
    """Body for PATCH /events/{event_id}/phase."""
    phase: str
    status: PhaseStatus
    open_date: date | None = None
    close_date: date | None = None

    @model_validator(mode="after")
    def _validate_phase(self) -> "PhaseUpdate":
        from src.models.events import PHASES

        if self.phase not in PHASES:
            raise ValueError(f"phase must be one of {list(PHASES)}.")
        return self


# ── Inline request bodies formerly defined in routes/events.py ──────────────


class DeleteEventBody(BaseModel):
    event_id: int


class RemoveSportFromEventBody(BaseModel):
    association_id: int


class EventSportOrgLink(BaseModel):
    events_id: int
    sports_id: int
    org_id: int


class DeleteEventSportOrgLinkBody(BaseModel):
    association_id: int
    org_id: int


class RemoveOrgCompletelyFromEventBody(BaseModel):
    event_id: int
    org_id: int
