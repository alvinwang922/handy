/* settings.js — #/settings "Settings · Your houses" (H.ui.settings).
   Lists H.myProperties() and lets the user add a house with H.addProperty({name,address,unit?,tenant?}).
   Tenant field is for property managers only. Form text survives re-renders (kept in `draft`). */
(function(){
const H = window.H;
if (!H) return;

const css = `
.st{max-width:640px}
.st-intro{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:0 0 20px}
.st-intro .lead{margin:0;flex:1 1 260px}
.st-houses{border-top:1px solid var(--line);margin:0 0 8px;padding:0;list-style:none}
.st-house{display:flex;gap:14px;align-items:flex-start;padding:16px 4px;border-bottom:1px solid var(--line);transition:background-color .9s cubic-bezier(.16,1,.3,1)}
.st-house .hi{width:44px;height:44px;border-radius:50%;background:var(--pinned);color:var(--ink2);display:grid;place-items:center;flex:none}
.st-house .hi .ic{width:22px;height:22px}
.st-house .grow{flex:1;min-width:0}
.st-house .nm{font-weight:700;font-size:18px;line-height:1.3;overflow-wrap:anywhere;margin:0}
.st-house .ad{color:var(--ink2);overflow-wrap:anywhere}
.st-house .ex{display:flex;flex-wrap:wrap;gap:2px 14px;margin-top:4px;font-size:15px;color:var(--ink3)}
.st-house .ex span{display:inline-flex;align-items:center;gap:6px}
.st-house .ex .ic{width:16px;height:16px}
.st-house.is-new{background:var(--green-tint)}
.st-house.is-new .hi{background:var(--green);color:#fff}
.st-empty{padding:16px 0;color:var(--ink2)}
.st-form{margin-top:32px}
.st-form h2{margin:0 0 4px}
.st-form .sub{color:var(--ink2);margin:0 0 20px}
.st-form .opt{font-weight:400;color:var(--ink3)}
.st-form .field input::placeholder{color:#7A827C}
.st-form .field .msg .ic{width:18px;height:18px}
.st-form .note{margin:0 0 16px}
.st-actions{display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.st-actions .btn{flex:none;min-width:200px}
@media (max-width:639px){.st-actions .btn{flex:1;min-width:0}}
@media (prefers-reduced-motion:reduce){.st-house{transition:none}}
`;
if (!document.getElementById('css-settings')) {
  const s = document.createElement('style'); s.id = 'css-settings'; s.textContent = css; document.head.appendChild(s);
}

const LIMITS = { name: 80, address: 160, unit: 60, tenant: 80 };
const LABEL = { name: 'House name', address: 'Address', unit: 'Unit', tenant: 'Tenant name' };
let draft = { name: '', address: '', unit: '', tenant: '' };
let errors = {};
let serverError = '';
let saving = false;
let justAdded = null;

const validate = (key, value) => {
  const v = (value || '').trim();
  if ((key === 'name' || key === 'address') && !v) return key === 'name' ? 'Give the house a name, like “Beach House”.' : 'Add the street address so pros know where to go.';
  if (v.length > LIMITS[key]) return `${LABEL[key]} can be at most ${LIMITS[key]} characters.`;
  return '';
};

const field = (key, { required, hint, placeholder, autocomplete }) => {
  const id = `st-${key}`, err = errors[key];
  const desc = [hint ? `${id}-hint` : '', err ? `${id}-err` : ''].filter(Boolean).join(' ');
  return `<div class="field${err ? ' err' : ''}">
    <label for="${id}">${H.esc(LABEL[key])}${required ? '' : ' <span class="opt">(optional)</span>'}</label>
    ${hint ? `<span class="hint" id="${id}-hint">${H.esc(hint)}</span>` : ''}
    <input id="${id}" name="${key}" type="text" value="${H.esc(draft[key])}" maxlength="${LIMITS[key]}"
      ${placeholder ? `placeholder="${H.esc(placeholder)}"` : ''} autocomplete="${autocomplete || 'off'}"
      ${required ? 'aria-required="true"' : ''}${err ? ' aria-invalid="true"' : ''}${desc ? ` aria-describedby="${desc}"` : ''}>
    ${err ? `<span class="msg" id="${id}-err">${H.icon('alert')}${H.esc(err)}</span>` : ''}
  </div>`;
};

const house = (p, mgr) => {
  const extra = [];
  if (p.unit) extra.push(`<span>${H.icon('key')}${H.esc(p.unit)}</span>`);
  if (mgr && p.tenant) extra.push(`<span>${H.icon('user')}Tenant: ${H.esc(p.tenant)}</span>`);
  return `<li class="st-house${justAdded === p.id ? ' is-new' : ''}" data-house="${H.esc(p.id)}">
    <span class="hi">${H.icon('home')}</span>
    <div class="grow"><h3 class="nm" tabindex="-1">${H.esc(p.name)}</h3>
      ${p.address ? `<div class="ad">${H.esc(p.address)}</div>` : ''}
      ${extra.length ? `<div class="ex">${extra.join('')}</div>` : ''}</div>
  </li>`;
};

H.ui.settings = {
  render(S) {
    const mgr = H.isManager();
    const props = H.myProperties ? H.myProperties() : (S.properties || []);
    const n = props.length;
    return `<div class="page st">
      <h1>Your houses</h1>
      <div class="st-intro"><p class="lead">${mgr ? 'Every property you look after. Repairs are sorted by these.' : 'The homes Handy can send pros to. Pick one when you report a problem.'}</p>${H.demo('Demo · stored locally')}</div>
      ${n ? `<ul class="st-houses" aria-label="${H.esc(`${n} ${n === 1 ? 'house' : 'houses'}`)}">${props.map(p => house(p, mgr)).join('')}</ul>`
          : `<p class="st-empty">No houses yet. Add your first one below.</p>`}
      <form class="st-form" novalidate aria-labelledby="st-add-h">
        <h2 id="st-add-h">Add a house</h2>
        <p class="sub">Only the name and address are needed.</p>
        ${serverError ? `<div class="note red" role="alert">${H.icon('alert')}<span>We couldn’t add the house. ${H.esc(serverError)}</span></div>` : ''}
        ${field('name', { required: true, placeholder: 'Beach House' })}
        ${field('address', { required: true, placeholder: '12 Ocean Road', autocomplete: 'street-address' })}
        ${field('unit', { hint: 'Leave empty for a whole house.', placeholder: 'Apt 3' })}
        ${mgr ? field('tenant', { hint: 'Who lives there, so pros know who to ask for.', placeholder: 'Alex Kim' }) : ''}
        <div class="st-actions">
          <button type="submit" class="btn"${saving ? ' disabled' : ''}>${H.icon(saving ? 'clock' : 'plus')} ${saving ? 'Adding…' : 'Add house'}</button>
        </div>
      </form>
    </div>`;
  },
  bind(root) {
    const form = root.querySelector('.st-form');
    if (!form) return;
    if (justAdded) {
      const row = root.querySelector(`[data-house="${CSS.escape(justAdded)}"]`);
      if (row) {
        requestAnimationFrame(() => { row.scrollIntoView({ block: 'nearest' }); row.querySelector('.nm').focus({ preventScroll: true }); });
        H.later(1800, () => row.classList.remove('is-new'));
      }
      justAdded = null;
    }
    /* Update one field's message in place (no re-render, so focus and typing are never interrupted) */
    const show = (inp, msg) => {
      const wrap = inp.closest('.field'), id = inp.id;
      let el = wrap.querySelector('.msg');
      if (msg) errors[inp.name] = msg; else delete errors[inp.name];
      wrap.classList.toggle('err', !!msg);
      if (msg) { inp.setAttribute('aria-invalid', 'true'); if (!el) { el = document.createElement('span'); el.className = 'msg'; el.id = `${id}-err`; wrap.appendChild(el); } el.innerHTML = H.icon('alert') + H.esc(msg); }
      else { inp.removeAttribute('aria-invalid'); if (el) el.remove(); }
      const desc = [wrap.querySelector('.hint') ? `${id}-hint` : '', msg ? `${id}-err` : ''].filter(Boolean).join(' ');
      if (desc) inp.setAttribute('aria-describedby', desc); else inp.removeAttribute('aria-describedby');
    };
    form.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('input', () => {
        draft[inp.name] = inp.value;
        /* Clear a message as soon as the field is fixed; don't scold while the user is still typing */
        if (errors[inp.name] && !validate(inp.name, inp.value)) show(inp, '');
      });
      inp.addEventListener('blur', () => { if (errors[inp.name]) show(inp, validate(inp.name, inp.value)); });
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (saving) return;
      const keys = H.isManager() ? ['name', 'address', 'unit', 'tenant'] : ['name', 'address', 'unit'];
      errors = {};
      keys.forEach(k => { const m = validate(k, draft[k]); if (m) errors[k] = m; });
      serverError = '';
      const first = keys.find(k => errors[k]);
      if (first) { H.render(); const el = document.getElementById(`st-${first}`); if (el) el.focus(); return; }
      const input = { name: draft.name.trim(), address: draft.address.trim() };
      if (draft.unit.trim()) input.unit = draft.unit.trim();
      if (H.isManager() && draft.tenant.trim()) input.tenant = draft.tenant.trim();
      saving = true; H.render();
      try {
        const p = await H.addProperty(input);
        saving = false; draft = { name: '', address: '', unit: '', tenant: '' }; justAdded = p && p.id;
        H.render();
        H.toast(`Added ${p && p.name ? p.name : input.name}`);
      } catch (err) {
        saving = false;
        serverError = err && err.status === 0 ? 'Handy isn’t reachable right now. Check that the app is running, then try again.' : ((err && err.message) || 'Please try again.');
        H.render();
        const btn = document.querySelector('.st-form button[type="submit"]'); if (btn) btn.focus();
      }
    });
  }
};
})();
