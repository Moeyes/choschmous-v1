import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import hash_password, validate_password_strength
from src.database.base_repository import BaseRepository
from src.models.user import User
from src.schemas.user import UserCreate, UserUpdate
from src.services.file_access import assert_can_reference_files


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

    async def create_user(
        self, payload: UserCreate, current_user: User
    ) -> User:
        # Defense-in-depth: validate file references so future route-access
        # changes don't accidentally open a vector for forged file UUIDs.
        await assert_can_reference_files(
            self.db, current_user,
            [payload.photo_path],
        )

        try:
            validate_password_strength(payload.password)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))

        data = payload.model_dump()
        data["hashed_password"] = hash_password(payload.password)
        data.pop("password")

        return await self.repo.create(data)

    async def update_user(
        self, user_id: uuid.UUID, payload: UserUpdate, current_user: User
    ) -> Optional[User]:
        # Defense-in-depth: validate file references at write time.
        if payload.photo_path is not None:
            await assert_can_reference_files(
                self.db, current_user,
                [payload.photo_path],
            )

        data = payload.model_dump(exclude_unset=True)

        if "password" in data:
            pw = data.pop("password")
            if pw is not None:
                try:
                    validate_password_strength(pw)
                except ValueError as e:
                    raise HTTPException(status_code=422, detail=str(e))
                data["hashed_password"] = hash_password(pw)
                data["token_valid_from"] = datetime.now(timezone.utc)
            else:
                data.pop("token_valid_from", None)

        return await self.repo.update(user_id, data)

    async def delete_user(self, user_id: uuid.UUID) -> bool:
        return await self.repo.delete(user_id)


