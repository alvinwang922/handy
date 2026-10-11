/* booking.js — scheduling + booked parts of the repair thread.
   Registers H.part('scheduling') (status: scheduling) and H.part('booked') (status: scheduled, complete).
   Local, per-repair UI state (picked times, access note draft, the in-progress booking call, last error)
   lives in `drafts` so it survives the full re-renders core does after every mutation. */
(function(){
const H = window.H;
const MAX_ACCESS = 1200, CALL_MS = 2500;
const drafts = {};
const draft = id => drafts[id] || (drafts[id] = {picked: [], access: null, calling: false, err: null, errStatus: 0, showPickErr: false});

/* ---------- Module CSS (injected once) ---------- */
if (!document.getElementById('css-booking')) {
  const st = document.createElement('style'); st.id = 'css-booking';
  st.textContent = `
.dock:has(.bk-pick),.dock:has(.bk-wait){position:static}
.bk-pick,[data-bk-ask]{scroll-margin-top:88px}
.bk-pick .bk-q{font-weight:700;margin:0 0 10px}
.bk-pick .slots{margin-bottom:6px}
.bk-pick .slots button{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;text-align:left;padding:8px 14px;gap:2px;color:var(--ink)}
.bk-pick .slots button small{font-size:15px}
.bk-pick .slots button[aria-pressed="true"] small{color:var(--green)}
.bk-pick .slots button .bk-tick{display:none}
.bk-pick .slots button[aria-pressed="true"] .bk-tick{display:inline}
.bk-pick .slots button .bk-day{display:flex;align-items:center;gap:6px}
.bk-pick .slots button .ic{width:16px;height:16px}
.bk-pick .slots button:hover{border-color:var(--green)}
.bk-pick .field{margin:16px 0 12px}
.bk-pick .field textarea{min-height:84px}
.bk-pick .bk-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.bk-pick .bk-count{font-size:14px;color:var(--ink3);font-variant-numeric:tabular-nums;flex:none}
.bk-pick .bk-count.over{color:var(--amber)}
.bk-pick .bk-slotmsg{font-size:15px;color:var(--amber);display:flex;gap:6px;align-items:center;margin:4px 0 0}
.bk-pick .bk-slotmsg .ic{width:18px;height:18px}
.bk-alt{display:flex;justify-content:center;margin-top:6px}
.bk-alt .btn.plain{min-height:48px}
.bk-err{margin-bottom:12px}
.bk-err .grow{flex:1}
.bk-err .btn{flex:none;min-height:44px;margin-top:8px}
.bk-call{align-self:stretch;scroll-margin-bottom:24px}
.bk-card .qn:focus,.bk-call:focus{outline:none}
.bk-pick .slots button[disabled]{opacity:1;cursor:default;border-style:dashed;color:var(--ink2)}
.bk-wait{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0}
.bk-card .qn{display:flex;gap:8px;align-items:center}
.bk-card .qn .ic{color:var(--green)}
.bk-card .bk-said{margin:8px 0 0}
.bk-card .bk-when{font-size:24px;font-weight:800;line-height:1.2;margin:10px 0 4px;letter-spacing:-.01em;font-variant-numeric:tabular-nums;text-wrap:balance}
.bk-card .bk-acc{display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:15px;color:var(--ink2)}
.bk-card .bk-acc .ic{width:18px;height:18px;margin-top:2px;color:var(--ink2)}
.bk-card .bk-acc b{color:var(--ink)}
.bk-card .bk-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:12px}
.bk-card .bk-link{background:none;border:0;padding:0 2px;min-height:48px;color:var(--green);font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer;font-size:16px}
.bk-card .bk-link:hover{color:var(--green-press)}
.bk-card .btns .btn{flex:none}
.bk-dock .qr{margin-bottom:0}
.bk-dock .qr button{min-height:48px}
.bk-done{display:flex;gap:10px;flex-wrap:wrap}
.bk-sheet p{margin:0 0 12px}
.bk-sheet .note{margin:0 0 16px}
.bk-sheet .bk-acts{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.bk-sheet .bk-acts .btn.plain{align-self:center;min-height:48px}
.bk-tx{display:flex;flex-direction:column;gap:12px;margin:0 0 16px;padding:0;list-style:none}
.bk-tx li{display:flex;flex-direction:column;gap:2px}
.bk-tx .who{font-size:15px;font-weight:700;color:var(--ink2)}
.bk-tx li.pro .who{color:var(--green)}
@media (max-width:639px){
  .bk-card .bk-when{font-size:22px}
  .bk-card .btns .btn{flex:1}
  .bk-done{flex-direction:column}
}`;
  document.head.appendChild(st);
}

/* ---------- Helpers ---------- */
const quoteOf = r => r && r.approval ? (r.quotes || []).find(q => q.id === r.approval.quoteId) || null : null;
const proName = r => (quoteOf(r) || {}).name || (r.approval && r.approval.providerName) || 'the pro';
const warrantyOf = r => (quoteOf(r) || {}).warranty || 'workmanship warranty';
const futureWindows = q => (q && Array.isArray(q.windows) ? q.windows : []).filter(w => Date.parse(w.start) > Date.now()).slice(0, 6);
/* reschedule keeps r.booking; reopen clears it, so a booking here means "same pro, new time". */
const isReschedule = r => !!r.booking;
const focusNext = {};
const focusOnce = (root, id, sel) => {
  if (!focusNext[id]) return;
  const el = root.querySelector(sel || focusNext[id]); delete focusNext[id];
  if (el) requestAnimationFrame(() => { if (el.tabIndex < 0 && !/^(BUTTON|TEXTAREA|A)$/.test(el.tagName)) el.tabIndex = -1; el.focus({preventScroll: true}); });
};
/* Map server/network errors to plain words; never show raw server text. */
const errKind = msg => { const m = String(msg || '');
  if (/expired/i.test(m)) return 'expired';
  if (/reach Handy|network|fetch/i.test(m)) return 'net';
  if (/window|time/i.test(m)) return 'time';
  return 'other'; };
const errCopy = (kind, pro) => ({
  expired: `${pro}’s price ran out. Get new prices to keep going.`,
  net: 'I couldn’t reach Handy. Try again in a moment.',
  time: 'That time isn’t open any more. Pick another and try again.',
  other: `I couldn’t get through to ${pro}. Try again in a moment.`
})[kind];
const lastEvent = (r, type) => [...(r.events || [])].reverse().find(e => e.type === type);
const split = w => { const s = H.when(w.start, w.end), i = s.indexOf(' · '); return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + 3)]; };
const listWhen = ws => ws.map(w => H.esc(H.when(w.start, w.end))).join('<br>');
const pickedWindows = (r, d) => futureWindows(quoteOf(r)).filter(w => d.picked.includes(w.start) && !(r.booking && r.booking.window.start === w.start && r.booking.window.end === w.end));
const accessDraft = (r, d) => d.access != null ? d.access : (r.access || '');

