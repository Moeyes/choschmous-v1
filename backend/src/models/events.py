from sqlalchemy import Integer, String, Enum, Date, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime, date

from core.database import Base
from src.models.enum.event import eventType, AgeMode, PhaseStatus


# Reused enum type definitions so all phase columns share one DB type.
_age_mode_enum = Enum(
    AgeMode,
    name="age_mode",
    values_callable=lambda e: [m.value for m in e],
)
_phase_status_enum = Enum(
    PhaseStatus,
    name="phase_status",
    values_callable=lambda e: [m.value for m in e],
)

# The four lifecycle phases of an event, in order.
PHASES = ("survey_category", "survey_sport", "survey_number", "registration")


def phase_is_open(
    status: PhaseStatus | None,
    open_date: date | None,
    close_date: date | None,
) -> bool:
    """
    Compute whether a phase is currently open.

    - OPEN   -> True
    - CLOSED -> False
    - AUTO   -> True when today is within [open_date, close_date] (inclusive);
                False if either date is missing or today is outside the window.
    """
    if status == PhaseStatus.OPEN:
        return True
    if status == PhaseStatus.CLOSED:
        return False
    # AUTO (or unset) — fall back to the date window.
    if open_date is None or close_date is None:
        return False
    return open_date <= date.today() <= close_date


class Events(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name_kh: Mapped[str] = mapped_column(String(100))
    type: Mapped[eventType] = mapped_column(Enum(eventType, name="event_type"))

    # --- Core scheduling / metadata -------------------------------------
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # --- Age rule -------------------------------------------------------
    age_mode: Mapped[AgeMode | None] = mapped_column(_age_mode_enum, nullable=True)
    age_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    age_max: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Optional event-wide cap on total participants (Phase 2 — column only).
    participant_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # --- Phase: survey by category -------------------------------------
    survey_category_status: Mapped[PhaseStatus] = mapped_column(
        _phase_status_enum, nullable=False, server_default="AUTO"
    )
    survey_category_open_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    survey_category_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- Phase: survey by sport ----------------------------------------
    survey_sport_status: Mapped[PhaseStatus] = mapped_column(
        _phase_status_enum, nullable=False, server_default="AUTO"
    )
    survey_sport_open_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    survey_sport_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- Phase: survey by number ---------------------------------------
    survey_number_status: Mapped[PhaseStatus] = mapped_column(
        _phase_status_enum, nullable=False, server_default="AUTO"
    )
    survey_number_open_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    survey_number_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # --- Phase: registration -------------------------------------------
    registration_status: Mapped[PhaseStatus] = mapped_column(
        _phase_status_enum, nullable=False, server_default="AUTO"
    )
    registration_open_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    registration_close_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )

    # --- Computed open flags (read by EventPublic via from_attributes) --
    @property
    def survey_category_is_open(self) -> bool:
        return phase_is_open(
            self.survey_category_status,
            self.survey_category_open_date,
            self.survey_category_close_date,
        )

    @property
    def survey_sport_is_open(self) -> bool:
        return phase_is_open(
            self.survey_sport_status,
            self.survey_sport_open_date,
            self.survey_sport_close_date,
        )

    @property
    def survey_number_is_open(self) -> bool:
        return phase_is_open(
            self.survey_number_status,
            self.survey_number_open_date,
            self.survey_number_close_date,
        )

    @property
    def registration_is_open(self) -> bool:
        return phase_is_open(
            self.registration_status,
            self.registration_open_date,
            self.registration_close_date,
        )
