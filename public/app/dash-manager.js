/* dash-manager.js — #/ for the property-manager app (manager.html).
   Portfolio dashboard: what needs the manager, each property at a glance, this week's visits,
   approved spend per property, and the report → booked funnel. Registers H.ui.dashboard.manager. */
(function(){
const H = window.H;
if (!H) return;

/* ---------- Module CSS (injected once) ---------- */
const CSS = `
.center-inner:has(> .md){max-width:1240px}
.md{container:md/inline-size;padding:24px 16px 40px;display:flex;flex-direction:column;gap:32px}
.md h1{font-size:28px;line-height:1.15;margin:0;text-wrap:balance;letter-spacing:-.01em}
.md h2{font-size:20px;line-height:1.25;margin:0;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.md h2 .md-n{font-size:15px;font-weight:700;color:var(--ink2);font-variant-numeric:tabular-nums}
.md .md-sub{font-size:15px;color:var(--ink2);margin:4px 0 0}
.md-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap}
.md-head .md-sum{font-size:18px;color:var(--ink2);margin:6px 0 0;font-variant-numeric:tabular-nums}
.md-head .md-sum b{color:var(--ink)}
.md-head .md-sum .hot{color:var(--red)}
.md-chip{display:inline-flex;align-items:center;gap:6px;margin-top:12px;min-height:48px;padding:0 6px 0 16px;border-radius:var(--r-pill);background:var(--green-tint);color:var(--green);font-weight:700;font-size:16px}
.md-chip button{width:40px;height:40px;border:0;border-radius:50%;background:none;color:var(--green);display:grid;place-items:center;cursor:pointer}
.md-chip button:hover{background:#fff}
.md-chip button .ic{width:18px;height:18px}
.md-btn{min-height:48px;padding:0 18px;border:0;border-radius:14px;background:var(--green);color:#fff;font-weight:700;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap;flex:none}
.md-btn:hover{background:var(--green-press)}
.md-btn .ic{width:20px;height:20px}
.md-btn.alt{background:#fff;color:var(--green);border:1.5px solid var(--green)}
.md-btn.alt:hover{background:var(--green-tint)}
.md-btn.danger{background:var(--red)}
.md-btn.danger:hover{background:#7D2213}
.md-btn[disabled]{background:var(--line);color:var(--ink3);border-color:var(--line);cursor:progress}
.md-link{min-height:48px;padding:0 4px;border:0;background:none;color:var(--green);font-weight:700;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1.5px}
.md-link .ic{width:18px;height:18px}
.md-panel{background:#fff;border:1px solid var(--line);border-radius:var(--r-card);padding:18px 20px}
.md-sec{display:flex;flex-direction:column;gap:14px;min-width:0}

/* Needs you */
.md-need{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.md-need li{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid var(--line)}
.md-need .ico{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--amber-tint);color:var(--amber)}
.md-need .ico.red{background:var(--red-tint);color:var(--red)}
.md-need .ico.calm{background:var(--green-tint);color:var(--green)}
.md-need .txt{flex:1;min-width:0}
.md-need .t{font-weight:700;overflow-wrap:anywhere}
.md-need .s{font-size:15px;color:var(--ink2)}
.md-need li.hz .s{color:#7D2213}
@container md (max-width:539px){.md-need li{flex-wrap:wrap}.md-need li .md-btn{flex:1 1 100%;margin-left:58px}}
.md-calm{display:flex;align-items:center;gap:12px;padding:14px 0;color:var(--ink2);border-top:1px solid var(--line)}
.md-calm .ico{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;flex:none;background:var(--green-tint);color:var(--green)}

/* Visits */
.md-vis{list-style:none;margin:0;padding:0;border-top:1px solid var(--line)}
.md-vis li{border-bottom:1px solid var(--line)}
.md-vis button{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:12px;align-items:center;width:100%;min-height:64px;padding:12px 4px;border:0;background:none;text-align:left;cursor:pointer;border-radius:10px}
.md-vis button:hover{background:var(--pinned)}
.md-vis .d{display:flex;flex-direction:column;align-items:center;line-height:1.1;padding:6px 0;border-radius:12px;background:var(--green-tint);color:var(--green)}
.md-vis .d small{font-size:13px;font-weight:700}
.md-vis .d b{font-size:20px;font-variant-numeric:tabular-nums}
.md-vis .t{font-weight:700;overflow-wrap:anywhere}
.md-vis .s{font-size:15px;color:var(--ink2)}
.md-vis .p{font-weight:700;font-variant-numeric:tabular-nums}
.md-more{font-size:15px;color:var(--ink2);margin:0}

/* Properties */
.md-props{display:grid;grid-template-columns:1fr;gap:16px}
.md-prop{display:flex;flex-direction:column;gap:14px}
.md-prop .nm{font-size:19px;font-weight:800;line-height:1.2}
.md-prop .ad{font-size:15px;color:var(--ink2);display:flex;flex-direction:column;gap:2px;margin-top:4px}
.md-prop .ad span{display:inline-flex;align-items:center;gap:6px}
.md-prop .ad .ic{width:16px;height:16px;color:var(--ink3)}
.md-cnt{display:grid;grid-template-columns:repeat(3,1fr);margin:0;padding:10px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.md-cnt div{display:flex;flex-direction:column;align-items:flex-start;padding:0 12px}
.md-cnt div+div{border-left:1px solid var(--line)}
.md-cnt div:first-child{padding-left:0}
.md-cnt dt{font-size:14px;color:var(--ink2);order:2}
.md-cnt dd{margin:0;font-size:24px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.1;order:1}
.md-cnt dd.z{color:var(--ink3)}
.md-rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.md-rows button{display:flex;align-items:center;gap:10px;width:100%;min-height:56px;padding:10px 4px;border:0;background:none;text-align:left;cursor:pointer;border-radius:10px}
.md-rows li+li button{border-top:1px solid var(--line);border-radius:0}
.md-rows button:hover{background:var(--pinned)}
.md-rows .tw{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:4px}
.md-rows .t{font-weight:700;font-size:16px;overflow-wrap:anywhere;line-height:1.3}
.md-rows .ic.go{width:18px;height:18px;color:var(--ink3)}
.md-none{font-size:15px;color:var(--ink3);margin:0;padding:6px 0}
.md-prop .md-btn{margin-top:auto;width:100%}
.md-st{display:inline-flex;align-items:center;font-size:14px;font-weight:700;padding:3px 10px;border-radius:var(--r-pill);background:var(--pinned);color:var(--ink2);white-space:nowrap;flex:none}
.md-st.amber{background:var(--amber-tint);color:var(--amber)}
.md-st.green{background:var(--green-tint);color:var(--green)}
.md-st.red{background:var(--red-tint);color:var(--red)}

/* Charts */
.md-bars{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.md-bars li{display:grid;grid-template-columns:minmax(110px,38%) minmax(0,1fr);align-items:center;gap:12px;min-height:40px;border-radius:10px;padding:0 6px;margin:0 -6px}
.md-bars li:hover{background:var(--pinned)}
.md-bars .lb{font-size:15px;font-weight:700;overflow-wrap:anywhere;line-height:1.25}
.md-bars .tr{display:flex;align-items:center;gap:10px;min-width:0}
.md-bars .bar{height:16px;border-radius:0 4px 4px 0;background:var(--green);flex:none}
.md-bars .bar.zero{width:2px!important;border-radius:0;background:var(--ink3)}
.md-bars .v{font-size:15px;color:var(--ink2);font-variant-numeric:tabular-nums;white-space:nowrap}
.md-bars .v b{color:var(--ink);font-size:16px;margin-right:4px}
.md-bars.fun li{grid-template-columns:96px minmax(0,1fr)}
.md-cap{display:flex;flex-wrap:wrap;gap:8px;align-items:center;font-size:15px;color:var(--ink2)}
.md-tot{font-size:15px;color:var(--ink2);margin:0}
.md-tot b{font-size:22px;color:var(--ink);font-variant-numeric:tabular-nums;margin-right:6px}

/* Empty portfolio */
.md-empty{display:flex;flex-direction:column;align-items:flex-start;gap:8px}
.md-empty p{margin:0;color:var(--ink2);max-width:52ch}
.md-empty .md-btn{margin-top:8px}

/* Wide center pane: dense dashboard */
.md-top,.md-duo{display:flex;flex-direction:column;gap:24px}
@container md (min-width:720px){
  .md{padding:28px 28px 48px}
  .md h1{font-size:32px}
  .md-props{grid-template-columns:repeat(2,minmax(0,1fr))}
  .md-duo{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start}
}
@container md (min-width:980px){
  .md-top{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:24px;align-items:start}
  .md-props{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media (prefers-reduced-motion:no-preference){.md-bars .bar{transition:width .5s cubic-bezier(.16,1,.3,1)}}
`;
if (!document.getElementById('css-dash-manager')) {
  const s = document.createElement('style'); s.id = 'css-dash-manager'; s.textContent = CSS; document.head.appendChild(s);
}

/* ---------- Data helpers ---------- */
const DAY = 86400000;
const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
const open = r => r.status !== 'complete';
const approvedCents = r => (r.approval && ['scheduling','scheduled','complete'].includes(r.status)) ? (r.approval.amountCents || 0) : 0;
const visitOf = r => r.status === 'scheduled' && r.booking && r.booking.window ? r.booking.window : null;
const shortDay = iso => new Date(iso).toLocaleDateString('en-US', {weekday:'short'});
const dayNum = iso => new Date(iso).getDate();
const timeRange = w => H.when(w.start, w.end).split(' · ')[1] || '';
const statusTag = r => {
  if (r.status === 'hazard') return `<span class="md-st red">${H.esc(H.statusWords.hazard)}</span>`;
  if (r.status === 'quotes') return `<span class="md-st amber">${H.esc(H.statusWords.quotes)}</span>`;
  if (r.status === 'scheduling') return `<span class="md-st amber">${H.esc(r.approval && r.booking ? 'New time needed' : H.statusWords.scheduling)}</span>`;
  if (r.status === 'scheduled') { const w = visitOf(r); return `<span class="md-st green">${H.esc(w ? 'Booked · ' + new Date(w.start).toLocaleDateString('en-US', {weekday:'short'}) + ' ' + H.time(w.start).replace(':00','') : H.statusWords.scheduled)}</span>`; }
  if (r.status === 'complete') return `<span class="md-st green">${H.esc(H.statusWords.complete)}</span>`;
  return `<span class="md-st">${H.esc(r.quotes && r.quotes.length ? H.statusWords.quotes : 'No prices yet')}</span>`;
};
const cheapest = r => (r.quotes || []).reduce((m, q) => m == null || q.amountCents < m ? q.amountCents : m, null);

/* What needs the manager, most urgent first. Each item has exactly one action. */
const needsYou = (repairs, prop) => {
  const out = [];
  repairs.forEach(r => {
    const p = prop(r.property), where = p ? p.name : '';
    if (r.status === 'hazard') out.push({r, rank:0, cls:'hz', ico:'alert', icoCls:'red', sub:`${where} · Possible safety risk. Act on it now.`, act:'See safety steps', kind:'nav', btn:'danger'});
    else if (r.status === 'quotes' && !r.approval) {
      const n = (r.quotes || []).length, low = cheapest(r);
      out.push({r, rank:1, ico:'doc', sub:`${where} · ${n ? `${plural(n, 'price')} waiting for your yes${low != null ? `, from ${H.money(low)}` : ''}` : 'No prices came back. Try again.'}`, act:'Choose a pro', kind:'nav'});
    }
    else if (r.status === 'scheduling') out.push({r, rank:2, ico:'cal', sub:`${where} · ${r.booking ? 'Visit moved. Pick a new time.' : 'Approved. Pick a time for the visit.'}`, act:'Pick a time', kind:'nav'});
    else if (r.status === 'assessment' && !(r.quotes || []).length) out.push({r, rank:3, ico:'phone', icoCls:'calm', sub:`${where} · Handy hasn’t asked for prices yet.`, act:'Get prices', kind:'quotes', btn:'alt'});
  });
  return out.sort((a, b) => a.rank - b.rank || Date.parse(b.r.updatedAt || 0) - Date.parse(a.r.updatedAt || 0));
};

/* ---------- Sections ---------- */
const head = (S, props, repairs, needs, weekVisits, filtered) => {
  const openN = repairs.filter(open).length, hz = needs.filter(n => n.rank === 0).length;
  const parts = [
    `<b>${plural(props.length, 'property', 'properties')}</b>`,
    `<b>${openN}</b> open ${openN === 1 ? 'repair' : 'repairs'}`,
    needs.length ? `<b class="${hz ? 'hot' : ''}">${needs.length}</b> ${needs.length === 1 ? 'needs' : 'need'} you` : 'nothing needs you',
    `<b>${weekVisits}</b> ${weekVisits === 1 ? 'visit' : 'visits'} this week`
  ];
  return `<div class="md-head"><div>
      <h1>Your properties</h1>
      <p class="md-sum">${parts.join(' · ')}</p>
      ${filtered ? `<div class="md-chip">Showing ${H.esc(filtered.name)}<button type="button" data-md-clear aria-label="Show all properties">${H.icon('x')}</button></div>` : ''}
    </div>
    <button type="button" class="md-btn" data-md-report="${H.esc(filtered ? filtered.id : '')}">${H.icon('plus')}Report a problem</button>
  </div>`;
};

const needsSection = needs => `<section class="md-sec md-panel" aria-labelledby="md-need-h">
  <h2 id="md-need-h">Needs you ${needs.length ? `<span class="md-n">${needs.length}</span>` : ''}</h2>
  ${needs.length ? `<ul class="md-need">${needs.map(n => `<li class="${n.cls || ''}">
      <span class="ico ${n.icoCls || ''}">${H.icon(n.ico)}</span>
      <div class="txt"><div class="t">${H.esc(n.r.title)}</div><div class="s">${H.esc(n.sub)}</div></div>
      ${n.kind === 'quotes'
        ? `<button type="button" class="md-btn ${n.btn || ''}" data-md-quotes="${H.esc(n.r.id)}">${H.esc(n.act)}</button>`
        : `<button type="button" class="md-btn ${n.btn || ''}" data-nav="#/repair/${H.esc(n.r.id)}" aria-label="${H.esc(n.act + ': ' + n.r.title)}">${H.esc(n.act)}</button>`}
    </li>`).join('')}</ul>`
  : `<div class="md-calm"><span class="ico">${H.icon('check')}</span><span>Nothing needs you right now. Handy will put new prices and safety alerts here.</span></div>`}
</section>`;

const visitsSection = (visits, later, prop) => `<section class="md-sec md-panel" aria-labelledby="md-vis-h">
  <h2 id="md-vis-h">This week’s visits ${visits.length ? `<span class="md-n">${visits.length}</span>` : ''}</h2>
  ${visits.length ? `<ul class="md-vis">${visits.map(({r, w}) => { const p = prop(r.property); return `<li>
      <button type="button" data-nav="#/repair/${H.esc(r.id)}">
        <span class="d" aria-hidden="true"><small>${H.esc(shortDay(w.start))}</small><b>${dayNum(w.start)}</b></span>
        <span><span class="t">${H.esc(r.title)}</span><br><span class="s">${H.esc(timeRange(w))} · ${H.esc(p ? p.name : '')} · ${H.esc(r.approval ? r.approval.providerName : '')}</span></span>
        <span class="p">${H.esc(H.money(r.booking.amountCents ?? (r.approval && r.approval.amountCents)))}</span>
      </button></li>`; }).join('')}</ul>`
  : `<p class="md-none">No visits booked for the next 7 days.</p>`}
  ${later ? `<p class="md-more">${plural(later, 'more visit')} booked after this week.</p>` : ''}
</section>`;

const propBlock = (p, repairs) => {
  const mine = repairs.filter(r => r.property === p.id);
  const active = mine.filter(open);
  const booked = mine.filter(r => r.status === 'scheduled').length, fixed = mine.filter(r => r.status === 'complete').length;
  const cnt = (n, label) => `<div><dd class="${n ? '' : 'z'}">${n}</dd><dt>${label}</dt></div>`;
  return `<section class="md-prop md-panel" aria-label="${H.esc(p.name)}">
    <div><div class="nm">${H.esc(p.name)}</div>
      <div class="ad"><span>${H.icon('pin')}${H.esc(p.address)} · ${H.esc(p.unit)}</span><span>${H.icon('user')}Tenant: ${H.esc(p.tenant)}</span></div></div>
    <dl class="md-cnt">${cnt(active.length, 'Open')}${cnt(booked, 'Booked')}${cnt(fixed, 'Fixed')}</dl>
    ${active.length ? `<ul class="md-rows">${active.map(r => `<li><button type="button" data-nav="#/repair/${H.esc(r.id)}">
        <span class="tw"><span class="t">${H.esc(r.title)}</span>${statusTag(r)}</span>${H.icon('chev', 'go')}</button></li>`).join('')}</ul>`
      : `<p class="md-none">No open repairs here.</p>`}
    <button type="button" class="md-btn alt" data-md-report="${H.esc(p.id)}">${H.icon('camera')}Report a problem here</button>
  </section>`;
};

const spendSection = (props, repairs) => {
  const rows = props.map(p => {
    const list = repairs.filter(r => r.property === p.id && approvedCents(r) > 0);
    return { p, cents: list.reduce((s, r) => s + approvedCents(r), 0), n: list.length };
  });
  const max = Math.max(0, ...rows.map(x => x.cents)), total = rows.reduce((s, x) => s + x.cents, 0);
  return `<section class="md-sec md-panel" aria-labelledby="md-sp-h">
    <h2 id="md-sp-h">Spend</h2>
    <div class="md-cap">Approved and booked prices per property ${H.demo('Demo · simulated prices')}</div>
    <p class="md-tot"><b>${H.esc(H.money(total) || '$0')}</b>approved in total</p>
    <ul class="md-bars" role="list">${rows.map(x => {
      const pct = max ? Math.max(2, Math.round(x.cents / max * 100)) : 0;
      const tip = `${x.p.name}: ${H.money(x.cents) || '$0'} approved across ${plural(x.n, 'repair')}`;
      return `<li title="${H.esc(tip)}"><span class="lb">${H.esc(x.p.name)}</span>
        <span class="tr"><span class="bar ${x.cents ? '' : 'zero'}" style="width:calc((100% - 128px) * ${pct / 100})" aria-hidden="true"></span>
        <span class="v"><b>${H.esc(H.money(x.cents) || '$0')}</b>${x.n ? H.esc(plural(x.n, 'repair')) : ''}</span></span>
        <span class="sr">${H.esc(tip)}</span></li>`;
    }).join('')}</ul>
  </section>`;
};

const funnelSection = (m, filtered) => {
  const steps = m ? [['Reported', m.issuesSubmitted], ['Prices', m.quotedRepairs], ['Approved', m.approvedRepairs], ['Booked', m.confirmedAppointments]] : [];
  const max = Math.max(0, ...steps.map(s => s[1] || 0));
  return `<section class="md-sec md-panel" aria-labelledby="md-fn-h">
    <h2 id="md-fn-h">From report to booked</h2>
    <div class="md-cap">Repairs at each step${filtered ? ', all properties' : ''} ${H.demo('Demo · local events')}</div>
    ${m ? `<ul class="md-bars fun" role="list">${steps.map(([label, n]) => {
      const v = n || 0, pct = max ? Math.max(2, Math.round(v / max * 100)) : 0;
      return `<li title="${H.esc(`${label}: ${plural(v, 'repair')}`)}"><span class="lb">${H.esc(label)}</span>
        <span class="tr"><span class="bar ${v ? '' : 'zero'}" style="width:calc((100% - 128px) * ${pct / 100})" aria-hidden="true"></span>
        <span class="v"><b>${v}</b>${v === 1 ? 'repair' : 'repairs'}</span></span></li>`;
    }).join('')}</ul>` : `<p class="md-none">Numbers will show up after the first report.</p>`}
    <div><button type="button" class="md-link" data-nav="#/insights">See all insights${H.icon('arrow')}</button></div>
  </section>`;
};

/* ---------- Render ---------- */
const render = S => {
  const allProps = S.properties || [];
  const f = S.propertyFilter || 'all';
  const filtered = f !== 'all' ? allProps.find(p => p.id === f) || null : null;
  const props = filtered ? [filtered] : allProps;
  const ids = new Set(props.map(p => p.id));
  const repairs = (H.myRepairs ? H.myRepairs() : S.repairs || []).filter(r => ids.has(r.property));
  const prop = id => allProps.find(p => p.id === id);
  const needs = needsYou(repairs, prop);
  const now = Date.now();
  const upcoming = repairs.map(r => ({r, w: visitOf(r)})).filter(x => x.w && Date.parse(x.w.end || x.w.start) > now)
    .sort((a, b) => Date.parse(a.w.start) - Date.parse(b.w.start));
  const week = upcoming.filter(x => Date.parse(x.w.start) < now + 7 * DAY), later = upcoming.length - week.length;

  if (!repairs.length) {
    return `<div class="page md">
      ${head(S, props, repairs, needs, 0, filtered)}
      <section class="md-empty md-panel" aria-labelledby="md-em-h">
        <h2 id="md-em-h">No repairs yet${filtered ? ` at ${H.esc(filtered.name)}` : ''}</h2>
        <p>When a tenant or you report a problem, Handy gets prices from local pros and lists everything that needs your yes right here.</p>
        <button type="button" class="md-btn" data-md-report="${H.esc(filtered ? filtered.id : '')}">${H.icon('camera')}Report the first problem</button>
      </section>
      <section class="md-sec" aria-label="Properties"><h2>Properties <span class="md-n">${props.length}</span></h2>
        <div class="md-props">${props.map(p => propBlock(p, repairs)).join('')}</div></section>
    </div>`;
  }

  return `<div class="page md">
    ${head(S, props, repairs, needs, week.length, filtered)}
    <div class="md-top">${needsSection(needs)}${visitsSection(week, later, prop)}</div>
    <section class="md-sec" aria-labelledby="md-pr-h"><h2 id="md-pr-h">Properties <span class="md-n">${props.length}</span></h2>
      <div class="md-props">${props.map(p => propBlock(p, repairs)).join('')}</div></section>
    <div class="md-duo">${spendSection(props, repairs)}${funnelSection(S.metrics, filtered)}</div>
  </div>`;
};

/* ---------- Bind ---------- */
const bind = root => {
  root.querySelectorAll('[data-md-report]').forEach(b => b.addEventListener('click', () => {
    const id = b.getAttribute('data-md-report');
    try { if (id) sessionStorage.setItem('handy-report-property', id); else sessionStorage.removeItem('handy-report-property'); } catch {}
    H.go('#/new');
  }));
  root.querySelectorAll('[data-md-clear]').forEach(b => b.addEventListener('click', () => {
    H.state.propertyFilter = 'all'; H.saveUi(); H.render();
    const h = document.querySelector('.md h1'); if (h) { h.tabIndex = -1; h.focus({preventScroll:true}); }
  }));
  root.querySelectorAll('[data-md-quotes]').forEach(b => b.addEventListener('click', async () => {
    const r = H.repair(b.getAttribute('data-md-quotes')); if (!r || H.state.busy) return;
    b.disabled = true; b.textContent = 'Getting prices…';
    const next = await H.autopilot(r);
    if (next && next.status === 'quotes') H.toast(`Prices are in for ${next.title}.`);
  }));
};

H.ui = H.ui || {};
H.ui.dashboard = H.ui.dashboard || {};
H.ui.dashboard.manager = { render, bind };
})();
