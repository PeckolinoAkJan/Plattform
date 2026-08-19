'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import BrandMark from '../../components/marketing/brand-mark';
import SiteHeader from '../../components/marketing/site-header';
import ScrollReveal from '../../components/marketing/scroll-reveal';
import { buildRouteJsonLd } from '../../lib/seo/schema';

type UnknownRecord = Record<string, unknown>;

const COMPANY_ID_KEY = 'vtc_active_company_id';
const COMPANY_CHANGED_EVENT = 'vtc:company-changed';

const loginSteps = ['Sicheres Login', 'Zugriff in Sekunden', 'Dashboard sofort bereit', 'Live-Telemetrie aktiv'];
const BACKEND_API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

function setActiveCompanyId(payload: UnknownRecord | null | undefined) {
  const candidates = [
    (payload as UnknownRecord)?.companyId as string | undefined,
    ((payload as UnknownRecord)?.user as UnknownRecord | undefined)?.companyId as string | undefined,
    (((payload as UnknownRecord)?.user as UnknownRecord | undefined)?.company as UnknownRecord | undefined)?.id as string | undefined,
    ((payload as UnknownRecord)?.data as UnknownRecord | undefined)?.companyId as string | undefined,
    (((payload as UnknownRecord)?.data as UnknownRecord | undefined)?.user as UnknownRecord | undefined)?.companyId as string | undefined,
  ];

  const activeCompanyId = candidates.find((item) => typeof item === 'string' && item.trim().length > 0);
  if (!activeCompanyId || typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(COMPANY_ID_KEY, activeCompanyId);
  window.dispatchEvent(new Event(COMPANY_CHANGED_EVENT));
}

function sanitizeReturnTo(returnTo: string | null): string {
  if (!returnTo) return '/dashboard';
  if (!returnTo.startsWith('/')) return '/dashboard';
  if (returnTo.startsWith('//') || returnTo.startsWith('/api/')) return '/dashboard';
  return returnTo;
}

const providerClassMap: Record<string, string> = {
  google: 'bg-white text-ink-950 hover:bg-gray-100',
  steam: 'bg-[#1b2838] text-white hover:bg-[#243447]',
  discord: 'bg-[#5865f2] text-white hover:bg-[#4752c4]',
};

const providerButtons = [
  { id: 'google', label: 'Mit Google fortfahren' },
  { id: 'discord', label: 'Mit Discord fortfahren' },
  { id: 'steam', label: 'Mit Steam fortfahren' },
] as const;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnToParam = searchParams.get('returnTo');
  const defaultReturnTo = sanitizeReturnTo(returnToParam);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [providerAvailability, setProviderAvailability] = useState<Partial<Record<(typeof providerButtons)[number]['id'], boolean>> | null>(null);
  const routeJsonLd = buildRouteJsonLd({
    title: 'VTC Hub – Login',
    description: 'Sichere Anmeldung beim VTC Hub Dashboard für Fahrer und Speditionen.',
    path: '/login',
    section: 'Login',
    sectionPath: '/login',
    breadcrumbs: [
      { name: 'Startseite', path: '/' },
      { name: 'Login', path: '/login' },
    ],
  });

  useEffect(() => {
    let active = true;
    fetch(`${BACKEND_API_BASE}/api/auth/providers`, { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((providers) => { if (active && providers) setProviderAvailability(providers); })
      .catch(() => { if (active) setProviderAvailability({}); });
    return () => { active = false; };
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnTo: defaultReturnTo,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload) {
      setError(payload?.message || 'Login fehlgeschlagen. Bitte prüfe deine Zugangsdaten.');
      setLoading(false);
      return;
    }

    setActiveCompanyId(payload);

    router.push(sanitizeReturnTo(payload.returnTo || defaultReturnTo));
    setLoading(false);
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-14 top-[-22rem] h-[430px] w-[430px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(244,206,103,0.2),_transparent_55%)]" />
        <div className="absolute -right-24 top-28 h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.18),_transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:88px_88px] opacity-10" />
      </div>

      <SiteHeader compact className="max-h-16 px-4 py-3 sm:px-6" />

      <ScrollReveal className="vtc-shell relative z-10">
        <section className="mx-auto flex min-h-[calc(100svh-4.5rem)] w-full flex-col items-center gap-8 pb-10 pt-6 md:flex-row md:items-stretch md:gap-10">
          <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <article className="rounded-[1.8rem] border border-gold-700/45 bg-[linear-gradient(165deg,#0a0a10_0%,#111218_45%,#161320_100%)] p-1 shadow-glass">
              <div className="rounded-[calc(1.8rem-4px)] border border-gold-800/35 bg-ink-950/85 px-5 py-7 sm:px-7 sm:py-8 lg:px-10">
                <div className="mb-6 flex items-center gap-3">
                  <BrandMark size={40} withWordmark variant="logo" />
                </div>

                <p className="text-xs uppercase tracking-[0.28em] text-gold-300">Driver &amp; Dispatcher Portal</p>
                <h1 className="mt-2 text-2xl font-semibold leading-tight text-white sm:text-4xl">Anmelden und direkt loslegen</h1>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-gold-100/85">
                  Dein Zugang zur Live-Operations-Konsole für ETS2 &amp; ATS.
                </p>

                <ul className="mt-6 grid gap-2">
                  {loginSteps.map((step) => (
                    <li key={step} className="flex items-start gap-2 rounded-lg border border-ink-700/40 bg-ink-900/70 p-3 text-sm text-gold-100/90">
                      <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-gold-400" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </article>

            <article className="self-start rounded-[1.8rem] border border-gold-700/50 bg-ink-900/70 p-1 shadow-glass">
              <div className="rounded-[calc(1.8rem-4px)] border border-gold-800/35 bg-ink-950/85 px-5 py-7 sm:px-8">
                <h2 className="text-2xl font-semibold text-white">Login</h2>
                <p className="mt-2 text-sm text-gold-100/85">Sichere Anmeldung über dein VTC-Konto</p>

                {error ? <p className="mt-4 rounded border border-red-500/25 bg-red-900/20 px-3 py-2 text-sm text-red-200">{error}</p> : null}

                <form onSubmit={onSubmit} className="mt-6 space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">E-Mail</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="interactive-focus w-full min-h-11 rounded-xl border border-gold-700/45 bg-ink-950/80 px-3 py-3 text-sm text-white outline-none ring-gold-500/20 placeholder:text-gold-100/35 transition placeholder:font-normal focus:border-gold-400/90 focus:ring-2 focus:ring-gold-400/30"
                      placeholder="user@company.com"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs uppercase tracking-[0.2em] text-gold-300/80">Passwort</span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      className="interactive-focus w-full min-h-11 rounded-xl border border-gold-700/45 bg-ink-950/80 px-3 py-3 text-sm text-white outline-none ring-gold-500/20 placeholder:text-gold-100/35 transition placeholder:font-normal focus:border-gold-400/90 focus:ring-2 focus:ring-gold-400/30"
                      placeholder="********"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="interactive-focus btn-micro-glide mt-3 inline-flex w-full min-h-11 justify-center rounded-xl bg-gold-500 px-4 py-3 text-sm font-semibold text-ink-950 shadow-goldPulse transition hover:bg-gold-400 disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {loading ? 'Anmeldung...' : 'Login'}
                  </button>
                </form>

                <div className="mt-6 border-t border-gold-800/45 pt-5">
                  <p className="text-sm text-gold-100/80">
                    Noch kein Account?{' '}
                    <Link href="/" className="btn-micro-glide inline-flex rounded-md px-2 py-1 font-semibold text-gold-200 hover:text-gold-100">
                      Zurück zur Startseite
                    </Link>
                  </p>
                </div>

                <div className="mt-6 space-y-2 border-t border-gold-800/45 pt-5">
                  <p className="text-sm text-gold-100/80">Oder direkt mit deinem Account fortfahren:</p>
                  <div className="grid gap-2">
                    {providerButtons.map((provider) => {
                      const enabled = providerAvailability?.[provider.id] === true;
                      return enabled ? (
                        <a
                          key={provider.id}
                          href={`${BACKEND_API_BASE}/api/auth/${provider.id}/login?returnTo=${encodeURIComponent(defaultReturnTo)}`}
                          className={`interactive-focus inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold transition ${providerClassMap[provider.id]}`}
                        >
                          {provider.label}
                        </a>
                      ) : (
                        <button
                          key={provider.id}
                          type="button"
                          disabled
                          className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-sm font-semibold text-gold-100/45"
                        >
                          {provider.label} - noch nicht konfiguriert
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="relative z-10 mx-auto mt-3 hidden max-w-[1320px] px-4 pb-12 sm:px-6 lg:block">
          <div className="rounded-[1.3rem] border border-gold-800/35 bg-ink-900/60 p-3">
            <div className="overflow-hidden rounded-xl border border-gold-700/25">
              <Image
                src="/vtc-hub-hero.png"
                alt="VTC Hub visuelle Vorschau"
                width={1672}
                height={941}
                className="h-auto w-full object-cover"
                priority={false}
              />
            </div>
          </div>
        </section>
      </ScrollReveal>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: routeJsonLd,
        }}
      />
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-ink-950" />}>
      <LoginContent />
    </Suspense>
  );
}
