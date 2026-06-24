"""Search DTOs (CHOS-304).

The query rides in a POST body (not the URL) so search terms — which may include
a person's name — never land in URLs, browser history, or access logs (data
governance). Results are a minimized projection; see SearchHit.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SearchType = Literal["event", "organization", "athlete"]


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=120)
    # Which entity types to search; omit/empty → all the caller is allowed to see.
    types: list[SearchType] | None = None
    # Max hits PER type (palette shows a handful per group).
    limit: int = Field(default=5, ge=1, le=20)


class SearchHit(BaseModel):
    # Built from the SearchHit dataclass returned by the provider.
    model_config = ConfigDict(from_attributes=True)

    type: SearchType
    id: int
    title: str
    subtitle: str | None = None


class SearchResponse(BaseModel):
    data: list[SearchHit]
    count: int
