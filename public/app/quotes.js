/* quotes.js — the price calls, a 3-column side-by-side comparison with pros and cons, transcripts, and the
   "approve and book" sheet (with "When are you free?" 2-hour slot picking). Registers H.part('quotes'). Owns status 'quotes'.
   Flow: prices are requested automatically after Send (H.autopilot). The user compares options in aligned columns,
   picks every 2-hour slot that works, and "Yes, approve and book" calls H.approveAndBook(r, q, '', picked).
   "Get new prices" keeps the conversation: earlier rounds (repair.rounds) stay as history, then the new calls animate. */
(function(){
const H = window.H;
if (!H) return;
const esc = H.esc, icon = H.icon;

/* ---------- Module CSS (injected once) ---------- */
if (!document.getElementById('css-quotes')) {
  const st = document.createElement('style'); st.id = 'css-quotes';
  st.textContent = `
.qz-calls{align-self:stretch}
.qz-calls .call{flex-wrap:wrap;row-gap:4px}
.qz-calls .call .who .s{display:flex;align-items:center;gap:5px;white-space:nowrap}
.qz-calls .call .who .s .ic{width:15px;height:15px}
@media (max-width:639px){.qz-calls .call .who{flex:1 1 100%}.qz-calls .call .qz-st{flex:1}}
.qz-calls .star,.qz-ok .star,.qz-sub .star,.qz-opt .star{color:var(--amber)}
.qz-calls .st .ic{width:18px;height:18px}
.qz-calls .st{transition:color .25s ease-out}
.qz-said{min-height:48px;padding:0 6px;margin:-6px -6px -6px 0;border:0;background:none;color:var(--green);font-weight:700;font-size:15px;text-decoration:underline;text-underline-offset:3px;cursor:pointer;border-radius:10px;white-space:nowrap}
.qz-said:hover{background:var(--green-tint)}
.qz-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:2px}

/* Price options: true side-by-side comparison. One column per pro, rows aligned through subgrid
   (same row = same thing: name, price, why, rating, when, guarantee, good, not so good, button). */
.qz-opts{align-self:stretch;container-type:inline-size;margin:2px 0}
.qz-cmp{display:grid;grid-template-columns:repeat(var(--k,3),minmax(0,1fr));grid-template-rows:repeat(9,auto);column-gap:10px;row-gap:0;list-style:none;margin:0;padding:0}
.qz-col{grid-row:1/span 9;display:grid;grid-template-rows:subgrid;background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:8px 0 14px;min-width:0}
.qz-col.qz-rec,.qz-col.qz-chosen{border-color:var(--green);box-shadow:inset 0 0 0 1px var(--green),var(--shadow)}
.qz-col.qz-dim{opacity:.62}
.qz-c{padding:5px 14px;min-width:0}
.qz-c:empty{padding:0}
.qz-hd{display:flex;flex-direction:column;align-items:flex-start;gap:6px;padding-top:6px}
.qz-name{font-weight:700;font-size:17px;line-height:1.25;margin:0;text-wrap:balance}
.qz-hd .tag .ic{width:15px;height:15px}
.qz-price{font-size:30px;font-weight:800;letter-spacing:-.01em;line-height:1.1;font-variant-numeric:tabular-nums;white-space:nowrap}
.qz-why{font-size:15px;line-height:1.35;color:var(--ink)}
.qz-f{display:flex;align-items:flex-start;gap:7px;font-size:15px;line-height:1.35;color:var(--ink2)}
.qz-f .ic{width:17px;height:17px;color:var(--ink3);margin-top:1px}
.qz-f .star{color:var(--amber)}
.qz-f + .qz-f{padding-top:3px}
.qz-pc ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px}
.qz-pc li{display:flex;align-items:flex-start;gap:7px;font-size:15px;line-height:1.35}
.qz-pc.qz-pros{padding-top:10px;border-top:1px solid var(--line);margin:6px 14px 0;padding-inline:0}
.qz-pro{color:var(--ink)}
.qz-pro .ic{width:17px;height:17px;color:var(--green);margin-top:1px}
.qz-con{color:var(--ink2)}
.qz-con::before{content:"";flex:none;width:11px;height:2px;margin:9px 3px 0;border-radius:1px;background:var(--ink3)}
.qz-cta{align-self:end;padding-top:12px}
.qz-cta .btn{width:100%;min-height:52px;padding:8px 12px;font-size:16px;line-height:1.2;text-align:center}
.qz-done{display:inline-flex;align-items:center;gap:6px;font-weight:700;color:var(--green);font-size:15px}
.qz-done .ic{width:18px;height:18px}
.qz-swipe{display:none}
@supports not (grid-template-rows:subgrid){
  .qz-col{display:flex;flex-direction:column}
  .qz-cta{margin-top:auto}
}
/* Narrow thread (phones, tablets with the list open): columns scroll sideways and snap, never stack */
@container (max-width:559px){
  .qz-cmp{grid-template-columns:repeat(var(--k,3),84%);overflow-x:auto;scroll-snap-type:x mandatory;overscroll-behavior-x:contain;
    margin:0 -16px;padding:2px 16px 10px;scroll-padding-inline:16px;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
  .qz-cmp[data-k="1"]{grid-template-columns:100%}
  .qz-col{scroll-snap-align:start}
  .qz-swipe{display:flex}
}
@media (prefers-reduced-motion:no-preference){
  .qz-in .qz-col{animation:qzIn .5s cubic-bezier(.16,1,.3,1) both}
  .qz-in .qz-col:nth-child(2){animation-delay:.08s}
  .qz-in .qz-col:nth-child(3){animation-delay:.16s}
}
@keyframes qzIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

/* Earlier price rounds kept in the conversation */
.bu.h.qz-old{background:var(--pinned);color:var(--ink2);border:1px solid var(--line)}
.bu.u.qz-again{display:inline-flex;align-items:center;gap:8px}
.bu.u.qz-again .ic{width:18px;height:18px}

/* "When are you free?" slot picker */
.qz-when{margin:20px 0 4px}
.qz-when h3{font-size:19px;line-height:1.25;margin:0 0 4px}
.qz-when .qz-hint{margin:0 0 14px;color:var(--ink2);font-size:16px}
.qz-day{margin:0 0 14px;border:0;padding:0}
.qz-day legend{font-size:15px;font-weight:700;color:var(--ink2);margin:0 0 6px;padding:0}
.qz-chips{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}
.qz-chip{min-height:48px;padding:6px 4px;border:1.5px solid #C9C3B6;border-radius:12px;background:#fff;color:var(--ink);font-weight:700;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;white-space:nowrap;font-variant-numeric:tabular-nums;transition:background-color .15s ease-out,border-color .15s ease-out}
.qz-chip:hover{border-color:var(--green)}
.qz-chip .ic{width:15px;height:15px;display:none}
.qz-chip[aria-pressed="true"]{border-color:var(--green);background:var(--green-tint);color:var(--green)}
.qz-chip[aria-pressed="true"] .ic{display:block}
@media (max-width:419px){.qz-chip[aria-pressed="true"] .ic{display:none}.qz-chip[aria-pressed="true"]{box-shadow:inset 0 0 0 1px var(--green)}}
.qz-chip:disabled{opacity:.45;cursor:not-allowed;border-color:var(--line)}
.qz-pick-msg{margin:2px 0 0;font-size:15px;color:var(--ink2);display:flex;align-items:center;gap:6px;min-height:22px}
.qz-pick-msg .ic{width:17px;height:17px}
.qz-pick-msg[data-warn]{color:var(--amber);font-weight:700}

/* Transcript sheet */
.qz-lead{margin:0 0 14px;color:var(--ink2)}
.qz-tx{display:flex;flex-direction:column;gap:10px;margin:0 0 16px}
.qz-tx .who{font-size:14px;font-weight:700;color:var(--ink2);margin:0 0 2px}
.qz-tx .bu.pro{background:var(--green-tint);color:var(--ink);border-bottom-right-radius:6px}
.qz-tx .row-h{align-self:flex-start;max-width:88%}
.qz-tx .row-p{align-self:flex-end;max-width:88%;text-align:right}
.qz-tx .row-p .bu,.qz-tx .row-h .bu{text-align:left;max-width:100%}
.qz-sub .ic{width:18px;height:18px}
.qz-sub{margin:0 0 14px;font-size:15px;color:var(--ink2);display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}

/* Approval sheet */
.qz-ok{display:flex;flex-direction:column;margin:0 0 16px;border:1px solid var(--line);border-radius:16px;overflow:hidden}
.qz-ok div{padding:12px 16px;border-bottom:1px solid var(--line)}
.qz-ok div:last-child{border-bottom:0}
.qz-ok dt{font-size:15px;color:var(--ink2);margin:0}
.qz-ok dd{margin:2px 0 0;font-weight:700}
.qz-ok dd small{display:flex;flex-wrap:wrap;align-items:center;gap:4px;font-weight:400;font-size:15px;color:var(--ink2);margin-top:2px}
.qz-ok dd small .ic{width:16px;height:16px}
.qz-ok .big{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.qz-consent{display:flex;gap:12px;align-items:flex-start;min-height:48px;padding:12px 14px;margin:16px 0;border:1.5px solid #C9C3B6;border-radius:14px;cursor:pointer;font-weight:600}
.qz-consent:has(input:checked){border-color:var(--green);background:var(--green-tint)}
.qz-consent input{width:24px;height:24px;margin:0;flex:none;accent-color:var(--green);cursor:pointer}
.qz-act{display:flex;flex-direction:column;gap:6px;align-items:stretch}
.qz-act .btn.plain{align-self:center}
.qz-steps{list-style:none;margin:16px 0 4px;padding:0;display:flex;flex-direction:column;gap:12px}
.qz-steps li{display:flex;align-items:center;gap:12px;min-height:40px;font-weight:700;color:var(--ink3)}
.qz-steps li[data-s="on"]{color:var(--ink)}
.qz-steps li[data-s="done"]{color:var(--green)}
.qz-steps .dot{width:32px;height:32px;flex:none;border-radius:50%;display:grid;place-items:center;border:2px solid var(--line);color:inherit}
.qz-steps li[data-s="on"] .dot{border-color:var(--amber);color:var(--amber)}
.qz-steps li[data-s="done"] .dot{border-color:var(--green);background:var(--green);color:#fff}
.qz-steps .dot .ic{width:16px;height:16px}
.qz-steps .tag.demo{margin-left:4px}
.qz-err{margin:0 0 14px}
.qz-err .grow{flex:1}
.qz-err .btn{margin-top:8px;flex:none;min-height:48px;background:#fff;color:var(--green);border:1.5px solid var(--green)}
.qz-dock-note{margin-top:8px}
.dock .qr button[data-qz]{min-height:48px}
.qz-focus:focus{outline:2px solid var(--green);outline-offset:3px}
`;
  document.head.appendChild(st);
}

/* ---------- Helpers ---------- */
const SEEN_KEY = 'handy-calls-seen';
const seenList = () => { try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]'); } catch { return []; } };
const isSeen = id => seenList().includes(id);
const markSeen = id => { try { const s = seenList(); if (!s.includes(id)) { s.push(id); sessionStorage.setItem(SEEN_KEY, JSON.stringify(s.slice(-200))); } } catch {} };
const unSeen = id => { try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(seenList().filter(x => x !== id))); } catch {} };
/* Each price round animates once: round 0 keeps the legacy key (repair id), later rounds add their number. */
const roundKey = r => { const n = (r.rounds || []).length; return n ? `${r.id}:${n}` : r.id; };
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(res => setTimeout(res, ms));

