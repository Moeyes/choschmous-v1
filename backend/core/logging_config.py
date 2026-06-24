"""Structured JSON logging (CHOS-204).

Every log record is emitted as a single JSON object carrying the correlation
fields needed to pivot from a log line to its trace in Tempo and back:

    {"timestamp", "level", "logger", "message",
     "request_id", "trace_id", "span_id", ...extra, "exc_info"?}

``request_id`` comes from the per-request context var; ``trace_id``/``span_id``
come from the active OpenTelemetry span (omitted when tracing is off / no active
span). Any non-standard attribute attached to a record via ``logger.info(...,
extra={...})`` is included verbatim, so the access middleware can attach
``http_method`` / ``status_code`` / ``duration_ms`` without a bespoke schema.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from opentelemetry import trace

from core.request_context import get_request_id

# Attributes present on every stdlib LogRecord — anything else a caller attached
# via ``extra=`` is treated as a structured field worth emitting.
_STD_RECORD_ATTRS = frozenset(logging.makeLogRecord({}).__dict__.keys()) | {
    "message",
    "asctime",
    "taskName",
}


class JsonLogFormatter(logging.Formatter):
    """Render a ``LogRecord`` as one JSON line with trace/request correlation."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "timestamp": datetime.fromtimestamp(
                record.created, tz=timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        request_id = get_request_id()
        if request_id:
            payload["request_id"] = request_id

        span_ctx = trace.get_current_span().get_span_context()
        if span_ctx.is_valid:
            payload["trace_id"] = format(span_ctx.trace_id, "032x")
            payload["span_id"] = format(span_ctx.span_id, "016x")

        for key, value in record.__dict__.items():
            if key not in _STD_RECORD_ATTRS and not key.startswith("_"):
                payload[key] = value

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(json_logs: bool = True, level: int = logging.INFO) -> None:
    """Install the JSON formatter on the root logger. Idempotent and gentle: it
    sets the formatter on existing handlers (so pytest's capture handler keeps
    working) and only adds a StreamHandler if none exists."""
    formatter: logging.Formatter = (
        JsonLogFormatter()
        if json_logs
        else logging.Formatter("%(levelname)s %(name)s: %(message)s")
    )
    root = logging.getLogger()
    root.setLevel(level)
    if not root.handlers:
        root.addHandler(logging.StreamHandler())
    for handler in root.handlers:
        handler.setFormatter(formatter)

    # Route uvicorn's own loggers through the root JSON handler instead of their
    # default plain formatter, so deployment logs are uniformly structured.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.propagate = True
