from fastapi import APIRouter, Depends
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


V1 = settings.API_V1_STR
V2 = settings.API_V2_STR

# Auth mechanism: all protected routes use HttpOnly cookie "access_token" set by POST /api/auth/login.
# get_current_user reads that cookie, validates the JWT, and returns the User.
# Public routes: /root, /auth/login, /auth/refresh — no Depends(get_current_user).
_auth = [Depends(get_current_user)]

api_router = APIRouter()

# Public — no auth required
api_router.include_router(v1_root.router, prefix=V1 + "/root", tags=["root"])
api_router.include_router(v1_auth.router, prefix=V1 + "/auth", tags=["auth"])

# Protected — require valid access_token cookie
api_router.include_router(v1_users.router, prefix=V1 + "/users", tags=["users"], dependencies=_auth)
api_router.include_router(
    v1_reregister.router, prefix=V1 + "/registration", tags=["registration"], dependencies=_auth
)

# Sports & Events
api_router.include_router(v1_sports.router, prefix=V1 + "/sports", tags=["sports"], dependencies=_auth)
api_router.include_router(v1_events.router, prefix=V1 + "/events", tags=["events"], dependencies=_auth)
# Public events (no auth) for SSR/metadata
api_router.include_router(v1_public_events.router, prefix=V1 + "/public/events", tags=["public-events"])
api_router.include_router(v1_public_sports.router, prefix=V1 + "/public/sports", tags=["public-sports"])
api_router.include_router(
    v1_organization.router, prefix=V1 + "/organization", tags=["organization"], dependencies=_auth
)
api_router.include_router(v1_sports_events.router, prefix=V1 + "/sports-events", tags=["sports-events"], dependencies=_auth)

# Dashboard / Analytics
api_router.include_router(
    v1_dashboard.router, prefix=V1 + "/dashboard", tags=["dashboard"], dependencies=_auth
)

# Excel Download
api_router.include_router(v1_excel.router, prefix=V1 + "/excel", tags=["excel"], dependencies=_auth)

# Card Generation
api_router.include_router(v1_card.router, prefix=V1, tags=["card"], dependencies=_auth)

# Participation Per Sport
api_router.include_router(
    v1_participation_per_sport.router,
    prefix=V1 + "/participation-per-sport",
    tags=["participation-per-sport"],
    dependencies=_auth,
)

# Cloudinary Presign
api_router.include_router(
    v1_cloudinary.router, prefix=V1 + "/cloudinary", tags=["cloudinary"], dependencies=_auth
)

# Database-backed file storage (athlete photos / ID documents), keyed by UUID
api_router.include_router(
    v1_files.router, prefix=V1 + "/files", tags=["files"], dependencies=_auth
)

# Maintenance — only registered when ENVIRONMENT=local; still requires auth
if settings.ENVIRONMENT == "local":
    api_router.include_router(
        v1_maintenance.router,
        prefix=V1 + "/maintenance",
        tags=["maintenance"],
        dependencies=_auth,
    )


api_router.include_router(v1_root.router, prefix=V2 + "/root", tags=["root"])
