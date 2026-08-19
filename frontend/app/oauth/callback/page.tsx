'use client';

import { Suspense, useEffect } from 'react';
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
  const returnTo = sanitizeReturnTo(searchParams.get('returnTo'));

  useEffect(() => {
    router.replace(returnTo);
  }, [returnTo, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-950 px-6 text-white">
      <div className="rounded-2xl border border-gold-700/45 bg-ink-900/80 p-6 text-center shadow-glass">
        <p className="text-sm text-gold-100">OAuth-Login wird abgeschlossen ...</p>
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
