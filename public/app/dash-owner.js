/* dash-owner.js — the homeowner's home screen (#/ in owner.html).
   Registers H.ui.dashboard.owner = {render(state), bind(root)}. Owner: dash-owner module.
   Reads H.myProperties() / H.myRepairs(): one or more houses. With several houses, "Happening now" groups by house.
   "Add a house" goes to #/settings (settings.js). Every action either opens a repair or starts a report;
   approval and booking stay inside the repair thread. */
(function(){
const H = window.H;
if (!H) return;

const css = `
.center-inner:has(> .do){max-width:1120px}
.do{flex:1;padding:28px 32px 48px;display:flex;flex-direction:column;gap:28px}
.do h1{font-size:36px;line-height:1.1;letter-spacing:-.015em;margin:0;text-wrap:balance}
.do-hi p{margin:8px 0 0;font-size:19px;color:var(--ink2);max-width:58ch;text-wrap:pretty}
.do-houses{display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;margin-top:10px;font-size:16px;color:var(--ink2)}
.do-houses .do-hs{display:inline-flex;align-items:center;gap:8px;min-width:0}
.do-houses .do-hs .ic{width:18px;height:18px;color:var(--ink3);flex:none}
.do-houses .do-hs b{color:var(--ink);font-weight:700}
.do-addh{min-height:48px;padding:0 4px;border:0;background:none;color:var(--green);font:inherit;font-size:16px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;text-decoration:underline;text-underline-offset:4px;text-decoration-thickness:1.5px}
.do-addh:hover{color:var(--green-press)}
.do-addh .ic{width:18px;height:18px}
.do-group{display:flex;flex-direction:column;gap:12px}
.do-group+.do-group{margin-top:22px}
.do-group h3{margin:0;font-size:17px;display:flex;align-items:center;gap:8px;color:var(--ink)}
.do-group h3 .ic{width:18px;height:18px;color:var(--ink3)}
.do-group h3 .c{font-size:15px;font-weight:600;color:var(--ink3);font-variant-numeric:tabular-nums}
.do-calm{margin:18px 0 0;font-size:15px;color:var(--ink3)}

.do-report{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px 28px;align-items:center;background:var(--green);color:#fff;border-radius:24px;padding:26px 28px;box-shadow:0 10px 28px rgba(36,83,63,.22),0 2px 4px rgba(36,83,63,.12)}
.do-report h2{margin:0;font-size:26px;line-height:1.15;letter-spacing:-.01em}
.do-report p{margin:6px 0 0;color:#DCE8E1;max-width:46ch}
.do-report .do-acts{display:flex;flex-direction:column;gap:10px;min-width:260px}
.do-report .btn{flex:none;background:#fff;color:var(--green);min-height:56px;font-size:18px}
.do-report .btn:hover{background:var(--green-tint)}
.do-report .do-sample{min-height:48px;border:1.5px solid rgba(255,255,255,.55);background:none;color:#fff;border-radius:14px;font-weight:700;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 16px}
.do-report .do-sample:hover{background:rgba(255,255,255,.12)}
.do-report .do-sample .tag.demo{background:rgba(255,255,255,.16);color:#fff;border-color:rgba(255,255,255,.35)}
.do-report :focus-visible{outline-color:#fff}

.do-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:32px;align-items:start}
.do-col{display:flex;flex-direction:column;gap:28px;min-width:0}
.do-sec h2{font-size:21px;margin:0 0 12px;display:flex;align-items:baseline;gap:10px}
.do-sec h2 .c{font-size:15px;font-weight:600;color:var(--ink3);font-variant-numeric:tabular-nums}
.do-quiet{margin:0;color:var(--ink2);font-size:16px}

.do-cards{display:flex;flex-direction:column;gap:14px}
.do-card{background:#fff;border:1px solid var(--line);border-radius:20px;padding:20px;box-shadow:var(--shadow);display:flex;flex-direction:column;gap:16px}
.do-card.hz{background:var(--red-tint);border-color:#F0C4BA;box-shadow:none}
.do-top{display:flex;gap:14px;align-items:flex-start}
.do-thumb{width:60px;height:60px;border-radius:14px;flex:none;object-fit:cover;background:var(--pinned);border:1px solid var(--line)}
.do-glyph{width:60px;height:60px;border-radius:14px;flex:none;display:grid;place-items:center;background:var(--pinned);color:var(--ink2)}
.do-card.hz .do-glyph{background:#fff;color:var(--red)}
.do-top .t{font-size:20px;font-weight:700;line-height:1.25;text-wrap:balance}
.do-top .grow{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px;align-items:flex-start}
.do-fact{margin:0;font-size:18px;line-height:1.4}
.do-fact b{font-weight:800}
.do-card .btn{flex:none;align-self:stretch;min-height:54px}
.do-card .btn .ic{width:20px;height:20px}

.do-trk{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.do-trk li{display:flex;flex-direction:column;gap:6px;font-size:15px;color:var(--ink3)}
.do-trk .bar{height:8px;border-radius:4px;background:var(--line);overflow:hidden;position:relative}
.do-trk .bar i{position:absolute;inset:0;background:var(--green);border-radius:4px;transform-origin:left center}
.do-trk li.done{color:var(--ink2)}
.do-trk li.now{color:var(--green);font-weight:700}
.do-trk li.done .lb::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--green);margin:0 6px 2px 0}
.do.fresh .do-trk li.now .bar i{animation:do-fill .9s cubic-bezier(.16,1,.3,1) both .15s}
@keyframes do-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}

.do-list{display:flex;flex-direction:column;border-top:1px solid var(--line)}
.do-visit{display:grid;grid-template-columns:58px minmax(0,1fr);gap:14px;padding:16px 0;border-bottom:1px solid var(--line);align-items:start}
.do-date{width:58px;border-radius:14px;background:var(--green-tint);color:var(--green);text-align:center;padding:6px 0 8px;line-height:1.1}
.do-date .wd{font-size:14px;font-weight:700}
.do-date .d{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums}
.do-date .m{font-size:14px}
.do-visit .t{font-weight:700;font-size:18px;line-height:1.3}
.do-visit .s{font-size:16px;color:var(--ink2);margin-top:2px}
.do-visit .do-va{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.do-visit .do-va button{min-height:48px;padding:0 14px;border-radius:12px;font-weight:700;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;gap:8px}
.do-visit .do-va .ic{width:18px;height:18px}
.do-cal{border:1.5px solid var(--green);background:#fff;color:var(--green)}
.do-cal:hover{background:var(--green-tint)}
.do-open{border:0;background:none;color:var(--ink2);text-decoration:underline;text-underline-offset:3px}
.do-open:hover{color:var(--ink)}

.do-done{display:flex;align-items:center;gap:12px;width:100%;min-height:64px;padding:12px 4px;border:0;border-bottom:1px solid var(--line);background:none;text-align:left;cursor:pointer;font:inherit;color:inherit}
.do-done:hover{background:var(--pinned)}
.do-done .ok{width:36px;height:36px;border-radius:50%;background:var(--green-tint);color:var(--green);display:grid;place-items:center;flex:none}
.do-done .ok .ic{width:18px;height:18px}
.do-done .grow{flex:1;min-width:0}
.do-done .t{font-weight:700}
.do-done .s{font-size:15px;color:var(--ink2)}
.do-done > .ic{color:var(--ink3);width:20px;height:20px}

.do-spent{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:16px 18px;border-radius:16px;background:var(--pinned);border:1px solid var(--line)}
.do-spent .l{flex:1;min-width:0}
.do-spent .l div:first-child{font-weight:700}
.do-spent .l div+div{font-size:15px;color:var(--ink2)}
.do-spent .v{font-size:26px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em}

.do-welcome{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin:0;padding:0;list-style:none;counter-reset:do}
.do-welcome li{display:flex;flex-direction:column;gap:6px;padding-top:16px;border-top:2px solid var(--line)}
.do-welcome .n{width:36px;height:36px;border-radius:50%;background:var(--green-tint);color:var(--green);font-weight:800;display:grid;place-items:center;margin-bottom:6px}
.do-welcome .t{font-weight:700;font-size:18px}
.do-welcome .s{color:var(--ink2);font-size:16px}
.do-promise{display:flex;align-items:center;gap:10px;font-size:18px;font-weight:700;color:var(--green);margin:0}

@media (max-width:1023px){.do-grid{grid-template-columns:1fr}}
@media (max-width:760px){
  .do{padding:20px 16px 36px;gap:24px}
  .do h1{font-size:30px}
  .do-hi p{font-size:18px}
  .do-report{grid-template-columns:1fr;padding:22px 20px;border-radius:20px}
  .do-report h2{font-size:23px}
  .do-report .do-acts{min-width:0}
  .do-welcome{grid-template-columns:1fr;gap:16px}
}
/* Phone: the dashboard is the homeowner's home, so show it instead of the bare repair list. */
@media (max-width:639px){
  .shell[data-pane="list"]:has(.do) .center{display:flex}
  .shell[data-pane="list"]:has(.do) .rail{display:none}
}
@media (prefers-reduced-motion:reduce){.do.fresh .do-trk li.now .bar i{animation:none}}
`;
if (!document.getElementById('css-dash-owner')) {
  const s = document.createElement('style'); s.id = 'css-dash-owner'; s.textContent = css; document.head.appendChild(s);
}

const SAMPLE = '/assets/sample-sink.svg';
const STEPS = ['Guess', 'Prices', 'Booked'];
let animated = false;

/* ---------- Data helpers ---------- */
const soonest = q => (q.windows && q.windows[0] ? Date.parse(q.windows[0].start) : Infinity);
/* Same order quotes.js uses: best rated, then soonest, then cheapest. */
const recommended = r => (r.quotes || []).slice().sort((a, b) =>
  (Number(b.rating) || 0) - (Number(a.rating) || 0) || soonest(a) - soonest(b) || a.amountCents - b.amountCents)[0];
const proName = r => (r.approval && r.approval.providerName)
  || ((r.quotes || []).find(q => r.booking && q.id === r.booking.quoteId) || {}).name || 'your pro';
const isHazard = r => r.status === 'hazard' || !!(r.assessment && r.assessment.hazard && r.status !== 'complete');
const photoOf = r => (r.photos || []).find(p => typeof p === 'string' && (p.startsWith('/assets/') || /^data:image\/(png|jpe?g|webp|gif|svg\+xml);/.test(p)));
const houseName = r => (H.prop(r.property) || {}).name || '';
const firstName = st => String((st.actor && st.actor.name) || (H.prop('p1') || {}).tenant || 'Jamie').trim().split(/\s+/)[0];
const ORDER = { hazard:0, quotes:1, scheduling:2, assessment:3, scheduled:4 };
const startOf = r => r.booking && r.booking.window ? Date.parse(r.booking.window.start) : Infinity;

const facts = r => {
  if (isHazard(r)) return { tag:['red', 'Safety first'], fact:'Handy stopped here because this could be dangerous. Follow the safety steps before anything else.', btn:'See the safety steps', strong:true };
  if (r.status === 'assessment') {
    const a = r.assessment || {};
    return { tag:['', 'Handy is on it'], fact:`Handy’s best guess: <b>${H.esc(a.title || 'needs a closer look')}</b>. Getting prices next.`, btn:'See Handy’s guess' };
  }
  if (r.status === 'quotes') {
    const q = recommended(r), n = (r.quotes || []).length;
    return { tag:['amber', 'Waiting for you'], btn:'Compare prices', strong:true,
      fact: q ? `${n} ${n === 1 ? 'price' : 'prices'} — we recommend <b>${H.esc(q.name)} ${H.esc(H.money(q.amountCents))}</b>` : 'Prices are coming in.' };
  }
  if (r.status === 'scheduling') return { tag:['', 'Handy is booking'], btn:'Pick a time', strong:true,
    fact: `You said yes to <b>${H.esc(proName(r))}${r.approval ? ' ' + H.esc(H.money(r.approval.amountCents)) : ''}</b>. Choosing a time.` };
  if (r.status === 'scheduled' && r.booking) return { tag:['', 'Booked'], btn:'See the booking',
    fact: `Booked <b>${H.esc(H.when(r.booking.window.start, r.booking.window.end))}</b> with ${H.esc(proName(r))}` };
  return { tag:['', H.statusWords[r.status] || 'In progress'], fact:'', btn:'Open this repair' };
};

/* ---------- .ics (same shape as the booking and details modules) ---------- */
const icsStamp = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const icsText = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const downloadIcs = r => {
  const b = r.booking, p = H.prop(r.property) || {}, pro = proName(r);
  const desc = [r.title, `Pro: ${pro}`, r.approval ? `Price you approved: ${H.money(r.approval.amountCents)}` : '', b.access ? `How to get in: ${b.access}` : '', 'Demo booking from Handy. No real pro was contacted.'].filter(Boolean).join('\n');
  const text = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Handy//Repair helper (demo)//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${b.id}@handy.local`, `DTSTAMP:${icsStamp(new Date().toISOString())}`,
    `DTSTART:${icsStamp(b.window.start)}`, `DTEND:${icsStamp(b.window.end)}`,
    `SUMMARY:${icsText(`${pro}: ${r.title} (demo)`)}`, `LOCATION:${icsText([p.name, p.unit].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${icsText(desc)}`, 'STATUS:CONFIRMED', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n') + '\r\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], {type:'text/calendar;charset=utf-8'})); a.download = 'handy-repair.ics';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  H.toast('Calendar file downloaded (handy-repair.ics)');
};