/* ---------- .ics ---------- */
const icsDate = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = line => {
  const out = []; let cur = '', bytes = 0, limit = 75;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > limit) { out.push(cur); cur = ' '; bytes = 1; limit = 75; }
    cur += ch; bytes += b;
  }
  out.push(cur); return out.join('\r\n');
};
function buildIcs(r) {
  const b = r.booking, prop = H.prop(r.property) || {};
  const desc = [
    `Price: ${H.money(b.amountCents)} (provisional; any extra work needs your yes first)`,
    `Warranty: ${warrantyOf(r)}`,
    `How they get in: ${b.access || 'They will call you on arrival.'}`,
    'Booked by Handy. Demo: simulated booking, no real appointment was made.'
  ].join('\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Handy//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.id}@handy`,
    `DTSTAMP:${icsDate(new Date().toISOString())}`,
    `DTSTART:${icsDate(b.window.start)}`,
    `DTEND:${icsDate(b.window.end)}`,
    `SUMMARY:${icsText(`${r.title} — ${proName(r)}`)}`,
    `LOCATION:${icsText(prop.name || '')}`,
    `DESCRIPTION:${icsText(desc)}`,
    'END:VEVENT', 'END:VCALENDAR'
  ].map(fold).join('\r\n') + '\r\n';
}
function downloadIcs(r) {
  const blob = new Blob([buildIcs(r)], {type: 'text/calendar;charset=utf-8'});
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'handy-repair.ics'; a.hidden = true;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  H.toast('Calendar file saved (handy-repair.ics)');
}

