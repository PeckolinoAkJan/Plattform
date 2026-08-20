import { NextRequest, NextResponse } from 'next/server';

const DASHBOARD_PATH = '/dashboard';
const SESSION_COOKIE = 'vtc_session';
const LOGIN_PATH = '/login';

function normalizeReturnTo(returnTo: string | null): string {
  if (!returnTo) {
    return '/dashboard';
  }

  try {
    if (!returnTo.startsWith('/')) {
      return '/dashboard';
    }

    if (returnTo.startsWith('//') || returnTo.startsWith('/api/')) {
      return '/dashboard';
    }

    return returnTo;
  } catch {
    return '/dashboard';
  }
}

function getPublicOrigin(req: NextRequest): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      // Fall through to the reverse-proxy headers when configuration is invalid.
    }
  }

  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedHost) {
    const forwardedProtocol = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https';
    return `${forwardedProtocol}://${forwardedHost}`;
  }

  return req.nextUrl.origin;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtectedArea = pathname.startsWith(DASHBOARD_PATH);
  const hasAuthCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (!isProtectedArea || hasAuthCookie) {
    return NextResponse.next();
  }

  const loginUrl = new URL(LOGIN_PATH, getPublicOrigin(req));
  loginUrl.searchParams.set('returnTo', normalizeReturnTo(`${pathname}${req.nextUrl.search}`));

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