/* ---------- Pieces ---------- */
const tracker = r => {
  const step = H.statusStep[r.status] || 1, done = r.status === 'scheduled' || r.status === 'complete';
  return `<ol class="do-trk" aria-label="Step ${step} of 3: ${STEPS[step - 1]}">${STEPS.map((s, i) => {
    const n = i + 1, cls = n < step || (done && n === step) ? (n === step ? 'now done' : 'done') : n === step ? 'now' : '';
    return `<li class="${cls}"${n === step ? ' aria-current="step"' : ''}><span class="bar">${n <= step ? '<i></i>' : ''}</span><span class="lb">${s}</span></li>`;
  }).join('')}</ol>`;
};

const card = r => {
  const f = facts(r), hz = isHazard(r), img = photoOf(r);
  const tag = f.tag[0] ? `<span class="tag ${f.tag[0]}">${H.esc(f.tag[1])}</span>` : `<span class="tag">${H.esc(f.tag[1])}</span>`;
  return `<article class="do-card${hz ? ' hz' : ''}" aria-labelledby="do-t-${H.esc(r.id)}">
    <div class="do-top">
      ${img ? `<img class="do-thumb" src="${H.esc(img)}" alt="">` : `<div class="do-glyph">${H.icon(hz ? 'alert' : 'wrench')}</div>`}
      <div class="grow"><div class="t" id="do-t-${H.esc(r.id)}">${H.esc(r.title)}</div>${tag}</div>
    </div>
    ${hz ? '' : tracker(r)}
    ${f.fact ? `<p class="do-fact">${f.fact}</p>` : ''}
    <button class="btn${f.strong ? (hz ? ' danger' : '') : ' ghost'}" data-nav="#/repair/${H.esc(r.id)}">${H.esc(f.btn)} ${H.icon('arrow')}</button>
  </article>`;
};

