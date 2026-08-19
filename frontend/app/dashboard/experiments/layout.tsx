import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Experimente',
  description: 'A/B-Tracking & CTA-Experimentauswertung im VTC Hub.',
  openGraph: {
    title: 'VTC Hub – A/B Experimente',
    description: 'A/B-Tracking & CTA-Experimentauswertung im VTC Hub.',
    type: 'website',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardExperimentsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
