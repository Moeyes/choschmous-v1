from typing import Generic, Type, TypeVar, Optional, List, Any, Sequence

from sqlalchemy import select, func, exists
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class BaseRepository(Generic[T]):
    def __init__(self, db: AsyncSession, model: Type[T]):
        self.db = db
        self.model = model

    async def get(self, id: Any) -> Optional[T]:
        return await self.db.get(self.model, id)

    async def find_by(self, **kwargs) -> Optional[T]:
        stmt = select(self.model)
        for field, value in kwargs.items():
            if hasattr(self.model, field):
                stmt = stmt.where(getattr(self.model, field) == value)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def find_all_by(self, **kwargs) -> Sequence[T]:
        stmt = select(self.model)
        for field, value in kwargs.items():
            if hasattr(self.model, field):
                stmt = stmt.where(getattr(self.model, field) == value)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def exists(self, **kwargs) -> bool:
        stmt = select(
            exists().where(
                *[
                    getattr(self.model, field) == value
                    for field, value in kwargs.items()
                    if hasattr(self.model, field)
                ]
            )
        )
        result = await self.db.scalar(stmt)
        return bool(result)

    async def list(
        self, skip: int = 0, limit: int = 100, filters: dict = None
    ) -> List[T]:
        stmt = select(self.model)
        if filters:
            for field, value in filters.items():
                if hasattr(self.model, field):
                    stmt = stmt.where(getattr(self.model, field) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def count(self) -> int:
        result = await self.db.scalar(select(func.count()).select_from(self.model))
        return int(result or 0)

    async def create(self, data: dict) -> T:
        obj = self.model(**data)
        self.db.add(obj)
        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def update(self, id: Any, data: dict) -> Optional[T]:
        obj = await self.get(id)
        if not obj:
            return None

        for field, value in data.items():
            setattr(obj, field, value)

        await self.db.commit()
        await self.db.refresh(obj)
        return obj

    async def delete(self, id: Any) -> bool:
        obj = await self.get(id)
        if not obj:
            return False

        await self.db.delete(obj)
        await self.db.commit()
        return True
