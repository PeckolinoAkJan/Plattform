export const DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard", label: "Übersicht", icon: "◉" },
  { href: "/dashboard/logbook", label: "Fahrtenbuch", icon: "📒" },
  { href: "/dashboard/company", label: "Spedition", icon: "🏢" },
  { href: "/dashboard/map", label: "Livekarte", icon: "🛰️" },
  { href: "/dashboard/experiments", label: "CTA-Experiment", icon: "🧪" },
] as const;

export const isDashboardNavItemActive = (
  pathname: string | null,
  href: string,
) =>
  href === "/dashboard"
    ? pathname === "/dashboard"
    : Boolean(pathname?.startsWith(href));
