from datetime import date
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import String, case, cast, delete, distinct, select, true, false

from src.database.base_repository import BaseRepository
from src.models.organization import Organization
from src.models.sports_event import sports_event
from src.models.events import Events, PHASES
from src.models.enum.event import PhaseStatus
from src.models.sport import Sport
from src.schemas.event import EventCreate, EventUpdate
from src.schemas.sports_event import SportsEventPublic
from src.models.sports_event_org import sports_event_org

class EventService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = BaseRepository(db, Events)
        # Fix: Initialize se_repo so it can be used in other methods
        self.se_repo = BaseRepository(db, sports_event)
        self.seo_repo = BaseRepository(db,sports_event_org)

    async def get_event(self, event_id: int) -> Optional[Events]:
        return await self.repo.get(event_id)

    async def get_events(
        self,
        skip: int = 0,
        limit: int = 100,
        filters: dict | None = None,
        phase_open_filters: dict | None = None,
    ) -> List[Events]:
        query = select(Events)
        if filters:
            for field, value in filters.items():
                if hasattr(Events, field):
                    column = getattr(Events, field)
                    if field == "id":
                        query = query.where(column == value)
                    else:
                        query = query.where(cast(column, String).ilike(f"{value}%"))

        active_phase_filters = (
            {p: v for p, v in (phase_open_filters or {}).items() if v is not None}
        )
        if active_phase_filters:
            today = date.today()
            for phase, want_open in active_phase_filters.items():
                if phase not in PHASES:
                    continue
                status_col = getattr(Events, f"{phase}_status")
                open_col = getattr(Events, f"{phase}_open_date")
                close_col = getattr(Events, f"{phase}_close_date")
                is_open_expr = case(
                    (status_col == PhaseStatus.OPEN, true()),
                    (status_col == PhaseStatus.CLOSED, false()),
                    (open_col.is_(None), false()),
                    (close_col.is_(None), false()),
                    ((open_col <= today) & (close_col >= today), true()),
                    else_=false(),
                )
                if want_open:
                    query = query.where(is_open_expr)
                else:
                    query = query.where(~is_open_expr)

        result = await self.db.execute(query.offset(skip).limit(limit))
        return result.scalars().all()

    async def update_phase(
        self,
        event_id: int,
        phase: str,
        status,
        open_date=None,
        close_date=None,
    ) -> Optional[Events]:
        event = await self.repo.get(event_id)
        if not event:
            return None
        setattr(event, f"{phase}_status", status)
        if open_date is not None:
            setattr(event, f"{phase}_open_date", open_date)
        if close_date is not None:
            setattr(event, f"{phase}_close_date", close_date)
        await self.db.commit()
        await self.db.refresh(event)
        return event

    async def create_event(self, payload: EventCreate) -> Events:
        return await self.repo.create(payload.model_dump())

    async def update_event(
        self, event_id: int, payload: EventUpdate
    ) -> Optional[Events]:
        return await self.repo.update(event_id, payload.model_dump(exclude_unset=True))

    async def delete_event(self, event_id: int) -> bool:
        return await self.repo.delete(event_id)

    async def add_sport_to_event(self, event_id: int, sport_id: int):
        # 1. Check for existing duplication
        check_query = select(sports_event).where(
            sports_event.events_id == event_id,
            sports_event.sports_id == sport_id
        )
        existing_link = await self.db.execute(check_query)
        if existing_link.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="This sport is already associated with this event."
            )

        payload = {"events_id": event_id, "sports_id": sport_id}
        new_link = await self.se_repo.create(payload)

        query = (
            select(
                sports_event.id.label("id"), 
                Events.name_kh.label("event_name"),
                Sport.name_kh.label("sport_name"),
                sports_event.created_at,
            )
            .join(Events, sports_event.events_id == Events.id)
            .join(Sport, sports_event.sports_id == Sport.id)
            .where(sports_event.id == new_link.id)
        )
        result = await self.db.execute(query)
        return result.mappings().first()

    async def get_event_sports(self, event_id: int)->SportsEventPublic:
        query = (
            select(
                sports_event.id.label("id"),
                Events.name_kh.label("event_name"),
                Sport.name_kh.label("sport_name"),
                sports_event.created_at,
            )
            .join(Events, sports_event.events_id == Events.id)
            .join(Sport, sports_event.sports_id == Sport.id)
            .where(sports_event.events_id == event_id)
        )
        result = await self.db.execute(query)
        return result.mappings().all()

    async def remove_sport_from_event(self, association_id: int) -> bool:
        return await self.se_repo.delete(association_id)

    async def add_org_to_event_sport(self, event_id: int, sport_id: int, org_id: int):
        check_query = select(sports_event_org).where(
            sports_event_org.events_id == event_id,
            sports_event_org.sports_id == sport_id,
            sports_event_org.organization_id == org_id,
        )
        existing = await self.db.execute(check_query)
        if existing.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="This organization is already linked to this sport event.",
            )

        payload = {
            "events_id": event_id,
            "sports_id": sport_id,
            "organization_id": org_id,
        }
        new_link = await self.seo_repo.create(payload)

        query = (
            select(
                sports_event_org.id,
                Events.name_kh.label("event_name"),
                Sport.name_kh.label("sport_name"),
                Organization.name_kh.label("organization_name"),
                sports_event_org.created_at,
            )
            .join(Events, sports_event_org.events_id == Events.id)
            .join(Sport, sports_event_org.sports_id == Sport.id)
            .join(Organization, sports_event_org.organization_id == Organization.id)
            .where(sports_event_org.id == new_link.id)
        )
        result = await self.db.execute(query)
        return result.mappings().first()

    async def get_event_sport_orgs(self, event_id: int, sport_id: int):
        query = (
            select(
                sports_event_org.id,
                Organization.id.label("organization_id"),
                Organization.name_kh.label("organization_name"),
                sports_event_org.created_at,
            )
            .join(Organization, sports_event_org.organization_id == Organization.id)
            .where(
                sports_event_org.events_id == event_id,
                sports_event_org.sports_id == sport_id,
            )
            .order_by(Organization.name_kh.asc())
        )
        result = await self.db.execute(query)
        return result.mappings().all()

    async def remove_org_from_event_sport(self, association_id: int) -> bool:
        return await self.seo_repo.delete(association_id)

    async def get_organizations_in_event(self, event_id: int):
        query = (
            select(
                distinct(Organization.name_kh).label("organization_name"),
                Organization.id.label("organization_id"),
            )
            .join(sports_event_org, Organization.id == sports_event_org.organization_id)
            .where(sports_event_org.events_id == event_id)
        )

        result = await self.db.execute(query)
        return result.mappings().all()


    async def remove_org_from_entire_event(self, event_id: int, org_id: int) -> bool:
        query = delete(sports_event_org).where(
            sports_event_org.events_id == event_id,
            sports_event_org.organization_id == org_id,
        )

        result = await self.db.execute(query)
        await self.db.commit()

        return result.rowcount > 0
