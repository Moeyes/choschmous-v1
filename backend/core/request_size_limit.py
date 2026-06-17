from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

MAX_REQUEST_SIZE = 10 * 1024 * 1024


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_REQUEST_SIZE:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "detail": f"Request too large. Maximum size is {MAX_REQUEST_SIZE // (1024 * 1024)}MB."
                        },
                    )
            except (ValueError, TypeError):
                pass
        return await call_next(request)
