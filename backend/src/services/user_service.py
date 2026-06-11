import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import hash_password
from src.database.base_repository import BaseRepository
from src.models.user import User
from src.schemas.user import UserCreate, UserUpdate


class UserService:

    def __init__(self, db: AsyncSession):
        self.repo = BaseRepository(db, User)
        self.db = db

    async def get_user(self, user_id: uuid.UUID) -> Optional[User]:
        return await self.repo.get(user_id)

    async def get_users(
        self, skip: int = 0, limit: int = 100, filters: dict = None
    ) -> List[User]:
        return await self.repo.list(skip, limit, filters)

    async def count_users(self) -> int:
        return await self.repo.count()

    async def create_user(self, payload: UserCreate) -> User:

        data = payload.model_dump()
        data["hashed_password"] = hash_password(payload.password)
        data.pop("password")

        return await self.repo.create(data)

    async def update_user(
        self, user_id: uuid.UUID, payload: UserUpdate
    ) -> Optional[User]:

        data = payload.model_dump(exclude_unset=True)

        if "password" in data:
            pw = data.pop("password")
            if pw is not None and len(pw) < 8:
                raise HTTPException(status_code=422, detail="password must be at least 8 characters")
            if pw is not None:
                data["hashed_password"] = hash_password(pw)
                data["token_valid_from"] = datetime.now(timezone.utc)
            else:
                data.pop("token_valid_from", None)

        return await self.repo.update(user_id, data)

    async def delete_user(self, user_id: uuid.UUID) -> bool:
        return await self.repo.delete(user_id)


