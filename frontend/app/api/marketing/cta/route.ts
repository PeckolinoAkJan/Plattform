import { NextRequest, NextResponse } from 'next/server';

const MINOR_CAP = 1024 * 1024;
const MAX_STORED_EVENTS = 800;

type CtaPayload = {
  variant: 'A' | 'B';
  location: string;
  type: 'primary' | 'secondary';
  action: 'view' | 'click';
  href: string;
  ts: string;
  token?: string;
};

const ctaEvents: CtaPayload[] = [];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitize(payload: unknown): CtaPayload | null {
  if (!isObject(payload)) return null;

  const variant = payload.variant === 'A' || payload.variant === 'B' ? payload.variant : null;
  const location = typeof payload.location === 'string' ? payload.location : null;
  const type = payload.type === 'primary' || payload.type === 'secondary' ? payload.type : null;
  const action = payload.action === 'view' || payload.action === 'click' ? payload.action : null;
  const href = typeof payload.href === 'string' ? payload.href : null;
  const ts = typeof payload.ts === 'string' ? payload.ts : null;
  const token = typeof payload.token === 'string' ? payload.token : null;

  if (!variant || !location || !type || !action || !href || !ts) {
    return null;
  }

  return { variant, location, type, action, href, ts, token: token ?? undefined };
}

function buildSummary(events: CtaPayload[]) {
  const summary = {
    total: 0,
    byVariant: { A: 0, B: 0 },
    byLocation: {} as Record<string, { view: number; click: number }>,
    byType: { primary: 0, secondary: 0 },
    byAction: { view: 0, click: 0 },
    byVariantAction: {
      A: { view: 0, click: 0 },
      B: { view: 0, click: 0 },
    },
    byLocationCtr: {} as Record<string, { view: number; click: number; ctr: number }>,
    recommendation: {
      bestVariant: 'tie' as 'A' | 'B' | 'tie',
      deltaPercent: 0,
      confidence: 'low' as 'low' | 'medium' | 'high',
      reason: 'Noch keine ausreichend Daten für eine Empfehlung.',
    },
  };

  for (const event of events) {
    summary.total += 1;
    summary.byVariant[event.variant] += 1;
    summary.byAction[event.action] += 1;
    summary.byType[event.type] += 1;
    summary.byVariantAction[event.variant][event.action] += 1;

    if (!summary.byLocation[event.location]) {
      summary.byLocation[event.location] = { view: 0, click: 0 };
    }

    summary.byLocation[event.location]![event.action] += 1;
  }

  for (const [location, metrics] of Object.entries(summary.byLocation)) {
    const ctr = metrics.view > 0 ? Number(((metrics.click / metrics.view) * 100).toFixed(2)) : 0;
    summary.byLocationCtr[location] = {
      view: metrics.view,
      click: metrics.click,
      ctr,
    };
  }

  const ctrA = summary.byVariant.A > 0 ? summary.byVariantAction.A.click / summary.byVariant.A : 0;
  const ctrB = summary.byVariant.B > 0 ? summary.byVariantAction.B.click / summary.byVariant.B : 0;
  if (summary.byVariant.A >= 3 && summary.byVariant.B >= 3) {
    const diff = Math.abs(ctrA - ctrB);
    summary.recommendation.deltaPercent = Number(((diff * 100) / Math.max(ctrA, ctrB)).toFixed(1));

    if (diff < 0.03) {
      summary.recommendation.bestVariant = 'tie';
      summary.recommendation.reason = 'Nahezu identische Performance – Testlauf verlängern.';
      summary.recommendation.confidence = 'low';
    } else if (ctrA > ctrB) {
      summary.recommendation.bestVariant = 'A';
      summary.recommendation.reason = 'Variante A erreicht einen messbaren Vorsprung bei Klicks.';
      summary.recommendation.confidence = diff > 0.08 ? 'high' : 'medium';
    } else {
      summary.recommendation.bestVariant = 'B';
      summary.recommendation.reason = 'Variante B erreicht einen messbaren Vorsprung bei Klicks.';
      summary.recommendation.confidence = diff > 0.08 ? 'high' : 'medium';
    }
  } else {
    summary.recommendation.reason = 'Noch zu wenig Daten für klare Empfehlung.';
  }

  return summary;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  if (!raw || raw.length > MINOR_CAP) {
    return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
  }

  const incoming = (() => {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  })();

  const payload = sanitize(incoming);
  if (!payload) {
    return NextResponse.json({ ok: false, error: 'Malformed cta payload' }, { status: 400 });
  }

  ctaEvents.push(payload);
  if (ctaEvents.length > MAX_STORED_EVENTS) {
    ctaEvents.splice(0, ctaEvents.length - MAX_STORED_EVENTS);
  }

  if (process.env.NODE_ENV !== 'production') {
    console.log('[cta] event', payload);
  }

  return NextResponse.json({ ok: true, event: payload }, { status: 201 });
}

export async function GET() {
  return NextResponse.json({ ok: true, summary: buildSummary(ctaEvents) });
}
