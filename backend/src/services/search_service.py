"""Search orchestration (CHOS-304).

Thin service: derive the role-based :class:`SearchScope` from the caller, pick
the configured provider, and return minimized hits. All the query work lives in
the provider (app/infrastructure/search/); all the HTTP edge lives in the route.

Scoping (mirrors the auth helpers in src/database/deps.py):
* ADMIN / SUPER_ADMIN → unrestricted.
* ORGANIZATION        → athletes limited to the user's own org (dropped entirely
  if the account has no org linked, so it can never enumerate citizens).
* FEDERATION          → athletes limited to the user's sport.
Events and organizations are non-PII and never scoped.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.search import SearchScope, get_search_provider
from app.infrastructure.search.base import ENTITY_TYPES, SearchHit
from src.models.enum.user import UserRole
from src.models.user import User
from src.schemas.search import SearchRequest


class SearchService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _scope_for(self, user: User) -> SearchScope:
        role = user.role
        if role in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
            return SearchScope()
        if role == UserRole.ORGANIZATION:
            return SearchScope(
                org_id=user.organization_id,
                include_athletes=user.organization_id is not None,
            )
        if role == UserRole.FEDERATION:
            return SearchScope(
                sport_id=user.sport_id,
                include_athletes=user.sport_id is not None,
            )
        # Any other role: events/orgs only, no athlete enumeration.
        return SearchScope(include_athletes=False)

    async def search(self, payload: SearchRequest, user: User) -> list[SearchHit]:
        types = tuple(payload.types) if payload.types else ENTITY_TYPES
        provider = get_search_provider(self.db)
        return await provider.search(
            payload.query,
            types=types,
            limit=payload.limit,
            scope=self._scope_for(user),
        )
