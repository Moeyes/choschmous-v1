from pydantic import BaseModel


class SportParticipantCount(BaseModel):
    # Mirrors the per-sport rows built by ExcelService.get_org_sport_participant_counts.
    # sport_id is None on the appended grand-total ("សរុប") row.
    sport_id: int | None = None
    sport_name: str
    delegate_male: int = 0
    delegate_female: int = 0
    manager_male: int = 0
    manager_female: int = 0
    coach_male: int = 0
    coach_female: int = 0
    athlete_male: int = 0
    athlete_female: int = 0
    total_male: int = 0
    total_female: int = 0
    total: int = 0


class OrgSportParticipantExcelResponse(BaseModel):
    org_name: str
    event_name: str
    data: list[SportParticipantCount]


from datetime import datetime


class AttendedCategory(BaseModel):
    category: str
    gender: str | None = None


class OrgSportParticipantFullResponse(BaseModel):
    org_name: str
    event_name: str
    data: list[AttendedCategory]
