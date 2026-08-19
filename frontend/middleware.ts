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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtectedArea = pathname.startsWith(DASHBOARD_PATH);
  const hasAuthCookie = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (!isProtectedArea || hasAuthCookie) {
    return NextResponse.next();
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = LOGIN_PATH;
  loginUrl.searchParams.set('returnTo', normalizeReturnTo(`${pathname}${req.nextUrl.search}`));

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
