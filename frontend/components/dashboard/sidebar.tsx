import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "../marketing/brand-mark";
import { DASHBOARD_NAV_ITEMS, isDashboardNavItemActive } from "./nav-items";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
};

export default function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const navClasses = [
    "md:w-[270px]",
    "w-full",
    "h-[100dvh]",
    "rounded-[28px]",
    "border border-gold-700/35",
    "bg-ink-950/90",
    "p-4",
    "shadow-[0_16px_45px_-18px_rgba(0,0,0,0.8)]",
    "backdrop-blur-[18px]",
    "transition-all duration-300",
    "overflow-hidden",
  ];

  const widthClass = collapsed ? "md:w-20" : "md:w-[270px]";
  const slideClass = mobileOpen
    ? "translate-x-0"
    : "-translate-x-[calc(100%-4.5rem)]";

  return (
    <aside className={`relative ${widthClass}`}>
      <nav
        className={`${navClasses.join(" ")} ${widthClass} ${slideClass} md:translate-x-0 md:static`}
      >
        <button
          onClick={onToggle}
          aria-label="Sidebar ein-/ausklappen"
          className="interactive-focus absolute -right-3 top-8 z-20 hidden rounded-full border border-gold-500/25 bg-gold-500/10 p-2 text-[11px] font-semibold text-gold-100 transition hover:bg-gold-500/20 md:block"
        >
          {collapsed ? "»" : "«"}
        </button>

        <button
          onClick={onMobileClose}
          aria-label="Navigation schließen"
          className="interactive-focus inline-flex h-8 w-8 items-center justify-center rounded-full border border-gold-600/45 bg-gold-500/10 text-xs text-gold-100 transition hover:bg-gold-500/20 md:hidden"
        >
          ✕
        </button>

        <div className="mb-6 flex items-center justify-between border-b border-gold-800/50 pb-3">
          <div className="min-w-0">
            {!collapsed ? (
              <BrandMark
                size={36}
                withWordmark
                variant="logo"
                ariaLabel="VTC Hub"
              />
            ) : (
              <BrandMark
                size={28}
                withWordmark={false}
                variant="logo"
                ariaLabel="VTC Hub"
              />
            )}
          </div>
          <button
            onClick={onMobileClose}
            aria-label="Navigation schließen"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-gold-500/40 text-xs text-gold-100 md:hidden"
          >
            ✕
          </button>
        </div>

        <ul className="space-y-2">
          {DASHBOARD_NAV_ITEMS.map((item) => {
            const isActive = isDashboardNavItemActive(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onMobileClose}
                  className={`interactive-focus group flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                    isActive
                      ? "bg-gold-500/25 text-gold-100 ring-1 ring-gold-400/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                      : "text-gold-100/75 hover:bg-gold-500/8 hover:text-gold-100"
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  {!collapsed ? (
                    <span className="text-sm font-medium">{item.label}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
