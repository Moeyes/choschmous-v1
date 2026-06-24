"""Registration validation rules (CHOS-206).

Extracted verbatim from ParticipantService._validate_registration / _validate_age
/ _validate_documents / _check_duplicate; ``self.db`` -> ``db`` and ``self._raise``
-> ``raise_localized``. The rules and their order/codes are unchanged.
"""

import logging

from sqlalchemy import func, select
from fastapi import HTTPException

from datetime import date

from src.models.enroll import Enroll
from src.models.athletes import athletes as Athlete
from src.models.athlete_participation import (
    athlete_participation as AthleteParticipation,
)
from src.models.leader import leader as Leader
from src.models.leader_participation import leader_participation as LeaderParticipation
from src.models.events import Events
from src.models.category import category as CategoryModel
from src.models.sports_event import sports_event as SportsEvent
from src.models.sports_event_org import sports_event_org as SportsEventOrg
from src.models.enum.event import AgeMode

from src.schemas.registration import FullRegistrationRequest

from app.application.participants.errors import raise_localized, age_on

logger = logging.getLogger(__name__)


async def validate_registration(db, data: FullRegistrationRequest):
    role = data.role.lower()

    event = await db.get(Events, data.eventId)
    if not event:
        raise_localized(404, "EVENT_NOT_FOUND", "Event not found.")

    # Rule 1 — registration phase must be open.
    if not event.registration_is_open:
        raise_localized(
            403, "REGISTRATION_CLOSED", "Registration is not open for this event."
        )

    # Rule 0 — event-wide participant cap.
    if event.participant_cap is not None:
        used_total = (
            await db.execute(
                select(func.count()).select_from(
                    select(AthleteParticipation.id)
                    .where(
                        AthleteParticipation.events_id == data.eventId,
                    )
                    .union_all(
                        select(LeaderParticipation.id).where(
                            LeaderParticipation.events_id == data.eventId,
                        )
                    )
                    .subquery()
                )
            )
        ).scalar() or 0
        if used_total >= event.participant_cap:
            raise_localized(
                409,
                "PARTICIPANT_CAP_REACHED",
                "The event has reached its maximum participant capacity.",
                used=used_total,
                cap=event.participant_cap,
            )

    # Rule 6a — sport eligibility: the org must have selected this sport in
    # survey ② (sports_event_org).
    elig = await db.execute(
        select(SportsEventOrg.id).where(
            SportsEventOrg.events_id == data.eventId,
            SportsEventOrg.sports_id == data.sportId,
            SportsEventOrg.organization_id == data.organizationId,
        )
    )
    if elig.scalar_one_or_none() is None:
        raise_localized(
            403,
            "SPORT_NOT_ELIGIBLE",
            "This sport is not in your organization's survey "
            "selections for this event.",
        )

    config = (
        await db.execute(
            select(SportsEvent).where(
                SportsEvent.events_id == data.eventId,
                SportsEvent.sports_id == data.sportId,
            )
        )
    ).scalar_one_or_none()

    # Athlete-only rules: category, age window, quota.
    if role == "athlete":
        # Rule 6b — category must exist for (event, sport).
        if data.categoryId is None:
            raise_localized(
                422, "CATEGORY_INVALID", "An athlete must be assigned a category."
            )
        cat = await db.execute(
            select(CategoryModel.id).where(
                CategoryModel.id == data.categoryId,
                CategoryModel.events_id == data.eventId,
                CategoryModel.sports_id == data.sportId,
            )
        )
        if cat.scalar_one_or_none() is None:
            raise_localized(
                422,
                "CATEGORY_INVALID",
                "The selected category does not exist for this sport in this event.",
            )

        # Rule 2 — age window.
        validate_age(event, data.date_of_birth)

        # Rule 4 — per-org athlete quota.
        if config is not None and config.quota_athletes_per_org is not None:
            used = (
                await db.execute(
                    select(func.count())
                    .select_from(AthleteParticipation)
                    .where(
                        AthleteParticipation.events_id == data.eventId,
                        AthleteParticipation.sports_id == data.sportId,
                        AthleteParticipation.organization_id == data.organizationId,
                    )
                )
            ).scalar() or 0
            if used >= config.quota_athletes_per_org:
                raise_localized(
                    409,
                    "QUOTA_FULL",
                    "The athlete quota for this sport is full.",
                    used=used,
                    quota=config.quota_athletes_per_org,
                )

        # Team mode validation if teamId is provided. Team-ness is a property
        # of the CATEGORY (team_size_max > 1), not the sports_event config, so
        # the rules below are driven off the registration's category.
        if data.teamId is not None and role == "athlete":
            category = await db.get(CategoryModel, data.categoryId)
            cat_max = category.team_size_max if category else None
            if not cat_max or cat_max <= 1:
                raise_localized(
                    422,
                    "TEAM_MODE_DISALLOWED",
                    "This category does not allow team registration.",
                )
            from src.models.team import team as TeamModel

            team = await db.get(TeamModel, data.teamId)
            if not team:
                raise_localized(404, "TEAM_NOT_FOUND", "Team not found.")
            if team.event_id != data.eventId or team.sport_id != data.sportId:
                raise_localized(
                    422, "TEAM_MISMATCH", "Team does not match the event/sport."
                )
            if team.org_id != data.organizationId:
                raise_localized(
                    422,
                    "TEAM_ORG_MISMATCH",
                    "Team does not belong to your organization.",
                )
            if team.category_id != data.categoryId:
                raise_localized(
                    422,
                    "TEAM_CATEGORY_MISMATCH",
                    "The team belongs to a different category than this registration.",
                )
            used_team = (
                await db.execute(
                    select(func.count())
                    .select_from(AthleteParticipation)
                    .where(
                        AthleteParticipation.team_id == data.teamId,
                    )
                )
            ).scalar() or 0
            if used_team >= cat_max:
                raise_localized(
                    409,
                    "TEAM_FULL",
                    "The team has reached its maximum size.",
                    max=cat_max,
                )

    # Rule 3 — document requirement (all participants).
    validate_documents(event, data)

    # Rule 5 — soft duplicate (all participants), overridable with force.
    if not data.force:
        await check_duplicate(db, data)


