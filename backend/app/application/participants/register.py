"""Register-participant use-case (CHOS-206).

Extracted verbatim from ParticipantService.register_participant / _create_athlete
/ _create_leader; validation now lives in validation.validate_registration.
"""

import logging
from datetime import date

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.enroll import Enroll
from src.models.athletes import athletes as Athlete
from src.models.athlete_participation import (
    athlete_participation as AthleteParticipation,
)
from src.models.leader import leader as Leader
from src.models.leader_participation import leader_participation as LeaderParticipation
from src.models.events import Events
from src.models.minor_consent import MinorConsent
from src.models.user import User

from src.schemas.registration import FullRegistrationRequest
from src.services.file_access import assert_can_reference_files

from core.config import settings
from app.application.participants.errors import age_on
from app.application.participants.validation import validate_registration

logger = logging.getLogger(__name__)


class RegisterParticipant:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def execute(self, data: FullRegistrationRequest, current_user: User):
        # Defense-in-depth: reject managed file references (/api/files/{uuid})
        # the caller is not authorized to use, so a stolen/forged UUID can never
        # be attached to an enrollment (same policy as file download).
        await assert_can_reference_files(
            self.db,
            current_user,
            [
                data.photoUrl,
                data.nationalityDocumentUrl,
                data.birthCertificateUrl,
                data.nationalIdUrl,
                data.passportUrl,
            ],
        )
        try:
            await validate_registration(self.db, data)

            new_enroll = Enroll(
                user_id=data.userId,
                kh_family_name=data.kh_family_name,
                kh_given_name=data.kh_given_name,
                en_family_name=data.en_family_name,
                en_given_name=data.en_given_name,
                phonenumber=data.phone,
                gender=data.gender,
                nationality=data.nationality or "Cambodian",
                date_of_birth=data.date_of_birth,
                id_document_type=data.id_document_type,
                address=data.address,
                photo_path=data.photoUrl,
                nationality_document_path=data.nationalityDocumentUrl,
                birth_certificate_path=data.birthCertificateUrl,
                national_id_path=data.nationalIdUrl,
                passport_path=data.passportUrl,
            )
            self.db.add(new_enroll)
            await self.db.flush()

            # CHOS-501: persist the guardian-consent record for a minor when the
            # caller supplied it (lawful-basis evidence). validate_registration has
            # already enforced its presence when MINOR_CONSENT_ENFORCED is on.
            await self._record_minor_consent(new_enroll.id, data)

            if data.role.lower() == "athlete":
                await self._create_athlete(new_enroll.id, data)
            elif data.role.lower() == "leader":
                await self._create_leader(new_enroll.id, data)
            else:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid role. Must be 'athlete' or 'leader'.",
                )

            await self.db.commit()
            return {"status": "success", "enroll_id": new_enroll.id}

        except HTTPException:
            await self.db.rollback()
            raise
        except Exception:
            await self.db.rollback()
            logger.error("Registration failed", exc_info=True)
            raise HTTPException(
                status_code=500, detail="Registration failed due to a server error"
            )

    async def _record_minor_consent(
        self, enroll_id: int, data: FullRegistrationRequest
    ):
        """Record guardian consent for an under-18 when supplied (CHOS-501).

        The age basis matches ``validate_minor_consent`` (event start date, else
        today). ``db.get(Events)`` is an identity-map hit here — the event was
        already loaded during validation, so this adds no extra query. Nothing is
        written for adults or for minors registered without supplied consent.
        """
        if not (data.guardianConsent and (data.guardianName or "").strip()):
            return
        event = await self.db.get(Events, data.eventId)
        basis = (event.start_date if event else None) or date.today()
        if age_on(data.date_of_birth, basis) >= settings.MINOR_AGE_THRESHOLD:
            return
        self.db.add(
            MinorConsent(
                enroll_id=enroll_id,
                guardian_name=data.guardianName.strip(),
                guardian_relationship=(data.guardianRelationship or "").strip()
                or "guardian",
                guardian_phone=data.guardianPhone,
                consent_version=settings.MINOR_CONSENT_POLICY_VERSION,
            )
        )

    async def _create_athlete(self, enroll_id: int, data: FullRegistrationRequest):
        athlete = Athlete(enroll_id=enroll_id)
        self.db.add(athlete)
        await self.db.flush()

        participation = AthleteParticipation(
            athletes_id=athlete.id,
            events_id=data.eventId,
            sports_id=data.sportId,
            category_id=data.categoryId,
            organization_id=data.organizationId,
            team_id=data.teamId,
        )
        self.db.add(participation)

    async def _create_leader(self, enroll_id: int, data: FullRegistrationRequest):
        leader = Leader(enroll_id=enroll_id, LeaderRole=data.leaderRole)
        self.db.add(leader)
        await self.db.flush()

        participation = LeaderParticipation(
            leaders_id=leader.id,
            events_id=data.eventId,
            sports_id=data.sportId,
            organization_id=data.organizationId,
        )
        self.db.add(participation)