const TRADE = {plumbing:'plumbers', electrical:'electricians', hvac:'heating and cooling pros'};
const pros = (r, n) => n === 1 ? 'pro' : (TRADE[r.category] || 'pros');
const first = name => String(name || '').trim().split(/\s+/)[0] || 'this pro';
const dollars = n => n == null ? '' : '$' + Number(n).toLocaleString('en-US');
const gDays = w => { const m = String(w || '').match(/(\d+)\s*-?\s*day/i); return m ? Number(m[1]) : 0; };
const guarantee = w => gDays(w) ? `${gDays(w)}-day guarantee on the work` : (w || 'No guarantee mentioned');
const guaranteeShort = w => gDays(w) ? `${gDays(w)}-day guarantee` : (w || 'No guarantee mentioned');
/* 2-hour slots: "8–10 am", "10 am–12 pm", "12–2 pm" */
const hm = d => { const h = d.getHours(), m = d.getMinutes(); return { t: (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : ''), ap: h < 12 ? 'am' : 'pm' }; };
const slotText = w => {
  const a = hm(new Date(w.start)), b = hm(new Date(w.end));
  if (b.t === '12' && b.ap === 'pm') return `${a.t} ${a.ap}–noon`;
  return a.ap === b.ap ? `${a.t}–${b.t} ${b.ap}` : `${a.t} ${a.ap}–${b.t} ${b.ap}`;
};
const dayText = iso => {
  const d = new Date(iso), today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((new Date(iso).setHours(0, 0, 0, 0) - today) / 864e5);
  const base = d.toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'});
  return diff === 0 ? `Today, ${base}` : diff === 1 ? `Tomorrow, ${base}` : base;
};
const byDay = ws => ws.reduce((acc, w) => { const k = new Date(w.start).toDateString(), g = acc.find(x => x.k === k); if (g) g.ws.push(w); else acc.push({k, ws:[w]}); return acc; }, []);
const MAX_SLOTS = 6;
const futureWins = q => (q.windows || []).filter(w => Date.parse(w.start) > Date.now()).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
const soonest = q => { const w = futureWins(q)[0]; return w ? Date.parse(w.start) : Infinity; };
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
/* Live quotes carry real windows (a business name and a spoken time); demo quotes a short phrase. */
const win = q => q.live && q.windows && q.windows[0] ? H.when(q.windows[0].start, q.windows[0].end) : String(q.window || 'soon').toLowerCase();
const rating = q => Number(q.rating) || 0;
const provider = (r, id) => (r.discovery && r.discovery.providers || []).find(p => p.id === id) || {};

