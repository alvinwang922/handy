/* Handy prototype — coordinator-owned core: icons, sample data, state, screen registry, router, UI helpers.
   Screen files call H.screen(id, {render(ctx) => html, after?(root, ctx)}). Navigate with H.go(id). */
(function(){
const H = window.H = {};

/* ---------- Icons (one stroke weight, authored SVG) ---------- */
const P = {
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  back:'<path d="m15 18-6-6 6-6"/>', chev:'<path d="m9 18 6-6-6-6"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>', clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  camera:'<path d="M3 8a2 2 0 0 1 2-2h2.5l1.5-2h6l1.5 2H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="13" r="4"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', send:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  home:'<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>', pin:'<path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3"/>', list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', doc:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  star:'<path fill="currentColor" stroke="none" d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/>'
};
H.icon = (n, cls='') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n]||''}</svg>`;

/* Sample photo: sink cabinet with a dripping U-trap (illustration stands in for a real photo) */
H.sinkArt = `<svg viewBox="0 0 240 180" role="img" aria-label="Photo: pipes under the kitchen sink, with water on the cabinet floor"><rect width="240" height="180" fill="#4A3F35"/><rect y="140" width="240" height="40" fill="#7A6650"/><ellipse cx="128" cy="150" rx="60" ry="9" fill="#9CCDE8" opacity=".55"/><path d="M104 0v60a24 24 0 0 0 48 0V52h88" fill="none" stroke="#C9CED0" stroke-width="13"/><circle cx="128" cy="96" r="3" fill="#9CCDE8"/><circle cx="126" cy="116" r="3" fill="#9CCDE8"/><circle cx="129" cy="133" r="3" fill="#9CCDE8"/></svg>`;

/* ---------- Sample data (all simulated; labeled Demo in UI) ---------- */
H.data = {
  properties:[
    {id:'p1', name:'Maple House', addr:'124 Maple Avenue', unit:'Main home', tenant:'Jamie Chen'},
    {id:'p2', name:'Oak Street Duplex', addr:'86 Oak Street', unit:'Unit 2B', tenant:'Taylor Reed'},
    {id:'p3', name:'Cedar Cottage', addr:'32 Cedar Lane', unit:'Unit 1', tenant:'Sam Rivera'}
  ],
  rooms:['Kitchen','Bathroom','Bedroom','Living room','Laundry','Outside'],
  diagnosis:{ title:'Leak under the kitchen sink', cause:'Possible loose drain connection', trade:'plumber',
    urgency:'soon', confidence:'Fairly sure', cost:[150,250], inspect:false,
    brief:'Slow drip from the drain pipe under the kitchen sink. Water pooling on the cabinet floor. No smell of gas, no flooding.' },
  providers:[
    {id:'clearwater', name:'Clearwater Plumbing', rating:4.9, reviews:128, price:185, parts:40, labor:145, when:'Can come tomorrow', guarantee:'90-day guarantee', why:'Highest rated, and they can come soonest.', pick:true},
    {id:'oakpipe', name:'Oak & Pipe Services', rating:4.8, reviews:86, price:215, parts:55, labor:160, when:'Can come tomorrow', guarantee:'60-day guarantee', why:'Close by, with strong reviews for leaks.'},
    {id:'neighborhood', name:'Neighborhood Fix', rating:4.7, reviews:204, price:160, parts:35, labor:125, when:'Can come in 2 days', guarantee:'30-day guarantee', why:'Lowest price, but a later visit.'}
  ],
  slots:[
    {id:'s1', day:'Mon, Oct 12', time:'9–11 am'}, {id:'s2', day:'Mon, Oct 12', time:'1–3 pm'},
    {id:'s3', day:'Tue, Oct 13', time:'9–11 am'}, {id:'s4', day:'Tue, Oct 13', time:'3–5 pm'}
  ],
  repairs:[
    {id:'r1', title:'Leak under the kitchen sink', prop:'p1', room:'Kitchen', status:'scheduled', line:'Clearwater · Mon, Oct 12 · 9–11 am'},
    {id:'r2', title:'AC isn’t cooling properly', prop:'p2', room:'Living room', status:'quotes_ready', line:'3 prices are in'},
    {id:'r3', title:'Bedroom door won’t latch', prop:'p3', room:'Bedroom', status:'quoting', line:'Calling handymen · 1 of 3 in'}
  ],
  transcript:[
    ['Handy','Hi, this is Handy, an AI assistant calling for a homeowner. Is this Clearwater Plumbing?'],
    ['Clearwater','Yes, this is Dana.'],
    ['Handy','A customer has a slow leak under their kitchen sink, probably a loose drain connection. Could you give a rough price, and when you could come?'],
    ['Clearwater','Usually about 185 dollars, parts and labor. We could come tomorrow morning.'],
    ['Handy','Thank you. I’m not booking anything yet. The customer will decide, and we may call back to book.']
  ]
};
H.prop = id => H.data.properties.find(p=>p.id===id);
H.prov = id => H.data.providers.find(p=>p.id===id);
H.statusWords = {diagnosed:'Checked', quoting:'Getting prices', quotes_ready:'Prices are in', booking:'Booking', scheduled:'Booked', done:'Done', emergency:'Safety first', failed:'Needs attention'};

/* ---------- State (persisted per tab so direct links still work) ---------- */
const defaults = () => ({ role:'owner', propertyId:'p1', room:'Kitchen', desc:'Water is dripping under the kitchen sink and the cabinet floor is wet.',
  hasPhoto:true, providerId:'clearwater', slots:['s1'], access:'Key is under the blue pot by the side door.', confirmedSlot:'s1', filter:'all' });
H.S = Object.assign(defaults(), JSON.parse(sessionStorage.getItem('handy-proto')||'{}'));
H.save = () => sessionStorage.setItem('handy-proto', JSON.stringify(H.S));
H.reset = () => { sessionStorage.removeItem('handy-proto'); H.S = defaults(); };

/* ---------- Screen registry: the shared contract for every builder and the review workspace ---------- */
H.REGISTRY = [
  // group, id, title, role
  ['Start','welcome','First-time welcome','Homeowner'],
  ['Start','home-empty','Home, no repairs yet','Homeowner'],
  ['Start','home','Home, your repairs','Homeowner'],
  ['Report a problem','new-photo','Add a photo','Homeowner'],
  ['Report a problem','photo-permission','Camera access blocked','Homeowner'],
  ['Report a problem','photo-error','Photo didn’t upload','Homeowner'],
  ['Report a problem','new-details','Where and what','Homeowner'],
  ['Report a problem','details-error','Missing details (validation)','Homeowner'],
  ['Diagnosis','diagnosing','Looking at your photo (loading)','Homeowner'],
  ['Diagnosis','diagnosis','What Handy thinks it is','Homeowner'],
  ['Diagnosis','diagnosis-unsure','Handy isn’t sure','Homeowner'],
  ['Diagnosis','emergency','Emergency: safety first','Homeowner'],
  ['Getting prices','calling','Calling plumbers (live)','Homeowner'],
  ['Getting prices','calling-trouble','A plumber didn’t pick up','Homeowner'],
  ['Getting prices','transcript','What was said on the call','Homeowner'],
  ['Getting prices','no-quotes','No prices came back','Homeowner'],
  ['Getting prices','notice-credit','Calling paused (service limit)','Homeowner'],
  ['Choose','quotes','Prices are in','Homeowner'],
  ['Choose','quotes-all','Compare all 3','Homeowner'],
  ['Choose','quote-unclear','Unclear price','Homeowner'],
  ['Choose','approve','Say yes to this price','Homeowner'],
  ['Book','schedule','Pick times and access','Homeowner'],
  ['Book','booking','Calling to book (loading)','Homeowner'],
  ['Book','booking-failed','Times didn’t work','Homeowner'],
  ['Book','booked','You’re booked','Homeowner'],
  ['After booking','reschedule','Change the time','Homeowner'],
  ['After booking','done','Mark as fixed','Homeowner'],
  ['After booking','activity','What happened so far','Homeowner'],
  ['Property manager','manager-home','All properties queue','Property manager'],
  ['Property manager','manager-empty','Queue, nothing matches','Property manager'],
  ['Property manager','property-switch','Choose a property','Property manager'],
  ['Property manager','tenant-access','Tenant access note','Property manager']
];
H.screens = {};
H.screen = (id, def) => { H.screens[id] = def; };
H.title = id => (H.REGISTRY.find(r=>r[1]===id)||[])[2] || id;

/* ---------- Router ---------- */
let hist = [];
H.go = (id, opts={}) => { if(!opts.replace) hist.push(current()); location.hash = id; };
H.back = (fallback='home') => { const prev = hist.pop(); location.hash = prev && prev!==current() ? prev : fallback; };
const current = () => (location.hash.slice(1) || 'home');
function render(){
  clearTimeout(H._t);
  const id = current(), def = H.screens[id], root = document.getElementById('app');
  if (!root) return;
  H.save();
  root.innerHTML = def ? def.render(H.S) : H.header({title:H.title(id), back:true}) + `<div class="todo"><b>${H.title(id)}</b><br>This screen hasn’t been built yet.</div>`;
  document.title = H.title(id) + ' · Handy';
  root.querySelectorAll('[data-go]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); H.go(el.dataset.go); }));
  root.querySelectorAll('[data-back]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); H.back(el.dataset.back||'home'); }));
  if (def && def.after) def.after(root, H.S);
  window.scrollTo(0,0);
  const th = root.querySelector('.thread'); if (th) th.scrollTop = th.scrollHeight;
  const h = root.querySelector('h1,.hd .n'); if (h && document.activeElement===document.body) { h.setAttribute('tabindex','-1'); }
  if (parent !== window) parent.postMessage({handyScreen:id}, '*');
}
window.addEventListener('hashchange', render);
document.addEventListener('DOMContentLoaded', render);

/* ---------- UI helpers ---------- */
H.header = ({title='Handy', sub='Your repair helper', back=false, backTo='home', action=''}={}) => `
  <header class="hd">
    ${back ? `<button class="back" data-back="${backTo}" aria-label="Go back">${H.icon('back')}</button>` : ''}
    <div class="av">${H.icon('wrench')}</div>
    <div class="grow"><div class="n">${title}</div><div class="s">${sub}</div></div>
    ${action}
  </header>`;
H.pin = (t, s, step) => `<div class="pin" role="status"><div class="grow" style="flex:1"><div class="t">${t}</div><div class="s">${s}</div></div>
  <div class="trk" aria-label="Step ${step} of 3">${[1,2,3].map(i=>`<b class="${i<=step?'on':''}"></b>`).join('')}</div></div>`;
H.h = (html) => `<div class="bu h">${html}</div>`;
H.u = (html) => `<div class="bu u">${html}</div>`;
H.photo = () => `<div class="bu u photo">${H.sinkArt}</div>`;
H.typing = () => `<div class="typing" aria-label="Handy is typing"><i></i><i></i><i></i></div>`;
H.demo = (txt='Demo · simulated data') => `<span class="tag demo">${txt}</span>`;
H.stars = p => `<span>${H.icon('star','star')} ${p.rating} (${p.reviews} reviews)</span>`;
H.chips = items => `<div class="qr">${items.map(([label,go])=>`<button type="button" data-go="${go}">${label}</button>`).join('')}</div>`;
H.composer = (ph='Message Handy') => `<form class="cmp" onsubmit="event.preventDefault();H.toast('In the prototype, use the buttons above.')"><label class="sr" for="cmp">Message</label><input id="cmp" class="in" placeholder="${ph}"><button class="go" aria-label="Send">${H.icon('send')}</button></form>`;
H.dock = (inner) => `<div class="dock">${inner}</div>`;
H.slot = id => H.data.slots.find(s=>s.id===id);
H.toast = (msg) => { const t=document.createElement('div'); t.className='toast'; t.setAttribute('role','status'); t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2600); };
/* Auto-advance used by simulated loading screens; cancelled on navigation */
H.after = (ms, id) => { clearTimeout(H._t); H._t = setTimeout(()=>H.go(id,{replace:true}), ms); };
})();
