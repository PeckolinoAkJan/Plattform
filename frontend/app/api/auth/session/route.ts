import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'vtc_session';

type SessionPayload = {
  token?: string;
  returnTo?: string | null;
};

function sanitizeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) {
    return '/dashboard';
  }
  if (!returnTo.startsWith('/')) {
    return '/dashboard';
  }
  if (returnTo.startsWith('//') || returnTo.startsWith('/api/')) {
    return '/dashboard';
  }

  return returnTo;
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => ({}))) as SessionPayload;

  if (typeof payload.token !== 'string' || payload.token.length < 10) {
    return NextResponse.json({ message: 'Invalid token.' }, { status: 400 });
  }

  const response = NextResponse.json({
    ok: true,
    returnTo: sanitizeReturnTo(payload.returnTo),
  });

  response.cookies.set(COOKIE_NAME, payload.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });

  return response;
}