/* ---------- Sheets ---------- */
const sheetActs = (primary, primaryCls, secondary) => `<div class="bk-acts">
  <button class="btn block ${primaryCls}" data-yes>${primary}</button>
  <button class="btn plain" data-no>${H.esc(secondary)}</button></div>`;
function confirmSheet(title, body, primary, secondary, onYes, primaryCls = '') {
  H.sheet(title, `<div class="bk-sheet">${body}${sheetActs(primary, primaryCls, secondary)}</div>`, (d, close) => {
    d.querySelector('[data-no]').onclick = close;
    d.querySelector('[data-yes]').onclick = () => { close(); onYes(); };
  });
}
const askReopen = (r, booked) => {
  const pro = H.esc(proName(r)), price = H.esc(H.money(r.approval && r.approval.amountCents));
  const body = booked
    ? `<div class="note amber">${H.icon('alert')}<span>This cancels your booking with ${pro}${r.booking ? ` on ${H.esc(H.when(r.booking.window.start, r.booking.window.end))}` : ''}.</span></div>
       <p>Your yes on the ${price} price goes away too. You’ll get fresh prices from pros, then pick again.</p>`
    : `<p>This drops your yes for ${pro} at ${price}. You’ll get fresh prices from pros, then pick again.</p>`;
  confirmSheet(booked ? 'Get new prices?' : 'Choose a different pro?', body,
    booked ? 'Cancel booking and get new prices' : 'Yes, start over with new prices', booked ? 'Keep my booking' : `Keep ${proName(r)}`,
    () => { delete drafts[r.id]; H.mutate(r.id, 'reopen', {}); }, booked ? 'danger' : '');
};
const askReschedule = r => confirmSheet('Change the time?',
  `<p>I’ll keep ${H.esc(proName(r))} and the same price, ${H.esc(H.money(r.approval && r.approval.amountCents))}. You pick new times, and I’ll call them again.</p>`,
  'Pick new times', 'Keep this time', () => { delete drafts[r.id]; H.mutate(r.id, 'reschedule', {}); });
function askFixed(r) {
  const pro = H.esc(proName(r));
  H.sheet(`Did ${proName(r)} fix it?`, `<div class="bk-sheet" data-step>
    <p>Only say yes once it’s working. I’ll start your warranty from today.</p>
    ${sheetActs('Yes, it’s fixed', '', 'Not yet')}</div>`, (d, close) => {
    const root = d.querySelector('[data-step]');
    root.querySelector('[data-yes]').onclick = () => { close(); H.mutate(r.id, 'complete', {}); };
    root.querySelector('[data-no]').onclick = () => {
      d.querySelector('.sheet-hd h2').textContent = 'No problem';
      root.innerHTML = `<p>If ${pro} hasn’t come yet, you’re still booked for <b>${H.esc(H.when(r.booking.window.start, r.booking.window.end))}</b>.</p>
        <p>If they came and it’s still not working, call them first. Your ${H.esc(warrantyOf(r))} covers their work.</p>
        ${sheetActs('Change the time', '', 'Close')}`;
      root.querySelector('[data-no]').onclick = close;
      root.querySelector('[data-yes]').onclick = () => { close(); askReschedule(r); };
      root.querySelector('[data-yes]').focus();
    };
  });
}
function showTranscript(r) {
  const c = r.schedulingCall, pro = proName(r);
  const lines = c && Array.isArray(c.transcript) ? c.transcript : [];
  const plain = t => String(t ?? '')
    .replace(/(\d{4}-\d\d-\d\dT[\d:.]+Z)\s+to\s+(\d{4}-\d\d-\d\dT[\d:.]+Z)/g, (_, a, b) => H.when(a, b))
    .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, a => H.when(a))
    .replace(/\s*quote\s+[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ' the price')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '').replace(/ {2,}/g, ' ');
  H.sheet('What they said', `<div class="bk-sheet">
    <p>${H.demo('Demo · simulated call')} My booking call with ${H.esc(pro)}${c && c.durationSeconds ? `, ${H.esc(c.durationSeconds)} seconds` : ''}.</p>
    ${lines.length ? `<ul class="bk-tx">${lines.map(l => `<li class="${l.speaker === 'Handy' ? '' : 'pro'}"><span class="who">${H.esc(l.speaker)}</span><span>${H.esc(plain(l.text))}</span></li>`).join('')}</ul>`
      : '<p>I don’t have the words from this call.</p>'}
    ${c && c.outcome ? `<div class="note">${H.icon('info')}<span>${H.esc(plain(c.outcome))}</span></div>` : ''}
    <div class="bk-acts"><button class="btn block ghost" data-no>Close</button></div></div>`,
    (d, close) => { d.querySelector('[data-no]').onclick = close; });
}

