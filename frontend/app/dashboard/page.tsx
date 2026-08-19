'use client';

import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, TooltipProps, XAxis, YAxis } from 'recharts';
import CountUp from '../../components/marketing/count-up';
import ScrollReveal from '../../components/marketing/scroll-reveal';
import { type LogbookEntry, getLogbookEntries } from '../../lib/api';

type DailyKmPoint = {
  label: string;
  date: string;
  km: number;
};

type ParsedMetric = {
  distanceKm: number;
  revenue: number;
  truckModel: string;
};

const FALLBACK_TRUCK = 'Noch nicht gesetzt';
const STALE_TIMEOUT_MS = 10000;

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getPayloadNumber(payload: Record<string, unknown> | undefined, keys: string[]): number {
  if (!payload) {
    return 0;
  }

  for (const key of keys) {
    if (key in payload && (payload as Record<string, unknown>)[key] !== undefined) {
      const value = (payload as Record<string, unknown>)[key];
      const number = toNumber(value);
      if (number > 0 || number === 0) {
        return number;
      }
    }
  }

  return 0;
}

function getPayloadNumberWithFallback(entry: Record<string, unknown>, fallbackKeys: string[]): number {
  return getPayloadNumber(entry, fallbackKeys);
}

function getPayloadText(payload: Record<string, unknown> | undefined, keys: string[]): string {
  if (!payload) {
    return '';
  }

  for (const key of keys) {
    if (key in payload && typeof payload[key] === 'string') {
      return payload[key] as string;
    }
  }

  return '';
}

function getTripDate(entry: LogbookEntry): Date {
  const payload = entry.payload as Record<string, unknown> | undefined;
  const entryValues = entry as Record<string, unknown>;

  const source =
    (typeof entryValues.createdAt === 'string' && entryValues.createdAt) ||
    (typeof entryValues.startTs === 'string' && entryValues.startTs) ||
    getPayloadText(payload, ['createdAt', 'date', 'tripDate', 'startedAt']);

  const parsed = source ? new Date(source) : new Date();

  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function formatAxisLabel(index: number, dateString: string) {
  if (index === 0 || index === 3 || index === 6) {
    const date = new Date(dateString);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('de-DE', { weekday: 'short' });
  }

  return '';
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const entry = payload[0];
  const value = typeof entry.value === 'number' ? Math.round(entry.value * 10) / 10 : 0;

  return (
    <div className="rounded-xl border border-gold-700/40 bg-ink-900/95 px-4 py-3 text-sm shadow-lg shadow-black/40 backdrop-blur">
      <p className="text-xs uppercase tracking-[0.24em] text-gold-200/80">{label}</p>
      <p className="mt-1 text-gold-300">
        <span className="font-medium text-gold-200">Kilometer: </span>
        {value.toLocaleString('de-DE')} km
      </p>
    </div>
  );
}

function createSevenDaySeries(entries: (LogbookEntry & { metrics: ParsedMetric })[]) {
  const today = new Date();
  const points: DailyKmPoint[] = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - offset));
    const dayIso = date.toISOString().slice(0, 10);

    return {
      label: formatAxisLabel(offset, dayIso),
      date: dayIso,
      km: 0,
    };
  });

  for (const trip of entries) {
    const tripDate = getTripDate(trip).toISOString().slice(0, 10);
    const idx = points.findIndex((point) => point.date === tripDate);
    if (idx >= 0) {
      points[idx].km += trip.metrics.distanceKm;
    }
  }

  return points;
}

