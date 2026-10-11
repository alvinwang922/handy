/* Handy webapp — coordinator-owned core. Shared contract for every module:
   - H.api(method, path, body?)  → Promise<json>; throws Error(message) with .status on 4xx/5xx or network failure.
   - H.state = {repairs, properties, metrics, integrations, actor, role:'owner'|'manager', propertyFilter:'all'|'p1'.., busy:false, error:null}
   - H.refresh()                 → reloads /api/bootstrap into H.state, then H.render().
   - H.upsert(repair)            → replace one repair in H.state.repairs (use the server response after every mutation), then H.render().
   - H.mutate(id, action, body)  → POST /api/repairs/:id/:action with busy handling, upsert, and error display. Returns repair or null.
   - Router: hash routes  #/  ·  #/new  ·  #/repair/<id>  ·  #/insights.  H.go(hash).  H.route = {name, id}.
   - Regions rendered by modules (each returns an HTML string; optional bind(root) attaches events):
       H.ui.rail      = {render(state) , bind(root)}                       → rail.js
       H.ui.report    = {render(state) , bind(root)}                       → report.js   (#/new)
       H.ui.insights  = {render(state) , bind(root)}                       → insights.js (#/insights)
       H.ui.details   = {render(repair, state), bind(root, repair)}        → details.js  (right panel for #/repair/<id>)
       H.ui.home      = {render(state) , bind(root)}                       → rail.js     (#/ center: welcome / empty state)
     Thread for #/repair/<id> = core pin + concatenated history parts + the dock of the part that owns repair.status:
       H.part(name, {history(repair) → html|'' , owns:[statuses], dock(repair) → html, bind(root, repair)})
       Parts render in this order: intake, assessment (assess.js) · quotes (quotes.js) · scheduling, booked (booking.js)
   - Helpers: H.icon(name), H.esc(text) (ALWAYS escape user/server text), H.money(cents), H.when(isoStart, isoEnd),
     H.h(html) Handy bubble, H.u(html) user bubble, H.typing(), H.demo(label), H.sheet(title, html, bind) modal dialog,
     H.toast(msg), H.prop(id), H.statusWords[status], H.later(ms, fn) timer cancelled on re-render/navigation,
     H.scrollToEnd() keeps the newest thread content visible above the dock (call after live DOM updates). */
