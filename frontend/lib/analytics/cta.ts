export type CtaInteractionType = 'view' | 'click';
export type CtaButtonType = 'primary' | 'secondary';

export type CtaInteractionEvent = {
  variant: 'A' | 'B';
  location: string;
  type: CtaButtonType;
  action: CtaInteractionType;
  href: string;
  token?: string;
};

const CTA_TRACKING_ENDPOINT = '/api/marketing/cta';

function getFallbackId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  return window.crypto?.randomUUID?.() ?? `vtc-cta-${Math.random().toString(16).slice(2)}`;
}

function dispatchCtaBeacon(payload: CtaInteractionEvent & { ts: string; page: string }) {
  const body = JSON.stringify(payload);

  if (typeof navigator === 'undefined') {
    return;
  }

  const queued = navigator.sendBeacon?.(CTA_TRACKING_ENDPOINT, body);
  if (queued) {
    return;
  }

  void fetch(CTA_TRACKING_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {
    try {
      const bucket = `${window.location.pathname}:cta-events`;
      const raw = window.localStorage.getItem(bucket);
      const existing = raw ? JSON.parse(raw) : [];
      const next = Array.isArray(existing) ? existing.slice(-60) : [];
      next.push(payload);
      window.localStorage.setItem(bucket, JSON.stringify(next));
    } catch {
      // Keep silent in restrictive privacy modes.
    }
  });
}

export function trackCtaEvent(event: CtaInteractionEvent) {
  if (typeof window === 'undefined') {
    return;
  }

  const payload = {
    ...event,
    page: window.location.pathname + window.location.search,
    ts: new Date().toISOString(),
    token: getFallbackId(),
  };

  dispatchCtaBeacon(payload);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('vtc:cta-track', {
        detail: payload,
      }),
    );
  }
}

export type CtaSummaryPoint = {
  total: number;
  byVariant: {
    A: number;
    B: number;
  };
  byLocation: Record<string, { view: number; click: number }>;
  byType: {
    primary: number;
    secondary: number;
  };
  byAction: {
    view: number;
    click: number;
  };
  byLocationCtr: Record<
    string,
    {
      view: number;
      click: number;
      ctr: number;
    }
  >;
  recommendation: {
    bestVariant: 'A' | 'B' | 'tie';
    deltaPercent: number;
    confidence: 'low' | 'medium' | 'high';
    reason: string;
  };
};

export async function fetchCtaSummary(): Promise<CtaSummaryPoint | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(CTA_TRACKING_ENDPOINT, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { ok: boolean; summary?: CtaSummaryPoint };
    return payload?.ok ? payload.summary ?? null : null;
  } catch {
    return null;
  }
}
