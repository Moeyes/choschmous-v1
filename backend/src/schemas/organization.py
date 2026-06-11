from datetime import datetime

from pydantic import BaseModel
from pydantic import ConfigDict

from src.models.enum.org import instituteType


class OrganizationCreate(BaseModel):
    name_kh: str
    name_en: str | None = None
    type: instituteType


class OrganizationUpdate(BaseModel):
    name_kh: str | None = None
    name_en: str | None = None
    type: instituteType | None = None


class OrganizationPublic(BaseModel):
    id: int
    name_kh: str
    name_en: str | None = None
    type: instituteType
    code: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class OrganizationsPublic(BaseModel):
    data: list[OrganizationPublic]
    count: int