/* ---------- Ranking: best balance of rating, speed, and price (each scaled 0..1 against the others) ---------- */
const scale = (v, lo, hi) => hi === lo ? 1 : (v - lo) / (hi - lo);
const ranked = r => {
  const qs = (r.quotes || []).slice();
  if (!qs.length) return [];
  const R = qs.map(rating), P = qs.map(q => q.amountCents), D = qs.map(q => { const s = soonest(q); return isFinite(s) ? new Date(s).setHours(0,0,0,0) : 9e15; });
  const score = q => {
    const d = isFinite(soonest(q)) ? new Date(soonest(q)).setHours(0,0,0,0) : 9e15;
    return scale(rating(q), Math.min(...R), Math.max(...R))
      + scale(-d, -Math.max(...D), -Math.min(...D))
      + scale(-q.amountCents, -Math.max(...P), -Math.min(...P))
      + 0.25 * scale(gDays(q.warranty), Math.min(...qs.map(x => gDays(x.warranty))), Math.max(...qs.map(x => gDays(x.warranty))));
  };
  return qs.map(q => ({q, s: score(q)})).sort((a, b) => b.s - a.s || a.q.amountCents - b.q.amountCents).map(x => x.q).slice(0, 3);
};

/* Plain-word pros and cons, computed from the data relative to the other options shown. */
const prosCons = (q, all) => {
  const pro = [], con = [];
  if (all.length < 2) return {pro, con};
  const minP = Math.min(...all.map(o => o.amountCents)), maxP = Math.max(...all.map(o => o.amountCents));
  const maxR = Math.max(...all.map(rating)), minR = Math.min(...all.map(rating));
  const days = all.map(o => { const s = soonest(o); return isFinite(s) ? new Date(s).setHours(0,0,0,0) : 9e15; });
  const myDay = isFinite(soonest(q)) ? new Date(soonest(q)).setHours(0,0,0,0) : 9e15;
  const minD = Math.min(...days), maxD = Math.max(...days);
  const G = all.map(o => gDays(o.warranty)), maxG = Math.max(...G), minG = Math.min(...G);
  const maxRev = Math.max(...all.map(o => Number(o.reviews) || 0));

  if (minP !== maxP) {
    if (q.amountCents === minP) pro.push('Lowest price');
    else con.push(`Costs ${H.money(q.amountCents - minP)} more`);
  }
  if (maxR !== minR) {
    if (rating(q) === maxR) pro.push(`Highest rated (${q.rating} stars)`);
    else if (rating(q) === minR) con.push(`Lower rated (${q.rating} stars)`);
  }
  if (minD !== maxD) {
    if (myDay === minD) pro.push(`Can come ${win(q)}`);
    else con.push(`Comes later (${win(q)})`);
  }
  if (maxG !== minG) {
    if (gDays(q.warranty) === maxG) pro.push(`Longest guarantee (${maxG} days)`);
    else if (gDays(q.warranty) === minG) con.push(`Shorter guarantee (${minG || 'no'} days)`);
  }
  if (maxRev && (Number(q.reviews) || 0) === maxRev && all.some(o => (Number(o.reviews) || 0) !== maxRev)) pro.push(`Most reviews (${q.reviews})`);
  return {pro, con};
};

