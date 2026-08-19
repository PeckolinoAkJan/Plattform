import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live-Karte',
  description: 'Live-Telemetrie der aktiven Fahrer in Echtzeit auf der Premium-Übersicht.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: {
    url: '/dashboard/map',
    title: 'VTC Hub – Live-Karte',
    description: 'Live-Telemetrie der aktiven Fahrer in Echtzeit.',
    images: [
      {
        url: '/vtc-hub-hero.png',
        width: 1672,
        height: 941,
        alt: 'VTC Hub Live-Karte Vorschau',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VTC Hub – Live-Karte',
    description: 'Live-Telemetrie der aktiven Fahrer in Echtzeit.',
    images: ['/vtc-hub-hero.png'],
  },
};

export default function DashboardMapLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
