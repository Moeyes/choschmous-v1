from datetime import date
from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import String, case, cast, delete, distinct, func, select, true, false, and_

from src.database.base_repository import BaseRepository
from src.models.organization import Organization
from src.models.sports_event import sports_event
from src.models.events import Events, PHASES
from src.models.enum.event import PhaseStatus
from src.models.sport import Sport
from src.models.category import category as Category
from src.models.sports_event_org import sports_event_org
from src.models.participation_per_sport import participation_per_sport
from src.schemas.event import EventCreate, EventUpdate
from src.schemas.sports_event import SportsEventPublic
from src.schemas.report import SurveyStatusOrgRow, SurveyStatusSportRow, SurveyStatusResponse

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
        existing = await self.se_repo.find_by(events_id=event_id, sports_id=sport_id)
        if existing:
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
                sports_event.sports_id.label("sports_id"),
                Events.name_kh.label("event_name"),
                Sport.name_kh.label("sport_name"),
                sports_event.created_at,
                sports_event.mode,
                sports_event.team_size_min,
                sports_event.team_size_max,
                sports_event.quota_athletes_per_org,
                sports_event.quota_teams_per_org,
            )
            .join(Events, sports_event.events_id == Events.id)
            .join(Sport, sports_event.sports_id == Sport.id)
            .where(sports_event.events_id == event_id)
        )
        result = await self.db.execute(query)
        return result.mappings().all()

    async def update_sport_event_config(self, sports_event_id: int, config) -> sports_event:
        """Set per-sport competition config on a sports_event link. Only fields
        present in ``config`` (exclude_unset) are written."""
        se = await self.db.get(sports_event, sports_event_id)
        if not se:
            raise HTTPException(status_code=404, detail="Sport-event link not found.")

        data = config.model_dump(exclude_unset=True)
        new_min = data.get("team_size_min", se.team_size_min)
        new_max = data.get("team_size_max", se.team_size_max)
        if new_min is not None and new_max is not None and new_min > new_max:
            raise HTTPException(
                status_code=422,
                detail="team_size_min cannot be greater than team_size_max.",
            )
        for field, value in data.items():
            setattr(se, field, value)
        await self.db.commit()
        await self.db.refresh(se)
        return se

    async def get_my_eligible_sports(self, event_id: int, org_id: int):
        """Sports the org selected in survey ② (sports_event_org) for this event,
        with the per-sport config and the org's current athlete count attached."""
        from src.models.athlete_participation import athlete_participation

        used_subq = (
            select(
                athlete_participation.sports_id.label("sid"),
                func.count().label("used"),
            )
            .where(
                athlete_participation.events_id == event_id,
                athlete_participation.organization_id == org_id,
            )
            .group_by(athlete_participation.sports_id)
            .subquery()
        )

        query = (
            select(
                sports_event.id.label("sports_event_id"),
                sports_event.sports_id.label("sports_id"),
                Sport.name_kh.label("name_kh"),
                sports_event.mode,
                sports_event.team_size_min,
                sports_event.team_size_max,
                sports_event.quota_athletes_per_org,
                sports_event.quota_teams_per_org,
                func.coalesce(used_subq.c.used, 0).label("athletes_used"),
            )
            .join(
                sports_event_org,
                (sports_event_org.events_id == sports_event.events_id)
                & (sports_event_org.sports_id == sports_event.sports_id),
            )
            .join(Sport, Sport.id == sports_event.sports_id)
            .outerjoin(used_subq, used_subq.c.sid == sports_event.sports_id)
            .where(
                sports_event_org.events_id == event_id,
                sports_event_org.organization_id == org_id,
                sports_event_org.status == 'APPROVED',
            )
            .order_by(Sport.name_kh.asc())
        )
        result = await self.db.execute(query)
        return result.mappings().all()

    async def remove_sport_from_event(self, association_id: int) -> bool:
        return await self.se_repo.delete(association_id)

    async def add_org_to_event_sport(self, event_id: int, sport_id: int, org_id: int):
        existing = await self.seo_repo.find_by(
            events_id=event_id, sports_id=sport_id, organization_id=org_id
        )
        if existing:
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

    async def get_org_event_sports(self, event_id: int, org_id: int):
        query = (
            select(
                sports_event_org.id,
                sports_event_org.sports_id,
                sports_event_org.events_id,
                sports_event_org.organization_id,
                sports_event_org.created_at,
            )
            .where(
                sports_event_org.events_id == event_id,
                sports_event_org.organization_id == org_id,
                sports_event_org.status == 'APPROVED',
            )
            .order_by(sports_event_org.created_at.asc())
        )
        result = await self.db.execute(query)
        return result.mappings().all()

    async def get_event_sport_org_link(
        self, association_id: int
    ) -> Optional[sports_event_org]:
        return await self.seo_repo.get(association_id)

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

    async def get_event_survey_status(self, event_id: int) -> SurveyStatusResponse:
        event = await self.repo.get(event_id)
        if not event:
            raise HTTPException(status_code=404, detail="Event not found")

        org_q = (
            select(Organization.id, Organization.name_kh, Organization.name_en)
            .distinct()
            .join(sports_event_org, sports_event_org.organization_id == Organization.id)
            .where(sports_event_org.events_id == event_id)
            .order_by(Organization.name_kh)
        )
        org_rows = (await self.db.execute(org_q)).mappings().all()

        org_statuses: list[SurveyStatusOrgRow] = []
        for o in org_rows:
            seo_q = select(sports_event_org.id).where(
                sports_event_org.events_id == event_id,
                sports_event_org.organization_id == o.id,
            )
            seo_r = await self.db.execute(seo_q)
            survey_sport_submitted = len(seo_r.scalars().all()) > 0

            pps_q = (
                select(participation_per_sport.status)
                .join(sports_event_org, participation_per_sport.sports_Events_id == sports_event_org.id)
                .where(
                    sports_event_org.events_id == event_id,
                    sports_event_org.organization_id == o.id,
                )
                .limit(1)
            )
            pps_r = await self.db.execute(pps_q)
            pps_status = pps_r.scalar()

            org_statuses.append(SurveyStatusOrgRow(
                org_id=o.id,
                org_name_kh=o.name_kh,
                org_name_en=o.name_en,
                survey_sport_submitted=survey_sport_submitted,
                survey_number_status=pps_status,
            ))

        fed_sport_q = (
            select(
                Sport.id,
                Sport.name_kh,
                func.count(Category.id).label("cat_count"),
            )
            .join(sports_event, sports_event.sports_id == Sport.id)
            .outerjoin(Category, and_(
                Category.sports_id == Sport.id,
                Category.events_id == event_id,
            ))
            .where(sports_event.events_id == event_id)
            .group_by(Sport.id, Sport.name_kh)
            .order_by(Sport.name_kh)
        )
        fed_sport_rows = (await self.db.execute(fed_sport_q)).mappings().all()

        sport_statuses = [
            SurveyStatusSportRow(
                sport_id=row.id,
                sport_name_kh=row.name_kh,
                category_count=row.cat_count,
            )
            for row in fed_sport_rows
        ]

        return SurveyStatusResponse(
            event_id=event.id,
            event_name_kh=event.name_kh or "",
            organizations=org_statuses,
            federation_sports=sport_statuses,
        )