const recReason = (q, all) => {
  if (all.length < 2) return 'The only price I got, from a well-reviewed local pro.';
  const minP = Math.min(...all.map(o => o.amountCents));
  const bits = [];
  if (rating(q) === Math.max(...all.map(rating))) bits.push('top rated');
  if (all.every(o => soonest(q) <= soonest(o) || sameDay(soonest(q), soonest(o)))) bits.push(`can come ${win(q)}`);
  bits.push(q.amountCents === minP ? 'the lowest price' : `only ${H.money(q.amountCents - minP)} more than the cheapest`);
  const list = bits.length > 1 ? bits.slice(0, -1).join(', ') + ' and ' + bits[bits.length - 1] : bits[0];
  return `Best balance of rating, speed and price: ${list}.`;
};

/* ---------- Call animation timeline ---------- */
const STAGGER = 600, RING = 900, TALK = 2200, NOANSWER = 2800;
const callEnd = (c, i) => i * STAGGER + (c.status === 'completed' ? RING + TALK : NOANSWER);
const totalMs = r => Math.max(0, ...r.outreach.map(callEnd)) + 400;
const stageAt = (c, i, t) => {
  const s = i * STAGGER;
  if (t < s) return 'wait';
  if (c.status !== 'completed') return t < s + NOANSWER ? 'ring' : 'bad';
  if (t < s + RING) return 'ring';
  if (t < s + RING + TALK) return 'talk';
  return 'ok';
};
const starts = {};
const revealed = new Set();
const autoRun = new Set();
const animating = r => !H.isLive(r) && r.status === 'quotes' && r.outreach && r.outreach.length && !isSeen(roundKey(r)) && !reduced();
const elapsed = r => starts[roundKey(r)] ? Date.now() - starts[roundKey(r)] : 0;

const STAGE = {
  wait: ['wait', () => `${icon('clock')} Waiting`],
  ring: ['live', () => `${icon('phone')} Ringing`],
  talk: ['live', () => `<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span> Talking`],
  read: ['live', () => `${icon('doc')} Reading the call`],
  ok:   ['ok',   () => `${icon('check')} Got a price`],
  bad:  ['bad',  () => `${icon('x')} Didn’t pick up`]
};
const stHtml = stage => { const [cls, f] = STAGE[stage]; return `<span class="st ${cls}">${f()}</span>`; };

const callRow = (r, c, i, stage) => {
  const p = provider(r, c.providerId);
  const secs = c.durationSeconds ? ` · ${esc(c.durationSeconds)} sec` : '';
  const sub = c.status === 'in_progress' ? 'AI assistant on the line' : c.status !== 'completed' ? 'No answer'
    : (p.rating ? `${icon('star','star')} ${esc(p.rating)} · ${esc(p.reviews)} reviews${secs}` : `Phone call${secs}`);
  const done = stage === 'ok' || stage === 'bad';
  return `<div class="call" data-call="${i}">
    <div class="who"><div class="t">${esc(c.providerName)}</div><div class="s">${sub}</div></div>
    <span class="qz-st">${stHtml(stage)}</span>
    <button type="button" class="qz-said" data-said="${i}" ${done ? '' : 'hidden'}>What was said</button>
  </div>`;
};

/* ---------- Comparison column (9 aligned rows; empty cells collapse) ---------- */
/* Live: why Keewano picked these pros, who it skipped, and the unit's repair history. */
const keewanoHtml = r => {
  const d = r.discovery; if (!H.isLive(r) || !d || !d.providers || !d.providers.length) return '';
  const li = p => `<li><b>${esc(p.name)}</b>: ${esc(p.reason || 'no history yet')}</li>`;
  const called = d.providers.filter(p => p.called), skipped = d.providers.filter(p => !p.called);
  return H.h(`<p>${icon('chart')} Keewano picked who to call from each pro’s track record.</p>
    ${called.length ? `<ul>${called.map(li).join('')}</ul>` : ''}
    ${skipped.length ? `<p>Not calling:</p><ul>${skipped.map(li).join('')}</ul>` : ''}
    ${d.repairHistory ? `<p>${icon('info')} ${esc(d.repairHistory)}</p>` : ''}`);
};