let multi = false;
const visit = r => {
  const s = new Date(r.booking.window.start);
  const wd = s.toLocaleDateString('en-US', {weekday:'short'}), d = s.getDate(), m = s.toLocaleDateString('en-US', {month:'short'});
  const time = H.when(r.booking.window.start, r.booking.window.end).split(' · ')[1] || '';
  const price = r.approval ? H.money(r.approval.amountCents) : '';
  return `<div class="do-visit">
    <div class="do-date" aria-hidden="true"><div class="wd">${H.esc(wd)}</div><div class="d">${d}</div><div class="m">${H.esc(m)}</div></div>
    <div><div class="t">${H.esc(r.title)}</div>
      <div class="s"><span class="sr">${H.esc(s.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'}))}, </span>${H.esc(time)} · ${multi && houseName(r) ? H.esc(houseName(r)) + ' · ' : ''}${H.esc(proName(r))}${price ? ' · ' + H.esc(price) : ''}</div>
      <div class="do-va"><button class="do-cal" data-ics="${H.esc(r.id)}">${H.icon('cal')} Add to calendar</button>
        <button class="do-open" data-nav="#/repair/${H.esc(r.id)}">Details</button></div></div>
  </div>`;
};

const doneRow = r => {
  const price = r.approval ? H.money(r.approval.amountCents) : '';
  return `<button class="do-done" data-nav="#/repair/${H.esc(r.id)}"><span class="ok">${H.icon('check')}</span>
    <span class="grow"><span class="t">${H.esc(r.title)}</span><br><span class="s">${multi && houseName(r) ? H.esc(houseName(r)) + ' · ' : ''}Fixed by ${H.esc(proName(r))}${price ? ' · ' + H.esc(price) : ''}</span></span>${H.icon('chev')}</button>`;
};

