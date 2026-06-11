import logging
from time import time
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request, Response

logger = logging.getLogger("access")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time()
        response = await call_next(request)
        process_time = time() - start_time
        # Use logging.getLogger with structured fields; request paths may
        # contain PII (e.g. participant search terms) so they are logged at
        # INFO level without query strings. Use DEBUG for full URLs.
        qs = f"?{request.url.query}" if request.url.query else ""
        logger.info(
            "%s %s - %s - %.4fs",
            request.method,
            request.url.path,
            response.status_code,
            process_time,
        )
        logger.debug("Full URL: %s%s", request.url.path, qs)
        return response