export default function DashboardPage() {
  const [logbook, setLogbook] = useState<LogbookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const logbookResponse = await getLogbookEntries();
      setLogbook(logbookResponse);
      setIsLoading(false);
    };

    const timer = window.setTimeout(() => {
      setIsLoading(false);
    }, STALE_TIMEOUT_MS);

    load().finally(() => window.clearTimeout(timer));
  }, []);

  const parsedTrips = logbook.map((trip): LogbookEntry & { metrics: ParsedMetric } => {
    const payload = trip.payload as Record<string, unknown> | undefined;
    const fallbackDistance = getPayloadNumber(payload, ['distanceKm', 'distance', 'km', 'lengthKm']);
    const fallbackTruck = getPayloadText(payload, ['truckModel', 'vehicleModel', 'truck', 'truck_name', 'vehicle']);
    const distanceKm =
      fallbackDistance > 0 || fallbackDistance === 0 ? fallbackDistance : getPayloadNumberWithFallback(trip as unknown as Record<string, unknown>, ['distanceKm']);
    const truckModel =
      fallbackTruck || getPayloadText(trip as unknown as Record<string, unknown>, ['truckModel']);

    const revenue = getPayloadNumber(payload, ['revenue', 'income', 'earnings', 'earn']);
    const resolvedRevenue = revenue > 0 || revenue === 0 ? revenue : 0;

    return {
      ...trip,
      metrics: {
        distanceKm,
        revenue: resolvedRevenue,
        truckModel: truckModel || FALLBACK_TRUCK,
      },
    };
  });

  const totalKm = parsedTrips.reduce((acc, trip) => acc + trip.metrics.distanceKm, 0);
  const totalRevenue = parsedTrips.reduce((acc, trip) => acc + trip.metrics.revenue, 0);
  const tripsCount = parsedTrips.length;
  const currentTruck =
    parsedTrips
      .slice()
      .reverse()
      .find((trip) => trip.metrics.truckModel !== FALLBACK_TRUCK)?.metrics.truckModel ?? FALLBACK_TRUCK;

  const series = createSevenDaySeries(parsedTrips);

  return (
    <div className="space-y-6">
      <ScrollReveal className="space-y-2 mb-2">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Performance-Übersicht</h1>
        <p className="text-sm text-gold-200/80">
          Premium-Dashboard mit Fokus auf den wichtigsten Kennzahlen der letzten Fahrten.
        </p>
      </ScrollReveal>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ScrollReveal delayMs={40}>
          <article className="group rounded-2xl border border-ink-700/70 bg-ink-900/70 p-5 shadow-sm shadow-black/40 transition duration-300 hover:shadow-glowGold">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.26em] text-gold-300/80">Gefahrene KM</p>
              <span className="rounded-md border border-gold-700/40 bg-gold-900/40 px-2.5 py-1 text-xs text-gold-200">+</span>
            </div>
            <p className="mt-4 text-4xl font-semibold text-white">
              {isLoading ? '...' : <CountUp end={Math.round(totalKm)} suffix=" km" startDelayMs={80} />}
            </p>
            <p className="mt-2 text-sm text-gold-200/80">Gesamt im verfügbaren Zeitraum</p>
          </article>
        </ScrollReveal>

        <ScrollReveal delayMs={120}>
          <article className="group rounded-2xl border border-ink-700/70 bg-ink-900/70 p-5 shadow-sm shadow-black/40 transition duration-300 hover:shadow-glowGold">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.26em] text-gold-300/80">Anzahl Touren</p>
              <span className="rounded-md border border-gold-700/40 bg-gold-900/40 px-2.5 py-1 text-xs text-gold-200">🚛</span>
            </div>
            <p className="mt-4 text-4xl font-semibold text-white">
              {isLoading ? '...' : <CountUp end={tripsCount} startDelayMs={120} />}
            </p>
            <p className="mt-2 text-sm text-gold-200/80">Abgeschlossene Routen</p>
          </article>
        </ScrollReveal>

        <ScrollReveal delayMs={180}>
          <article className="group rounded-2xl border border-ink-700/70 bg-ink-900/70 p-5 shadow-sm shadow-black/40 transition duration-300 hover:shadow-glowGold">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.26em] text-gold-300/80">Umsatz</p>
              <span className="rounded-md border border-gold-700/40 bg-gold-900/40 px-2.5 py-1 text-xs text-gold-200">💶</span>
            </div>
            <p className="mt-4 text-4xl font-semibold text-white">
              {isLoading ? '...' : <CountUp end={Math.round(totalRevenue)} suffix=" €" startDelayMs={160} />}
            </p>
            <p className="mt-2 text-sm text-gold-200/80">Gesamtumsatz (sichtbar)</p>
          </article>
        </ScrollReveal>

        <ScrollReveal delayMs={240}>
          <article className="group rounded-2xl border border-ink-700/70 bg-ink-900/70 p-5 shadow-sm shadow-black/40 transition duration-300 hover:shadow-glowGold">
            <div className="flex items-center justify-between">
              <p className="text-sm uppercase tracking-[0.26em] text-gold-300/80">Aktueller Truck</p>
              <span className="rounded-md border border-gold-700/40 bg-gold-900/40 px-2.5 py-1 text-xs text-gold-200">🛻</span>
            </div>
            <p className="mt-4 text-xl font-medium text-white" title={currentTruck}>
              {isLoading ? '...' : currentTruck}
            </p>
            <p className="mt-2 text-sm text-gold-200/80">Zuletzt geloggtes Fahrzeug</p>
          </article>
        </ScrollReveal>
      </section>

      <ScrollReveal delayMs={220}>
        <section className="rounded-3xl border border-ink-700/80 bg-ink-900/70 p-5 shadow-lg shadow-black/45">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-white">Kilometer der letzten 7 Tage</h2>
              <p className="mt-1 text-sm text-gold-200/80">Premium-Fokus auf Tendenz und Performance</p>
            </div>
            <span className="rounded-full border border-gold-700/50 bg-gold-900/30 px-3 py-1 text-xs font-medium text-gold-200">
              Live-Übersicht
            </span>
          </div>

          <div className="mt-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="kmFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="rgb(212 175 55)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="rgb(212 175 55)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="kmLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#F6CC2B" />
                    <stop offset="100%" stopColor="#D4AF37" />
                  </linearGradient>
                </defs>

                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" />
                <XAxis
                  dataKey="label"
                  stroke="#E6C56A"
                  tick={{ fill: '#e9d59f', fontSize: 12 }}
                  axisLine={{ stroke: '#3e3c41' }}
                />
                <YAxis
                  stroke="#E6C56A"
                  tick={{ fill: '#e9d59f', fontSize: 12 }}
                  axisLine={{ stroke: '#3e3c41' }}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#D4AF37', strokeWidth: 1 }} />
                <Line
                  type="monotone"
                  dataKey="km"
                  name="KM"
                  stroke="url(#kmLine)"
                  strokeWidth={3}
                  dot={{ fill: '#D4AF37', stroke: '#fffdf3', strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5, stroke: '#fffdf3', strokeWidth: 2, fill: '#D4AF37' }}
                />
                <Area dataKey="km" fill="url(#kmFill)" stroke="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </ScrollReveal>
    </div>
  );
}
