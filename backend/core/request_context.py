"""Per-request correlation id (CHOS-204).

A request id is resolved once per request in ``LoggingMiddleware`` (from an
inbound ``X-Request-Id`` / ``X-Correlation-Id`` header, or freshly minted) and
stashed both on ``request.state`` (for exception handlers) and in this
context var (for the JSON log formatter, which has no access to ``request``).
It ties together: the access log line, every app log emitted during the request,
the OpenTelemetry span (as a ``request_id`` attribute), the ``X-Request-Id``
response header, and the ``request_id`` field in error responses.
"""

from __future__ import annotations

import uuid
from contextvars import ContextVar, Token

_request_id: ContextVar[str | None] = ContextVar("request_id", default=None)


def new_request_id() -> str:
    return uuid.uuid4().hex


def set_request_id(value: str) -> Token:
    return _request_id.set(value)


def reset_request_id(token: Token) -> None:
    _request_id.reset(token)


def get_request_id() -> str | None:
    return _request_id.get()
