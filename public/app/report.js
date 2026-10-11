/* report.js — #/new: report a problem as a chat with Handy.
   One required thing (what's happening); photo, name and property are optional and quiet.
   On Send Handy runs on its own: create the repair, then (unless it is a hazard) ask pros for prices via H.autopilot.
   Room and urgency are no longer asked; the server still needs them, so we send room:'Other', urgency:'Soon'. */
(function(){
const H = window.H;
const SAMPLE = '/assets/sample-sink.svg';
const MAX_PHOTOS = 3, MAX_SIDE = 1568, MAX_BYTES = 5 * 1024 * 1024;
const DRAFT_KEY = 'handy-report-draft';
const DRAFT_FIELDS = ['title', 'description', 'property', 'titleTouched'];
const BAD_TYPE = 'That photo type can’t be read. Try a JPG or PNG, or take a new photo.';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- Module state (survives core re-renders; text also survives reload) ---------- */
const blank = () => ({ title:'', description:'', property:null, titleTouched:false,
  photos:[], processing:0, photoNote:'', errors:{}, pending:false, stage:'', serverError:'' });
let S = blank();
const saveDraft = () => {
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(Object.fromEntries(DRAFT_FIELDS.map(k => [k, S[k]])))); } catch {}
};
const clearDraft = () => { try { sessionStorage.removeItem(DRAFT_KEY); } catch {} };
try {
  const d = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
  if (d) {
    DRAFT_FIELDS.forEach(k => { if (d[k] != null) S[k] = d[k]; });
    if ('room' in d || 'urgency' in d) saveDraft(); /* drop old room/urgency fields from earlier drafts */
  }
} catch {}

