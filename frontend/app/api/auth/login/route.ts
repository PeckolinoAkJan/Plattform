import { NextRequest, NextResponse } from 'next/server';

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

type LoginBody = {
  email: string;
  password: string;
  returnTo?: string | null;
};

function sanitizeReturnTo(returnTo: string | null | undefined): string {
  if (!returnTo) return '/dashboard';
  if (!returnTo.startsWith('/')) return '/dashboard';
  if (returnTo.startsWith('//') || returnTo.startsWith('/api/')) return '/dashboard';
  return returnTo;
}

export async function POST(req: NextRequest) {
  const body: LoginBody = await req.json();

  const upstream = await fetch(`${BACKEND_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: body.email,
      password: body.password,
    }),
  });

  const rawText = await upstream.text();
  const upstreamPayload = (() => {
    try {
      return rawText ? JSON.parse(rawText) : {};
    } catch {
      return { message: rawText || 'Ungültige Server-Antwort.' };
    }
  })();

  if (!upstream.ok) {
    return NextResponse.json(upstreamPayload, { status: upstream.status });
  }

  const token =
    upstreamPayload.accessToken ??
    upstreamPayload.token ??
    upstreamPayload.data?.accessToken ??
    upstreamPayload.data?.token;

  if (!token) {
    return NextResponse.json({ message: 'Login response does not contain a token.' }, { status: 502 });
  }

  const response = NextResponse.json({
    ...upstreamPayload,
    returnTo: sanitizeReturnTo(body.returnTo),
    token,
  });

  response.cookies.set('vtc_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24,
  });

  return response;
}
