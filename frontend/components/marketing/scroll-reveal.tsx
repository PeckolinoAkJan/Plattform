'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  delayMs?: number;
  threshold?: number;
  yOffset?: number;
};

export default function ScrollReveal({
  children,
  className = '',
  delayMs = 0,
  threshold = 0.16,
  yOffset = 18,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const node = ref.current;
    if (!node) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setIsVisible(true);
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: '0px 0px -10% 0px',
        threshold,
      },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, [threshold, yOffset]);

  return (
    <div
      ref={ref}
      className={`scroll-reveal-item ${isVisible ? 'is-visible' : ''} ${className}`}
      style={{
        transitionDelay: `${delayMs}ms`,
        ['--sr-offset' as string]: `${yOffset}px`,
      }}
    >
      {children}
    </div>
  );
}

