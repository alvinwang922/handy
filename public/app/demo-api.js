/* Handy presentation demo API.
   Runs entirely in the browser. It mirrors the app's JSON contract but never contacts
   Claude, Dial, Keewano, Darwin, Alike, a provider, or any other external service. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HandyDemoApi = api.create();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const properties = [
    { id:'p1', name:'Maple House', address:'124 Maple Avenue', unit:'Main home', tenant:'Jamie Chen', serviceArea:'Demo Bay Area', home:true, demo:true },
    { id:'p2', name:'Oak Street Duplex', address:'86 Oak Street', unit:'Unit 2B', tenant:'Taylor Reed', serviceArea:'Demo Bay Area', demo:true },
    { id:'p3', name:'Cedar Cottage', address:'32 Cedar Lane', unit:'Unit 1', tenant:'Sam Rivera', serviceArea:'Demo Bay Area', demo:true }
  ];
  const actor = { id:'u-demo', name:'Jamie Chen', demo:true };
  const integrations = [
    { name:'Claude', mode:'demo', detail:'Scripted assessment and quote extraction. No model request is made.' },
    { name:'Dial', mode:'demo', detail:'Scripted quote and booking conversations. No call or message is sent.' },
    { name:'Keewano', mode:'demo', detail:'Deterministic provider ranking and local event metrics.' },
    { name:'Alike', mode:'demo', detail:'A local handoff preview only. No session data is uploaded.' }
  ];
  const directory = {
    plumbing: [
      ['Clearwater Plumbing',185,40,'4.9',128,'Tomorrow',90],
      ['Oak & Pipe Services',215,45,'4.8',86,'Tomorrow',60],
      ['Neighborhood Fix',160,35,'4.7',204,'In 2 days',30]
    ],
    hvac: [
      ['Evergreen Heating & Air',240,60,'4.9',112,'Tomorrow',90],
      ['Comfort Air Co.',195,40,'4.8',94,'Tomorrow',60],
      ['Neighborhood HVAC',220,50,'4.7',77,'In 2 days',30]
    ],
    electrical: [
      ['Maple Electric',210,40,'4.9',101,'Tomorrow',90],
      ['Neighborhood Electric',185,35,'4.8',74,'Tomorrow',60],
      ['Oak Electrical Services',235,45,'4.7',63,'In 2 days',30]
    ],
    general: [
      ['Maple Home Services',120,20,'4.9',156,'Tomorrow',90],
      ['Everyday Handyman',95,15,'4.8',119,'Tomorrow',60],
      ['Neighborhood Fix',140,25,'4.7',204,'In 2 days',30]
    ]
  };

  const copy = value => typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
  const uid = prefix => `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const appError = (status, message) => { const error = new Error(message); error.status = status; return error; };
  const futureWindow = (days, hour) => {
    const start = new Date(); start.setDate(start.getDate() + days); start.setHours(hour, 0, 0, 0);
    const end = new Date(start); end.setHours(hour + 2);
    return { start:start.toISOString(), end:end.toISOString() };
  };
  const windows = offset => [offset, offset + 1].flatMap(day => [9, 11, 13, 15].map(hour => futureWindow(day, hour)));

  function assessmentFor(input) {
    const words = `${input.title || ''} ${input.description || ''}`.toLowerCase();
    const hazard = /gas.{0,30}(smell|odor|leak)|(?:smell|odor).{0,30}gas|\bfire\b|\bsmoke\b|\bspark(?:s|ing)?\b|major.{0,15}flood/.test(words);
    const category = /air conditioner|\bac\b|cooling|heating|hvac|thermostat/.test(words) ? 'hvac'
      : /sink|drip|water|leak|pipe|toilet|faucet|drain/.test(words) ? 'plumbing'
      : /electri|outlet|breaker|light switch/.test(words) ? 'electrical' : 'general';
    const scenarios = {
      plumbing:['Possible loose drain connection','The photo and description suggest a loose drain fitting or worn seal. A plumber should confirm the source.','Inspect the drain connection and nearby fittings; quote a minor fitting or seal repair.','Plumber'],
      hvac:['Heating or cooling inspection needed','Airflow, thermostat, and system faults can look alike. A professional should confirm the cause.','Inspect airflow, thermostat, filters, and system operation.','HVAC technician'],
      electrical:['Electrical inspection recommended','An electrician should inspect the reported issue before repairs.','Inspect the reported electrical issue and quote the repair.','Electrician'],
      general:['Professional inspection recommended','A handyman should confirm the cause and final scope on site.','Inspect the reported issue and quote a minor adjustment or repair.','Handyman']
    };
    const [title, text, scope, trade] = scenarios[category];
    return { category, title:hazard ? 'Possible urgent hazard — stop the repair workflow' : title,
      text:hazard ? 'Leave the affected area if unsafe and contact local emergency or utility services.' : text,
      scope, trade, confidence:'Unverified demo assessment', hazard, demo:true,
      source:'demo:browser-assessment', disclaimer:'Presentation demo only. A professional must confirm diagnosis and scope.' };
  }

  function create() {
    let repairs = [], extraProperties = [], sequence = 0;
    const allProperties = () => [...properties, ...extraProperties];
    const find = id => repairs.find(repair => repair.id === id);
    const requireRepair = id => { const repair = find(id); if (!repair) throw appError(404, 'Repair not found.'); return repair; };
    const event = (repair, type, payload = {}, source = 'demo:browser-orchestrator') => {
      repair.events.push({ id:uid('event'), repairId:repair.id, propertyId:repair.property, userId:actor.id,
        type, actor, timestamp:new Date().toISOString(), payload, source, sequence:++sequence, demo:true });
    };
    const handoff = repair => {
      const property = allProperties().find(item => item.id === repair.property) || {};
      const next = { assessment:'Collect provider estimates.', quotes:'Compare the estimates and approve one.', scheduling:'Confirm an offered appointment window.', scheduled:'Provider visit pending.', complete:'No further coordination required.', hazard:'Follow the safety guidance.' }[repair.status];
      return { source:'demo:browser-handoff', demo:true, owner:repair.status === 'scheduled' ? 'Approved demo provider' : 'Demo homeowner',
        nextAction:next, blockers:repair.status === 'hazard' ? ['Urgent hazard'] : !repair.approval ? ['Explicit approval required before scheduling'] : [],
        brief:[`Repair: ${repair.title}`, `Property: ${property.name || 'Demo property'}`, `Status: ${repair.status}`, `Next: ${next}`, 'Browser-only demo; no external service was contacted.'].join('\n') };
    };
    const enrich = repair => ({ ...copy(repair), handoff:handoff(repair) });
    const touch = repair => { repair.updatedAt = new Date().toISOString(); repair.revision += 1; };

    function metrics() {
      const active = repairs.filter(repair => repair.status !== 'complete');
      const calls = repairs.flatMap(repair => repair.outreach || []);
      const approved = repairs.filter(repair => repair.approval).length;
      const booked = repairs.filter(repair => repair.booking).length;
      return { source:'demo:browser-events', demo:true, issuesSubmitted:repairs.length,
        quotedRepairs:repairs.filter(repair => repair.quotes.length).length, approvedRepairs:approved,
        confirmedAppointments:booked, multipleQuoteRepairs:repairs.filter(repair => repair.quotes.length >= 2).length,
        providerResponseRate:calls.length ? calls.filter(call => call.status === 'completed').length / calls.length : null,
        quoteToBookingConversion:approved ? booked / approved : null, medianTimeToFirstQuoteSeconds:2,
        medianApprovalToBookingSeconds:1, activeCoordinationTime:null, activeRepairs:active.length,
        note:'Browser-only presentation data. No live service calls and no measured customer time savings.' };
    }

    function createRepair(input) {
      if (!input || !String(input.description || '').trim()) throw appError(400, 'Description is required.');
      const assessment = assessmentFor(input);
      const repair = { id:uid('repair'), title:String(input.title || 'Repair').trim(), description:String(input.description).trim(),
        property:input.property || 'p1', room:input.room || 'Other', urgency:input.urgency || 'Soon', photos:Array.isArray(input.photos) ? input.photos.slice(0, 3) : [],
        assessment, category:assessment.category, status:assessment.hazard ? 'hazard' : 'assessment', createdAt:new Date().toISOString(), created:'Today',
        updatedAt:new Date().toISOString(), revision:1, demo:true, quotes:[], outreach:[], discovery:null, approval:null, booking:null,
        appointment:null, provider:null, access:'', schedulingCall:null, rounds:[], events:[] };
      event(repair, 'issue.created', { room:repair.room, urgency:repair.urgency });
      repair.photos.forEach((photo, index) => event(repair, 'photo.added', { index, demoPhoto:photo === '/assets/sample-sink.svg' }));
      event(repair, 'assessment.proposed', { category:repair.category, hazard:assessment.hazard }, assessment.source);
      repairs.unshift(repair);
      return repair;
    }

    function getQuotes(repair) {
      if (repair.assessment.hazard) throw appError(409, 'Possible emergency hazard. Provider outreach is blocked.');
      if (repair.status === 'quotes') return repair;
      const rows = directory[repair.category] || directory.general;
      const providers = rows.map((row, index) => ({ id:`${repair.category}-${index + 1}`, name:row[0], initial:row[0][0], category:repair.category,
        serviceArea:'Demo Bay Area', capabilityId:`demo:${repair.category}:${index + 1}`, revision:'presentation-v1', price:row[1], parts:row[2], labor:row[1]-row[2],
        rating:row[3], reviews:row[4], window:row[5], warranty:`${row[6]}-day demo workmanship warranty`, demo:true }));
      const unanswered = { ...providers[2], id:`${repair.category}-unanswered`, name:'Busy Local Services', capabilityId:`demo:${repair.category}:unanswered`, unanswered:true };
      repair.discovery = { query:`Find ${repair.assessment.trade} services for ${repair.title}.`, providers:[...providers, unanswered], demo:true,
        fallback:true, source:'demo:seeded-provider-ranking', explanation:'Seeded providers ranked for the presentation. No live search was performed.' };
      repair.outreach = repair.discovery.providers.map((provider, index) => {
        event(repair, 'provider.discovered', { providerId:provider.id, capabilityId:provider.capabilityId }, 'demo:seeded-provider-ranking');
        const completed = !provider.unanswered;
        const call = { id:uid('call'), providerId:provider.id, providerName:provider.name, channel:'voice', timestamp:new Date().toISOString(),
          durationSeconds:completed ? 48 - index * 4 : 0, status:completed ? 'completed' : 'unanswered', demo:true, source:'demo:scripted-dial',
          transcript:completed ? [
            { speaker:'Handy', text:`Hi, I’m an AI assistant helping with a ${repair.assessment.trade.toLowerCase()} quote. No work or booking is authorized.` },
            { speaker:provider.name, text:`Our provisional estimate is $${provider.price}, including standard parts and labor, subject to inspection.` },
            { speaker:'Handy', text:'What is your earliest availability, warranty, and anything the customer should know?' },
            { speaker:provider.name, text:`We can come ${provider.window.toLowerCase()}. The work has a ${provider.warranty}. Additional work needs approval.` }
          ] : [], outcome:completed ? 'Provisional estimate and availability received.' : 'No answer. No retry was made.' };
        event(repair, completed ? 'call.completed' : 'call.unanswered', { providerId:provider.id, callId:call.id, purpose:'estimate' }, call.source);
        return call;
      });
      repair.quotes = providers.map((provider, index) => {
        const call = repair.outreach[index];
        const quote = { ...provider, id:uid('quote'), providerId:provider.id, amountCents:provider.price * 100, currency:'USD',
          scope:repair.assessment.scope, provisional:true, conditions:'On-site inspection required. Additional parts or work require new approval.',
          windows:windows(provider.window === 'Tomorrow' ? 1 : 2), expiresAt:new Date(Date.now() + 7 * 86400000).toISOString(),
          transcriptId:call.id, source:'demo:scripted-quote', demo:true };
        event(repair, 'quote.received', { providerId:provider.id, quoteId:quote.id, amountCents:quote.amountCents }, quote.source);
        return quote;
      });
      repair.status = 'quotes'; touch(repair); event(repair, 'quotes.ready', { count:repair.quotes.length });
      return repair;
    }

    function approve(repair, input) {
      const quote = repair.quotes.find(item => item.id === input?.quoteId);
      if (!quote || input?.consent !== true) throw appError(400, 'Explicit consent and a current quote are required.');
      repair.approval = { id:uid('approval'), userId:actor.id, quoteId:quote.id, providerId:quote.providerId, providerName:quote.name,
        amountCents:quote.amountCents, currency:'USD', timestamp:new Date().toISOString(),
        consentText:'I approve this provider and provisional estimate. Additional work requires new approval.', demo:true };
      repair.provider = repair.quotes.indexOf(quote); repair.status = 'scheduling'; touch(repair);
      event(repair, 'quote.approved', { approvalId:repair.approval.id, quoteId:quote.id, providerId:quote.providerId, amountCents:quote.amountCents });
      return repair;
    }

    function book(repair, input) {
      if (!repair.approval) throw appError(409, 'Approve a provider and price before scheduling.');
      const quote = repair.quotes.find(item => item.id === repair.approval.quoteId);
      const offered = Array.isArray(input?.windows) && input.windows.length ? input.windows : quote.windows.slice(0, 1);
      const window = offered.slice().sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
      const access = String(input?.access || '');
      repair.access = access;
      event(repair, 'availability.submitted', { windows:offered, accessProvided:Boolean(access) });
      repair.schedulingCall = { id:uid('call'), providerId:quote.providerId, providerName:quote.name, channel:'voice', status:'completed',
        timestamp:new Date().toISOString(), durationSeconds:32, demo:true, source:'demo:scripted-booking-call', transcript:[
          { speaker:'Handy', text:`The customer approved the ${'$' + (quote.amountCents / 100)} provisional estimate. Can you confirm the first offered window?` },
          { speaker:quote.name, text:'Yes, that window is confirmed for this presentation demo.' },
          { speaker:'Handy', text:'Thank you. No real appointment will be created.' }
        ], outcome:'Simulated confirmation. No provider was called and no appointment was made.' };
      event(repair, 'call.completed', { providerId:quote.providerId, callId:repair.schedulingCall.id, purpose:'scheduling' }, repair.schedulingCall.source);
      repair.booking = { id:uid('booking'), providerId:quote.providerId, quoteId:quote.id, approvalId:repair.approval.id, propertyId:repair.property,
        amountCents:repair.approval.amountCents, window, access, status:'confirmed', timestamp:new Date().toISOString(), demo:true };
      repair.appointment = `${new Date(window.start).toLocaleString('en-US')} – ${new Date(window.end).toLocaleTimeString('en-US')}`;
      repair.status = 'scheduled'; touch(repair);
      event(repair, 'appointment.confirmed', { appointmentId:repair.booking.id, approvalId:repair.approval.id, window });
      event(repair, 'handoff.created', { nextAction:'Demo provider visit pending.' }, 'demo:browser-handoff');
      return repair;
    }

    async function request(method, path, body) {
      await pause(55);
      const url = new URL(path, 'https://handy.demo');
      const pieces = url.pathname.split('/').filter(Boolean);
      if (method === 'GET' && url.pathname === '/api/bootstrap') return copy({ repairs:repairs.map(enrich), properties:allProperties(), metrics:metrics(), integrations, actor });
      if (method === 'GET' && url.pathname === '/api/analytics') return copy({ metrics:metrics() });
      if (method === 'GET' && url.pathname === '/api/properties') return copy({ properties:allProperties() });
      if (method === 'POST' && url.pathname === '/api/properties') {
        const property = { id:uid('house'), name:String(body?.name || 'My house'), address:String(body?.address || ''), unit:String(body?.unit || 'Main home'), tenant:String(body?.tenant || ''), serviceArea:'Demo Bay Area', home:body?.home === true, demo:true };
        extraProperties.push(property); return copy({ property });
      }
      if (method === 'POST' && url.pathname === '/api/demo/reset') { repairs = []; extraProperties = []; sequence = 0; return { ok:true }; }
      if (method === 'POST' && url.pathname === '/api/repairs') return { repair:enrich(createRepair(body)) };
      if (method === 'GET' && url.pathname === '/api/repairs') return { repairs:repairs.map(enrich) };
      if (pieces[0] === 'api' && pieces[1] === 'repairs' && pieces[2]) {
        const repair = requireRepair(decodeURIComponent(pieces[2])), action = pieces[3] || '';
        if (method === 'GET' && !action) return { repair:enrich(repair) };
        if (method === 'PATCH' && !action) {
          if (body?.description !== undefined) repair.description = String(body.description).trim();
          repair.assessment = assessmentFor(repair); repair.category = repair.assessment.category;
          repair.quotes = []; repair.outreach = []; repair.approval = null; repair.booking = null; repair.schedulingCall = null;
          repair.status = repair.assessment.hazard ? 'hazard' : 'assessment'; touch(repair); event(repair, 'issue.updated', { quotesInvalidated:true });
          return { repair:enrich(repair) };
        }
        if (method !== 'POST') throw appError(405, 'Unsupported demo action.');
        if (action === 'quotes') return { repair:enrich(getQuotes(repair)) };
        if (action === 'approve') return { repair:enrich(approve(repair, body)) };
        if (action === 'book') return { repair:enrich(book(repair, body)) };
        if (action === 'reschedule') { repair.status = 'scheduling'; touch(repair); event(repair, 'appointment.reschedule_requested', { previousWindow:repair.booking?.window }); return { repair:enrich(repair) }; }
        if (action === 'complete') { repair.status = 'complete'; if (repair.booking) repair.booking.status = 'complete'; touch(repair); event(repair, 'repair.completed', {}); return { repair:enrich(repair) }; }
        if (action === 'reopen') {
          if (repair.quotes.length || repair.outreach.length) repair.rounds.push({ outreach:copy(repair.outreach), quotes:copy(repair.quotes), approval:copy(repair.approval), booking:copy(repair.booking), endedAt:new Date().toISOString() });
          repair.quotes = []; repair.outreach = []; repair.discovery = null; repair.approval = null; repair.booking = null; repair.schedulingCall = null; repair.status = 'assessment';
          touch(repair); event(repair, 'quotes.reopened', {}); return { repair:enrich(repair) };
        }
      }
      throw appError(404, `No presentation-demo route for ${method} ${url.pathname}.`);
    }

    function installControls() {
      if (typeof document === 'undefined' || document.getElementById('handy-demo-control')) return;
      const style = document.createElement('style');
      style.textContent = '.handy-demo-control{position:fixed;right:14px;bottom:14px;z-index:1000;display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(36,83,63,.2);border-radius:999px;background:rgba(255,255,255,.94);box-shadow:0 8px 26px rgba(25,50,39,.16);color:#24533f;font:700 13px/1.2 system-ui,sans-serif}.handy-demo-control button{border:0;border-radius:999px;background:#24533f;color:#fff;font:inherit;padding:7px 11px;cursor:pointer}.handy-demo-control span{white-space:nowrap}@media(max-width:639px){.handy-demo-control span{display:none}}';
      document.head.appendChild(style);
      const control = document.createElement('aside'); control.id = 'handy-demo-control'; control.className = 'handy-demo-control'; control.setAttribute('aria-label', 'Presentation demo controls');
      control.innerHTML = '<span>Fast demo · no live services</span><button type="button">Reset demo</button>';
      control.querySelector('button').onclick = () => { repairs = []; extraProperties = []; sequence = 0; try { sessionStorage.clear(); } catch {} location.hash = '#/'; location.reload(); };
      document.body.appendChild(control);
    }
    if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', installControls);
    return { request, reset:() => { repairs = []; extraProperties = []; sequence = 0; }, snapshot:() => copy({ repairs, properties:allProperties(), metrics:metrics() }) };
  }

  return { create };
});
