'use client';

import { useEffect, useRef, useState } from 'react';

type CountUpProps = {
  end: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  startDelayMs?: number;
};

function easeOutCubic(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

export default function CountUp({
  end,
  duration = 1400,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
  startDelayMs = 0,
}: CountUpProps) {
  const safeEnd = Number.isFinite(end) ? end : 0;
  const [value, setValue] = useState(0);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    const from = 0;
    const to = safeEnd;
    const delta = to - from;

    if (delta === 0) {
      setValue(to);
      return;
    }

    let frame = 0;
    let timeout = 0;

    const animate = (timestamp: number) => {
      if (startedAt.current === null) {
        startedAt.current = timestamp;
      }

      const elapsed = timestamp - startedAt.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      setValue(from + delta * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      } else {
        setValue(to);
      }
    };

    timeout = window.setTimeout(() => {
      frame = requestAnimationFrame(animate);
    }, startDelayMs);

    return () => {
      cancelAnimationFrame(frame);
      startedAt.current = null;
      window.clearTimeout(timeout);
    };
  }, [safeEnd, duration, startDelayMs]);

  const formatter = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return <span className={className}>{`${prefix}${formatter.format(Number(value.toFixed(decimals)))}${suffix}`}</span>;
}
