import Image from 'next/image';
import type { Metadata } from 'next';

import CountUp from '../components/marketing/count-up';
import HeroCtaCluster from '../components/marketing/hero-cta';
import ScrollReveal from '../components/marketing/scroll-reveal';
import SiteHeader from '../components/marketing/site-header';
import { buildRouteJsonLd } from '../lib/seo/schema';

export const metadata: Metadata = {
  title: 'Startseite',
  description:
    'Premium VTC Plattform für Live-Telemetrie, Fahrtenbuch und zentralen Speditions-Betrieb.',
  openGraph: {
    title: 'VTC Hub – Control Center',
    description:
      'Starte Live-Operations mit Echtzeit-Telemetrie, Live-Map und automatisiertem Touren-Management.',
    url: '/',
    siteName: 'VTC Hub',
    images: [
      {
        url: '/vtc-hub-hero.png',
        width: 1672,
        height: 941,
        alt: 'VTC Hub Dashboard Vorschau',
      },
    ],
    type: 'website',
  },
  twitter: {
    title: 'VTC Hub – Control Center',
    description:
      'Starte Live-Operations mit Echtzeit-Telemetrie, Live-Map und automatisiertem Touren-Management.',
    card: 'summary_large_image',
  },
};

const heroStats = [
  { label: 'Live Fahrer', value: 1200, suffix: '+' as const, hint: 'Aktiv im Netzwerk' },
  { label: 'Fahrten', value: 48000, suffix: '+' as const, hint: 'Abgeschlossen im Q4' },
  { label: 'Durchschnitts-Umsatz', value: 2900, suffix: '€', hint: 'Pro Woche' },
  { label: 'Uptime', value: 99.98, decimals: 2, suffix: '%', hint: 'Server-SLAs' },
];

const benefits = [
  {
    title: 'Telemetrie in Echtzeit',
    description:
      'Live Positionen, Geschwindigkeit und Route deiner Flotte in einem stabilen Dark-Deck mit sauberer Signalführung.',
    icon: '📡',
  },
  {
    title: 'Sicherer Zugriff',
    description:
      'JWT Sessions, rollenbasierte Zugriffe und Anti-Cheat mit Timestamp & Nonce schützen API und Live-Events.',
    icon: '🔐',
  },
  {
    title: 'Logbuch und Auswertung',
    description:
      'Touren-Intelligenz mit Performance-Kennzahlen, Auslastung und transparenten Team-Fortschrittsdaten.',
    icon: '📊',
  },
  {
    title: 'Spedition im Fokus',
    description:
      'Gemeinsame Dispatch-Flächen, Team-Rooms und zentrale Steuerung für Dispatcher, Dispatcher und Fahrer.',
    icon: '🏢',
  },
];

const steps = [
  'Konto anlegen und Team mit Rollen verbinden.',
  'Desktop-Client mit Game & API verbinden.',
  'Live-Karte aktivieren und Joblauf starten.',
  'Tourdaten gemeinsam mit Team analysieren.',
];

function getDelayClass(index: number) {
  if (index === 0) return '';
  if (index === 1) return 'animation-delay-sm';
  if (index === 2) return 'animation-delay-md';
  if (index === 3) return 'animation-delay-lg';
  return 'animation-delay-xl';
}

