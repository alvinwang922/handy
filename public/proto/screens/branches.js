/* Handy prototype — error, branch and edge-state screens (owner: branches builder).
   Red is reserved for the emergency screen; every other problem uses neutral or amber tones. */
(function(){
const {icon, header, pin, h, u, demo, dock, stars} = H;
const D = H.data;
const dollars = n => '$' + n;
const hd = (title='Handy', sub='Your repair helper') => header({title, sub, back:true});
const thread = inner => `<div class="thread">${inner}</div>`;
const actions = (primary, secondary='') => dock(`<div style="display:flex;flex-direction:column;gap:10px">${primary}${secondary}</div>`);
const goBtn = (label, go, cls='') => `<button type="button" class="btn block ${cls}" data-go="${go}">${label}</button>`;

/* Scoped styles, injected once */
if (typeof document !== 'undefined' && document.head && !document.getElementById('br-css')) {
  const st = document.createElement('style'); st.id = 'br-css';
  st.textContent = `
  .br-steps{list-style:none;margin:0 0 20px;padding:0;display:flex;flex-direction:column;gap:14px;counter-reset:s}
  .br-steps li{display:flex;gap:14px;align-items:flex-start;font-size:19px;line-height:1.35;counter-increment:s}
  .br-steps li::before{content:counter(s);flex:none;width:36px;height:36px;border-radius:50%;background:var(--red);color:#fff;font-weight:800;display:grid;place-items:center;font-size:18px}
  .br-steps.calm li::before{background:var(--green)}
  .br-steps b{display:block}
  .br-steps span{font-size:16px;color:var(--ink2)}
  .br-tx{display:flex;flex-direction:column;gap:12px;margin:16px 0}
  .br-tx .who{font-size:14px;font-weight:700;color:var(--ink2);margin-bottom:2px}
  .br-tx .ai .bu{background:var(--bubble)}
  .br-tx .pro{align-self:flex-end;text-align:right}
  .br-tx .pro .bu{background:var(--green-tint);text-align:left}
  .br-tx > div{display:flex;flex-direction:column;max-width:88%}
  .br-tx .bu{max-width:100%}
  .br-split{display:flex;gap:14px;font-size:15px;color:var(--ink2);margin-top:4px}
  .br-unclear{font-size:22px;font-weight:800;line-height:1.2}
  .br-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}`;
  document.head.appendChild(st);
}

const quoteCard = (p, {chooseLabel=true}={}) => `
  <div class="qc">
    <div class="top"><div class="qn">${p.name}</div><div class="price">${dollars(p.price)}</div></div>
    <div class="br-split"><span>Parts ${dollars(p.parts)}</span><span>Work ${dollars(p.labor)}</span></div>
    <div class="meta"><span>${icon('clock')} ${p.when}</span><span>${icon('shield')} ${p.guarantee}</span>${stars(p)}</div>
    ${p.pick ? `<div class="br-row"><span class="tag">${icon('check')} Our pick</span></div>` : ''}
    <div class="why">${p.why}</div>
    <div class="ln"></div>
    <div class="btns"><button type="button" class="btn ${p.pick?'':'ghost'}" data-choose="${p.id}">${chooseLabel ? 'Choose ' + p.name.split(' ')[0] : 'Choose'}</button></div>
  </div>`;
const bindChoose = root => root.querySelectorAll('[data-choose]').forEach(b => b.addEventListener('click', () => {
  H.S.providerId = b.dataset.choose; H.save(); H.go('approve');
}));

/* ---------- Report a problem ---------- */
H.screen('photo-permission', { render: () =>
  hd('Add a photo', 'Camera is turned off') + `<div class="page">
    <h1>Handy can’t use your camera</h1>
    <p class="lead">Your phone has the camera turned off for this app. That’s fine. You can pick a photo you already took.</p>
    <h2>To turn the camera on</h2>
    <ol class="br-steps calm">
      <li><div><b>Open your phone’s Settings</b><span>The gray gear icon</span></div></li>
      <li><div><b>Find your web browser</b><span>For example Safari or Chrome</span></div></li>
      <li><div><b>Turn on Camera</b><span>Then come back here</span></div></li>
    </ol>
    <div class="note">${icon('info')}<span>Handy only uses the camera when you tap to take a photo.</span></div>
  </div>` + actions(goBtn(`${icon('image')} Choose from my photos`, 'new-details'),
    `<button type="button" class="btn block ghost" data-go="new-details">Use the sample photo</button><div style="text-align:center">${demo('Demo')}</div>`)
});

H.screen('photo-error', { render: () =>
  hd() + pin('New repair', 'Adding a photo', 1) + thread(
    h(`<p>Your photo didn’t come through. This usually means a weak signal.</p><p>Want to try again? You can also keep going without a photo and describe the problem instead.</p>`) +
    `<div class="note amber">${icon('alert')}<span>Photo didn’t upload. Nothing was lost.</span></div>`
  ) + actions(goBtn(`${icon('camera')} Try again`, 'new-photo'), goBtn('Continue without a photo', 'new-details', 'ghost'))
});

H.screen('details-error', {
  render: S => hd('Where and what', 'Tell Handy a little more') + `<div class="page">
    <h1>Just two more things</h1>
    <p class="lead">Fill these in so Handy knows what to look for.</p>
    <form id="br-details" novalidate>
      <div class="field"><label for="br-prop">Which home?</label>
        <select id="br-prop">${D.properties.map(p=>`<option value="${p.id}" ${p.id===S.propertyId?'selected':''}>${p.name} · ${p.unit}</option>`).join('')}</select></div>
      <div class="field err" id="f-room"><label for="br-room">Which room?</label>
        <select id="br-room" aria-describedby="m-room" aria-invalid="true"><option value="">Choose a room</option>${D.rooms.map(r=>`<option>${r}</option>`).join('')}</select>
        <div class="msg" id="m-room">${icon('alert')} Choose the room where the problem is.</div></div>
      <div class="field err" id="f-desc"><label for="br-desc">What’s happening?</label>
        <textarea id="br-desc" aria-describedby="m-desc" aria-invalid="true" placeholder="For example: water is dripping under the sink"></textarea>
        <div class="msg" id="m-desc">${icon('alert')} Write a few words about the problem, like “water dripping under the sink”.</div></div>
    </form>
  </div>` + actions(`<button type="submit" form="br-details" class="btn block">Ask Handy</button>`),
  after(root, S){
    const form = root.querySelector('#br-details');
    const check = () => {
      const room = root.querySelector('#br-room'), desc = root.querySelector('#br-desc');
      const okR = !!room.value, okD = desc.value.trim().length >= 3;
      root.querySelector('#f-room').classList.toggle('err', !okR); room.setAttribute('aria-invalid', !okR);
      root.querySelector('#m-room').style.display = okR ? 'none' : '';
      root.querySelector('#f-desc').classList.toggle('err', !okD); desc.setAttribute('aria-invalid', !okD);
      root.querySelector('#m-desc').style.display = okD ? 'none' : '';
      return [okR, okD, room, desc];
    };
    root.querySelector('#br-room').addEventListener('change', check);
    root.querySelector('#br-desc').addEventListener('input', check);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const [okR, okD, room, desc] = check();
      if (!okR) return room.focus();
      if (!okD) return desc.focus();
      S.propertyId = root.querySelector('#br-prop').value; S.room = room.value; S.desc = desc.value.trim(); H.save();
      H.go('diagnosing');
    });
  }
});

