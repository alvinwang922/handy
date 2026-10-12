import { randomUUID } from 'node:crypto';
import { createStore } from './store.js';
import { AppError, requireCondition, text, validateIssue } from './validation.js';
import { assess } from './integrations/assessment.js';
import { discover } from './integrations/darwin.js';
import { requestEstimate, scheduleCall } from './integrations/dial.js';
import { analytics } from './integrations/keewano.js';
import { createHandoff } from './integrations/alike.js';
import { LIVE_PROPERTIES, slotWindow, toAssessment, toCall, toDiscovery, toQuote } from './integrations/live.js';

export const properties = [
  { id: 'p1', name: 'Maple House', address: '124 Maple Avenue', unit: 'Main home', tenant: 'Jamie Chen', serviceArea: 'Demo Bay Area', home: true, demo: true },
  { id: 'p2', name: 'Oak Street Duplex', address: '86 Oak Street', unit: 'Unit 2B', tenant: 'Taylor Reed', serviceArea: 'Demo Bay Area', demo: true },
  { id: 'p3', name: 'Cedar Cottage', address: '32 Cedar Lane', unit: 'Unit 1', tenant: 'Sam Rivera', serviceArea: 'Demo Bay Area', demo: true }
];
export const demoActor = { id: 'u-demo', name: 'Jamie Chen', demo: true };
const liveActor = { id: 'handy-live', name: 'Handy', demo: false };
// Statuses while real calls run; the UI polls a repair in either one.
export const LIVE_PENDING = ['quoting', 'booking'];

