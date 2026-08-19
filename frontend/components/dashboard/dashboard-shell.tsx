'use client';

import { useState, type ReactNode } from 'react';
import Sidebar from './sidebar';
import Topbar from './topbar';

type DashboardShellProps = {
  children: ReactNode;
};

export default function DashboardShell({ children }: DashboardShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <div className="min-h-screen bg-ink-950 text-white">
      <div className="flex min-h-screen">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="flex-1">
          <Topbar onOpenSidebar={() => setMobileOpen(true)} />
          <main className="p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