/* ---------- Diagnosis ---------- */
H.screen('diagnosis-unsure', { render: S =>
  hd() + pin('Kitchen sink', 'Handy is looking', 1) + thread(
    H.photo() + u(S.desc) +
    h(`<p>I’m <b>not sure</b> yet. It could be a loose pipe, or water coming from the tap above.</p>`) +
    `<div class="qc"><div class="top"><div class="qn">Best guess: leak under the sink</div></div>
      <div class="br-row"><span class="tag amber">Not sure</span>${demo()}</div>
      <div class="why">Rough guess at the price: <b>$120–$300</b>. A plumber can tell you more once they hear the details.</div></div>` +
    h(`<p>One quick question: <b>does the water appear when the tap is running?</b></p>`)
  ) + dock(H.chips([['Yes, only then','diagnosis'],['No, all the time','diagnosis'],['I don’t know','diagnosis']]) +
    goBtn(`${icon('phone')} Ask a plumber to take a look`, 'calling', 'ghost'))
});

H.screen('emergency', { render: () =>
  hd('Safety first', 'This could be dangerous') + `<div class="page">
    <div class="note red" style="font-size:17px;margin-bottom:20px">${icon('alert')}<span><b>You mentioned a gas smell, sparks or flooding.</b> Please do these steps now. Handy will not call plumbers for this.</span></div>
    <ol class="br-steps">
      <li><div><b>Leave the home now</b><span>Take people and pets with you.</span></div></li>
      <li><div><b>Don’t touch light switches</b><span>Don’t use lighters or plug anything in.</span></div></li>
      <li><div><b>Call 911 from outside</b><span>For gas, also call your gas company.</span></div></li>
      <li><div><b>If water is flooding</b><span>Turn off the main water valve only if it is safe.</span></div></li>
    </ol>
  </div>` + actions(`<a class="btn block danger" href="tel:911">${icon('phone')} Call 911</a>`, goBtn('I’m safe now', 'home', 'ghost'))
});