const reportPanel = empty => `<section class="do-report" aria-labelledby="do-rp">
  <div><h2 id="do-rp">${empty ? 'Something broken at home?' : 'Something else broken?'}</h2>
    <p>Send a photo and a few words. Handy gets prices from local pros and books the one you pick.</p></div>
  <div class="do-acts">
    <button class="btn" data-report>${H.icon('camera')} Report a problem</button>
    <button class="do-sample" data-report-sample>${H.icon('image')} Try a sample photo ${H.demo('Demo')}</button>
  </div>
</section>`;

const statusLine = (active, coming, done, place) => {
  const hz = active.filter(isHazard), quotes = active.filter(r => r.status === 'quotes'), busy = active.filter(r => ['assessment', 'scheduling'].includes(r.status));
  if (hz.length) return `${hz.length === 1 ? 'One problem needs' : hz.length + ' problems need'} you right away. Please follow the safety steps first.`;
  if (quotes.length === 1) return `Prices are in for “${H.esc(quotes[0].title)}.” Pick one when you’re ready.`;
  if (quotes.length > 1) return `Prices are in for ${quotes.length} repairs. Pick one for each when you’re ready.`;
  if (busy.length) return `Handy is working on ${busy.length === 1 ? 'one repair' : busy.length + ' repairs'}. Nothing needs you right now.`;
  if (coming.length) return `Nothing needs you right now. The next visit is ${H.esc(H.when(coming[0].booking.window.start, coming[0].booking.window.end))}.`;
  if (done.length) return `Everything at ${H.esc(place)} is fixed. Nice.`;
  return `Welcome to Handy. When something breaks at ${H.esc(place)}, we’ll sort it out together.`;
};

