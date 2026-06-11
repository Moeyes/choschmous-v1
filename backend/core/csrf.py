"""
CSRF protection — double-submit cookie pattern.

Cookie auth alone is vulnerable to cross-site request forgery: a browser
attaches the auth cookies to any request to our origin, including ones forged by
a malicious page. `SameSite=Lax` blocks most cross-site POSTs, but we add
double-submit as defense-in-depth for a government system.

How it works:
  * On login/refresh the backend sets a random, JS-readable `csrf_token` cookie
    (see `AuthService._set_auth_cookies`).
  * The frontend reads that cookie and echoes it in the `X-CSRF-Token` header on
    every state-changing request (handled centrally in its `apiClient`).
  * This middleware, for unsafe methods, requires the header to be present and
    to match the cookie. A cross-site attacker can send the cookie (the browser
    does it automatically) but cannot read it to set the header — so the match
    fails and the request is rejected.

Exempt: safe methods (GET/HEAD/OPTIONS/TRACE) and the auth bootstrap routes
(login/refresh/logout), which have no established CSRF token yet and are
protected by credentials + SameSite + refresh-cookie possession.
"""

import secrets

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from core.config import settings

CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"

SAFE_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})

# Auth bootstrap routes — no CSRF token exists yet when these are called.
_AUTH_BASE = f"{settings.API_V1_STR}/auth"
EXEMPT_PATHS = frozenset(
    {
        f"{_AUTH_BASE}/login",
        f"{_AUTH_BASE}/refresh",
        f"{_AUTH_BASE}/logout",
    }
)


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.method in SAFE_METHODS or request.url.path in EXEMPT_PATHS:
            return await call_next(request)

        header_token = request.headers.get(CSRF_HEADER_NAME)
        cookie_token = request.cookies.get(CSRF_COOKIE_NAME)

        if (
            not header_token
            or not cookie_token
            or not secrets.compare_digest(header_token, cookie_token)
        ):
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token missing or invalid"},
            )

        return await call_next(request)