/* ---------- Getting prices ---------- */
const callRow = (name, sub, st, cls, ic) => `<div class="call"><div class="av">${icon('wrench')}</div><div class="who"><div class="t">${name}</div><div class="s">${sub}</div></div><span class="st ${cls}">${icon(ic)} ${st}</span></div>`;

H.screen('calling-trouble', { render: () =>
  hd() + pin('Getting prices', '1 of 3 plumbers answered', 2) + thread(
    `<div class="calls">
      ${callRow('Clearwater Plumbing','Gave a price','Got a price','ok','check')}
      ${callRow('Oak & Pipe Services','Rang with no answer','Didn’t pick up','wait','x')}
      ${callRow('Neighborhood Fix','Line was busy','Busy','wait','clock')}
    </div><div>${demo('Demo · simulated calls')}</div>` +
    h(`<p>Two plumbers didn’t answer. I won’t call them again on my own.</p><p>You can look at the price I have, or I can try a different plumber.</p>`)
  ) + actions(goBtn('Show the price I have', 'quotes'), goBtn('Try another plumber', 'calling', 'ghost'))
});

H.screen('transcript', { render: () =>
  hd('Call with Clearwater', 'What was said') + `<div class="page">
    <div class="br-row" style="margin-top:0">${demo('Demo · simulated call')}</div>
    <div class="note" style="margin-top:12px">${icon('info')}<span>This call was made by an AI assistant. It told the plumber so at the start.</span></div>
    <div class="br-tx">${D.transcript.map(([who, line]) => `<div class="${who==='Handy'?'ai':'pro'}"><div class="who">${who==='Handy'?'Handy (AI)':who}</div><div class="bu">${line}</div></div>`).join('')}</div>
    <div class="note">${icon('shield')}<span>Nothing was booked on this call.</span></div>
  </div>` + actions(`<button type="button" class="btn block ghost" data-back="quotes">Back</button>`)
});

H.screen('no-quotes', {
  render: () => hd() + pin('Getting prices', 'No prices yet', 2) + thread(
    `<div class="calls">
      ${callRow('Clearwater Plumbing','Wants to see it first','No price','wait','info')}
      ${callRow('Oak & Pipe Services','Rang with no answer','Didn’t pick up','wait','x')}
      ${callRow('Neighborhood Fix','Doesn’t do this kind of job','No price','wait','info')}
    </div><div>${demo('Demo · simulated calls')}</div>` +
    h(`<p>I’m sorry, none of the plumbers gave a price this time. Nothing was booked.</p><p>What would you like to do?</p>`)
  ) + dock(`<div style="display:flex;flex-direction:column;gap:10px">${goBtn('Try 3 more plumbers','calling')}${goBtn('Change the description','new-details','ghost')}<button type="button" class="btn plain" id="br-help" style="align-self:center">Get help</button></div>`),
  after(root){ root.querySelector('#br-help').addEventListener('click', () => H.toast('A person from Handy will text you within a day.')); }
});

