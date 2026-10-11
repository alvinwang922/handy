/* report.js — #/new: report a problem as a chat with Handy (photo, room, what's happening, name, urgency). */
(function(){
const H = window.H;
const ROOMS = ['Kitchen', 'Bathroom', 'Living room', 'Bedroom', 'Exterior', 'Other'];
const URGENCY = [
  ['Routine', 'Routine', 'Whenever is easy, in the next few weeks.'],
  ['Soon', 'Soon', 'This week, before it gets worse.'],
  ['Urgent', 'Urgent', 'Today or tomorrow. You can’t use something you need.']
];
const SAMPLE = '/assets/sample-sink.svg';
const MAX_PHOTOS = 3, MAX_SIDE = 1568, MAX_BYTES = 5 * 1024 * 1024;
const DRAFT_KEY = 'handy-report-draft';
const BAD_TYPE = 'That photo type can’t be read. Try a JPG or PNG, or take a new photo.';

/* ---------- Module state (survives core re-renders; text also survives reload) ---------- */
const blank = () => ({ title:'', description:'', property:null, room:null, urgency:'Soon', titleTouched:false,
  photos:[], processing:0, photoNote:'', errors:{}, pending:false, serverError:'' });
let S = blank();
try {
  const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
  if (d) ['title','description','property','room','urgency','titleTouched'].forEach(k => { if (d[k] != null) S[k] = d[k]; });
} catch {}
const saveDraft = () => {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title:S.title, description:S.description, property:S.property, room:S.room, urgency:S.urgency, titleTouched:S.titleTouched })); } catch {}
};
const clearDraft = () => { try { sessionStorage.removeItem(DRAFT_KEY); } catch {} };