const optionCol = (r, q, all, i) => {
  const a = r.approval, open = r.status === 'quotes' && !a;
  const rec = i === 0 && all.length > 1 && !a;
  const chosen = a && a.quoteId === q.id;
  const {pro, con} = prosCons(q, all);
  const cls = ['qz-col', rec ? 'qz-rec' : '', chosen ? 'qz-chosen' : '', a && !chosen ? 'qz-dim' : ''].filter(Boolean).join(' ');
  const list = (items, kind, label) => items.length ? `<ul aria-label="${label}">${items.map(t => `<li class="qz-${kind}">${kind === 'pro' ? icon('check') : ''}<span>${esc(t)}</span></li>`).join('')}</ul>` : '';
  const cta = open ? `<button type="button" class="btn${rec || all.length === 1 ? '' : ' ghost'}" data-book="${esc(q.id)}">Book ${esc(q.live ? q.name : first(q.name))} for ${H.price(q)}</button>`
    : chosen ? `<span class="qz-done">${icon('check')} You approved this one</span>` : '';
  return `<li class="${cls}" aria-label="${esc(q.name)}, ${H.price(q)}${rec ? ', recommended' : ''}">`
    + `<div class="qz-c qz-hd"><h3 class="qz-name">${esc(q.name)}</h3>${rec ? `<span class="tag">${icon('check')} Recommended</span>` : ''}</div>`
    + `<div class="qz-c qz-price">${H.price(q)}${q.feeText ? `<small>${esc(q.feeText)}</small>` : ''}</div>`
    + `<div class="qz-c qz-why">${rec ? esc(recReason(q, all)) : ''}</div>`
    + `<div class="qz-c qz-f">${icon('star','star')}<span>${esc(q.rating)} stars · ${esc(q.reviews)} reviews</span></div>`
    + `<div class="qz-c qz-f">${icon('clock')}<span>Can come ${esc(win(q))}</span></div>`
    + `<div class="qz-c qz-f">${icon('shield')}<span>${esc(guaranteeShort(q.warranty))}</span></div>`
    + `<div class="qz-c qz-pc qz-pros">${list(pro, 'pro', 'Good')}</div>`
    + `<div class="qz-c qz-pc">${list(con, 'con', 'Not so good')}</div>`
    + `<div class="qz-c qz-cta">${cta}</div>`
    + `</li>`;
};

/* ---------- Earlier rounds, kept as conversation ---------- */
const roundsHtml = r => {
  const rounds = r.rounds || [];
  return rounds.map((rd, idx) => {
    const qs = (rd.quotes || []).slice().sort((x, y) => x.amountCents - y.amountCents);
    let sum = qs.length ? `Earlier prices: ${qs.map(q => `${esc(q.name)} ${H.price(q)}`).join(', ')}.` : 'Last time, no one gave me a price.';
    if (rd.booking && rd.approval) sum += ` You had said yes to ${esc(rd.approval.providerName)} and booked a visit. Both were cancelled.`;
    else if (rd.approval) sum += ` You had said yes to ${esc(rd.approval.providerName)}. That was cancelled.`;
    const last = idx === rounds.length - 1;
    /* Only say we're calling when this round is actually under way (or done). */
    const calling = !last || (r.outreach || []).length || r.status === 'assessment';
    return `<div class="bu h qz-old"><p>${sum}</p></div>`
      + H.u('Get new prices')
      + (calling ? H.h(`<p>Calling pros again for fresh prices…</p>`) : '');
  }).join('');
};

/* ---------- Sheets ---------- */
const transcriptSheet = (r, c) => {
  const p = provider(r, c.providerId);
  const lines = (c.transcript || []).map(l => {
    const handy = /^handy$/i.test(String(l.speaker));
    return handy
      ? `<div class="row-h"><p class="who">Handy (AI assistant)</p><div class="bu h">${esc(l.text)}</div></div>`
      : `<div class="row-p"><p class="who">${esc(l.speaker)}</p><div class="bu pro">${esc(l.text)}</div></div>`;
  }).join('');
  const meta = `<p class="qz-sub">${c.timestamp ? `<span>${icon('clock')} ${esc(H.time(c.timestamp))}</span>` : ''}${c.durationSeconds ? `<span>${esc(c.durationSeconds)} sec call</span>` : ''}${c.status === 'completed' && p.rating ? `<span>${icon('star','star')} ${esc(p.rating)}</span>` : ''}${c.status !== 'completed' ? '<span>No answer</span>' : ''}</p>`;
  const body = c.status === 'in_progress' ? `${meta}<p class="qz-lead">The call is still going. The words appear here when it ends.</p>`
    : c.status === 'completed' && lines
    ? `${meta}<div class="qz-tx">${lines}</div>`
    : `${meta}<p class="qz-lead">No one answered. Nothing was said.</p>`;
  H.sheet(`What was said · ${c.providerName}`, `${body}
    <div class="note">${icon('info')}<span>${c.status === 'completed' ? 'This call was made by an AI assistant. It didn’t share your address or book anything.' : 'This call was made by an AI assistant. No one answered.'} ${H.tag(r, 'Demo · simulated call', 'Live · recorded by Dial')}</span></div>`);
};

const showErr = (d, msg, recovery, label = 'Get new prices', ic = 'refresh') => {
  const box = d.querySelector('[data-err]'); if (!box) return;
  box.hidden = false;
  box.innerHTML = `<div class="note red" role="alert">${icon('alert')}<div class="grow"><span>${esc(msg)}</span>${recovery ? `<br><button type="button" class="btn" data-recover>${icon(ic)} ${esc(label)}</button>` : ''}</div></div>`;
  if (recovery) box.querySelector('[data-recover]').onclick = recovery;
  /* the error belongs to this sheet; keep the thread clean */
  if (H.state.error) { H.state.error = null; H.render(); }
};