const housesLine = houses => {
  const names = houses.map(h => h.name);
  const what = houses.length > 1 ? `<b>${houses.length} houses</b> · ${H.esc(names.join(', '))}` : houses.length ? `<b>${H.esc(names[0])}</b>` : 'No house added yet';
  return `<div class="do-houses"><span class="do-hs">${H.icon('home')}<span>${what}</span></span>
    <button type="button" class="do-addh" data-nav="#/settings">${H.icon('plus')} Add a house</button></div>`;
};
const nowList = (active, houses) => {
  if (!active.length) return `<p class="do-quiet">Nothing needs fixing right now.</p>`;
  if (houses.length < 2) return `<div class="do-cards">${active.map(card).join('')}</div>`;
  const groups = houses.map(h => ({h, list: active.filter(r => r.property === h.id)}));
  const busy = groups.filter(g => g.list.length), calm = groups.filter(g => !g.list.length);
  return busy.map(g => `<div class="do-group" role="group" aria-labelledby="do-g-${H.esc(g.h.id)}">
      <h3 id="do-g-${H.esc(g.h.id)}">${H.icon('home')}${H.esc(g.h.name)} <span class="c">${g.list.length}</span></h3>
      <div class="do-cards">${g.list.map(card).join('')}</div></div>`).join('')
    + (calm.length ? `<p class="do-calm">Nothing open at ${H.esc(calm.map(g => g.h.name).join(', '))}.</p>` : '');
};