const isManager = st => st.role === 'manager';
const propertyFor = st => {
  if (!isManager(st)) return 'p1';
  const ids = (st.properties || []).map(p => p.id);
  if (S.property && ids.includes(S.property)) return S.property;
  if (st.propertyFilter && ids.includes(st.propertyFilter)) return st.propertyFilter;
  return ids[0] || 'p1';
};
const titleFrom = text => {
  const first = text.trim().split(/[.!?\n]/)[0].replace(/\s+/g, ' ').trim().split(' ').slice(0, 6);
  while (first.length > 2 && /^(and|or|but|the|a|an|is|are|of|to|in|on|at|with|from|under|my|when|it|its|that|so|all|very|really|not)$/i.test(first[first.length - 1].replace(/[^a-z']/gi, ''))) first.pop();
  const words = first.join(' ').replace(/[.,;:!?]+$/, '');
  const t = words.length > 60 ? words.slice(0, 60).replace(/\s+\S*$/, '') : words;
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};

/* ---------- CSS (injected once) ---------- */
if (!document.getElementById('css-report')) {
  const st = document.createElement('style'); st.id = 'css-report';
  st.textContent = `
.rp{display:flex;flex-direction:column;flex:1}
.rp .thread{gap:12px;padding:20px 16px 8px;overflow:visible}
.rp .step{align-self:stretch;display:flex;flex-direction:column;gap:12px;margin:4px 0 12px}
.rp .bu.h + .step{margin-top:0}
.rp .pick{display:flex;flex-wrap:wrap;gap:10px;align-items:center}
.rp .pick .btn{flex:1 1 220px;white-space:nowrap}
.rp .pick .btn.plain{flex:0 0 auto;min-height:48px;padding:0 8px}
.rp .shots{display:flex;flex-wrap:wrap;gap:10px;justify-content:flex-end}
.rp .shot{position:relative;width:132px;height:132px;border-radius:18px;border-bottom-right-radius:6px;background:var(--green);padding:4px}
.rp .shot img{display:block;width:100%;height:100%;object-fit:cover;border-radius:14px;background:var(--pinned)}
.rp .shot .rm{position:absolute;top:-6px;right:-6px;width:48px;height:48px;border:0;background:none;padding:0;display:grid;place-items:center;cursor:pointer;border-radius:50%}
.rp .shot .rm span{width:32px;height:32px;border-radius:50%;background:var(--ink);color:#fff;display:grid;place-items:center;box-shadow:0 2px 6px rgba(30,43,36,.25)}
.rp .shot .rm .ic{width:18px;height:18px}
.rp .shot .rm:hover span{background:var(--red)}
.rp .shot .lbl{position:absolute;left:10px;bottom:10px}
.rp .busy{display:flex;align-items:center;gap:10px;font-size:15px;color:var(--ink2);align-self:flex-end}
.rp .busy .typing{padding:10px 12px}
.rp .where{display:flex;align-items:center;gap:8px;font-size:17px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--pinned)}
.rp .where .ic{color:var(--green)}
.rp .field{margin-bottom:0}
.rp .field .lab{font-weight:700}
.rp .qr{margin:0}
.rp .qr button{min-height:48px}
.rp .urg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.rp .urg button{min-height:72px;border:1.5px solid #C9C3B6;border-radius:14px;background:#fff;cursor:pointer;text-align:left;padding:10px 14px;display:flex;flex-direction:column;justify-content:center;gap:2px}
.rp .urg button:hover{border-color:var(--green)}
.rp .urg button b{font-size:17px}
.rp .urg button small{font-size:15px;color:var(--ink2);line-height:1.3}
.rp .urg button[aria-pressed="true"]{border-color:var(--green);background:var(--green-tint);color:var(--green)}
.rp .urg button[aria-pressed="true"] small{color:var(--green-press)}
.rp .field.err .qr button{border-color:var(--red)}
.rp .count{font-size:15px;color:var(--ink3);text-align:right;font-variant-numeric:tabular-nums}
.rp .dock{display:flex;flex-direction:column;gap:8px}
.rp .dock .acts{display:flex;align-items:center;gap:12px}
.rp .dock .acts .btn.plain{min-height:52px;padding:0 12px}
.rp .dock .why{font-size:15px;color:var(--ink2);margin:0}
.rp .wait{display:flex;flex-direction:column;gap:10px;scroll-margin-bottom:calc(var(--dock-h,96px) + 16px)}
.rp .thread{padding-bottom:24px}
.rp .wait .say{font-size:15px;color:var(--ink2);display:flex;align-items:center;gap:8px}
.rp textarea::placeholder,.rp input::placeholder{color:var(--ink3)}
@media (max-width:639px){
  .rp .urg{grid-template-columns:1fr}
  .rp .urg button{min-height:60px}
  .rp .shot{width:104px;height:104px}
  .rp .pick .btn{flex-basis:100%}
}`;
  document.head.appendChild(st);
}

/* ---------- Render ---------- */
const errMsg = key => S.errors[key] ? `<span class="msg" id="err-${key}">${H.icon('alert')}${H.esc(S.errors[key])}</span>` : '';
const described = (key, extra) => [extra, S.errors[key] ? `err-${key}` : ''].filter(Boolean).join(' ');

const photosHtml = () => {
  const left = MAX_PHOTOS - S.photos.length - S.processing;
  const shots = S.photos.map((src, i) => `<div class="shot">
      <img src="${H.esc(src)}" alt="Your photo ${i + 1}${src === SAMPLE ? ' (sample sink photo)' : ''}">
      ${src === SAMPLE ? `<span class="lbl">${H.demo('Sample')}</span>` : ''}
      <button type="button" class="rm" data-rm="${i}" aria-label="Remove photo ${i + 1}" ${S.pending ? 'disabled' : ''}><span>${H.icon('x')}</span></button>
    </div>`).join('');
  return `
    ${S.photos.length ? `<div class="shots" aria-label="Photos you added">${shots}</div>` : ''}
    ${S.processing ? `<div class="busy" role="status">${H.typing()}<span>Getting your photo ready…</span></div>` : ''}
    ${S.photoNote ? `<div class="note amber" role="alert">${H.icon('info')}<span>${H.esc(S.photoNote)}</span></div>` : ''}
    ${S.pending ? '' : left > 0 ? `<div class="pick">
        <button type="button" class="btn ghost" data-pick="camera">${H.icon('camera')} Take a photo</button>
        <button type="button" class="btn ghost" data-pick="library">${H.icon('image')} ${S.photos.length ? 'Add another photo' : 'Choose from my photos'}</button>
        ${S.photos.includes(SAMPLE) ? '' : `<button type="button" class="btn plain" data-sample>Use the sample photo (Demo)</button>`}
      </div>
      <p class="meta-line">${H.icon('info')} Up to 3 photos. No photo? You can still send it.</p>`
      : `<p class="meta-line">${H.icon('check')} That’s 3 photos, the most Handy can take.</p>`}`;
};

const propertyHtml = st => {
  if (!isManager(st)) {
    const p = H.prop && H.prop('p1');
    return `<div class="where">${H.icon('home')}<span>${H.esc(p ? `${p.name} · ${p.unit}` : 'Maple House · Main home')}</span></div>`;
  }
  const cur = propertyFor(st);
  return `<div class="field"><label for="rp-prop">Which property?</label>
    <select id="rp-prop" ${S.pending ? 'disabled' : ''}>${(st.properties || []).map(p => `<option value="${H.esc(p.id)}" ${p.id === cur ? 'selected' : ''}>${H.esc(p.name)} · ${H.esc(p.unit)}</option>`).join('')}</select></div>`;
};

const render = st => {
  /* Fresh visit (not a same-route re-render): start clean; only typed text survives */
  if (H._lastRoute !== '#/new' && !S.pending) { S.errors = {}; S.serverError = ''; S.photoNote = ''; }
  const dis = S.pending ? 'disabled' : '';
  const firstName = (st.actor && st.actor.name ? st.actor.name.split(' ')[0] : '');
  const hasPhoto = S.photos.length > 0;
  return `<form class="rp" novalidate aria-busy="${S.pending}">
  <div class="thread">
    ${H.h(`<p>${firstName ? `Hi ${H.esc(firstName)}. ` : ''}What needs fixing?</p><p>Send me a photo of the problem. Get close, and show any water or damage.</p>`)}
    <div class="step" id="rp-photos">${photosHtml()}</div>
    ${H.h(`<p>${hasPhoto ? 'Got it. ' : ''}Where is it, and what’s happening?</p>`)}
    <div class="step">
      ${propertyHtml(st)}
      <div class="field ${S.errors.room ? 'err' : ''}" id="f-room"><span class="lab" id="rp-room-l">Room</span>
        <div class="qr" role="group" aria-labelledby="rp-room-l" ${S.errors.room ? 'aria-describedby="err-room"' : ''}>
          ${ROOMS.map(r => `<button type="button" data-room="${H.esc(r)}" aria-pressed="${r === S.room}" ${dis}>${H.esc(r)}</button>`).join('')}
        </div>${errMsg('room')}</div>
      <div class="field ${S.errors.description ? 'err' : ''}"><label for="rp-desc">What’s happening?</label>
        <textarea id="rp-desc" maxlength="1200" placeholder="For example: water drips from the pipe under the sink when it runs." aria-describedby="${described('description', 'rp-desc-h')}" ${S.errors.description ? 'aria-invalid="true"' : ''} ${dis}>${H.esc(S.description)}</textarea>
        <span class="hint" id="rp-desc-h">Mention any smell of gas, sparks or flooding.</span>${errMsg('description')}</div>
      <div class="field ${S.errors.title ? 'err' : ''}"><label for="rp-title">Name it in a few words</label>
        <input id="rp-title" maxlength="120" autocomplete="off" placeholder="Leaky kitchen sink" value="${H.esc(S.title)}" aria-describedby="${described('title', 'rp-title-h')}" ${S.errors.title ? 'aria-invalid="true"' : ''} ${dis}>
        <span class="hint" id="rp-title-h">This is how the repair shows in your list.</span>${errMsg('title')}</div>
    </div>
    ${H.h('<p>How soon does it need fixing?</p>')}
    <div class="step">
      <div class="urg" role="group" aria-label="How soon">
        ${URGENCY.map(([v, head, sub]) => `<button type="button" data-urg="${v}" aria-pressed="${v === S.urgency}" ${dis}><b>${H.esc(head)}</b><small>${H.esc(sub)}</small></button>`).join('')}
      </div>
    </div>
    ${S.pending ? `<div class="wait">
      ${H.u(`<p>${H.esc(S.title)}</p>`)}
      <div class="say" role="status">${H.typing()}<span>${hasPhoto ? 'Looking at your photo…' : 'Reading what you wrote…'}</span></div>
    </div>` : ''}
  </div>
  <div class="dock">
    ${S.serverError ? `<div class="note red" role="alert">${H.icon('alert')}<span>${H.esc(S.serverError)}</span></div>` : ''}
    <div class="acts">
      <button type="submit" class="btn" id="rp-send" ${S.pending || S.processing ? 'disabled' : ''}>${S.pending ? 'Sending…' : S.processing ? 'Getting your photo ready…' : `Send to Handy ${H.icon('arrow')}`}</button>
      <a class="btn plain" href="#/" data-cancel>Cancel</a>
    </div>
  </div>
</form>`;
};

/* ---------- Photo processing ---------- */
const readUrl = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
const loadImg = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = src; });
const bytesOf = url => Math.ceil((url.length - url.indexOf(',') - 1) * 3 / 4);
const readable = file => {
  const name = (file.name || '').toLowerCase(), type = (file.type || '').toLowerCase();
  if (/hei[cf]/.test(type) || /\.(heic|heif)$/.test(name)) return false;
  if (type) return type.startsWith('image/');
  return /\.(jpe?g|png|webp|gif|bmp)$/.test(name);
};
async function toJpeg(file) {
  const img = await loadImg(await readUrl(file));
  let w = img.naturalWidth, h = img.naturalHeight;
  if (!w || !h) throw new Error('decode');
  let scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  for (let attempt = 0; attempt < 6; attempt++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(h * scale));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    for (const q of [0.85, 0.7, 0.55]) {
      const out = c.toDataURL('image/jpeg', q);
      if (!out.startsWith('data:image/jpeg;base64,')) throw new Error('encode');
      if (bytesOf(out) <= MAX_BYTES) return out;
    }
    scale *= 0.75;
  }
  throw new Error('size');
}

/* ---------- Bind ---------- */
const bind = root => {
  const form = root.querySelector('form.rp'); if (!form) return;
  const $ = s => form.querySelector(s);
  const st = H.state;

  const repaintPhotos = () => {
    const box = $('#rp-photos'); if (box) { box.innerHTML = photosHtml(); bindPhotos(); }
    const send = $('#rp-send');
    if (send && !S.pending) { send.disabled = !!S.processing; send.innerHTML = S.processing ? 'Getting your photo ready…' : `Send to Handy ${H.icon('arrow')}`; }
  };
  const clearErr = key => {
    if (!S.errors[key]) return;
    delete S.errors[key];
    const el = form.querySelector(`#err-${key}`), field = el && el.closest('.field');
    if (el) el.remove();
    if (field) { field.classList.remove('err'); field.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid')); }
  };

  /* Hidden file inputs live outside the re-rendered photo box */
  const mkInput = capture => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.hidden = true; inp.tabIndex = -1;
    if (capture) inp.setAttribute('capture', 'environment'); else inp.multiple = true;
    inp.setAttribute('aria-hidden', 'true');
    form.appendChild(inp);
    inp.addEventListener('change', () => { addFiles([...inp.files]); inp.value = ''; });
    return inp;
  };
  const camera = mkInput(true), library = mkInput(false);

  async function addFiles(files) {
    if (!files.length) return;
    S.photoNote = '';
    const room = MAX_PHOTOS - S.photos.length - S.processing;
    if (files.length > room) S.photoNote = `Handy can take ${MAX_PHOTOS} photos. I kept the first ${Math.max(room, 0)}.`;
    const take = files.slice(0, Math.max(room, 0));
    const bad = take.filter(f => !readable(f));
    if (bad.length) S.photoNote = BAD_TYPE;
    const good = take.filter(readable);
    S.processing += good.length; repaintPhotos();
    await Promise.all(good.map(async f => {
      try { const url = await toJpeg(f); if (S.photos.length < MAX_PHOTOS) S.photos.push(url); }
      catch (e) { S.photoNote = e && e.message === 'size' ? 'That photo is too large to send. Try taking a new one.' : BAD_TYPE; }
      finally { S.processing--; }
    }));
    if (form.isConnected) repaintPhotos(); else if (H.route && H.route.name === 'new') H.render();
  }

  function bindPhotos() {
    form.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => (b.dataset.pick === 'camera' ? camera : library).click()));
    const sample = $('[data-sample]');
    if (sample) sample.addEventListener('click', () => {
      if (S.photos.length + S.processing >= MAX_PHOTOS || S.photos.includes(SAMPLE)) return;
      S.photos.push(SAMPLE); S.photoNote = ''; repaintPhotos();
      const next = $('[data-pick="library"]') || $('[data-room]'); if (next) next.focus({preventScroll:true});
    });
    form.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      S.photos.splice(+b.dataset.rm, 1); S.photoNote = ''; repaintPhotos();
      const next = $('[data-rm]') || $('[data-pick]'); if (next) next.focus();
    }));
  }
  bindPhotos();

  const prop = $('#rp-prop');
  if (prop) prop.addEventListener('change', () => { S.property = prop.value; saveDraft(); });

  form.querySelectorAll('[data-room]').forEach(b => b.addEventListener('click', () => {
    S.room = b.dataset.room; saveDraft(); clearErr('room');
    form.querySelectorAll('[data-room]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));
  form.querySelectorAll('[data-urg]').forEach(b => b.addEventListener('click', () => {
    S.urgency = b.dataset.urg; saveDraft();
    form.querySelectorAll('[data-urg]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
  }));

  const desc = $('#rp-desc'), title = $('#rp-title');
  desc.addEventListener('input', () => {
    S.description = desc.value;
    if (!S.titleTouched) { S.title = titleFrom(desc.value); title.value = S.title; if (S.title) clearErr('title'); }
    if (desc.value.trim()) clearErr('description');
    saveDraft();
  });
  title.addEventListener('input', () => {
    S.title = title.value; S.titleTouched = title.value.trim() !== '';
    if (title.value.trim()) clearErr('title');
    saveDraft();
  });

  $('[data-cancel]').addEventListener('click', e => { e.preventDefault(); if (!S.pending) { clearDraft(); S = blank(); } H.go('#/'); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (S.pending || S.processing) return;
    S.description = desc.value; S.title = title.value;
    if (!S.title.trim() && S.description.trim()) { S.title = titleFrom(S.description); }
    const errors = {};
    if (!S.room) errors.room = 'Choose the room it’s in.';
    if (!S.description.trim()) errors.description = 'Tell Handy what’s happening, in a sentence or two.';
    if (!S.title.trim()) errors.title = 'Give it a short name, like “Leaky kitchen sink”.';
    S.errors = errors; S.serverError = '';
    if (Object.keys(errors).length) {
      H.render();
      const c = document.querySelector('.center form.rp');
      const first = errors.room ? c.querySelector('[data-room]') : errors.description ? c.querySelector('#rp-desc') : c.querySelector('#rp-title');
      if (first) { first.focus({preventScroll:true}); (first.closest('.field') || first).scrollIntoView({block:'center'}); }
      return;
    }
    const body = { title:S.title.trim(), description:S.description.trim(), property:propertyFor(st), room:S.room, urgency:S.urgency, photos:S.photos.slice() };
    S.pending = true; H.render();
    const scrollWait = () => {
      /* Scroll the pane to its end so the Handy typing bubble sits just above the pinned send bar */
      const c = document.querySelector('.center');
      if (c && c.scrollHeight > c.clientHeight) c.scrollTo({top:c.scrollHeight, behavior:'smooth'});
      window.scrollTo({top:document.documentElement.scrollHeight, behavior:'smooth'});
    };
    scrollWait();
    try {
      const { repair } = await H.api('POST', '/api/repairs', body);
      clearDraft(); S = blank();
      H.upsert(repair);
      if (H.route && H.route.name === 'new') H.go('#/repair/' + repair.id);
      else { H.toast('Sent to Handy. Your repair is in the list.'); H.render(); }
    } catch (err) {
      S.pending = false; S.serverError = err.message || 'Something went wrong. Please try again.';
      if (H.route && H.route.name === 'new') {
        H.render();
        const n = document.querySelector('.center form.rp .dock .note'); if (n) n.scrollIntoView({block:'nearest'});
        const b = document.querySelector('#rp-send'); if (b) b.focus({preventScroll:true});
      }
    }
  });
};

H.ui.report = { render, bind };
})();
