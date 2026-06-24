from sqlalchemy import String, Boolean, Enum, ForeignKey, Integer, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

from core.database import Base
from src.models.enum.user import UserRole


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid()
    )

    kh_family_name: Mapped[str] = mapped_column(String(100), nullable=False)

    kh_given_name: Mapped[str] = mapped_column(String(100), nullable=False)

    en_family_name: Mapped[str] = mapped_column(String(100), nullable=False)

    en_given_name: Mapped[str] = mapped_column(String(100), nullable=False)

    email: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)

    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)

    full_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    hashed_password: Mapped[str] = mapped_column(
        "password",
        String(255),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="true",
    )

    is_superuser: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        server_default="false",
    )

    failed_attempts: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        server_default="0",
        default=0,
    )

    locked_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            values_callable=lambda enum: [e.value for e in enum],
            name="user_role",
            # NB: no explicit schema — "public" is the default, and stating it
            # made autogenerate report a phantom modify_type (reflected type
            # carries no schema), which kept `alembic check` permanently dirty.
            # Dropping it is metadata-only (the enum already lives in public),
            # and clears the drift so the CHOS-305 gate can be blocking.
        ),
        nullable=False,
        server_default="organization",
    )

    photo_path: Mapped[str | None] = mapped_column(String(255), nullable=True)

    organization_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("organizations.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    sport_id: Mapped[int | None] = mapped_column(
        Integer,
        ForeignKey("sports.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )

    token_valid_from: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )

    organization = relationship("Organization", foreign_keys=[organization_id])

    sport = relationship("Sport", foreign_keys=[sport_id])
