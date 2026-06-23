import contextlib
import logging
import uuid

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.exceptions import HTTPException
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from core.config import settings
from core.logging_mw import LoggingMiddleware
from core.content_type_validation import ContentTypeValidationMiddleware
from core.csrf import CSRFMiddleware
from core.security_headers import SecurityHeadersMiddleware
from core.request_size_limit import RequestSizeLimitMiddleware
from core.cache_control import CacheControlMiddleware
from core.dashboard_invalidation import DashboardCacheMiddleware
from core.redis_client import close_redis, ping_redis
from src.api.main import api_router

logger = logging.getLogger(__name__)

_IS_LOCAL = settings.ENVIRONMENT.lower() == "local"


def custom_generate_unique_id(route: APIRoute) -> str:
    if route.tags:
        return f"{route.tags[0]}-{route.name}"
    return route.name


if settings.SENTRY_DSN and settings.ENVIRONMENT.lower() != "local":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await close_redis()


# Only expose the OpenAPI schema + interactive docs in local/dev. In production
# the full API surface should not be publicly enumerable.
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json" if _IS_LOCAL else None,
    docs_url="/docs" if _IS_LOCAL else None,
    redoc_url="/redoc" if _IS_LOCAL else None,
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
)


@app.get("/health", tags=["health"], include_in_schema=False)
async def health() -> dict[str, str]:
    """Liveness probe used by the container HEALTHCHECK and load balancers."""
    return {"status": "ok"}


@app.get("/health/ready", tags=["health"], include_in_schema=False)
async def readiness() -> JSONResponse:
    """Readiness probe. Reports Redis status without failing: when Redis is down
    the app stays operational (rate limiting / idempotency degrade to in-memory),
    so this returns 200 with ``redis: "down"`` rather than taking the pod out of
    rotation. Flip the status code if your platform should drain on Redis loss."""
    redis_ok = await ping_redis()
    return JSONResponse(
        status_code=200,
        content={
            "status": "ok",
            "redis": "up" if redis_ok else "down",
            "degraded": not redis_ok,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    error_id = uuid.uuid4()
    logger.exception("Unhandled exception %s: %s", error_id, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred", "error_id": str(error_id)},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if exc.status_code == 403:
        logger.warning(
            "Access denied [%s] %s: %s",
            request.method,
            request.url.path,
            exc.detail,
        )
    if exc.status_code >= 500:
        logger.exception("Server error %s: %s", exc.status_code, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


app.add_middleware(LoggingMiddleware)

# Request body size limit — reject oversized payloads early (before parsing).
app.add_middleware(RequestSizeLimitMiddleware)

# CSRF double-submit check on state-changing requests. Added before CORS so
# CORS stays the outermost middleware and a rejected (403) request still carries
# the CORS headers the browser needs to read the response.
app.add_middleware(CSRFMiddleware)

# Content-Type validation — reject non-JSON on mutating API requests
app.add_middleware(ContentTypeValidationMiddleware)

# Security headers (CSP, HSTS, X-Frame-Options, etc.)
app.add_middleware(SecurityHeadersMiddleware)

# GZip compression for JSON responses (60-80% size reduction)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Cache-Control headers for cacheable GET endpoints
app.add_middleware(CacheControlMiddleware)

# Invalidate the dashboard Redis cache after any successful write so dashboard
# metrics always reflect the latest data without waiting for the TTL to expire.
app.add_middleware(DashboardCacheMiddleware)

# Ensure CORS is enabled during local development. If `BACKEND_CORS_ORIGINS`
# is configured, use it; otherwise add common localhost dev origins.
try:
    origins = settings.all_cors_origins or []
except Exception:
    origins = []

if settings.ENVIRONMENT.lower() == "local":
    # Add Next dev server origins commonly used in this workspace
    dev_extra = ["http://localhost:3002", "http://127.0.0.1:3002"]
    for o in dev_extra:
        if o not in origins:
            origins.append(o)

if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "X-CSRF-Token",
            "X-Correlation-Id",
            "Accept",
        ],
    )
elif not _IS_LOCAL:
    # No CORS origins configured in a non-local environment. If the frontend is
    # served from a different origin, every browser request will be blocked.
    # Warn loudly at boot so this misconfiguration is caught in deployment.
    logger.warning(
        "BACKEND_CORS_ORIGINS is empty in ENVIRONMENT=%s — cross-origin browser "
        "requests will be blocked. Set it if the frontend is on a different origin.",
        settings.ENVIRONMENT,
    )

app.include_router(api_router)


# Observability (CHOS-105): expose Prometheus metrics at /metrics. The
# instrumentator is an optional dependency, so the import is guarded — the app
# (and the test suite, which imports this module) runs fine without it.
# NOTE: prometheus-fastapi-instrumentator's current release pins
# ``starlette<1.0``, which conflicts with this project's ``starlette>=1.3.1``
# pin, so it is not yet in pyproject.toml. See infra/observability/README.md for
# the wiring + the TODO to resolve the version conflict before enabling in prod.
if settings.ENABLE_METRICS:
    try:
        from prometheus_fastapi_instrumentator import Instrumentator

        Instrumentator().instrument(app).expose(
            app, endpoint="/metrics", include_in_schema=False
        )
    except Exception as exc:  # missing or incompatible — degrade gracefully
        logger.warning("Prometheus /metrics not enabled: %s", exc)