export default function HomePage() {
  const jsonLd = buildRouteJsonLd({
    title: 'VTC Hub – Startseite',
    description: 'Premium Plattform für VTC-Live-Telemetrie, Fahrtenbuch und Team-Operations.',
    path: '/',
  });

  return (
    <main className="relative overflow-hidden bg-ink-950 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 top-[-26rem] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(244,206,103,0.22),_transparent_58%)] blur-3xl" />
        <div className="absolute -right-36 top-10 h-[470px] w-[470px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(212,175,55,0.18),_transparent_62%)] blur-3xl" />
        <div className="absolute bottom-[-22rem] left-[8%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle_at_center,_rgba(126,93,16,0.2),_transparent_66%)] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:84px_84px] opacity-10" />
      </div>

      <SiteHeader className="animate-fade-in" />

      <ScrollReveal className="landing-shell relative z-10">
        <section className="relative z-10 flex min-h-[calc(100svh-4.25rem)] flex-col gap-10 pt-8 pb-14 md:flex-row md:gap-14 md:pt-12 lg:min-h-[calc(100vh-4.5rem)] lg:pb-20">
          <div className="flex-1">
            <p className="landing-chip">VTC Plattform für Profis</p>

            <h1 className="landing-title mt-4 max-w-2xl leading-[1.04] landing-gold-ink">
              Das Control Center für
              <span className="text-gold-300"> moderne Ferntransporte </span>
              aus ETS2 & ATS
            </h1>
            <p className="landing-subtitle">
              Zentralisiere Fleet-Management, Live-Telemetrie, Fahrtenprotokolle und Unternehmens-Logik in einer
              Premium-Oberfläche mit Fokus auf Performance, Sicherheit und Übersicht.
            </p>

            <div className="mt-8">
              <HeroCtaCluster locationKey="hero" className="items-center sm:items-start" />
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {heroStats.map((item, index) => (
                <article
                  key={item.label}
                  className={`landing-card ${getDelayClass(index)} animate-fade-up`}
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-gold-300">{item.label}</p>
                  <p className="landing-kpi-value">
                    <CountUp
                      end={item.value}
                      decimals={item.decimals ?? 0}
                      suffix={item.suffix}
                      startDelayMs={260 + index * 90}
                    />
                  </p>
                  <p className="mt-1 text-xs text-gold-100/85">{item.hint}</p>
                </article>
              ))}
            </div>
          </div>

          <ScrollReveal className="w-full max-w-[640px]" delayMs={160}>
            <aside id="live" className="animate-fade-up animation-delay-xl">
              <div className="landing-section landing-soft-shadow p-1">
                <div className="rounded-[calc(1.75rem-4px)] border border-gold-800/35 bg-ink-950/90 p-5">
                  <div className="relative">
                    <div className="relative mb-4 overflow-hidden rounded-xl border border-gold-700/40 bg-ink-900/70">
                      <Image
                        src="/vtc-hub-hero.png"
                        alt="VTC Hub Dashboard-Ansicht"
                        width={1672}
                        height={941}
                        className="h-full w-full object-cover opacity-95"
                        style={{ aspectRatio: '16 / 9' }}
                        priority
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/10 to-transparent" />
                      <div className="absolute left-4 top-4 rounded-full border border-emerald-300/50 bg-emerald-300/20 px-3 py-1 text-[11px] font-medium text-emerald-100">
                        Live-Stream aktiv
                      </div>
                    </div>

                    <p className="text-xs uppercase tracking-[0.3em] text-gold-200/85">Live Overview</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white sm:text-2xl">Command Deck</h2>
                    <p className="mt-2 text-sm text-gold-100/85">
                      Kartenansicht • Truckstatus • Frachtfluss • Benachrichtigungen
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-emerald-300/30 bg-emerald-300/12 p-3 text-sm text-emerald-100">
                        Online-Fahrer
                        <p className="mt-1.5 text-2xl font-semibold">32</p>
                      </div>
                      <div className="rounded-xl border border-cyan-200/25 bg-cyan-200/10 p-3 text-sm text-cyan-100">
                        Offene Jobs
                        <p className="mt-1.5 text-2xl font-semibold">7</p>
                      </div>
                      <div className="rounded-xl border border-gold-600/35 bg-gold-900/22 p-3 text-sm text-gold-100">
                        Aktuelle Touren
                        <p className="mt-1.5 text-2xl font-semibold">14</p>
                      </div>
                      <div className="rounded-xl border border-gold-300/28 bg-gold-400/12 p-3 text-sm text-gold-100">
                        Durchschn. Auslastung
                        <p className="mt-1.5 text-2xl font-semibold">91%</p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl border border-gold-700/45 bg-ink-900/80 p-3">
                      <p className="text-xs uppercase tracking-[0.21em] text-gold-300/80">Status</p>
                      <p className="mt-2 text-sm text-gold-100">Aktiv: Live-Telemetrie stabil · API-Latenz unter 120ms</p>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-gold-900/50">
                        <div className="h-full w-[82%] rounded-full bg-gradient-to-r from-gold-300 via-gold-500 to-gold-700" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </ScrollReveal>
        </section>
      </ScrollReveal>

      <ScrollReveal className="relative z-10 py-16 md:py-24" delayMs={20}>
        <section id="features" className="landing-shell">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-gold-300">VTC Hub Features</p>
              <h2 className="mt-2 text-3xl font-semibold leading-tight text-white sm:text-[2.45rem]">
                Warum Teams auf VTC Hub setzen
              </h2>
            </div>
            <p className="max-w-lg text-sm text-gold-100/80">
              Durch eine durchdachte Architektur aus Dashboard, Kartenmodulen und Telemetrie-Events bleibt der Betrieb
              transparent und wartbar.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {benefits.map((benefit, index) => (
              <ScrollReveal key={benefit.title} delayMs={120 + index * 100}>
                <article
                  className={`landing-section landing-soft-shadow p-7 shadow-panel animate-fade-up ${getDelayClass(index)}`}
                >
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gold-400/65 bg-gold-500/10 text-lg">
                    {benefit.icon}
                  </span>
                  <h3 className="mt-4 text-xl font-semibold text-white">{benefit.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-gold-100/85">{benefit.description}</p>
                </article>
              </ScrollReveal>
            ))}
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal className="relative z-10 py-4" delayMs={60}>
        <section id="platform" className="landing-shell">
          <div className="landing-section landing-soft-shadow p-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <p className="text-xs uppercase tracking-[0.28em] text-gold-300">Ablauf</p>
              <h3 className="mt-2 text-3xl font-semibold leading-tight text-white">Schneller Einstieg in 4 Schritten</h3>
              <p className="mt-3 text-sm text-gold-100/80">Vom ersten Login bis zum ersten Live-Update in unter 15 Minuten.</p>
            </div>
            <ol className="grid w-full gap-3 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <li
                  key={step}
                  className={`rounded-xl border border-ink-700/60 bg-ink-950/70 px-4 py-5 text-sm leading-relaxed text-gold-100/90 animate-fade-up ${getDelayClass(index)}`}
                >
                  <p className="mb-1 text-xs uppercase tracking-[0.2em] text-gold-300">Schritt {index + 1}</p>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal className="relative z-10 py-14 md:py-20" delayMs={80}>
        <section id="preise" className="landing-shell">
          <div className="flex flex-col gap-6 rounded-[1.75rem] border border-gold-700/50 bg-ink-900/80 p-8 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-gold-300">Bereit zu starten?</p>
              <h2 className="mt-2 max-w-xl text-3xl font-semibold leading-tight text-white">
                Erweitere deinen Fuhrpark mit einem professionellen Hub.
              </h2>
              <p className="mt-2 text-sm text-gold-100/80">
                Sichere dir eine moderne Oberfläche für Fahrer, Dispatcher und Management in einem einzigen System.
              </p>
            </div>
            <HeroCtaCluster locationKey="pricing" className="w-full sm:w-auto" />
          </div>
        </section>
      </ScrollReveal>

      <ScrollReveal className="relative z-10 py-8 border-t border-gold-800/20 md:py-10" delayMs={120}>
        <section id="support" className="landing-shell flex flex-col gap-2 text-sm text-gold-200/80 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} VTC Hub</p>
          <p>Premium Plattform für Speditionen, Dispatcher und Flottenführer.</p>
          <a href="/login" className="text-gold-300 hover:text-gold-100">
            Login
          </a>
        </section>
      </ScrollReveal>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd),
        }}
      />
    </main>
  );
}
