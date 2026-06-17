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


class CategorySubmissionPublic(BaseModel):
    """One by-category submission (a federation's category set for an
    event+sport) projected for the admin review queue. Mirrors the by-number
    ``ParticipationPerSportPublic`` shape: enriched names + review FSM fields."""

    id: int
    events_id: int | None = None
    sports_id: int | None = None
    event_name: str | None = None
    sport_name: str | None = None
    category_count: int = 0
    status: str = "SUBMITTED"
    review_note: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CategorySubmissionDetail(CategorySubmissionPublic):
    """Submission + its declared categories (relationship kept intact, not
    flattened) — used by the review detail view."""

    categories: list[CategorySurveyEntry] = []


class CategorySubmissionsPublic(BaseModel):
    data: list[CategorySubmissionPublic]
    count: int


class CategoryReviewRequest(BaseModel):
    """Drive an FSM transition on a by-category submission.

    action: one of submit | approve | reject | flag | request_revision
    note:   reason text (required for reject / flag / request_revision)
    """

    action: str
    note: str | None = None
