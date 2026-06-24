"""OpenTelemetry tracing setup (CHOS-204).

Wires the OTel SDK + OTLP/HTTP exporter and instruments the FastAPI app so every
request is a server span. Spans are correlated to the per-request ``request_id``
(set in ``LoggingMiddleware``) and, on failure, to the ``error_id`` (set in the
global exception handler) — the same ids surfaced in structured logs and error
responses, so a log line, a trace, and an error report all share a key.

Disabled unless ``OTEL_ENABLED`` is set, so local dev and CI need no collector.
When enabled without an ``OTEL_EXPORTER_OTLP_ENDPOINT`` the spans are created but
not exported (useful for verifying instrumentation locally).

# TODO(CHOS-204 / infra): provision the collector / Tempo and inject
#   OTEL_EXPORTER_OTLP_ENDPOINT (e.g. http://tempo:4318 or the otel-collector).
# Traces land in Tempo; logs in Loki (Promtail/Alloy scrapes container stdout);
# Grafana links them via the trace_id field. See infra/observability/.
"""

from __future__ import annotations

import logging

from core.config import settings

logger = logging.getLogger(__name__)


def setup_tracing(app) -> bool:
    """Instrument ``app`` with OpenTelemetry. Returns True if tracing was wired.

    Best-effort and guarded: if the OTel packages are missing or anything fails,
    it logs a warning and returns False so the app still boots."""
    if not settings.OTEL_ENABLED:
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import (
            OTLPSpanExporter,
        )
        from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
    except Exception as exc:  # missing optional dep — degrade gracefully
        logger.warning("OpenTelemetry unavailable; tracing disabled: %s", exc)
        return False

    resource = Resource.create(
        {
            "service.name": settings.OTEL_SERVICE_NAME,
            "deployment.environment": settings.ENVIRONMENT,
        }
    )
    provider = TracerProvider(resource=resource)

    endpoint = settings.OTEL_EXPORTER_OTLP_ENDPOINT
    if endpoint:
        traces_url = (
            endpoint
            if endpoint.rstrip("/").endswith("/v1/traces")
            else endpoint.rstrip("/") + "/v1/traces"
        )
        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=traces_url))
        )
        logger.info("OTel exporting traces to %s", traces_url)
    else:
        logger.warning(
            "OTEL_ENABLED but OTEL_EXPORTER_OTLP_ENDPOINT is unset; spans are "
            "created but not exported."
        )

    trace.set_tracer_provider(provider)
    # Exclude health/metrics probes from tracing noise.
    FastAPIInstrumentor.instrument_app(
        app,
        tracer_provider=provider,
        excluded_urls="health,health/ready,metrics",
    )
    logger.info(
        "OpenTelemetry tracing enabled (service=%s, env=%s)",
        settings.OTEL_SERVICE_NAME,
        settings.ENVIRONMENT,
    )
    return True
