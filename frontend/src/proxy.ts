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

  const isPortalRoute = PORTAL_ROUTES.some(path =>
    nextUrl.pathname.startsWith(path)
  );
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