const welcome = () => `<section class="do-sec" aria-labelledby="do-how"><h2 id="do-how">How Handy works</h2>
  <ol class="do-welcome">
    <li><span class="n">1</span><span class="t">Show us what’s wrong</span><span class="s">Take a photo and say what’s happening, in your own words.</span></li>
    <li><span class="n">2</span><span class="t">Handy gets prices</span><span class="s">We call local pros for you and suggest the best one.</span></li>
    <li><span class="n">3</span><span class="t">You say yes</span><span class="s">One tap approves the price and books the earliest visit.</span></li>
  </ol></section>
  <p class="do-promise">${H.icon('shield')} Nothing is booked until you say yes.</p>`;

/* ---------- Module ---------- */
H.ui.dashboard = H.ui.dashboard || {};
H.ui.dashboard.owner = {
  render(st) {
    const houses = H.myProperties(), mine = H.myRepairs();
    multi = houses.length > 1;
    const place = houses.length === 1 ? houses[0].name : 'your houses';
    const active = mine.filter(r => r.status !== 'complete')
      .sort((a, b) => ((isHazard(a) ? -1 : ORDER[a.status] ?? 5) - (isHazard(b) ? -1 : ORDER[b.status] ?? 5)) || startOf(a) - startOf(b) || Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    const coming = mine.filter(r => r.status === 'scheduled' && r.booking && r.booking.window).sort((a, b) => startOf(a) - startOf(b));
    const done = mine.filter(r => r.status === 'complete').sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
    const year = new Date().getFullYear();
    const paid = mine.filter(r => r.approval && ['scheduled', 'complete'].includes(r.status) && new Date(r.approval.timestamp || r.updatedAt).getFullYear() === year);
    const spent = paid.reduce((s, r) => s + (r.approval.amountCents || 0), 0);
    const fresh = !animated; animated = true;
    const hi = `<section class="do-hi"><h1>Hi ${H.esc(firstName(st))}</h1><p>${statusLine(active, coming, done, place)}</p>
      ${housesLine(houses)}</section>`;

    if (!mine.length) return `<div class="do${fresh ? ' fresh' : ''}">${hi}${reportPanel(true)}${welcome()}</div>`;

    const now = `<section class="do-sec" aria-labelledby="do-now"><h2 id="do-now">Happening now ${active.length ? `<span class="c">${active.length}</span>` : ''}</h2>
      ${nowList(active, houses)}</section>`;
    const up = `<section class="do-sec" aria-labelledby="do-up"><h2 id="do-up">Coming up</h2>
      ${coming.length ? `<div class="do-list">${coming.map(visit).join('')}</div>` : `<p class="do-quiet">No visits booked yet. When you say yes to a price, the visit shows up here.</p>`}</section>`;
    const fixed = `<section class="do-sec" aria-labelledby="do-fx"><h2 id="do-fx">Done</h2>
      ${done.length ? `<div class="do-list">${done.slice(0, 4).map(doneRow).join('')}</div>` : `<p class="do-quiet">Fixed repairs will show up here.</p>`}</section>`;
    const money = `<div class="do-spent"><div class="l"><div>Spent this year</div><div>${paid.length ? `${paid.length} approved ${paid.length === 1 ? 'repair' : 'repairs'}` : 'Nothing approved yet'}</div></div>
      <div class="v">${H.esc(H.money(spent))}</div>${H.demo('Demo')}</div>`;

    return `<div class="do${fresh ? ' fresh' : ''}">${hi}${reportPanel(false)}
      <div class="do-grid"><div class="do-col">${now}</div><div class="do-col">${up}${fixed}${money}</div></div></div>`;
  },
  bind(root) {
    const el = root.querySelector('.do'); if (!el) return;
    el.querySelectorAll('[data-report]').forEach(b => b.addEventListener('click', () => H.go('#/new')));
    el.querySelectorAll('[data-report-sample]').forEach(b => b.addEventListener('click', () => {
      H.go('#/new');
      /* report.js owns the form; press its own sample-photo button once it has rendered */
      setTimeout(() => { const s = document.querySelector('.center [data-sample]'); if (s) s.click(); }, 0);
    }));
    el.querySelectorAll('[data-ics]').forEach(b => b.addEventListener('click', () => {
      const r = H.repair(b.dataset.ics); if (r && r.booking) downloadIcs(r);
    }));
  }
};
})();
