from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
_JSON_CONTENT_TYPES = {"application/json", "application/json; charset=utf-8"}
# multipart/form-data always carries a per-request boundary parameter
# (e.g. "multipart/form-data; boundary=----WebKit..."), so we match by
# prefix rather than exact set membership. File uploads (see
# src/api/v1/routes/files.py) rely on this to get past the gate; the
# route itself re-validates the actual content via magic-byte sniffing.
_MULTIPART_PREFIX = "multipart/form-data"
API_PREFIXES = ("/api",)


class ContentTypeValidationMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method in _UNSAFE_METHODS and request.url.path.startswith(
            API_PREFIXES
        ):
            content_type = request.headers.get("content-type", "").lower().strip()
            if not content_type:
                return JSONResponse(
                    status_code=415,
                    content={
                        "detail": "Content-Type header is required on mutating requests."
                    },
                )
            is_json = any(ct in content_type for ct in _JSON_CONTENT_TYPES)
            is_multipart = content_type.startswith(_MULTIPART_PREFIX)
            if not (is_json or is_multipart):
                return JSONResponse(
                    status_code=415,
                    content={
                        "detail": "Unsupported media type. Use application/json or multipart/form-data."
                    },
                )
        return await call_next(request)
