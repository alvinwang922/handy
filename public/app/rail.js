/* rail.js — left rail (repair list, role switch, filters, demo reset) and the home pane.
   Registers H.ui.rail and H.ui.home. Owner: rail module. */
(function(){
const H = window.H;
if (!H) return;

const css = `
.rl{display:flex;flex-direction:column;min-height:100%;flex:1}
.rl-brand{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);min-height:65px}
.rl-brand .n{font-weight:700;font-size:18px;line-height:1.2}
.rl-brand .s{font-size:15px;color:var(--ink2)}
.rl-top{padding:16px 16px 12px;display:flex;flex-direction:column;gap:12px;border-bottom:1px solid var(--line)}
.rl-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;background:var(--pinned);border:1px solid var(--line);border-radius:14px}
.rl-seg button{min-height:48px;border:0;border-radius:10px;background:none;font-weight:700;font-size:15px;color:var(--ink2);cursor:pointer;padding:0 6px;line-height:1.15}
.rl-seg button:hover{color:var(--ink)}
.rl-seg button[aria-pressed="true"]{background:#fff;color:var(--green);box-shadow:0 1px 3px rgba(30,43,36,.12),0 1px 1px rgba(30,43,36,.06)}
.rl-filter{display:flex;flex-direction:column;gap:6px}
.rl-filter label{font-weight:700;font-size:15px}
.rl-filter select{min-height:48px;border:1.5px solid #C9C3B6;border-radius:12px;padding:0 12px;background:#fff;font-size:17px;cursor:pointer;accent-color:var(--green)}
.rl-top .btn{flex:none;width:100%}
.rl-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:16px 16px 8px}
.rl-head h2{margin:0;font-size:17px}
.rl-head .c{font-size:15px;color:var(--ink3);font-variant-numeric:tabular-nums}
.rl .list{border-top:1px solid var(--line)}
.rl .row{gap:12px;align-items:flex-start;padding:14px 16px;font:inherit;color:inherit}
.rl .row .si{width:40px;height:40px;border-radius:50%;background:var(--pinned);color:var(--ink2);display:grid;place-items:center;flex:none}
.rl .row .si .ic{width:20px;height:20px}
.rl .row.st-quotes .si,.rl .row.st-scheduling .si{background:var(--amber-tint);color:var(--amber)}
.rl .row.st-scheduled .si,.rl .row.st-complete .si{background:var(--green-tint);color:var(--green)}
.rl .row.st-hazard .si{background:var(--red-tint);color:var(--red)}
.rl .row .t{display:block;overflow-wrap:anywhere}
.rl .row .p{display:block;font-size:15px;color:var(--ink2)}
.rl .row .s{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;margin-top:4px}
.rl .row .s .l{flex-basis:100%;color:var(--ink2)}
.rl .row .s .w{font-weight:700;color:var(--ink)}
.rl .row .tag{font-size:13px;padding:2px 8px}
.rl .row>.ic{align-self:center;color:var(--ink3)}
.rl .row[aria-current="page"]{background:var(--green-tint)}
.rl .row[aria-current="page"] .si{background:var(--green);color:#fff}
.rl .row[aria-current="page"].st-hazard .si{background:var(--red);color:#fff}
.rl-empty{padding:24px 16px;color:var(--ink2)}
.rl-empty p{margin:0 0 12px}
.rl-empty .t{font-weight:700;color:var(--ink);margin-bottom:4px}
.rl-ins{display:flex;align-items:center;gap:12px;min-height:56px;padding:0 16px;margin-top:8px;color:var(--green);font-weight:700;text-decoration:none;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.rl-ins:hover{background:var(--pinned)}
.rl-ins[aria-current="page"]{background:var(--green-tint)}
.rl-ins .grow{flex:1}
.rl-foot{margin-top:auto;padding:16px;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.rl-foot .btn.plain{min-height:48px;padding:0 8px;font-size:15px}
.hm{flex:1;padding:32px 24px 40px;max-width:600px}
.hm h1{font-size:30px;line-height:1.15;margin:0 0 10px;text-wrap:balance}
.hm .lead{color:var(--ink2);margin:0 0 24px;max-width:52ch}
.hm .btn{flex:none;width:100%;max-width:420px}
.hm-steps{list-style:none;margin:0 0 24px;padding:0;display:flex;flex-direction:column;gap:16px}
.hm-steps li{display:flex;gap:14px;align-items:flex-start}
.hm-steps .si{width:44px;height:44px;border-radius:50%;background:var(--green-tint);color:var(--green);display:grid;place-items:center;flex:none}
.hm-steps .t{font-weight:700}
.hm-steps .s{font-size:15px;color:var(--ink2)}
.hm-promise{display:flex;gap:10px;align-items:center;font-weight:700;color:var(--green);margin:0 0 24px}
.hm-next{margin:0 0 28px}
.hm-next h2{font-size:20px;margin:0 0 12px}
.hm-next .bu{max-width:100%;margin-bottom:12px}
.hm-next .bu p{margin:0}
.hm-calm{display:flex;gap:10px;align-items:center;color:var(--ink2);margin:0 0 24px}
.hm-calm .ic{color:var(--green)}
.hm-alt{margin-top:12px}
.hm .hm-alt .btn{width:auto;min-height:48px;padding:0 4px}
.hm .demo-line{margin-top:24px}
@media (max-width:639px){.hm{padding:24px 16px 32px}.hm h1{font-size:26px}}
.rl-now{display:none}
@media (max-width:639px){.rl-now{display:flex;flex-direction:column;gap:12px;padding:16px;border-bottom:1px solid var(--line)}.rl-now .note{margin:0}.rl-now .btn{flex:none;width:100%}.rl-now .w{margin:0}}
.rl-empty .hm-promise{margin:0 0 12px;font-size:15px}
`;
if (!document.getElementById('css-rail')) {
  const s = document.createElement('style'); s.id = 'css-rail'; s.textContent = css; document.head.appendChild(s);
}

const ICON = {hazard:'alert', assessment:'info', quotes:'list', scheduling:'cal', scheduled:'cal', complete:'check'};
const isManager = S => S.role === 'manager';
const chosenQuote = r => (r.approval && (r.quotes || []).find(q => q.id === r.approval.quoteId)) || (r.provider != null ? (r.quotes || [])[r.provider] : null);
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* Repairs visible for the current role + filter. */
const visible = S => {
  const all = S.repairs || [];
  if (!isManager(S)) return byUrgency(all.filter(r => r.property === 'p1'));
  const f = S.propertyFilter || 'all';
  return byUrgency(f === 'all' ? all : all.filter(r => r.property === f));
};
/* Load failed: nothing ever arrived from bootstrap. Dismissing core's error box doesn't clear this. */
const loadFailed = S => !(S.properties || []).length && !(S.repairs || []).length && !!(S.error || S.loaded);
const RANK = {hazard:0, quotes:1, scheduling:1};
const byUrgency = list => list.map((r, i) => [r, i]).sort((a, b) => ((RANK[a[0].status] ?? 2) - (RANK[b[0].status] ?? 2)) || a[1] - b[1]).map(x => x[0]);
/* All repairs the role can see, ignoring the manager's filter. */
const roleRepairs = S => isManager(S) ? (S.repairs || []) : (S.repairs || []).filter(r => r.property === 'p1');

/* Short second line under the status word. Plain text; caller escapes. */
const shortLine = r => {
  const q = chosenQuote(r);
  switch (r.status) {
    case 'hazard': return 'Stop and stay safe first';
    case 'assessment': return 'Ready to get prices';
    case 'quotes': { const n = (r.quotes || []).length; return n ? `${count(n, 'price', 'prices')} to compare` : 'Waiting for prices'; }
    case 'scheduling': return q ? `You approved ${q.name}` : 'Choose when the pro comes';
    case 'scheduled': return r.booking && r.booking.window ? H.when(r.booking.window.start, r.booking.window.end) : (q ? q.name : '');
    case 'complete': return q ? `By ${q.name}` : '';
    default: return '';
  }
};

const row = (r, S) => {
  const p = H.prop(r.property);
  const current = H.route && H.route.name === 'repair' && H.route.id === r.id;
  const word = H.statusWords[r.status] || r.status;
  const line = shortLine(r);
  const status = r.status === 'hazard'
    ? `<span class="tag red">${H.icon('alert')} ${H.esc(word)}</span>${line ? `<span>${H.esc(line)}</span>` : ''}`
    : `<span class="w">${H.esc(word)}</span>${line ? `<span class="l">${H.esc(line)}</span>` : ''}`;
  return `<a class="row st-${H.esc(r.status)}" href="#/repair/${H.esc(r.id)}" data-nav="#/repair/${H.esc(r.id)}"${current ? ' aria-current="page"' : ''}>
    <span class="si">${H.icon(ICON[r.status] || 'wrench')}</span>
    <span class="grow">
      <span class="t">${H.esc(r.title)}</span>
      ${isManager(S) && p ? `<span class="p">${H.esc(p.name)} · ${H.esc(p.unit)}</span>` : ''}
      <span class="s">${status}</span>
    </span>${H.icon('chev')}</a>`;
};

/* Phone-only: the home pane is hidden on the list screen, so surface what needs attention here. */
const nowBlock = list => {
  const hazard = list.find(r => r.status === 'hazard');
  if (hazard) return `<div class="rl-now"><div class="note red">${H.icon('alert')}<span><b>${H.esc(hazard.title)}</b> may not be safe. Open it for what to do now.</span></div>
    <button type="button" class="btn danger" data-nav="#/repair/${H.esc(hazard.id)}">Open safety steps</button></div>`;
  const next = list.find(r => r.status === 'quotes' || r.status === 'scheduling');
  if (next) return `<div class="rl-now"><p class="w"><b>Waiting on you:</b> ${next.status === 'quotes' ? 'compare prices for' : 'pick a time for'} “${H.esc(next.title)}”.</p>
    <button type="button" class="btn ghost" data-nav="#/repair/${H.esc(next.id)}">${next.status === 'quotes' ? `${H.icon('list')} Compare prices` : `${H.icon('cal')} Pick a time`}</button></div>`;
  return '';
};

const emptyList = S => {
  if (isManager(S) && (S.propertyFilter || 'all') !== 'all') {
    const p = H.prop(S.propertyFilter);
    return `<div class="rl-empty"><p class="t">No repairs at ${H.esc(p ? p.name : 'this property')}</p>
      <p>Nothing has been reported here yet.</p>
      <button type="button" class="btn ghost block" data-rl-all>Show all properties</button></div>`;
  }
  return `<div class="rl-empty"><p class="t">No repairs yet</p><p>When something breaks, send Handy a photo. Your repairs will show up here.</p><p class="hm-promise">${H.icon('shield')} Nothing is booked until you say yes.</p></div>`;
};

H.ui.rail = {
  render(S) {
    const mgr = isManager(S);
    const list = visible(S);
    const props = S.properties || [];
    const failed = loadFailed(S);
    const insightsOn = H.route && H.route.name === 'insights';
    return `<div class="rl">
      <div class="rl-brand"><div class="av">${H.icon('wrench')}</div><div><div class="n">Handy</div><div class="s">Your repair helper</div></div></div>
      <div class="rl-top">
        <div class="rl-seg" role="group" aria-label="I am a">
          <button type="button" data-role="owner" aria-pressed="${!mgr}">Homeowner</button>
          <button type="button" data-role="manager" aria-pressed="${mgr}">Property manager</button>
        </div>
        ${mgr ? `<div class="rl-filter"><label for="rl-prop">Property</label>
          <select id="rl-prop">${[{id:'all', name:'All properties'}, ...props].map(p => `<option value="${H.esc(p.id)}"${(S.propertyFilter || 'all') === p.id ? ' selected' : ''}>${H.esc(p.name)}</option>`).join('')}</select></div>` : ''}
        <button type="button" class="btn" data-nav="#/new">${H.icon('camera')} Report a problem</button>
      </div>
      ${failed ? '' : nowBlock(list)}
      <div class="rl-head"><h2 id="rl-h" tabindex="-1">${mgr ? 'Repairs' : 'Your repairs'}</h2>${list.length ? `<span class="c">${count(list.length, 'repair', 'repairs')}</span>` : ''}</div>
      ${failed ? `<div class="rl-empty"><p class="t">Couldn’t load your repairs</p><p>Check that the app is running, then try again.</p><button type="button" class="btn ghost block" data-rl-retry>${H.icon('refresh')} Try again</button></div>`
        : list.length ? `<div class="list" role="list" aria-labelledby="rl-h">${list.map(r => `<div role="listitem">${row(r, S)}</div>`).join('')}</div>` : emptyList(S)}
      ${mgr ? `<a class="rl-ins" href="#/insights" data-nav="#/insights"${insightsOn ? ' aria-current="page"' : ''}>${H.icon('chart')}<span class="grow">Insights</span>${H.icon('chev')}</a>` : ''}
      <div class="rl-foot">${H.demo('Demo · simulated data')}<button type="button" class="btn plain" data-rl-reset>Reset demo</button></div>
    </div>`;
  },
  bind(root) {
    const S = H.state;
    root.querySelectorAll('[data-role]').forEach(b => b.addEventListener('click', () => {
      if (S.role === b.dataset.role) return;
      S.role = b.dataset.role; H.saveUi();
      // A homeowner can't open another property's repair; send them home.
      const open = H.route && H.route.name === 'repair' ? H.repair(H.route.id) : null;
      if (S.role === 'owner' && (open && open.property !== 'p1' || (H.route && H.route.name === 'insights'))) H.go('#/'); else H.render();
      refocus(`.rail [data-role="${S.role}"]`);
    }));
    const sel = root.querySelector('#rl-prop');
    if (sel) sel.addEventListener('change', () => { S.propertyFilter = sel.value; H.saveUi(); H.render(); const n = document.querySelector('#rl-prop'); if (n) n.focus(); });
    const all = root.querySelector('[data-rl-all]');
    if (all) all.addEventListener('click', () => { S.propertyFilter = 'all'; H.saveUi(); H.render(); refocus('#rl-prop'); });
    const retry = root.querySelector('[data-rl-retry]');
    if (retry) retry.addEventListener('click', () => retryLoad('[data-rl-retry]'));
    const reset = root.querySelector('[data-rl-reset]');
    if (reset) reset.addEventListener('click', openReset);
  }
};

/* H.render() replaces the DOM, so put keyboard focus back where the user was. */
function refocus(sel) {
  const el = document.querySelector(sel);
  if (!el) return;
  if (el.tabIndex < 0 && !el.matches('button,a,select,input')) el.tabIndex = -1;
  el.focus({preventScroll:true});
}
async function retryLoad(again) {
  await H.refresh();
  refocus(loadFailed(H.state) ? again : '#rl-h');
}

function openReset() {
  H.sheet('Reset the demo?', `
    <p style="margin:0 0 12px">This puts the demo back to its starting point: the three sample repairs at Maple House and Oak Street Duplex.</p>
    <div class="note amber" style="margin-bottom:16px">${H.icon('alert')}<span>Any repairs, prices, approvals and bookings you made in this demo will be removed. Nothing real is affected: no pros are called and nothing is cancelled.</span></div>
    <p class="msg" role="alert" hidden style="color:var(--red);margin:0 0 12px"></p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button type="button" class="btn" data-confirm>${H.icon('refresh')} Reset the demo</button>
      <button type="button" class="btn ghost" data-cancel>Keep my demo</button>
    </div>`, (d, close) => {
    d.querySelector('[data-cancel]').addEventListener('click', close);
    const go = d.querySelector('[data-confirm]'), msg = d.querySelector('.msg');
    go.addEventListener('click', async () => {
      go.disabled = true; go.textContent = 'Resetting…'; msg.hidden = true;
      try {
        await H.api('POST', '/api/demo/reset', {confirm:'RESET DEMO'});
        close();
        H.state.propertyFilter = 'all'; H.saveUi();
        await H.refresh();
        H.go('#/');
        refocus('.center h1');
        H.toast('The demo is back to its starting point.');
      } catch (e) {
        go.disabled = false; go.innerHTML = `${H.icon('refresh')} Try again`;
        msg.textContent = e.message; msg.hidden = false;
      }
    });
  });
}

/* ---------- Home (center pane, no repair selected) ---------- */
const welcome = S => {
  const f = S.propertyFilter || 'all', fp = f !== 'all' ? H.prop(f) : null;
  const head = !isManager(S) ? 'Something broken at home?'
    : fp ? `Nothing reported at ${H.esc(fp.name)} yet` : 'Something broken at one of your rentals?';
  const lead = isManager(S)
    ? 'When a tenant reports a problem, snap a photo of it. Handy figures it out, calls local pros for prices, and books the one you pick.'
    : 'Snap a photo of what’s broken. Handy figures it out, calls local pros for prices, and books the one you pick.';
  return `
  <h1>${head}</h1>
  <p class="lead">${lead}</p>
  <ol class="hm-steps">
    <li><span class="si">${H.icon('camera')}</span><div><div class="t">Send a photo</div><div class="s">Add a few words about where it is.</div></div></li>
    <li><span class="si">${H.icon('phone')}</span><div><div class="t">Handy calls for prices</div><div class="s">Up to 3 local pros, at the same time.</div></div></li>
    <li><span class="si">${H.icon('cal')}</span><div><div class="t">You pick, Handy books</div><div class="s">Compare prices and times side by side.</div></div></li>
  </ol>
  <p class="hm-promise">${H.icon('shield')} Nothing is booked until you say yes.</p>
  <button type="button" class="btn" data-nav="#/new">${H.icon('camera')} Report a problem</button>
  ${isManager(S) && (S.propertyFilter || 'all') !== 'all' && (S.repairs || []).length ? `<div class="hm-alt"><button type="button" class="btn plain" data-hm-all>Show all properties</button></div>` : ''}`;
};

const nextLine = r => {
  const n = (r.quotes || []).length, q = chosenQuote(r);
  if (r.status === 'quotes') return `<p><b>${H.esc(count(n, 'price is', 'prices are'))} in</b> for “${H.esc(r.title)}”. Take a look and pick the one you like. Nothing is booked until you say yes.</p>`;
  return `<p>You approved <b>${H.esc(q ? q.name : 'a pro')}</b> for “${H.esc(r.title)}”. <b>Pick a time</b> and I’ll book it.</p>`;
};

H.ui.home = {
  render(S) {
    if (loadFailed(S)) {
      return `<div class="hm"><h1>We couldn’t load your repairs</h1>
        <button type="button" class="btn" data-hm-retry>${H.icon('refresh')} Try again</button></div>`;
    }
    const mine = visible(S);
    if (!mine.length) return `<div class="hm">${welcome(S)}<p class="demo-line">${H.demo()}</p></div>`;
    const mgr = isManager(S);
    const next = mine.find(r => r.status === 'quotes' || r.status === 'scheduling');
    const hazard = mine.find(r => r.status === 'hazard');
    const p1 = H.prop('p1');
    const greet = mgr ? 'Hi' : `Hi ${H.esc(((S.actor && S.actor.name) || 'Jamie').split(' ')[0])}`;
    const lead = mgr
      ? `${count(mine.length, 'repair', 'repairs')} across your rentals. Send a photo when a tenant reports something new.`
      : `Something broken at ${H.esc(p1 ? p1.name : 'home')}? Send a photo and I’ll handle the calls.`;
    const where = r => { const p = H.prop(r.property); return mgr && p ? ` <span class="meta-line">${H.icon('home')} ${H.esc(p.name)} · ${H.esc(p.unit)}</span>` : ''; };
    return `<div class="hm">
      <h1>${greet}</h1>
      <p class="lead">${lead}</p>
      ${hazard ? `<div class="note red" style="margin-bottom:24px">${H.icon('alert')}<span><b>${H.esc(hazard.title)}</b> may not be safe. Open it for what to do now.</span></div>
        <button type="button" class="btn danger" style="margin:-12px 0 28px" data-nav="#/repair/${H.esc(hazard.id)}">Open safety steps</button>` : ''}
      ${next ? `<section class="hm-next" aria-labelledby="hm-next-h"><h2 id="hm-next-h">Waiting on you</h2>
          ${H.h(nextLine(next))}${where(next)}
          <button type="button" class="btn${hazard ? ' ghost' : ''}" style="margin-top:12px" data-nav="#/repair/${H.esc(next.id)}">${next.status === 'quotes' ? `${H.icon('list')} Compare prices` : `${H.icon('cal')} Pick a time`}</button>
        </section>
        <button type="button" class="btn ghost" data-nav="#/new">${H.icon('camera')} Report a problem</button>`
      : `<p class="hm-calm">${H.icon('check')} Nothing needs you right now.</p>
        <button type="button" class="btn" data-nav="#/new">${H.icon('camera')} Report a problem</button>`}
      <p class="demo-line">${H.demo()}</p>
    </div>`;
  },
  bind(root) {
    const retry = root.querySelector('[data-hm-retry]');
    if (retry) retry.addEventListener('click', () => retryLoad('[data-hm-retry]'));
    const all = root.querySelector('[data-hm-all]');
    if (all) all.addEventListener('click', () => { H.state.propertyFilter = 'all'; H.saveUi(); H.render(); refocus('#rl-prop'); });
  }
};
})();