def validate_age(event: Events, dob: date):
    if event.age_mode is None or event.age_min is None or event.age_max is None:
        return
    if event.age_mode == AgeMode.BIRTH_YEAR:
        birth_year = dob.year
        if not (event.age_min <= birth_year <= event.age_max):
            raise_localized(
                422,
                "AGE_OUT_OF_RANGE",
                "Birth year is outside the allowed range.",
                mode="BIRTH_YEAR",
                min=event.age_min,
                max=event.age_max,
                value=birth_year,
            )
    else:  # EXACT_AGE
        if event.start_date is None:
            return
        age = age_on(dob, event.start_date)
        if not (event.age_min <= age <= event.age_max):
            raise_localized(
                422,
                "AGE_OUT_OF_RANGE",
                "Age at the event start date is outside the allowed range.",
                mode="EXACT_AGE",
                min=event.age_min,
                max=event.age_max,
                value=age,
            )


def validate_documents(event: Events, data: FullRegistrationRequest):
    basis = event.start_date or date.today()
    age = age_on(data.date_of_birth, basis)
    if age < 18:
        if not data.birthCertificateUrl:
            raise_localized(
                422,
                "DOCUMENT_REQUIRED",
                "A birth certificate is required for participants under 18.",
                requires="birth_certificate",
                age=age,
            )
    else:
        if not (data.nationalIdUrl or data.passportUrl):
            raise_localized(
                422,
                "DOCUMENT_REQUIRED",
                "A national ID or passport is required for participants 18 and older.",
                requires="national_id_or_passport",
                age=age,
            )


async def check_duplicate(db, data: FullRegistrationRequest):
    name_dob = (
        (Enroll.kh_family_name == data.kh_family_name)
        & (Enroll.kh_given_name == data.kh_given_name)
        & (Enroll.date_of_birth == data.date_of_birth)
    )
    athlete_dup = (
        select(Enroll.id)
        .join(Athlete, Athlete.enroll_id == Enroll.id)
        .join(AthleteParticipation, AthleteParticipation.athletes_id == Athlete.id)
        .where(AthleteParticipation.events_id == data.eventId, name_dob)
        .limit(1)
    )
    leader_dup = (
        select(Enroll.id)
        .join(Leader, Leader.enroll_id == Enroll.id)
        .join(LeaderParticipation, LeaderParticipation.leaders_id == Leader.id)
        .where(LeaderParticipation.events_id == data.eventId, name_dob)
        .limit(1)
    )
    for query in (athlete_dup, leader_dup):
        found = (await db.execute(query)).scalar_one_or_none()
        if found is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "DUPLICATE_SUSPECT",
                    "message": "A participant with the same name and date of "
                    "birth is already registered for this event.",
                    "duplicate_suspect": True,
                },
            )
