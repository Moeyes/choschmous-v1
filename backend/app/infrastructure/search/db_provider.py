"""Postgres-backed search provider (CHOS-304).

The always-available default — ILIKE queries against the live tables, no extra
infrastructure. Good for the current data volume; swap to OpenSearch via
``SEARCH_BACKEND=opensearch`` when scale/typo-tolerance demands it.

PII discipline (data governance §7):
* athlete results are a MINIMIZED projection (name + org only) — no phone, DOB,
  ID-doc, gender, or address ever leaves this layer;
* athlete matching is on the NAME columns only, never the ``search_text`` column
  (which also contains the phone number) — so this can't become a reverse
  phone-number lookup;
* athletes are org/sport-scoped per :class:`SearchScope`.
"""

from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.search.base import SearchHit, SearchProvider, SearchScope
from src.models.athlete_participation import athlete_participation as AthleteParticipation
from src.models.athletes import athletes as Athlete
from src.models.enroll import Enroll
from src.models.events import Events
from src.models.organization import Organization


def _escape_like(term: str) -> str:
    """Escape LIKE wildcards so user input matches literally (no injection of
    ``%`` / ``_`` patterns)."""
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


class DbSearchProvider(SearchProvider):
    def __init__(self, db: AsyncSession):
        self.db = db

    async def search(
        self,
        query: str,
        *,
        types: tuple[str, ...],
        limit: int,
        scope: SearchScope,
    ) -> list[SearchHit]:
        pattern = f"%{_escape_like(query.strip())}%"
        hits: list[SearchHit] = []

        if "event" in types:
            hits.extend(await self._events(pattern, limit))
        if "organization" in types:
            hits.extend(await self._organizations(pattern, limit))
        if "athlete" in types and scope.include_athletes:
            hits.extend(await self._athletes(pattern, limit, scope))

        return hits

    async def _events(self, pattern: str, limit: int) -> list[SearchHit]:
        stmt = (
            select(Events.id, Events.name_kh, Events.location)
            .where(Events.name_kh.ilike(pattern, escape="\\"))
            .order_by(Events.id.desc())
            .limit(limit)
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            SearchHit(type="event", id=r.id, title=r.name_kh, subtitle=r.location)
            for r in rows
        ]

    async def _organizations(self, pattern: str, limit: int) -> list[SearchHit]:
        stmt = (
            select(Organization.id, Organization.name_kh, Organization.name_en)
            .where(
                or_(
                    Organization.name_kh.ilike(pattern, escape="\\"),
                    Organization.name_en.ilike(pattern, escape="\\"),
                )
            )
            .order_by(Organization.id.desc())
            .limit(limit)
        )
        rows = (await self.db.execute(stmt)).all()
        return [
            SearchHit(
                type="organization", id=r.id, title=r.name_kh, subtitle=r.name_en
            )
            for r in rows
        ]

    async def _athletes(
        self, pattern: str, limit: int, scope: SearchScope
    ) -> list[SearchHit]:
        # DISTINCT ON (Enroll.id) so an athlete enrolled in several
        # events/orgs collapses to one hit; the joined org name becomes the
        # subtitle. Name columns only — never search_text (carries phone).
        name_match = or_(
            Enroll.kh_family_name.ilike(pattern, escape="\\"),
            Enroll.kh_given_name.ilike(pattern, escape="\\"),
            Enroll.en_family_name.ilike(pattern, escape="\\"),
            Enroll.en_given_name.ilike(pattern, escape="\\"),
        )
        stmt = (
            select(
                Enroll.id,
                Enroll.kh_family_name,
                Enroll.kh_given_name,
                Organization.name_kh.label("org_name"),
            )
            .join(Athlete, Athlete.enroll_id == Enroll.id)
            .join(AthleteParticipation, AthleteParticipation.athletes_id == Athlete.id)
            .outerjoin(
                Organization, Organization.id == AthleteParticipation.organization_id
            )
            .where(name_match)
        )
        if scope.org_id is not None:
            stmt = stmt.where(AthleteParticipation.organization_id == scope.org_id)
        if scope.sport_id is not None:
            stmt = stmt.where(AthleteParticipation.sports_id == scope.sport_id)

        stmt = stmt.distinct(Enroll.id).order_by(Enroll.id.desc()).limit(limit)

        rows = (await self.db.execute(stmt)).all()
        return [
            SearchHit(
                type="athlete",
                id=r.id,
                title=f"{r.kh_family_name} {r.kh_given_name}".strip(),
                subtitle=r.org_name,
            )
            for r in rows
        ]
