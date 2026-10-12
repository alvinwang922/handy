/* insights.js — #/insights for property managers. Plain-language summary, a report→booked funnel,
   a definition list of the remaining demo metrics, and a per-property table built from H.state.repairs. */
(function(){
const H = window.H;
if (!H) return;

/* ---------- Module CSS (injected once) ---------- */
const CSS = `
.ins .lead.sum{font-size:20px;line-height:1.4;color:var(--ink);margin:0 0 12px;max-width:40ch;text-wrap:pretty}
.ins .labels{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 8px}
.ins .src{font-size:15px;color:var(--ink2);margin:0 0 4px;max-width:65ch}
.ins h2{font-size:20px;margin:36px 0 4px}
.ins h2 + .sub{font-size:15px;color:var(--ink2);margin:0 0 16px}
.ins .fun{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.ins .fun li{display:grid;grid-template-columns:120px minmax(0,1fr);align-items:center;gap:16px;padding:10px 8px;border-radius:12px}
.ins .fun .lb{font-weight:700}
.ins .fun .tr{display:flex;align-items:center;gap:12px;min-width:0}
.ins .fun .bar{height:14px;border-radius:0 4px 4px 0;background:var(--green);flex:none;min-width:0}
.ins .fun .bar.zero{width:2px!important;background:var(--line)}
.ins .fun .v{font-variant-numeric:tabular-nums;white-space:nowrap;font-size:15px;color:var(--ink2)}
.ins .fun .v b{font-size:17px;color:var(--ink);margin-right:4px}
.ins dl{margin:0;display:grid;grid-template-columns:minmax(0,1fr) auto;border-top:1px solid var(--line)}
.ins dt,.ins dd{margin:0;padding:14px 0;border-bottom:1px solid var(--line)}
.ins dt{color:var(--ink2);padding-right:16px}
.ins dd{font-weight:700;text-align:right;font-variant-numeric:tabular-nums}
.ins dd.na{font-weight:400;color:var(--ink3)}
.ins table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
.ins th,.ins td{padding:12px 8px;border-bottom:1px solid var(--line);text-align:right;vertical-align:middle}
.ins th:first-child,.ins td:first-child{text-align:left;padding-left:0}
.ins th:last-child,.ins td:last-child{padding-right:0}
.ins thead th{font-size:15px;color:var(--ink2);font-weight:600}
.ins tbody th{font-weight:700}
.ins tbody th small{display:block;font-weight:400;font-size:15px;color:var(--ink2)}
.ins tfoot td,.ins tfoot th{font-weight:700;border-bottom:0}
.ins .yes{min-height:48px;padding:0 14px;border:1.5px solid var(--green);background:#fff;color:var(--green);border-radius:var(--r-pill);font-weight:700;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.ins .yes:hover{background:var(--green-tint)}
.ins .yes .ic{width:18px;height:18px}
.ins .zero{color:var(--ink3)}
.ins .empty{padding-top:8px}
.ins.empty .btn,.ins.role .btn{flex:none;margin-top:20px}
.ins .note{margin-top:28px}
@media (max-width:639px){
  .ins .lead.sum{font-size:18px}
  .ins .fun li{grid-template-columns:96px minmax(0,1fr);gap:10px;padding:10px 4px}
  .ins th,.ins td{padding:12px 4px}
  .ins thead th{font-size:14px}
  .ins .yes{padding:0 10px}
}`;
if (!document.getElementById('css-insights')) {
  const s = document.createElement('style'); s.id = 'css-insights'; s.textContent = CSS; document.head.appendChild(s);
}

/* ---------- Formatting ---------- */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const pct = v => v == null ? null : Math.round(v * 100) + '%';
const duration = s => {
  if (s == null || !isFinite(s)) return null;
  if (s < 1) return 'Under a second';
  if (s < 60) return plural(Math.round(s), 'second', 'seconds');
  if (s < 3600) return plural(Math.round(s / 60), 'minute', 'minutes');
  if (s < 86400) { const h = Math.round(s / 360) / 10; return `${h} ${h === 1 ? 'hour' : 'hours'}`; }
  const d = Math.round(s / 8640) / 10; return `${d} ${d === 1 ? 'day' : 'days'}`;
};
const num = v => Number.isFinite(+v) ? +v : 0;

const summary = m => {
  const n = num(m.issuesSubmitted), q = num(m.quotedRepairs), b = num(m.confirmedAppointments);
  const head = `Handy handled ${plural(n, 'repair', 'repairs')}`;
  if (!q && !b) return `${head}. None ${n === 1 ? 'has' : 'have'} prices yet.`;
  return `${head}: ${q} got prices, ${b} ${b === 1 ? 'was' : 'were'} booked.`;
};

/* ---------- Pieces ---------- */
const funnel = m => {
  const steps = [['Reported', num(m.issuesSubmitted)], ['Got prices', num(m.quotedRepairs)], ['Approved', num(m.approvedRepairs)], ['Booked', num(m.confirmedAppointments)]];
  const max = Math.max(1, ...steps.map(s => s[1])), base = steps[0][1];
  return `<ol class="fun" aria-label="Repairs at each step">${steps.map(([label, v], i) => {
    const w = Math.round(v / max * 100);
    const of = i && base ? ` <span>of ${base}</span>` : '';
    return `<li><span class="lb">${label}</span><span class="tr"><span class="bar${v ? '' : ' zero'}" style="width:calc((100% - 64px) * ${w / 100})" aria-hidden="true"></span><span class="v"><b>${v}</b>${of}</span></span></li>`;
  }).join('')}</ol>`;
};

const details = m => {
  const rows = [
    ['Repairs with two or more prices', m.multipleQuoteRepairs == null ? null : String(num(m.multipleQuoteRepairs)), 'Not enough data yet'],
    ['Calls to pros that got an answer', m.providerResponseRate == null ? null : `${pct(m.providerResponseRate)} of calls answered`, 'Not enough data yet'],
    ['Approved repairs that got booked', pct(m.quoteToBookingConversion), 'Not enough data yet'],
    ['Typical wait for the first price', duration(m.medianTimeToFirstQuoteSeconds), 'Not enough data yet'],
    ['Typical time from your yes to booked', duration(m.medianApprovalToBookingSeconds), 'Not enough data yet'],
    ['Your time spent coordinating', m.activeCoordinationTime == null ? null : duration(m.activeCoordinationTime), 'Not measured in the demo']
  ];
  return `<dl>${rows.map(([k, v, na]) => `<dt>${k}</dt><dd class="${v == null ? 'na' : ''}">${H.esc(v == null ? na : v)}</dd>`).join('')}</dl>`;
};

const byProperty = S => {
  const props = S.properties || [];
  const rows = props.map(p => {
    const rs = S.repairs.filter(r => r.property === p.id);
    const open = rs.filter(r => r.status !== 'complete').length;
    const booked = rs.filter(r => r.status === 'scheduled').length;
    const waiting = rs.filter(r => r.status === 'quotes' && !r.approval);
    return {p, open, booked, waiting};
  });
  const known = new Set(props.map(p => p.id));
  const other = S.repairs.filter(r => !known.has(r.property));
  const tot = k => rows.reduce((a, r) => a + (k === 'waiting' ? r.waiting.length : r[k]), 0);
  const cell = n => `<td${n ? '' : ' class="zero"'}>${n}</td>`;
  const yes = w => !w.length ? `<td class="zero">0</td>` :
    `<td><button class="yes" data-nav="#/repair/${H.esc(w[0].id)}" aria-label="${H.esc(plural(w.length, 'repair needs', 'repairs need'))} your yes. Open ${H.esc(w[0].title)}">${w.length}${H.icon('chev')}</button></td>`;
  return `<table>
    <caption class="sr">Repairs by property</caption>
    <thead><tr><th scope="col">Property</th><th scope="col">Open repairs</th><th scope="col">Booked</th><th scope="col">Needs your yes</th></tr></thead>
    <tbody>${rows.map(r => `<tr><th scope="row">${H.esc(r.p.name)}<small>${H.esc(r.p.unit || r.p.address || '')}</small></th>${cell(r.open)}${cell(r.booked)}${yes(r.waiting)}</tr>`).join('')}</tbody>
    ${rows.length > 1 ? `<tfoot><tr><th scope="row">All properties</th>${cell(tot('open'))}${cell(tot('booked'))}${cell(tot('waiting'))}</tr></tfoot>` : ''}
  </table>${other.length ? `<p class="src">${plural(other.length, 'repair is', 'repairs are')} not linked to a known property.</p>` : ''}`;
};

/* ---------- Module ---------- */
let loading = false;
/* Re-render without losing keyboard focus: H.render() redraws the page (and header), so if focus
   ends up on <body> afterwards, move it to the new heading. Focus that survived the redraw is left alone. */
const rerender = () => {
  H.render();
  const a = document.activeElement;
  if (a && a !== document.body) return;
  const h = document.querySelector('.ins h1');
  if (h) { h.tabIndex = -1; h.focus({preventScroll: true}); }
};
H.ui.insights = {
  render(S){
    if (S.role !== 'manager') return `<div class="page ins role">
      <h1>Insights are for property managers</h1>
      <p class="lead">They show how repairs are going across all your rentals. Switch to the manager view to see them.</p>
      <button class="btn" data-ins-role>${H.icon('home')} I manage rentals</button>
    </div>`;
    const m = S.metrics || {};
    const empty = !S.repairs.length && !num(m.issuesSubmitted);
    const labels = `<div class="labels">${H.modeTag('Demo · local metrics, simulated calls')}</div>
      ${m.note ? `<p class="src">${H.esc(m.note)}</p>` : ''}`;
    if (empty) return `<div class="page ins empty">
      <h1>No repairs yet</h1>
      <p class="lead">Once you report a problem, you’ll see here how many got prices and how many are booked.</p>
      ${labels}
      <button class="btn" data-nav="#/new">${H.icon('camera')} Report a problem</button>
    </div>`;
    return `<div class="page ins">
      <h1>How repairs are going</h1>
      <p class="lead sum">${H.esc(summary(m))}</p>
      ${labels}
      <h2>From report to booked</h2>
      <p class="sub">Every repair reported so far, counted once it reached each step.</p>
      ${funnel(m)}
      <h2>By property</h2>
      <p class="sub">Repairs as they stand right now.</p>
      ${byProperty(S)}
      <h2>More detail</h2>
      <p class="sub">Times are typical (the middle value). In the demo, calls finish instantly.</p>
      ${details(m)}
    </div>`;
  },
  bind(root){
    const b = root.querySelector('[data-ins-role]');
    if (b) b.addEventListener('click', () => { H.state.role = 'manager'; H.saveUi(); rerender(); });
    /* Refresh once per visit: core sets H._lastRoute after the first bind of a route. */
    if (H._lastRoute === location.hash || loading) return;
    loading = true;
    H.api('GET', '/api/analytics')
      .then(d => { if (d && d.metrics) H.state.metrics = d.metrics; })
      .catch(() => {})
      .finally(() => { loading = false; if (H.route && H.route.name === 'insights') rerender(); });
  }
};
})();
