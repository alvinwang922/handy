/* rail.js — left rail for the two apps (role is fixed per app: H.ROLE / H.isManager() / H.myRepairs()).
   Homeowner: brand, Report a problem, your repairs across your houses (house name on each row when you have several), Settings link.
   Manager: brand, Report a problem, Dashboard / Insights / Settings nav, property filter, repairs grouped by property.
   Both: footer with Demo tag, Reset demo (confirm sheet), Switch app link to the chooser.
   Registers H.ui.rail only (the dashboards own #/). Owner: rail module. */
(function(){
const H = window.H;
if (!H) return;

const css = `
.rl{display:flex;flex-direction:column;min-height:100%;flex:1}
.rl-brand{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);min-height:65px;text-decoration:none;color:inherit}
.rl-brand:hover{background:var(--pinned)}
.rl-brand .n{font-weight:700;font-size:18px;line-height:1.2}
.rl-brand .s{font-size:15px;color:var(--ink2)}
.rl-top{padding:16px}
.rl-top .btn{flex:none;width:100%}
.rl-nav{display:flex;flex-direction:column;gap:2px;padding:0 8px 12px}
.rl-nav a{display:flex;align-items:center;gap:12px;min-height:48px;padding:0 12px;border-radius:12px;color:var(--ink2);font-weight:700;text-decoration:none}
.rl-nav a:hover{background:var(--pinned);color:var(--ink)}
.rl-nav a[aria-current="page"]{background:var(--green-tint);color:var(--green)}
.rl-nav .grow{flex:1}
.rl-nav .cnt{min-width:26px;height:26px;padding:0 8px;border-radius:var(--r-pill);background:var(--amber-tint);color:var(--amber);font-size:14px;display:inline-grid;place-items:center;font-variant-numeric:tabular-nums}
.rl-filter{display:flex;flex-direction:column;gap:6px;padding:12px 16px 4px;border-top:1px solid var(--line)}
.rl-filter label{font-weight:700;font-size:15px}
.rl-filter select{min-height:48px;border:1.5px solid #C9C3B6;border-radius:12px;padding:0 12px;background:#fff;font-size:17px;cursor:pointer;accent-color:var(--green)}
.rl-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:16px 16px 8px}
.rl-head h2{margin:0;font-size:17px}
.rl-head .c{font-size:15px;color:var(--ink3);font-variant-numeric:tabular-nums}
.rl .list{border-top:1px solid var(--line)}
.rl-grp{display:flex;align-items:center;gap:8px;padding:16px 16px 8px;border-bottom:1px solid var(--line);background:var(--bg)}
.rl-grp .grow{flex:1;min-width:0}
.rl-grp .gn{font-weight:700;font-size:16px;display:block}
.rl-grp .gu{font-size:14px;color:var(--ink3);display:block}
.rl-grp .need{flex:none;font-size:14px;font-weight:700;color:var(--amber);background:var(--amber-tint);border-radius:var(--r-pill);padding:2px 10px;white-space:nowrap}
.rl-grp .ok{flex:none;font-size:14px;color:var(--ink3);white-space:nowrap}
.rl .row{gap:12px;align-items:flex-start;padding:14px 16px;font:inherit;color:inherit}
.rl .row .si{width:40px;height:40px;border-radius:50%;background:var(--pinned);color:var(--ink2);display:grid;place-items:center;flex:none}
.rl .row .si .ic{width:20px;height:20px}
.rl .row.st-quotes .si,.rl .row.st-scheduling .si{background:var(--amber-tint);color:var(--amber)}
.rl .row.st-scheduled .si,.rl .row.st-complete .si{background:var(--green-tint);color:var(--green)}
.rl .row.st-hazard .si{background:var(--red-tint);color:var(--red)}
.rl .row .t{display:block;overflow-wrap:anywhere}
.rl .row .s{display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;margin-top:4px}
.rl .row .s .l{flex-basis:100%;color:var(--ink2)}
.rl .row .s .w{font-weight:700;color:var(--ink)}
.rl .row .tag{font-size:13px;padding:2px 8px}
.rl .row .hs{display:flex;align-items:center;gap:4px;margin-top:4px;font-size:14px;color:var(--ink3);overflow-wrap:anywhere}
.rl .row .hs .ic{width:15px;height:15px}
.rl-nav.rl-own{padding:12px 8px;margin-top:auto;border-top:1px solid var(--line)}
.rl-nav.rl-own+.rl-foot{margin-top:0}
.rl .row>.ic{align-self:center;color:var(--ink3)}
.rl .row[aria-current="page"]{background:var(--green-tint)}
.rl .row[aria-current="page"] .si{background:var(--green);color:#fff}
.rl .row[aria-current="page"].st-hazard .si{background:var(--red);color:#fff}
.rl-empty{padding:24px 16px;color:var(--ink2)}
.rl-empty p{margin:0 0 12px}
.rl-empty .t{font-weight:700;color:var(--ink);margin-bottom:4px}
.rl-promise{display:flex;gap:10px;align-items:center;font-weight:700;color:var(--green);font-size:15px}
.rl-now{display:none}
@media (max-width:639px){.rl-now{display:flex;flex-direction:column;gap:12px;padding:0 16px 16px}.rl-now .note{margin:0}.rl-now .btn{flex:none;width:100%}.rl-now .w{margin:0}}
.rl-foot{margin-top:auto;padding:16px;display:flex;flex-direction:column;gap:4px;border-top:1px solid var(--line)}
.rl-foot .r1{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}
.rl-foot .btn.plain{min-height:48px;padding:0 8px;font-size:15px}
.rl-switch{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:0 4px;align-self:flex-start;font-size:15px;color:var(--ink3);text-decoration:underline;text-underline-offset:3px;border-radius:8px}
.rl-switch:hover{color:var(--ink)}
.rl-switch .ic{width:18px;height:18px}
`;
if (!document.getElementById('css-rail')) {
  const s = document.createElement('style'); s.id = 'css-rail'; s.textContent = css; document.head.appendChild(s);
}

const ICON = {hazard:'alert', assessment:'info', quotes:'list', scheduling:'cal', scheduled:'cal', complete:'check'};
const NEEDS = ['hazard', 'quotes', 'scheduling'];
const needsYou = r => NEEDS.includes(r.status) && !(r.status === 'quotes' && !(r.quotes || []).length);
const chosenQuote = r => (r.approval && (r.quotes || []).find(q => q.id === r.approval.quoteId)) || (r.provider != null ? (r.quotes || [])[r.provider] : null);
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const RANK = {hazard:0, quotes:1, scheduling:1};
const byUrgency = list => list.map((r, i) => [r, i]).sort((a, b) => ((RANK[a[0].status] ?? 2) - (RANK[b[0].status] ?? 2)) || a[1] - b[1]).map(x => x[0]);
const mine = () => (H.myRepairs ? H.myRepairs() : H.state.repairs) || [];
/* Load failed: nothing ever arrived from bootstrap. Dismissing core's error box doesn't clear this. */
const loadFailed = S => !(S.properties || []).length && !(S.repairs || []).length && !!(S.error || S.loaded);
const filterOf = S => {
  const f = S.propertyFilter || 'all';
  return f === 'all' || (S.properties || []).some(p => p.id === f) ? f : 'all';
};

/* Short second line under the status word. Plain text; caller escapes. */
const shortLine = r => {
  const q = chosenQuote(r);
  switch (r.status) {
    case 'hazard': return 'Stop and stay safe first';
    case 'assessment': return 'Ready to get prices';
    case 'quotes': { const n = (r.quotes || []).length; return n ? `${count(n, 'price', 'prices')} to compare` : 'Handy is calling pros'; }
    case 'scheduling': return q ? `You approved ${q.name}` : 'Choose when the pro comes';
    case 'scheduled': return r.booking && r.booking.window ? H.when(r.booking.window.start, r.booking.window.end) : (q ? q.name : '');
    case 'complete': return q ? `By ${q.name}` : '';
    default: return '';
  }
};

const row = (r, house) => {
  const current = H.route && H.route.name === 'repair' && H.route.id === r.id;
  const word = H.statusWords[r.status] || r.status;
  const line = shortLine(r);
  const status = r.status === 'hazard'
    ? `<span class="tag red">${H.icon('alert')} ${H.esc(word)}</span>${line ? `<span>${H.esc(line)}</span>` : ''}`
    : `<span class="w">${H.esc(word)}</span>${line ? `<span class="l">${H.esc(line)}</span>` : ''}`;
  return `<div role="listitem"><a class="row st-${H.esc(r.status)}" href="#/repair/${H.esc(r.id)}" data-nav="#/repair/${H.esc(r.id)}"${current ? ' aria-current="page"' : ''}>
    <span class="si">${H.icon(ICON[r.status] || 'wrench')}</span>
    <span class="grow"><span class="t">${H.esc(r.title)}</span><span class="s">${status}</span>${house ? `<span class="hs">${H.icon('home')}${H.esc(house)}</span>` : ''}</span>${H.icon('chev')}</a></div>`;
};

/* Manager: one group per property, each with how many repairs need attention. */
const groups = (S, list) => {
  const f = filterOf(S);
  const props = (S.properties || []).filter(p => f === 'all' || p.id === f);
  return props.map(p => {
    const rs = byUrgency(list.filter(r => r.property === p.id));
    if (!rs.length) return '';
    const need = rs.filter(needsYou).length;
    const gid = `rl-g-${H.esc(p.id)}`;
    return `<section aria-labelledby="${gid}">
      <div class="rl-grp"><span class="grow"><span class="gn" id="${gid}">${H.esc(p.name)}</span><span class="gu">${H.esc(p.unit)}</span></span>
        ${need ? `<span class="need">${H.esc(count(need, 'needs you', 'need you'))}</span>` : `<span class="ok">All on track</span>`}</div>
      <div class="list" role="list" aria-labelledby="${gid}">${rs.map(r => row(r)).join('')}</div>
    </section>`;
  }).join('');
};

/* Phone only: core hides the center pane on #/, so surface the one thing waiting on the user here. */
const nowBlock = list => {
  const hazard = list.find(r => r.status === 'hazard');
  if (hazard) return `<div class="rl-now"><div class="note red">${H.icon('alert')}<span><b>${H.esc(hazard.title)}</b> may not be safe. Open it for what to do now.</span></div>
    <button type="button" class="btn danger" data-nav="#/repair/${H.esc(hazard.id)}">Open safety steps</button></div>`;
  const next = list.find(r => needsYou(r));
  if (next) return `<div class="rl-now"><p class="w"><b>Waiting on you:</b> ${next.status === 'quotes' ? 'compare prices for' : 'pick a time for'} “${H.esc(next.title)}”.</p>
    <button type="button" class="btn ghost" data-nav="#/repair/${H.esc(next.id)}">${next.status === 'quotes' ? `${H.icon('list')} Compare prices` : `${H.icon('cal')} Pick a time`}</button></div>`;
  return '';
};

/* Settings (#/settings): your houses, add a house. Same link in both apps. */
const settingsLink = () => {
  const on = H.route && H.route.name === 'settings';
  return `<a href="#/settings" data-nav="#/settings"${on ? ' aria-current="page"' : ''}>${H.icon('edit')}<span class="grow">Settings</span></a>`;
};

const failedBlock = `<div class="rl-empty"><p class="t">Couldn’t load your repairs</p><p>Check that the app is running, then try again.</p>
  <button type="button" class="btn ghost block" data-rl-retry>${H.icon('refresh')} Try again</button></div>`;

const ownerRail = S => {
  const list = byUrgency(mine());
  const homes = H.myProperties ? H.myProperties() : (S.properties || []).filter(p => p.home);
  const p1 = homes[0] || H.prop('p1');
  const many = homes.length > 1;
  const houseOf = r => { if (!many) return ''; const p = H.prop(r.property); return p ? p.name : ''; };
  const failed = loadFailed(S);
  return `
    ${failed ? '' : nowBlock(list)}
    <div class="rl-head"><h2 id="rl-h" tabindex="-1">Your repairs</h2>${list.length ? `<span class="c">${count(list.length, 'repair', 'repairs')}</span>` : ''}</div>
    ${failed ? failedBlock
      : list.length ? `<div class="list" role="list" aria-labelledby="rl-h">${list.map(r => row(r, houseOf(r))).join('')}</div>`
      : `<div class="rl-empty"><p class="t">No repairs yet</p><p>When something breaks at ${H.esc(many ? 'one of your houses' : (p1 ? p1.name : 'home'))}, send Handy a photo. It will show up here.</p><p class="rl-promise">${H.icon('shield')} Nothing is booked until you say yes.</p></div>`}
    <div class="rl-nav rl-own">${settingsLink()}</div>`;
};

const managerRail = S => {
  const all = mine();
  const f = filterOf(S);
  const shown = f === 'all' ? all : all.filter(r => r.property === f);
  const needAll = all.filter(needsYou).length;
  const route = H.route ? H.route.name : 'home';
  const failed = loadFailed(S);
  const props = S.properties || [];
  const fp = f !== 'all' ? H.prop(f) : null;
  return `
    <div class="rl-nav">
      <a href="#/" data-nav="#/"${route === 'home' ? ' aria-current="page"' : ''}>${H.icon('home')}<span class="grow">Dashboard</span>${needAll ? `<span class="cnt" aria-label="${H.esc(count(needAll, 'repair needs', 'repairs need'))} you">${needAll}</span>` : ''}</a>
      <a href="#/insights" data-nav="#/insights"${route === 'insights' ? ' aria-current="page"' : ''}>${H.icon('chart')}<span class="grow">Insights</span></a>
      ${settingsLink()}
    </div>
    ${failed ? '' : nowBlock(byUrgency(all))}
    ${props.length ? `<div class="rl-filter"><label for="rl-prop">Show repairs at</label>
      <select id="rl-prop">${[{id:'all', name:'All properties'}, ...props].map(p => `<option value="${H.esc(p.id)}"${f === p.id ? ' selected' : ''}>${H.esc(p.name)}</option>`).join('')}</select></div>` : ''}
    <div class="rl-head"><h2 id="rl-h" tabindex="-1">${fp ? 'Repairs here' : 'All repairs'}</h2>${shown.length ? `<span class="c">${count(shown.length, 'repair', 'repairs')}</span>` : ''}</div>
    ${failed ? failedBlock
      : !all.length ? `<div class="rl-empty"><p class="t">No repairs yet</p><p>When a tenant reports a problem, send Handy a photo. Repairs show up here by property.</p><p class="rl-promise">${H.icon('shield')} Nothing is booked until you say yes.</p></div>`
      : `<div class="rl-groups">${groups(S, all)}</div>${fp && !shown.length ? `<div class="rl-empty"><p class="t">Nothing reported here yet</p><p>No repairs at ${H.esc(fp.name)} so far.</p><button type="button" class="btn ghost block" data-rl-all>Show all properties</button></div>` : ''}`}`;
};

H.ui.rail = {
  render(S) {
    const mgr = H.isManager ? H.isManager() : S.role === 'manager';
    return `<div class="rl">
      <a class="rl-brand" href="#/" data-nav="#/" aria-label="Handy, ${mgr ? 'property manager' : 'your repair helper'}: go to ${mgr ? 'dashboard' : 'home'}"><div class="av">${H.icon('wrench')}</div><div><div class="n">Handy</div><div class="s">${mgr ? 'Property manager' : 'Your repair helper'}</div></div></a>
      <div class="rl-top"><button type="button" class="btn" data-nav="#/new">${H.icon('camera')} Report a problem</button></div>
      ${mgr ? managerRail(S) : ownerRail(S)}
      <div class="rl-foot">
        <div class="r1">${H.demo('Demo · simulated data')}<button type="button" class="btn plain" data-rl-reset>Start over</button></div>
        <a class="rl-switch" href="/app/">${H.icon('user')} Switch app</a>
      </div>
    </div>`;
  },
  bind(root) {
    const S = H.state;
    const sel = root.querySelector('#rl-prop');
    if (sel) sel.addEventListener('change', () => { S.propertyFilter = sel.value; H.saveUi(); H.render(); refocus('#rl-prop'); });
    const all = root.querySelector('[data-rl-all]');
    if (all) all.addEventListener('click', () => { S.propertyFilter = 'all'; H.saveUi(); H.render(); refocus('#rl-prop'); });
    const retry = root.querySelector('[data-rl-retry]');
    if (retry) retry.addEventListener('click', async () => { await H.refresh(); refocus(loadFailed(H.state) ? '[data-rl-retry]' : '#rl-h'); });
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

function openReset() {
  H.sheet('Start over?', `
    <p style="margin:0 0 12px">This puts everything back to the starting point: the sample repairs at Maple House and Oak Street Duplex.</p>
    <div class="note amber" style="margin-bottom:16px">${H.icon('alert')}<span>Any repairs, prices, approvals and bookings you made will be removed. Nothing real is affected: no pros are called and nothing is cancelled.</span></div>
    <p class="msg" role="alert" hidden style="color:var(--red);margin:0 0 12px"></p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button type="button" class="btn" data-confirm>${H.icon('refresh')} Start over</button>
      <button type="button" class="btn ghost" data-cancel>Keep everything</button>
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
        H.toast('Back to the starting point.');
      } catch (e) {
        go.disabled = false; go.innerHTML = `${H.icon('refresh')} Try again`;
        msg.textContent = e.message; msg.hidden = false;
      }
    });
  });
}
})();