/* ---------- Booking call ---------- */
function startBooking(r, root) {
  const d = draft(r.id), ta = root.querySelector('#bk-access');
  if (ta) d.access = ta.value;
  const windows = pickedWindows(r, d).map(w => ({start: w.start, end: w.end}));
  if (!windows.length) { d.showPickErr = true; H.render(); const b = document.querySelector('.bk-pick .slots button'); if (b) b.focus(); return; }
  if (d.calling || H.state.busy) return;
  const access = (d.access || '').trim();
  if (access.length > MAX_ACCESS) return;
  d.calling = true; d.err = null; d.showPickErr = false; d.sent = windows; H.state.error = null;
  focusNext[r.id] = '.bk-call';
  H.render();
  /* plain timeout, not H.later: the call must finish even if the user navigates away mid-animation */
  setTimeout(async () => {
    const done = await H.mutate(r.id, 'book', {windows, access});
    const dd = draft(r.id); dd.calling = false;
    if (done) { delete drafts[r.id]; focusNext[r.id] = '.bk-card .qn'; H.render(); return; }
    dd.err = errKind(H.state.error); H.state.error = null;
    focusNext[r.id] = dd.err === 'expired' ? '[data-bk-reopen]' : '[data-bk-book]';
    const fresh = H.repair(r.id); if (fresh) dd.picked = pickedWindows(fresh, dd).map(w => w.start);
    H.render();
  }, CALL_MS);
}