(function(){
const H = window.H = {};

/* ---------- Icons ---------- */
const P = {
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  check:'<path d="M20 6 9 17l-5-5"/>', shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  back:'<path d="m15 18-6-6 6-6"/>', chev:'<path d="m9 18 6-6-6-6"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  camera:'<path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', send:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', home:'<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>', pin:'<path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>', list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', doc:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  chart:'<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>', refresh:'<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  star:'<path fill="currentColor" stroke="none" d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>'
};
H.icon = (n, cls='') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||''}</svg>`;

/* ---------- Formatting ---------- */
H.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
H.money = cents => cents == null ? '' : '$' + (cents/100).toLocaleString('en-US', {maximumFractionDigits: cents % 100 ? 2 : 0});
H.when = (start, end) => {
  const s = new Date(start), e = end ? new Date(end) : null;
  const day = s.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
  const t = d => d.toLocaleTimeString('en-US', {hour:'numeric', minute: d.getMinutes() ? '2-digit' : undefined}).replace(':00','').replace(' AM',' am').replace(' PM',' pm');
  return e ? `${day} · ${t(s)}–${t(e)}` : `${day} · ${t(s)}`;
};
H.time = iso => new Date(iso).toLocaleTimeString('en-US', {hour:'numeric', minute:'2-digit'}).replace(' AM',' am').replace(' PM',' pm');
H.statusWords = {hazard:'Safety first', assessment:'Handy’s best guess', quotes:'Prices are in', scheduling:'Pick a time', scheduled:'Booked', complete:'Fixed'};
H.statusStep = {hazard:1, assessment:1, quotes:2, scheduling:3, scheduled:3, complete:3};

/* ---------- Small UI helpers ---------- */
H.h = html => `<div class="bu h">${html}</div>`;
H.u = html => `<div class="bu u">${html}</div>`;
H.typing = () => `<div class="typing" role="status" aria-label="Handy is typing"><i></i><i></i><i></i></div>`;
H.demo = (label='Demo') => `<span class="tag demo">${H.esc(label)}</span>`;
H.toast = msg => { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role','status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 3000); };
H.sheet = (title, html, bind) => {
  const d = document.createElement('dialog'); d.className = 'sheet'; d.setAttribute('aria-label', title);
  d.innerHTML = `<div class="sheet-hd"><h2>${H.esc(title)}</h2><button class="icon-btn" data-close aria-label="Close">${H.icon('x')}</button></div><div class="sheet-bd">${html}</div>`;
  document.body.appendChild(d);
  d.querySelector('[data-close]').onclick = () => d.close();
  d.addEventListener('close', () => d.remove());
  d.showModal(); if (bind) bind(d, () => d.close());
  return d;
};
H.prop = id => H.state.properties.find(p => p.id === id);

/* ---------- API ---------- */
H.api = async (method, path, body) => {
  let res;
  try {
    res = await fetch(path, { method, headers: body !== undefined ? {'Content-Type':'application/json'} : {}, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    const e = new Error('Can’t reach Handy right now. Check that the app is running, then try again.'); e.status = 0; throw e;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Something went wrong. Please try again.'); e.status = res.status; throw e; }
  return data;
};

/* ---------- State ---------- */
const saved = JSON.parse(localStorage.getItem('handy-ui') || '{}');
H.state = { repairs:[], properties:[], metrics:null, integrations:[], actor:null, role: saved.role || 'owner', propertyFilter: saved.propertyFilter || 'all', busy:false, error:null, loaded:false };
H.saveUi = () => localStorage.setItem('handy-ui', JSON.stringify({role:H.state.role, propertyFilter:H.state.propertyFilter}));
H.refresh = async () => {
  try { Object.assign(H.state, await H.api('GET','/api/bootstrap'), {error:null, loaded:true}); }
  catch (e) { H.state.error = e.message; H.state.loaded = true; }
  H.render();
};
H.upsert = repair => {
  const i = H.state.repairs.findIndex(r => r.id === repair.id);
  if (i >= 0) H.state.repairs[i] = repair; else H.state.repairs.unshift(repair);
  H.render();
  H.api('GET','/api/analytics').then(d => { H.state.metrics = d.metrics; }).catch(() => {});
};
H.repair = id => H.state.repairs.find(r => r.id === id);
H.mutate = async (id, action, body = {}) => {
  if (H.state.busy) return null;
  H.state.busy = true; H.state.error = null;
  document.querySelectorAll('.center button').forEach(b => b.disabled = true);
  try {
    const path = action ? `/api/repairs/${id}/${action}` : `/api/repairs/${id}`;
    const { repair } = await H.api(action ? 'POST' : 'PATCH', path, body);
    H.state.busy = false; H.upsert(repair); return repair;
  } catch (e) {
    H.state.busy = false; H.state.error = e.message; H.render(); H.toast(e.message); return null;
  }
};

/* ---------- Parts registry ---------- */
H.parts = {};
H.part = (name, def) => { H.parts[name] = def; };
const ORDER = ['intake','assessment','quotes','scheduling','booked'];
H.ui = {};

/* ---------- Timers ---------- */
let timers = [];
H.later = (ms, fn) => { timers.push(setTimeout(fn, ms)); };
const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

/* Scroll the conversation to its end so the newest message sits just above the dock (never under it).
   Desktop scrolls the .center pane; phones/tablets scroll the window. Modules may call it after live updates. */
H.scrollToEnd = () => requestAnimationFrame(() => {
  const c = document.querySelector('.center');
  if (c && c.scrollHeight > c.clientHeight) c.scrollTop = c.scrollHeight;
  window.scrollTo(0, document.documentElement.scrollHeight);
});

/* ---------- Router + render ---------- */
H.go = hash => { if (location.hash === hash) H.render(); else location.hash = hash; };
const parse = () => {
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'new') return {name:'new'};
  if (h === 'insights') return {name:'insights'};
  const m = h.match(/^repair\/([a-zA-Z0-9-]+)$/);
  return m ? {name:'repair', id:m[1]} : {name:'home'};
};
const pin = r => {
  const step = H.statusStep[r.status] || 1;
  const sub = r.status === 'scheduled' && r.booking ? `Booked · ${H.when(r.booking.window.start, r.booking.window.end)}` : (H.statusWords[r.status] || r.status);
  return `<div class="pin" role="status"><div style="flex:1;min-width:0"><div class="t">${H.esc(r.title)}</div><div class="s">${H.esc(sub)}</div></div>
    <div class="trk" aria-label="Step ${step} of 3">${[1,2,3].map(i => `<b class="${i<=step?'on':''}"></b>`).join('')}</div></div>`;
};
const header = (title, sub, back) => `<header class="hd">
  ${back ? `<button class="back mobile-only" data-nav="#/" aria-label="Back to your repairs">${H.icon('back')}</button>` : ''}
  <div class="av">${H.icon('wrench')}</div><div class="grow"><div class="n">${H.esc(title)}</div><div class="s">${H.esc(sub)}</div></div></header>`;
const errorBox = () => H.state.error ? `<div class="note red err-box" role="alert">${H.icon('alert')}<span>${H.esc(H.state.error)}</span><button class="btn plain" data-dismiss-error>Dismiss</button></div>` : '';
const safe = (fn, fallback='') => { try { return fn() ?? fallback; } catch (e) { console.error(e); return fallback; } };

H.render = () => {
  clearTimers();
  const root = document.getElementById('app'); if (!root) return;
  /* Keep keyboard focus across same-route re-renders (async refreshes, mutations) */
  const ae = document.activeElement, hadFocus = ae && ae !== document.body && root.contains(ae);
  const focusKey = hadFocus ? (ae.id ? '#' + CSS.escape(ae.id) : ['data-nav','data-choose','data-slot','name','aria-label'].map(a => ae.getAttribute(a) != null ? `${ae.tagName.toLowerCase()}[${a}="${CSS.escape(ae.getAttribute(a))}"]` : '').find(Boolean)) : null;
  const route = H.route = parse(), S = H.state;
  if (!S.loaded) { root.innerHTML = `<div class="loading">${H.typing()} Loading your repairs…</div>`; return; }
  const repair = route.name === 'repair' ? H.repair(route.id) : null;
  let center;
  if (route.name === 'new' && H.ui.report) center = header('Report a problem', 'New repair', true) + safe(() => H.ui.report.render(S));
  else if (route.name === 'insights' && H.ui.insights) center = header('Insights', 'Demo metrics', true) + safe(() => H.ui.insights.render(S));
  else if (repair) {
    const owner = ORDER.map(n => H.parts[n]).find(p => p && p.owns && p.owns.includes(repair.status));
    center = header('Handy', 'Your repair helper', true) + pin(repair) + errorBox() +
      `<div class="thread" aria-live="polite">${ORDER.map(n => H.parts[n] ? safe(() => H.parts[n].history(repair)) : '').join('')}</div>` +
      (owner && owner.dock ? `<div class="dock">${safe(() => owner.dock(repair))}</div>` : '');
  } else if (route.name === 'repair' && !H._fetched?.has(route.id)) {
    /* Not in the loaded list (created elsewhere or list is stale): fetch it once before giving up */
    (H._fetched ||= new Set()).add(route.id);
    H.api('GET', `/api/repairs/${route.id}`).then(d => H.upsert(d.repair)).catch(() => H.render());
    center = header('Handy', 'Your repair helper', true) + `<div class="loading">${H.typing()} Opening your repair…</div>`;
  } else if (route.name === 'repair') center = header('Handy', 'Your repair helper', true) + `<div class="page"><h1>We couldn’t find that repair</h1><p class="lead">It may have been removed when the demo was reset.</p><button class="btn" data-nav="#/">Back to your repairs</button></div>`;
  else center = header('Handy', 'Your repair helper', false) + errorBox() + (H.ui.home ? safe(() => H.ui.home.render(S)) : '');
  const showDetails = !!repair && !!H.ui.details;
  root.className = 'shell' + (showDetails ? '' : ' no-details');
  root.dataset.pane = route.name === 'home' ? 'list' : 'main';
  root.innerHTML = `
    <nav class="rail" aria-label="Your repairs">${H.ui.rail ? safe(() => H.ui.rail.render(S)) : ''}</nav>
    <main class="center"><div class="center-inner">${center}</div></main>
    <aside class="details" aria-label="Repair details" ${showDetails ? '' : 'hidden'}>${showDetails ? safe(() => H.ui.details.render(repair, S)) : ''}</aside>`;
  root.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); H.go(el.dataset.nav); }));
  root.querySelectorAll('[data-dismiss-error]').forEach(el => el.addEventListener('click', () => { S.error = null; H.render(); }));
  const rail = root.querySelector('.rail'), center$ = root.querySelector('.center'), det = root.querySelector('.details');
  safe(() => H.ui.rail && H.ui.rail.bind && H.ui.rail.bind(rail));
  if (route.name === 'new') safe(() => H.ui.report && H.ui.report.bind && H.ui.report.bind(center$));
  else if (route.name === 'insights') safe(() => H.ui.insights && H.ui.insights.bind && H.ui.insights.bind(center$));
  else if (repair) {
    ORDER.forEach(n => H.parts[n] && H.parts[n].bind && safe(() => H.parts[n].bind(center$, repair)));
    if (showDetails && H.ui.details.bind) safe(() => H.ui.details.bind(det, repair));
    H.scrollToEnd();
  } else safe(() => H.ui.home && H.ui.home.bind && H.ui.home.bind(center$));
  const focusHeading = () => { const h = center$.querySelector('h1, .hd .n'); if (h) { h.tabIndex = -1; h.focus({preventScroll:true}); } };
  if (H._lastRoute !== location.hash) { H._lastRoute = location.hash; focusHeading(); }
  else if (hadFocus && !(document.activeElement && root.contains(document.activeElement) && document.activeElement !== root)) {
    const again = focusKey && root.querySelector(focusKey);
    if (again) again.focus({preventScroll:true}); else focusHeading();
  }
};
window.addEventListener('hashchange', H.render);
document.addEventListener('DOMContentLoaded', () => { H.render(); H.refresh(); });
})();