const manager = () => (H.isManager ? H.isManager() : H.state.role === 'manager');
const propertyFor = st => {
  if (!manager()) return 'p1';
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
const titleFor = () => (S.title.trim() || titleFrom(S.description) || S.description.trim().slice(0, 60) || 'Repair').slice(0, 120);
const kindError = err => {
  if (!err || err.status === 0) return (err && err.message) || 'Can’t reach Handy right now. Please try again.';
  if (err.status >= 500) return 'Handy hit a snag on its side. Your words are still here, so please try again in a moment.';
  return `That didn’t send. ${err.message || 'Please try again.'}`;
};
const STAGE = {
  look: () => S.photos.length ? 'Looking at your photo…' : 'Reading what you wrote…',
  call: () => 'Calling pros for prices…'
};

/* ---------- CSS (injected once) ---------- */
if (!document.getElementById('css-report')) {
  const st = document.createElement('style'); st.id = 'css-report';
  st.textContent = `
.rp{display:flex;flex-direction:column;flex:1}
.rp .thread{gap:12px;padding:20px 16px 24px;overflow:visible}
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
.rp .field{margin-bottom:0}
/* The one required field: strong label, firm border, roomy box */
.rp .req label{font-size:18px;font-weight:700;color:var(--ink)}
.rp .req textarea{min-height:132px;border:2px solid var(--ink3);border-radius:14px;padding:14px 16px;line-height:1.45}
.rp .req textarea:focus{border-color:var(--green);outline:none;box-shadow:0 0 0 3px var(--green-tint)}
.rp .req.err textarea{border-color:var(--red)}
/* Optional fields: quieter label, lighter border, soft fill */
.rp .opt-group{display:flex;flex-direction:column;gap:14px;padding-top:4px}
.rp .opt label{font-size:16px;font-weight:600;color:var(--ink2);display:flex;align-items:baseline;gap:8px}
.rp .opt label .o{font-size:15px;font-weight:400;color:var(--ink3)}
.rp .opt input,.rp .opt select{min-height:48px;border:1px solid #CFC9BC;background:var(--pinned);color:var(--ink);font-size:17px}
.rp .opt input:focus,.rp .opt select:focus{background:#fff;border-color:var(--green);outline:none;box-shadow:0 0 0 3px var(--green-tint)}
.rp .opt .hint{color:var(--ink3)}
.rp .where{display:flex;align-items:center;gap:8px;font-size:15px;color:var(--ink2)}
.rp .where .ic{width:18px;height:18px;color:var(--ink3)}
.rp .dock{display:flex;flex-direction:column;gap:8px}
.rp .dock .acts{display:flex;align-items:center;gap:12px}
.rp .dock .acts .btn.plain{min-height:52px;padding:0 12px}
.rp .dock .why{font-size:15px;color:var(--ink2);margin:0;display:flex;gap:6px;align-items:center}
.rp .dock .why .ic{width:18px;height:18px;color:var(--green)}
.rp .wait{display:flex;flex-direction:column;gap:10px;scroll-margin-bottom:calc(var(--dock-h,96px) + 16px)}
.rp .wait .bu.u p{overflow-wrap:anywhere}
.rp .wait .say{display:flex;align-items:center;gap:10px;font-size:15px;color:var(--ink2)}
.rp .wait .say span{transition:opacity .25s cubic-bezier(.16,1,.3,1)}
.rp textarea::placeholder,.rp input::placeholder{color:var(--ink3)}
@media (max-width:639px){
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
  if (!manager()) {
    const p = H.prop && H.prop('p1');
    return `<div class="where">${H.icon('home')}<span>For ${H.esc(p ? `${p.name} · ${p.unit}` : 'Maple House')}</span></div>`;
  }
  const cur = propertyFor(st);
  return `<div class="field opt"><label for="rp-prop">Which property?</label>
    <select id="rp-prop" ${S.pending ? 'disabled' : ''}>${(st.properties || []).map(p => `<option value="${H.esc(p.id)}" ${p.id === cur ? 'selected' : ''}>${H.esc(p.name)} · ${H.esc(p.unit)}</option>`).join('')}</select></div>`;
};

const render = st => {
  /* Fresh visit (not a same-route re-render): start clean; only typed text survives */
  if (H._lastRoute !== '#/new' && !S.pending) { S.errors = {}; S.serverError = ''; S.photoNote = ''; }
  const dis = S.pending ? 'disabled' : '';
  const firstName = (st.actor && st.actor.name ? st.actor.name.split(' ')[0] : '');
  const said = S.description.trim();
  return `<form class="rp" novalidate aria-busy="${S.pending}">
  <div class="thread">
    ${H.h(`<p>${firstName ? `Hi ${H.esc(firstName)}. ` : ''}What needs fixing?</p><p>A photo helps. Get close, and show any water or damage.</p>`)}
    <div class="step" id="rp-photos">${photosHtml()}</div>
    ${H.h(`<p>${S.photos.length ? 'Got it. ' : ''}Now tell me what’s happening.</p>`)}
    <div class="step">
      <div class="field req ${S.errors.description ? 'err' : ''}"><label for="rp-desc">What’s happening?</label>
        <textarea id="rp-desc" maxlength="1200" placeholder="For example: water drips from the pipe under the kitchen sink when it runs." aria-required="true" aria-describedby="${described('description', 'rp-desc-h')}" ${S.errors.description ? 'aria-invalid="true"' : ''} ${dis}>${H.esc(S.description)}</textarea>
        <span class="hint" id="rp-desc-h">Say which room it’s in. Mention any smell of gas, sparks or flooding.</span>${errMsg('description')}</div>
      <div class="opt-group">
        <div class="field opt"><label for="rp-title">Name it <span class="o">Optional</span></label>
          <input id="rp-title" maxlength="120" autocomplete="off" placeholder="Handy names it for you" value="${H.esc(S.title)}" aria-describedby="rp-title-h" ${dis}>
          <span class="hint" id="rp-title-h">How it shows in your list. Filled in from what you wrote.</span></div>
        ${propertyHtml(st)}
      </div>
    </div>
    ${S.pending ? `<div class="wait">
      ${H.u(`<p>${H.esc(said.length > 160 ? said.slice(0, 157) + '…' : said)}</p>`)}
      <div class="say" role="status" aria-live="polite">${H.typing()}<span id="rp-stage">${H.esc((STAGE[S.stage] || STAGE.look)())}</span></div>
    </div>` : ''}
  </div>
  <div class="dock">
    ${S.serverError ? `<div class="note red" role="alert">${H.icon('alert')}<span>${H.esc(S.serverError)}</span></div>` : ''}
    <div class="acts">
      <button type="submit" class="btn" id="rp-send" ${S.pending || S.processing ? 'disabled' : ''}>${S.pending ? 'Sending…' : S.processing ? 'Getting your photo ready…' : `Send to Handy ${H.icon('arrow')}`}</button>
      ${S.pending ? '' : `<a class="btn plain" href="#/" data-cancel>Cancel</a>`}
    </div>
    ${S.pending ? '' : `<p class="why">${H.icon('shield')}Handy then calls pros for prices. Nothing is booked until you say yes.</p>`}
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
const scrollWait = () => {
  const c = document.querySelector('.center');
  if (c && c.scrollHeight > c.clientHeight) c.scrollTo({top:c.scrollHeight, behavior:'smooth'});
  window.scrollTo({top:document.documentElement.scrollHeight, behavior:'smooth'});
};
const onNew = () => H.route && H.route.name === 'new';

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
    if (field) {
      field.classList.remove('err');
      field.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
      field.querySelectorAll('[aria-describedby]').forEach(x => x.setAttribute('aria-describedby', x.getAttribute('aria-describedby').replace(`err-${key}`, '').trim()));
    }
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
    if (take.some(f => !readable(f))) S.photoNote = BAD_TYPE;
    const good = take.filter(readable);
    S.processing += good.length; repaintPhotos();
    await Promise.all(good.map(async f => {
      try { const url = await toJpeg(f); if (S.photos.length < MAX_PHOTOS) S.photos.push(url); }
      catch (e) { S.photoNote = e && e.message === 'size' ? 'That photo is too large to send. Try taking a new one.' : BAD_TYPE; }
      finally { S.processing--; }
    }));
    if (form.isConnected) repaintPhotos(); else if (onNew()) H.render();
  }

  function bindPhotos() {
    form.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => (b.dataset.pick === 'camera' ? camera : library).click()));
    const sample = $('[data-sample]');
    if (sample) sample.addEventListener('click', () => {
      if (S.photos.length + S.processing >= MAX_PHOTOS || S.photos.includes(SAMPLE)) return;
      S.photos.push(SAMPLE); S.photoNote = ''; repaintPhotos();
      const next = $('#rp-desc'); if (next && !next.value.trim()) next.focus({preventScroll:true});
    });
    form.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
      S.photos.splice(+b.dataset.rm, 1); S.photoNote = ''; repaintPhotos();
      const next = $('[data-rm]') || $('[data-pick]'); if (next) next.focus();
    }));
  }
  bindPhotos();

  const prop = $('#rp-prop');
  if (prop) prop.addEventListener('change', () => { S.property = prop.value; saveDraft(); });

  const desc = $('#rp-desc'), title = $('#rp-title');
  desc.addEventListener('input', () => {
    S.description = desc.value;
    if (!S.titleTouched) { S.title = titleFrom(desc.value); title.value = S.title; }
    if (desc.value.trim()) clearErr('description');
    saveDraft();
  });
  title.addEventListener('input', () => {
    S.title = title.value; S.titleTouched = title.value.trim() !== '';
    saveDraft();
  });

  const cancel = $('[data-cancel]');
  if (cancel) cancel.addEventListener('click', e => { e.preventDefault(); if (!S.pending) { clearDraft(); S = blank(); } H.go('#/'); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (S.pending || S.processing || H.state.busy) return;
    S.description = desc.value; S.title = title.value;
    S.errors = {}; S.serverError = '';
    if (!S.description.trim()) {
      S.errors.description = 'Tell Handy what’s happening, in a sentence or two.';
      H.render();
      const t = document.querySelector('.center form.rp #rp-desc');
      if (t) { t.focus({preventScroll:true}); t.closest('.field').scrollIntoView({block:'center'}); }
      return;
    }
    const body = { title:titleFor(), description:S.description.trim(), property:propertyFor(st),
      room:'Other', urgency:'Soon', photos:S.photos.slice() };
    S.pending = true; S.stage = 'look'; H.render(); scrollWait();

    let repair;
    try { [{ repair }] = await Promise.all([H.api('POST', '/api/repairs', body), sleep(900)]); /* let the first step be readable */ }
    catch (err) {
      S.pending = false; S.stage = ''; S.serverError = kindError(err);
      if (onNew()) {
        H.render();
        const n = document.querySelector('.center form.rp .dock .note'); if (n) n.scrollIntoView({block:'nearest'});
        const b = document.querySelector('#rp-send'); if (b) b.focus({preventScroll:true});
      }
      return;
    }

    const hazard = repair.status === 'hazard';
    if (!hazard && onNew()) {
      /* Show the next step in place for a beat before opening the repair */
      S.stage = 'call';
      const s = document.getElementById('rp-stage'); if (s) s.textContent = STAGE.call();
      await sleep(700);
    }
    const stillHere = onNew();
    clearDraft(); S = blank();
    if (stillHere) H.go('#/repair/' + repair.id); /* go first so the upsert renders the repair, not a blank form */
    H.upsert(repair);
    if (!stillHere) H.toast(hazard ? 'Sent. Handy flagged a possible safety issue.' : 'Sent to Handy. It is getting prices now.');
    if (hazard) return;

    /* Fully autonomous: ask pros for prices right away. Hold busy so no one else requests prices twice. */
    H.state.busy = true;
    try { await H.autopilot(repair); }
    finally { H.state.busy = false; H.render(); }
  });
};

H.ui.report = { render, bind };
})();
