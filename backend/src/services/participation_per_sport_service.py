from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from src.models.participation_per_sport import participation_per_sport
from src.models.sports_event_org import sports_event_org
from src.models.organization import Organization
from src.models.events import Events
from src.models.sport import Sport
from src.schemas.participation_per_sport import (
    ParticipationPerSportCreate,
    ParticipationPerSportUpdate,
)


class ParticipationReviewError(Exception):
    """Raised when an FSM transition is not allowed. ``code`` is the HTTP status."""

    def __init__(self, message: str, code: int = 409):
        super().__init__(message)
        self.code = code


# Allowed review transitions: action -> (valid current states, target state, note required?)
REVIEW_TRANSITIONS: dict[str, tuple[set[str], str, bool]] = {
    "submit": ({"DRAFT", "REVISION_REQUESTED"}, "SUBMITTED", False),
    "approve": ({"SUBMITTED", "FLAGGED", "REVISION_REQUESTED"}, "APPROVED", False),
    "reject": ({"SUBMITTED", "FLAGGED"}, "REJECTED", True),
    "flag": ({"SUBMITTED"}, "FLAGGED", True),
    "request_revision": ({"SUBMITTED", "FLAGGED"}, "REVISION_REQUESTED", True),
}


class ParticipationPerSportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_event(self, event_id: int) -> Events | None:
        """Fetch event for the phase gate; returns None if not found."""
        return await self.db.get(Events, event_id)

    async def create(self, obj_in: ParticipationPerSportCreate):
        # Find or create sports_event_org
        q = select(sports_event_org).where(
            sports_event_org.events_id == obj_in.events_id,
            sports_event_org.sports_id == obj_in.sports_id,
            sports_event_org.organization_id == obj_in.organization_id,
        )
        result = await self.db.execute(q)
        seo = result.scalar_one_or_none()
        if not seo:
            seo = sports_event_org(
                events_id=obj_in.events_id,
                sports_id=obj_in.sports_id,
                organization_id=obj_in.organization_id,
            )
            self.db.add(seo)
            await self.db.commit()
            await self.db.refresh(seo)
        # Upsert participation_per_sport (update if exists for same org+sport_event)
        existing_q = select(participation_per_sport).where(
            participation_per_sport.sports_Events_id == seo.id,
            participation_per_sport.org_id == obj_in.org_id,
        )
        existing_result = await self.db.execute(existing_q)
        obj = existing_result.scalar_one_or_none()
        if obj:
            obj.athlete_female_count = obj_in.athlete_female_count
            obj.leader_female_count = obj_in.leader_female_count
            obj.athlete_male_count = obj_in.athlete_male_count
            obj.leader_male_count = obj_in.leader_male_count
        else:
            obj = participation_per_sport(
                org_id=obj_in.org_id,
                sports_Events_id=seo.id,
                athlete_female_count=obj_in.athlete_female_count,
                leader_female_count=obj_in.leader_female_count,
                athlete_male_count=obj_in.athlete_male_count,
                leader_male_count=obj_in.leader_male_count,
            )
            self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def get(self, id: int):
        query = (
            select(
                participation_per_sport,
                Organization.name_kh.label("org_name"),
                Events.name_kh.label("event_name"),
            )
            .outerjoin(Organization, participation_per_sport.org_id == Organization.id)
            .outerjoin(
                sports_event_org,
                participation_per_sport.sports_Events_id == sports_event_org.id,
            )
            .outerjoin(Events, sports_event_org.events_id == Events.id)
            .where(participation_per_sport.id == id)
        )
        result = await self.db.execute(query)
        row = result.mappings().first()
        if not row:
            return None
        item = row["participation_per_sport"]
        enriched = {
            **item.__dict__,
            "org_name": row["org_name"],
            "event_name": row["event_name"],
        }
        return enriched

    async def get_owner_org_id(self, id: int) -> int | None:
        """
        Return the organization_id (``org_id``) that owns a participation record,
        or None if the record does not exist. Used for per-org access control on
        the by-id get/patch/delete endpoints (prevents cross-org IDOR).
        """
        item = await self.db.get(participation_per_sport, id)
        return item.org_id if item else None

    async def _enrich(self, item: participation_per_sport) -> dict:
        """One lightweight query to add org/event names to a loaded item
        (avoids re-fetching the full row via ``self.get()``)."""
        result = await self.db.execute(
            select(
                Organization.name_kh.label("org_name"),
                Events.name_kh.label("event_name"),
            )
            .select_from(participation_per_sport)
            .outerjoin(Organization, participation_per_sport.org_id == Organization.id)
            .outerjoin(
                sports_event_org,
                participation_per_sport.sports_Events_id == sports_event_org.id,
            )
            .outerjoin(Events, sports_event_org.events_id == Events.id)
            .where(participation_per_sport.id == item.id)
        )
        row = result.mappings().first()
        return {
            **item.__dict__,
            "org_name": row["org_name"] if row else None,
            "event_name": row["event_name"] if row else None,
        }

    async def patch(self, id: int, obj_in: ParticipationPerSportUpdate):
        obj = await self.db.get(participation_per_sport, id)
        if not obj:
            return None
        for field, value in obj_in.model_dump(
            exclude_unset=True, by_alias=True
        ).items():
            if hasattr(obj, field):
                setattr(obj, field, value)
        await self.db.commit()
        await self.db.refresh(obj)
        return await self._enrich(obj)

    async def delete(self, id: int):
        obj = await self.db.get(participation_per_sport, id)
        if not obj:
            return None
        await self.db.delete(obj)
        await self.db.commit()
        return obj

    async def review(self, id: int, action: str, note: str | None = None):
        """Apply an FSM review transition. Returns the enriched record, or None
        if the id does not exist. Raises ParticipationReviewError on an illegal
        transition or a missing required note."""
        rule = REVIEW_TRANSITIONS.get(action)
        if rule is None:
            raise ParticipationReviewError(f"Unknown action '{action}'", code=400)
        allowed_from, target, needs_note = rule

        item = await self.db.get(participation_per_sport, id)
        if not item:
            return None

        current = item.status or "SUBMITTED"
        if current not in allowed_from:
            raise ParticipationReviewError(
                f"Cannot '{action}' a submission with status '{current}'.",
                code=409,
            )
        if needs_note and not (note and note.strip()):
            raise ParticipationReviewError(
                f"A note is required to '{action}'.", code=400
            )

        item.status = target
        if note is not None:
            item.review_note = note
        item.reviewed_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(item)
        return await self._enrich(item)

    async def review_bulk_by_org(
        self, org_id: int, action: str, note: str | None = None
    ) -> int:
        """Bulk approve/reject **all** of an org's pending (SUBMITTED) rows at
        once. Only SUBMITTED rows are touched, so a bulk action never flips a
        prior individual decision (flag / revision / reject). Returns the number
        of rows updated. ``action`` must be ``approve`` or ``reject``."""
        if action not in ("approve", "reject"):
            raise ParticipationReviewError(
                f"Bulk action must be approve or reject, got '{action}'.", code=400
            )
        target = "APPROVED" if action == "approve" else "REJECTED"
        result = await self.db.execute(
            select(participation_per_sport).where(
                participation_per_sport.org_id == org_id,
                participation_per_sport.status == "SUBMITTED",
            )
        )
        rows = result.scalars().all()
        now = datetime.utcnow()
        for item in rows:
            item.status = target
            if note is not None:
                item.review_note = note
            item.reviewed_at = now
        await self.db.commit()
        return len(rows)

    async def list(self, skip: int = 0, limit: int = 100, org_id: int | None = None):
        q = (
            select(
                participation_per_sport,
                Organization.name_kh.label("org_name"),
                Events.name_kh.label("event_name"),
                Sport.name_kh.label("sport_name"),
                sports_event_org.events_id.label("event_id"),
                sports_event_org.sports_id.label("sport_id"),
            )
            .outerjoin(Organization, participation_per_sport.org_id == Organization.id)
            .outerjoin(
                sports_event_org,
                participation_per_sport.sports_Events_id == sports_event_org.id,
            )
            .outerjoin(Events, sports_event_org.events_id == Events.id)
            .outerjoin(Sport, sports_event_org.sports_id == Sport.id)
        )
        if org_id is not None:
            q = q.where(participation_per_sport.org_id == org_id)
        # Deterministic ordering so OFFSET/LIMIT pages are stable across requests
        # (perf report Fix #3). Ordering by the PK lets the planner walk it cheaply.
        q = q.order_by(participation_per_sport.id).offset(skip).limit(limit)
        result = await self.db.execute(q)
        rows = result.mappings().all()
        enriched = []
        for row in rows:
            item = row["participation_per_sport"]
            enriched.append(
                {
                    **item.__dict__,
                    "org_name": row["org_name"],
                    "event_name": row["event_name"],
                    "sport_name": row["sport_name"],
                    "event_id": row["event_id"],
                    "sport_id": row["sport_id"],
                }
            )
        return enriched
