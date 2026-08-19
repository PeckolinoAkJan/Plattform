'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { companyApi } from '../../../lib/api';
import dynamic from 'next/dynamic';
import ScrollReveal from '../../../components/marketing/scroll-reveal';
import { createTelemetryContext, type TelemetryRoomContext } from '../../../lib/telemetry-socket';
import { useSearchParams } from 'next/navigation';

const LiveMap = dynamic(() => import('../../../components/telemetry/LiveMap'), { ssr: false });

const COMPANY_ID_KEY = 'vtc_active_company_id';
const COMPANY_CHANGED_EVENT = 'vtc:company-changed';
const AUTH_CHANGED_EVENT = 'vtc:auth-changed';
const AUTH_EXPIRED_EVENT = 'vtc:auth-expired';
const ROOM_REFRESH_MS = 420;
const LIVE_MAP_SIMULATION_PARAM_KEYS = ['loadProbe', 'sim', 'probe'];
const LIVE_MAP_SIMULATION_VALUES = new Set([500, 1000, 3000]);

function normalizeCompanyId(raw: string | null | undefined) {
  if (!raw) {
    return null;
  }

  const value = raw.trim();
  if (!value.length) {
    return null;
  }

  return value;
}

async function resolveCompanyFromSession() {
  try {
    const company = await companyApi.get();
    if (company?.id) {
      return company.id;
    }
  } catch {
    // fallback to local cache below
  }

  if (typeof window === 'undefined') {
    return null;
  }

  const fallback = window.localStorage.getItem(COMPANY_ID_KEY);
  return normalizeCompanyId(fallback);
}

function DashboardMapContent() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [roomContext, setRoomContext] = useState<TelemetryRoomContext>(() => createTelemetryContext(null));
  const [roomLoadState, setRoomLoadState] = useState<'loading' | 'ok' | 'fallback'>('loading');
  const [isWindowVisible, setWindowVisible] = useState(true);
  const searchParams = useSearchParams();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationDriverCount = useMemo(() => {
    for (const key of LIVE_MAP_SIMULATION_PARAM_KEYS) {
      const raw = searchParams.get(key);
      if (!raw) {
        continue;
      }

      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        continue;
      }

      if (!LIVE_MAP_SIMULATION_VALUES.has(parsed)) {
        continue;
      }

      return parsed;
    }

    return null;
  }, [searchParams]);

  const scheduleRefresh = () => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }

    refreshTimer.current = setTimeout(() => {
      refreshRoomContext();
    }, ROOM_REFRESH_MS);
  };

  const refreshRoomContext = async () => {
    const next = await resolveCompanyFromSession();
    const nextContext = createTelemetryContext(next);

    setCompanyId(next);
    setRoomContext(nextContext);
    setRoomLoadState(next ? 'ok' : 'fallback');
  };

  useEffect(() => {
    let mounted = true;

    const loadInitial = async () => {
      const next = await resolveCompanyFromSession();
      if (!mounted) return;
      setCompanyId(next);
      setRoomContext(createTelemetryContext(next));
      setRoomLoadState(next ? 'ok' : 'fallback');
    };

    loadInitial();

    const onStorage = (event: StorageEvent) => {
      if (event.key === COMPANY_ID_KEY) {
        scheduleRefresh();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        setWindowVisible(false);
        return;
      }

      setWindowVisible(true);
      scheduleRefresh();
    };

    const onCompanyChanged = () => scheduleRefresh();
    const onAuthChanged = () => scheduleRefresh();
    const onAuthExpired = () => scheduleRefresh();

    window.addEventListener('storage', onStorage);
    window.addEventListener(COMPANY_CHANGED_EVENT, onCompanyChanged);
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      mounted = false;
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(COMPANY_CHANGED_EVENT, onCompanyChanged);
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  const statusText =
    roomLoadState === 'loading'
      ? 'Lade Sitzungs-Kontext…'
      : roomLoadState === 'fallback'
        ? 'Fallback: Lokaler Cache ohne aktive Session'
        : 'Session aktiv';

  return (
    <section className="space-y-4">
      <ScrollReveal>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold-300">Live Operations</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Live-Karte</h1>
          <p className="mt-1 text-sm text-gold-100/80">
            Raum-basierte Telemetrie. Raum/Company wird aus der aktiven Session ermittelt.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delayMs={90}>
        <div className="rounded-2xl border border-gold-700/45 bg-ink-900/65 p-3 shadow-glass sm:p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-gold-300">Quelle</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-gold-700/40 px-3 py-1.5 text-gold-100">Raum: {roomContext.roomLabel}</span>
            {simulationDriverCount ? (
              <span className="rounded-full border border-gold-500/70 bg-gold-500/12 px-3 py-1.5 text-[11px] text-gold-100">
                Lastprobe: {simulationDriverCount} Fahrer
              </span>
            ) : null}
            <span className="inline-flex items-center gap-2 rounded-full border border-ink-700/60 bg-ink-950/80 px-2.5 py-1.5 text-xs text-gold-200/90">
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {statusText}
            </span>
            <span className="inline-flex items-center rounded-full border border-gold-700/40 px-2.5 py-1 text-[11px] text-gold-200/90">
              Tab: {isWindowVisible ? 'aktiv' : 'im Hintergrund'}
            </span>
          </div>
        </div>
      </ScrollReveal>

      <LiveMap companyId={companyId} simulationDriverCount={simulationDriverCount} />
    </section>
  );
}

export default function DashboardMapPage() {
  return (
    <Suspense fallback={<div className="h-[70vh] rounded-2xl border border-gold-700/45 bg-ink-900/65" />}>
      <DashboardMapContent />
    </Suspense>
  );
}

