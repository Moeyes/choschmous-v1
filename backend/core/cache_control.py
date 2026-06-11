import re
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


CACHEABLE_PATHS = {
    re.compile(r"^/api/events/?$"): "public, max-age=300",
    re.compile(r"^/api/sports/?$"): "public, max-age=300",
    re.compile(r"^/api/organization/?$"): "public, max-age=300",
    re.compile(r"^/api/categories/"): "public, max-age=300",
    re.compile(r"^/api/events/\d+/sports/\d+/categories"): "public, max-age=300",
    # NOTE: /api/dashboard is intentionally NOT cacheable. It embeds
    # Restricted-PII (recentEnrollments) and must always reflect the latest
    # data, so it falls through to "no-store" below.
}


class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        if request.method != "GET":
            return response
        for pattern, value in CACHEABLE_PATHS.items():
            if pattern.search(request.url.path):
                response.headers["Cache-Control"] = value
                return response
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        return response
