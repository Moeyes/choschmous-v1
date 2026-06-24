"""Access logging + request-id correlation middleware (CHOS-204).

Resolves one ``request_id`` per request (honouring an inbound ``X-Request-Id`` /
``X-Correlation-Id`` so a trace started at the edge/frontend stays joined),
publishes it to ``request.state`` and the logging context var, stamps it onto the
active OpenTelemetry span, returns it as the ``X-Request-Id`` response header, and
emits a single structured access log line. PII stays out of the log: the path is
logged without its query string (search terms can contain participant PII); use
DEBUG for the full URL.
"""

from __future__ import annotations

import logging
from time import time

from fastapi import Request
from opentelemetry import trace
from starlette.middleware.base import BaseHTTPMiddleware

from core.request_context import new_request_id, reset_request_id, set_request_id

logger = logging.getLogger("access")

# Inbound headers a caller may use to supply their own correlation id.
_INBOUND_ID_HEADERS = ("x-request-id", "x-correlation-id")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = (
            next(
                (rid for h in _INBOUND_ID_HEADERS if (rid := request.headers.get(h))),
                None,
            )
            or new_request_id()
        )

        request.state.request_id = request_id
        token = set_request_id(request_id)

        # Stamp the id onto the active span (no-op when tracing is disabled or
        # the span isn't recording), so trace <-> log <-> error_id all share it.
        span = trace.get_current_span()
        if span.is_recording():
            span.set_attribute("request_id", request_id)

        start_time = time()
        try:
            response = await call_next(request)
            # Log while the request-id context var is still set so the access
            # line carries request_id (the reset happens in finally). On an
            # unhandled error call_next raises and the access line is skipped —
            # the global exception handler logs it with the error_id instead.
            process_time = time() - start_time
            response.headers["X-Request-Id"] = request_id
            logger.info(
                "%s %s - %s - %.4fs",
                request.method,
                request.url.path,
                response.status_code,
                process_time,
                extra={
                    "http_method": request.method,
                    "http_path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round(process_time * 1000, 2),
                },
            )
            if request.url.query:
                logger.debug("Full URL: %s?%s", request.url.path, request.url.query)
            return response
        finally:
            reset_request_id(token)
