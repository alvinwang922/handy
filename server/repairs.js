import { randomUUID } from 'node:crypto';
import { createStore } from './store.js';
import { AppError, requireCondition, text, validateIssue } from './validation.js';
import { assess } from './integrations/assessment.js';
import { discover } from './integrations/darwin.js';
import { requestEstimate, scheduleCall } from './integrations/dial.js';
import { analytics } from './integrations/keewano.js';
import { createHandoff } from './integrations/alike.js';

export const properties = [
  { id: 'p1', name: 'Maple House', address: '124 Maple Avenue', unit: 'Main home', tenant: 'Jamie Chen', serviceArea: 'Demo Bay Area', demo: true },
  { id: 'p2', name: 'Oak Street Duplex', address: '86 Oak Street', unit: 'Unit 2B', tenant: 'Taylor Reed', serviceArea: 'Demo Bay Area', demo: true },
  { id: 'p3', name: 'Cedar Cottage', address: '32 Cedar Lane', unit: 'Unit 1', tenant: 'Sam Rivera', serviceArea: 'Demo Bay Area', demo: true }
];
export const demoActor = { id: 'u-demo', name: 'Jamie Chen', demo: true };

export function createHandy({ dataPath = 'data/handy.sqlite', seed = true } = {}) {
  const store = createStore(dataPath);
  const getRepair = id => { const r = store.get(id); if (!r) throw new AppError(404, 'Repair not found.'); return r; };
  const record = (repair, type, actor, payload = {}, source = 'handy:orchestrator') => {
    store.append({ id: randomUUID(), repairId: repair.id, propertyId: repair.property,
      providerId: payload.providerId ?? repair.approval?.providerId ?? null, userId: actor.id,
      type, actor, timestamp: new Date().toISOString(), payload, source, demo: true });
  };
  function mutate(id, actor, fn) {
    return store.transaction(() => {
      const r = getRepair(id);
      fn(r, (type, payload, source) => record(r, type, actor, payload, source));
      r.updatedAt = new Date().toISOString(); r.revision += 1;
      store.put(r); return r;
    });
  }
  function clearCommitments(r) {
    r.approval = null; r.booking = null; r.appointment = null; r.provider = null;
    r.quotes = []; r.outreach = []; r.discovery = null; r.schedulingCall = null; r.access = '';
    r.status = r.assessment.hazard ? 'hazard' : 'assessment';
  }
  const app = {
    close: () => store.close(),
    properties: () => structuredClone(properties),
    getRepair,
    listRepairs: () => store.list(),
    timeline(id) { getRepair(id); return store.events(id); },
    metrics: () => analytics(store.events()),
    handoff(id) { const r = getRepair(id); return createHandoff(r, properties.find(p => p.id === r.property)); },
    createRepair(input, actor = demoActor) {
      const fields = validateIssue(input, properties), assessment = assess(fields);
      return store.transaction(() => {
        const r = { ...fields, id: randomUUID(), assessment, category: assessment.category,
          status: assessment.hazard ? 'hazard' : 'assessment', createdAt: new Date().toISOString(), created: 'Today',
          updatedAt: new Date().toISOString(), revision: 1, demo: true, quotes: [], outreach: [], discovery: null,
          approval: null, booking: null, appointment: null, provider: null, access: '', schedulingCall: null };
        store.put(r); record(r, 'issue.created', actor, { room: r.room, urgency: r.urgency });
        fields.photos.forEach((_, index) => record(r, 'photo.added', actor, { index, demoPhoto: fields.photos[index] === '/assets/sample-sink.svg' }));
        record(r, 'assessment.proposed', actor, { category: r.category, hazard: assessment.hazard }, assessment.source);
        if (assessment.hazard) record(r, 'hazard.flagged', actor, { normalFlowBlocked: true });
        return r;
      });
    },
    getQuotes(id, actor = demoActor) {
      const existing = getRepair(id);
      requireCondition(!existing.assessment.hazard, 'Possible emergency hazard. Normal provider outreach is blocked.', 409);
      if (existing.status === 'quotes') return existing;
      requireCondition(existing.status === 'assessment', 'Reopen quoting before requesting new estimates.', 409);
      return mutate(id, actor, (r, event) => {
        const property = properties.find(p => p.id === r.property);
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
          providerName: quote.name, amountCents: quote.amountCents, currency: quote.currency, timestamp: new Date().toISOString(),
          consentText: 'I approve this provider and provisional estimate. Additional work requires new approval.', demo: true };
        r.provider = r.quotes.indexOf(quote); r.status = 'scheduling';
        event('quote.approved', { approvalId: r.approval.id, quoteId: quote.id, providerId: quote.providerId, amountCents: quote.amountCents, consentText: r.approval.consentText });
      });
    },
    book(id, input, actor = demoActor) {
      return mutate(id, actor, (r, event) => {
        requireCondition(r.status === 'scheduling' && r.approval, 'An explicit provider and price approval is required before scheduling.', 409);
        const quote = r.quotes.find(q => q.id === r.approval.quoteId);
        requireCondition(quote && quote.providerId === r.approval.providerId && quote.amountCents === r.approval.amountCents, 'Approval no longer matches the quote.', 409);
        requireCondition(Date.parse(quote.expiresAt) > Date.now(), 'Quote expired. Reopen quoting for updated estimates.', 409);
        const windows = input?.windows;
        requireCondition(Array.isArray(windows) && windows.length > 0 && windows.length <= 6, 'Choose one or more offered time windows.');
        requireCondition(windows.every(w => w && quote.windows.some(offered => offered.start === w.start && offered.end === w.end) && Date.parse(w.start) > Date.now()), 'Every time window must be a future window offered by the approved provider.');
        requireCondition(input.access === undefined || typeof input.access === 'string', 'Access instructions must be text.');
        const access = input.access?.trim() ?? ''; requireCondition(access.length <= 1200, 'Access instructions must be under 1200 characters.');
        const window = [...windows].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
        r.access = access; event('availability.submitted', { windows, accessProvided: Boolean(access) });
        r.schedulingCall = scheduleCall(quote, window, access, r.approval);
        event('call.completed', { providerId: quote.providerId, callId: r.schedulingCall.id, purpose: 'scheduling' }, r.schedulingCall.source);
        r.booking = { id: randomUUID(), providerId: quote.providerId, quoteId: quote.id, approvalId: r.approval.id,
          propertyId: r.property, amountCents: r.approval.amountCents, window, access, status: 'confirmed', timestamp: new Date().toISOString(), demo: true };
        r.appointment = `${new Date(window.start).toLocaleString('en-US')} – ${new Date(window.end).toLocaleTimeString('en-US')}`;
        r.status = 'scheduled'; event('appointment.confirmed', { appointmentId: r.booking.id, approvalId: r.approval.id, window });
        event('handoff.created', { nextAction: 'Provider visit pending.' }, 'demo:alike-local-handoff');
      });
    },
    reschedule(id, actor = demoActor) {
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
        event('quotes.reopened', { previousApprovalId: r.approval?.id ?? null, previousAppointmentId: r.booking?.id ?? null });
        clearCommitments(r);
      });
    },
    updateRepair(id, input, actor = demoActor) {
      requireCondition(input && typeof input === 'object' && !Array.isArray(input), 'Issue changes must be an object.');
      return mutate(id, actor, (r, event) => {
        requireCondition(!['scheduled', 'complete'].includes(r.status), 'Reopen quoting before changing a scheduled repair scope.', 409);
        const fields = validateIssue({ ...r, description: input.description === undefined ? r.description : text(input.description, 'Description'), urgency: input.urgency ?? r.urgency }, properties);
        Object.assign(r, fields); r.assessment = assess(fields); r.category = r.assessment.category;
        clearCommitments(r); event('issue.updated', { quotesInvalidated: true });
        event('assessment.proposed', { category: r.category, hazard: r.assessment.hazard }, r.assessment.source);
        if (r.assessment.hazard) event('hazard.flagged', { normalFlowBlocked: true });
      });
    },
    resetDemo() { store.transaction(() => store.clear()); seedDemo(); return app.listRepairs(); }
  };
  function seedDemo() {
    const sink = app.createRepair({ title: 'Leak under the kitchen sink', description: 'A slow drip from the sink drain is making the cabinet floor damp.', property: 'p1', room: 'Kitchen', urgency: 'Soon', photos: [] });
    app.getQuotes(sink.id);
    const cooling = app.createRepair({ title: 'AC is not cooling properly', description: 'The air conditioner runs but the air is not getting cold.', property: 'p2', room: 'Living room', urgency: 'Routine', photos: [] });
    const quoted = app.getQuotes(cooling.id), q = quoted.quotes[1];
    app.approve(cooling.id, { quoteId: q.id, amountCents: q.amountCents, consent: true });
    app.book(cooling.id, { windows: [q.windows[0]], access: 'Tenant will be home. Call on arrival.' });
    app.createRepair({ title: 'Bedroom door will not latch', description: 'The bedroom door catches on the frame and will not latch closed.', property: 'p1', room: 'Bedroom', urgency: 'Routine', photos: [] });
  }
  if (seed && !app.listRepairs().length) seedDemo();
  return app;
}
