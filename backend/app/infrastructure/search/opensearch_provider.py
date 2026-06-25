"""OpenSearch-backed search provider (CHOS-304) — production path, SCAFFOLD.

> **No live infra is provisioned by this change.** Selecting this backend
> requires an OpenSearch cluster + credentials (TODO infra, see below). Until
> then ``SEARCH_BACKEND`` stays ``db`` and the factory uses DbSearchProvider.
>
> Required env to enable (see core/config.py):
>   * ``SEARCH_BACKEND=opensearch``
>   * ``OPENSEARCH_URL=https://<host>:9200``
>   * ``OPENSEARCH_USERNAME`` / ``OPENSEARCH_PASSWORD`` (from Vault — never committed)
>   * ``OPENSEARCH_INDEX_PREFIX`` (default ``moeys``)
> TODO(infra): provision the managed OpenSearch domain + IAM/fine-grained auth,
> add it to infra/terraform, and run an indexing job (a periodic arq task or the
> ``bulk_reindex`` below) to populate the indices.

The ``opensearch-py`` client is imported lazily so the package is only required
when this backend is actually enabled (it is not a hard dependency yet).
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.search.base import SearchHit, SearchProvider, SearchScope
from src.models.athlete_participation import AthleteParticipation
from src.models.athletes import Athlete
from src.models.enroll import Enroll
from src.models.events import Events
from src.models.organization import Organization

logger = logging.getLogger(__name__)

# Name (text) + a keyword sub-field for exact/sort; numeric scope filters for
# athletes. Khmer needs an ICU/whitespace analyzer — TODO(infra): attach the
# `analysis-icu` plugin analyzer once the cluster is provisioned.
_INDEX_SETTINGS = {
    "mappings": {
        "properties": {
            "type": {"type": "keyword"},
            "entity_id": {"type": "integer"},
            "title": {"type": "text", "fields": {"raw": {"type": "keyword"}}},
            "subtitle": {"type": "text"},
            "org_id": {"type": "integer"},
            "sport_id": {"type": "integer"},
        }
    }
}


class OpenSearchProvider(SearchProvider):
    def __init__(self, url: str, index_prefix: str, *, username=None, password=None):
        self._url = url
        self._prefix = index_prefix
        self._auth = (username, password) if username and password else None
        self._client = None  # lazy

    # -- client / index management -------------------------------------------
    def _get_client(self):
        if self._client is None:
            # Lazy import: opensearch-py is only needed when this backend is on.
            from opensearchpy import AsyncOpenSearch  # type: ignore

            self._client = AsyncOpenSearch(
                hosts=[self._url],
                http_auth=self._auth,
                use_ssl=self._url.startswith("https"),
                verify_certs=True,
            )
        return self._client

    def _index(self) -> str:
        return f"{self._prefix}-search"

    async def ensure_index(self) -> None:
        client = self._get_client()
        if not await client.indices.exists(index=self._index()):
            await client.indices.create(index=self._index(), body=_INDEX_SETTINGS)

    # -- indexing ------------------------------------------------------------
    async def bulk_reindex(self, db: AsyncSession) -> int:
        """(Re)build the index from Postgres. Called by an indexing job, not the
        request path.

        Athletes are indexed with the SAME minimized projection
        ``DbSearchProvider._athletes`` returns: NAME + organisation only, plus
        ``org_id``/``sport_id`` for scope filtering. No phone/DOB/ID-doc ever
        reaches the index (CHOS-304 PII minimization)."""
        await self.ensure_index()
        client = self._get_client()
        actions: list[dict] = []

        for ev in (await db.execute(select(Events))).scalars():
            actions.append(
                {"index": {"_index": self._index(), "_id": f"event:{ev.id}"}}
            )
            actions.append(
                {
                    "type": "event",
                    "entity_id": ev.id,
                    "title": ev.name_kh,
                    "subtitle": ev.location,
                }
            )
        for org in (await db.execute(select(Organization))).scalars():
            actions.append({"index": {"_index": self._index(), "_id": f"org:{org.id}"}})
            actions.append(
                {
                    "type": "organization",
                    "entity_id": org.id,
                    "title": org.name_kh,
                    "subtitle": org.name_en,
                }
            )
        # CHOS-304: athletes — minimized projection only (name + org + scope ids).
        # One doc per (athlete, org, sport) participation so org/sport scope
        # filters in search() match precisely. _id is deterministic so a reindex
        # is idempotent. Mirrors DbSearchProvider._athletes (the tested path):
        # NAME columns + joined org name only; never search_text/phone/DOB/ID-doc.
        athlete_stmt = (
            select(
                Enroll.id.label("enroll_id"),
                Enroll.kh_family_name,
                Enroll.kh_given_name,
                Organization.name_kh.label("org_name"),
                AthleteParticipation.organization_id,
                AthleteParticipation.sports_id,
            )
            .join(Athlete, Athlete.enroll_id == Enroll.id)
            .join(AthleteParticipation, AthleteParticipation.athletes_id == Athlete.id)
            .join(Organization, Organization.id == AthleteParticipation.organization_id)
        )
        for r in (await db.execute(athlete_stmt)).all():
            name = f"{r.kh_family_name or ''} {r.kh_given_name or ''}".strip()
            actions.append(
                {
                    "index": {
                        "_index": self._index(),
                        "_id": f"athlete:{r.enroll_id}:{r.organization_id}:{r.sports_id}",
                    }
                }
            )
            actions.append(
                {
                    "type": "athlete",
                    "entity_id": r.enroll_id,
                    "title": name,
                    "subtitle": r.org_name,
                    "org_id": r.organization_id,
                    "sport_id": r.sports_id,
                }
            )

        if actions:
            await client.bulk(body=actions, refresh=True)
        return len(actions) // 2

    # -- query ---------------------------------------------------------------
    async def search(
        self,
        query: str,
        *,
        types: tuple[str, ...],
        limit: int,
        scope: SearchScope,
    ) -> list[SearchHit]:
        client = self._get_client()
        effective_types = [t for t in types if t != "athlete" or scope.include_athletes]

        must: list[dict] = [
            {"multi_match": {"query": query, "fields": ["title^2", "subtitle"]}},
            {"terms": {"type": effective_types}},
        ]
        # Scope athlete hits; events/orgs are unrestricted, so the filter is OR-ed
        # with "type is not athlete".
        scope_filter: list[dict] = []
        if scope.org_id is not None:
            scope_filter.append({"term": {"org_id": scope.org_id}})
        if scope.sport_id is not None:
            scope_filter.append({"term": {"sport_id": scope.sport_id}})

        body: dict = {
            "size": limit * len(effective_types),
            "query": {"bool": {"must": must}},
        }
        if scope_filter:
            body["query"]["bool"]["should"] = [
                {"bool": {"must_not": {"term": {"type": "athlete"}}}},
                {"bool": {"filter": scope_filter}},
            ]
            body["query"]["bool"]["minimum_should_match"] = 1

        resp = await client.search(index=self._index(), body=body)
        hits: list[SearchHit] = []
        for h in resp.get("hits", {}).get("hits", []):
            src = h.get("_source", {})
            hits.append(
                SearchHit(
                    type=src.get("type", ""),
                    id=int(src.get("entity_id", 0)),
                    title=src.get("title", ""),
                    subtitle=src.get("subtitle"),
                )
            )
        return hits
