'use client';

import { ReactNode, useState } from 'react';
import { usePathname } from 'next/navigation';
import DashboardSidebar from '../dashboard/sidebar';
import Topbar from '../dashboard/topbar';

function isDashboardRoute(pathname: string) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

type DashboardChromeProps = {
  children: ReactNode;
};

export default function DashboardChrome({ children }: DashboardChromeProps) {
  const pathname = usePathname();
  const hasDashboardShell = isDashboardRoute(pathname || '/');
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!hasDashboardShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-ink-950 text-white">
      {mobileOpen ? (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-20 bg-black/65 transition md:hidden"
          aria-label="Navigation schließen"
        />
      ) : null}

      <div className="grid min-h-screen gap-3 bg-ink-950 p-2 pb-4 sm:p-4 md:grid-cols-[auto_1fr] md:gap-4 md:p-6">
        <DashboardSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onToggle={() => setCollapsed((v) => !v)}
          onMobileClose={() => setMobileOpen(false)}
        />
        <section className="min-h-[calc(100dvh-2.2rem)] space-y-4 rounded-[28px] border border-gold-700/40 bg-ink-950/60 p-2 shadow-[0_10px_50px_-18px_rgba(0,0,0,0.7)] backdrop-blur-[16px] md:min-h-[calc(100dvh-3rem)] md:pl-0 md:p-3">
          <Topbar onOpenSidebar={() => setMobileOpen(true)} />
          <div className="rounded-2xl p-1">
            <div className="rounded-xl border border-gold-700/40 bg-ink-950/50 p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
              {children}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
