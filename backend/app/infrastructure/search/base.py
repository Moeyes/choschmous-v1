"""Search provider contract + value objects (CHOS-304)."""

from __future__ import annotations

import abc
from dataclasses import dataclass

# The entity types the palette can surface. Athletes carry PII, so their results
# are minimized (name only) and org/sport-scoped — see DbSearchProvider.
ENTITY_TYPES = ("event", "organization", "athlete")


@dataclass(frozen=True)
class SearchScope:
    """Role-derived restriction applied to a search.

    * ``org_id`` set   → athlete results limited to that organization.
    * ``sport_id`` set → athlete results limited to that sport.
    * ``include_athletes`` False → drop athlete results entirely (e.g. an
      organization user with no org linked must not enumerate citizens).

    Events and organizations are non-PII and not scoped.
    """

    org_id: int | None = None
    sport_id: int | None = None
    include_athletes: bool = True


@dataclass(frozen=True)
class SearchHit:
    """One minimized result. NEVER carries PII beyond the display name needed to
    identify the record — no phone / DOB / ID-doc / address (data governance)."""

    type: str  # one of ENTITY_TYPES
    id: int
    title: str
    subtitle: str | None = None


class SearchProvider(abc.ABC):
    """Strategy implemented by the DB and OpenSearch backends."""

    @abc.abstractmethod
    async def search(
        self,
        query: str,
        *,
        types: tuple[str, ...],
        limit: int,
        scope: SearchScope,
    ) -> list[SearchHit]:
        """Return up to ``limit`` hits per requested type for ``query``."""
        raise NotImplementedError
