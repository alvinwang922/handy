/* quotes.js — calls for prices, the recommended price, compare, transcripts, and the approval step.
   Registers H.part('quotes'). Owns status 'quotes'. Shows its history whenever the repair has outreach. */
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
.qz-calls .call .who .s{display:flex;align-items:center;gap:5px}
.qz-calls .call .who .s .ic{width:15px;height:15px}
@media (max-width:639px){.qz-calls .call .who{flex:1 1 100%}.qz-calls .call .qz-st{flex:1}}
.qz-calls .call .who .s{white-space:nowrap}
.qz-calls .star,.qz-ok .star,.qz-sub .star{color:var(--amber)}
.qz-calls .st .ic{width:18px;height:18px}
.qz-calls .st{transition:color .25s ease-out}
.qz-said{min-height:48px;padding:0 6px;margin:-6px -6px -6px 0;border:0;background:none;color:var(--green);font-weight:700;font-size:15px;text-decoration:underline;text-underline-offset:3px;cursor:pointer;border-radius:10px;white-space:nowrap}
.qz-said:hover{background:var(--green-tint)}
.qz-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:2px}
.qz-card .price{line-height:1.05}
.qz-card .why p{margin:6px 0 0;color:var(--ink)}
.qz-card .small{margin:10px 0 0;font-size:15px;color:var(--ink2)}
.qz-card .split{margin:10px 0 0;font-size:15px;color:var(--ink2);font-variant-numeric:tabular-nums}
.qz-card .btns .btn{flex:1 1 auto}
.qz-stack{display:flex;flex-direction:column;gap:14px}
.qz-stack .qc{box-shadow:none}
.qz-lead{margin:0 0 14px;color:var(--ink2)}
.qz-tx{display:flex;flex-direction:column;gap:10px;margin:0 0 16px}
.qz-tx .who{font-size:14px;font-weight:700;color:var(--ink2);margin:0 0 2px}
.qz-tx .bu{max-width:88%}
.qz-tx .bu.pro{align-self:flex-end;background:var(--green-tint);color:var(--ink);border-bottom-right-radius:6px}
.qz-tx .row-h{align-self:flex-start;max-width:88%}
.qz-tx .row-p{align-self:flex-end;max-width:88%;text-align:right}
.qz-tx .row-p .bu{text-align:left;max-width:100%}
.qz-tx .row-h .bu{max-width:100%}
.qz-sub .ic{width:18px;height:18px}
.qz-sub{margin:0 0 14px;font-size:15px;color:var(--ink2);display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}
.qz-ok{display:flex;flex-direction:column;margin:0 0 16px;border:1px solid var(--line);border-radius:16px;overflow:hidden}
.qz-ok div{padding:12px 16px;border-bottom:1px solid var(--line)}
.qz-ok div:last-child{border-bottom:0}
.qz-ok dt{font-size:15px;color:var(--ink2);margin:0}
.qz-ok dd{margin:2px 0 0;font-weight:700}
.qz-ok dd small{display:block;font-weight:400;font-size:15px;color:var(--ink2);margin-top:2px}
.qz-ok .big{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.qz-consent{display:flex;gap:12px;align-items:flex-start;min-height:48px;padding:12px 14px;margin:16px 0;border:1.5px solid #C9C3B6;border-radius:14px;cursor:pointer;font-weight:600}
.qz-consent:has(input:checked){border-color:var(--green);background:var(--green-tint)}
.qz-consent input{width:24px;height:24px;margin:0;flex:none;accent-color:var(--green);cursor:pointer}
.qz-act{display:flex;flex-direction:column;gap:6px;align-items:stretch}
.qz-act .btn.plain{align-self:center}
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
/* After a re-render (sheet closed, repair changed): move focus into the thread and keep the end above the sticky dock. */
const afterRender = () => setTimeout(() => {
  const c = document.querySelector('.center'); if (c) c.scrollTop = c.scrollHeight;
  const th = document.querySelector('.center .thread');
  const last = th && th.lastElementChild;
  if (last) { last.tabIndex = -1; last.classList.add('qz-focus'); last.focus({preventScroll:true}); }
  else { const d = document.querySelector('.center .dock button:not([disabled])'); if (d) d.focus({preventScroll:true}); }
  if (c) c.scrollTop = c.scrollHeight;
}, 0);
const scrollEnd = () => setTimeout(() => { const c = document.querySelector('.center'); if (c) c.scrollTop = c.scrollHeight; }, 0);
const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TRADE = {plumbing:'plumbers', electrical:'electricians', hvac:'heating and cooling pros'};
const pros = (r, n) => n === 1 ? 'pro' : (TRADE[r.category] || 'pros');
const first = name => String(name || '').trim().split(/\s+/)[0] || 'this pro';
const dollars = n => n == null ? '' : '$' + Number(n).toLocaleString('en-US');
const guarantee = w => { const m = String(w || '').match(/(\d+)\s*-?\s*day/i); return m ? `${m[1]}-day guarantee on the work` : (w || 'No guarantee mentioned'); };
const guaranteeDays = w => { const m = String(w || '').match(/(\d+)\s*-?\s*day/i); return m ? Number(m[1]) : 0; };
const soonest = q => (q.windows && q.windows[0] ? Date.parse(q.windows[0].start) : Infinity);
const win = q => String(q.window || 'soon').toLowerCase();
const provider = (r, id) => (r.discovery && r.discovery.providers || []).find(p => p.id === id) || {};

const rank = r => {
  const qs = (r.quotes || []).slice();
  qs.sort((a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0) || soonest(a) - soonest(b) || a.amountCents - b.amountCents);
  return qs;
};
const pickReason = (r, q) => {
  const qs = r.quotes || [];
  const fastest = qs.every(o => soonest(q) <= soonest(o));
  return `Best rated of the ${qs.length} who gave a price` + (fastest ? `, and among the first who can come.` : '.');
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

/* ---------- Price card ---------- */
const priceCard = (r, q, {pick = false, primary = true, choose = true, split = false} = {}) => `
  <div class="qc qz-card">
    <div class="top"><div class="qn">${esc(q.name)}</div><div class="price">${H.money(q.amountCents)}</div></div>
    <div class="meta">
      <span>${icon('star','star')} ${esc(q.rating)} (${esc(q.reviews)} reviews)</span>
      <span>${icon('clock')} Can come ${esc(win(q))}</span>
      <span>${icon('shield')} ${esc(guarantee(q.warranty))}</span>
    </div>
    ${pick ? `<div class="why"><span class="tag">${icon('check')} Our pick</span><p>${esc(pickReason(r, q))}</p></div>` : ''}
    ${split ? `<p class="split">Parts ${esc(dollars(q.parts))} · Labor ${esc(dollars(q.labor))}</p><p class="small">${esc(q.conditions || '')}</p>` : ''}
    <p class="small">Provisional price — they confirm on site. ${H.demo('Demo · simulated price')}</p>
    ${choose ? `<div class="ln"></div><div class="btns"><button type="button" class="btn${primary ? '' : ' ghost'}" data-choose="${esc(q.id)}">Choose ${esc(first(q.name))}</button></div>` : ''}
  </div>`;

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

const confirmReopen = async r0 => {
  /* read the latest repair: an approval or visit may exist that this page hasn't seen yet */
  let r = H.repair(r0.id) || r0;
  try { const got = await H.api('GET', `/api/repairs/${encodeURIComponent(r0.id)}`); if (got && got.repair) r = got.repair; } catch {}
  const a = r.approval, b = r.booking;
  const what = b && a ? `This also cancels your yes to ${esc(a.providerName)} for ${H.money(a.amountCents)}, and the visit you booked.`
    : a ? `This also cancels your yes to ${esc(a.providerName)} for ${H.money(a.amountCents)}.`
    : 'Nobody is booked.';
  H.sheet('Get new prices?', `
    <p class="qz-lead" style="color:var(--ink)">I’ll clear the prices you have now. Then you can ask me to call again. ${what}</p>
    <div class="qz-err" data-err hidden></div>
    <div class="qz-act"><button type="button" class="btn" data-go>${icon('refresh')} Yes, clear these prices</button>
    <button type="button" class="btn plain" data-keep>Keep these prices</button></div>`, (d, close) => {
    d.querySelector('[data-keep]').onclick = close;
    const go = d.querySelector('[data-go]');
    go.onclick = async () => {
      go.disabled = true; go.textContent = 'Clearing…';
      const res = await H.mutate(r.id, 'reopen', {});
      if (res) { unSeen(r.id); close(); H.toast('Old prices cleared.'); afterRender(); return; }
      showErr(d, 'Couldn’t clear the prices. Please try again.');
      go.disabled = false; go.innerHTML = `${icon('refresh')} Yes, clear these prices`;
    };
  });
};

const showErr = (d, msg, recovery, label = 'Get new prices', ic = 'refresh') => {
  const box = d.querySelector('[data-err]'); if (!box) return;
  box.hidden = false;
  box.innerHTML = `<div class="note red" role="alert">${icon('alert')}<div class="grow"><span>${esc(msg)}</span>${recovery ? `<br><button type="button" class="btn" data-recover>${icon(ic)} ${esc(label)}</button>` : ''}</div></div>`;
  if (recovery) box.querySelector('[data-recover]').onclick = recovery;
  /* the error belongs to this sheet; keep the thread clean */
  if (H.state.error) { H.state.error = null; H.render(); }
};

const approveSheet = (r, q) => {
  const prop = H.prop ? H.prop(r.property) : null;
  const total = H.money(q.amountCents);
  H.sheet('Say yes to this price?', `
    <dl class="qz-ok">
      <div><dt>Job</dt><dd>${esc(r.title)}</dd></div>
      <div><dt>Pro</dt><dd>${esc(q.name)}<small>${icon('star','star')} ${esc(q.rating)} · ${esc(q.reviews)} reviews · can come ${esc(win(q))}</small></dd></div>
      <div><dt>Price</dt><dd><span class="big">${total}</span> total<small>Parts ${esc(dollars(q.parts))} · Labor ${esc(dollars(q.labor))} · provisional, they confirm on site</small></dd></div>
      <div><dt>What they’ll do</dt><dd>${esc(q.scope || r.title)}</dd></div>
      <div><dt>If they find more</dt><dd>${esc(q.conditions || 'Extra work needs your OK first.')}</dd></div>
      <div><dt>Guarantee</dt><dd>${esc(guarantee(q.warranty))}</dd></div>
      <div><dt>Where</dt><dd>${esc(prop ? prop.name : 'Your property')}<small>The exact address is shared only after you say yes.</small></dd></div>
    </dl>
    <div class="note">${icon('info')}<span>Nothing is booked until you say yes. ${H.demo('Demo · simulated price')}</span></div>
    <label class="qz-consent"><input type="checkbox" data-consent required><span>I approve this pro and this provisional price. Extra work needs my OK first.</span></label>
    <div class="qz-err" data-err hidden></div>
    <div class="qz-act"><button type="button" class="btn" data-yes disabled>${icon('check')} Yes, approve ${total}</button>
    <button type="button" class="btn plain" data-no>Not yet, go back</button></div>`, (d, close) => {
    const box = d.querySelector('[data-consent]'), yes = d.querySelector('[data-yes]');
    box.onchange = () => { yes.disabled = !box.checked; };
    d.querySelector('[data-no]').onclick = close;
    yes.onclick = async () => {
      if (!box.checked) return;
      yes.disabled = true; yes.textContent = 'Approving…';
      const res = await H.mutate(r.id, 'approve', {quoteId: q.id, amountCents: q.amountCents, consent: true});
      if (res) { close(); afterRender(); return; }
      const raw = String(H.state.error || '');
      H.state.error = null;
      await H.refresh();
      const fresh = H.repair(r.id) || r;
      yes.disabled = !box.checked; yes.innerHTML = `${icon('check')} Yes, approve ${total}`;
      if (fresh.approval) {
        yes.disabled = true;
        showErr(d, `You already said yes to ${fresh.approval.providerName} for ${H.money(fresh.approval.amountCents)}.`, () => { close(); afterRender(); }, 'See it', 'check');
      } else if (/expired/i.test(raw)) {
        showErr(d, 'This price is too old now. I can call again for fresh prices.', () => { close(); confirmReopen(fresh); });
      } else if (/consent/i.test(raw)) {
        showErr(d, 'Please tick the box first.');
      } else {
        showErr(d, 'Couldn’t save your yes. Please try again.');
      }
    };
  });
};

const compareSheet = r => {
  const qs = rank(r).slice(0, 3);
  H.sheet(`Compare all ${qs.length}`, `
    <p class="qz-lead">Prices include parts and labor. Each one is provisional until they see the job.</p>
    <div class="qz-stack">${qs.map((q, i) => priceCard(r, q, {pick: i === 0, primary: i === 0, split: true})).join('')}</div>`, (d, close) => {
    d.querySelectorAll('[data-choose]').forEach(b => b.onclick = () => {
      const q = (r.quotes || []).find(x => x.id === b.dataset.choose); close(); if (q) approveSheet(r, q);
    });
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
    let html = H.u('Yes, get me prices') +
      H.h(`<p>Calling ${n} ${esc(pros(r, n))} now. I tell each one I’m an AI assistant, and I don’t give them your address or book anything.</p>`) +
      `<div class="qz-calls" data-qz-calls="${esc(r.id)}">
        <div class="calls" aria-live="off">${calls.map((c, i) => callRow(r, c, i, stageAt(c, i, t))).join('')}</div>
        <p class="meta-line qz-foot">${H.demo('Demo · simulated calls')}${anim ? ' <span>You can leave. The prices will be here when you come back.</span>' : ''}</p>
        <p class="sr" role="status" aria-live="polite" data-qz-live></p>
      </div>`;
    if (anim) return html + H.typing();

    const ranked = rank(r);
    const pick = ranked[0];
    if (pick) {
      html += H.h(`<p>All set. Here’s the one I’d pick. Prices include parts and labor.</p>`);
      html += priceCard(r, pick, {pick: true, choose: r.status === 'quotes'});
      const cheap = (r.quotes || []).slice().sort((a, b) => a.amountCents - b.amountCents)[0];
      if (cheap && cheap.id !== pick.id && cheap.amountCents < pick.amountCents) {
        let but = '';
        if (soonest(cheap) > soonest(pick)) but = `, but the soonest they can come is ${esc(win(cheap))}`;
        else if (guaranteeDays(cheap.warranty) < guaranteeDays(pick.warranty)) but = `, but their guarantee is shorter (${guaranteeDays(cheap.warranty)} days)`;
        else if ((Number(cheap.rating) || 0) < (Number(pick.rating) || 0)) but = `, but they have lower reviews (${esc(cheap.rating)})`;
        html += H.h(`<p>${esc(cheap.name)} is cheaper at <b>${H.money(cheap.amountCents)}</b>${but}.</p>`);
      }
    } else {
      html += H.h(`<p>No one gave me a price this time. You can ask me to try again.</p>`);
    }
    calls.filter(c => c.status !== 'completed').forEach(c => {
      html += H.h(`<p>${esc(c.providerName)} didn’t pick up. I won’t call again on my own.</p>`);
    });

    const a = r.approval;
    if (a) {
      const amt = H.money(a.amountCents);
      html += H.u(`Yes, approve ${esc(a.providerName)} for ${amt}`);
      html += H.h(`<p>Thanks. You approved ${esc(a.providerName)} for <b>${amt}</b> at ${esc(H.time(a.timestamp))}.</p>`);
    }
    return html;
  },
  dock(r) {
    if (animating(r)) {
      return `<button type="button" class="btn block" disabled>Waiting for prices…</button>
        <p class="meta-line qz-dock-note">${H.demo('Demo · simulated calls')} You can leave. The prices will be here when you come back.</p>`;
    }
    const n = Math.min((r.quotes || []).length, 3);
    return `<div class="qr" role="group" aria-label="More options">
      ${n ? `<button type="button" data-qz="compare">Compare all ${n}</button><button type="button" data-qz="said">What did they say?</button>` : ''}
      <button type="button" data-qz="reopen">Get new prices</button></div>`;
  },
  bind(root, r) {
    const calls = r.outreach || [];
    if (!calls.length) return;

    root.querySelectorAll('[data-said]').forEach(b => b.onclick = () => { const c = calls[Number(b.dataset.said)]; if (c) transcriptSheet(r, c); });
    root.querySelectorAll('.thread [data-choose]').forEach(b => b.onclick = () => {
      const q = (r.quotes || []).find(x => x.id === b.dataset.choose); if (q) approveSheet(r, q);
    });
    root.querySelectorAll('.dock [data-qz]').forEach(b => b.onclick = () => {
      const k = b.dataset.qz;
      if (k === 'compare') compareSheet(r);
      else if (k === 'said') { const p = rank(r)[0]; const c = p && calls.find(x => x.id === p.transcriptId || x.providerId === p.providerId); if (c) transcriptSheet(r, c); }
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
    H.later(Math.max(0, totalMs(r) - t0), () => { markSeen(r.id); delete starts[r.id]; H.render(); scrollEnd(); });
  }
});
})();
