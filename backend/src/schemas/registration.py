from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import date
from typing import Optional
import uuid
from src.models.enum.user import genderEnum, IdDocumentType, LeaderRole


class FullRegistrationRequest(BaseModel):
    eventId: int
    organizationId: int
    sportId: int
    categoryId: Optional[int] = None
    userId: Optional[uuid.UUID] = None

    kh_family_name: str = Field(..., alias="lastNameKhmer")
    kh_given_name: str = Field(..., alias="firstNameKhmer")
    en_family_name: str = Field(..., alias="lastNameLatin")
    en_given_name: str = Field(..., alias="firstNameLatin")
    phone: str = Field(..., alias="phone")
    address: Optional[str] = None
    photoUrl: Optional[str] = None
    nationalityDocumentUrl: Optional[str] = None
    birthCertificateUrl: Optional[str] = None
    nationalIdUrl: Optional[str] = None
    passportUrl: Optional[str] = None

    # These will store the actual Enum members
    gender: genderEnum
    date_of_birth: date = Field(..., alias="dateOfBirth")
    id_document_type: IdDocumentType = Field(..., alias="idDocType")

    role: str
    leaderRole: Optional[LeaderRole] = None

    model_config = ConfigDict(populate_by_name=True)

    @field_validator("gender", mode="before")
    @classmethod
    def validate_gender(cls, v):
        if isinstance(v, str):
            return v.upper()
        return v

    @field_validator("id_document_type", mode="before")
    @classmethod
    def validate_id_type(cls, v):
        # Maps frontend labels to your actual Enum members
        mapping = {
            "IDCard": "CAM_NID",
            "Passport": "CAM_PASSPORT",
            "BirthCertificate": "CAM_BIRTH_CERT",
            "FamilyBook": "CAM_FAMILY_BOOK",
        }
        return mapping.get(v, "OTHER" if isinstance(v, str) else v)

    @field_validator("leaderRole", mode="before")
    @classmethod
    def validate_leader_role(cls, v):
        if isinstance(v, str):
            return v.lower()
        return v
