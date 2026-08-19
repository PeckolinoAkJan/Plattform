import Image from 'next/image';
import Link from 'next/link';

type BrandMarkProps = {
  size?: number;
  withWordmark?: boolean;
  compact?: boolean;
  href?: string;
  className?: string;
  variant?: 'mark' | 'logo';
  ariaLabel?: string;
};

export default function BrandMark({
  size = 40,
  withWordmark = true,
  compact = false,
  href = '/',
  className = '',
  variant = 'mark',
  ariaLabel,
}: BrandMarkProps) {
  const src = variant === 'logo' ? '/vtc-hub-logo.png' : '/vtc-hub-mark.png';
  const accessibleLabel = ariaLabel ?? 'VTC Hub';
  const markClass = compact ? 'rounded-lg p-0.5' : 'rounded-2xl p-[2px]';

  const logo = (
    <div
      className={`vtc-brand-mark relative grid place-items-center overflow-hidden rounded-xl border border-gold-500/50 bg-ink-900/80 ${markClass} shadow-[0_0_0_1px_rgba(244,204,43,0.22),_0_16px_32px_-24px_rgba(0,0,0,0.8)]`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Image
        src={src}
        alt="VTC Hub"
        width={size}
        height={size}
        priority={compact ? false : true}
        className="h-full w-full rounded-lg object-contain p-0.5 mix-blend-screen"
      />
    </div>
  );

  const wordmark = withWordmark ? (
    <div className="min-w-0">
      <p className="text-base font-semibold leading-none tracking-[0.02em] text-gold-100 sm:text-xl">VTC Hub</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.26em] text-gold-300/85">Fleet Operations</p>
    </div>
  ) : null;

  const content = (
    <span className={`inline-flex items-center ${compact ? 'gap-2' : 'gap-3'} ${className}`}>
      {logo}
      {wordmark}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center" aria-label={accessibleLabel}>
        {content}
      </Link>
    );
  }

  return content;
}
