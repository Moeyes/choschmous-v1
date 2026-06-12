from datetime import date, datetime
from pydantic import BaseModel, Field
from typing import Optional


class OrganizerRoleCreate(BaseModel):
    name_kh: str
    name_en: str
    active: bool = True


class OrganizerRoleUpdate(BaseModel):
    name_kh: Optional[str] = None
    name_en: Optional[str] = None
    active: Optional[bool] = None


class OrganizerRoleRead(BaseModel):
    id: int
    name_kh: str
    name_en: str
    active: bool

    model_config = {"from_attributes": True}


class OrganizerRegistrationRequest(BaseModel):
    eventId: int = Field(..., alias="eventId")
    organizationId: Optional[int] = Field(None, alias="organizationId")
    organizerRoleId: int = Field(..., alias="organizerRoleId")

    lastNameKhmer: str = Field(..., alias="lastNameKhmer")
    firstNameKhmer: str = Field(..., alias="firstNameKhmer")
    lastNameLatin: str = Field(..., alias="lastNameLatin")
    firstNameLatin: str = Field(..., alias="firstNameLatin")
    gender: str
    dateOfBirth: date = Field(..., alias="dateOfBirth")
    phone: str
    idDocType: str = Field(..., alias="idDocType")
    nationality: str = "Cambodian"
    address: Optional[str] = None

    photoUrl: Optional[str] = Field(None, alias="photoUrl")
    nationalityDocumentPath: Optional[str] = Field(None, alias="nationalityDocumentPath")
    birthCertificatePath: Optional[str] = Field(None, alias="birthCertificatePath")
    nationalIdPath: Optional[str] = Field(None, alias="nationalIdPath")
    passportPath: Optional[str] = Field(None, alias="passportPath")

    model_config = {"populate_by_name": True, "use_enum_values": True, "extra": "ignore"}


class OrganizerResponse(BaseModel):
    enroll_id: int
    organizer_participation_id: int
    organizer_role_id: int
    role_name_en: str
    role_name_kh: str
    event_id: int
    organization_id: Optional[int] = None
    kh_family_name: str
    kh_given_name: str
    created_at: datetime

    model_config = {"from_attributes": True}
