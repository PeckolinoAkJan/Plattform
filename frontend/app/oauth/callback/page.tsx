'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function sanitizeReturnTo(returnTo: string | null): string {
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

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const syncSession = async () => {
      if (!token) {
        router.replace(returnTo);
        return;
      }

      const sessionResponse = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          returnTo,
        }),
      });

      if (!sessionResponse.ok) {
        setError('Session konnte nicht hergestellt werden.');
        return;
      }

      window.dispatchEvent(new Event('vtc:auth-changed'));
      router.replace(returnTo);
    };

    syncSession();
  }, [returnTo, router, token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6 text-white">
      <div className="rounded-2xl border border-gold-700/45 bg-ink-900/80 p-6 text-center shadow-glass">
        {error ? <p className="text-sm text-red-200">{error}</p> : <p className="text-sm text-gold-100">OAuth-Login wird abgeschlossen ...</p>}
      </div>
    </main>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-ink-950" />}>
      <OAuthCallbackContent />
    </Suspense>
  );
}
