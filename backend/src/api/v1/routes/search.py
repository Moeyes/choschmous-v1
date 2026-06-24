"""Global search route (CHOS-304) — powers the ⌘K command palette.

POST (not GET) so the query — which may contain a person's name — stays out of
URLs, browser history, and access logs (data governance). Authenticated; results
are role-scoped and minimized in the service/provider layer.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from core.ratelimit import search_limiter
from src.database.deps import get_current_user, get_read_db
from src.models.user import User
from src.schemas.search import SearchHit, SearchRequest, SearchResponse
from src.services.search_service import SearchService

router = APIRouter()


@router.post("/search", response_model=SearchResponse)
async def search(
    payload: SearchRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_read_db),
    current_user: User = Depends(get_current_user),
) -> SearchResponse:
    """**Search events, organizations and athletes for the ⌘K palette.**

    Authenticated. Results are role-scoped: ORGANIZATION users only see athletes
    in their own org, FEDERATION users only in their sport; admins see all. Hits
    are minimized (name + org only) — no PII beyond the display name. Reads route
    to the replica (CHOS-301).

    Rate limited per user (scraping guard). Returns ``{data, count}``.
    """
    await search_limiter.check(
        request, key_suffix=str(current_user.id), response=response
    )
    service = SearchService(db)
    hits = await service.search(payload, current_user)
    data = [SearchHit.model_validate(h) for h in hits]
    return SearchResponse(data=data, count=len(data))
