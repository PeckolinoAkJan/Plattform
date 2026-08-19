'use client';

import { useEffect, useMemo, useState } from 'react';
import ScrollReveal from '../../../components/marketing/scroll-reveal';
import { type CtaSummaryPoint, fetchCtaSummary } from '../../../lib/analytics/cta';

function renderConfidenceLabel(confidence: 'low' | 'medium' | 'high') {
  if (confidence === 'high') {
    return 'hoch';
  }
  if (confidence === 'medium') {
    return 'mittel';
  }
  return 'niedrig';
}

export default function ExperimentsPage() {
  const [summary, setSummary] = useState<CtaSummaryPoint | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const result = await fetchCtaSummary();
      setSummary(result);
      setLoading(false);
    };

    void load();
  }, []);

  const locationRows = useMemo(() => {
    if (!summary) return [];

    return Object.entries(summary.byLocation).map(([location, data]) => ({
      location,
      view: data.view,
      click: data.click,
      total: data.view + data.click,
      ctr: data.view === 0 ? 0 : (data.click / data.view) * 100,
      locationCtr: summary.byLocationCtr[location]?.ctr ?? 0,
    }));
  }, [summary]);

  return (
    <main className="space-y-4">
      <ScrollReveal>
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold-300">Growth Setup</p>
          <h1 className="text-3xl font-semibold text-white">CTA-Experimente</h1>
          <p className="mt-2 text-sm text-gold-100/85">
            Live-Auswertung für A/B-Varianten, mit Entscheidungshilfe für die nächste Experiment-Phase.
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal delayMs={60}>
        <section className="rounded-2xl border border-gold-700/60 bg-ink-900/70 p-4">
          <h2 className="text-sm uppercase tracking-[0.24em] text-gold-300/80">Entscheidungsübersicht</h2>
          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-ink-700/70 bg-ink-950/50 p-3">
              <p className="text-gold-200/80">Events gesamt</p>
              <p className="mt-2 text-2xl font-semibold text-white">{loading ? '…' : summary?.total ?? 0}</p>
            </article>
            <article className="rounded-xl border border-ink-700/70 bg-ink-950/50 p-3">
              <p className="text-gold-200/80">Variante A</p>
              <p className="mt-2 text-2xl font-semibold text-white">{loading ? '…' : summary?.byVariant.A ?? 0}</p>
              <p className="mt-1 text-xs text-gold-200/80">Views/Interactions</p>
            </article>
            <article className="rounded-xl border border-ink-700/70 bg-ink-950/50 p-3">
              <p className="text-gold-200/80">Variante B</p>
              <p className="mt-2 text-2xl font-semibold text-white">{loading ? '…' : summary?.byVariant.B ?? 0}</p>
              <p className="mt-1 text-xs text-gold-200/80">Views/Interactions</p>
            </article>
            <article className="rounded-xl border border-ink-700/70 bg-ink-950/50 p-3">
              <p className="text-gold-200/80">Empfehlung</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {loading ? '…' : summary?.recommendation.bestVariant?.toUpperCase()}
              </p>
              <p className="mt-1 text-xs text-gold-200/80">
                {loading
                  ? '…'
                  : `${summary?.recommendation.reason} (Sicherheit: ${renderConfidenceLabel(summary?.recommendation.confidence ?? 'low')})`}
              </p>
            </article>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal delayMs={120}>
        <section className="rounded-2xl border border-gold-700/60 bg-ink-900/70 p-4">
          <h2 className="text-sm uppercase tracking-[0.24em] text-gold-300/80">Runbook</h2>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
            <article className="rounded-xl border border-gold-700/55 bg-gold-900/20 p-3">
              <p className="font-semibold text-gold-100">1) Beobachten</p>
              <p className="mt-2 text-xs text-gold-200/80">
                Positionen im Dashboard regelmäßig prüfen (View/Click-Verhältnis, CTR je Button).
              </p>
            </article>
            <article className="rounded-xl border border-gold-700/55 bg-gold-900/20 p-3">
              <p className="font-semibold text-gold-100">2) Entscheidung</p>
              <p className="mt-2 text-xs text-gold-200/80">
                Bei Konfidenz &quot;hoch&quot; und klarer Differenz: Gewinner-CTA ausrollen, Verlierer stoppen.
              </p>
            </article>
            <article className="rounded-xl border border-gold-700/55 bg-gold-900/20 p-3">
              <p className="font-semibold text-gold-100">3) Fortführen</p>
              <p className="mt-2 text-xs text-gold-200/80">
                Bei &quot;tie&quot;/niedriger Konfidenz Test verlängern und Kontext (Traffic, Gerät, Landing) segmentieren.
              </p>
            </article>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal delayMs={180}>
        <section className="rounded-2xl border border-gold-700/60 bg-ink-900/70 p-4">
          <h2 className="text-sm uppercase tracking-[0.24em] text-gold-300/80">Funnel je Position</h2>
          {loading ? (
            <p className="mt-3 text-sm text-gold-200/80">Lade A/B-Metriken…</p>
          ) : locationRows.length === 0 ? (
            <p className="mt-3 text-sm text-gold-200/80">Noch keine Tracking-Events vorliegend.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {locationRows.map((item) => (
                <li key={item.location} className="rounded-lg border border-ink-600/80 bg-ink-950/50 p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-semibold text-gold-100">{item.location}</span>
                    <span className="rounded-md border border-gold-700/30 bg-gold-900/30 px-2 py-1 text-xs text-gold-200">
                      CTR {item.ctr.toFixed(2)}% / lok. CTR {item.locationCtr.toFixed(2)}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-gold-200/80">
                    Views {item.view} · Clicks {item.click} · Total {item.total}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </ScrollReveal>
    </main>
  );
}
