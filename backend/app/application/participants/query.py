"""Query participants use-case (CHOS-206).

Extracted verbatim from ParticipantService.get_participants / get_participant_by_id
/ get_owner_org_id; query building moved to ParticipantRepository, formatting to
formatting.*.
"""

from sqlalchemy import desc
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from src.models.enroll import Enroll

from src.schemas.enroll import ParticipantFilterParams

from app.application.participants.repository import ParticipantRepository
from app.application.participants.formatting import (
    format_row,
    format_list_row,
    format_sport_row,
)


class ParticipantQuery:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = ParticipantRepository(db)

    async def list(self, params: ParticipantFilterParams, detailed: bool = False):
        query, count_query = self.repo.build_list_query(params)
        total_result = await self.db.execute(count_query)
        total = total_result.scalar() or 0

        page_query = query.order_by(desc("created_at"))
        page_query = page_query.limit(params.limit).offset(params.offset)
        result = await self.db.execute(page_query)
        # The sport-detail participant panel needs category/gender/org/event per
        # row; the default registrations list stays lean (data minimization).
        format_row = format_sport_row if detailed else format_list_row
        rows = [format_row(r, r["role"]) for r in result.mappings().all()]

        limit = params.limit or 20
        total_pages = max(1, (total + limit - 1) // limit) if limit > 0 else 1
        current_page = (params.offset // limit) + 1 if limit > 0 else 1

        return {
            "status": "success",
            "data": rows,
            "count": total,
            "total_pages": total_pages,
            "has_next": current_page < total_pages,
            "has_prev": current_page > 1,
            "page": current_page,
            "page_size": limit,
        }

    async def get_owner_org_id(
        self, enroll_id: int, role: str | None = None
    ) -> int | None:
        """Delegate to the repository (per-org IDOR guard for by-id routes)."""
        return await self.repo.get_owner_org_id(enroll_id, role)

    async def get_by_id(self, enroll_id: int, role: str):
        """Fetch a single participant by enroll_id with full nested data."""
        role = role.lower()

        if role == "athlete":
            query = self.repo.build_athlete_query().filter(Enroll.id == enroll_id)
        else:
            query = self.repo.build_leader_query().filter(Enroll.id == enroll_id)

        result = await self.db.execute(query)
        row = result.mappings().first()

        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"Participant with enroll_id={enroll_id} not found.",
            )

        return {"status": "success", "data": format_row(row, role)}