const confirmReopen = async r0 => {
  /* read the latest repair: an approval or visit may exist that this page hasn't seen yet */
  let r = H.repair(r0.id) || r0;
  try { const got = await H.api('GET', `/api/repairs/${encodeURIComponent(r0.id)}`); if (got && got.repair) r = got.repair; } catch {}
  const a = r.approval, b = r.booking;
  const what = b && a ? `This also cancels your yes to ${esc(a.providerName)} for ${H.price(a)}, and the visit you booked.`
    : a ? `This also cancels your yes to ${esc(a.providerName)} for ${H.price(a)}.`
    : 'Nobody is booked.';
  H.sheet('Get new prices?', `
    <p class="qz-lead" style="color:var(--ink)">I’ll call pros again for fresh prices. The prices you have now stay in this chat. ${what}</p>
    <div class="qz-err" data-err hidden></div>
    <div class="qz-act"><button type="button" class="btn" data-go>${icon('refresh')} Yes, get new prices</button>
    <button type="button" class="btn plain" data-keep>Keep these prices</button></div>`, (d, close) => {
    d.querySelector('[data-keep]').onclick = close;
    const go = d.querySelector('[data-go]');
    go.onclick = async () => {
      if (H.state.busy) return;
      go.disabled = true; go.textContent = 'Asking again…';
      let res = null;
      H.state.busy = true; H.state.error = null;
      try { ({ repair: res } = await H.api('POST', `/api/repairs/${encodeURIComponent(r.id)}/reopen`, {})); } catch { H.state.error = null; }
      H.state.busy = false;
      if (!res) { showErr(d, 'Couldn’t ask for new prices. Please try again.'); go.disabled = false; go.innerHTML = `${icon('refresh')} Yes, get new prices`; return; }
      /* The new round animates its calls: clear its seen flag. */
      unSeen(roundKey(res)); delete starts[roundKey(res)]; autoRun.add(roundKey(res));
      close();
      /* Start calling before the first paint, so the thread shows "Calling pros again…" (not a stalled dock). */
      const job = H.autopilot ? H.autopilot(res) : null;
      H.upsert(res); H.scrollToEnd();
      if (job) { await job; H.scrollToEnd(); }
    };
  });
};

