from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict

from src.models.enum.event import SportMode


class SportsEventCreate(BaseModel):
    events_id: int | None = None
    sports_id: int | None = None


class SportsEventConfigUpdate(BaseModel):
    """Body for PATCH /sports-events/{id}/config. Every field optional — only
    the provided fields are updated."""

    mode: SportMode | None = None
    team_size_min: int | None = None
    team_size_max: int | None = None
    quota_athletes_per_org: int | None = None
    quota_teams_per_org: int | None = None


class SportsEventPublic(BaseModel):
    id: int | None = None
    sports_id: int | None = None
    event_name: str | None = None
    sport_name: str | None = None
    created_at: datetime
    # --- Per-sport config (Phase 2) ---
    mode: SportMode | None = None
    team_size_min: int | None = None
    team_size_max: int | None = None
    quota_athletes_per_org: int | None = None
    quota_teams_per_org: int | None = None
    model_config = ConfigDict(from_attributes=True)


class SportsEventOrgPublicList(BaseModel):
    data: list[SportsEventPublic]
    count: int


class EligibleSportPublic(BaseModel):
    """A sport the caller's org selected in survey ② (sports_event_org), with the
    per-sport config attached and the org's current athlete count for the quota
    meter."""

    sports_event_id: int
    sports_id: int
    name_kh: str
    name_en: str | None = None
    mode: SportMode
    team_size_min: int | None = None
    team_size_max: int | None = None
    quota_athletes_per_org: int | None = None
    quota_teams_per_org: int | None = None
    athletes_used: int = 0
    model_config = ConfigDict(from_attributes=True)
