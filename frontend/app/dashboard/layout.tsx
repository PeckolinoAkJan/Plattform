import type { Metadata } from 'next';
import { ReactNode } from 'react';

export const metadata: Metadata = {
  title: {
    template: 'Dashboard | %s',
    default: 'Dashboard',
  },
  description: 'Interaktive Betriebsansicht für VTC-Dashboard, Telemetrie und Tourenmanagement.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    url: '/dashboard',
    title: 'VTC Hub Dashboard',
    description: 'Interaktive Betriebsansicht für VTC-Dashboard, Telemetrie und Tourenmanagement.',
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
    card: 'summary_large_image',
    title: 'VTC Hub Dashboard',
    description: 'Interaktive Betriebsansicht für VTC-Dashboard, Telemetrie und Tourenmanagement.',
    images: ['/vtc-hub-hero.png'],
    creator: '@vtchub',
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