const approveSheet = (r, q) => {
  const prop = H.prop ? H.prop(r.property) : null;
  const total = H.price(q), name = q.name;
  const slots = futureWins(q).slice(0, 15), groups = byDay(slots);
  const yesLabel = `${icon('check')} Yes, approve and book ${total}`;
  H.sheet('Approve and book?', `
    <dl class="qz-ok">
      <div><dt>Job</dt><dd>${esc(r.title)}</dd></div>
      <div><dt>Pro</dt><dd>${esc(name)}<small>${icon('star','star')} ${esc(q.rating)} stars · ${esc(q.reviews)} reviews</small></dd></div>
      <div><dt>Total</dt><dd><span class="big">${total}</span><small>${H.isLive(r) ? `${q.feeText ? esc(q.feeText) + ' · ' : ''}provisional, they confirm on site` : `Parts ${esc(dollars(q.parts))} · Labor ${esc(dollars(q.labor))} · provisional, they confirm on site`}</small></dd></div>
      <div><dt>What they’ll do</dt><dd>${esc(q.scope || r.title)}</dd></div>
      <div><dt>If they find more</dt><dd>${esc(q.conditions || 'Extra work needs a new OK from you.')}</dd></div>
      <div><dt>Guarantee</dt><dd>${esc(guarantee(q.warranty))}</dd></div>
      <div><dt>Where</dt><dd>${esc(prop ? prop.name : 'Your property')}<small>The exact address is shared only after you say yes.</small></dd></div>
    </dl>
    <div class="note">${icon('info')}<span>Nothing is booked until you say yes. ${H.tag(r, 'Demo · simulated price and call', 'Live · real price and booking call')}</span></div>
    <div data-form>
      <section class="qz-when" aria-labelledby="qz-when-h">
        <h3 id="qz-when-h">When are you free?</h3>
        ${slots.length ? `<p class="qz-hint">Pick every 2-hour slot that works. I’ll book the first one they can do.</p>
        ${groups.map(g => `<fieldset class="qz-day"><legend>${esc(dayText(g.ws[0].start))}</legend><div class="qz-chips">${g.ws.map(w => {
          const i = slots.indexOf(w);
          return `<button type="button" class="qz-chip" data-slot="${i}" aria-pressed="false" aria-label="${esc(H.when(w.start, w.end))}">${icon('check')}<span>${esc(slotText(w))}</span></button>`;
        }).join('')}</div></fieldset>`).join('')}
        <p class="qz-pick-msg" data-pick-msg aria-live="polite"></p>`
        : `<p class="qz-hint">${H.isLive(r) ? 'They didn’t name a specific day and time on the call, so I can’t book yet. Close this and tap “Get new prices” to call again.' : 'They didn’t offer any times yet. After you say yes, you can pick a time with them.'}</p>`}
      </section>
      <label class="qz-consent"><input type="checkbox" data-consent required><span>I approve this pro and this provisional price.</span></label>
      <div class="qz-err" data-err hidden></div>
      <div class="qz-act"><button type="button" class="btn" data-yes disabled>${yesLabel}</button>
      <button type="button" class="btn plain" data-no>Not yet, go back</button></div>
    </div>
    <div data-progress hidden>
      <ol class="qz-steps" aria-live="polite">
        <li data-step="1" data-s="on"><span class="dot">${icon('check')}</span><span data-t>Saying yes…</span></li>
        <li data-step="2" data-s="wait"><span class="dot">${icon('phone')}</span><span data-t>Calling ${esc(name)} to book…</span>${H.tag(r, 'Demo · simulated call', 'Live call')}</li>
      </ol>
    </div>`, (d, close) => {
    const box = d.querySelector('[data-consent]'), yes = d.querySelector('[data-yes]');
    const form = d.querySelector('[data-form]'), prog = d.querySelector('[data-progress]');
    const step = (n, s, text) => { const li = d.querySelector(`[data-step="${n}"]`); if (!li) return; li.dataset.s = s; if (text) li.querySelector('[data-t]').textContent = text; if (s === 'done') li.querySelector('.dot').innerHTML = icon('check'); };
    /* Slot picking: multi-select up to MAX_SLOTS, at least one when the pro offered times */
    const picked = new Set(), chips = [...d.querySelectorAll('[data-slot]')], msg = d.querySelector('[data-pick-msg]');
    const needSlot = () => (slots.length > 0 || H.isLive(r)) && picked.size === 0;
    const sync = () => {
      chips.forEach(c => { const on = picked.has(Number(c.dataset.slot)); c.setAttribute('aria-pressed', String(on)); c.disabled = !on && picked.size >= MAX_SLOTS; });
      if (msg) {
        if (!picked.size) { msg.innerHTML = box.checked ? `${icon('alert')}<span>Pick at least one time so I can book it.</span>` : '<span>Pick at least one time.</span>'; if (box.checked) msg.dataset.warn = ''; else delete msg.dataset.warn; }
        else { delete msg.dataset.warn; msg.innerHTML = `${icon('check')}<span>${picked.size} ${picked.size === 1 ? 'time' : 'times'} picked${picked.size >= MAX_SLOTS ? ' (that’s the most I can send)' : ''}.</span>`; }
      }
      yes.disabled = !box.checked || needSlot();
    };
    chips.forEach(c => c.onclick = () => { const i = Number(c.dataset.slot); if (picked.has(i)) picked.delete(i); else if (picked.size < MAX_SLOTS) picked.add(i); sync(); });
    const pickedWindows = () => [...picked].sort((a, b) => a - b).map(i => slots[i]);
    box.onchange = sync;
    sync();
    d.querySelector('[data-no]').onclick = close;
    let running = false;
    d.addEventListener('cancel', e => { if (running) e.preventDefault(); });
    yes.onclick = async () => {
      if (!box.checked || needSlot() || running) return;
      running = true;
      const closeBtn = d.querySelector('[data-close]'); if (closeBtn) closeBtn.disabled = true;
      form.hidden = true; prog.hidden = false;
      step(1, 'on', 'Saying yes…'); step(2, 'wait', `Calling ${name} to book…`);
      const minShow = wait(reduced() ? 300 : 900);
      const job = H.approveAndBook(r, q, '', pickedWindows());
      await minShow; step(1, 'done', `You said yes to ${name} for ${total}`); step(2, 'on');
      const res = await job;
      await wait(reduced() ? 200 : 1100);
      if (res && res.status === 'booking') {
        step(2, 'on', `Calling ${name} to book now. This page updates when they confirm.`);
        await wait(reduced() ? 300 : 1600);
        running = false; close(); H.scrollToEnd(); return;
      }
      if (res && res.status === 'scheduled') {
        step(2, 'done', res.booking ? `Booked for ${H.when(res.booking.window.start, res.booking.window.end)}` : 'Booked');
        await wait(reduced() ? 200 : 700);
        running = false; close(); H.scrollToEnd(); return;
      }
      /* Something didn't finish: work out what, in plain words, from the latest server state. */
      running = false; if (closeBtn) closeBtn.disabled = false;
      const raw = String(H.state.error || ''); H.state.error = null;
      await H.refresh();
      const fresh = H.repair(r.id) || r;
      if (fresh.status === 'scheduled') { close(); H.scrollToEnd(); return; }
      prog.hidden = true; form.hidden = false;
      yes.innerHTML = yesLabel; sync();
      if (fresh.approval && fresh.approval.quoteId === q.id) {
        yes.disabled = true;
        showErr(d, `You said yes to ${fresh.approval.providerName} for ${H.price(fresh.approval)}, but I couldn’t book a time with them yet. Pick a time and I’ll call again.`, () => { close(); H.scrollToEnd(); }, 'Pick a time', 'cal');
      } else if (fresh.approval) {
        yes.disabled = true;
        showErr(d, `You already said yes to ${fresh.approval.providerName} for ${H.price(fresh.approval)}.`, () => { close(); H.scrollToEnd(); }, 'See it', 'check');
      } else if (/expired/i.test(raw)) {
        showErr(d, 'This price is too old now. I can call again for fresh prices.', () => { close(); confirmReopen(fresh); });
      } else if (/consent/i.test(raw)) {
        showErr(d, 'Please tick the box first.');
      } else if (!raw && H.state.busy) {
        showErr(d, 'Handy is still finishing something. Try again in a moment.');
      } else {
        showErr(d, raw && /reach/i.test(raw) ? raw : 'Couldn’t save your yes. Please try again.');
      }
    };
  });
};

