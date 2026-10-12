/* Handy prototype — start, after-booking and property-manager screens (owner: account builder). */
(function(){
const H = window.H;
const css = `
.steps{list-style:none;margin:0 0 20px;padding:0;display:flex;flex-direction:column;gap:14px}
.steps li{display:flex;gap:14px;align-items:flex-start}
.steps .si{width:44px;height:44px;border-radius:50%;background:var(--green-tint);color:var(--green);display:grid;place-items:center;flex:none}
.steps .t{font-weight:700}.steps .s{font-size:15px;color:var(--ink2)}
.promise{display:flex;gap:10px;align-items:center;font-weight:700;color:var(--green);margin:0 0 20px}
.stack{display:flex;flex-direction:column;gap:10px}
.empty{text-align:center;padding:32px 8px 8px}
.empty .big{width:72px;height:72px;border-radius:50%;background:var(--pinned);color:var(--ink2);display:grid;place-items:center;margin:0 auto 16px}
.empty .big .ic{width:32px;height:32px}
.tl{list-style:none;margin:0 0 20px;padding:0}
.tl li{display:flex;gap:14px;padding:12px 0;border-bottom:1px solid var(--line)}
.tl .dot{width:36px;height:36px;border-radius:50%;background:var(--pinned);color:var(--ink2);display:grid;place-items:center;flex:none}
.tl .dot .ic{width:18px;height:18px}
.tl li.yes .dot{background:var(--green);color:#fff}
.tl li.yes .t{color:var(--green)}
.tl .t{font-weight:700}.tl .s{font-size:15px;color:var(--ink2)}
.rate{display:flex;gap:8px;margin:8px 0 20px}
.rate button{width:52px;height:52px;border-radius:14px;border:1.5px solid #C9C3B6;background:#fff;font-weight:700;font-size:17px;cursor:pointer}
.rate button[aria-pressed="true"]{border-color:var(--green);background:var(--green-tint);color:var(--green)}
.fchips{display:flex;gap:8px;overflow-x:auto;padding:0 16px 4px;margin:0 -16px 8px}
.fchips button{flex:none;min-height:44px;padding:0 16px;border:1.5px solid #C9C3B6;border-radius:var(--r-pill);background:#fff;font-weight:700;font-size:16px;cursor:pointer;white-space:nowrap}
.fchips button[aria-pressed="true"]{border-color:var(--green);background:var(--green);color:#fff}
.radio{width:24px;height:24px;border-radius:50%;border:2px solid #C9C3B6;flex:none;display:grid;place-items:center}
.row[aria-checked="true"] .radio{border-color:var(--green)}
.row[aria-checked="true"] .radio::after{content:"";width:12px;height:12px;border-radius:50%;background:var(--green)}
.tgl{display:flex;align-items:center;gap:12px;min-height:56px;margin-bottom:16px;cursor:pointer;font-weight:700}
.tgl .sw{width:52px;height:32px;border-radius:16px;background:#C9C3B6;position:relative;flex:none;border:0;cursor:pointer}
.tgl .sw::after{content:"";position:absolute;top:4px;left:4px;width:24px;height:24px;border-radius:50%;background:#fff;transition:left .15s}
.tgl .sw[aria-checked="true"]{background:var(--green)}
.tgl .sw[aria-checked="true"]::after{left:24px}
.mtop{margin-top:16px}`;
if (typeof document !== 'undefined' && document.head && !document.getElementById('acct-css')) {
  const s = document.createElement('style'); s.id = 'acct-css'; s.textContent = css; document.head.appendChild(s);
}
const rerender = () => window.dispatchEvent(new Event('hashchange'));
const slotLabel = id => { const s = H.slot(id); return s ? `${s.day} · ${s.time}` : ''; };
const repairStatus = st => H.statusWords[st] || st;
const statusTag = st => `<span class="tag ${st==='quotes_ready'?'amber':''}">${repairStatus(st)}</span>`;

/* ---------- Start ---------- */
H.screen('welcome', {
  render: () => `
    ${H.header({title:'Handy', sub:'Your repair helper'})}
    <main class="page">
      <h1>Something broken at home?</h1>
      <p class="lead">Snap a photo of what’s broken. Handy figures it out, calls local pros for prices, and books the one you pick.</p>
      <ol class="steps">
        <li><span class="si">${H.icon('camera')}</span><div><div class="t">Send a photo</div><div class="s">Add a few words about where it is.</div></div></li>
        <li><span class="si">${H.icon('phone')}</span><div><div class="t">Handy calls for prices</div><div class="s">Up to 3 local pros, at the same time.</div></div></li>
        <li><span class="si">${H.icon('cal')}</span><div><div class="t">You pick, Handy books</div><div class="s">Compare prices and times side by side.</div></div></li>
      </ol>
      <p class="promise">${H.icon('shield')} Nothing is booked until you say yes.</p>
      <div class="stack">
        <button class="btn block" data-go="new-photo">${H.icon('camera')} Report a problem</button>
        <button class="btn ghost block" data-act="manager">I manage rentals</button>
      </div>
      <p class="mtop">${H.demo()}</p>
    </main>`,
  after(root, S){ root.querySelector('[data-act="manager"]').addEventListener('click', () => { S.role = 'manager'; H.save(); H.go('manager-home'); }); }
});

H.screen('home-empty', {
  render: () => `
    ${H.header({title:'Handy', sub:'Your repair helper'})}
    <main class="page">
      <div class="empty">
        <div class="big">${H.icon('home')}</div>
        <h1>No repairs yet</h1>
        <p class="lead">When something breaks, send Handy a photo. Your repairs will show up here.</p>
      </div>
      <div class="stack">
        <button class="btn block" data-go="new-photo">${H.icon('camera')} Report a problem</button>
        <button class="btn plain" data-go="new-details" style="align-self:center">Try the sample leak (Demo)</button>
      </div>
    </main>`
});

/* ---------- After booking ---------- */
H.screen('reschedule', {
  render: S => {
    const cur = S.confirmedSlot || 's1', pick = S._resched || cur;
    return `
    ${H.header({title:'Change the time', sub:'Clearwater Plumbing', back:true, backTo:'booked'})}
    <main class="page">
      <h1>Pick a new time</h1>
      <p class="lead">Same plumber, same price: Clearwater Plumbing, $185. Only the time changes.</p>
      <p class="meta-line">${H.icon('cal')} Now booked: ${slotLabel(cur)}</p>
      <div class="slots mtop" role="group" aria-label="Choose a time">
        ${H.data.slots.map(s => `<button type="button" data-slot="${s.id}" aria-pressed="${s.id===pick}">${s.day}<small>${s.time}${s.id===cur?' · current':''}</small></button>`).join('')}
      </div>
      <div class="note mtop">${H.icon('info')} Handy will call Clearwater to ask. Your visit stays booked until they agree.</div>
    </main>
    ${H.dock(`<div class="stack"><button class="btn block" data-act="ask" ${pick===cur?'disabled':''}>Ask for this time</button><button class="btn plain" data-back="booked" style="align-self:center">Cancel</button></div>`)}`;
  },
  after(root, S){
    root.querySelectorAll('[data-slot]').forEach(b => b.addEventListener('click', () => { S._resched = b.dataset.slot; rerender(); }));
    const ask = root.querySelector('[data-act="ask"]');
    ask?.addEventListener('click', () => { S.confirmedSlot = S._resched; delete S._resched; H.save(); H.toast('Clearwater said yes to the new time.'); H.go('booked'); });
  }
});

H.screen('done', {
  render: S => {
    const st = S._done || 'ask';
    let body;
    if (st === 'yes') body = `
      <div class="empty"><div class="big" style="background:var(--green-tint);color:var(--green)">${H.icon('check')}</div>
      <h1>Glad it’s fixed</h1><p class="lead">Thanks for letting us know. We’ve closed this repair.</p></div>
      <p style="font-weight:700;margin:0">How was Clearwater? (optional)</p>
      <div class="rate" role="group" aria-label="Rate Clearwater from 1 to 5">
        ${[1,2,3,4,5].map(n => `<button type="button" data-rate="${n}" aria-pressed="${S._rating===n}" aria-label="${n} out of 5">${n}</button>`).join('')}
      </div>
      <button class="btn block" data-go="home">Back home</button>`;
    else if (st === 'no') body = `
      <h1>Sorry it’s not fixed yet</h1>
      <p class="lead">What would you like to do?</p>
      ${H.chips([['Ask them to come back','reschedule'],['Report a new problem','new-photo']])}
      <div class="note">${H.icon('shield')} Clearwater gave a 90-day guarantee on this repair.</div>`;
    else body = `
      <h1>Did Clearwater fix it?</h1>
      <p class="lead">Leak under the kitchen sink · ${slotLabel(S.confirmedSlot||'s1')}</p>
      <div class="stack"><button class="btn block" data-done="yes">${H.icon('check')} Yes, it’s fixed</button>
      <button class="btn ghost block" data-done="no">Not yet</button></div>`;
    return `${H.header({title:'Mark as fixed', sub:'Clearwater Plumbing', back:true, backTo:'booked'})}<main class="page">${body}</main>`;
  },
  after(root, S){
    root.querySelectorAll('[data-done]').forEach(b => b.addEventListener('click', () => { S._done = b.dataset.done; rerender(); }));
    root.querySelectorAll('[data-rate]').forEach(b => b.addEventListener('click', () => { S._rating = +b.dataset.rate; rerender(); }));
    // reset the local flow state when the user leaves
    root.querySelectorAll('[data-go],[data-back]').forEach(b => b.addEventListener('click', () => { delete S._done; delete S._rating; }, {capture:true}));
  }
});

H.screen('activity', {
  render: S => {
    const ev = [
      ['camera','You sent a photo','Kitchen sink · 2:30 pm'],
      ['wrench','Handy’s guess: loose drain connection','Plumber needed, about $150–250 · 2:31 pm'],
      ['phone','Handy called 3 plumbers','Clearwater, Oak & Pipe, Neighborhood Fix · 2:32 pm'],
      ['list','Prices came in','$185, $215 and $160 · 2:36 pm'],
      ['check','You approved $185 with Clearwater · 2:41 pm','Nothing was booked before this', 'yes'],
      ['phone','Handy called Clearwater to book','2:42 pm'],
      ['cal','Booked', slotLabel(S.confirmedSlot||'s1') + ' · 2:44 pm']
    ];
    return `${H.header({title:'What happened', sub:'Leak under the kitchen sink', back:true, backTo:'booked'})}
    <main class="page">
      <h1>Everything so far</h1>
      <p class="lead">Every step on this repair, in order. ${H.demo()}</p>
      <ol class="tl">${ev.map(([ic,t,s,c]) => `<li class="${c||''}"><span class="dot">${H.icon(ic)}</span><div><div class="t">${t}</div><div class="s">${s}</div></div></li>`).join('')}</ol>
      <button class="btn ghost block" data-go="transcript">${H.icon('doc')} See what was said</button>
    </main>`;
  }
});

/* ---------- Property manager ---------- */
const FILTERS = [['all','All'], ...H.data.properties.map(p => [p.id, p.name])];
const STATUS = [['any','Any status'],['scheduled','Booked'],['quotes_ready','Prices are in'],['quoting','Getting prices']];
const goFor = {r1:'booked', r2:'quotes', r3:'calling'};
const filtered = S => H.data.repairs.filter(r => (S.filter==='all' || !S.filter || r.prop===S.filter) && (!S.statusFilter || S.statusFilter==='any' || r.status===S.statusFilter));
const managerTop = S => `
  ${H.header({title:'All properties', sub:'Repairs across your rentals', action:`<button class="act" data-go="property-switch">${H.icon('home')} Switch property</button>`})}
  <main class="page">
    <h1>Repairs</h1>
    <p class="lead">${H.demo('Demo · sample properties and repairs')}</p>
    <div class="fchips" role="group" aria-label="Filter by property">${FILTERS.map(([id,l]) => `<button type="button" data-f="${id}" aria-pressed="${(S.filter||'all')===id}">${l}</button>`).join('')}</div>
    <div class="fchips" role="group" aria-label="Filter by status">${STATUS.map(([id,l]) => `<button type="button" data-st="${id}" aria-pressed="${(S.statusFilter||'any')===id}">${l}</button>`).join('')}</div>`;
const bindFilters = (root, S) => {
  root.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { S.filter = b.dataset.f; filtersChanged(S); }));
  root.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => { S.statusFilter = b.dataset.st; filtersChanged(S); }));
};
const filtersChanged = S => { H.save(); const want = filtered(S).length ? 'manager-home' : 'manager-empty'; if (location.hash.slice(1) === want) rerender(); else H.go(want, {replace:true}); };

