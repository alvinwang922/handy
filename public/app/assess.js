/* assess.js — intake + assessment + hazard parts of the repair thread (Look B: a text from a friend).
   Registers H.part('intake') and H.part('assessment'). Also exposes H.assess.editSheet(r) and
   H.assess.worseSheet(r) so other modules can reuse the "Change the description" and
   "It's getting worse fast" sheets.
   Fully autonomous (user review item 2): there is no "Yes, get me prices" tap. While a repair sits in
   'assessment', the dock shows Handy calling pros, and H.autopilot(r) runs once per repair per browser
   session (sessionStorage guard), so seeded or older repairs move on by themselves too.
   H.autopilot is wrapped here to de-duplicate concurrent calls (report.js may call it right after
   creating the repair while this part also sees the 'assessment' dock). */
(function(){
const H = window.H;
if (!H) return;

/* ---------- Module CSS (injected once) ---------- */
if (!document.getElementById('css-assess')) {
  const st = document.createElement('style'); st.id = 'css-assess';
  st.textContent = `
  .as-photo{padding:4px;max-width:min(260px,72%)}
  .as-photo img{display:block;width:100%;height:auto;max-height:320px;object-fit:cover;border-radius:16px;background:var(--green-tint)}
  .as-trade{margin-top:8px}
  .as-fine{align-self:flex-start;max-width:84%;flex-wrap:wrap;margin:-2px 0 4px 4px;line-height:1.35}
  .as-fine .tag{flex:none}
  .as-hz{align-self:stretch;flex-direction:column;gap:14px;font-size:17px;padding:16px 18px;border-radius:var(--r-bubble);border-bottom-left-radius:6px}
  .as-hz .as-hz-hd{display:flex;gap:10px;align-items:flex-start}
  .as-hz .as-hz-hd .ic{width:24px;height:24px;margin-top:1px}
  .as-hz p{margin:0}
  .as-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px;counter-reset:s;color:var(--ink)}
  .as-steps li{display:flex;gap:14px;align-items:flex-start;font-size:19px;line-height:1.35;counter-increment:s}
  .as-steps li::before{content:counter(s);flex:none;width:36px;height:36px;border-radius:50%;background:var(--red);color:#fff;font-weight:800;display:grid;place-items:center;font-size:18px;font-variant-numeric:tabular-nums}
  .as-steps b{display:block}
  .as-steps span{font-size:16px;color:var(--ink2)}
  .as-dock .meta-line{margin:8px 0 0}
  .as-call{display:flex;align-items:center;gap:14px;min-height:56px}
  .as-call .typing{flex:none;align-self:center}
  .as-call-t{display:flex;flex-direction:column;gap:2px;min-width:0}
  .as-call-t b{font-size:17px;color:var(--ink)}
  .as-call-t span{font-size:15px;color:var(--ink2);line-height:1.35}
  .as-call.as-fail .as-call-ic{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:var(--pinned);color:var(--ink2)}
  .as-call.as-fail .as-call-ic .ic{width:22px;height:22px}
  .as-dock-acts{display:flex;align-items:center;gap:6px 16px;flex-wrap:wrap;margin-top:8px}
  .as-dock-acts .btn.plain{min-height:48px;padding:0 4px;font-size:15px;display:inline-flex;align-items:center;gap:6px}
  .as-dock-acts .btn.plain .ic{width:16px;height:16px}
  .as-dock-acts .btn:not(.plain){min-width:180px}
  .as-row{display:flex;gap:10px;flex-wrap:wrap}
  .as-row .btn{min-width:180px}
  .as-sheet .as-row{margin-top:8px}
  .as-sheet .note{margin-bottom:16px}
  .as-sheet .as-steps{margin:0 0 20px}
  @media (max-width:639px){.as-row .btn,.as-dock-acts .btn:not(.plain){min-width:100%}}
  `;
  document.head.appendChild(st);
}

const esc = H.esc, icon = H.icon;
const PHRASE = {
  plumbing: 'It looks like a <b>possible loose drain connection</b>.',
  hvac: 'It looks like your <b>heating or cooling needs a check</b>.',
  electrical: 'This looks like a job for <b>an electrician to check</b>.',
  general: 'This looks like a job for <b>a pro to check in person</b>.'
};
const PLURAL = { Plumber:'plumbers', 'HVAC technician':'heating and cooling pros', Electrician:'electricians', Handyman:'handymen' };
const tradeOne = t => t === 'HVAC technician' ? 'heating and cooling pro' : String(t || 'pro').toLowerCase();
const tradeMany = t => PLURAL[t] || 'pros';
const aOrAn = w => /^[aeiou]/i.test(w) ? 'an' : 'a';

const dayLabel = iso => {
  const d = new Date(iso); if (isNaN(d)) return '';
  const today = new Date(), y = new Date(); y.setDate(today.getDate() - 1);
  const same = (a, b) => a.toDateString() === b.toDateString();
  const day = same(d, today) ? 'Today' : same(d, y) ? 'Yesterday' : d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
  return `${day}, ${H.time(iso)}`;
};
const guess = a => {
  if (PHRASE[a.category] && a.title && !/hazard/i.test(a.title)) {
    /* Use the server's title when it reads naturally as "It looks like a …" */
    if (/^possible /i.test(a.title)) return `It looks like a <b>${esc(a.title.charAt(0).toLowerCase() + a.title.slice(1))}</b>.`;
    return PHRASE[a.category];
  }
  return `My best guess: <b>${esc(String(a.title || 'a pro should take a look').toLowerCase())}</b>.`;
};
const confidenceWords = c => !c || /unverified|demo/i.test(c) ? 'This is a first guess, not an inspection.' : `${esc(c)}.`;
const lastEvent = (r, type) => (r.events || []).filter(e => e.type === type).pop();
const isHazard = r => r.status === 'hazard' || !!r.assessment?.hazard;
const focusDock = () => requestAnimationFrame(() => document.querySelector('.as-dock button')?.focus());

/* ---------- Autopilot: once per repair per session, de-duplicated ---------- */
const KEY = id => `handy-autopilot-${id}`;
const seen = id => { try { return sessionStorage.getItem(KEY(id)) === '1'; } catch { return false; } };
const mark = id => { try { sessionStorage.setItem(KEY(id), '1'); } catch {} };
const unmark = id => { try { sessionStorage.removeItem(KEY(id)); } catch {} };
const inflight = {};
const rawAutopilot = H.autopilot;
if (typeof rawAutopilot === 'function' && !rawAutopilot._assessWrapped) {
  H.autopilot = repair => {
    if (!repair || repair.status !== 'assessment') return Promise.resolve(repair);
    const id = repair.id;
    if (inflight[id]) return inflight[id];
    mark(id);
    let stuck = true;
    inflight[id] = Promise.resolve(rawAutopilot(repair)).then(r => { stuck = !r || r.status === 'assessment'; return r; }).finally(() => {
      delete inflight[id];
      /* Still waiting after the call (it failed): re-render so the dock offers "Try again". */
      if (stuck && H.route && H.route.name === 'repair' && H.route.id === id) H.render();
    });
    return inflight[id];
  };
  H.autopilot._assessWrapped = true;
}
/* Asked already this session, nothing in flight, still no prices → the call didn't go through. */
const stalled = r => seen(r.id) && !inflight[r.id];
const runAutopilot = id => {
  const r = H.repair(id);
  if (!r || r.status !== 'assessment' || isHazard(r) || inflight[id]) return;
  if (H.state.busy) { H.later(600, () => runAutopilot(id)); return; }
  H.autopilot(r);
};

/* ---------- INTAKE ---------- */
H.part('intake', {
  history(r) {
    const photos = (r.photos || []).map(p => {
      const src = typeof p === 'string' && (p.startsWith('data:image/') || p === '/assets/sample-sink.svg') ? p : '/assets/sample-sink.svg';
      return `<div class="bu u photo as-photo"><img src="${esc(src)}" alt="Your photo"></div>`;
    }).join('');
    return `<div class="day">${esc(dayLabel(r.createdAt))}</div>
      ${photos}
      ${H.u(`<p>${esc(r.description)}</p>`)}`;
  }
});

/* ---------- ASSESSMENT / HAZARD ---------- */
const hazardSteps = () => `<ol class="as-steps">
  <li><div><b>Leave the area now</b><span>Take people and pets with you.</span></div></li>
  <li><div><b>If you smell gas, don’t touch switches</b><span>No light switches, lighters or flames. Don’t plug anything in.</span></div></li>
  <li><div><b>Call 911 from outside</b><span>Once you are a safe distance away.</span></div></li>
  <li><div><b>Call your gas or power company</b><span>Their emergency number is on your bill.</span></div></li>
  <li><div><b>If water is flooding, shut the main valve</b><span>Only if you can reach it safely.</span></div></li>
</ol>`;

const hazardHistory = r => `
  <div class="note red as-hz" role="alert">
    <div class="as-hz-hd">${icon('alert')}<p><b>This could be dangerous. I’ve paused finding pros.</b><br>Please do these steps now.</p></div>
    ${hazardSteps()}
    <p>${esc(r.assessment?.text || 'Handy cannot dispatch emergency help.')}</p>
  </div>
  <p class="meta-line as-fine">${H.demo('Demo · rule-based guess')} I spotted words like gas, sparks, smoke or flooding.</p>`;

const assessmentHistory = r => {
  const a = r.assessment || {};
  const trade = tradeOne(a.trade);
  let html = '';
  if ((r.photos || []).length) html += H.h(`<p>Thanks for the photo. I’ll show it to the pro.</p>`);
  if (lastEvent(r, 'issue.updated')) html += H.h(`<p>Got it. I made a new guess with your changes.</p>`);
  /* Skip the trade sentence when the guess or the text already names the trade. */
  const named = new RegExp(trade.split(' ')[0], 'i');
  const sayTrade = !named.test(a.text || '') && !named.test(guess(a).replace(/<[^>]+>/g, ''));
  html += H.h(`<p>${guess(a)}</p>${a.text ? `<p>${esc(a.text)}</p>` : ''}
    <p class="as-trade">${sayTrade ? `The right person for this is ${aOrAn(trade)} <b>${esc(trade)}</b>. ` : ''}${confidenceWords(a.confidence)}</p>`);
  html += `<p class="meta-line as-fine">${H.demo('Demo · rule-based guess')} ${esc(a.disclaimer || '')}</p>`;
  if (r.status === 'assessment' && !stalled(r)) html += H.h(`<p>I’m calling a few ${esc(tradeMany(a.trade))} near you for prices now. I tell each one I’m an AI assistant, and I won’t book anything without your yes.</p>`);
  return html;
};

/* ---------- Sheets ---------- */
const editSheet = r => {
  const hadPrices = (r.quotes || []).length > 0 || !!r.approval;
  H.sheet('Change the description', `<form class="as-sheet" novalidate>
    ${hadPrices ? `<div class="note amber">${icon('info')}<span>Saving clears the prices you have now. I’ll make a new guess and ask again.</span></div>` : ''}
    <div class="field" id="as-f-desc"><label for="as-desc">What’s happening?</label>
      <textarea id="as-desc" maxlength="1200" aria-describedby="as-desc-hint as-desc-msg">${esc(r.description)}</textarea>
      <span class="hint" id="as-desc-hint">Mention any smell of gas, sparks or flooding.</span>
      <span class="msg" id="as-desc-msg" hidden></span></div>
    <div class="as-row"><button class="btn" type="submit">${icon('check')} Save and update the guess</button></div>
  </form>`, (d, close) => {
    const form = d.querySelector('form'), ta = d.querySelector('#as-desc'), f = d.querySelector('#as-f-desc'), msg = d.querySelector('#as-desc-msg');
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    form.onsubmit = async e => {
      e.preventDefault();
      const description = ta.value.trim();
      if (!description) { f.classList.add('err'); msg.hidden = false; msg.innerHTML = `${icon('alert')} Tell me what’s happening, in a few words.`; ta.focus(); return; }
      if (description === r.description && !hadPrices) { close(); return; }
      const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Saving…';
      /* Allow the new guess to go straight back out for prices. */
      unmark(r.id);
      const updated = await H.mutate(r.id, '', { description, urgency: r.urgency });
      if (updated) {
        close();
        H.toast(updated.status === 'hazard' ? 'This could be dangerous. I’ve paused finding pros.' : hadPrices ? 'Saved. Old prices were cleared. Asking again.' : 'Saved. I updated my guess.');
        focusDock();
      } else {
        mark(r.id);
        btn.disabled = false; btn.innerHTML = `${icon('check')} Save and update the guess`;
        f.classList.add('err'); msg.hidden = false; msg.innerHTML = `${icon('alert')} ${esc(H.state.error || 'That didn’t save. Please try again.')}`;
      }
    };
  });
};

const worseSheet = () => {
  H.sheet('It’s getting worse fast', `<div class="as-sheet">
    <div class="note red">${icon('alert')}<span><b>If you smell gas, see sparks or smoke, or water is flooding, this is an emergency.</b> Do these steps now. Handy can’t send emergency help.</span></div>
    ${hazardSteps()}
    <div class="as-row">
      <a class="btn danger" href="tel:911">${icon('phone')} Call 911</a>
      <button class="btn ghost" type="button" data-as-close>It’s not dangerous</button>
    </div>
  </div>`, (d, close) => { d.querySelector('[data-as-close]').onclick = close; });
};

H.assess = { editSheet, worseSheet };

const callingDock = r => {
  const many = tradeMany(r.assessment?.trade);
  if (stalled(r)) return `<div class="as-dock">
    <div class="as-call as-fail" role="alert">
      <span class="as-call-ic">${icon('phone')}</span>
      <div class="as-call-t"><b>I couldn’t reach the pros just now</b><span>${esc(H.state.error || 'Please try again in a moment.')}</span></div>
    </div>
    <div class="as-dock-acts">
      <button class="btn" type="button" data-as-retry>${icon('refresh')} Try again</button>
      <button class="btn plain" type="button" data-as-edit>${icon('edit')} Change the description</button>
    </div></div>`;
  return `<div class="as-dock">
    <div class="as-call" role="status" aria-live="polite">
      ${H.typing()}
      <div class="as-call-t"><b>Calling pros for prices…</b><span>Up to 3 ${esc(many)} near you. Nothing gets booked without your yes.</span></div>
    </div>
    <div class="as-dock-acts">
      <button class="btn plain" type="button" data-as-edit>${icon('edit')} Change the description</button>
    </div></div>`;
};

H.part('assessment', {
  owns: ['assessment', 'hazard'],
  history(r) {
    if (!r.assessment) return '';
    return isHazard(r) ? hazardHistory(r) : assessmentHistory(r);
  },
  dock(r) {
    if (isHazard(r)) return `<div class="as-dock">
      <div class="as-row">
        <a class="btn danger" href="tel:911">${icon('phone')} Call 911</a>
        <button class="btn ghost" type="button" data-nav="#/">I’m safe now</button>
      </div>
      <p class="meta-line">${icon('info')} Handy won’t call any pros for this.</p></div>`;
    return callingDock(r);
  },
  bind(root, r) {
    if (r.status !== 'assessment' || isHazard(r)) return;
    const ed = root.querySelector('[data-as-edit]'); if (ed) ed.onclick = () => editSheet(r);
    const retry = root.querySelector('[data-as-retry]');
    if (retry) retry.onclick = () => { H.state.error = null; runAutopilot(r.id); H.render(); };
    /* Move on by itself: once per repair per session; give the guess a beat to land first. */
    if (!seen(r.id) && !inflight[r.id]) H.later(900, () => runAutopilot(r.id));
  }
});
})();
