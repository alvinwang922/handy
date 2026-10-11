/* quotes.js — the price calls, every price option side by side with pros and cons, transcripts, and the one-tap
   "approve and book" sheet. Registers H.part('quotes'). Owns status 'quotes'. Shows its history whenever the repair has outreach.
   Flow (user review): prices are requested automatically after Send (H.autopilot). Here the user sees all options at once,
   one clearly recommended, and a single "Yes, approve and book" calls H.approveAndBook (approve + earliest time). */
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

/* Price options: recommended full width, the others side by side when there is room */
.qz-opts{align-self:stretch;container-type:inline-size}
.qz-grid{display:grid;grid-template-columns:1fr;gap:12px}
@container (min-width:600px){
  .qz-grid{grid-template-columns:1fr 1fr}
  .qz-grid .qz-rec{grid-column:1/-1}
  .qz-rec .qz-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:4px 28px;align-items:start}
  .qz-rec .qz-pc{margin-top:2px}
}
.qz-opt{display:flex;flex-direction:column;background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:16px;min-width:0}
.qz-opt.qz-rec{border:2px solid var(--green);padding:15px;box-shadow:var(--shadow)}
.qz-opt.qz-chosen{border:2px solid var(--green);padding:15px}
.qz-opt.qz-dim{opacity:.62}
.qz-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.qz-name{font-weight:700;font-size:18px;line-height:1.25;margin:0}
.qz-price{font-size:30px;font-weight:800;letter-spacing:-.01em;line-height:1;font-variant-numeric:tabular-nums;white-space:nowrap}
.qz-rec .qz-price{font-size:34px}
.qz-why{margin:8px 0 2px;color:var(--ink)}
.qz-why .tag{margin-right:6px;vertical-align:1px}
.qz-why .tag .ic{width:15px;height:15px}
.qz-facts{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:4px;font-size:15px;color:var(--ink2)}
.qz-facts li{display:flex;align-items:center;gap:7px}
.qz-facts .ic{width:17px;height:17px;color:var(--ink3)}
.qz-facts .star{color:var(--amber)}
.qz-pc{margin-top:12px;display:flex;flex-direction:column;gap:6px}
.qz-pc ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.qz-pc li{display:flex;align-items:flex-start;gap:8px;font-size:16px;line-height:1.35}
.qz-pro{color:var(--ink)}
.qz-pro .ic{width:18px;height:18px;color:var(--green);margin-top:1px}
.qz-con{color:var(--ink2)}
.qz-con::before{content:"";flex:none;width:12px;height:2px;margin:10px 3px 0;border-radius:1px;background:var(--ink3)}
.qz-fine{margin:12px 0 0;font-size:15px;color:var(--ink2)}
.qz-cta{margin-top:auto;padding-top:14px}
.qz-cta .btn{width:100%;min-height:52px}
.qz-done{display:inline-flex;align-items:center;gap:6px;margin-top:12px;font-weight:700;color:var(--green);font-size:15px}
.qz-done .ic{width:18px;height:18px}
@media (prefers-reduced-motion:no-preference){
  .qz-in .qz-opt{animation:qzIn .5s cubic-bezier(.16,1,.3,1) both}
  .qz-in .qz-opt:nth-child(2){animation-delay:.08s}
  .qz-in .qz-opt:nth-child(3){animation-delay:.16s}
}
@keyframes qzIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}

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
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = ms => new Promise(res => setTimeout(res, ms));

const TRADE = {plumbing:'plumbers', electrical:'electricians', hvac:'heating and cooling pros'};
const pros = (r, n) => n === 1 ? 'pro' : (TRADE[r.category] || 'pros');
const first = name => String(name || '').trim().split(/\s+/)[0] || 'this pro';
const dollars = n => n == null ? '' : '$' + Number(n).toLocaleString('en-US');
const gDays = w => { const m = String(w || '').match(/(\d+)\s*-?\s*day/i); return m ? Number(m[1]) : 0; };
const guarantee = w => gDays(w) ? `${gDays(w)}-day guarantee on the work` : (w || 'No guarantee mentioned');
const futureWins = q => (q.windows || []).filter(w => Date.parse(w.start) > Date.now()).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
const soonest = q => { const w = futureWins(q)[0]; return w ? Date.parse(w.start) : Infinity; };
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const win = q => String(q.window || 'soon').toLowerCase();
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
const animating = r => r.status === 'quotes' && r.outreach && r.outreach.length && !isSeen(r.id) && !reduced();
const elapsed = r => starts[r.id] ? Date.now() - starts[r.id] : 0;

