import type { Metadata, Viewport } from 'next';
import './globals.css';
import DashboardChrome from '../components/layout/dashboard-shell';

export const metadata: Metadata = {
  title: {
    default: 'VTC Hub',
    template: '%s | VTC Hub',
  },
  description:
    'VTC Hub – Premium Plattform für Live-Telemetrie, Tourenmanagement und Speditionsteam-Steuerung.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  alternates: {
    canonical: '/',
    languages: {
      de: '/',
      en: '/en',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: '/',
    siteName: 'VTC Hub',
    title: 'VTC Hub',
    description:
      'Premium VTC Plattform für Live-Tracking, Fahrtenbuch und Betriebsübersicht.',
    images: [
      {
        url: '/vtc-hub-hero.png',
        width: 1672,
        height: 941,
        alt: 'VTC Hub Dashboard Vorschau',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@vtchub',
    creator: '@vtchub',
    title: 'VTC Hub',
    description:
      'Premium VTC Plattform für Live-Telemetrie, Tourenmanagement und Speditionsteam-Steuerung.',
    images: ['/vtc-hub-hero.png'],
  },
  icons: {
    icon: [
      {
        rel: 'icon',
        url: '/vtc-hub-logo.png',
      },
    ],
    apple: '/vtc-hub-logo.png',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
      'max-video-preview': -1,
    },
  },
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#0b0b0f',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body className="min-h-screen bg-ink-950 text-white antialiased">
        <div className="relative min-h-screen overflow-hidden bg-ink-950">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-x-[-10%] top-[-12%] h-[460px] w-[460px] rounded-full bg-gradient-to-br from-gold-500/20 to-gold-700/0 blur-3xl" />
            <div className="absolute inset-x-[50%] -translate-x-[50%] bottom-[-20%] h-[360px] w-[360px] rounded-full bg-gradient-to-tl from-gold-600/14 to-transparent blur-2xl" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:96px_96px] opacity-[0.08]" />
          </div>
          <main className="relative z-10 min-h-screen">
            <DashboardChrome>{children}</DashboardChrome>
          </main>
        </div>
      </body>
    </html>
  );
}