/* ---------- Part ---------- */
H.part('quotes', {
  owns: ['quotes', 'quoting'],
  history(r) {
    const calls = r.outreach || [];
    const again = (r.rounds || []).length > 0;
    const earlier = roundsHtml(r);
    if (!calls.length) return earlier;
    const anim = animating(r), t = anim ? elapsed(r) : Infinity;
    const n = calls.length;
    let html = earlier + keewanoHtml(r) + (again ? '' : H.h(`<p>Now I’m calling ${n} ${esc(pros(r, n))} for prices. I tell each one I’m an AI assistant, and I don’t give them your address or book anything.</p>`)) +
      `<div class="qz-calls" data-qz-calls="${esc(r.id)}">
        <div class="calls" aria-live="off">${calls.map((c, i) => callRow(r, c, i, H.isLive(r) && c.liveStage ? c.liveStage : stageAt(c, i, t))).join('')}</div>
        <p class="meta-line qz-foot">${H.tag(r, 'Demo · simulated calls', 'Live · real calls')}${anim || r.status === 'quoting' ? ' <span>You can leave. The prices will be here when you come back.</span>' : ''}</p>
        <p class="sr" role="status" aria-live="polite" data-qz-live></p>
      </div>`;
    if (anim || r.status === 'quoting') return html + H.typing();

    const opts = ranked(r);
    if (opts.length) {
      const k = opts.length;
      const intro = k === 1
        ? `I got 1 price. Here it is, with everything they told me.`
        : `I got ${k} ${again ? 'fresh ' : ''}prices. Here they are side by side, best match first. Prices include parts and labor and are confirmed on site.`;
      html += H.h(`<p>${intro}</p>`);
      const fresh = revealed.has(r.id); revealed.delete(r.id);
      html += `<section class="qz-opts${fresh ? ' qz-in' : ''}" aria-label="Compare prices">
        <ul class="qz-cmp" data-k="${k}" style="--k:${k}">${opts.map((q, i) => optionCol(r, q, opts, i)).join('')}</ul>
        <p class="meta-line qz-foot">${k > 1 ? `<span class="qz-swipe">Swipe to see all ${k}.</span>` : ''}${H.tag(r, 'Demo · simulated prices', 'Live · prices from real calls')}</p></section>`;
    } else {
      html += H.h(`<p>No one gave me a price this time. Tap “Get new prices” and I’ll try again.</p>`);
    }
    calls.filter(c => c.status !== 'completed').forEach(c => {
      html += H.h(`<p>${esc(c.providerName)} didn’t pick up. I won’t call again on my own.</p>`);
    });

    const a = r.approval;
    if (a) {
      const amt = H.price(a);
      html += H.u(`Yes, approve and book ${esc(a.providerName)} for ${amt}`);
      html += H.h(`<p>Thanks. You approved ${esc(a.providerName)} for <b>${amt}</b> at ${esc(H.time(a.timestamp))}.</p>`);
    }
    return html;
  },
  dock(r) {
    if (r.status === 'quoting') return `<button type="button" class="btn block" disabled>Calling for prices…</button>
        <p class="meta-line qz-dock-note">${H.tag(r, '', 'Live · real calls')} A real call takes 2–4 minutes. You can leave. The prices will be here when you come back.</p>`;
    if (animating(r)) {
      return `<button type="button" class="btn block" disabled>Getting prices…</button>
        <p class="meta-line qz-dock-note">${H.demo('Demo · simulated calls')} You can leave. The prices will be here when you come back.</p>`;
    }
    const has = (r.quotes || []).length > 0;
    return `<div class="qr" role="group" aria-label="More options">
      ${has ? `<button type="button" data-qz="said">What did they say?</button>` : ''}
      <button type="button" data-qz="reopen">Get new prices</button></div>`;
  },
  bind(root, r) {
    const calls = r.outreach || [];
    /* "Get new prices" from anywhere (e.g. the booked dock) continues by itself: call again right after a fresh reopen. */
    const rounds = r.rounds || [];
    if (r.status === 'assessment' && rounds.length && !autoRun.has(roundKey(r)) && H.autopilot) {
      const last = rounds[rounds.length - 1];
      if (Date.now() - Date.parse(last.endedAt) < 20000) { autoRun.add(roundKey(r)); unSeen(roundKey(r)); H.autopilot(r); }
    }
    if (!calls.length) return;

    root.querySelectorAll('[data-said]').forEach(b => b.onclick = () => { const c = calls[Number(b.dataset.said)]; if (c) transcriptSheet(r, c); });
    root.querySelectorAll('.thread [data-book]').forEach(b => b.onclick = () => {
      const q = (r.quotes || []).find(x => x.id === b.dataset.book); if (q) approveSheet(r, q);
    });
    root.querySelectorAll('.dock [data-qz]').forEach(b => b.onclick = () => {
      const k = b.dataset.qz;
      if (k === 'said') { const p = ranked(r)[0]; const c = p && calls.find(x => x.id === p.transcriptId || x.providerId === p.providerId); if (c) transcriptSheet(r, c); }
      else if (k === 'reopen') confirmReopen(r);
    });

    if (r.status === 'quotes' && reduced()) markSeen(roundKey(r));
    if (!animating(r)) return;

    /* Live call animation: resumes from where it was if the view re-renders. */
    const rk = roundKey(r);
    if (!starts[rk]) starts[rk] = Date.now();
    const box = root.querySelector(`[data-qz-calls="${CSS.escape(r.id)}"]`); if (!box) return;
    const pinS = root.querySelector('.pin .s'), live = box.querySelector('[data-qz-live]');
    const n = calls.length;
    const paint = announce => {
      const t = elapsed(r);
      let got = 0;
      calls.forEach((c, i) => {
        const stage = stageAt(c, i, t), row = box.querySelector(`[data-call="${i}"]`); if (!row) return;
        if (stage === 'ok') got++;
        if (row.dataset.stage !== stage) {
          row.dataset.stage = stage;
          row.querySelector('.qz-st').innerHTML = stHtml(stage);
          row.querySelector('.qz-said').hidden = !(stage === 'ok' || stage === 'bad');
          if (announce && live && (stage === 'ok' || stage === 'bad')) live.textContent = `${c.providerName} ${stage === 'ok' ? 'gave a price' : 'didn’t pick up'}.`;
        }
      });
      if (pinS) pinS.textContent = `Getting prices · ${got} of ${n} in`;
    };
    paint(false);
    const t0 = elapsed(r);
    const marks = new Set();
    calls.forEach((c, i) => {
      const s = i * STAGGER;
      (c.status === 'completed' ? [s, s + RING, s + RING + TALK] : [s, s + NOANSWER]).forEach(m => marks.add(m));
    });
    [...marks].filter(m => m > t0).forEach(m => H.later(m - t0 + 20, () => paint(true)));
    H.later(Math.max(0, totalMs(r) - t0), () => { markSeen(rk); delete starts[rk]; revealed.add(r.id); H.render(); H.scrollToEnd(); });
  }
});
})();
