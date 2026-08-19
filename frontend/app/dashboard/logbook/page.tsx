'use client';

import { useEffect, useMemo, useState } from 'react';
import ScrollReveal from '../../../components/marketing/scroll-reveal';
import { getLogbookEntries, type LogbookEntry } from '../../../lib/api';

type EnrichedLogbookEntry = LogbookEntry & {
  totalKm: number;
  formattedDate: string;
  title: string;
};

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

function toDateLabel(input: string | undefined | null): string {
  if (!input) {
    return '—';
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('de-DE');
}

function normalizeText(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : '—';
}

function enrichTrips(entries: LogbookEntry[]): EnrichedLogbookEntry[] {
  return entries.map((entry) => ({
    ...entry,
    totalKm: toNumber(entry.distanceKm),
    formattedDate: toDateLabel(entry.createdAt ?? entry.startTs),
    title: `${normalizeText(entry.cargo)} • ${normalizeText(entry.truckModel)}`,
  }));
}

export default function LogbookPage() {
  const [entries, setEntries] = useState<EnrichedLogbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const next = await getLogbookEntries();
        if (!mounted) {
          return;
        }

        setEntries(enrichTrips(next ?? []));
      } catch {
        if (mounted) {
          setError('Fahrten konnten nicht geladen werden.');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const totalDistance = useMemo(() => entries.reduce((acc, entry) => acc + entry.totalKm, 0), [entries]);
  const totalTrips = entries.length;
  const validTrips = entries.filter((entry) => entry.isValidForScore).length;

  return (
    <div className="space-y-5">
      <ScrollReveal>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold-300">Fahrten Management</p>
          <h1 className="mt-1 text-3xl font-semibold text-white">Fahrtenbuch</h1>
          <p className="mt-2 text-sm text-gold-100/85">
            Live-basierte Historie der abgeschlossenen Touren.
          </p>
        </div>
      </ScrollReveal>

      <section className="grid gap-4 md:grid-cols-3">
        <ScrollReveal delayMs={50}>
          <article className="rounded-2xl border border-ink-700/65 bg-ink-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-300">Fahrten gesamt</p>
            <p className="mt-2 text-2xl font-semibold text-white">{loading ? '—' : totalTrips}</p>
          </article>
        </ScrollReveal>
        <ScrollReveal delayMs={80}>
          <article className="rounded-2xl border border-ink-700/65 bg-ink-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-300">Validierte Fahrten</p>
            <p className="mt-2 text-2xl font-semibold text-white">{loading ? '—' : validTrips}</p>
          </article>
        </ScrollReveal>
        <ScrollReveal delayMs={110}>
          <article className="rounded-2xl border border-ink-700/65 bg-ink-900/70 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-gold-300">Gefahrene Kilometer</p>
            <p className="mt-2 text-2xl font-semibold text-white">{loading ? '—' : `${Math.round(totalDistance).toLocaleString('de-DE')} km`}</p>
          </article>
        </ScrollReveal>
      </section>

      {error ? (
        <ScrollReveal>
          <p className="rounded-lg border border-amber-500/40 bg-amber-900/20 px-3 py-2 text-sm text-amber-100/90">
            {error}
          </p>
        </ScrollReveal>
      ) : null}

      <ScrollReveal delayMs={130}>
        <section className="overflow-hidden rounded-2xl border border-gold-700/55 bg-ink-900/70">
          {loading ? (
            <div className="p-5 text-sm text-gold-200/85">Lade Fahrten…</div>
          ) : entries.length === 0 ? (
            <div className="p-5 text-sm text-gold-200/85">Noch keine Fahrten vorhanden.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-ink-700/70 bg-ink-950/65 text-gold-100">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Datum</th>
                    <th className="px-4 py-3 text-left font-medium">Routeninfo</th>
                    <th className="px-4 py-3 text-left font-medium">Straße</th>
                    <th className="px-4 py-3 text-left font-medium">KM</th>
                    <th className="px-4 py-3 text-left font-medium">Spiel</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-ink-700/40 last:border-b-0">
                      <td className="px-4 py-3 text-gold-100/90">{entry.formattedDate}</td>
                      <td className="px-4 py-3 text-white">{entry.title}</td>
                      <td className="px-4 py-3 text-gold-200/90">
                        {normalizeText(entry.sourceCity)} → {normalizeText(entry.destinationCity)}
                      </td>
                      <td className="px-4 py-3 text-gold-100/95">{Math.round(entry.totalKm)} km</td>
                      <td className="px-4 py-3 text-gold-200/85">{entry.game}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full border px-2 py-1 text-xs ${
                            entry.isWotr
                              ? 'border-amber-400/50 bg-amber-900/25 text-amber-200'
                              : entry.isValidForScore
                                ? 'border-emerald-400/50 bg-emerald-900/25 text-emerald-200'
                                : 'border-red-400/50 bg-red-900/25 text-red-200'
                          }`}
                        >
                          {entry.isWotr ? 'WOTR' : entry.isValidForScore ? 'Validiert' : 'Nicht gültig'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </ScrollReveal>
    </div>
  );
}