H.screen('notice-credit', { render: () =>
  hd() + pin('Getting prices', 'Calling is paused', 2) + thread(
    h(`<p>I had to stop calling for now. The calling service has a limit, and we reached it.</p><p><b>Nothing was booked</b> and you won’t be charged.</p>`) +
    `<div class="note amber">${icon('clock')}<span>Calling paused · 1 price so far ${demo('Demo')}</span></div>`
  ) + actions(goBtn('Show prices so far', 'quotes'), goBtn('Try again later', 'home', 'ghost'))
});

/* ---------- Choose ---------- */
H.screen('quotes-all', {
  render: () => hd() + pin('Prices are in', '3 plumbers gave a price', 2) + thread(
    h(`<p>Here are all 3 prices side by side. I’d pick <b>Clearwater</b>.</p>`) +
    `<div>${demo()}</div>` + D.providers.map(p => quoteCard(p)).join('') +
    `<button type="button" class="btn plain" data-go="transcript" style="align-self:center">See what was said</button>`
  ),
  after: bindChoose
});

H.screen('quote-unclear', {
  render: () => {
    const others = D.providers.filter(p => p.id !== 'clearwater');
    return hd() + pin('Prices are in', '2 clear prices, 1 unclear', 2) + thread(
      h(`<p>One plumber wouldn’t give a clear price on the phone. The other two did.</p>`) + `<div>${demo()}</div>` +
      `<div class="qc">
        <div class="top"><div class="qn">Clearwater Plumbing</div><span class="tag amber">Unclear price</span></div>
        <p class="br-unclear" style="margin:10px 0 4px">Couldn’t get a clear price</p>
        <div class="why" style="margin-top:0">They want to see it first. Visit fee <b>$60</b>.</div>
        <div class="meta">${stars(D.providers[0])}</div>
        <div class="ln"></div>
        <div class="btns"><button type="button" class="btn ghost" data-go="transcript">${icon('phone')} Listen to what they said</button></div>
      </div>` + others.map(p => quoteCard(p)).join('')
    );
  },
  after: bindChoose
});

/* ---------- Book ---------- */
H.screen('booking-failed', {
  render: S => {
    const p = H.prov(S.providerId) || D.providers[0];
    const alt = [['Wed, Oct 14 · 9–11 am','w1'],['Wed, Oct 14 · 1–3 pm','w2'],['Thu, Oct 15 · 9–11 am','t1']];
    return hd() + pin('Booking', 'Times didn’t work', 3) + thread(
      h(`<p>${p.name} can’t come at the times you picked.</p><p>They can come at one of these instead. <b>Nothing has been charged.</b></p>`) + `<div>${demo()}</div>`
    ) + dock(`<div class="slots" style="margin-bottom:10px">${alt.map(([t,id])=>`<button type="button" data-alt="${id}" aria-pressed="false">${t.split(' · ')[0]}<small>${t.split(' · ')[1]}</small></button>`).join('')}</div>
      <div style="display:flex;flex-direction:column;gap:10px"><button type="button" class="btn block" id="br-ok" disabled>Book this time</button>${goBtn('Pick other times','schedule','ghost')}</div>`);
  },
  after(root){
    const ok = root.querySelector('#br-ok');
    root.querySelectorAll('[data-alt]').forEach(b => b.addEventListener('click', () => {
      root.querySelectorAll('[data-alt]').forEach(x => x.setAttribute('aria-pressed', x === b));
      ok.disabled = false;
    }));
    ok.addEventListener('click', () => H.go('booking'));
  }
});
})();
