// Live mode for the Look B server (INTEGRATION_MODE=live). Diagnosis, outreach and booking are
// delegated to the Next.js backend over HTTP, so Claude, Keewano, Dial and the approval gate run in
// one place. This file is the HTTP client plus pure mappers from that backend's RepairRequest into
// Look B's repair shapes. Runs under tsx (it reuses the slot parser from lib/ics.ts).
import { isSpecificSlot, parseSlot } from '../../lib/ics.ts';
import { AppError } from '../validation.js';

// The backend knows these properties (data/properties.json); houses added in Look B stay in demo mode.
export const LIVE_PROPERTIES = new Set(['p1', 'p2', 'p3']);
const QUOTE_TTL_MS = 7 * 86400000;

export function createLiveClient(base, fetchImpl = fetch) {
  const call = async (method, path, { json, form } = {}) => {
    let res;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: json ? { 'Content-Type': 'application/json' } : undefined,
        body: json ? JSON.stringify(json) : form,
        signal: AbortSignal.timeout(110000)
      });
    } catch {
      throw new AppError(502, 'Can’t reach the live Handy backend. Check that it is running (npm run dev).');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new AppError(res.status === 409 ? 409 : res.status === 400 || res.status === 413 || res.status === 415 ? 400 : 502, data.error || `Live backend error (HTTP ${res.status}).`);
    return data;
  };
  const id = v => encodeURIComponent(v);
  return {
    providers: () => call('GET', '/api/providers'),
    create(fields, property) {
      const form = new FormData();
      form.set('title', fields.title);
      form.set('description', fields.description);
      form.set('propertyId', fields.property);
      form.set('unit', property.unit);
      form.set('room', fields.room);
      form.set('requesterRole', property.home ? 'homeowner' : 'property_manager');
      const photo = fields.photos.find(p => typeof p === 'string' && p.startsWith('data:image/'));
      if (photo) {
        const [head, b64] = photo.split(',');
        const type = head.slice(5, head.indexOf(';'));
        form.set('photo', new Blob([Buffer.from(b64, 'base64')], { type }), `photo.${type.split('/')[1]}`);
      }
      return call('POST', '/api/requests', { form });
    },
    outreach: rid => call('POST', `/api/requests/${id(rid)}/outreach`),
    get: rid => call('GET', `/api/requests/${id(rid)}`),
    book: (rid, body) => call('POST', `/api/requests/${id(rid)}/book`, { json: body })
  };
}

/* ---------- Pure mappers (unit-tested) ---------- */

const CATEGORY = { plumber: 'plumbing', hvac: 'hvac', electrician: 'electrical' };
const TRADE = { plumber: 'Plumber', hvac: 'HVAC technician', electrician: 'Electrician', handyman: 'Handyman', appliance: 'Appliance technician', other: 'Professional' };

export function toAssessment(req) {
  const d = req.diagnosis;
  const hazard = req.status === 'emergency' || d.urgency === 'emergency';
  return {
    category: CATEGORY[d.trade] ?? 'general',
    title: hazard ? 'Possible urgent hazard — stop the repair workflow' : d.title,
    text: hazard ? (d.safetyGuidance || req.notice || 'Leave the area if unsafe and contact emergency or utility services.') : [d.likelyCause, d.summary].filter(Boolean).join(' '),
    scope: d.jobBrief || d.title,
    trade: TRADE[d.trade] ?? 'Professional',
    confidence: `${Math.round((d.confidence ?? 0) * 100)}% confidence`,
    costRangeUsd: d.costRangeUsd ?? null,
    hazard, demo: false, live: true,
    source: d.source === 'mock' ? 'mock:claude-diagnosis' : 'live:claude-diagnosis',
    disclaimer: 'Claude’s assessment of your photo and description. A professional confirms the diagnosis and final scope on site.'
  };
}

// Look B's call stages: wait · ring · talk · read (call over, reading the transcript) · ok · bad
export function callStage(c) {
  if (c.state === 'queued_local') return 'wait';
  if (c.state === 'Queued' || c.state === 'Ringing') return 'ring';
  if (c.state === 'In-Progress') return 'talk';
  if (c.terminationType !== 'completed') return 'bad';
  if (c.quote || c.booking) return 'ok';
  return c.extractionStatus === 'failed' ? 'bad' : 'read';
}

