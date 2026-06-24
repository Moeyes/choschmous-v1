"""Reveal-PII use-case (CHOS-206).

Extracted verbatim from ParticipantService.get_participant_phone. Deliberately
narrow: exactly one Restricted-PII field, which is what the audited reveal
endpoint records.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from src.models.enroll import Enroll


class RevealParticipantPii:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_phone(self, enroll_id: int) -> str:
        """Return a single participant's phone number for an audited reveal.

        Kept deliberately narrow: callers (the reveal endpoint) request exactly
        one Restricted-PII field, which is what gets recorded in the audit log.
        """
        result = await self.db.execute(
            select(Enroll.phonenumber).where(Enroll.id == enroll_id)
        )
        phone = result.scalar_one_or_none()
        if phone is None:
            raise HTTPException(
                status_code=404,
                detail=f"Participant with enroll_id={enroll_id} not found.",
            )
        return phone