H.screen('manager-home', {
  render: S => {
    const rows = filtered(S);
    return `${managerTop(S)}
    <div class="list" style="margin:0 -16px">${rows.map(r => { const p = H.prop(r.prop); return `
      <button class="row" data-go="${goFor[r.id]}"><div class="grow"><div class="t">${r.title}</div><div class="s">${p.name} · ${p.unit}</div><div class="s">${r.line}</div></div>${statusTag(r.status)}${H.icon('chev')}</button>`; }).join('')}</div>
    </main>
    ${H.dock(`<button class="btn block" data-go="property-switch">${H.icon('camera')} Report a problem</button>`)}`;
  },
  after(root, S){ S.role = 'manager'; bindFilters(root, S); }
});

H.screen('manager-empty', {
  render: S => {
    if (S.filter === 'all' && (!S.statusFilter || S.statusFilter === 'any')) { S.filter = 'p3'; S.statusFilter = 'scheduled'; }
    return `${managerTop(S)}
    <div class="empty"><div class="big">${H.icon('list')}</div>
      <h1>Nothing matches</h1><p class="lead">No repairs here with this status. Try a different property or status.</p></div>
    <button class="btn ghost block" data-act="clear">Clear filters</button>
    </main>`;
  },
  after(root, S){ bindFilters(root, S); root.querySelector('[data-act="clear"]').addEventListener('click', () => { S.filter = 'all'; S.statusFilter = 'any'; H.save(); H.go('manager-home', {replace:true}); }); }
});

