import { NextResponse } from 'next/server';

const SESSION_COOKIE_DOMAIN = process.env.SESSION_COOKIE_DOMAIN?.trim() || undefined;

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set({
    name: 'vtc_session',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: SESSION_COOKIE_DOMAIN,
    path: '/',
    maxAge: 0,
  });

  return response;
}