const transcriptOf = (c, name) => (c.transcriptTurns || []).map(t => ({ speaker: t.speaker === 'agent' ? 'Handy' : name, text: t.text }));

export function toCall(c, meta, purpose = 'estimate') {
  const stage = callStage(c);
  return {
    id: c.id, providerId: c.providerId, providerName: meta.name ?? c.providerId, channel: 'voice', purpose,
    status: c.state !== 'Terminated' ? 'in_progress' : c.terminationType === 'completed' ? 'completed' : 'unanswered',
    liveStage: stage, live: true, demo: false,
    timestamp: c.startedAt ?? c.endedAt ?? null, durationSeconds: c.durationSec ?? null,
    transcript: transcriptOf(c, meta.name ?? 'Provider'),
    outcome: stage === 'bad' ? (c.terminationType === 'completed' ? 'The call ended without a usable answer.' : `No answer (${c.terminationType ?? 'not connected'}).`) : '',
    source: 'live:dial-call'
  };
}

const feeText = q => {
  const fee = q.visitFeeUsd, ft = q.feeTreatment ?? 'unknown';
  if (fee == null || q.pricingType === 'inspection_only') return '';
  return ft === 'waived_if_hired' ? `$${fee} visit fee waived if hired`
    : ft === 'included' ? `$${fee} visit fee included`
    : ft === 'additional' ? `+ $${fee} visit fee`
    : ft === 'none' ? 'No visit fee' : `$${fee} visit fee (terms unconfirmed)`;
};

// A provider's spoken slot as an ISO window, or null when it doesn't name both a day and a time.
export function slotWindow(text, now = new Date()) {
  if (typeof text !== 'string' || !isSpecificSlot(text)) return null;
  const { start, end } = parseSlot(text, now);
  return { start: start.toISOString(), end: end.toISOString(), text };
}

// Only an answered call with a stated price becomes something the user can approve.
export function toQuote(c, meta, now = new Date()) {
  const q = c.quote;
  if (!q || c.terminationType !== 'completed') return null;
  const lo = q.priceLowUsd, hi = q.priceHighUsd, fee = q.visitFeeUsd;
  const top = hi ?? lo ?? (q.pricingType === 'inspection_only' ? fee : null);
  if (top == null) return null;
  const priceText = lo != null && hi != null && lo !== hi ? `$${lo}–$${hi}` : lo != null || hi != null ? `$${lo ?? hi}` : `$${fee} inspection visit`;
  const windows = (q.availability || []).map(text => slotWindow(text, now)).filter(w => w && Date.parse(w.start) > now.getTime());
  return {
    id: c.id, providerId: c.providerId, name: meta.name ?? c.providerId, initial: (meta.name ?? '?')[0],
    rating: meta.rating ?? '–', reviews: meta.reviewCount ?? 0,
    amountCents: Math.round(top * 100), currency: 'USD', priceText, feeText: feeText({ ...q, feeTreatment: c.quoteResult?.feeTreatment ?? q.feeTreatment }),
    scope: q.scope, conditions: q.conditions, warranty: q.warranty || 'No warranty stated',
    windows, window: windows.length ? windows[0].text : 'Availability not given',
    offeredTimes: q.availability || [], provisional: q.needsInspection || q.pricingType === 'inspection_only',
    quoteRevision: c.quoteRevision ?? null, transcriptId: c.id,
    expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
    source: 'live:claude-extraction', demo: false, live: true
  };
}

export function toDiscovery(req, providers) {
  const meta = id => providers.find(p => p.id === id) || {};
  const called = new Set((req.calls || []).filter(c => c.purpose === 'quote').map(c => c.providerId));
  return {
    source: 'live:keewano-ranking', live: true, demo: false,
    providers: (req.rankedProviders || []).map(s => ({
      id: s.providerId, name: meta(s.providerId).name ?? s.providerId, rating: meta(s.providerId).rating, reviews: meta(s.providerId).reviewCount,
      score: s.score, reason: s.reason, called: called.has(s.providerId)
    })),
    repairHistory: req.unitInsight && req.unitInsight.priorIssuesSameTrade180d > 0 ? req.unitInsight.note : null,
    notice: req.notice ?? null
  };
}
