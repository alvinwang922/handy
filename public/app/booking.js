/* booking.js — scheduling + booked parts of the repair thread.
   Registers H.part('scheduling') (status: scheduling) and H.part('booked') (status: scheduled, complete).
   Booking: on Yes the user picks the 2-hour slots they are free (quotes.js) and H.approveAndBook (core) books the earliest.
   The scheduling picker only appears for reschedules (or if the automatic booking could not go through):
   the same 2-hour chips grouped by day, multi-select up to MAX_PICK, then "Book the earliest".
   The "note for the pro" is optional, added after booking, and kept on this device only (localStorage per repair).
   Local per-repair UI state (picked time, the in-progress booking call, last error) lives in `drafts`
   so it survives the full re-renders core does after every mutation. */
(function(){
const H = window.H;
const MAX_NOTE = 1200, CALL_MS = 2500, AUTO_MS = 60000, MAX_PICK = 6;
const drafts = {};
const draft = id => drafts[id] || (drafts[id] = {picked: [], calling: false, err: null, showPickErr: false, sent: null});

/* ---------- Module CSS (injected once) ---------- */
if (!document.getElementById('css-booking')) {
  const st = document.createElement('style'); st.id = 'css-booking';
  st.textContent = `
.dock:has(.bk-pick),.dock:has(.bk-wait){position:static}
.bk-pick,[data-bk-ask]{scroll-margin-top:88px}
.bk-pick .bk-q{font-weight:700;margin:0 0 10px}
.bk-pick .bk-sub{font-size:15px;color:var(--ink2);margin:-6px 0 12px}
.bk-days{display:flex;flex-direction:column;gap:14px;margin-bottom:6px}
.bk-days h3{font-size:16px;font-weight:700;margin:0 0 8px;color:var(--ink)}
.bk-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}
.bk-chips button{min-height:48px;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:0 10px;border:1.5px solid #C9C3B6;border-radius:12px;background:#fff;color:var(--ink);font:inherit;font-size:16px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;cursor:pointer;transition:border-color .15s ease-out,background-color .15s ease-out}
.bk-chips button .ic{width:16px;height:16px;display:none}
.bk-chips button:hover:not([disabled]):not([aria-disabled="true"]){border-color:var(--green)}
.bk-chips button[aria-pressed="true"]{border-color:var(--green);background:var(--green-tint);color:var(--green)}
.bk-chips button[aria-pressed="true"] .ic{display:inline-block}
.bk-chips button[aria-disabled="true"]{color:var(--ink3);border-color:var(--line);cursor:not-allowed}
.bk-chips button[disabled]{cursor:default;border-style:dashed;color:var(--ink2);font-weight:600;flex-direction:column;gap:0;line-height:1.15;padding:4px 8px}
.bk-chips button[disabled] small{font-size:14px;font-weight:600}
.bk-count-line{font-size:15px;color:var(--ink2);margin:10px 0 0;font-variant-numeric:tabular-nums}
.bk-card .bk-free{font-size:15px;color:var(--ink2);margin:2px 0 0;display:flex;align-items:center;gap:6px}
.bk-card .bk-free .ic{width:16px;height:16px;color:var(--ink3)}
.bk-pick .bk-slotmsg{font-size:15px;color:var(--amber);display:flex;gap:6px;align-items:center;margin:4px 0 0}
.bk-pick .bk-slotmsg .ic{width:18px;height:18px}
.bk-pick [data-bk-book]{margin-top:12px}
.bk-alt{display:flex;flex-wrap:wrap;justify-content:center;gap:0 8px;margin-top:6px}
.bk-alt .btn.plain{min-height:48px}
.bk-err{margin-bottom:12px}
.bk-err .grow{flex:1}
.bk-call{align-self:stretch;scroll-margin-bottom:24px}
.bk-card .qn:focus,.bk-call:focus{outline:none}
.bk-wait{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:0}
.bk-card .qn{display:flex;gap:8px;align-items:center}
.bk-card .qn .ic{color:var(--green)}
.bk-card .bk-said{margin:8px 0 0}
.bk-card .bk-when{font-size:24px;font-weight:800;line-height:1.2;margin:10px 0 4px;letter-spacing:-.01em;font-variant-numeric:tabular-nums;text-wrap:balance}
.bk-card .bk-note{display:flex;gap:10px;align-items:flex-start;margin-top:14px;font-size:15px;color:var(--ink2)}
.bk-card .bk-note>.ic{width:18px;height:18px;margin-top:3px;color:var(--ink3)}
.bk-card .bk-note .grow{flex:1;min-width:0}
.bk-card .bk-note b{color:var(--ink);font-weight:700}
.bk-card .bk-note .bk-nt{color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere;margin:2px 0 0}
.bk-card .bk-note .bk-opt{color:var(--ink3)}
.bk-card .bk-note .bk-link{min-height:44px;font-size:15px;display:inline-flex;align-items:center;gap:6px;margin-top:2px}
.bk-card .bk-note .bk-link .ic{width:16px;height:16px}
.bk-card .bk-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;margin-top:12px}
.bk-link{background:none;border:0;padding:0 2px;min-height:48px;color:var(--green);font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer;font-size:16px}
.bk-link:hover{color:var(--green-press)}
.bk-card .btns .btn{flex:none}
.bk-dock .qr{margin-bottom:0}
.bk-dock .qr button{min-height:48px}
.bk-done{display:flex;gap:10px;flex-wrap:wrap}
.bk-sheet p{margin:0 0 12px}
.bk-sheet .note{margin:0 0 16px}
.bk-sheet .field{margin:4px 0 12px}
.bk-sheet .field textarea{min-height:96px}
.bk-sheet .field label .bk-opt{font-weight:400;color:var(--ink3);margin-left:6px}
.bk-sheet .bk-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.bk-sheet .bk-count{font-size:14px;color:var(--ink3);font-variant-numeric:tabular-nums;flex:none}
.bk-sheet .bk-count.over{color:var(--amber)}
.bk-sheet .bk-acts{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.bk-sheet .bk-acts .btn.plain{align-self:center;min-height:48px}
.bk-sheet .bk-acts .bk-two{display:flex;justify-content:center;flex-wrap:wrap;gap:0 8px}
.bk-tx{display:flex;flex-direction:column;gap:12px;margin:0 0 16px;padding:0;list-style:none}
.bk-tx li{display:flex;flex-direction:column;gap:2px}
.bk-tx .who{font-size:15px;font-weight:700;color:var(--ink2)}
.bk-tx li.pro .who{color:var(--green)}
@media (max-width:639px){
  .bk-card .bk-when{font-size:22px}
  .bk-card .btns .btn{flex:1}
  .bk-done{flex-direction:column}
}
@media (prefers-reduced-motion:reduce){.bk-chips button{transition:none}}`;
  document.head.appendChild(st);
}

/* ---------- Helpers ---------- */
const quoteOf = r => r && r.approval ? (r.quotes || []).find(q => q.id === r.approval.quoteId) || null : null;
const proName = r => (quoteOf(r) || {}).name || (r.approval && r.approval.providerName) || 'the pro';
const warrantyOf = r => (quoteOf(r) || {}).warranty || 'workmanship warranty';
const futureWindows = q => (q && Array.isArray(q.windows) ? q.windows : []).filter(w => Date.parse(w.start) > Date.now())
  .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
/* "8–10 am", "10 am–12 pm": a 2-hour slot in the fewest words */
const hr = d => { const h = d.getHours() % 12 || 12, m = d.getMinutes(); return m ? `${h}:${String(m).padStart(2, '0')}` : String(h); };
const ap = d => d.getHours() < 12 ? 'am' : 'pm';
const slotLabel = w => { const s = new Date(w.start), e = new Date(w.end); return ap(s) === ap(e) ? `${hr(s)}–${hr(e)} ${ap(e)}` : `${hr(s)} ${ap(s)}–${hr(e)} ${ap(e)}`; };
const dayLabel = iso => new Date(iso).toLocaleDateString('en-US', {weekday: 'long', month: 'short', day: 'numeric'});
const countLine = n => n ? `${n} of ${MAX_PICK} picked` : 'Nothing picked yet';
const byDay = wins => { const out = []; wins.forEach(w => { const k = new Date(w.start).toDateString(); const g = out.find(x => x.k === k); if (g) g.wins.push(w); else out.push({k, label: dayLabel(w.start), wins: [w]}); }); return out; };
const sameWin = (a, b) => !!a && !!b && a.start === b.start && a.end === b.end;
const focusNext = {};
const focusOnce = (root, id) => {
  if (!focusNext[id]) return;
  const el = root.querySelector(focusNext[id]); delete focusNext[id];
  if (el) requestAnimationFrame(() => { if (!/^(BUTTON|TEXTAREA|A)$/.test(el.tagName)) el.tabIndex = -1; el.focus({preventScroll: true}); });
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

/* Events since the latest approval tell the story: was this booked automatically, and was it moved since? */
function story(r) {
  const ev = r.events || [];
  let i = -1; ev.forEach((e, k) => { if (e.type === 'quote.approved') i = k; });
  const after = i >= 0 ? ev.slice(i + 1) : ev;
  const approvedAt = i >= 0 ? Date.parse(ev[i].timestamp) : NaN;
  const first = after.find(e => e.type === 'appointment.confirmed');
  const auto = !first || !Number.isFinite(approvedAt) || Date.parse(first.timestamp) - approvedAt <= AUTO_MS;
  const moves = after.filter(e => e.type === 'appointment.reschedule_requested');
  const lastMove = moves[moves.length - 1];
  const lastConfirm = [...after].reverse().find(e => e.type === 'appointment.confirmed');
  const moved = !!lastMove && !!lastConfirm && lastConfirm.sequence > lastMove.sequence;
  const avail = [...after].reverse().find(e => e.type === 'availability.submitted');
  const free = avail && avail.payload && Array.isArray(avail.payload.windows) ? avail.payload.windows.length : 0;
  return {auto, moved, free, firstWindow: first && first.payload && first.payload.window};
}

/* ---------- Note for the pro (client-side only, per repair) ---------- */
const noteKey = id => `handy-pro-note:${id}`;
const getNote = id => { try { return localStorage.getItem(noteKey(id)) || ''; } catch { return ''; } };
const setNote = (id, text) => { try { text ? localStorage.setItem(noteKey(id), text) : localStorage.removeItem(noteKey(id)); } catch {} };
/* The note on this device wins; otherwise show any access text already stored with the booking. */
const noteOf = r => getNote(r.id) || (r.booking && r.booking.access) || '';

function noteSheet(r) {
  const pro = proName(r), cur = noteOf(r), had = !!getNote(r.id);
  H.sheet(cur ? 'Your note for the pro' : 'Add a note for the pro', `<div class="bk-sheet">
    <p>You’re already booked, so there’s nothing else you need to do. If ${H.esc(pro)} needs to know how to get in, write it here. I’ll share it with them when they arrive.</p>
    <div class="field">
      <label for="bk-note">How to get in<span class="bk-opt">Optional</span></label>
      <textarea id="bk-note" maxlength="${MAX_NOTE}" aria-describedby="bk-note-h bk-note-c" placeholder="For example: ring the side door, or the key is in the lockbox">${H.esc(cur)}</textarea>
      <span class="bk-row"><span class="hint" id="bk-note-h">Only for ${H.esc(pro)}. Saved on this device.</span>
      <span class="bk-count" id="bk-note-c">${cur.length} / ${MAX_NOTE}</span></span>
    </div>
    <div class="bk-acts">
      <button class="btn block" data-yes>Save note</button>
      <div class="bk-two">${had ? '<button class="btn plain" data-del>Remove note</button>' : ''}<button class="btn plain" data-no>Cancel</button></div>
    </div></div>`, (d, close) => {
    const ta = d.querySelector('#bk-note'), cnt = d.querySelector('#bk-note-c');
    ta.oninput = () => { cnt.textContent = `${ta.value.length} / ${MAX_NOTE}`; cnt.classList.toggle('over', ta.value.length > MAX_NOTE - 100); };
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    d.querySelector('[data-no]').onclick = close;
    const del = d.querySelector('[data-del]');
    if (del) del.onclick = () => { setNote(r.id, ''); close(); H.toast('Note removed'); H.render(); };
    d.querySelector('[data-yes]').onclick = () => {
      const v = ta.value.trim().slice(0, MAX_NOTE);
      setNote(r.id, v); close(); H.toast(v ? `Saved. I’ll share it with ${pro} when they arrive.` : 'No note saved'); H.render();
    };
  });
}

/* ---------- .ics ---------- */
const icsDate = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const fold = line => {
  const out = []; let cur = '', bytes = 0;
  for (const ch of line) {
    const b = new TextEncoder().encode(ch).length;
    if (bytes + b > 75) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += b;
  }
  out.push(cur); return out.join('\r\n');
};
function buildIcs(r) {
  const b = r.booking, prop = H.prop(r.property) || {}, note = noteOf(r);
  const desc = [
    `Price: ${H.money(b.amountCents)} (provisional)`,
    `Warranty: ${warrantyOf(r)}`,
    `How to get in: ${note || 'They will call you on arrival.'}`,
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
  H.sheet(title, `<div class="bk-sheet">${body}${sheetActs(H.esc(primary), primaryCls, secondary)}</div>`, (d, close) => {
    d.querySelector('[data-no]').onclick = close;
    d.querySelector('[data-yes]').onclick = () => { close(); onYes(); };
  });
}
const askReopen = (r, booked) => {
  const pro = H.esc(proName(r)), price = H.esc(H.money(r.approval && r.approval.amountCents));
  const body = booked
    ? `<div class="note amber">${H.icon('alert')}<span>This cancels your booking with ${pro}${r.booking ? ` on ${H.esc(H.when(r.booking.window.start, r.booking.window.end))}` : ''}.</span></div>
       <p>Your yes on the ${price} price goes away too. I’ll get fresh prices from pros, then you pick again.</p>`
    : `<p>This drops your yes for ${pro} at ${price}. I’ll get fresh prices from pros, then you pick again.</p>`;
  confirmSheet(booked ? 'Get new prices?' : 'Choose a different pro?', body,
    booked ? 'Cancel booking and get new prices' : 'Yes, start over with new prices', booked ? 'Keep my booking' : `Keep ${proName(r)}`,
    () => { delete drafts[r.id]; H.mutate(r.id, 'reopen', {}); }, booked ? 'danger' : '');
};
const askReschedule = r => confirmSheet('Change the time?',
  `<p>I’ll keep ${H.esc(proName(r))} and the same price, ${H.esc(H.money(r.approval && r.approval.amountCents))}. You pick a new time, and I’ll call them to move it.</p>`,
  'Pick a new time', 'Keep this time', () => { delete drafts[r.id]; H.mutate(r.id, 'reschedule', {}); });
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

/* ---------- Booking call (reschedule or manual pick) ---------- */
function startBooking(r, wins) {
  const d = draft(r.id);
  if (!wins || !wins.length) { d.showPickErr = true; focusNext[r.id] = '.bk-chips button[aria-pressed]'; H.render(); return; }
  if (d.calling || H.state.busy) return;
  const list = wins.slice(0, MAX_PICK).map(w => ({start: w.start, end: w.end})).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  d.calling = true; d.err = null; d.showPickErr = false; d.sent = list; H.state.error = null;
  focusNext[r.id] = '.bk-call';
  H.render();
  /* plain timeout, not H.later: the call must finish even if the user navigates away mid-animation */
  setTimeout(async () => {
    const done = await H.mutate(r.id, 'book', {windows: d.sent, access: r.access || ''});
    const dd = draft(r.id); dd.calling = false;
    if (done) { delete drafts[r.id]; focusNext[r.id] = '.bk-card .qn'; H.render(); return; }
    dd.err = errKind(H.state.error); H.state.error = null;
    focusNext[r.id] = dd.err === 'expired' ? '[data-bk-reopen]' : '[data-bk-book]';
    H.render();
  }, CALL_MS);
}

/* ---------- Part: scheduling (reschedules, or a fallback if the automatic booking didn't go through) ---------- */
H.part('scheduling', {
  owns: ['scheduling'],
  history(r) {
    if (r.status !== 'scheduling' || !r.approval) return '';
    const pro = H.esc(proName(r)), d = drafts[r.id];
    let out = '';
    if (r.booking) {
      out += H.u('Change the time');
      out += `<div class="bu h" data-bk-ask><p>Same pro, same price. Only the time changes.</p><p>Right now you’re booked for <b>${H.esc(H.when(r.booking.window.start, r.booking.window.end))}</b>. That stays until ${pro} confirms a new time.</p><p>Tap every 2-hour slot you’re free. I’ll book the earliest one.</p></div>`;
    } else {
      out += `<div class="bu h" data-bk-ask><p>I couldn’t book ${pro} on my own. Tap every 2-hour slot you’re free and I’ll call them to book the earliest.</p></div>`;
    }
    if (d && d.calling && d.sent) {
      out += H.u(d.sent.length === 1 ? `Book ${H.esc(H.when(d.sent[0].start, d.sent[0].end))}`
        : `I’m free ${d.sent.length} times. The earliest is ${H.esc(H.when(d.sent[0].start, d.sent[0].end))}.`);
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
    if (!q) return `<div class="note amber bk-err" role="alert">${H.icon('alert')}<span>I can’t find the price you approved. Get new prices to keep going.</span></div>
      <button class="btn block" data-bk-reopen>Get new prices</button>`;
    const expired = Date.parse(q.expiresAt) <= Date.now() || d.err === 'expired', cur = r.booking && r.booking.window;
    const wins = futureWindows(q);
    const open = wins.filter(w => !sameWin(w, cur));
    if (expired || !open.length) return `<div class="note amber bk-err" role="alert">${H.icon('alert')}<span>${expired
      ? `${pro}’s price ran out. Get new prices to keep going.` : `${pro} has no other open times. Get new prices and pick again.`}</span></div>
      <button class="btn block" data-bk-reopen>Get new prices</button>
      ${cur && wins.some(w => sameWin(w, cur)) ? '<div class="bk-alt"><button class="btn plain" data-bk-keep>Keep my current time</button></div>' : ''}`;
    const errBox = d.err ? `<div class="note amber bk-err" role="alert">${H.icon('alert')}<span class="grow"><b>I couldn’t book that.</b> ${H.esc(errCopy(d.err, proName(r)))}</span></div>` : '';
    const keep = cur && wins.some(w => sameWin(w, cur));
    d.picked = d.picked.filter(st => open.some(w => w.start === st));
    const full = d.picked.length >= MAX_PICK;
    return `<div class="bk-pick">${errBox}
      <p class="bk-q" id="bk-times-l">${cur ? 'When are you free?' : `When can ${pro} come?`}</p>
      <p class="bk-sub">Pick up to ${MAX_PICK} slots. I’ll book the earliest.</p>
      <div class="bk-days" role="group" aria-labelledby="bk-times-l" ${d.showPickErr ? 'aria-describedby="bk-slot-msg"' : ''}>
        ${byDay(wins).map(g => `<div><h3>${H.esc(g.label)}</h3><div class="bk-chips">${g.wins.map(w => {
          const lb = slotLabel(w);
          if (sameWin(w, cur)) return `<button type="button" disabled aria-label="${H.esc(g.label + ', ' + lb)}, your current time">${H.esc(lb)}<small>Your time now</small></button>`;
          const on = d.picked.includes(w.start);
          return `<button type="button" data-bk-slot="${H.esc(w.start)}" aria-pressed="${on}" aria-label="${H.esc(g.label + ', ' + lb)}"${!on && full ? ' aria-disabled="true"' : ''}>${H.icon('check')}${H.esc(lb)}</button>`; }).join('')}</div></div>`).join('')}
      </div>
      <p class="bk-count-line" aria-live="polite" data-bk-count>${countLine(d.picked.length)}</p>
      ${d.showPickErr ? `<p class="bk-slotmsg" id="bk-slot-msg" role="alert">${H.icon('alert')} Tap at least one slot first.</p>` : ''}
      <button class="btn block" data-bk-book>${H.icon('phone')} ${d.err ? 'Try booking again' : 'Book the earliest'}</button>
      <div class="bk-alt">${keep ? '<button class="btn plain" data-bk-keep>Keep my current time</button>' : ''}<button class="btn plain" data-bk-reopen>Choose a different pro</button></div>
    </div>`;
  },
  bind(root, r) {
    if (r.status !== 'scheduling') return;
    const d = draft(r.id), q = quoteOf(r);
    root.querySelectorAll('[data-bk-reopen]').forEach(b => b.onclick = () => askReopen(r, !!r.booking));
    const slots = [...root.querySelectorAll('[data-bk-slot]')];
    const sync = () => {
      const full = d.picked.length >= MAX_PICK;
      slots.forEach(x => { const on = d.picked.includes(x.dataset.bkSlot); x.setAttribute('aria-pressed', String(on));
        if (!on && full) x.setAttribute('aria-disabled', 'true'); else x.removeAttribute('aria-disabled'); });
      const c = root.querySelector('[data-bk-count]'); if (c) c.textContent = countLine(d.picked.length);
    };
    slots.forEach(b => b.onclick = () => {
      const st = b.dataset.bkSlot, i = d.picked.indexOf(st);
      if (i >= 0) d.picked.splice(i, 1);
      else if (d.picked.length >= MAX_PICK) { H.toast(`You can pick up to ${MAX_PICK} slots. Tap one to remove it first.`); return; }
      else d.picked.push(st);
      if (d.showPickErr) { d.showPickErr = false; const m = root.querySelector('#bk-slot-msg'); if (m) m.remove(); const g = root.querySelector('.bk-days'); if (g) g.removeAttribute('aria-describedby'); }
      sync();
    });
    const go = root.querySelector('[data-bk-book]');
    if (go) go.onclick = () => startBooking(r, futureWindows(q).filter(w => d.picked.includes(w.start) && !sameWin(w, r.booking && r.booking.window)));
    const keep = root.querySelector('[data-bk-keep]');
    if (keep) keep.onclick = () => startBooking(r, r.booking && r.booking.window ? [r.booking.window] : []);
    /* The picker is a full step, not a footer: bring the question into view instead of the thread's end. */
    const ask = root.querySelector('[data-bk-ask]');
    if (ask && !d.calling && !d.err && !d.showPickErr) requestAnimationFrame(() => ask.scrollIntoView({block: 'start'}));
    if (d.err || d.showPickErr) requestAnimationFrame(() => { const t = root.querySelector('.bk-pick') || root.querySelector('.dock'); if (t) t.scrollIntoView({block: 'start'}); });
    if (d.calling) requestAnimationFrame(() => { const c = root.querySelector('.bk-call'); if (c) c.scrollIntoView({block: 'center'}); });
    focusOnce(root, r.id);
  }
});

/* ---------- Part: booked ---------- */
H.part('booked', {
  owns: ['scheduled', 'complete'],
  history(r) {
    if (!['scheduled', 'complete'].includes(r.status) || !r.booking) return '';
    const b = r.booking, pro = H.esc(proName(r)), s = story(r), done = r.status === 'complete';
    const note = noteOf(r);
    let out = s.free > 1 ? H.h(`<p>Done. I booked <b>${pro}</b> for the first of your times.</p>`)
      : s.free === 1 ? H.h(`<p>Done. I booked <b>${pro}</b> for the time you picked.</p>`)
      : H.h(`<p>Done. I booked <b>${pro}</b> for the earliest time they had.</p>`);
    if (s.moved) out += H.u(`Change the time to ${H.esc(H.when(b.window.start, b.window.end))}`);
    const noteRow = note
      ? `<div class="bk-note">${H.icon('key')}<div class="grow"><b>Note for ${pro}</b><p class="bk-nt">${H.esc(note)}</p>
          ${done ? '' : `<button class="bk-link" data-bk-note>${H.icon('edit')} Change note</button>`}</div></div>`
      : done ? ''
      : `<div class="bk-note">${H.icon('key')}<div class="grow"><span>They’ll call you when they arrive.</span><br>
          <button class="bk-link" data-bk-note>${H.icon('plus')} Add a note for the pro</button> <span class="bk-opt">Optional</span></div></div>`;
    out += `<div class="qc bk-card">
      <div class="top"><div class="qn">${H.icon('cal')} You’re booked</div>${done ? `<span class="tag">${H.icon('check')} Fixed</span>` : `<span class="tag">${H.icon('check')} Confirmed</span>`}</div>
      <p class="bk-said">${s.moved ? `I called ${pro} and they moved you to the new time.` : `I called ${pro} and they confirmed.`}</p>
      <p class="bk-when">${H.esc(H.when(b.window.start, b.window.end))}</p>
      ${s.free ? `<p class="bk-free">${H.icon('clock')}You were free: ${s.free} ${s.free === 1 ? 'slot' : 'slots'}</p>` : ''}
      <p class="meta-line">${H.esc(H.money(b.amountCents))} · ${H.esc(warrantyOf(r))}</p>
      ${noteRow}
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
    on('[data-bk-note]', () => noteSheet(r));
    on('[data-bk-move]', () => askReschedule(r));
    on('[data-bk-fixed]', () => askFixed(r));
    on('[data-bk-new]', () => askReopen(r, true));
    if (focusNext[r.id]) { requestAnimationFrame(() => { const c = root.querySelector('.bk-card'); if (c) c.scrollIntoView({block: 'start'}); }); focusOnce(root, r.id); }
  }
});

H.booking = {buildIcs, noteOf};
})();