/* ---------- Part: scheduling ---------- */
H.part('scheduling', {
  owns: ['scheduling'],
  history(r) {
    if (!r.approval || !['scheduling', 'scheduled', 'complete'].includes(r.status)) return '';
    const pro = H.esc(proName(r)), d = drafts[r.id];
    let out = '';
    if (r.status === 'scheduling' && isReschedule(r)) {
      out += H.u('Change the time');
      out += H.h(`<p>Same pro, same price. Only the time changes.</p>${r.booking ? `<p>Right now you’re booked for <b>${H.esc(H.when(r.booking.window.start, r.booking.window.end))}</b>. That stays until ${pro} confirms a new time.</p>` : ''}`);
    }
    out += `<div class="bu h" data-bk-ask><p>When can ${pro} come? Pick every time that works — I’ll ask for the first one they can do.</p></div>`;
    if (r.status === 'scheduling' && d && d.calling) {
      out += H.u(`Any of these work:<br>${listWhen(d.sent || [])}`);
      out += H.h(`<p>Calling ${pro} to book…</p>`);
      out += `<div class="call bk-call" role="status"><div class="who"><div class="t">${pro}</div><div class="s">Booking call ${H.demo('Demo · simulated call')}</div></div>
        <span class="st live"><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span> Talking</span></div>`;
    }
    return out;
  },
  dock(r) {
    const d = draft(r.id), q = quoteOf(r), pro = H.esc(proName(r));
    if (d.calling) return `<p class="meta-line bk-wait">${H.demo('Demo · simulated call')} Booking with ${pro}. Usually under a minute.</p>
      <button class="btn block" disabled style="margin-top:10px">${H.icon('phone')} Calling…</button>`;
    const reopenLink = `<div class="bk-alt"><button class="btn plain" data-bk-reopen>Choose a different pro</button></div>`;
    if (!q) return `<div class="note amber bk-err" role="alert">${H.icon('alert')}<span>I can’t find the price you approved. Get fresh prices to keep going.</span></div>
      <button class="btn block" data-bk-reopen>Get new prices</button>`;
    const expired = Date.parse(q.expiresAt) <= Date.now() || d.err === 'expired', cur = r.booking && r.booking.window;
    const wins = futureWindows(q);
    if (expired || !wins.length) return `<div class="note amber bk-err" role="alert">${H.icon('alert')}<span>${expired
      ? `${pro}’s price ran out. Get new prices to keep going.` : `${pro} has no open times left. Get new prices and pick again.`}</span></div>
      <button class="btn block" data-bk-reopen>Get new prices</button>`;
    const acc = accessDraft(r, d), n = acc.length;
    const errBox = d.err ? `<div class="note amber bk-err" role="alert">${H.icon('alert')}<span class="grow"><b>I couldn’t book that.</b> ${H.esc(errCopy(d.err, proName(r)))}</span></div>` : '';
    return `<div class="bk-pick">${errBox}
      <p class="bk-q" id="bk-times-l">Times that work for you</p>
      <div class="slots" role="group" aria-labelledby="bk-times-l" ${d.showPickErr ? 'aria-describedby="bk-slot-msg"' : ''}>
        ${wins.map(w => { const [day, time] = split(w), on = d.picked.includes(w.start);
          if (cur && cur.start === w.start && cur.end === w.end) return `<button type="button" disabled aria-disabled="true"><span class="bk-day">${H.esc(day)}</span><small>${H.esc(time)} · Your current time</small></button>`;
          return `<button type="button" data-bk-slot="${H.esc(w.start)}" aria-pressed="${on}"><span class="bk-day"><span class="bk-tick">${H.icon('check')}</span>${H.esc(day)}</span><small>${H.esc(time)}</small></button>`; }).join('')}
      </div>
      ${d.showPickErr ? `<p class="bk-slotmsg" id="bk-slot-msg" role="alert">${H.icon('alert')} Pick at least one time.</p>` : ''}
      <div class="field">
        <label for="bk-access">How do they get in?</label>
        <textarea id="bk-access" maxlength="${MAX_ACCESS}" aria-describedby="bk-access-h bk-access-c" placeholder="For example: tenant is home, or the key is in the lockbox">${H.esc(acc)}</textarea>
        <span class="bk-row"><span class="hint" id="bk-access-h">Only shared with the pro you approved.</span>
        <span class="bk-count" id="bk-access-c" aria-live="polite">${n} / ${MAX_ACCESS}</span></span>
      </div>
      <button class="btn block" data-bk-book>${H.icon('phone')} ${d.err ? 'Try calling again' : 'Call to book'}</button>
      ${reopenLink}
    </div>`;
  },
  bind(root, r) {
    if (r.status !== 'scheduling') return;
    const d = draft(r.id);
    root.querySelectorAll('[data-bk-reopen]').forEach(b => b.onclick = () => askReopen(r, false));
    root.querySelectorAll('[data-bk-slot]').forEach(b => b.onclick = () => {
      const s = b.dataset.bkSlot, on = !d.picked.includes(s);
      d.picked = on ? [...d.picked, s] : d.picked.filter(x => x !== s);
      b.setAttribute('aria-pressed', String(on));
      if (on && d.showPickErr) { d.showPickErr = false; const m = root.querySelector('#bk-slot-msg'); if (m) m.remove(); root.querySelector('.bk-pick .slots').removeAttribute('aria-describedby'); }
    });
    const ta = root.querySelector('#bk-access'), cnt = root.querySelector('#bk-access-c');
    if (ta) ta.oninput = () => { d.access = ta.value; cnt.textContent = `${ta.value.length} / ${MAX_ACCESS}`; cnt.classList.toggle('over', ta.value.length > MAX_ACCESS - 100); };
    const go = root.querySelector('[data-bk-book]');
    if (go) go.onclick = () => startBooking(r, root);
    /* The picker is a full step, not a footer: bring the question into view instead of the thread's end. */
    const ask = root.querySelector('[data-bk-ask]');
    if (ask && !d.calling && !d.err && !d.showPickErr) requestAnimationFrame(() => ask.scrollIntoView({block: 'start'}));
    if (d.err || d.showPickErr) requestAnimationFrame(() => { const t = root.querySelector('.bk-pick') || root.querySelector('.dock'); if (t) t.scrollIntoView({block: 'start'}); });
    /* Runs after core's scroll-to-end: keep the "Calling…" bubble and the Talking row in view above the dock. */
    if (d.calling) requestAnimationFrame(() => { const c = root.querySelector('.bk-call'); if (c) c.scrollIntoView({block: 'center'}); });
    focusOnce(root, r.id);
  }
});

