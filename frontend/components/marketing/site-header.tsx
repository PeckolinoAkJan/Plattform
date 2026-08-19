import Link from 'next/link';
import BrandMark from './brand-mark';

type SiteHeaderProps = {
  compact?: boolean;
  className?: string;
};

const navItems = [
  { label: 'Features', href: '#features' },
  { label: 'Plattform', href: '#platform' },
  { label: 'Live', href: '#live' },
  { label: 'Preise', href: '#preise' },
  { label: 'Support', href: '#support' },
];

export default function SiteHeader({ compact = false, className = '' }: SiteHeaderProps) {
  return (
    <header
      className={`sticky top-0 z-30 border-b border-gold-700/35 bg-ink-950/78 px-4 py-3 backdrop-blur-xl backdrop-saturate-125 sm:px-6 xl:px-8 ${className}`}
    >
      <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between">
        <BrandMark size={compact ? 32 : 40} withWordmark variant="logo" />

        <nav className="hidden items-center gap-7 text-xs uppercase tracking-[0.24em] text-gold-200/85 md:flex">
          {navItems.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="group relative inline-flex h-9 items-center transition hover:text-gold-100 focus-visible:outline-none"
            >
              <span className="absolute inset-x-0 bottom-[-12px] h-px w-full bg-gold-400/0 transition-all duration-300 group-hover:bg-gold-300/80 group-focus-visible:bg-gold-300/80" />
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="interactive-focus inline-flex min-h-10 min-w-11 items-center rounded-full border border-gold-400/50 bg-gold-500/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-gold-100 transition hover:border-gold-200/85 hover:bg-gold-500/25 sm:text-sm"
          >
            Login
          </Link>
        </div>
      </div>
    </header>
  );
}
