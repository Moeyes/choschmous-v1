from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_JSON_CONTENT_TYPES = {"application/json", "application/json; charset=utf-8"}

API_PREFIXES = ("/api",)


class ContentTypeValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if (
            request.method in _UNSAFE_METHODS
            and request.url.path.startswith(API_PREFIXES)
        ):
            content_type = request.headers.get("content-type", "").lower().strip()
            if not content_type:
                return JSONResponse(
                    status_code=415,
                    content={"detail": "Content-Type header is required on mutating requests."},
                )
            if not any(ct in content_type for ct in _JSON_CONTENT_TYPES):
                return JSONResponse(
                    status_code=415,
                    content={"detail": "Unsupported media type. Use application/json."},
                )
        return await call_next(request)
