"""Search infrastructure (CHOS-304).

A small provider abstraction over full-text search:

* ``DbSearchProvider`` — the always-available default: ILIKE queries straight
  against Postgres (events / organizations / athletes). No extra infra.
* ``OpenSearchProvider`` — the production path (scaffold): an OpenSearch-backed
  index for low-latency, typo-tolerant search at scale. Selected via
  ``SEARCH_BACKEND=opensearch`` once a cluster is provisioned (TODO infra).

``get_search_provider(db)`` returns the configured provider, falling back to the
DB provider whenever OpenSearch is not configured/available — so search always
works.
"""

from app.infrastructure.search.base import SearchHit, SearchProvider, SearchScope
from app.infrastructure.search.factory import get_search_provider

__all__ = ["SearchHit", "SearchProvider", "SearchScope", "get_search_provider"]
