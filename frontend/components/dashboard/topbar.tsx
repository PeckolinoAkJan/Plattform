'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { removeStoredAuthToken } from '../../lib/auth-client';
import BrandMark from '../marketing/brand-mark';

type TopbarProps = {
  onOpenSidebar: () => void;
};

export default function Topbar({ onOpenSidebar }: TopbarProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onLogout = async () => {
    setLoading(true);
    removeStoredAuthToken();
    await fetch('/api/auth/logout', { method: 'POST' });
    window.dispatchEvent(new Event('vtc:auth-changed'));
    window.location.assign('/login');
    setLoading(false);
  };

  return (
    <header className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-[1.4rem] border border-gold-700/45 bg-ink-900/60 px-3 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur sm:px-4">
      <div className="min-w-0 flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="vtc-touch-target inline-flex w-11 items-center justify-center rounded-lg border border-gold-700/45 bg-ink-950/60 text-sm text-gold-100 transition hover:border-gold-400/50 hover:bg-gold-500/12 md:hidden"
          aria-label="Navigation öffnen"
        >
          ≡
        </button>
        <BrandMark
          size={32}
          withWordmark
          variant="logo"
          href="/dashboard"
          ariaLabel="VTC Hub Dashboard"
          className="max-w-full"
        />
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.3em] text-gold-300/85 sm:text-xs">Operations Hub</p>
          <h1 className="truncate text-sm font-semibold text-white sm:text-lg">Dashboard</h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <button
          className="interactive-focus relative inline-flex min-h-11 min-w-9 items-center justify-center rounded-lg border border-gold-400/20 bg-ink-900/40 px-3 py-2 text-xs font-semibold text-gold-100 transition hover:bg-ink-900/60 sm:text-sm"
          aria-label="Benachrichtigungen"
        >
          <span className="hidden sm:inline">Benachrichtigungen</span>
          <span className="sm:hidden">🔔</span>
          <span className="absolute right-2 top-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />
        </button>

        <Link
          href="/dashboard/profile"
          className="interactive-focus inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold-400/40 bg-gradient-to-br from-gold-500 to-gold-700 text-sm font-bold text-ink-950 shadow-goldPulse"
          aria-label="Profil"
        >
          U
        </Link>

        <button
          onClick={onLogout}
          disabled={loading}
          className="interactive-focus inline-flex min-h-11 items-center rounded-lg border border-gold-500/40 bg-gold-500/15 px-3 py-2 text-sm font-semibold text-gold-100 transition hover:bg-gold-500/25 disabled:opacity-60 sm:px-4"
        >
          {loading ? 'Abmelden…' : 'Logout'}
        </button>
      </div>
    </header>
  );
}
