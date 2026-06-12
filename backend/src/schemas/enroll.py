from enum import Enum as PyEnum

from pydantic import BaseModel, Field, ConfigDict, field_validator
from datetime import date
from typing import Optional
import uuid
from src.models.enum.user import genderEnum, IdDocumentType, LeaderRole


class RoleEnum(str, PyEnum):
    """Participant role — renders as a dropdown in Swagger."""

    athlete = "athlete"
    leader = "leader"


class FullRegistrationRequest(BaseModel):

    userId: Optional[uuid.UUID] = Field(None, alias="userId")

    eventId: int
    organizationId: int = Field(..., alias="organizationId")
    sportId: int
    categoryId: Optional[int] = None
    teamId: Optional[int] = None

    kh_family_name: str = Field(..., alias="lastNameKhmer")
    kh_given_name: str = Field(..., alias="firstNameKhmer")
    en_family_name: str = Field(..., alias="lastNameLatin")
    en_given_name: str = Field(..., alias="firstNameLatin")
    phone: str = Field(..., alias="phone")

    gender: genderEnum
    date_of_birth: date = Field(..., alias="dateOfBirth")
    id_document_type: IdDocumentType = Field(..., alias="idDocType")

    role: str
    leaderRole: Optional[LeaderRole] = None

    # Set true to override the soft-duplicate (name + DoB) warning and register anyway.
    force: bool = False

    # Address
    address: Optional[str] = None

    # Document URLs (optional for now)
    photoUrl: Optional[str] = None
    nationalityDocumentUrl: Optional[str] = None
    birthCertificateUrl: Optional[str] = None
    nationalIdUrl: Optional[str] = None
    passportUrl: Optional[str] = None

    # Extra fields from frontend (ignored)
    eventName: Optional[str] = None
    organizationName: Optional[str] = None
    organizationType: Optional[str] = None
    sportName: Optional[str] = None
    categoryName: Optional[str] = None
    fullNameKhmer: Optional[str] = None
    fullNameEnglish: Optional[str] = None
    nationality: Optional[str] = None
    nationalID: Optional[str] = None
    selectedDocKeys: Optional[str] = None
    athleteCategory: Optional[str] = None

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
        extra="ignore",  # Ignore extra fields from frontend
    )

    @field_validator(
        "eventId", "organizationId", "sportId", "categoryId", mode="before"
    )
    @classmethod
    def convert_string_ids_to_int(cls, v):
        """Convert string IDs to integers."""
        if isinstance(v, str) and v.isdigit():
            return int(v)
        return v

    @field_validator("gender", mode="before")
    @classmethod
    def fit_to_gender_enum(cls, v):
        """Converts 'Male' or 'male' -> 'MALE' to fit the Enum member."""
        if isinstance(v, str):
            val = v.upper()
            if val in [e.value for e in genderEnum]:
                return val
        return v

    @field_validator("id_document_type", mode="before")
    @classmethod
    def fit_to_id_doc_enum(cls, v):
        """Maps Frontend labels to actual DB Enum values."""
        mapping = {
            "IDCard": "CAM_NID",
            "Passport": "CAM_PASSPORT",
            "BirthCertificate": "CAM_BIRTH_CERT",
            "FamilyBook": "CAM_FAMILY_BOOK",
        }
        target = mapping.get(v, "OTHER" if isinstance(v, str) else v)
        return target

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, v):
        """Convert role to lowercase."""
        if isinstance(v, str):
            return v.lower()
        return v


# ─── Filter / Query Params ───────────────────────────────────────────
class ParticipantFilterParams(BaseModel):
    role: Optional[RoleEnum] = None
    event_id: Optional[int] = None
    sport_id: Optional[int] = None
    organization_id: Optional[int] = None
    category_id: Optional[int] = None
    gender: Optional[str] = None
    search: Optional[str] = None  # Search by name or phone
    leader_roles: Optional[list[LeaderRole]] = None
    limit: int = 20
    offset: int = 0


# ─── Update Schema ───────────────────────────────────────────────────
class ParticipantUpdateRequest(BaseModel):
    """Update personal info and/or participation data."""

    # Personal info (all optional for partial update)
    kh_family_name: Optional[str] = None
    kh_given_name: Optional[str] = None
    en_family_name: Optional[str] = None
    en_given_name: Optional[str] = None
    phone: Optional[str] = None
    gender: Optional[genderEnum] = None
    date_of_birth: Optional[date] = None

    # Address
    address: Optional[str] = None

    # Document URLs
    photoUrl: Optional[str] = None
    nationalityDocumentUrl: Optional[str] = None
    birthCertificateUrl: Optional[str] = None
    nationalIdUrl: Optional[str] = None
    passportUrl: Optional[str] = None

    # Participation fields
    sport_id: Optional[int] = None
    organization_id: Optional[int] = None
    category_id: Optional[int] = None  # athlete only
    leader_role: Optional[LeaderRole] = None  # leader only

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
    )

    @field_validator("gender", mode="before")
    @classmethod
    def fit_to_gender_enum(cls, v):
        if isinstance(v, str):
            val = v.upper()
            if val in [e.value for e in genderEnum]:
                return val
        return v


# ─── Response Schemas ─────────────────────────────────────────────────
class SportRead(BaseModel):
    id: int
    name: str


class OrgRead(BaseModel):
    id: int
    name: str


class CategoryRead(BaseModel):
    id: int
    name: str


class ParticipantDetailResponse(BaseModel):
    participant_id: int
    kh_family_name: str
    kh_given_name: str
    en_family_name: str
    en_given_name: str
    name_kh: str
    name_en: str
    gender: str
    phone: str
    role: str
    # Address
    address: Optional[str] = None
    
    # Document URLs
    photoUrl: Optional[str] = None
    nationalityDocumentUrl: Optional[str] = None
    birthCertificateUrl: Optional[str] = None
    nationalIdUrl: Optional[str] = None
    passportUrl: Optional[str] = None

    # Nested participation data
    sport: Optional[SportRead] = None
    organization: Optional[OrgRead] = None
    category: Optional[CategoryRead] = None  # athlete only
    leader_role: Optional[str] = None  # leader only
    event_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class ParticipantListResponse(BaseModel):
    status: str = "success"
    data: list[ParticipantDetailResponse]
    count: int


# ─── Update / Delete Request Bodies ───────────────────────────────────
class ParticipantUpdateBody(BaseModel):
    enroll_id: int
    role: RoleEnum
    data: ParticipantUpdateRequest


class ParticipantDeleteBody(BaseModel):
    enroll_id: int
