/* assess.js — intake + assessment + hazard parts of the repair thread (Look B: a text from a friend).
   Registers H.part('intake') and H.part('assessment'). Also exposes H.assess.editSheet(r) and
   H.assess.worseSheet(r) so other modules can reuse the "Change the description" and
   "It's getting worse fast" sheets. */
(function(){
const H = window.H;
if (!H) return;

/* ---------- Module CSS (injected once) ---------- */
if (!document.getElementById('css-assess')) {
  const st = document.createElement('style'); st.id = 'css-assess';
  st.textContent = `
  .as-photo{padding:4px;max-width:min(260px,72%)}
  .as-photo img{display:block;width:100%;height:auto;max-height:320px;object-fit:cover;border-radius:16px;background:var(--green-tint)}
  .as-meta{align-self:flex-end;font-size:15px;color:var(--ink2);margin-top:-4px}
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
  .as-dock-copy{margin:0 0 10px;font-size:15px;color:var(--ink2)}
  .as-dock .qr{margin:10px 0 0;flex-wrap:nowrap}
  .as-dock .qr button,.as-sheet .qr button{min-height:48px}
  .as-dock .qr button{display:inline-flex;align-items:center;gap:6px;padding-left:12px;padding-right:12px}
  .as-dock .msg{margin:0 0 10px}
  .as-dock .qr .ic{width:18px;height:18px}
  .as-dock .meta-line{margin:8px 0 0}
  .as-row{display:flex;gap:10px;flex-wrap:wrap}
  .as-row .btn{min-width:180px}
  .as-sheet .qr{margin:0}
  .as-sheet .as-row{margin-top:8px}
  .as-sheet .note{margin-bottom:16px}
  .as-sheet .as-steps{margin:0 0 20px}
  @media (max-width:639px){.as-row .btn{min-width:100%}}
  `;
  document.head.appendChild(st);
}

const esc = H.esc, icon = H.icon;
const URGENCY = [
  ['Routine', 'It can wait a bit'],
  ['Soon', 'This week'],
  ['Urgent', 'Today if possible']
];
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
/* What the user last changed per repair (client-side only; the server event doesn't say). */
const changed = {};
const focusDock = () => requestAnimationFrame(() => document.querySelector('[data-as-go], .as-dock .btn')?.focus());

/* ---------- INTAKE ---------- */
H.part('intake', {
  history(r) {
    const photos = (r.photos || []).map(p => {
      const src = typeof p === 'string' && (p.startsWith('data:image/') || p === '/assets/sample-sink.svg') ? p : '/assets/sample-sink.svg';
      return `<div class="bu u photo as-photo"><img src="${esc(src)}" alt="Your photo"></div>`;
    }).join('');
    const meta = [r.room, r.urgency].filter(Boolean).map(esc).join(' · ');
    return `<div class="day">${esc(dayLabel(r.createdAt))}</div>
      ${photos}
      ${H.u(`<p>${esc(r.description)}</p>`)}
      ${meta ? `<div class="as-meta">${meta}</div>` : ''}`;
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
  const updated = lastEvent(r, 'issue.updated');
  const trade = tradeOne(a.trade);
  let html = '';
  if ((r.photos || []).length) html += H.h(`<p>Thanks for the photo. I’ll show it to the pro.</p>`);
  if (updated) html += H.h(changed[r.id] === 'urgency' ? `<p>Got it. I marked this as urgent.</p>` : `<p>Got it. I made a new guess with your changes.</p>`);
  /* Skip the trade sentence when the guess or the text already names the trade. */
  const named = new RegExp(trade.split(' ')[0], 'i');
  const sayTrade = !named.test(a.text || '') && !named.test(guess(a).replace(/<[^>]+>/g, ''));
  html += H.h(`<p>${guess(a)}</p>${a.text ? `<p>${esc(a.text)}</p>` : ''}
    <p class="as-trade">${sayTrade ? `The right person for this is ${aOrAn(trade)} <b>${esc(trade)}</b>. ` : ''}${confidenceWords(a.confidence)}</p>`);
  html += `<p class="meta-line as-fine">${H.demo('Demo · rule-based guess')} ${esc(a.disclaimer || '')}</p>`;
  if (r.status === 'assessment') html += H.h(`<p>Want me to call some ${esc(tradeMany(a.trade))} near you for prices? I’ll tell each one I’m an AI assistant, and I won’t book anything without your yes.</p>`);
  return html;
};

/* ---------- Sheets ---------- */
const editSheet = r => {
  const hadPrices = (r.quotes || []).length > 0 || !!r.approval;
  let urgency = r.urgency;
  H.sheet('Change the description', `<form class="as-sheet" novalidate>
    ${hadPrices ? `<div class="note amber">${icon('info')}<span>Saving clears the prices you have now. I’ll make a new guess first.</span></div>` : ''}
    <div class="field" id="as-f-desc"><label for="as-desc">What’s happening?</label>
      <textarea id="as-desc" maxlength="1200" aria-describedby="as-desc-hint as-desc-msg">${esc(r.description)}</textarea>
      <span class="hint" id="as-desc-hint">Mention any smell of gas, sparks or flooding.</span>
      <span class="msg" id="as-desc-msg" hidden></span></div>
    <div class="field"><span id="as-urg-l" style="font-weight:700">How soon does it need fixing?</span>
      <div class="qr" role="group" aria-labelledby="as-urg-l">${URGENCY.map(([v, l]) =>
        `<button type="button" data-urg="${v}" aria-pressed="${v === urgency}">${esc(l)}</button>`).join('')}</div></div>
    <div class="as-row"><button class="btn" type="submit">${icon('check')} Save and update the guess</button></div>
  </form>`, (d, close) => {
    const form = d.querySelector('form'), ta = d.querySelector('#as-desc'), f = d.querySelector('#as-f-desc'), msg = d.querySelector('#as-desc-msg');
    d.querySelectorAll('[data-urg]').forEach(b => b.onclick = () => {
      urgency = b.dataset.urg; d.querySelectorAll('[data-urg]').forEach(x => x.setAttribute('aria-pressed', x === b));
    });
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    form.onsubmit = async e => {
      e.preventDefault();
      const description = ta.value.trim();
      if (!description) { f.classList.add('err'); msg.hidden = false; msg.innerHTML = `${icon('alert')} Tell me what’s happening, in a few words.`; ta.focus(); return; }
      const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Saving…';
      const prev = changed[r.id];
      changed[r.id] = description !== r.description ? 'description' : 'urgency'; /* set before the re-render */
      const updated = await H.mutate(r.id, '', { description, urgency });
      if (!updated) changed[r.id] = prev;
      if (updated) {
        close();
        H.toast(updated.status === 'hazard' ? 'This could be dangerous. I’ve paused finding pros.' : hadPrices ? 'Saved. Old prices were cleared.' : 'Saved. I updated my guess.');
        focusDock();
      }
      else { btn.disabled = false; btn.innerHTML = `${icon('check')} Save and update the guess`;
        f.classList.add('err'); msg.hidden = false; msg.innerHTML = `${icon('alert')} ${esc(H.state.error || 'That didn’t save. Please try again.')}`; }
    };
  });
};

const worseSheet = r => {
  H.sheet('It’s getting worse fast', `<div class="as-sheet">
    <div class="note red">${icon('alert')}<span><b>If you smell gas, see sparks or smoke, or water is flooding, this is an emergency.</b> Do these steps now. Handy can’t send emergency help.</span></div>
    ${hazardSteps()}
    <div class="as-row">
      <a class="btn danger" href="tel:911">${icon('phone')} Call 911</a>
      ${r.urgency !== 'Urgent' ? `<button class="btn ghost" type="button" data-as-urgent>It’s not dangerous, just urgent</button>` : `<button class="btn ghost" type="button" data-as-close>It’s not dangerous</button>`}
    </div>
  </div>`, (d, close) => {
    const c = d.querySelector('[data-as-close]'); if (c) c.onclick = close;
    const b = d.querySelector('[data-as-urgent]');
    if (b) b.onclick = async () => {
      b.disabled = true;
      const prev = changed[r.id]; changed[r.id] = 'urgency'; /* set before the re-render */
      const updated = await H.mutate(r.id, '', { urgency: 'Urgent' });
      if (!updated) changed[r.id] = prev;
      close();
      if (updated) H.toast('Marked as urgent. I’ll ask for the soonest times.');
      else H.toast(H.state.error || 'That didn’t save. Please try again.');
      focusDock();
    };
  });
};

H.assess = { editSheet, worseSheet };

H.part('assessment', {
  owns: ['assessment', 'hazard'],
  history(r) {
    if (!r.assessment) return '';
    return r.status === 'hazard' || r.assessment.hazard ? hazardHistory(r) : assessmentHistory(r);
  },
  dock(r) {
    if (r.status === 'hazard' || r.assessment?.hazard) return `<div class="as-dock">
      <div class="as-row">
        <a class="btn danger" href="tel:911">${icon('phone')} Call 911</a>
        <button class="btn ghost" type="button" data-nav="#/">I’m safe now</button>
      </div>
      <p class="meta-line">${icon('info')} Handy won’t call any pros for this.</p></div>`;
    return `<div class="as-dock">
      ${H.state.error ? `<p class="msg" role="alert">${icon('alert')} ${esc(H.state.error)}</p>` : ''}
      <p class="as-dock-copy">I’ll call a few pros near you and bring back up to 3 prices.</p>
      <button class="btn block" type="button" data-as-go>${icon('phone')} Yes, get me prices</button>
      <div class="qr">
        <button type="button" data-as-edit>${icon('edit')} Change the description</button>
        <button type="button" data-as-worse>It’s getting worse fast</button>
      </div></div>`;
  },
  bind(root, r) {
    const go = root.querySelector('[data-as-go]');
    if (go && r.status === 'assessment' && !r.assessment?.hazard) go.onclick = async () => {
      if (H.state.busy) return;
      const th = root.querySelector('.thread');
      if (th) {
        th.insertAdjacentHTML('beforeend', H.u('<p>Yes, get me prices</p>') + H.h('<p>Calling pros near you now…</p>') + H.typing());
        th.lastElementChild.scrollIntoView({block:'end', behavior:'smooth'});
      }
      go.innerHTML = `${icon('phone')} Calling pros…`;
      const ok = await H.mutate(r.id, 'quotes', {});
      if (!ok) focusDock(); /* core re-renders; the dock shows H.state.error */
    };
    const ed = root.querySelector('[data-as-edit]'); if (ed) ed.onclick = () => editSheet(r);
    const w = root.querySelector('[data-as-worse]'); if (w) w.onclick = () => worseSheet(r);
  }
});
})();
