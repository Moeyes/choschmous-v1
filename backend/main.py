import contextlib

import sentry_sdk
from fastapi import FastAPI
from fastapi.routing import APIRoute
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from core.config import settings
from core.loggine import LoggingMiddleware
from core.content_type_validation import ContentTypeValidationMiddleware
from core.csrf import CSRFMiddleware
from core.security_headers import SecurityHeadersMiddleware
from core.request_size_limit import RequestSizeLimitMiddleware
from core.cache_control import CacheControlMiddleware
from core.dashboard_invalidation import DashboardCacheMiddleware
from core.redis_client import close_redis
from src.api.main import api_router


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

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
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

app.include_router(api_router)
