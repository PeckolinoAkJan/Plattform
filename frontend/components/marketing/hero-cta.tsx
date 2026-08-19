'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { trackCtaEvent } from '../../lib/analytics/cta';

type CtaVariant = 'A' | 'B';

type HeroCtaConfig = {
  heading: string;
  primaryLabel: string;
  secondaryLabel: string;
  primaryHref: string;
  secondaryHref: string;
  primaryClass: string;
  secondaryClass: string;
};

const STORAGE_KEY = 'vtc_cta_variant';
const PARAM_KEY = 'cta';
const VIEW_TRACKED_PREFIX = 'vtc_cta_viewed_';

const VARIANTS: Record<CtaVariant, HeroCtaConfig> = {
  A: {
    heading: 'Jetzt starten',
    primaryLabel: 'Jetzt starten',
    secondaryLabel: 'Plattform entdecken',
    primaryHref: '/login',
    secondaryHref: '#features',
    primaryClass:
      'rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold text-ink-950 shadow-glowGold transition hover:translate-y-[-1px] hover:bg-gold-400 focus-visible:outline-gold-300',
    secondaryClass:
      'rounded-full border border-gold-600/65 bg-ink-900/45 px-6 py-3 text-sm font-semibold text-gold-100 backdrop-blur transition hover:border-gold-300/85 hover:text-white',
  },
  B: {
    heading: 'Kostenlos testen',
    primaryLabel: 'Kostenlos anmelden',
    secondaryLabel: 'Jetzt Live-Map sehen',
    primaryHref: '/login?start=demo',
    secondaryHref: '/dashboard/map',
    primaryClass:
      'rounded-full border-2 border-gold-300/70 bg-ink-900/20 px-6 py-3 text-sm font-semibold text-gold-100 transition hover:border-gold-100 hover:bg-gold-500/12',
    secondaryClass:
      'rounded-full bg-gold-500 px-6 py-3 text-sm font-semibold text-ink-950 shadow-glowGold transition hover:bg-gold-400',
  },
};

type HeroCtaProps = {
  locationKey: string;
  className?: string;
};

function detectVariant(): CtaVariant {
  try {
    const queryVariant = new URL(window.location.href).searchParams.get(PARAM_KEY);
    if (queryVariant === 'A' || queryVariant === 'a') return 'A';
    if (queryVariant === 'B' || queryVariant === 'b') return 'B';

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'A' || stored === 'B') return stored;

    const randomVariant: CtaVariant = Math.random() > 0.5 ? 'B' : 'A';
    window.localStorage.setItem(STORAGE_KEY, randomVariant);
    return randomVariant;
  } catch {
    return 'A';
  }
}

export default function HeroCtaCluster({ locationKey, className = '' }: HeroCtaProps) {
  const [variant, setVariant] = useState<CtaVariant>('A');
  const [hasTracked, setHasTracked] = useState(false);

  useEffect(() => {
    const next = detectVariant();
    setVariant(next);
    const markKey = `${VIEW_TRACKED_PREFIX}${locationKey}`;
    const alreadyTracked = (() => {
      try {
        return window.localStorage.getItem(markKey) === '1';
      } catch {
        return false;
      }
    })();

    if (!alreadyTracked) {
      const href = locationKey === 'hero' ? '/login' : '#features';
      trackCtaEvent({
        variant: next,
        location: locationKey,
        type: 'primary',
        action: 'view',
        href,
      });
      try {
        window.localStorage.setItem(markKey, '1');
      } catch {
        // no-op for privacy / storage restricted mode
      }
      setHasTracked(true);
    } else {
      setHasTracked(true);
    }

    try {
      window.dispatchEvent(
        new CustomEvent('vtc:cta-variant', {
          detail: {
            variant: next,
            location: locationKey,
          },
        }),
      );
    } catch {
      // no-op for browsers without CustomEvent support
    }
  }, [locationKey]);

    const config = VARIANTS[variant];

  const onTrackClick = (buttonType: 'primary' | 'secondary', href: string) => {
    trackCtaEvent({
      variant,
      location: locationKey,
      type: buttonType,
      action: 'click',
      href,
    });
  };

  return (
    <div className={`flex flex-col gap-3 sm:flex-row ${className}`}>
      <Link
        href={config.primaryHref}
        data-cta-location={locationKey}
        data-cta-variant={variant}
        data-cta-type="primary"
        onClick={() => onTrackClick('primary', config.primaryHref)}
        className={`${config.primaryClass} btn-micro-glide inline-flex min-h-11 items-center justify-center gap-2 transition-all`}
        aria-label={`${config.primaryLabel} – ${config.heading}`}
      >
        {config.primaryLabel}
        <span aria-hidden className="text-[0.95rem] leading-none opacity-90">
          ↗
        </span>
        {hasTracked ? <span className="sr-only">CTA geladen</span> : null}
      </Link>

      <Link
        href={config.secondaryHref}
        data-cta-location={locationKey}
        data-cta-variant={variant}
        data-cta-type="secondary"
        onClick={() => onTrackClick('secondary', config.secondaryHref)}
        className={`${config.secondaryClass} btn-micro-glide inline-flex min-h-11 items-center justify-center gap-2`}
      >
        {config.secondaryLabel}
        <span aria-hidden className="text-[0.9rem] leading-none opacity-85">
          ⟶
        </span>
      </Link>
    </div>
  );
}
