import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Fahrtenbuch',
  description: 'Uebersicht der Fahrten und Touren mit Status, Distanz und Kennzahlen.',
  openGraph: {
    title: 'VTC Hub - Fahrtenbuch',
    description: 'Fahrtenbuch-Uebersicht fuer Fahrer und Dispatcher.',
    images: [
      {
        url: '/vtc-hub-hero.png',
        width: 1672,
        height: 941,
        alt: 'VTC Hub Fahrtenbuch Vorschau',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VTC Hub - Fahrtenbuch',
    description: 'Fahrtenbuch-Uebersicht fuer Fahrer und Dispatcher.',
    images: ['/vtc-hub-hero.png'],
  },
};

export default function LogbookLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