// `live` is a client from integrations/live.js (INTEGRATION_MODE=live) or null for the scripted demo.
// In live mode, repairs on the backend's properties (p1–p3) use real Claude, Keewano and Dial; houses
// added in Settings and the seeded samples stay demo and are labeled so.
export function createHandy({ dataPath = 'data/handy.sqlite', seed = true, live = null } = {}) {
  const store = createStore(dataPath);
  const getRepair = id => { const r = store.get(id); if (!r) throw new AppError(404, 'Repair not found.'); return r; };
  const record = (repair, type, actor, payload = {}, source = 'handy:orchestrator') => {
    store.append({ id: randomUUID(), repairId: repair.id, propertyId: repair.property,
      providerId: payload.providerId ?? repair.approval?.providerId ?? null, userId: actor.id,
      type, actor, timestamp: new Date().toISOString(), payload, source, demo: !repair.live });
  };
  function mutate(id, actor, fn) {
    return store.transaction(() => {
      const r = getRepair(id);
      fn(r, (type, payload, source) => record(r, type, actor, payload, source));
      r.updatedAt = new Date().toISOString(); r.revision += 1;
      store.put(r); return r;
    });
  }
  const allProperties = () => [...properties, ...store.houses()];
  function clearCommitments(r) {
    if (r.quotes.length || r.outreach.length) r.rounds = [...(r.rounds ?? []), { outreach: r.outreach, quotes: r.quotes, approval: r.approval, booking: r.booking, endedAt: new Date().toISOString() }];
    r.approval = null; r.booking = null; r.appointment = null; r.provider = null;
    r.quotes = []; r.outreach = []; r.discovery = null; r.schedulingCall = null; r.access = '';
    r.status = r.assessment.hazard ? 'hazard' : 'assessment';
  }
  function insertRepair(fields, assessment, actor, extra = {}) {
    return store.transaction(() => {
      const r = { ...fields, id: randomUUID(), assessment, category: assessment.category,
        status: assessment.hazard ? 'hazard' : 'assessment', createdAt: new Date().toISOString(), created: 'Today',
        updatedAt: new Date().toISOString(), revision: 1, demo: !extra.live, quotes: [], outreach: [], discovery: null,
        approval: null, booking: null, appointment: null, provider: null, access: '', schedulingCall: null, ...extra };
      store.put(r); record(r, 'issue.created', actor, { room: r.room, urgency: r.urgency });
      fields.photos.forEach((_, index) => record(r, 'photo.added', actor, { index, demoPhoto: fields.photos[index] === '/assets/sample-sink.svg' }));
      record(r, 'assessment.proposed', actor, { category: r.category, hazard: assessment.hazard }, assessment.source);
      if (assessment.hazard) record(r, 'hazard.flagged', actor, { normalFlowBlocked: true });
      return r;
    });
  }
  // Same rules for demo and live: an approved, unexpired quote and future windows that provider offered.
  function checkBooking(r, input) {
    requireCondition(r.status === 'scheduling' && r.approval, 'An explicit provider and price approval is required before scheduling.', 409);
    const quote = r.quotes.find(q => q.id === r.approval.quoteId);
    requireCondition(quote && quote.providerId === r.approval.providerId && quote.amountCents === r.approval.amountCents, 'Approval no longer matches the quote.', 409);
    requireCondition(Date.parse(quote.expiresAt) > Date.now(), 'Quote expired. Reopen quoting for updated estimates.', 409);
    const windows = input?.windows;
    requireCondition(Array.isArray(windows) && windows.length > 0 && windows.length <= 6, 'Choose one or more offered time windows.');
    requireCondition(windows.every(w => w && quote.windows.some(offered => offered.start === w.start && offered.end === w.end) && Date.parse(w.start) > Date.now()), 'Every time window must be a future window offered by the approved provider.');
    requireCondition(input.access === undefined || typeof input.access === 'string', 'Access instructions must be text.');
    const access = input.access?.trim() ?? ''; requireCondition(access.length <= 1200, 'Access instructions must be under 1200 characters.');
    const sorted = [...windows].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      .map(w => quote.windows.find(offered => offered.start === w.start && offered.end === w.end));
    return { quote, windows: sorted, access };
  }

  /* ---------- Live mode ---------- */
  let providerCache = null;
  const providerList = async () => (providerCache ??= await live.providers());
  // 409 "already in progress or done" (a retry, or two tabs): resume from the backend's state.
  const resumable = (e, statuses) => e instanceof AppError && e.status === 409 && new RegExp(`currently '(${statuses})'`).test(e.message);

  // Folds the backend's request into the Look B repair; records each real event once (r.live.seen).
  function applyLive(r, req, providers, event) {
    const meta = id => providers.find(p => p.id === id) || {};
    const seen = new Set(r.live.seen || []);
    const once = (key, fn) => { if (!seen.has(key)) { seen.add(key); fn(); } };
    const quoteCalls = (req.calls || []).filter(c => c.purpose === 'quote');
    r.discovery = toDiscovery(req, providers);
    r.outreach = quoteCalls.map(c => toCall(c, meta(c.providerId)));
    r.outreach.filter(c => c.status !== 'in_progress' && c.liveStage !== 'read').forEach(c => once(`call:${c.id}`, () =>
      event(c.status === 'completed' ? 'call.completed' : 'call.unanswered', { providerId: c.providerId, callId: c.id, purpose: 'estimate', durationSeconds: c.durationSeconds }, c.source)));
    r.live.notice = req.notice ?? null;
    r.live.backendStatus = req.status;
    if (r.status === 'quoting' && (req.status === 'quotes_ready' || req.status === 'failed')) {
      r.quotes = quoteCalls.map(c => toQuote(c, meta(c.providerId))).filter(Boolean);
      r.quotes.forEach(q => once(`quote:${q.id}`, () => event('quote.received', { providerId: q.providerId, quoteId: q.id, amountCents: q.amountCents, priceText: q.priceText }, q.source)));
      r.status = 'quotes'; event('quotes.ready', { count: r.quotes.length }, 'live:claude-extraction');
    } else if (r.status === 'booking') {
      const bc = (req.calls || []).filter(c => c.purpose === 'booking').at(-1);
      if (bc) r.schedulingCall = toCall(bc, meta(bc.providerId), 'scheduling');
      if (req.status === 'scheduled') {
        const text = req.scheduledSlot || r.live.slots?.[0];
        const window = (r.live.windows || []).find(w => w.text === text) || slotWindow(text) || r.live.windows?.[0];
        r.booking = { id: randomUUID(), providerId: r.approval.providerId, quoteId: r.approval.quoteId, approvalId: r.approval.id,
          propertyId: r.property, amountCents: r.approval.amountCents, window: { start: window.start, end: window.end }, slotText: text,
          access: r.access, status: 'confirmed', timestamp: new Date().toISOString(), demo: false, live: true };
        r.appointment = text;
        r.status = 'scheduled';
        once(`booked:${bc?.id}`, () => {
          event('call.completed', { providerId: r.approval.providerId, callId: bc?.id ?? null, purpose: 'scheduling', durationSeconds: bc?.durationSec ?? null }, 'live:dial-call');
          event('appointment.confirmed', { appointmentId: r.booking.id, approvalId: r.approval.id, window: r.booking.window }, 'live:dial-call');
          event('handoff.created', { nextAction: 'Provider visit pending.' }, 'local:alike-handoff');
        });
      } else if (req.status === 'quotes_ready') {
        // The provider didn't confirm a window: the approval stands; the user picks other times.
        r.status = 'scheduling';
        event('booking.not_confirmed', { notice: req.notice ?? null }, 'live:dial-call');
      }
    }
    r.live.seen = [...seen];
  }

  async function createLive(fields, actor) {
    const property = allProperties().find(p => p.id === fields.property);
    const req = await live.create(fields, property);
    return insertRepair(fields, toAssessment(req), actor, { live: { requestId: req.id, outreachStarted: false, seen: [] } });
  }
  async function liveQuotes(r0, actor) {
    requireCondition(!r0.assessment.hazard, 'Possible emergency hazard. Normal provider outreach is blocked.', 409);
    if (r0.status === 'quotes' || r0.status === 'quoting') return r0;
    requireCondition(r0.status === 'assessment', 'Reopen quoting before requesting new estimates.', 409);
    let requestId = r0.live.requestId;
    // After "Get new prices" the backend request has finished its calls; a fresh one starts a new round.
    if (r0.live.outreachStarted) requestId = (await live.create(r0, allProperties().find(p => p.id === r0.property))).id;
    let req;
    try { req = await live.outreach(requestId); }
    catch (e) { if (resumable(e, 'quoting|quotes_ready')) req = await live.get(requestId); else throw e; }
    const providers = await providerList();
    return mutate(r0.id, actor, (r, event) => {
      requireCondition(r.status === 'assessment', 'Prices were already requested.', 409);
      r.live = { ...r.live, requestId, outreachStarted: true, seen: [], slots: null, windows: null };
      r.status = 'quoting';
      event('outreach.started', { ranked: (req.rankedProviders || []).length }, 'live:keewano-ranking');
      applyLive(r, req, providers, event);
    });
  }
  async function liveBook(r0, input, actor) {
    const { quote, windows, access } = checkBooking(r0, input);
    const slots = windows.map(w => w.text);
    let req;
    try {
      req = await live.book(r0.live.requestId, { providerId: quote.providerId, quoteCallId: quote.id, quoteRevision: quote.quoteRevision, slots, accessNote: access, userActiveSec: 0 });
    } catch (e) { if (resumable(e, 'booking|scheduled')) req = await live.get(r0.live.requestId); else throw e; }
    const providers = await providerList();
    return mutate(r0.id, actor, (r, event) => {
      checkBooking(r, input);
      r.access = access; r.live = { ...r.live, slots, windows };
      event('availability.submitted', { windows: windows.map(({ start, end }) => ({ start, end })), accessProvided: Boolean(access) });
      r.status = 'booking';
      applyLive(r, req, providers, event);
    });
  }

  /* ---------- Demo mode (scripted integrations) ---------- */
  function demoQuotes(id, actor) {
    const existing = getRepair(id);
    requireCondition(!existing.assessment.hazard, 'Possible emergency hazard. Normal provider outreach is blocked.', 409);
    if (existing.status === 'quotes') return existing;
    requireCondition(existing.status === 'assessment', 'Reopen quoting before requesting new estimates.', 409);
    return mutate(id, actor, (r, event) => {
      const property = allProperties().find(p => p.id === r.property);
      const brief = { repairId: r.id, title: r.title, description: r.description, category: r.category,
        trade: r.assessment.trade, scope: r.assessment.scope, room: r.room, urgency: r.urgency, serviceArea: property.serviceArea };
      r.discovery = discover(brief);
      for (const provider of r.discovery.providers) {
        event('provider.discovered', { providerId: provider.id, capabilityId: provider.capabilityId, revision: provider.revision }, r.discovery.source);
        const { call, quote } = requestEstimate(provider, brief); r.outreach.push(call);
        event(call.status === 'completed' ? 'call.completed' : 'call.unanswered', { providerId: provider.id, callId: call.id, purpose: 'estimate', durationSeconds: call.durationSeconds }, call.source);
        if (quote) { r.quotes.push(quote); event('quote.received', { providerId: provider.id, quoteId: quote.id, amountCents: quote.amountCents }, quote.source); }
      }
      r.status = 'quotes'; event('quotes.ready', { count: r.quotes.length });
    });
  }
  function demoBook(id, input, actor) {
    return mutate(id, actor, (r, event) => {
      const { quote, windows, access } = checkBooking(r, input);
      const window = { start: windows[0].start, end: windows[0].end };
      r.access = access; event('availability.submitted', { windows: input.windows, accessProvided: Boolean(access) });
      r.schedulingCall = scheduleCall(quote, window, access, r.approval);
      event('call.completed', { providerId: quote.providerId, callId: r.schedulingCall.id, purpose: 'scheduling' }, r.schedulingCall.source);
      r.booking = { id: randomUUID(), providerId: quote.providerId, quoteId: quote.id, approvalId: r.approval.id,
        propertyId: r.property, amountCents: r.approval.amountCents, window, access, status: 'confirmed', timestamp: new Date().toISOString(), demo: true };
      r.appointment = `${new Date(window.start).toLocaleString('en-US')} – ${new Date(window.end).toLocaleTimeString('en-US')}`;
      r.status = 'scheduled'; event('appointment.confirmed', { appointmentId: r.booking.id, approvalId: r.approval.id, window });
      event('handoff.created', { nextAction: 'Provider visit pending.' }, 'demo:alike-local-handoff');
    });
  }

  const app = {
    mode: live ? 'live' : 'demo',
    close: () => store.close(),
    properties: () => structuredClone(allProperties()),
    addProperty(input) {
      requireCondition(input && typeof input === 'object' && !Array.isArray(input), 'A house object is required.');
      const name = text(input.name, 'House name', 80), address = text(input.address, 'Address', 160);
      const unit = input.unit ? text(input.unit, 'Unit', 60) : 'Main home';
      const tenant = input.tenant ? text(input.tenant, 'Tenant', 80) : '';
      const house = { id: `h-${randomUUID().slice(0, 8)}`, name, address, unit, tenant, serviceArea: 'Demo Bay Area', home: input.home === true, demo: true };
      store.transaction(() => store.putHouse(house));
      return house;
    },
    getRepair,
    listRepairs: () => store.list(),
    timeline(id) { getRepair(id); return store.events(id); },
    metrics: () => analytics(store.events()),
    handoff(id) { const r = getRepair(id); return createHandoff(r, allProperties().find(p => p.id === r.property)); },
    // Live repairs on the backend's properties return a Promise; everything else stays synchronous.
    createRepair(input, actor = demoActor) {
      const fields = validateIssue(input, allProperties());
      if (live && LIVE_PROPERTIES.has(fields.property)) return createLive(fields, actor);
      return insertRepair(fields, assess(fields), actor);
    },
    getQuotes(id, actor = demoActor) {
      const r = getRepair(id);
      return r.live ? liveQuotes(r, actor) : demoQuotes(id, actor);
    },
    approve(id, input, actor = demoActor) {
      return mutate(id, actor, (r, event) => {
        requireCondition(r.status === 'quotes' && !r.approval, 'A provider is already approved or quotes are unavailable. Reopen quoting to change provider.', 409);
        requireCondition(input?.consent === true, 'Explicit consent is required.');
        const quote = r.quotes.find(q => q.id === input.quoteId);
        requireCondition(quote, 'Quote not found for this repair.', 404);
        requireCondition(Number.isSafeInteger(input.amountCents) && input.amountCents === quote.amountCents, 'Approved amount must match the quote.');
        requireCondition(Date.parse(quote.expiresAt) > Date.now(), 'Quote expired. Reopen quoting for updated estimates.', 409);
        r.approval = { id: randomUUID(), userId: actor.id, quoteId: quote.id, providerId: quote.providerId,
          providerName: quote.name, amountCents: quote.amountCents, priceText: quote.priceText ?? null, currency: quote.currency, timestamp: new Date().toISOString(),
          consentText: 'I approve this provider and provisional estimate. Additional work requires new approval.', demo: !r.live };
        r.provider = r.quotes.indexOf(quote); r.status = 'scheduling';
        event('quote.approved', { approvalId: r.approval.id, quoteId: quote.id, providerId: quote.providerId, amountCents: quote.amountCents, priceText: quote.priceText ?? null, consentText: r.approval.consentText });
      });
    },
    book(id, input, actor = demoActor) {
      const r = getRepair(id);
      return r.live ? liveBook(r, input, actor) : demoBook(id, input, actor);
    },
    // Pulls a live repair's progress from the backend while its calls run. Writes only on change.
    async sync(id) {
      const r0 = getRepair(id);
      if (!live || !r0.live || !LIVE_PENDING.includes(r0.status)) return r0;
      const [req, providers] = await Promise.all([live.get(r0.live.requestId), providerList()]);
      const probe = structuredClone(r0); let events = 0;
      applyLive(probe, req, providers, () => { events++; });
      if (!events && JSON.stringify(probe) === JSON.stringify(r0)) return r0;
      return mutate(id, liveActor, (r, event) => { if (LIVE_PENDING.includes(r.status)) applyLive(r, req, providers, event); });
    },
    async syncAll() {
      if (!live) return;
      for (const r of store.list().filter(x => x.live && LIVE_PENDING.includes(x.status))) {
        try { await app.sync(r.id); } catch { /* the backend is unreachable: show the last known state */ }
      }
    },
    reschedule(id, actor = demoActor) {
      requireCondition(!getRepair(id).live, 'Changing a live booking isn’t supported yet. Call the provider, or tap “Get new prices” to start over.', 409);
      return mutate(id, actor, (r, event) => {
        requireCondition(r.status === 'scheduled' && r.approval, 'Only confirmed appointments can be rescheduled.', 409);
        r.status = 'scheduling'; event('appointment.reschedule_requested', { previousWindow: r.booking.window });
      });
    },
    complete(id, actor = demoActor) {
      return mutate(id, actor, (r, event) => {
        requireCondition(r.status === 'scheduled', 'Only scheduled repairs can be marked complete.', 409);
        r.status = 'complete'; r.booking.status = 'complete'; event('repair.completed', { appointmentId: r.booking.id });
      });
    },
    reopen(id, actor = demoActor) {
      return mutate(id, actor, (r, event) => {
        requireCondition(r.status !== 'complete', 'Completed repairs cannot be reopened. Report a new issue.', 409);
        requireCondition(!LIVE_PENDING.includes(r.status), 'Handy is on a call right now. Wait for it to finish.', 409);
        event('quotes.reopened', { previousApprovalId: r.approval?.id ?? null, previousAppointmentId: r.booking?.id ?? null });
        clearCommitments(r);
      });
    },
    updateRepair(id, input, actor = demoActor) {
      requireCondition(input && typeof input === 'object' && !Array.isArray(input), 'Issue changes must be an object.');
      requireCondition(!getRepair(id).live, 'A live repair can’t be edited yet. Report a new issue instead.', 409);
      return mutate(id, actor, (r, event) => {
        requireCondition(!['scheduled', 'complete'].includes(r.status), 'Reopen quoting before changing a scheduled repair scope.', 409);
        const fields = validateIssue({ ...r, description: input.description === undefined ? r.description : text(input.description, 'Description'), urgency: input.urgency ?? r.urgency }, allProperties());
        Object.assign(r, fields); r.assessment = assess(fields); r.category = r.assessment.category;
        clearCommitments(r); event('issue.updated', { quotesInvalidated: true });
        event('assessment.proposed', { category: r.category, hazard: r.assessment.hazard }, r.assessment.source);
        if (r.assessment.hazard) event('hazard.flagged', { normalFlowBlocked: true });
      });
    },
    resetDemo() { store.transaction(() => store.clear()); seedDemo(); return app.listRepairs(); }
  };
  // Seeded samples always use the scripted demo, even in live mode (no real calls on startup).
  function seedDemo() {
    const sample = input => { const fields = validateIssue(input, allProperties()); return insertRepair(fields, assess(fields), demoActor); };
    const sink = sample({ title: 'Leak under the kitchen sink', description: 'A slow drip from the sink drain is making the cabinet floor damp.', property: 'p1', room: 'Kitchen', urgency: 'Soon', photos: [] });
    demoQuotes(sink.id, demoActor);
    const cooling = sample({ title: 'AC is not cooling properly', description: 'The air conditioner runs but the air is not getting cold.', property: 'p2', room: 'Living room', urgency: 'Routine', photos: [] });
    const quoted = demoQuotes(cooling.id, demoActor), q = quoted.quotes[1];
    app.approve(cooling.id, { quoteId: q.id, amountCents: q.amountCents, consent: true });
    demoBook(cooling.id, { windows: [q.windows[0]], access: 'Tenant will be home. Call on arrival.' }, demoActor);
    sample({ title: 'Bedroom door will not latch', description: 'The bedroom door catches on the frame and will not latch closed.', property: 'p1', room: 'Bedroom', urgency: 'Routine', photos: [] });
  }
  if (seed && !app.listRepairs().length) seedDemo();
  return app;
}
