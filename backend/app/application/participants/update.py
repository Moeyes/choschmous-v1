"""Update + delete participant use-case (CHOS-206).

Extracted verbatim from ParticipantService.update_participant /
_update_athlete_participation / _update_leader_participation / delete_participant;
the post-update read now goes through ParticipantQuery.get_by_id.
"""

import logging

from sqlalchemy import delete as sa_delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from src.models.enroll import Enroll
from src.models.athletes import athletes as Athlete
from src.models.athlete_participation import (
    athlete_participation as AthleteParticipation,
)
from src.models.leader import leader as Leader
from src.models.leader_participation import leader_participation as LeaderParticipation
from src.models.user import User

from src.schemas.enroll import ParticipantUpdateRequest
from src.services.file_access import assert_can_reference_files

from app.application.participants.query import ParticipantQuery

logger = logging.getLogger(__name__)


class UpdateParticipant:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def update(
        self,
        enroll_id: int,
        role: str,
        data: ParticipantUpdateRequest,
        current_user: User,
    ):
        """Update Enroll personal info and participation data atomically."""
        role = role.lower()

        # Reject managed file references the caller is not authorized to use.
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
            enroll = await self.db.get(Enroll, enroll_id)
            if not enroll:
                raise HTTPException(
                    status_code=404,
                    detail=f"Enroll record with id={enroll_id} not found.",
                )

            personal_fields = {
                "kh_family_name": data.kh_family_name,
                "kh_given_name": data.kh_given_name,
                "en_family_name": data.en_family_name,
                "en_given_name": data.en_given_name,
                "phonenumber": data.phone,
                "gender": data.gender,
                "date_of_birth": data.date_of_birth,
                "address": data.address,
                "photo_path": data.photoUrl,
                "nationality_document_path": data.nationalityDocumentUrl,
                "birth_certificate_path": data.birthCertificateUrl,
                "national_id_path": data.nationalIdUrl,
                "passport_path": data.passportUrl,
            }
            for field, value in personal_fields.items():
                if value is not None:
                    setattr(enroll, field, value)

            if role == "athlete":
                await self._update_athlete_participation(enroll_id, data)
            else:
                await self._update_leader_participation(enroll_id, data)

            await self.db.commit()

            return await ParticipantQuery(self.db).get_by_id(enroll_id, role)

        except HTTPException:
            await self.db.rollback()
            raise
        except Exception:
            await self.db.rollback()
            logger.error("Participant update failed", exc_info=True)
            raise HTTPException(
                status_code=500, detail="Update failed due to a server error"
            )

    async def _update_athlete_participation(
        self, enroll_id: int, data: ParticipantUpdateRequest
    ):
        """Update the athlete's participation record."""
        result = await self.db.execute(
            select(Athlete).where(Athlete.enroll_id == enroll_id)
        )
        athlete = result.scalars().first()
        if not athlete:
            raise HTTPException(
                status_code=404, detail="Athlete record not found for this enrollment."
            )

        result = await self.db.execute(
            select(AthleteParticipation).where(
                AthleteParticipation.athletes_id == athlete.id
            )
        )
        participation = result.scalars().first()
        if not participation:
            raise HTTPException(
                status_code=404, detail="Athlete participation record not found."
            )

        if data.sport_id is not None:
            participation.sports_id = data.sport_id
        if data.organization_id is not None:
            participation.organization_id = data.organization_id
        if data.category_id is not None:
            participation.category_id = data.category_id

    async def _update_leader_participation(
        self, enroll_id: int, data: ParticipantUpdateRequest
    ):
        """Update the leader's role and participation record."""
        result = await self.db.execute(
            select(Leader).where(Leader.enroll_id == enroll_id)
        )
        leader = result.scalars().first()
        if not leader:
            raise HTTPException(
                status_code=404, detail="Leader record not found for this enrollment."
            )

        if data.leader_role is not None:
            leader.LeaderRole = data.leader_role

        result = await self.db.execute(
            select(LeaderParticipation).where(
                LeaderParticipation.leaders_id == leader.id
            )
        )
        participation = result.scalars().first()
        if not participation:
            raise HTTPException(
                status_code=404, detail="Leader participation record not found."
            )

        if data.sport_id is not None:
            participation.sports_id = data.sport_id
        if data.organization_id is not None:
            participation.organization_id = data.organization_id

    async def delete(self, enroll_id: int):
        """
        Delete a participant by enroll_id.
        Cascades to athlete/leader records. Leader participations are
        explicitly cleaned up since their FK uses SET NULL.
        """
        try:
            enroll = await self.db.get(Enroll, enroll_id)
            if not enroll:
                raise HTTPException(
                    status_code=404,
                    detail=f"Participant with enroll_id={enroll_id} not found.",
                )

            # Delete related Athlete(s) if any
            athlete_result = await self.db.execute(
                select(Athlete).where(Athlete.enroll_id == enroll_id)
            )
            athletes_to_delete = athlete_result.scalars().all()
            for athlete in athletes_to_delete:
                await self.db.delete(athlete)
            await self.db.flush()

            # Delete related LeaderParticipation(s) if any
            leader_result = await self.db.execute(
                select(Leader.id).where(Leader.enroll_id == enroll_id)
            )
            leader_id = leader_result.scalar()
            if leader_id:
                await self.db.execute(
                    sa_delete(LeaderParticipation).where(
                        LeaderParticipation.leaders_id == leader_id
                    )
                )

            # Delete related Leader if any
            leader_obj_result = await self.db.execute(
                select(Leader).where(Leader.enroll_id == enroll_id)
            )
            leader_obj = leader_obj_result.scalars().first()
            if leader_obj:
                await self.db.delete(leader_obj)
            await self.db.flush()

            await self.db.delete(enroll)
            await self.db.commit()

            return {"status": "success", "detail": f"Participant {enroll_id} deleted."}

        except HTTPException:
            await self.db.rollback()
            raise
        except Exception:
            await self.db.rollback()
            logger.error("Participant delete failed", exc_info=True)
            raise HTTPException(
                status_code=500, detail="Delete failed due to a server error"
            )
