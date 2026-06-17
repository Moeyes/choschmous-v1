from datetime import datetime
from typing import Optional
import uuid

from pydantic import BaseModel, EmailStr
from pydantic import ConfigDict, model_validator

from src.models.enum.user import UserRole


def _role_value(role) -> Optional[str]:
    """Normalise a role (enum or str) to its string value for comparison."""
    if role is None:
        return None
    return role.value if hasattr(role, "value") else str(role)


class UserBase(BaseModel):
    kh_family_name: str
    kh_given_name: str
    en_family_name: str
    en_given_name: str
    email: EmailStr
    username: str
    role: UserRole | str | None = None
    organization_id: Optional[int] = None
    sport_id: Optional[int] = None
    photo_path: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    is_superuser: Optional[bool] = False


class UserCreate(UserBase):
    password: str  # validated for min_length in _validate_password

    @model_validator(mode="after")
    def _validate_password(self) -> "UserCreate":
        if len(self.password) < 8:
            raise ValueError("password must be at least 8 characters")
        return self

    @model_validator(mode="after")
    def _validate_role_bindings(self) -> "UserCreate":
        role = _role_value(self.role)

        if role == UserRole.FEDERATION.value:
            if self.sport_id is None:
                raise ValueError("sport_id is required when role is 'federation'.")
            # A federation user is bound to a sport, not an organization.
            self.organization_id = None
        elif role == UserRole.ORGANIZATION.value:
            if self.organization_id is None:
                raise ValueError(
                    "organization_id is required when role is 'organization'."
                )
            self.sport_id = None
        else:
            # admin / super_admin (or unset): neither binding applies.
            self.organization_id = None
            self.sport_id = None

        return self


class UserUpdate(BaseModel):
    kh_family_name: str | None = None
    kh_given_name: str | None = None
    en_family_name: str | None = None
    en_given_name: str | None = None
    email: EmailStr | None = None
    username: str | None = None
    role: UserRole | str | None = None
    organization_id: Optional[int] = None
    sport_id: Optional[int] = None
    photo_path: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_superuser: Optional[bool] = None
    password: str | None = (
        None  # validated for min_length in user_service before hashing
    )


class UserPublic(BaseModel):
    id: uuid.UUID
    kh_family_name: str
    kh_given_name: str
    en_family_name: str
    en_given_name: str
    email: EmailStr
    username: str
    role: str
    organization_id: Optional[int] = None
    sport_id: Optional[int] = None
    photo_path: Optional[str] = None
    full_name: Optional[str] = None
    is_active: bool
    is_superuser: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UsersPublic(BaseModel):
    data: list[UserPublic]
    count: int
