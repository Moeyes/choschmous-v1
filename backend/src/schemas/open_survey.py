from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict


class OpenSurveyFieldCreate(BaseModel):
    label_kh: str
    label_en: str | None = None
    field_type: str = "text"
    options: dict[str, Any] | None = None
    required: bool = True
    sort_order: int = 0


class OpenSurveyFieldUpdate(BaseModel):
    label_kh: str | None = None
    label_en: str | None = None
    field_type: str | None = None
    options: dict[str, Any] | None = None
    required: bool | None = None
    sort_order: int | None = None
    active: bool | None = None


class OpenSurveyFieldPublic(BaseModel):
    id: int
    event_id: int
    label_kh: str
    label_en: str | None
    field_type: str
    options: dict[str, Any] | None
    required: bool
    sort_order: int
    active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OpenSurveyFieldsPublic(BaseModel):
    data: list[OpenSurveyFieldPublic]
    count: int


class OpenSurveyBulkFieldsCreate(BaseModel):
    event_id: int
    fields: list[OpenSurveyFieldCreate]


class OpenSurveyResponseUpsert(BaseModel):
    responses: dict[int, str | None]


class OpenSurveyResponsePublic(BaseModel):
    id: int
    field_id: int
    organization_id: int
    value: str | None
    created_at: datetime
    updated_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class OpenSurveyResponseWithField(OpenSurveyResponsePublic):
    label_kh: str
    label_en: str | None
    field_type: str
    options: dict[str, Any] | None
    required: bool
    sort_order: int


class OpenSurveyFillView(BaseModel):
    # Org-facing fill view: every active field merged with the org's own answer.
    data: list[OpenSurveyResponseWithField]
    count: int


class OpenSurveyOrgStatus(BaseModel):
    org_id: int
    org_name_kh: str
    org_name_en: str | None
    total_fields: int
    answered_fields: int
    completed: bool
