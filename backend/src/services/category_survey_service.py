from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete as sa_delete

from src.models.category import category
from src.models.events import Events
from src.schemas.category_survey import CategorySurveyUpsert


class CategorySurveyService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_event_phase_open(self, event_id: int) -> Events | None:
        """Fetch event; returns None if not found."""
        return await self.db.get(Events, event_id)

    async def upsert_categories(
        self, payload: CategorySurveyUpsert
    ) -> list[category]:
        event_id = payload.event_id
        sport_id = payload.sport_id

        incoming_names = {c.name for c in payload.categories}

        existing_q = await self.db.execute(
            select(category).where(
                category.events_id == event_id,
                category.sports_id == sport_id,
            )
        )
        existing_rows = existing_q.scalars().all()

        existing_names = {c.category for c in existing_rows}

        names_to_delete = existing_names - incoming_names
        if names_to_delete:
            await self.db.execute(
                sa_delete(category).where(
                    category.events_id == event_id,
                    category.sports_id == sport_id,
                    category.category.in_(names_to_delete),
                )
            )

        for item in payload.categories:
            if item.name in existing_names:
                existing = next(c for c in existing_rows if c.category == item.name)
                if existing.gender != item.gender:
                    existing.gender = item.gender
                    self.db.add(existing)
            else:
                new_cat = category(
                    sports_id=sport_id,
                    category=item.name,
                    gender=item.gender,
                    events_id=event_id,
                )
                self.db.add(new_cat)

        await self.db.commit()

        result = await self.db.execute(
            select(category).where(
                category.events_id == event_id,
                category.sports_id == sport_id,
            ).order_by(category.id)
        )
        return result.scalars().all()

    async def list_categories(
        self, event_id: int, sport_id: int
    ) -> list[category]:
        result = await self.db.execute(
            select(category).where(
                category.events_id == event_id,
                category.sports_id == sport_id,
            ).order_by(category.id)
        )
        return result.scalars().all()
