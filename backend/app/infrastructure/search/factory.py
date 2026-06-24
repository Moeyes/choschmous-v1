"""Search provider selection (CHOS-304).

Returns the OpenSearch provider when explicitly enabled AND configured;
otherwise the always-available DB provider. Misconfiguration (backend=opensearch
but URL unset, or opensearch-py missing) degrades to the DB provider with a
warning rather than failing search.
"""

from __future__ import annotations

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.infrastructure.search.base import SearchProvider
from app.infrastructure.search.db_provider import DbSearchProvider
from core.config import settings

logger = logging.getLogger(__name__)


def get_search_provider(db: AsyncSession) -> SearchProvider:
    backend = (getattr(settings, "SEARCH_BACKEND", "db") or "db").lower()
    if backend == "opensearch":
        url = getattr(settings, "OPENSEARCH_URL", None)
        if not url:
            logger.warning(
                "SEARCH_BACKEND=opensearch but OPENSEARCH_URL is unset — "
                "falling back to the DB search provider."
            )
            return DbSearchProvider(db)
        try:
            from app.infrastructure.search.opensearch_provider import OpenSearchProvider

            return OpenSearchProvider(
                url=url,
                index_prefix=getattr(settings, "OPENSEARCH_INDEX_PREFIX", "moeys"),
                username=getattr(settings, "OPENSEARCH_USERNAME", None),
                password=getattr(settings, "OPENSEARCH_PASSWORD", None),
            )
        except ImportError:
            logger.warning(
                "opensearch-py is not installed — falling back to the DB search "
                "provider. Add the dependency to enable the OpenSearch backend."
            )
            return DbSearchProvider(db)

    return DbSearchProvider(db)
