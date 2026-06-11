from enum import Enum as PyEnum


class UserRole(PyEnum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"
    ORGANIZATION = "organization"
    FEDERATION = "federation"


class IdDocumentType(PyEnum):
    """Common identity document types in Cambodia & region"""

    CAM_NID = "CAM_NID"  # Changed from "national_id"
    CAM_PASSPORT = "CAM_PASSPORT"  # Changed from "passport"
    CAM_BIRTH_CERT = "CAM_BIRTH_CERT"  # Changed from "birth_certificate"
    CAM_FAMILY_BOOK = "CAM_FAMILY_BOOK"  # Changed from "family_book"
    OTHER = "OTHER"  # Changed from "other"


class genderEnum(PyEnum):
    MALE = "MALE"
    FEMALE = "FEMALE"


class medal_typeEnum(PyEnum):
    GOLD = "gold"
    SILVER = "silver"
    BRONZE = "bronze"
    none = "none"


class LeaderRole(PyEnum):
    COACH = "coach"
    MANAGER = "manager"
    DELEGATE = "delegate"
    TEAM_LEAD = "team_lead"
    COACH_TRAINER = "coach_trainer"
    TEACHER_ASSISTANT = "teacher_assistant"
