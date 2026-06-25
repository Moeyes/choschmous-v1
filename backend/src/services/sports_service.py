from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from src.database.base_repository import BaseRepository
from src.models.sport import Sport
from src.models.events import Events
from src.schemas.sport import SportCreate, SportUpdate
from src.models.category import Category as CategoryModel


class SportService:
    async def get_category_by_id(self, category_id: int):
        query = (
            select(
                CategoryModel.id,
                Sport.name_kh.label("sport_name"),
                CategoryModel.category,
                CategoryModel.gender,
                CategoryModel.team_size_min,
                CategoryModel.team_size_max,
                CategoryModel.created_at,
            )
            .join(Sport, CategoryModel.sports_id == Sport.id)
            .where(CategoryModel.id == category_id)
        )
        result = await self.db.execute(query)
        return result.mappings().first()

    async def delete_sport(self, sport_id: int) -> bool:
        sport = await self.repo.get(sport_id)
        if not sport:
            return False
        await self.repo.delete(sport_id)
        await self.db.commit()
        return True

    async def update_sport(
        self, sport_id: int, payload: SportUpdate
    ) -> Optional[Sport]:
        sport = await self.repo.get(sport_id)
        if not sport:
            return None

        update_data = {}
        if payload.name_kh is not None:
            update_data["name_kh"] = payload.name_kh
        if payload.sport_type is not None:
            update_data["sport_type"] = payload.sport_type

        if update_data:
            await self.repo.update(sport_id, update_data)
            await self.db.commit()
            await self.db.refresh(sport)

        return sport

    async def create_sport(self, payload: SportCreate) -> Sport:
        # Create a new Sport instance from the payload
        new_sport = Sport(name_kh=payload.name_kh, sport_type=payload.sport_type)
        self.db.add(new_sport)
        await self.db.commit()
        await self.db.refresh(new_sport)
        return new_sport

    def __init__(self, db: AsyncSession):
        self.repo = BaseRepository(db, Sport)
        self.cat_repo = BaseRepository(db, CategoryModel)
        self.db = db

    async def get_sport(self, sport_id: int) -> Optional[Sport]:
        return await self.repo.get(sport_id)

    async def get_sports(
        self, skip: int = 0, limit: int = 100, filters: dict | None = None
    ) -> List[Sport]:
        query = select(Sport)

        if filters:
            for field, value in filters.items():
                if hasattr(Sport, field):
                    column = getattr(Sport, field)

                    if field == "id":
                        query = query.where(column == value)
                    else:
                        query = query.where(column.ilike(f"{value}%"))

        result = await self.db.execute(query.offset(skip).limit(limit))
        return result.scalars().all()

    async def add_category_to_sport(
        self,
        event_id: int | None,
        sport_id: int,
        category_name: str,
        gender,
        team_size_min: int | None = None,
        team_size_max: int | None = None,
    ):
        filters = [
            CategoryModel.sports_id == sport_id,
            CategoryModel.category == category_name,
        ]
        if event_id is not None:
            filters.append(CategoryModel.events_id == event_id)
        if gender is not None:
            filters.append(CategoryModel.gender == gender)

        check = await self.db.execute(select(CategoryModel).where(*filters))
        if check.scalars().first():
            raise HTTPException(
                status_code=400,
                detail="Category already exists for this sport event and gender.",
            )

        payload = {
            "sports_id": sport_id,
            "category": category_name,
            "gender": gender,
            "team_size_min": team_size_min,
            "team_size_max": team_size_max,
        }
        if event_id is not None:
            payload["events_id"] = event_id
        new_cat = await self.cat_repo.create(payload)

        query = (
            select(
                CategoryModel.id,
                Sport.name_kh.label("sport_name"),
                CategoryModel.category,
                CategoryModel.gender,
                CategoryModel.team_size_min,
                CategoryModel.team_size_max,
                CategoryModel.created_at,
            )
            .join(Sport, CategoryModel.sports_id == Sport.id)
            .where(CategoryModel.id == new_cat.id)
        )
        result = await self.db.execute(query)
        return result.mappings().first()

    async def get_sport_categories(self, event_id: int, sport_id: int):
        query = (
            select(
                CategoryModel.id,
                Sport.name_kh.label("sport_name"),
                CategoryModel.category,
                CategoryModel.gender,
                CategoryModel.team_size_min,
                CategoryModel.team_size_max,
                CategoryModel.created_at,
            )
            .join(Events, CategoryModel.events_id == Events.id)
            .join(Sport, CategoryModel.sports_id == Sport.id)
            .where(
                CategoryModel.events_id == event_id, CategoryModel.sports_id == sport_id
            )
        )
        result = await self.db.execute(query)
        return result.mappings().all()

    async def get_categories_by_sport(self, sport_id: int):
        """Return categories for a sport across all events."""
        query = (
            select(
                CategoryModel.id,
                Sport.name_kh.label("sport_name"),
                CategoryModel.category,
                CategoryModel.gender,
                CategoryModel.team_size_min,
                CategoryModel.team_size_max,
                CategoryModel.created_at,
            )
            .join(Sport, CategoryModel.sports_id == Sport.id)
            .where(CategoryModel.sports_id == sport_id)
        )
        result = await self.db.execute(query)
        return result.mappings().all()

    async def update_category(self, category_id: int, update_data: dict):
        existing_cat = await self.cat_repo.get(category_id)
        if not existing_cat:
            return None

        payload = {}
        if "category" in update_data:
            new_name = update_data["category"]
            if existing_cat.category != new_name:
                filters = [CategoryModel.category == new_name]
                if existing_cat.events_id is not None:
                    filters.append(CategoryModel.events_id == existing_cat.events_id)
                if existing_cat.sports_id is not None:
                    filters.append(CategoryModel.sports_id == existing_cat.sports_id)
                conflict_query = select(CategoryModel).where(*filters)
                conflict = await self.db.execute(conflict_query)
                if conflict.scalars().first():
                    raise HTTPException(
                        status_code=400,
                        detail="A category with this name already exists for this sport event.",
                    )
            payload["category"] = new_name

        field_map = {"sport_id": "sports_id"}
        for field in ("gender", "sport_id", "team_size_min", "team_size_max"):
            if field in update_data:
                payload[field_map.get(field, field)] = update_data[field]

        if payload:
            await self.cat_repo.update(category_id, payload)

        query = (
            select(
                CategoryModel.id,
                Sport.name_kh.label("sport_name"),
                CategoryModel.category,
                CategoryModel.gender,
                CategoryModel.team_size_min,
                CategoryModel.team_size_max,
                CategoryModel.created_at,
            )
            .join(Sport, CategoryModel.sports_id == Sport.id)
            .where(CategoryModel.id == category_id)
        )
        result = await self.db.execute(query)
        return result.mappings().first()

    async def delete_category(self, category_id: int) -> bool:
        return await self.cat_repo.delete(category_id)