H.screen('property-switch', {
  render: S => `${H.header({title:'Choose a property', sub:'Where is the problem?', back:true, backTo:'manager-home'})}
    <main class="page">
      <h1>Which property?</h1>
      <p class="lead">Pick where the problem is. ${H.demo()}</p>
      <div class="list" role="radiogroup" aria-label="Property" style="margin:0 -16px">${H.data.properties.map(p => `
        <button class="row" role="radio" aria-checked="${S.propertyId===p.id}" data-p="${p.id}"><span class="radio"></span>
          <div class="grow"><div class="t">${p.name}</div><div class="s">${p.addr} · ${p.unit}</div><div class="s">Tenant: ${p.tenant}</div></div>${H.icon('chev')}</button>`).join('')}</div>
    </main>`,
  after(root, S){ root.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { S.propertyId = b.dataset.p; H.save(); H.go('tenant-access'); })); }
});

H.screen('tenant-access', {
  render: S => {
    const p = H.prop(S.propertyId) || H.data.properties[0], home = S.tenantHome !== false;
    return `${H.header({title:'Getting in', sub:`${p.name} · ${p.unit}`, back:true, backTo:'property-switch'})}
    <main class="page">
      <h1>How will the plumber get in?</h1>
      <p class="lead">Handy will tell ${p.tenant} before the visit.</p>
      <div class="field"><label for="acc">Note for the pro</label>
        <span class="hint" id="acc-h">For example: where the key is, parking, pets.</span>
        <textarea id="acc" aria-describedby="acc-h">${S.access||''}</textarea></div>
      <div class="tgl" data-act="home"><button type="button" class="sw" role="switch" aria-checked="${home}" aria-labelledby="tgl-l"></button><span id="tgl-l">Tenant must be home</span></div>
      <div class="note">${H.icon('shield')} The exact address is only shared after you say yes to a price.</div>
    </main>
    ${H.dock(`<button class="btn block" data-act="next">Continue ${H.icon('arrow')}</button>`)}`;
  },
  after(root, S){
    const ta = root.querySelector('#acc');
    ta.addEventListener('input', () => { S.access = ta.value; H.save(); });
    root.querySelector('[data-act="home"]').addEventListener('click', () => { S.access = ta.value; S.tenantHome = S.tenantHome === false; rerender(); });
    root.querySelector('[data-act="next"]').addEventListener('click', () => { S.access = ta.value; H.save(); H.go('new-photo'); });
  }
});
})();
