from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from starlette.status import HTTP_307_TEMPORARY_REDIRECT

from core.config import settings
from src.database.deps import get_current_user

from .v1.routes import root as v1_root
from .v1.routes import users as v1_users
from .v1.routes import sports as v1_sports
from .v1.routes import events as v1_events
from .v1.routes import organization as v1_organization
from .v1.routes import participant as v1_reregister
from .v1.routes import auth as v1_auth
from .v1.routes import dashboard as v1_dashboard
from .v1.routes import maintenance as v1_maintenance
from .v1.routes import cloudinary as v1_cloudinary
from .v1.routes import files as v1_files
from .v1.routes import excel as v1_excel
from .v1.routes import card as v1_card
from .v1.routes import participation_per_sport as v1_participation_per_sport
from .v1.routes import public_events as v1_public_events
from .v1.routes import public_sports as v1_public_sports
from .v1.routes import sports_events as v1_sports_events
from .v1.routes import category_survey as v1_category_survey
from .v1.routes import open_survey as v1_open_survey
from .v1.routes import teams as v1_teams
from .v1.routes import organizers as v1_organizers
from .v1.routes import reports as v1_reports
from .v1.routes import search as v1_search


V1 = settings.API_V1_STR

# Auth mechanism: all protected routes use HttpOnly cookie "access_token" set by POST /api/auth/login.
# get_current_user reads that cookie, validates the JWT, and returns the User.
# Public routes: /root, /auth/login, /auth/refresh — no Depends(get_current_user).
_auth = [Depends(get_current_user)]

api_router = APIRouter()

# Public — no auth required
api_router.include_router(v1_root.router, prefix=V1 + "/root", tags=["root"])
api_router.include_router(v1_auth.router, prefix=V1 + "/auth", tags=["auth"])

# Protected — require valid access_token cookie
api_router.include_router(
    v1_users.router, prefix=V1 + "/users", tags=["users"], dependencies=_auth
)
api_router.include_router(
    v1_reregister.router,
    prefix=V1 + "/registration",
    tags=["registration"],
    dependencies=_auth,
)

# Sports & Events
api_router.include_router(
    v1_sports.router, prefix=V1 + "/sports", tags=["sports"], dependencies=_auth
)
api_router.include_router(
    v1_events.router, prefix=V1 + "/events", tags=["events"], dependencies=_auth
)
# Public events (no auth) for SSR/metadata
api_router.include_router(
    v1_public_events.router, prefix=V1 + "/public/events", tags=["public-events"]
)
api_router.include_router(
    v1_public_sports.router, prefix=V1 + "/public/sports", tags=["public-sports"]
)
api_router.include_router(
    v1_organization.router,
    prefix=V1 + "/organization",
    tags=["organization"],
    dependencies=_auth,
)
api_router.include_router(
    v1_sports_events.router,
    prefix=V1 + "/sports-events",
    tags=["sports-events"],
    dependencies=_auth,
)
api_router.include_router(
    v1_category_survey.router,
    prefix=V1 + "/surveys",
    tags=["surveys"],
    dependencies=_auth,
)
api_router.include_router(
    v1_open_survey.router,
    prefix=V1 + "/surveys/open",
    tags=["open-survey"],
    dependencies=_auth,
)

# Dashboard / Analytics
api_router.include_router(
    v1_dashboard.router,
    prefix=V1 + "/dashboard",
    tags=["dashboard"],
    dependencies=_auth,
)

# Excel Download
api_router.include_router(
    v1_excel.router, prefix=V1 + "/excel", tags=["excel"], dependencies=_auth
)

# Card Generation
api_router.include_router(v1_card.router, prefix=V1, tags=["card"], dependencies=_auth)

# Participation Per Sport
api_router.include_router(
    v1_participation_per_sport.router,
    prefix=V1 + "/participation-per-sport",
    tags=["participation-per-sport"],
    dependencies=_auth,
)

# Teams
api_router.include_router(
    v1_teams.router, prefix=V1 + "/teams", tags=["teams"], dependencies=_auth
)

# Organizers
api_router.include_router(
    v1_organizers.router, prefix=V1, tags=["organizers"], dependencies=_auth
)

# Reports
api_router.include_router(
    v1_reports.router, prefix=V1, tags=["reports"], dependencies=_auth
)

# Global search (CHOS-304) — POST /api/v1/search for the ⌘K palette.
api_router.include_router(
    v1_search.router, prefix=V1, tags=["search"], dependencies=_auth
)

# Cloudinary Presign
api_router.include_router(
    v1_cloudinary.router,
    prefix=V1 + "/cloudinary",
    tags=["cloudinary"],
    dependencies=_auth,
)

# Database-backed file storage (athlete photos / ID documents), keyed by UUID
api_router.include_router(
    v1_files.router, prefix=V1 + "/files", tags=["files"], dependencies=_auth
)

# Maintenance — destructive schema ops. Registered only in local dev or when
# ENABLE_MAINTENANCE=1 is explicitly set, so the routes are absent from the prod
# image by default (CHOS-102). Still requires auth + SUPER_ADMIN on each route.
if settings.ENVIRONMENT == "local" or settings.ENABLE_MAINTENANCE:
    api_router.include_router(
        v1_maintenance.router,
        prefix=V1 + "/maintenance",
        tags=["maintenance"],
        dependencies=_auth,
    )


# Backward-compat (CHOS-203): the API prefix moved from /api to /api/v1. Any
# legacy /api/<path> request that does NOT match a real /api/v1 route is
# redirected with 307 (which preserves the method + body, so POST/PUT/PATCH/
# DELETE keep working) to its /api/v1 equivalent. This must be mounted AFTER
# api_router in main.py so the explicit /api/v1/* routes always win the match
# and a /api/v1/* request never reaches this catch-all (no redirect loop).
legacy_redirect_router = APIRouter()


@legacy_redirect_router.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    include_in_schema=False,
)
async def _legacy_api_redirect(path: str, request: Request) -> RedirectResponse:
    # A request already under /api/v1 that reaches this catch-all is a genuine
    # miss on a versioned route — return 404 rather than redirecting it to
    # /api/v1/v1/... (which would never resolve). Only un-versioned legacy paths
    # get rewritten to their /api/v1 equivalent.
    if path == "v1" or path.startswith("v1/"):
        raise HTTPException(status_code=404, detail="Not Found")
    target = f"{V1}/{path}"
    if request.url.query:
        target = f"{target}?{request.url.query}"
    return RedirectResponse(url=target, status_code=HTTP_307_TEMPORARY_REDIRECT)
