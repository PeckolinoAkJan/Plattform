import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Anmelden beim VTC Hub Dashboard für Fahrer und Speditionen.',
  openGraph: {
    title: 'VTC Hub Login',
    description: 'Sichere Anmeldung für Live-Telemetrie, Live-Map und Logbuch-Funktionen.',
    url: '/login',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VTC Hub Login',
    description: 'Sichere Anmeldung für Live-Telemetrie, Live-Map und Logbuch-Funktionen.',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
