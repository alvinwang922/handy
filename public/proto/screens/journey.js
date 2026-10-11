/* Main journey (coordinator): home → photo → details → diagnosis → calling → quotes → approve → schedule → booking → booked */
(function(){
const {icon} = H;
/* Timers only fire while their screen is still showing */
const later = (ms, fn) => { const id = location.hash.slice(1); setTimeout(() => { if (location.hash.slice(1) === id) fn(); }, ms); };

const sinkPin = (sub, step) => H.pin('Kitchen sink leak', sub, step);
const P = () => H.prov(H.S.providerId) || H.data.providers[0];

/* Shared earlier thread so each later screen reads as the same conversation */
const intro = S => `
  <div class="day">Today, 2:31 pm</div>
  ${H.photo()}
  ${H.u(S.desc)}
  ${H.h(`<p>Thanks, that photo helps.</p>`)}`;
const diagMsg = () => {
  const d = H.data.diagnosis;
  return H.h(`<p>It looks like a <b>${d.cause.toLowerCase()}</b> under the sink. I’m <b>${d.confidence.toLowerCase()}</b> about this.</p>
    <p>A plumber usually charges <b>$${d.cost[0]}–$${d.cost[1]}</b> for this. It’s not an emergency, but best fixed this week.</p>`);
};

H.screen('home', { render: S => `
  ${H.header({action:`<button class="act" data-go="welcome">${icon('info')} How it works</button>`})}
  <div class="page">
    <h1>Hi Jamie</h1>
    <p class="lead">Something broken at Maple House? Send a photo and I’ll handle the calls.</p>
    <button class="btn block" data-go="new-photo">${icon('camera')} Report a problem</button>
    <h2>Your repairs</h2>
    <div class="list" style="border-top:1px solid var(--line)">
      <button class="row" data-go="booked">${icon('cal')}<span class="grow"><span class="t">Leak under the kitchen sink</span><br><span class="s">Booked · Clearwater · Mon, Oct 12 · 9–11 am</span></span>${icon('chev')}</button>
      <button class="row" data-go="quotes">${icon('list')}<span class="grow"><span class="t">AC isn’t cooling properly</span><br><span class="s">Prices are in · 3 to compare</span></span>${icon('chev')}</button>
      <button class="row" data-go="calling">${icon('phone')}<span class="grow"><span class="t">Bedroom door won’t latch</span><br><span class="s">Getting prices · 1 of 3 in</span></span>${icon('chev')}</button>
    </div>
    <p style="margin-top:16px">${H.demo()}</p>
  </div>`});

H.screen('new-photo', { render: S => `
  ${H.header({back:true, sub:'New repair'})}
  <div class="thread">
    ${H.h(`<p>Hi Jamie. What needs fixing?</p><p>Send me a photo of the problem. Get close, and show any water or damage.</p>`)}
  </div>
  ${H.dock(`
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn" data-go="new-details">${icon('camera')} Take a photo</button>
      <button class="btn ghost" data-go="new-details">${icon('image')} Choose from my photos</button>
      <button class="btn plain" data-go="new-details">Use the sample photo (Demo)</button>
    </div>`)}`});

H.screen('new-details', {
  render: S => `
  ${H.header({back:true, sub:'New repair'})}
  <div class="thread">
    ${H.h(`<p>Send me a photo of the problem.</p>`)}
    ${H.photo()}
    ${H.h(`<p>Got it. Which room is it in, and what’s happening?</p>`)}
  </div>
  ${H.dock(`
    <form id="det" novalidate>
      <div class="field"><span id="roomL" style="font-weight:700">Room</span>
        <div class="qr" role="group" aria-labelledby="roomL" style="margin:0">${H.data.rooms.map(r=>`<button type="button" class="room" aria-pressed="${r===S.room}">${r}</button>`).join('')}</div></div>
      <div class="field"><label for="desc">What’s happening?</label>
        <textarea id="desc" style="min-height:80px">${S.desc}</textarea>
        <span class="hint">Mention any smell of gas, sparks or flooding.</span></div>
      <button class="btn block">Send to Handy ${icon('arrow')}</button>
    </form>`)}`,
  after: (root, S) => {
    root.querySelectorAll('.room').forEach(b => b.onclick = () => { S.room = b.textContent; root.querySelectorAll('.room').forEach(x=>x.setAttribute('aria-pressed', x===b)); });
    root.querySelector('#det').onsubmit = e => {
      e.preventDefault(); const d = root.querySelector('#desc').value.trim(); S.desc = d;
      if (!d || !S.room) return H.go('details-error');
      if (/gas|spark|fire|smoke|flood/i.test(d)) return H.go('emergency');
      H.go('diagnosing');
    };
  }});

H.screen('diagnosing', {
  render: S => `
  ${H.header({back:true, sub:'Looking at your photo…'})}
  ${sinkPin('Looking at your photo', 1)}
  <div class="thread">${intro(S)}${H.typing()}</div>
  ${H.dock(`<p class="meta-line">${icon('clock')} This takes a few seconds.</p>`)}`,
  after: () => H.after(2200, 'diagnosis')});

H.screen('diagnosis', { render: S => `
  ${H.header({back:true})}
  ${sinkPin('Handy’s best guess', 1)}
  <div class="thread">${intro(S)}${diagMsg()}
    ${H.h(`<p>Want me to call 3 plumbers near you for prices? I won’t book anything without your yes.</p>`)}
  </div>
  ${H.dock(`
    <button class="btn block" data-go="calling">${icon('phone')} Yes, get me prices</button>
    <div class="qr" style="margin:10px 0 0">
      <button type="button" data-go="diagnosis-unsure">That’s not it</button>
      <button type="button" data-go="emergency">It’s getting worse fast</button>
    </div>
    <p class="meta-line" style="margin-top:8px">${icon('info')} This is a first guess from a photo, not an inspection.</p>`)}`});

const callRow = (p, st) => {
  const m = {
    wait:['wait', `${icon('clock')} Waiting`], ring:['live', `${icon('phone')} Ringing`],
    talk:['live', `<span class="bars" aria-hidden="true"><i></i><i></i><i></i></span> Talking`],
    done:['ok', `${icon('check')} Got a price`] }[st];
  return `<div class="call"><div class="who"><div class="t">${p.name}</div><div class="s">${icon('star','star')} ${p.rating} · ${p.reviews} reviews</div></div><span class="st ${m[0]}">${m[1]}</span></div>`;
};
const PLAN = [ ['ring','wait','wait'], ['talk','ring','wait'], ['talk','talk','ring'], ['done','talk','talk'], ['done','done','talk'], ['done','done','done'] ];

H.screen('calling', {
  render: S => `
  ${H.header({back:true})}
  ${sinkPin('Getting prices · 0 of 3 in', 2)}
  <div class="thread">${diagMsg()}
    ${H.u('Yes, get me prices')}
    ${H.h(`<p>Calling 3 plumbers now. I tell each one I’m an AI assistant, and I don’t give them your address or book anything.</p>`)}
    <div class="calls" id="calls" aria-live="polite"></div>
    <a href="#transcript" class="meta-line" style="color:var(--green);font-weight:700">See what’s being said</a>
  </div>
  ${H.dock(`<button class="btn block" id="see" disabled>Waiting for prices…</button>
    <p class="meta-line" style="margin-top:8px">${H.demo('Demo · simulated calls')} You can leave. I’ll message you.</p>`)}`,
  after: (root) => {
    const box = root.querySelector('#calls'), pin = root.querySelector('.pin .s'), see = root.querySelector('#see');
    const step = i => {
      const row = PLAN[i]; box.innerHTML = H.data.providers.map((p,k)=>callRow(p,row[k])).join('');
      const n = row.filter(x=>x==='done').length; pin.textContent = `Getting prices · ${n} of 3 in`;
      if (n===3) { see.disabled = false; see.textContent = 'See the 3 prices'; see.onclick = () => H.go('quotes'); }
    };
    step(0); PLAN.forEach((_,i)=> i && later(i*1100, ()=>step(i)));
  }});

const quoteCard = (p, primary=true) => `
  <div class="qc">
    <div class="top"><div class="qn">${p.name}</div><div class="price">$${p.price}</div></div>
    <div class="meta">${H.stars(p)}<span>${icon('clock')} ${p.when}</span><span>${icon('shield')} ${p.guarantee}</span></div>
    ${p.pick ? `<div class="why"><span class="tag">${icon('check')} Our pick</span><p style="margin:6px 0 0">${p.why}</p></div>` : `<div class="why">${p.why}</div>`}
    <div class="ln"></div>
    <div class="btns">
      <button class="btn${primary?'':' ghost'}" data-choose="${p.id}">Choose ${p.name.split(' ')[0]}</button>
    </div>
  </div>`;
const bindChoose = root => root.querySelectorAll('[data-choose]').forEach(b => b.onclick = () => { H.S.providerId = b.dataset.choose; H.go('approve'); });

H.screen('quotes', {
  render: S => `
  ${H.header({back:true})}
  ${sinkPin('Prices are in · 3 of 3', 2)}
  <div class="thread">
    ${H.h(`<p>All 3 plumbers answered. Here’s the one I’d pick. Prices include parts and labor.</p>`)}
    ${quoteCard(H.data.providers[0])}
    ${H.h(`<p>Neighborhood Fix is cheaper at <b>$160</b>, but can’t come for 2 days.</p>`)}
  </div>
  ${H.dock(H.chips([['Compare all 3','quotes-all'],['What did they say?','transcript'],['One price is unclear','quote-unclear']]))}`,
  after: bindChoose});

H.screen('approve', { render: S => { const p = P(); return `
  ${H.header({back:true, sub:'Check before you say yes'})}
  <div class="page">
    <h1>Book ${p.name} for $${p.price}?</h1>
    <p class="lead">Nothing is booked until you say yes.</p>
    <div class="qc" style="box-shadow:none">
      <div class="list">
        <div class="row" style="cursor:default"><span class="grow"><span class="s">Job</span><br><span class="t">Fix the leak under the kitchen sink</span></span></div>
        <div class="row" style="cursor:default"><span class="grow"><span class="s">Price</span><br><span class="t">$${p.price} total</span> <span class="s">(parts $${p.parts}, labor $${p.labor})</span></span></div>
        <div class="row" style="cursor:default"><span class="grow"><span class="s">Where</span><br><span class="t">Maple House, 124 Maple Avenue</span></span></div>
        <div class="row" style="cursor:default;border-bottom:0"><span class="grow"><span class="s">Guarantee</span><br><span class="t">${p.guarantee}</span></span></div>
      </div>
    </div>
    <div class="note" style="margin-top:16px">${icon('info')}<span>If they find a bigger problem on site, they must ask you before charging more. Their address is shared only after you say yes.</span></div>
  </div>
  ${H.dock(`<button class="btn block" data-go="schedule">${icon('check')} Yes, book it for $${p.price}</button>
    <div style="display:flex;justify-content:center;margin-top:6px"><button class="btn plain" data-back="quotes">Not yet, go back</button></div>`)}`; }});

H.screen('schedule', {
  render: S => `
  ${H.header({back:true, sub:'When can they come?'})}
  <div class="page">
    <h1>When can ${P().name.split(' ')[0]} come?</h1>
    <p class="lead">Pick every time that works. I’ll ask for the first one they can do.</p>
    <div class="slots" role="group" aria-label="Times that work">
      ${H.data.slots.map(s=>`<button type="button" data-slot="${s.id}" aria-pressed="${S.slots.includes(s.id)}">${s.day}<small>${s.time}</small></button>`).join('')}
    </div>
    <div class="field" style="margin:8px 0 0"><p class="msg" id="slotErr" role="alert" hidden>${icon('alert')} Pick at least one time.</p></div>
    <div class="field" style="margin-top:20px"><label for="acc">How do they get in?</label>
      <textarea id="acc" style="min-height:80px">${S.access}</textarea>
      <span class="hint">Only shared with the plumber you booked.</span></div>
  </div>
  ${H.dock(`<button class="btn block" id="bk">${icon('phone')} Call to book</button>`)}`,
  after: (root, S) => {
    root.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => {
      const id = b.dataset.slot, on = !S.slots.includes(id);
      S.slots = on ? [...S.slots, id] : S.slots.filter(x=>x!==id); b.setAttribute('aria-pressed', on); H.save();
    });
    root.querySelector('#bk').onclick = () => {
      S.access = root.querySelector('#acc').value;
      if (!S.slots.length) { root.querySelector('#slotErr').hidden = false; return; }
      S.confirmedSlot = H.data.slots.find(s=>S.slots.includes(s.id)).id; H.go('booking');
    };
  }});

H.screen('booking', {
  render: S => `
  ${H.header({back:true})}
  ${sinkPin('Booking ' + P().name, 3)}
  <div class="thread">
    ${H.u(`Yes, book it for $${P().price}`)}
    ${H.h(`<p>Calling ${P().name} to book a time. I’ll tell them how to get in.</p>`)}
    <div class="call"><div class="who"><div class="t">${P().name}</div><div class="s">Booking call</div></div><span class="st live"><span class="bars" aria-hidden="true"><i></i><i></i><i></i></span> Talking</span></div>
  </div>
  ${H.dock(`<p class="meta-line">${H.demo('Demo · simulated call')} Usually under a minute.</p>`)}`,
  after: () => H.after(2600, 'booked')});

H.screen('booked', { render: S => { const p = P(), s = H.slot(S.confirmedSlot); return `
  ${H.header({back:true, backTo:'home'})}
  ${sinkPin('Booked · ' + s.day, 3)}
  <div class="thread">
    ${H.h(`<p>Calling ${p.name} to book a time.</p>`)}
    <div class="qc">
      <div class="top"><div class="qn" style="display:flex;gap:8px;align-items:center">${icon('cal')} You’re booked</div><span class="tag">${icon('check')} Confirmed</span></div>
      <p style="margin:8px 0 0">I called ${p.name} and they confirmed.</p>
      <p style="font-size:24px;font-weight:800;margin:8px 0 2px">${s.day} · ${s.time}</p>
      <p class="meta-line">$${p.price} · ${p.guarantee}</p>
      <div class="ln"></div>
      <div class="btns"><button class="btn ghost" id="ics">${icon('cal')} Add to my calendar</button></div>
    </div>
    ${H.h(`<p>I’ll remind you the day before. Tell me if anything changes.</p>`)}
  </div>
  ${H.dock(H.chips([['Change the time','reschedule'],['It’s fixed','done'],['What happened so far','activity'],['Back home','home']]))}`; },
  after: root => root.querySelector('#ics').onclick = () => H.toast('Calendar file downloaded (handy-repair.ics)')});
})();