/* ---------- Part: booked ---------- */
H.part('booked', {
  owns: ['scheduled', 'complete'],
  history(r) {
    if (!['scheduled', 'complete'].includes(r.status) || !r.booking) return '';
    const b = r.booking, pro = H.esc(proName(r));
    const sent = (lastEvent(r, 'availability.submitted') || {}).payload;
    const ws = sent && Array.isArray(sent.windows) && sent.windows.length ? sent.windows : [b.window];
    const done = r.status === 'complete';
    let out = H.u(`Any of these work:<br>${listWhen(ws)}`);
    out += `<div class="qc bk-card">
      <div class="top"><div class="qn">${H.icon('cal')} You’re booked</div>${done ? `<span class="tag">${H.icon('check')} Fixed</span>` : `<span class="tag">${H.icon('check')} Confirmed</span>`}</div>
      <p class="bk-said">I called ${pro} and they confirmed.</p>
      <p class="bk-when">${H.esc(H.when(b.window.start, b.window.end))}</p>
      <p class="meta-line">${H.esc(H.money(b.amountCents))} · ${H.esc(warrantyOf(r))}</p>
      <div class="bk-acc">${H.icon('key')}<span>${b.access ? `<b>How they get in:</b> ${H.esc(b.access)}` : 'No access note. They’ll call you when they arrive.'}</span></div>
      <div class="ln"></div>
      <div class="btns"><button class="btn ghost" data-bk-ics>${H.icon('cal')} Add to my calendar</button></div>
      <div class="bk-foot">${H.demo('Demo · simulated booking')}<button class="bk-link" data-bk-said>What they said</button></div>
    </div>`;
    out += done
      ? H.h(`<p>Great — marked as fixed. Your ${H.esc(warrantyOf(r))} runs from today.</p>`)
      : H.h('<p>That’s it. Tell me if anything changes, or when it’s fixed.</p>');
    return out;
  },
  dock(r) {
    if (r.status === 'complete') return `<div class="bk-done"><button class="btn" data-nav="#/new">${H.icon('plus')} Report a new problem</button>
      <button class="btn ghost" data-nav="#/">Back to your repairs</button></div>`;
    return `<div class="bk-dock"><div class="qr" role="group" aria-label="What next">
      <button type="button" data-bk-move>Change the time</button>
      <button type="button" data-bk-fixed>It’s fixed</button>
      <button type="button" data-bk-new>Get new prices</button></div></div>`;
  },
  bind(root, r) {
    if (!['scheduled', 'complete'].includes(r.status)) return;
    const on = (sel, fn) => root.querySelectorAll(sel).forEach(b => b.onclick = fn);
    on('[data-bk-ics]', () => { const fresh = H.repair(r.id) || r; if (fresh.booking) downloadIcs(fresh); });
    on('[data-bk-said]', () => showTranscript(r));
    on('[data-bk-move]', () => askReschedule(r));
    on('[data-bk-fixed]', () => askFixed(r));
    on('[data-bk-new]', () => askReopen(r, true));
    if (focusNext[r.id]) { requestAnimationFrame(() => { const c = root.querySelector('.bk-card'); if (c) c.scrollIntoView({block: 'start'}); }); focusOnce(root, r.id); }
  }
});

H.booking = {buildIcs};
})();