const STAGE = {
  wait: ['wait', () => `${icon('clock')} Waiting`],
  ring: ['live', () => `${icon('phone')} Ringing`],
  talk: ['live', () => `<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span> Talking`],
  ok:   ['ok',   () => `${icon('check')} Got a price`],
  bad:  ['bad',  () => `${icon('x')} Didn’t pick up`]
};
const stHtml = stage => { const [cls, f] = STAGE[stage]; return `<span class="st ${cls}">${f()}</span>`; };

const callRow = (r, c, i, stage) => {
  const p = provider(r, c.providerId);
  const secs = c.durationSeconds ? ` · ${esc(c.durationSeconds)} sec` : '';
  const sub = c.status !== 'completed' ? 'No answer'
    : (p.rating ? `${icon('star','star')} ${esc(p.rating)} · ${esc(p.reviews)} reviews${secs}` : `Phone call${secs}`);
  const done = stage === 'ok' || stage === 'bad';
  return `<div class="call" data-call="${i}">
    <div class="who"><div class="t">${esc(c.providerName)}</div><div class="s">${sub}</div></div>
    <span class="qz-st">${stHtml(stage)}</span>
    <button type="button" class="qz-said" data-said="${i}" ${done ? '' : 'hidden'}>What was said</button>
  </div>`;
};

/* ---------- Price option card ---------- */
const optionCard = (r, q, all, i) => {
  const rec = i === 0 && all.length > 0;
  const a = r.approval, open = r.status === 'quotes' && !a;
  const chosen = a && a.quoteId === q.id;
  const {pro, con} = prosCons(q, all);
  const cls = ['qz-opt', rec && !a ? 'qz-rec' : '', chosen ? 'qz-chosen' : '', a && !chosen ? 'qz-dim' : ''].filter(Boolean).join(' ');
  const pcList = (items, kind, label) => items.length ? `<ul aria-label="${label}">${items.map(t => `<li class="qz-${kind}">${kind === 'pro' ? icon('check') : ''}<span>${esc(t)}</span></li>`).join('')}</ul>` : '';
  return `<article class="${cls}" aria-label="${esc(q.name)}, ${esc(H.money(q.amountCents))}${rec ? ', recommended' : ''}">
    <div class="qz-head"><h3 class="qz-name">${esc(q.name)}</h3><div class="qz-price">${H.money(q.amountCents)}</div></div>
    ${rec ? `<p class="qz-why"><span class="tag">${icon('check')} Recommended</span>${esc(recReason(q, all))}</p>` : ''}
    <div class="qz-body">
      <ul class="qz-facts">
        <li>${icon('star','star')} ${esc(q.rating)} stars · ${esc(q.reviews)} reviews</li>
        <li>${icon('clock')} Can come ${esc(win(q))}</li>
        <li>${icon('shield')} ${esc(guarantee(q.warranty))}</li>
      </ul>
      ${pro.length || con.length ? `<div class="qz-pc">${pcList(pro, 'pro', 'Pros')}${pcList(con, 'con', 'Cons')}</div>` : ''}
    </div>
    ${open ? `<div class="qz-cta"><button type="button" class="btn${rec ? '' : ' ghost'}" data-book="${esc(q.id)}">Book ${esc(first(q.name))} for ${H.money(q.amountCents)}</button></div>` : ''}
    ${chosen ? `<span class="qz-done">${icon('check')} You approved this one</span>` : ''}
  </article>`;
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
  const body = c.status === 'completed' && lines
    ? `${meta}<div class="qz-tx">${lines}</div>`
    : `${meta}<p class="qz-lead">No one answered. Nothing was said.</p>`;
  H.sheet(`What was said · ${c.providerName}`, `${body}
    <div class="note">${icon('info')}<span>${c.status === 'completed' ? 'This call was made by an AI assistant. It didn’t share your address or book anything.' : 'This call was made by an AI assistant. No one answered.'} ${H.demo('Demo · simulated call')}</span></div>`);
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
  const what = b && a ? `This also cancels your yes to ${esc(a.providerName)} for ${H.money(a.amountCents)}, and the visit you booked.`
    : a ? `This also cancels your yes to ${esc(a.providerName)} for ${H.money(a.amountCents)}.`
    : 'Nobody is booked.';
  H.sheet('Get new prices?', `
    <p class="qz-lead" style="color:var(--ink)">I’ll clear the prices you have now and call again for fresh ones. ${what}</p>
    <div class="qz-err" data-err hidden></div>
    <div class="qz-act"><button type="button" class="btn" data-go>${icon('refresh')} Yes, get new prices</button>
    <button type="button" class="btn plain" data-keep>Keep these prices</button></div>`, (d, close) => {
    d.querySelector('[data-keep]').onclick = close;
    const go = d.querySelector('[data-go]');
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'Clearing…';
      const res = await H.mutate(r.id, 'reopen', {});
      if (!res) { showErr(d, 'Couldn’t clear the prices. Please try again.'); go.disabled = false; go.innerHTML = `${icon('refresh')} Yes, get new prices`; return; }
      unSeen(r.id); close();
      /* autonomous: call again straight away */
      if (H.autopilot) await H.autopilot(res);
      H.scrollToEnd();
    };
  });
};

