// import { NextResponse } from 'next/server';
// import type { NextRequest } from 'next/server';

// // CHOS-303: Portal routes requiring authentication (cookie presence check only;
// // full JWT validation is in the backend).
// const PORTAL_ROUTES = [
//   '/dashboard',
//   '/events',
//   '/sports',
//   '/organizations',
//   '/users',
//   '/cards',
//   '/reports',
//   '/participation',
//   '/register',
//   '/by-number',
//   '/by-category',
//   '/by-sport',
//   '/leader-registration',
//   '/registrations',
//   '/open-survey',
//   '/category-submissions',
//   '/sport-submissions',
//   '/organizer-registration',
//   '/organizer-roles',
// ];

// // CHOS-303: Origin lockdown via shared secret injected by Cloudflare.
// // In local dev this env var is unset, so the check is bypassed.
// // In production it must match the value in Vault secret/moeys/cloudflare.
// const CF_ORIGIN_SECRET = process.env.CF_ORIGIN_SECRET;
// const ENFORCE_ORIGIN_SECRET = process.env.NODE_ENV === 'production' && !!CF_ORIGIN_SECRET;

// // Paths exempt from origin secret check (e.g. health checks from ALB
// // target group — these come from the internal VPC, not through Cloudflare).
// const ORIGIN_SECRET_EXEMPT_PATHS = ['/api/health', '/api/health/ready', '/_next/'];

// function isOriginSecretExempt(pathname: string): boolean {
//   return ORIGIN_SECRET_EXEMPT_PATHS.some((p) => pathname.startsWith(p));
// }

// export function middleware(request: NextRequest) {
//   const { nextUrl, cookies } = request;
//   const pathname = nextUrl.pathname;

//   // ── CHOS-303: Origin lockdown ────────────────────────────────────────────
//   // Reject requests that didn't come through Cloudflare (missing/wrong secret).
//   // This is the application-layer enforcement; ALB Security Group is the
//   // network-layer enforcement. Both must be bypassed for a direct-hit to work.
//   if (ENFORCE_ORIGIN_SECRET && !isOriginSecretExempt(pathname)) {
//     const originSecret = request.headers.get('x-cf-origin-secret');
//     if (originSecret !== CF_ORIGIN_SECRET) {
//       // Return a 403 that looks identical to a Cloudflare block page to avoid
//       // leaking that the origin exists and is accessible. Log the attempt.
//       console.warn(`[CHOS-303] Direct origin access blocked: ${pathname} from ${request.headers.get('x-real-ip') || request.ip || 'unknown'} — missing or invalid CF origin secret`);
//       return new NextResponse(null, {
//         status: 403,
//         headers: {
//           'Cache-Control': 'no-store',
//         },
//       });
//     }
//   }

//   // ── Auth route guard ─────────────────────────────────────────────────────
//   const token = cookies.get('access_token')?.value;

//   const isPortalRoute = PORTAL_ROUTES.some((path) => pathname.startsWith(path));
//   const isAuthRoute = pathname.startsWith('/login');

//   if (isPortalRoute && !token) {
//     const loginUrl = new URL('/login', request.url);
//     loginUrl.searchParams.set('returnUrl', pathname);
//     return NextResponse.redirect(loginUrl);
//   }

//   if (isAuthRoute && token) {
//     return NextResponse.redirect(new URL('/dashboard', request.url));
//   }

//   // ── CHOS-303: Pass real client IP from Cloudflare to Next.js ────────────
//   // CF-Connecting-IP is set by Cloudflare and cannot be spoofed by clients.
//   // Forward it as X-Real-IP so Next.js logging/rate-limit middleware sees the
//   // true client IP rather than the Cloudflare edge IP.
//   const cfConnectingIp = request.headers.get('cf-connecting-ip');
//   if (cfConnectingIp) {
//     const response = NextResponse.next();
//     response.headers.set('x-real-ip', cfConnectingIp);
//     return response;
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
// };

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PORTAL_ROUTES = [
  '/dashboard',
  '/events',
  '/sports',
  '/organizations',
  '/users',
  '/cards',
  '/reports',
  '/participation',
  '/register',
  '/by-number',
  '/by-category',
  '/by-sport',
  '/leader-registration',
  '/registrations',
];

export function proxy(request: NextRequest) {
  const { nextUrl, cookies } = request;
  const token = cookies.get('access_token')?.value;

  const isPortalRoute = PORTAL_ROUTES.some((path) => nextUrl.pathname.startsWith(path));
  const isAuthRoute = nextUrl.pathname.startsWith('/login');

  if (isPortalRoute && !token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
