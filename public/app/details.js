/* details.js — right panel (desktop) / section below the thread (tablet, phone) for #/repair/<id>.
   Registers H.ui.details = {render(repair, state), bind(root, repair)}. Owner: details module. */
(function(){
const H = window.H;
if (!H) return;

/* ---------- Module CSS (injected once) ---------- */
const CSS = `
.dt{display:flex;flex-direction:column;max-width:640px;margin:0 auto;width:100%}
.dt-s{border-bottom:1px solid var(--line);padding:18px 0}
.dt-s:first-child{padding-top:0}
.dt-s:last-of-type{border-bottom:0}
.dt h2{font-size:15px;font-weight:700;color:var(--ink2);margin:0 0 10px;line-height:1.3}
.dt h3{font-size:20px;line-height:1.25;margin:0 0 4px;text-wrap:balance;overflow-wrap:anywhere}
.dt p{margin:0}
.dt .dt-sub{font-size:15px;color:var(--ink2)}
.dt .dt-line{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;margin-top:10px}
/* collapsible variant (tablet/phone) */
.dt details.dt-s>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;min-height:48px;margin:-6px 0;border-radius:10px}
.dt details.dt-s>summary::-webkit-details-marker{display:none}
.dt details.dt-s>summary h2{margin:0;flex:1;font-size:17px;color:var(--ink)}
.dt details.dt-s>summary .ic{width:20px;height:20px;color:var(--ink2);transition:transform .2s cubic-bezier(.16,1,.3,1)}
.dt details.dt-s[open]>summary .ic{transform:rotate(90deg)}
.dt details.dt-s[open]>summary{margin-bottom:10px}
@media (prefers-reduced-motion:reduce){.dt details.dt-s>summary .ic{transition:none}}
/* step tracker */
.dt-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:14px 0 0;padding:0;list-style:none}
.dt-steps li{font-size:14px;color:var(--ink3);display:flex;flex-direction:column;gap:6px}
.dt-steps li::before{content:"";height:6px;border-radius:3px;background:var(--line)}
.dt-steps li.on{color:var(--green);font-weight:700}
.dt-steps li.on::before{background:var(--green)}
/* next step */
.dt-next{font-size:17px;font-weight:700}
.dt-blk{margin:10px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.dt-blk li{display:flex;gap:8px;align-items:flex-start;font-size:15px;color:var(--ink2)}
.dt-blk li .ic{width:18px;height:18px;margin-top:2px;color:var(--amber)}
.dt-blk li.red{color:var(--red)} .dt-blk li.red .ic{color:var(--red)}
/* approval */
.dt-ok{display:flex;gap:10px;align-items:flex-start}
.dt-ok>.ic{color:var(--green);margin-top:2px}
.dt-ok b{font-weight:700}
.dt-ok .amt{font-variant-numeric:tabular-nums}
.dt blockquote{margin:12px 0 0;padding:0 0 0 14px;font-size:15px;color:var(--ink2);font-style:italic;position:relative}
.dt blockquote::before{content:"";position:absolute;left:0;top:2px;bottom:2px;width:1px;background:var(--ink3)}
/* appointment */
.dt-when{font-size:20px;font-weight:800;line-height:1.25;font-variant-numeric:tabular-nums;margin:0 0 6px}
.dt-kv{margin:10px 0 0;display:flex;flex-direction:column;gap:2px}
.dt-kv dt{font-size:15px;color:var(--ink2)}
.dt-kv dd{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.dt .btn.ghost{margin-top:14px;width:100%;flex:none;background:#fff}
.dt .btn.ghost:hover{background:var(--green-tint)}
/* timeline */
.dt-tl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.dt-tl li{display:grid;grid-template-columns:28px 1fr auto;gap:2px 10px;align-items:start;padding:8px 0;position:relative}
.dt-tl li::after{content:"";position:absolute;left:13px;top:36px;bottom:-6px;width:1px;background:var(--line)}
.dt-tl li:last-child::after{display:none}
.dt-tl .dot{width:28px;height:28px;border-radius:50%;background:#fff;border:1px solid var(--line);display:grid;place-items:center;color:var(--ink2)}
.dt-tl .dot .ic{width:15px;height:15px}
.dt-tl .t{font-size:16px;line-height:1.35;padding-top:3px;overflow-wrap:anywhere}
.dt-tl .s{grid-column:2;font-size:14px;color:var(--ink2)}
.dt-tl time{font-size:14px;color:var(--ink3);padding-top:5px;white-space:nowrap;font-variant-numeric:tabular-nums}
.dt-tl li.yes .dot{background:var(--green);border-color:var(--green);color:#fff}
.dt-tl li.yes .t{font-weight:700;color:var(--green)}
.dt-tl li.warn .dot{background:var(--red-tint);border-color:#F0C4BA;color:var(--red)}
.dt-tl li.done .dot{background:var(--green-tint);border-color:var(--green-tint);color:var(--green)}
.dt-foot{margin-top:12px}
/* handoff note */
.dt-hand{border-top:1px solid var(--line);padding-top:6px}
.dt-hand>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;min-height:48px;font-weight:700;border-radius:10px}
.dt-hand>summary::-webkit-details-marker{display:none}
.dt-hand>summary .ic{width:20px;height:20px;color:var(--ink2);transition:transform .2s cubic-bezier(.16,1,.3,1)}
.dt-hand[open]>summary .ic.chev{transform:rotate(90deg)}
.dt-hand pre{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere;font-family:var(--font);font-size:15px;line-height:1.5;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.dt-hand .dt-sub{margin-top:8px}
`;
if (!document.getElementById('css-details')) {
  const st = document.createElement('style'); st.id = 'css-details'; st.textContent = CSS; document.head.appendChild(st);
}

/* ---------- Helpers ---------- */
const WIDE = '(min-width:1024px)';
const wide = () => window.matchMedia ? window.matchMedia(WIDE).matches : true;
const esc = H.esc;

const proName = (r, id) => lookupPro(r, id) || (/unanswered/.test(String(id)) ? 'a busy pro' : 'a pro');
const lookupPro = (r, id) => {
  if (!id) return null;
  const pools = [r.quotes || [], (r.discovery && r.discovery.providers) || [], r.outreach || []];
  for (const pool of pools) {
    const hit = pool.find(p => p && (p.providerId === id || p.id === id));
    if (hit) return hit.name || hit.providerName || id;
  }
  if (r.approval && r.approval.providerId === id) return r.approval.providerName;
  return null; /* prices were cleared, so the name is gone */
};
const humanize = type => {
  const s = String(type || 'update').replace(/[._]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const fullWhen = iso => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'}) + ' at ' + H.time(iso);
};

const NEXT = {
  hazard: 'Get safe first. Finding pros is paused for this one.',
  assessment: 'Get prices from local pros.',
  quoting: 'Handy is on the phone with pros. Prices show up here when the calls end.',
  booking: 'Handy is calling the pro to book one of your times.',
  quotes: 'Compare the prices and say yes to one.',
  scheduling: 'Pick times that work and tell the pro how to get in.',
  scheduled: 'The pro comes by. You can change the time or mark it fixed.',
  complete: 'Nothing left to do. This one is fixed.'
};
const blockerWords = (r, raw) => {
  if (r.status === 'complete') return [];
  return (raw || []).map(b => {
    if (/hazard/i.test(b)) return {red:true, text:'Possibly dangerous. Call the right emergency line first.'};
    if (/approval/i.test(b)) {
      if (r.status === 'quoting' || r.status === 'booking') return {text:'Handy is on a call. Nothing to do yet.'};
      if (r.status === 'quotes') return {text:'Waiting for your yes on a price'};
      if (r.status === 'assessment') return {text:'No prices yet. Nothing gets booked without your yes.'};
      return {text:'Waiting for your yes on a price'};
    }
    return {text: String(b)};
  });
};

/* ---------- .ics (same shape as the booking module) ---------- */
const icsStamp = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const buildIcs = r => {
  const b = r.booking, p = H.prop(r.property) || {}, pro = (r.approval && r.approval.providerName) || proName(r, b.providerId);
  const desc = [`${r.title}`, `Pro: ${pro}`, r.approval ? `Price you approved: ${H.price(r.approval)}` : '', b.access ? `How to get in: ${b.access}` : '', 'Demo booking from Handy. No real pro was contacted.'].filter(Boolean).join('\n');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Handy//Repair helper (demo)//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${b.id}@handy.local`, `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(b.window.start)}`, `DTEND:${icsStamp(b.window.end)}`,
    `SUMMARY:${icsText(`${pro}: ${r.title} (demo)`)}`,
    `LOCATION:${icsText([p.name, p.unit].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${icsText(desc)}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
};
const downloadIcs = r => {
  const blob = new Blob([buildIcs(r)], {type:'text/calendar;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'handy-repair.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  H.toast('Calendar file downloaded (handy-repair.ics)');
};

/* ---------- Timeline ---------- */
const timeline = r => {
  const events = [...(r.events || [])].sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0));
  const items = [];
  let found = null, hadPrices = false;
  for (const e of events) {
    const p = e.payload || {}, at = e.timestamp;
    /* each round of finding pros gets its own line (discovery and calls interleave within a round) */
    if (/^(quotes\.ready|quotes\.reopened|issue\.updated|hazard\.flagged|quote\.approved)$/.test(e.type)) found = null;
    const add = (icon, text, extra = {}) => { const it = {icon, text, at, ...extra}; items.push(it); return it; };
    switch (e.type) {
      case 'handoff.created': break;
      case 'issue.created': add('camera', 'You reported the problem', {sub: r.room && r.room !== 'Other' ? r.room : ''}); break;
      case 'photo.added': add('image', p.demoPhoto ? 'Sample photo added' : 'Photo added'); break;
      case 'assessment.proposed': add('wrench', items.some(i => i.edited) ? 'Handy made a new guess' : 'Handy made a first guess'); break;
      case 'hazard.flagged': add('alert', 'Flagged as possibly dangerous — finding pros paused', {cls:'warn'}); break;
      case 'provider.discovered':
        if (found) { found.names.push(lookupPro(r, p.providerId)); }
        else { found = add('list', '', {names:[lookupPro(r, p.providerId)]}); }
        break;
      case 'call.completed':
        if (p.purpose === 'scheduling') add('phone', `Called ${proName(r, p.providerId)} to book`);
        else add('phone', `Called ${proName(r, p.providerId)} — got a price`, {pid: p.providerId});
        break;
      case 'call.unanswered': add('phone', `Called ${proName(r, p.providerId)} — no answer`); break;
      case 'quote.received': {
        const prev = items[items.length - 1];
        if (prev && prev.pid && prev.pid === p.providerId && !prev.sub) prev.sub = p.priceText || H.money(p.amountCents);
        else add('doc', `Price from ${proName(r, p.providerId)}`, {sub: p.priceText || H.money(p.amountCents)});
        break;
      }
      case 'quotes.ready': hadPrices = true; add('list', p.count === 1 ? '1 price ready' : `${p.count ?? 0} prices ready`); break;
      case 'quote.approved': add('check', `You said yes to ${p.priceText || H.money(p.amountCents)}`, {cls:'yes', sub: `${proName(r, p.providerId)} · nothing was booked before this`}); break;
      case 'availability.submitted': { const n = (p.windows || []).length; add('clock', n === 1 ? 'You picked 1 time' : `You picked ${n} times`, {sub: p.accessProvided ? 'Included how to get in' : ''}); break; }
      case 'appointment.confirmed': add('cal', 'Booked', {cls:'done', sub: p.window ? H.when(p.window.start, p.window.end) : ''}); break;
      case 'appointment.reschedule_requested': add('refresh', 'Asked to change the time'); break;
      case 'repair.completed': add('check', 'Marked as fixed', {cls:'done'}); break;
      case 'quotes.reopened': hadPrices = false; add('refresh', 'Old prices cleared'); break;
      case 'issue.updated': add('edit', hadPrices ? 'Description changed — prices cleared' : 'Description changed', {edited:true}); hadPrices = false; break;
      default: add('info', humanize(e.type));
    }
  }
  items.forEach(it => {
    if (!it.names) return;
    const n = it.names.length;
    const known = it.names.every(Boolean);
    it.text = n === 1 && known ? `Found ${it.names[0]}` : n === 1 ? 'Found 1 pro' : `Found ${n} pros`;
    if (n > 1 && known) it.sub = it.names.join(', ');
  });
  if (!items.length) return `<p class="dt-sub">Nothing yet. Steps show up here as they happen.</p>`;
  return `<ol class="dt-tl">${items.map(it => `<li class="${it.cls || ''}">
      <span class="dot">${H.icon(it.icon)}</span>
      <span class="t">${esc(it.text)}</span>
      <time datetime="${esc(it.at)}">${it.at ? esc(H.time(it.at)) : ''}</time>
      ${it.sub ? `<span class="s">${esc(it.sub)}</span>` : ''}</li>`).join('')}</ol>`;
};

/* ---------- Sections ---------- */
const section = (key, title, body, collapsible, open) => collapsible
  ? `<details class="dt-s" data-sec="${key}"${open ? ' open' : ''}><summary><h2>${esc(title)}</h2>${H.icon('chev')}</summary>${body}</details>`
  : `<section class="dt-s" data-sec="${key}" aria-labelledby="dt-h-${key}"><h2 id="dt-h-${key}">${esc(title)}</h2>${body}</section>`;

const summary = r => {
  const p = H.prop(r.property);
  const step = H.statusStep[r.status] || 1;
  const place = [p && p.name, p && p.unit, r.room !== 'Other' && r.room].filter(Boolean).join(' · ');
  const word = H.statusWords[r.status] || humanize(r.status);
  const statusTag = r.status === 'hazard' ? `<span class="tag red">${H.icon('alert')} ${esc(word)}</span>` : `<span class="tag">${esc(word)}</span>`;
  return `<h3>${esc(r.title)}</h3>
    ${place ? `<p class="dt-sub">${esc(place)}</p>` : ''}
    <div class="dt-line">${statusTag}</div>
    <ol class="dt-steps" aria-label="Step ${step} of 3">${['Guess','Prices','Booked'].map((l, i) => `<li class="${i < step ? 'on' : ''}"${i === step - 1 ? ' aria-current="step"' : ''}>${l}</li>`).join('')}</ol>`;
};

const nextStep = r => {
  const h = r.handoff || {};
  const next = NEXT[r.status] || h.nextAction || 'Nothing to do right now.';
  const blk = blockerWords(r, h.blockers);
  return `<p class="dt-next">${esc(next)}</p>
    ${blk.length ? `<ul class="dt-blk">${blk.map(b => `<li class="${b.red ? 'red' : ''}">${H.icon(b.red ? 'alert' : 'clock')}<span>${esc(b.text)}</span></li>`).join('')}</ul>` : ''}`;
};

const approval = (r, S) => {
  const a = r.approval;
  const ev = (r.events || []).find(e => e.type === 'quote.approved' && e.payload && e.payload.approvalId === a.id);
  const who = (ev && ev.actor && ev.actor.name) || (S && S.actor && S.actor.id === a.userId && S.actor.name) || 'you';
  return `<div class="dt-ok">${H.icon('shield')}<p>You approved <b>${esc(a.providerName)}</b> for <b class="amt">${H.price(a)}</b> on ${esc(fullWhen(a.timestamp))}.</p></div>
    <blockquote>“I approve this pro and this provisional price.”</blockquote>
    <p class="dt-sub" style="margin-top:10px">Approved by ${esc(who)}</p>`;
};

const appointment = r => {
  const b = r.booking, done = b.status === 'complete' || r.status === 'complete';
  const pro = (r.approval && r.approval.providerName) || proName(r, b.providerId);
  const access = b.access || r.access;
  const changing = !done && r.status === 'scheduling';
  const tag = done ? `<span class="tag">${H.icon('check')} Fixed</span>`
    : changing ? `<span class="tag amber">${H.icon('clock')} Changing the time</span>`
    : `<span class="tag">${H.icon('check')} Confirmed</span>`;
  return `<p class="dt-when">${esc(H.when(b.window.start, b.window.end))}</p>
    <div class="dt-line" style="margin-top:0">${tag}<span class="dt-sub">${esc(pro)}</span></div>
    ${changing ? `<p class="dt-sub" style="margin-top:8px">You stay booked for this time until ${esc(pro)} confirms a new one.</p>` : ''}
    <dl class="dt-kv"><dt>How to get in</dt><dd>${access ? esc(access) : 'Not given yet'}</dd></dl>
    ${done || changing ? '' : `<button type="button" class="btn ghost" data-dt-ics>${H.icon('cal')} Add to calendar</button>`}`;
};

const handoff = r => {
  const brief = r.handoff && r.handoff.brief;
  if (!brief) return '';
  return `<details class="dt-hand" data-sec="handoff"><summary>${H.icon('doc')}<span style="flex:1">Handoff note</span>${H.icon('chev', 'chev')}</summary>
    <p class="dt-sub" style="margin:0 0 8px">What Handy would pass along to the next person helping.</p>
    <pre>${esc(readableBrief(brief))}</pre></details>`;
};

/* Turn raw ISO timestamps in the server brief into plain dates. */
const readableBrief = brief => String(brief)
  .split('\n').filter(l => !/No Alike API interaction/i.test(l)).join('\n')
  .replace(/^Status: (\w+)$/m, (m, st) => `Status: ${H.statusWords[st] || humanize(st)}`)
  .replace(/provisional estimate/gi, 'price')
  .replace(/Approved provider:/g, 'Approved pro:')
  .replace(/Appointment: (\S+Z) to (\S+Z)\./, (m, a, b) => isNaN(Date.parse(a)) ? m : `Appointment: ${H.when(a, b)}.`)
  .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g, iso => fullWhen(iso) || iso);

/* Keep the open/closed state of collapsible sections across re-renders. */
const openState = {};

H.ui.details = {
  render(r, S) {
    if (!r) return '';
    const col = !wide();
    const st = openState[r.id] || {};
    const isOpen = (key, dflt) => key in st ? st[key] : dflt;
    const parts = [section('summary', 'Summary', summary(r), col, isOpen('summary', true)),
      section('next', 'Next step', nextStep(r), col, isOpen('next', false))];
    if (r.approval) parts.push(section('approval', 'Your approval', approval(r, S), col, isOpen('approval', false)));
    if (r.booking) parts.push(section('appt', 'Appointment', appointment(r), col, isOpen('appt', false)));
    parts.push(section('history', 'What happened', timeline(r) + `<div class="dt-foot">${H.tag(r, 'Demo · every step stored locally', 'Live · from real calls')}</div>`, col, isOpen('history', false)));
    const hand = handoff(r).replace('data-sec="handoff">', `data-sec="handoff"${isOpen('handoff', false) ? ' open' : ''}>`);
    return `<div class="dt" data-col="${col ? 1 : 0}">${parts.join('')}${hand}</div>`;
  },
  bind(root, r) {
    if (!root || !r) return;
    const ics = root.querySelector('[data-dt-ics]');
    if (ics) ics.addEventListener('click', () => { const cur = H.repair(r.id) || r; if (cur.booking) downloadIcs(cur); });
    root.querySelectorAll('details[data-sec]').forEach(d => d.addEventListener('toggle', () => {
      (openState[r.id] = openState[r.id] || {})[d.dataset.sec] = d.open;
    }));
  }
};

/* Re-render when crossing the desktop breakpoint so sections switch between plain and collapsible. */
if (window.matchMedia) {
  const mq = window.matchMedia(WIDE);
  const onChange = () => { if (H.route && H.route.name === 'repair' && H.render) H.render(); };
  if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
}
})();
