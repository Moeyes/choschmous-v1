"""Invalidate the dashboard Redis cache after any state-changing API request.

The dashboard service caches its stats / gender / top-org aggregates in Redis
for a short TTL (see ``DASHBOARD_CACHE_TTL``). Without invalidation those
aggregates stay stale until the TTL expires, so a freshly created event /
organization / enrollment would not show up on the dashboard for up to two
minutes — even though the frontend refetches immediately.

Rather than sprinkle ``invalidate_dashboard_cache()`` through every mutating
service (easy to forget when new write endpoints are added), this middleware
clears the dashboard cache once, centrally, after every successful write. The
work is a single Redis SCAN over a handful of ``dashboard:*`` keys and only runs
on non-GET requests, so the overhead is negligible.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from core.cache import cache_delete_pattern

_WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class DashboardCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        if (
            request.method in _WRITE_METHODS
            and 200 <= response.status_code < 300
            and request.url.path.startswith("/api/")
        ):
            # cache_delete_pattern already swallows Redis errors; guard anyway so
            # a cache hiccup can never turn a successful write into a 500.
            try:
                await cache_delete_pattern("dashboard:*")
            except Exception:  # pragma: no cover - defensive
                pass

        return response