const approveSheet = (r, q) => {
  const prop = H.prop ? H.prop(r.property) : null;
  const total = H.money(q.amountCents), name = q.name;
  const next = futureWins(q)[0];
  const yesLabel = `${icon('check')} Yes, approve and book ${total}`;
  H.sheet('Approve and book?', `
    <dl class="qz-ok">
      <div><dt>Job</dt><dd>${esc(r.title)}</dd></div>
      <div><dt>Pro</dt><dd>${esc(name)}<small>${icon('star','star')} ${esc(q.rating)} stars · ${esc(q.reviews)} reviews</small></dd></div>
      <div><dt>Total</dt><dd><span class="big">${total}</span><small>Parts ${esc(dollars(q.parts))} · Labor ${esc(dollars(q.labor))} · provisional, they confirm on site</small></dd></div>
      <div><dt>What they’ll do</dt><dd>${esc(q.scope || r.title)}</dd></div>
      <div><dt>If they find more</dt><dd>${esc(q.conditions || 'Extra work needs a new OK from you.')}</dd></div>
      <div><dt>Guarantee</dt><dd>${esc(guarantee(q.warranty))}</dd></div>
      <div><dt>When</dt><dd>${next ? esc(H.when(next.start, next.end)) : 'Their earliest open time'}<small>I’ll book the earliest time they offered. You can change it later.</small></dd></div>
      <div><dt>Where</dt><dd>${esc(prop ? prop.name : 'Your property')}<small>The exact address is shared only after you say yes.</small></dd></div>
    </dl>
    <div class="note">${icon('info')}<span>Nothing is booked until you say yes. ${H.demo('Demo · simulated price and call')}</span></div>
    <div data-form>
      <label class="qz-consent"><input type="checkbox" data-consent required><span>I approve this pro and this provisional price.</span></label>
      <div class="qz-err" data-err hidden></div>
      <div class="qz-act"><button type="button" class="btn" data-yes disabled>${yesLabel}</button>
      <button type="button" class="btn plain" data-no>Not yet, go back</button></div>
    </div>
    <div data-progress hidden>
      <ol class="qz-steps" aria-live="polite">
        <li data-step="1" data-s="on"><span class="dot">${icon('check')}</span><span data-t>Saying yes…</span></li>
        <li data-step="2" data-s="wait"><span class="dot">${icon('phone')}</span><span data-t>Calling ${esc(name)} to book…</span>${H.demo('Demo · simulated call')}</li>
      </ol>
    </div>`, (d, close) => {
    const box = d.querySelector('[data-consent]'), yes = d.querySelector('[data-yes]');
    const form = d.querySelector('[data-form]'), prog = d.querySelector('[data-progress]');
    const step = (n, s, text) => { const li = d.querySelector(`[data-step="${n}"]`); if (!li) return; li.dataset.s = s; if (text) li.querySelector('[data-t]').textContent = text; if (s === 'done') li.querySelector('.dot').innerHTML = icon('check'); };
    box.onchange = () => { yes.disabled = !box.checked; };
    d.querySelector('[data-no]').onclick = close;
    let running = false;
    d.addEventListener('cancel', e => { if (running) e.preventDefault(); });
    yes.onclick = async () => {
      if (!box.checked || running) return;
      running = true;
      const closeBtn = d.querySelector('[data-close]'); if (closeBtn) closeBtn.disabled = true;
      form.hidden = true; prog.hidden = false;
      step(1, 'on', 'Saying yes…'); step(2, 'wait', `Calling ${name} to book…`);
      const minShow = wait(reduced() ? 300 : 900);
      const job = H.approveAndBook(r, q, '');
      await minShow; step(1, 'done', `You said yes to ${name} for ${total}`); step(2, 'on');
      const res = await job;
      await wait(reduced() ? 200 : 1100);
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
      yes.disabled = !box.checked; yes.innerHTML = yesLabel;
      if (fresh.approval && fresh.approval.quoteId === q.id) {
        yes.disabled = true;
        showErr(d, `You said yes to ${fresh.approval.providerName} for ${H.money(fresh.approval.amountCents)}, but I couldn’t book a time with them yet. Pick a time and I’ll call again.`, () => { close(); H.scrollToEnd(); }, 'Pick a time', 'cal');
      } else if (fresh.approval) {
        yes.disabled = true;
        showErr(d, `You already said yes to ${fresh.approval.providerName} for ${H.money(fresh.approval.amountCents)}.`, () => { close(); H.scrollToEnd(); }, 'See it', 'check');
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
  owns: ['quotes'],
  history(r) {
    const calls = r.outreach || [];
    if (!calls.length) return '';
    const anim = animating(r), t = anim ? elapsed(r) : Infinity;
    const n = calls.length;
    let html = H.h(`<p>Now I’m calling ${n} ${esc(pros(r, n))} for prices. I tell each one I’m an AI assistant, and I don’t give them your address or book anything.</p>`) +
      `<div class="qz-calls" data-qz-calls="${esc(r.id)}">
        <div class="calls" aria-live="off">${calls.map((c, i) => callRow(r, c, i, stageAt(c, i, t))).join('')}</div>
        <p class="meta-line qz-foot">${H.demo('Demo · simulated calls')}${anim ? ' <span>You can leave. The prices will be here when you come back.</span>' : ''}</p>
        <p class="sr" role="status" aria-live="polite" data-qz-live></p>
      </div>`;
    if (anim) return html + H.typing();

    const opts = ranked(r);
    if (opts.length) {
      const k = opts.length;
      const intro = k === 1
        ? `I got 1 price. Here it is, with everything they told me.`
        : `I got ${k} prices. Here they all are, best match first, with the good and the not-so-good of each. Prices include parts and labor and are confirmed on site.`;
      html += H.h(`<p>${intro}</p>`);
      const fresh = revealed.has(r.id); revealed.delete(r.id);
      html += `<section class="qz-opts${fresh ? ' qz-in' : ''}" aria-label="Price options"><div class="qz-grid">${opts.map((q, i) => optionCard(r, q, opts, i)).join('')}</div>
        <p class="meta-line qz-foot">${H.demo('Demo · simulated prices')}</p></section>`;
    } else {
      html += H.h(`<p>No one gave me a price this time. Tap “Get new prices” and I’ll try again.</p>`);
    }
    calls.filter(c => c.status !== 'completed').forEach(c => {
      html += H.h(`<p>${esc(c.providerName)} didn’t pick up. I won’t call again on my own.</p>`);
    });

    const a = r.approval;
    if (a) {
      const amt = H.money(a.amountCents);
      html += H.u(`Yes, approve and book ${esc(a.providerName)} for ${amt}`);
      html += H.h(`<p>Thanks. You approved ${esc(a.providerName)} for <b>${amt}</b> at ${esc(H.time(a.timestamp))}.</p>`);
    }
    return html;
  },
  dock(r) {
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

    if (r.status === 'quotes' && reduced()) markSeen(r.id);
    if (!animating(r)) return;

    /* Live call animation: resumes from where it was if the view re-renders. */
    if (!starts[r.id]) starts[r.id] = Date.now();
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
    H.later(Math.max(0, totalMs(r) - t0), () => { markSeen(r.id); delete starts[r.id]; revealed.add(r.id); H.render(); H.scrollToEnd(); });
  }
});
})();
