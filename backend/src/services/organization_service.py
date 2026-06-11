from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, String, cast

from src.database.base_repository import BaseRepository
from src.models.organization import Organization
from src.schemas.organization import OrganizationCreate, OrganizationUpdate


class OrganizationService:

    def __init__(self, db: AsyncSession):
        self.repo = BaseRepository(db, Organization)
        self.db = db

    async def get_organization(self, org_id: int) -> Optional[Organization]:
        return await self.repo.get(org_id)

    async def get_organizations(
        self, skip: int = 0, limit: int = 100, filters: dict | None = None
    ) -> List[Organization]:
        query = select(Organization)

        if filters:
            for field, value in filters.items():
                if hasattr(Organization, field):
                    column = getattr(Organization, field)

                    if field == "id":
                        query = query.where(column == value)
                    else:
                        query = query.where(cast(column, String).ilike(f"{value}%"))

        result = await self.db.execute(query.offset(skip).limit(limit))
        return result.scalars().all()

    async def create_organization(self, payload: OrganizationCreate) -> Organization:
        return await self.repo.create(payload.model_dump())

    async def update_organization(
        self, org_id: int, payload: OrganizationUpdate
    ) -> Optional[Organization]:
        return await self.repo.update(org_id, payload.model_dump(exclude_unset=True))

    async def delete_organization(self, org_id: int) -> bool:
        return await self.repo.delete(org_id)
