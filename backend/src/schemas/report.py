from pydantic import BaseModel


class SurveyStatusOrgRow(BaseModel):
    org_id: int
    org_name_kh: str
    org_name_en: str | None = None
    survey_sport_submitted: bool = False
    survey_number_status: str | None = None


class SurveyStatusSportRow(BaseModel):
    sport_id: int
    sport_name_kh: str
    category_count: int = 0


class SurveyStatusResponse(BaseModel):
    event_id: int
    event_name_kh: str
    organizations: list[SurveyStatusOrgRow]
    federation_sports: list[SurveyStatusSportRow]
