/* Storefront prototype: VIN/plate lookup, Build-my-job, 24/7 chat, Shops & Fleets, SEO guides, closeouts.
   Plugs into app.js via window.PRX (routes + hooks). ALL DATA IS FAKE. */
(function () {
  'use strict';
  const H = window.PRX;
  const { D, $, $$, money, esc, store, toast, crumbs, stars, tierPill, openModal, closeModal } = H;
  const S = D.STORE;
  const app = H.app;
  const TIERS = ['good', 'better', 'best'];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const shortEngine = e => e.replace(/ Diesel Turbo| Turbo/, '').replace(/^([\d.]+L) (V8|L6|V6|L4) /, '$1 ');
  const vehShort = v => `${D.vehicleLabel(v)} ${shortEngine(v.engine)}`;
  const curV = () => D.findVehicle(H.currentVid());
  const fmtDate = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };

  // ================= shell: logo, store name, footer, pay icons =================
  function logoHtml() { return `<span class="logo-mark"><i></i><i></i><i></i></span><span class="logo-word">${esc(S.nameA)} <b>${esc(S.nameB)}</b></span>`; }
  function payIcons() {
    return `<div class="pay-icons" aria-label="Accepted payment methods">
      <span class="pi pi-visa">VISA</span><span class="pi pi-mc"><i></i><i></i></span><span class="pi pi-amex">AMEX</span><span class="pi pi-disc">DISCOVER</span>
      <span class="pi pi-pp"><b>Pay</b>Pal</span><span class="pi pi-ap"> Pay</span><span class="pi pi-gp">G Pay</span><span class="pi pi-aff">affirm</span><span class="pi pi-net">Net 30</span></div>`;
  }
  H.payIcons = payIcons;
  H.init = function () {
    document.title = `${S.name}: ${S.tagline}`;
    $$('[data-logo]').forEach(el => { el.innerHTML = logoHtml(); });
    $$('[data-store]').forEach(el => { el.textContent = S[el.dataset.store] || ''; });
    $('#footPay').innerHTML = payIcons();
    $('#newsForm').addEventListener('submit', e => { e.preventDefault(); e.target.reset(); toast('You\'re on the list. First closeout alert arrives Thursday.'); });
    document.addEventListener('click', e => { const a = e.target.closest('[data-chat]'); if (a) { e.preventDefault(); chatAsk(a.dataset.chat); } });
    mountChat();
  };
  H.afterRender = function (parts) {
    if (parts[0] === 'p') store.set('lastPart', { vid: parts[1], subId: parts[2], i: +parts[3] });
    const ctx = $('#cpCtx'); if (ctx) ctx.innerHTML = chatCtx();
  };

  // ================= VIN / plate / YMM lookup =================
  function lookupHtml(prefix) {
    return `<div class="lookup" id="${prefix}Lk">
      <div class="lk-tabs" role="tablist"><button type="button" class="on" data-tab="ymm" role="tab">Year/Make/Model</button><button type="button" data-tab="vin" role="tab">VIN</button><button type="button" data-tab="plate" role="tab">Plate</button></div>
      <div class="lk-pane" data-pane="ymm">${H.selectorHtml(prefix)}</div>
      <div class="lk-pane" data-pane="vin" hidden>
        <form class="lk-form" data-f="vin" novalidate>
          <label class="lk-lab"><span>17-character VIN</span><span class="lk-count" data-count>0 / 17</span></label>
          <input class="lk-in mono" name="vin" maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="e.g. 3C6UR5FL1KG512345">
          <div class="lk-err" data-err hidden></div>
          <button class="btn btn-primary btn-block">Decode VIN</button>
          <div class="lk-help"><button type="button" class="linkbtn small" data-sample>Try a sample VIN</button><span class="muted small">Find it on the driver-side dash, door jamb, or your registration card.</span></div>
        </form>
      </div>
      <div class="lk-pane" data-pane="plate" hidden>
        <form class="lk-form" data-f="plate" novalidate>
          <div class="lk-row"><label class="lk-st"><span class="lk-lab">State</span><select name="st">${D.STATES.map(s => `<option ${s === 'OH' ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
          <label class="lk-pl"><span class="lk-lab">License plate</span><input class="lk-in mono plate-in" name="plate" maxlength="8" autocomplete="off" autocapitalize="characters" placeholder="ABC 1234"></label></div>
          <div class="lk-err" data-err hidden></div>
          <button class="btn btn-primary btn-block">Find my vehicle</button>
          <p class="muted small lk-help">We only use your plate to look up the vehicle. It's never stored or shared.</p>
        </form>
      </div>
      <div class="lk-result" data-res hidden></div>
    </div>`;
  }
  function validateVin(raw) {
    const v = raw.replace(/[\s-]/g, '').toUpperCase();
    if (!v) return { err: 'Enter your 17-character VIN.' };
    const bad = v.match(/[IOQ]/);
    if (bad) return { err: `VINs never use the letter “${bad[0]}”. Did you mean ${bad[0] === 'I' ? '1 (one)' : '0 (zero)'}?` };
    if (/[^A-HJ-NPR-Z0-9]/.test(v)) return { err: 'A VIN only has letters and numbers. Remove any symbols.' };
    if (v.length !== 17) return { err: `That's ${v.length} character${v.length === 1 ? '' : 's'}. A VIN has exactly 17${v.length < 17 ? `, so you're missing ${17 - v.length}` : ''}.` };
    return { vin: v };
  }
  async function loadingSteps(el, steps) {
    el.hidden = false;
    el.innerHTML = `<div class="steps">${steps.map((s, i) => `<div class="st" data-i="${i}"><span class="st-i"></span>${esc(s)}</div>`).join('')}</div>`;
    for (let i = 0; i < steps.length; i++) {
      const row = $(`.st[data-i="${i}"]`, el); if (!row) return; row.classList.add('run');
      await wait(380 + i * 60);
      row.classList.remove('run'); row.classList.add('done');
    }
    await wait(150);
  }
  function decodedCard(info, title, sub, extraRows) {
    const v = D.findVehicle(info.vid);
    return `<div class="dec">
      <div class="dec-h"><span class="dec-ok">✓</span><div><small>${esc(sub)}</small><b>${esc(title || vehShort(v))}</b></div></div>
      <table class="kv dec-kv">${extraRows.concat([['Trim', info.trim], ['Engine', info.engine], ['Drive / trans', info.drive], ['GVWR', info.gvwr]]).map(([k, x]) => `<tr><th>${esc(k)}</th><td>${esc(x)}</td></tr>`).join('')}</table>`;
  }
  function wireLookup(root, onDone) {
    if (!root) return;
    const prefix = root.id.replace(/Lk$/, '');
    H.wireSelector($('#' + prefix + 'Sel'), onDone);
    const res = $('[data-res]', root);
    const showTab = t => { $$('.lk-tabs button', root).forEach(b => b.classList.toggle('on', b.dataset.tab === t)); $$('.lk-pane', root).forEach(p => { p.hidden = p.dataset.pane !== t; }); res.hidden = true; };
    $$('.lk-tabs button', root).forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
    const save = id => { H.setVehicle(id); toast(`Saved <b>${esc(vehShort(D.findVehicle(id)))}</b> to My Garage`); onDone(id); };
    // VIN
    const vf = $('[data-f="vin"]', root), vin = $('[name="vin"]', vf), vErr = $('[data-err]', vf), cnt = $('[data-count]', vf);
    vin.addEventListener('input', () => { const n = vin.value.replace(/[\s-]/g, '').length; cnt.textContent = n + ' / 17'; cnt.classList.toggle('ok', n === 17); vErr.hidden = true; vin.classList.remove('bad'); });
    $('[data-sample]', vf).addEventListener('click', () => { vin.value = '3C6UR5FL1KG512345'; vin.dispatchEvent(new Event('input')); });
    vf.addEventListener('submit', async e => {
      e.preventDefault();
      const r = validateVin(vin.value);
      if (r.err) { vErr.textContent = r.err; vErr.hidden = false; vin.classList.add('bad'); return; }
      vin.value = r.vin; const btn = $('button.btn', vf); btn.disabled = true;
      await loadingSteps(res, ['Validating check digit', 'Decoding manufacturer & model year', 'Matching engine and drivetrain', 'Filtering 400,000+ parts to your truck']);
      btn.disabled = false;
      const info = D.VIN_DECODE;
      res.innerHTML = decodedCard(info, null, 'VIN decoded', [['VIN', r.vin], ['Plant', info.plant], ['Axle', info.axle]]) +
        `<div class="dec-cta"><button class="btn btn-primary" data-save>Save to My Garage & shop</button><button class="btn btn-ghost" data-redo>Not my truck</button></div></div>`;
      $('[data-save]', res).onclick = () => save(info.vid);
      $('[data-redo]', res).onclick = () => { res.hidden = true; vin.focus(); };
    });
    // plate
    const pf = $('[data-f="plate"]', root), pl = $('[name="plate"]', pf), pErr = $('[data-err]', pf);
    pl.addEventListener('input', () => { pErr.hidden = true; pl.classList.remove('bad'); });
    pf.addEventListener('submit', async e => {
      e.preventDefault();
      const p = pl.value.replace(/[\s-]/g, '').toUpperCase(); const st = $('[name="st"]', pf).value;
      if (p.length < 2 || p.length > 8 || /[^A-Z0-9]/.test(p)) { pErr.textContent = p ? 'Plates are 2–8 letters and numbers. Check for typos.' : 'Enter your license plate.'; pErr.hidden = false; pl.classList.add('bad'); return; }
      const btn = $('button.btn', pf); btn.disabled = true;
      await loadingSteps(res, [`Searching ${st} registration records`, 'Matching VIN pattern', 'Confirming engine & trim']);
      btn.disabled = false;
      const info = D.PLATE_DECODE; const v = D.findVehicle(info.vid);
      res.innerHTML = decodedCard(info, `Found: ${D.vehicleLabel(v)} 6.7 Power Stroke`, `${st} plate ${p}`, [['VIN', info.vin]]) +
        `<p class="dec-q"><b>Is this your truck?</b> Confirm and we'll save it to My Garage so every part we show you fits.</p>
        <div class="dec-cta"><button class="btn btn-primary" data-save>Yes, that's my truck</button><button class="btn btn-ghost" data-vin>No, use my VIN</button></div></div>`;
      $('[data-save]', res).onclick = () => save(info.vid);
      $('[data-vin]', res).onclick = () => showTab('vin');
    });
  }
  H.lookupHtml = lookupHtml; H.wireLookup = wireLookup;
  H.openLookup = function (tab) {
    openModal(`<h2>Add your vehicle</h2><p class="muted small">Decode by VIN or plate for an exact match, including trim, engine and drivetrain.</p>${lookupHtml('mod')}`);
    $('.m-box').classList.add('m-narrow');
    wireLookup($('#modLk'), id => { closeModal(); location.hash = '#/v/' + id; });
    if (tab) $(`#modLk [data-tab="${tab}"]`).click();
  };

  // ================= home extras =================
  H.homeExtras = function () {
    const strip = $('.feature-strip'); if (!strip) return;
    const v = curV() || D.findVehicle(H.DEMO_GARAGE[0]);
    const reviews = [
      ['Dale K.', 'Defiance, OH', 5, 'Typed in my VIN, it built the whole front hub job: hubs, ABS sensors, axle nuts. Showed up from Toledo the next day.', '2019 Ram 2500'],
      ['Marcus T.', 'Abilene, TX', 5, 'The Good/Better/Best thing is genius. Went Heavy Duty on hubs because I tow, Economy on the cabin filter. Saved $140 vs the parts store.', '2018 F-250'],
      ['Jenna R.', 'Lancaster, PA', 4, 'Ordered the wrong rotors for my old truck (my fault, wrong garage vehicle). They still sent a return label. Fast refund.', '2016 Silverado 2500'],
      ['Brett W.', 'Holland, MI', 5, 'Run 9 trucks. Net 30 + PO numbers at checkout means my techs order themselves and I approve from my phone.', 'Fleet customer']
    ];
    strip.insertAdjacentHTML('afterend', `
    <section class="ai-promo">
      <div class="aip-copy"><span class="ai-badge">✨ New · AI</span><h2>Tell us the job. We'll build the cart.</h2>
        <p>Pick “front brake job” or describe the problem (“clunk when turning”) and get every part, bolt and fluid for your ${esc(D.vehicleLabel(v))} in one click, in Good, Better or Best.</p>
        <div class="aip-chips">${D.JOBS.slice(0, 4).map(j => `<a class="chip" href="#/jobs/${j.id}">${esc(j.name)}</a>`).join('')}</div></div>
      <a class="btn btn-primary btn-lg" href="#/jobs">Build my job →</a>
    </section>
    <section class="block"><div class="block-h"><h2>What customers say</h2><span class="muted small">${stars(4.8)} 4.8 average · 21,486 verified reviews</span></div>
      <div class="rev-grid">${reviews.map(r => `<div class="rev-card">${stars(r[2])}<p>“${esc(r[3])}”</p><div class="rc-by"><span class="rc-av">${r[0][0]}</span><span><b>${esc(r[0])}</b> · ${esc(r[1])}<br><small class="muted">✓ Verified buyer · ${esc(r[4])}</small></span></div></div>`).join('')}</div></section>
    <section class="pro-band"><div><span class="pb-k">For Shops & Fleets</span><h2>Net 30 terms, shop pricing up to −18%, PO numbers and one-click fleet reorders.</h2></div><div class="pb-cta"><a class="btn btn-primary" href="#/pro">See the pro program</a><a class="btn btn-ghost-l" href="#/pro/dashboard">Demo dashboard</a></div></section>
    <section class="block"><div class="block-h"><h2>Popular repair guides</h2><a href="#/guides">All guides →</a></div>
      <div class="guide-grid">${guideCards(D.GUIDE_VEHICLES.slice(0, 3).map(g => D.findVehicle(D.vid(...g))).flatMap(gv => ['wheel-hub-assembly', 'brake-pad'].map(s => [gv, s])).slice(0, 4))}</div></section>`);
  };

  // ================= Build my job =================
  const ROLE = { req: 'Required parts', together: 'Commonly replaced together', hw: 'Hardware & fluids', tool: 'Optional tools' };
  const WHY = {
    'brake-caliper': 'Seized slides are the #1 cause of uneven pad wear', 'brake-hydraulic-hose': 'Rubber hoses swell with age; cheap to do while bled',
    'abs-wheel-speed-sensor': 'Sensor usually breaks coming out of a rusted hub', 'brake-pad': 'Pads are already off; fresh pads bed best on new hubs',
    'universal-joint': 'Axle U-joints are exposed with the hub out (saves ~1 hr later)', 'valve-cover-gasket': 'Must come off for access, don\'t reuse it',
    'intake-air-temp-sensor': 'Brittle connector often cracks during the job', 'air-filter': 'Due at the same interval', 'cabin-air-filter': 'Due at the same interval',
    'steering-stabilizer': 'A worn damper hides front-end play', 'sway-bar-link': 'Bushings wear in sync with ball joints'
  };
  function pickPart(v, subId, pos, tier) {
    const f = D.findSub(subId); if (!f) return null;
    if ((f.sub.diesel && !v.diesel) || (f.sub.gas && v.diesel)) return null;
    let ps = D.partsFor(v, subId);
    if (pos) { const m = ps.filter(p => p.pos === pos); if (m.length) ps = m; }
    const t = ps.filter(p => p.tier === tier); const pool = t.length ? t : ps;
    return pool.slice().sort((a, b) => tier === 'good' ? a.price - b.price : (b.rating - a.rating) || a.price - b.price)[0];
  }
  function buildKit(v, job, tier) {
    const mult = { good: 0.85, better: 1, best: 1.35 }[tier];
    const items = [];
    job.items.forEach(([subId, qty, role, pos], k) => {
      const p = pickPart(v, subId, pos, tier); if (!p) return;
      items.push({ k: 'p' + k, role, part: p, qty, name: p.subName + (p.pos ? ' · ' + p.pos : ''), price: p.price, core: p.core, why: role === 'together' ? WHY[subId] : null, on: role !== 'tool' });
    });
    job.extras.forEach(([role, name, base], k) => {
      const price = Math.floor(base * mult) + 0.99;
      items.push({ k: 'x' + k, role, extra: true, qty: 1, name: tier === 'best' && role === 'hw' ? name + ' (pro-grade)' : name, price, core: 0, on: role !== 'tool' });
    });
    return items;
  }
  function kitTotal(items) { return items.filter(i => i.on).reduce((a, i) => a + i.price * i.qty, 0); }
  function addKitToCart(v, job, tier, items, label) {
    const on = items.filter(i => i.on);
    on.forEach(i => { if (!i.extra) H.addToCart(i.part, i.qty, v); });
    const cart = H.getCart(); const wh = (on.find(i => !i.extra) || {}).part ? on.find(i => !i.extra).part.wh : 'TOL';
    on.filter(i => i.extra).forEach(i => {
      const key = 'x/' + job.id + '/' + tier + '/' + i.k; const ex = cart.find(l => l.key === key);
      if (ex) ex.qty += i.qty; else cart.push({ key, vid: v.id, subId: null, i: 0, vlabel: D.vehicleLabel(v), name: i.name, pos: null, brand: 'Kit', partNo: '', tier, price: i.price, cost: +(i.price * 0.6).toFixed(2), core: 0, wh, weight: 2, qty: i.qty, extra: true });
    });
    H.saveCart();
    toast(`Added <b>${on.reduce((a, i) => a + i.qty, 0)} items</b> · ${esc(label || job.name)} · <a href="#/cart">View cart →</a>`);
  }
  H.buildKit = buildKit; H.addKitToCart = addKitToCart;

  function vehCtx(v, back) {
    return v ? `<div class="vctx">${icon('gear', 26)}<div><small>Building for</small><b>${esc(D.vehicleLabel(v))}</b><span>${esc(v.engine)}</span></div><button class="btn btn-sm" id="vctxChange">Change</button></div>`
      : `<div class="vctx none"><div><b>Add your vehicle first</b><span>So every part in the kit fits.</span></div><button class="btn btn-sm btn-primary" id="vctxChange">Add vehicle</button></div>`;
  }
  function wireVctx() { const b = $('#vctxChange'); if (b) b.onclick = () => H.openLookup(); }

  function pageJobs(parts, q) {
    const v = curV();
    if (parts[1]) return pageJobKit(parts[1], q);
    app.innerHTML = `${crumbs([['Home', '#/'], ['Build my job', '']])}
    <div class="jb-hero"><div><span class="ai-badge">✨ AI cart builder</span><h1 class="page-h">Build my job</h1><p class="muted">Pick a job or describe the problem. We'll assemble every part, bolt, fluid and tool for your truck in Good, Better or Best.</p></div>${vehCtx(v)}</div>
    <section class="panel diag">
      <h2>🩺 Describe the problem</h2>
      <form id="diagForm"><textarea id="diagIn" rows="2" placeholder="e.g. clunk in front end when turning"></textarea>
      <div class="diag-row"><div class="chips">${['clunk in front end when turning', 'grinding when I brake', 'hard start when cold', 'humming that gets louder with speed'].map(t => `<button type="button" class="chip" data-ex="${esc(t)}">${esc(t)}</button>`).join('')}</div><button class="btn btn-primary">Find likely causes</button></div></form>
      <div id="diagOut"></div>
    </section>
    <h2 class="sec-h">Or pick a job</h2>
    <form class="job-type" id="jobType"><input id="jobTypeIn" list="jobList" placeholder="Type a job: “front brake job”, “glow plug service”…"><datalist id="jobList">${D.JOBS.map(j => `<option value="${esc(j.name)}">`).join('')}</datalist><button class="btn btn-dark">Build it</button></form>
    <div class="job-grid">${D.JOBS.map(j => { const ok = !j.diesel || !v || v.diesel; const kit = v && ok ? buildKit(v, j, 'better') : null;
      return `<a class="job-card ${ok ? '' : 'dis'}" href="#/jobs/${j.id}">${icon(j.icon, 34)}<b>${esc(j.name)}</b><span>${esc(j.blurb)}</span>
        <div class="jc-m"><span>${diffHtml(j.diff)}</span><span>⏱ ${esc(j.time)}</span>${kit ? `<span>from <b>${money(kitTotal(buildKit(v, j, 'good')))}</b></span>` : ok ? '' : '<span class="muted">Diesel only</span>'}</div></a>`; }).join('')}</div>`;
    wireVctx();
    $$('[data-ex]').forEach(b => b.onclick = () => { $('#diagIn').value = b.dataset.ex; $('#diagForm').requestSubmit(); });
    $('#diagForm').addEventListener('submit', async e => {
      e.preventDefault(); const t = $('#diagIn').value.trim(); const out = $('#diagOut');
      if (t.length < 4) { out.innerHTML = '<div class="lk-err">Tell us a little more: what you hear, feel or see, and when it happens.</div>'; return; }
      await loadingSteps(out, [`Reading symptoms for ${v ? D.vehicleLabel(v) : 'your vehicle'}`, 'Checking 1.9M repair records & TSBs', 'Ranking likely causes']);
      const m = D.SYMPTOMS.find(s => s.re.test(t));
      if (!m) { out.innerHTML = `<div class="empty"><b>We couldn't match that one confidently.</b><br><span class="small">Try adding when it happens (braking, turning, cold start), or ask a parts pro.</span><br><button class="btn btn-sm" data-chat="hi">💬 Ask ${esc(S.name)} 24/7</button></div>`; return; }
      out.innerHTML = `<div class="causes"><p class="small muted">Most likely causes for “${esc(t)}”${v ? ' on a ' + esc(vehShort(v)) : ''}:</p>${m.causes.map(([c, pct, jid]) => { const j = D.JOBS.find(x => x.id === jid);
        return `<div class="cause"><div class="ca-t"><b>${esc(c)}</b><div class="ca-bar"><i style="width:${pct}%"></i></div><span class="small muted">${pct}% of similar reports</span></div>${j ? `<a class="btn btn-sm btn-primary" href="#/jobs/${j.id}">Build: ${esc(j.name)} →</a>` : '<span class="small muted">Inspect tires first</span>'}</div>`; }).join('')}
        <p class="tiny muted">Suggestions are a starting point, not a diagnosis. When in doubt, have a technician confirm.</p></div>`;
    });
    $('#jobType').addEventListener('submit', e => {
      e.preventDefault(); const t = $('#jobTypeIn').value.toLowerCase();
      const words = t.split(/\W+/).filter(w => w.length > 2);
      const j = D.JOBS.find(x => x.name.toLowerCase() === t) || D.JOBS.map(x => [x, words.filter(w => x.name.toLowerCase().includes(w.replace(/s$/, ''))).length]).sort((a, b) => b[1] - a[1]).filter(x => x[1])[0]?.[0];
      if (j) location.hash = '#/jobs/' + j.id; else toast('No matching job yet. Try “brake”, “hub”, “glow plug” or “oil”', 'err');
    });
  }
  function diffHtml(n) { return `<span class="diff" title="Difficulty ${n} of 5">${'🔧'.repeat(n)}<i>${'🔧'.repeat(5 - n)}</i></span>`; }

  let kitState = {};
  async function pageJobKit(jid, q) {
    const job = D.JOBS.find(j => j.id === jid); if (!job) return H.routes.__nf();
    const v = curV();
    const head = `${crumbs([['Home', '#/'], ['Build my job', '#/jobs'], [job.name, '']])}`;
    if (!v) { app.innerHTML = head + `<h1 class="page-h">${esc(job.name)}</h1>${vehCtx(null)}`; wireVctx(); return; }
    if (job.diesel && !v.diesel) {
      app.innerHTML = head + `<h1 class="page-h">${esc(job.name)}</h1><div class="empty big"><div class="empty-ico">⛽</div><b>Glow plugs are diesel-only</b><br><span class="small">Your ${esc(vehShort(v))} is gas. Try an oil change + filters instead, or switch to a diesel in your garage.</span><br><a class="btn btn-primary" href="#/jobs/oil-change">Oil change + filters</a> <a class="btn" href="#/garage">Switch vehicle</a></div>`; return;
    }
    const sig = jid + v.id;
    app.innerHTML = head + `<div class="building"><div class="bld-ico">${icon(job.icon, 54)}<span class="ring"></span></div><h2>Building your ${esc(job.name.toLowerCase())}…</h2><p class="muted">${esc(vehShort(v))}</p><div id="bldSteps"></div></div>`;
    if (kitState.sig !== sig) {
      await loadingSteps($('#bldSteps'), ['Decoding fitment for your VIN pattern', 'Selecting required parts', 'Adding parts commonly replaced together', 'Adding hardware, fluids & tools', 'Pricing Good · Better · Best kits']);
      if (!$('#bldSteps')) return; // navigated away
      kitState = { sig, tier: q.get('tier') || 'better', off: {} };
    }
    drawKit(job, v);
  }
  function drawKit(job, v) {
    const tier = kitState.tier;
    const items = buildKit(v, job, tier); items.forEach(i => { if (kitState.off[i.k] != null) i.on = kitState.off[i.k]; });
    const totals = Object.fromEntries(TIERS.map(t => [t, kitTotal(buildKit(v, job, t).map(i => (kitState.off[i.k] != null ? Object.assign(i, { on: kitState.off[i.k] }) : i)))]));
    const total = kitTotal(items); const cores = items.filter(i => i.on).reduce((a, i) => a + i.core * i.qty, 0);
    const n = items.filter(i => i.on).reduce((a, i) => a + i.qty, 0);
    app.innerHTML = `${crumbs([['Home', '#/'], ['Build my job', '#/jobs'], [job.name, '']])}
    <div class="kit-head"><div><span class="ai-badge">✨ Your job kit</span><h1 class="page-h">${esc(job.name)}</h1><div class="muted">${esc(D.vehicleLabel(v))} · ${esc(v.engine)}</div></div>
      <div class="kit-meta"><span><small>Difficulty</small>${diffHtml(job.diff)}</span><span><small>Est. time</small><b>${esc(job.time)}</b></span><span><small>Parts</small><b>${n}</b></span></div></div>
    <div class="gbb-toggle" role="radiogroup" aria-label="Kit tier">${TIERS.map(t => `<button class="t-${t} ${t === tier ? 'on' : ''}" data-tier="${t}" role="radio" aria-checked="${t === tier}"><span class="gt-r">${D.TIERS[t].rank}</span><b>${D.TIERS[t].label}</b><span class="gt-p">${money(totals[t])}</span></button>`).join('')}</div>
    <p class="small muted kit-tierline">${esc(D.TIERS[tier].tag)} Warranty: <b>${esc(D.TIERS[tier].warranty)}</b>. Switching tiers swaps every part in the kit.</p>
    <div class="co">
      <div class="co-main">${['req', 'together', 'hw', 'tool'].map(role => { const list = items.filter(i => i.role === role); if (!list.length) return '';
        return `<section class="kit-sec"><h3>${ROLE[role]} <span class="muted small">${list.length}</span></h3>${list.map(i => `<label class="kit-item ${i.on ? '' : 'off'}">
          <input type="checkbox" data-k="${i.k}" ${i.on ? 'checked' : ''} ${role === 'req' ? 'disabled' : ''}>
          <span class="ki-ico">${icon(i.extra ? (role === 'tool' ? 'gear' : 'box') : partIcon(i.part.subId), 30)}</span>
          <span class="ki-t"><b>${esc(i.name)}</b>${i.extra ? `<span class="muted small">${role === 'tool' ? 'Optional · skip if you own one' : 'Shop-grade · ships with your parts'}</span>` : `<span class="small">${esc(i.part.brand)} ${esc(i.part.partNo)} ${tierPill(i.part.tier)}</span>`}${i.why ? `<span class="ki-why">💡 ${esc(i.why)}</span>` : ''}</span>
          <span class="ki-p"><b>${money(i.price * i.qty)}</b><small>${i.qty > 1 ? i.qty + ' × ' + money(i.price) : ''}${i.core ? ` + ${money(i.core * i.qty)} core` : ''}</small></span></label>`).join('')}</section>`; }).join('')}</div>
      <aside class="co-side panel kit-side">
        <h2>Kit total</h2>
        <div class="sum"><span>${n} items · ${D.TIERS[tier].label}</span><b>${money(total)}</b></div>
        ${cores ? `<div class="sum"><span>Refundable cores</span><b>${money(cores)}</b></div>` : ''}
        <div class="sum disc"><span>Bundle savings vs. separate</span><b>${money(-(total * 0.06))}</b></div>
        <div class="sum total"><span>Total</span><b>${money(total * 0.94 + cores)}</b></div>
        <button class="btn btn-primary btn-lg btn-block" id="kitAdd">Add all ${n} to cart</button>
        <div class="cart-fit">${H.FIT_BADGE}</div>
        <p class="tiny muted">Torque specs & step-by-step guide included with your order.</p>
      </aside>
    </div>`;
    $$('.gbb-toggle button').forEach(b => b.onclick = () => { kitState.tier = b.dataset.tier; drawKit(job, v); });
    $$('.kit-item input').forEach(c => c.onchange = () => { kitState.off[c.dataset.k] = c.checked; drawKit(job, v); });
    $('#kitAdd').onclick = () => { const b = $('#kitAdd'); b.disabled = true; b.innerHTML = '<span class="spin"></span> Adding…'; setTimeout(() => { addKitToCart(v, job, tier, items); b.disabled = false; b.textContent = '✓ Added. Add again?'; }, 450); };
  }
  H.routes.jobs = pageJobs;

  // ================= 24/7 chat =================
  let chatOpen = false, chatStarted = false, rma = {};
  function chatCtx() {
    const v = curV(); const o = latestOrder();
    return `${v ? `🚚 ${esc(vehShort(v))}` : '🚚 No vehicle yet'} · 📦 Order ${esc(o.dispId)}`;
  }
  function latestOrder() { const o = H.getOrders()[0] || H.sampleOrder(); return Object.assign({}, o, { dispId: o.id === 'SAMPLE' ? 'JX418207' : o.id }); }
  function mountChat() {
    $('#chatRoot').innerHTML = `<div class="chat">
      <button class="chat-fab" id="chatFab" aria-label="Ask ${esc(S.name)}, 24/7 chat"><span class="cf-ico">💬</span><span class="cf-l">Ask ${esc(S.name)}</span><span class="cf-live">24/7</span></button>
      <div class="chat-panel" id="chatPanel" hidden role="dialog" aria-label="${esc(S.name)} assistant">
        <div class="cp-h"><div class="cp-av">${esc(S.nameA[0] + S.nameB[0])}</div><div class="cp-ht"><b>Ask ${esc(S.name)}</b><span><i class="live"></i>Online 24/7 · AI assistant, parts pros on call</span></div><button class="cp-x" id="cpX" aria-label="Close chat">✕</button></div>
        <div class="cp-ctx" id="cpCtx">${chatCtx()}</div>
        <div class="cp-body" id="cpBody"></div>
        <div class="cp-chips" id="cpChips"></div>
        <form class="cp-in" id="cpForm"><input id="cpIn" placeholder="Ask about fitment, orders, returns…" autocomplete="off"><button aria-label="Send">➤</button></form>
      </div></div>`;
    $('#chatFab').onclick = () => toggleChat(!chatOpen);
    $('#cpX').onclick = () => toggleChat(false);
    $('#cpForm').addEventListener('submit', e => { e.preventDefault(); const t = $('#cpIn').value.trim(); if (!t) return; $('#cpIn').value = ''; userMsg(t); route(t); });
  }
  function toggleChat(on) {
    chatOpen = on; $('#chatPanel').hidden = !on; $('#chatFab').classList.toggle('open', on); document.body.classList.toggle('chat-on', on);
    if (on && !chatStarted) { chatStarted = true; greet(); }
  }
  function userMsg(t) { $('#cpBody').insertAdjacentHTML('beforeend', `<div class="msg me"><div>${esc(t)}</div></div>`); chips([]); scroll(); }
  function scroll() { const b = $('#cpBody'); b.scrollTop = b.scrollHeight; }
  function chips(list) {
    $('#cpChips').innerHTML = list.map(([l, fn], i) => `<button class="chip" data-c="${i}">${esc(l)}</button>`).join('');
    $$('#cpChips .chip').forEach(b => b.onclick = () => { const [l, fn] = list[+b.dataset.c]; userMsg(l); fn(); });
  }
  async function bot(html, next) {
    const b = $('#cpBody'); b.insertAdjacentHTML('beforeend', '<div class="msg bot typing"><div><i></i><i></i><i></i></div></div>'); scroll();
    await wait(650);
    const t = $('.typing', b); if (t) t.remove();
    b.insertAdjacentHTML('beforeend', `<div class="msg bot"><div>${html}</div></div>`); scroll();
    if (next) chips(next);
  }
  const MAIN = () => [['Will this fit my truck?', fitFlow], ["Where's my order?", orderFlow], ['Return a part / core refund', returnFlow], ['Build a job kit', () => bot('Pick a job and I\'ll build the cart: <a href="#/jobs">open Build my job →</a>', MAIN())]];
  function greet() {
    const v = curV(); const o = latestOrder();
    bot(`Hi! I'm the ${esc(S.name)} assistant 👋 I can see ${v ? `your <b>${esc(vehShort(v))}</b>` : 'your account'} and your recent order <b>${esc(o.dispId)}</b>. What can I help with?`, MAIN());
  }
  function route(t) {
    if (/fit|fitment|work on|compatib|right part/i.test(t)) return fitFlow();
    if (/order|track|where|ship|package|deliver/i.test(t)) return orderFlow();
    if (/return|refund|core|rma|exchange|wrong part/i.test(t)) return returnFlow();
    if (/job|brake|hub|glow|oil|kit|clunk|noise/i.test(t)) return bot('Sounds like a job for the cart builder. It picks every part, bolt and fluid for your truck: <a href="#/jobs">Build my job →</a>', MAIN());
    if (/human|agent|person|call|phone/i.test(t)) return bot(`Connecting you to a parts pro… 🧑‍🔧 Average wait right now: <b>under 2 min</b>. Or call <b>${esc(S.support)}</b> (7am–10pm ET).`, MAIN());
    bot('I can check fitment, track orders, and start returns or core refunds. Pick one below, or type “human” for a parts pro.', MAIN());
  }
  function fitFlow(ctx) {
    const v = curV();
    let p = ctx && ctx.p; let pv = ctx && ctx.v;
    if (!p) { const lp = store.get('lastPart', null); const r = lp && D.findPart(lp.vid, lp.subId, lp.i); if (r) { p = r.part; pv = r.v; } }
    if (!p && v) { p = D.partsFor(v, 'wheel-hub-assembly').find(x => x.tier === 'better'); pv = v; }
    if (!v || !p) return bot('Add your truck first (VIN or plate is fastest) and I\'ll check any part against it.', [['Add my vehicle', () => H.openLookup('vin')], ...MAIN().slice(1)]);
    const fits = pv.id === v.id;
    bot(fits ? `<div class="fitcard ok"><b>✓ Yes, it fits.</b><br>${esc(p.brand)} ${esc(p.partNo)} (${esc(p.subName)}${p.pos ? ', ' + esc(p.pos) : ''}) fits your <b>${esc(vehShort(v))}</b>.<ul><li>Matched on VIN pattern + engine code</li><li>Cross-checked to 2 OE numbers</li><li>${p.subId === 'wheel-hub-assembly' ? (v.hd ? '8-lug, 4WD' : '6-lug, 4WD') + ' confirmed' : 'Position & connector confirmed'}</li></ul>${H.FIT_BADGE}</div>`
      : `<div class="fitcard no"><b>⚠ Not for this truck.</b><br>${esc(p.brand)} ${esc(p.partNo)} is for a ${esc(D.vehicleLabel(pv))}, not your ${esc(vehShort(v))}. <a href="#/v/${v.id}/${p.subId}">See ${esc(p.subName)} that fit →</a></div>`,
    [['Check a different part', () => bot('Paste a part number or open any product page and tap “Will this fit?”. I\'ll check it against your garage.', MAIN())], ...MAIN().slice(1)]);
  }
  function trackingCards(o) {
    const t = H.cartTotals(o.lines, o.choices);
    const steps = ['Label created', 'In transit', 'Out for delivery', 'Delivered'];
    return t.groups.map((g, i) => { const W = D.WAREHOUSES[g.wh]; const st = Math.max(0, 2 - i); const carrier = ['UPS Ground', 'FedEx Ground', 'UPS Ground', 'FedEx Home'][i % 4];
      const trk = (carrier.startsWith('UPS') ? '1Z' + (8000 + i) + 'V' : '7' + (7120 + i)) + String(Math.abs(D.rng(o.id + i)() * 1e10 | 0)).padStart(10, '0');
      return `<div class="trk"><div class="trk-h"><b>Box ${i + 1} of ${t.groups.length}</b><span class="muted small">from ${esc(W.city)}</span></div>
        <div class="trk-s">${steps[st]} · ETA <b>${fmtDate(addDays(st === 2 ? 0 : W.d))}</b></div>
        <div class="trk-bar">${steps.map((s, k) => `<i class="${k <= st ? 'on' : ''}"></i>`).join('')}</div>
        <div class="trk-m small"><span>${carrier}</span><code>${trk}</code></div>
        <div class="trk-items small muted">${g.lines.map(l => `${l.qty}× ${esc(l.name)}`).join(' · ')}</div></div>`; }).join('');
  }
  H.trackingCards = trackingCards;
  function orderFlow() {
    const o = latestOrder(); const t = H.cartTotals(o.lines, o.choices);
    bot(`Order <b>${esc(o.dispId)}</b> ships in <b>${t.groups.length} boxes</b>, each from the warehouse closest to you:${trackingCards(o)}`, [['Return a part from this order', returnFlow], ['Talk to a human', () => route('human')], ['Something else', () => bot('Sure, what else?', MAIN())]]);
  }
  function returnFlow() {
    const o = latestOrder(); rma = { o };
    bot(`Which item from order <b>${esc(o.dispId)}</b>?`, o.lines.slice(0, 4).map(l => [`${l.qty > 1 ? l.qty + '× ' : ''}${l.name}${l.core ? ' (core)' : ''}`, () => { rma.l = l; returnReason(); }]));
  }
  function returnReason() {
    const l = rma.l;
    bot(`Got it: <b>${esc(l.brand)} ${esc(l.partNo || l.name)}</b>. What's the reason?`, (l.core ? [['Core refund (old part)', () => rmaDone('core')]] : []).concat([['Doesn\'t fit', () => rmaDone('fit')], ['Defective / failed', () => rmaDone('defect')], ['Changed my mind', () => rmaDone('change')]]));
  }
  function rmaDone(reason) {
    const l = rma.l; const id = 'RMA-' + (40000 + Math.floor(Math.random() * 59999));
    const amt = reason === 'core' ? l.core * l.qty : l.price * l.qty;
    const note = { core: 'Core refund issues when the old unit is scanned at the warehouse (usually 3–5 days).', fit: 'Fits-or-we-pay-the-return: return shipping is on us. No restocking fee.', defect: 'Warranty replacement ships today, no need to wait for the return.', change: 'Unopened parts within 60 days. Return shipping is deducted from the refund.' }[reason];
    bot(`<div class="rma"><div class="rma-h">✓ Return started · <b>${id}</b></div>
      <div class="sum"><span>${reason === 'core' ? 'Core refund' : reason === 'defect' ? 'Replacement value' : 'Refund'}</span><b>${money(amt)}</b></div>
      <div class="label-mock"><div><b>PREPAID ${reason === 'change' ? 'RETURN' : 'UPS'} LABEL</b><small>Ship to: ${esc(D.WAREHOUSES[l.wh].city)} returns dock</small></div><div class="barcode"></div><code>1Z RTN ${id.slice(4)} 03</code></div>
      <p class="small">${note}</p><button class="btn btn-sm btn-primary" data-lbl>Download label (PDF)</button> <button class="btn btn-sm" data-qr>Show QR for drop-off</button></div>`,
    [['Track my order', orderFlow], ['Anything else', () => bot('Happy to help. What else?', MAIN())]]).then(() => {
      $$('[data-lbl]').forEach(b => b.onclick = () => toast('Label PDF downloaded (mock)'));
      $$('[data-qr]').forEach(b => b.onclick = () => toast('QR code ready: show it at any UPS Store (mock)', 'info'));
    });
  }
  function chatAsk(intent, ctx) {
    toggleChat(true);
    const go = () => {
      if (intent === 'fit') { userMsg('Will this fit my truck?'); fitFlow(ctx); }
      else if (intent === 'order') { userMsg("Where's my order?"); orderFlow(); }
      else if (intent === 'return') { userMsg('I need to return a part / get a core refund'); returnFlow(); }
    };
    if (intent === 'hi') return;
    setTimeout(go, chatStarted && $('#cpBody').children.length > 1 ? 0 : 900);
  }
  H.chatAsk = chatAsk;

  // ================= order tracking page =================
  H.routes.track = function () {
    const o = latestOrder();
    app.innerHTML = `${crumbs([['Home', '#/'], ['Track order', '']])}<h1 class="page-h">Track your order</h1>
      <div class="panel track-form"><form id="trkForm" class="form2"><label>Order number<input id="trkId" value="${esc(o.dispId)}"></label><label>Email or ZIP<input value="43506"></label><button class="btn btn-primary span2">Track</button></form></div><div id="trkOut"></div>`;
    $('#trkForm').addEventListener('submit', async e => {
      e.preventDefault(); const out = $('#trkOut');
      if (!$('#trkId').value.trim()) { out.innerHTML = '<div class="lk-err">Enter your order number (it starts with PR).</div>'; return; }
      out.innerHTML = '<div class="skel-list"><i></i><i></i></div>'; await wait(600);
      out.innerHTML = `<div class="panel"><h2>Order ${esc(o.dispId)}</h2><div class="trk-grid">${trackingCards(o)}</div><button class="btn btn-sm" data-chat="return">Start a return / core refund</button></div>`;
    });
    $('#trkForm').requestSubmit();
  };

  // ================= Shops & Fleets =================
  const PRO_TIERS = [['Shop', '$1,000+/mo', 0.08, 'Net 15'], ['Shop Pro', '$5,000+/mo', 0.12, 'Net 30'], ['Fleet', '$15,000+/mo', 0.18, 'Net 30 + consolidated billing']];
  function pagePro(parts) {
    if (parts[1] === 'dashboard') return pageFleet();
    if (parts[1] === 'apply') return pageApply();
    app.innerHTML = `${crumbs([['Home', '#/'], ['Shops & Fleets', '']])}
    <section class="pro-hero"><div><span class="pb-k">${esc(S.name)} Pro</span><h1>The parts account built for shops & fleets.</h1>
      <p>Tiered shop pricing, Net 30 terms, PO numbers at checkout, every truck's VIN on file, and one-click reorders of the jobs you do every week.</p>
      <div class="hero-ctas"><a class="btn btn-primary btn-lg" href="#/pro/apply">Apply in 3 minutes</a><a class="btn btn-ghost-l btn-lg" href="#/pro/dashboard">See demo dashboard</a></div>
      <p class="small pro-proof">Trusted by 9,800+ repair shops & fleets · $0 to join · Decisions in 1 business day</p></div>
      <div class="pro-card"><div class="pc-row"><span>Shop Pro pricing</span><b class="pos">−12%</b></div><div class="pc-row"><span>Terms</span><b>Net 30</b></div><div class="pc-row"><span>Credit line</span><b>$25,000</b></div><div class="pc-row"><span>Fleet vehicles</span><b>12 on file</b></div><div class="pc-row"><span>Users</span><b>4 techs</b></div></div></section>
    <div class="feat-grid">${[['💲', 'Tiered shop pricing', 'Automatic −8% to −18% off every part, based on monthly volume. No codes.'], ['🧾', 'Net 30 terms', 'Credit lines up to $50k. One consolidated monthly statement.'], ['🚛', 'Fleet garage', 'Every unit\'s VIN, mileage and service history. Parts filtered per truck.'], ['🔁', 'One-click reorders', 'Re-run a past job kit for any unit. Same parts, same tier.'], ['👥', 'Multiple users & approvals', 'Techs order with a PO, managers approve from their phone.'], ['📄', 'PO numbers & tax-exempt', 'PO and unit # on every invoice. Upload your resale certificate once.']].map(f => `<div class="feat"><span>${f[0]}</span><b>${f[1]}</b><p>${f[2]}</p></div>`).join('')}</div>
    <section class="panel"><h2>Pricing tiers</h2><div class="tscroll"><table class="grid pro-t"><thead><tr><th>Tier</th><th>Monthly volume</th><th>Discount</th><th>Terms</th></tr></thead><tbody>${PRO_TIERS.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="pos"><b>−${Math.round(r[2] * 100)}%</b></td><td>${r[3]}</td></tr>`).join('')}</tbody></table></div><p class="small muted">Example: a $412 front-end kit costs $362.56 on Shop Pro.</p></section>
    <div class="rev-grid">${[['“We dropped two local suppliers. Techs build the job kit on a tablet, I approve the PO, parts are here next morning.”', 'Brett W., fleet manager · 9 trucks'], ['“Net 30 and the per-truck VIN list are the killer features. No more wrong-year parts.”', 'Ana P., owner · Pinecrest Diesel Repair'], ['“Reordering the same oil service kit for 14 trucks takes about ten seconds.”', 'Ron S., shop foreman · Ridgeline Ag']].map(r => `<div class="rev-card">${stars(5)}<p>${esc(r[0])}</p><small class="muted">${esc(r[1])}</small></div>`).join('')}</div>`;
  }
  function pageApply() {
    app.innerHTML = `${crumbs([['Home', '#/'], ['Shops & Fleets', '#/pro'], ['Apply', '']])}<h1 class="page-h">Apply for a Pro account</h1><p class="muted">Takes about 3 minutes. No credit pull for Shop tier.</p>
    <form class="panel" id="applyForm" novalidate><div class="form2">
      <label class="span2">Business legal name *<input name="biz" required placeholder="Pinecrest Diesel Repair LLC"></label>
      <label>Business type *<select name="type" required><option value="">Select…</option><option>Independent repair shop</option><option>Fleet (own vehicles)</option><option>Dealer / service dept.</option><option>Ag / construction</option></select></label>
      <label>EIN<input name="ein" placeholder="12-3456789"></label>
      <label>Fleet size<select><option>1–5</option><option selected>6–25</option><option>26–100</option><option>100+</option></select></label>
      <label>Est. monthly parts spend<select><option>Under $1,000</option><option selected>$1,000–$5,000</option><option>$5,000–$15,000</option><option>$15,000+</option></select></label>
      <label>Contact name *<input name="name" required></label><label>Work email *<input name="email" type="email" required></label>
      <label>Phone<input placeholder="(419) 555-0100"></label><label>ZIP *<input name="zip" required maxlength="5" inputmode="numeric"></label>
      <label class="span2">Terms requested<select><option>Net 30 (credit application)</option><option>Card on file, shop pricing only</option></select></label>
      <label class="span2 file-mock"><span>Resale / tax-exempt certificate (optional)</span><button type="button" class="btn btn-sm" id="certBtn">📎 Upload PDF</button></label>
    </div><label class="ck small"><input type="checkbox" required name="ok"> I agree to the Pro account terms and authorize a business credit check for Net terms.</label>
    <div class="lk-err" id="apErr" hidden></div><button class="btn btn-primary btn-lg">Submit application</button></form>`;
    $('#certBtn').onclick = e => { e.target.textContent = '✓ resale-cert-2026.pdf'; toast('Certificate attached (mock)'); };
    $('#applyForm').addEventListener('submit', async e => {
      e.preventDefault(); const f = e.target; const miss = $$('[required]', f).filter(x => x.type === 'checkbox' ? !x.checked : !x.value.trim() || (x.type === 'email' && !/^\S+@\S+\.\S+$/.test(x.value)));
      $$('.bad', f).forEach(x => x.classList.remove('bad')); miss.forEach(x => x.classList.add('bad'));
      if (miss.length) { $('#apErr').hidden = false; $('#apErr').textContent = `Please complete ${miss.length} required field${miss.length > 1 ? 's' : ''} (highlighted).`; return; }
      const b = $('button.btn-lg', f); b.disabled = true; b.innerHTML = '<span class="spin"></span> Submitting…'; await wait(1000);
      app.innerHTML = `<div class="panel confirm"><div class="big-check">✓</div><h1>Application received</h1><p>Reference <b>APP-${Math.floor(10000 + Math.random() * 89999)}</b>. You're pre-approved for <b>Shop pricing (−8%)</b> starting now.</p><p class="muted small">Net 30 credit decision in 1 business day. We'll email ${esc(f.email.value)}.</p><div class="confirm-cta"><a class="btn btn-primary" href="#/pro/dashboard">Preview your dashboard</a><a class="btn" href="#/">Start shopping</a></div></div>`;
    });
  }
  const PAST_JOBS = [['U-104', 'front-end', 'better', 'Sep 28', 'PO-88391'], ['U-107', 'front-brakes', 'best', 'Sep 19', 'PO-88302'], ['U-102', 'oil-change', 'better', 'Sep 12', 'PO-88270'], ['U-110', 'front-hubs', 'best', 'Aug 30', 'PO-88114'], ['U-103', 'glow-plugs', 'better', 'Aug 21', 'PO-88050']];
  let fleetUsers = null;
  async function pageFleet() {
    const C = D.FLEET_CO; fleetUsers = fleetUsers || D.FLEET_USERS.slice();
    app.innerHTML = `${crumbs([['Home', '#/'], ['Shops & Fleets', '#/pro'], ['Dashboard', '']])}<div class="skel-dash"><i></i><i></i><i></i><i></i><b></b><b></b></div>`;
    await wait(450); if (!$('.skel-dash')) return;
    const mtd = D.FLEET_SPEND[D.FLEET_SPEND.length - 1][1]; const prev = D.FLEET_SPEND[D.FLEET_SPEND.length - 2][1];
    const ytdSave = D.FLEET_SPEND.reduce((a, s) => a + s[1], 0) * C.discount / (1 - C.discount) + 4120;
    const maxS = Math.max(...D.FLEET_SPEND.map(s => s[1]));
    const unitV = u => D.findVehicle(D.FLEET.find(f => f.unit === u).vid);
    app.innerHTML = `${crumbs([['Home', '#/'], ['Shops & Fleets', '#/pro'], ['Dashboard', '']])}
    <div class="fl-head"><div><span class="pb-k dark">Pro account · ${esc(C.acct)}</span><h1 class="page-h">${esc(C.name)}</h1>
      <div class="fl-badges"><span class="bdg net">🧾 ${esc(C.terms)} terms</span><span class="bdg tierb">💲 ${esc(C.tier)} pricing −${Math.round(C.discount * 100)}%</span><span class="bdg">👥 ${fleetUsers.length} users</span><span class="bdg">Customer since ${C.since}</span></div></div>
      <div class="fl-acts"><a class="btn" href="#/cart">Cart</a><a class="btn btn-primary" href="#/jobs">+ New job kit</a></div></div>
    <div class="kpis">
      <div class="kpi"><span>Available credit</span><b>${money(C.limit - C.balance)}</b><small>of ${money(C.limit)} line</small><div class="meter"><i style="width:${(C.balance / C.limit * 100).toFixed(0)}%"></i></div></div>
      <div class="kpi"><span>Statement balance</span><b>${money(C.balance)}</b><small>Due Oct 30 · auto-pay off</small></div>
      <div class="kpi"><span>October spend (MTD)</span><b>${money(mtd)}</b><small>${money(prev)} in Sep</small></div>
      <div class="kpi"><span>Saved with shop pricing</span><b class="pos">${money(ytdSave)}</b><small>Year to date</small></div>
    </div>
    <div class="fl-grid">
      <section class="panel"><div class="block-h"><h2>Spend, last 6 months</h2><span class="muted small">${money(4710)} in Sep · ${money(10290)} to Fleet tier (−18%)</span></div>
        <div class="bars" role="img" aria-label="Monthly spend">${D.FLEET_SPEND.map(([m, s], i) => `<div class="bar-c" title="${m}: ${money(s)}"><span class="bv">${i === D.FLEET_SPEND.length - 1 || s === maxS ? '$' + (s / 1000).toFixed(1) + 'k' : ''}</span><i style="height:${(s / maxS * 100).toFixed(0)}%" class="${i === D.FLEET_SPEND.length - 1 ? 'cur' : ''}"></i><span class="bm">${m}</span></div>`).join('')}</div>
        <p class="tiny muted">October is month-to-date.</p></section>
      <section class="panel"><div class="block-h"><h2>Users & techs</h2><button class="btn btn-sm" id="invite">+ Invite</button></div>
        <ul class="users">${fleetUsers.map(u => `<li><span class="rc-av">${u[0].split(' ').map(x => x[0]).join('')}</span><span><b>${esc(u[0])}</b><small>${esc(u[1])} · ${esc(u[2])}</small></span></li>`).join('')}</ul></section>
    </div>
    <section class="panel"><div class="block-h"><h2>Reorder a past job</h2><span class="muted small">One click: same parts, same tier, your price</span></div>
      <div class="tscroll"><table class="grid reorder"><thead><tr><th>Unit</th><th>Job kit</th><th>Tier</th><th>Last ordered</th><th class="r">List</th><th class="r">Your price</th><th></th></tr></thead><tbody>
      ${PAST_JOBS.map(([u, jid, t, d, po], k) => { const v = unitV(u); const j = D.JOBS.find(x => x.id === jid); const kit = buildKit(v, j, t); const tot = kitTotal(kit);
        return `<tr><td><b>${u}</b><br><small class="muted">${esc(vehShort(v))}</small></td><td>${esc(j.name)}</td><td>${tierPill(t)}</td><td>${d}<br><small class="muted">${po}</small></td><td class="r muted"><s>${money(tot)}</s></td><td class="r"><b>${money(tot * (1 - C.discount))}</b></td><td class="r"><button class="btn btn-sm btn-primary" data-re="${k}">Reorder</button></td></tr>`; }).join('')}
      </tbody></table></div></section>
    <section class="panel"><div class="block-h"><h2>Fleet vehicles <span class="muted small">${D.FLEET.length}</span></h2><input class="tree-filter fl-filter" id="flFilter" type="search" placeholder="Filter by unit, VIN, driver…"></div>
      <div class="tscroll"><table class="grid fleet-t"><thead><tr><th>Unit</th><th>Vehicle</th><th>VIN</th><th class="r">Mileage</th><th>Driver</th><th>Status</th><th></th></tr></thead><tbody id="flBody">
      ${D.FLEET.map(f => { const v = D.findVehicle(f.vid); return `<tr data-s="${esc((f.unit + ' ' + f.vin + ' ' + f.driver + ' ' + D.vehicleLabel(v)).toLowerCase())}"><td><b>${f.unit}</b></td><td>${esc(vehShort(v))}</td><td><code>${f.vin}</code></td><td class="r">${f.miles.toLocaleString()} mi</td><td>${esc(f.driver)}</td><td><span class="st-b ${f.status === 'OK' ? 'ok' : 'due'}">${esc(f.status)}</span></td><td class="r nowrap"><button class="btn btn-sm" data-shop="${f.vid}">Shop</button> <button class="btn btn-sm" data-job="${f.vid}|${f.status.includes('front') ? 'front-end' : 'oil-change'}">Build job</button></td></tr>`; }).join('')}
      </tbody></table></div><div class="empty" id="flEmpty" hidden>No vehicles match.</div></section>
    <section class="panel"><h2>Open invoices</h2><div class="tscroll"><table class="grid"><thead><tr><th>Invoice</th><th>PO #</th><th>Date</th><th class="r">Amount</th><th>Status</th></tr></thead><tbody>
      ${[['INV-30418', 'PO-88391', 'Sep 28', 362.56, 'Open'], ['INV-30377', 'PO-88302', 'Sep 19', 518.2, 'Open'], ['INV-30351', 'PO-88270', 'Sep 12', 1240.81, 'Open'], ['INV-30212', 'PO-88114', 'Aug 30', 2210.4, 'Paid']].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td class="r">${money(r[3])}</td><td><span class="st-b ${r[4] === 'Paid' ? 'ok' : ''}">${r[4]}</span></td></tr>`).join('')}</tbody></table></div></section>`;
    $$('[data-re]').forEach(b => b.onclick = () => { const [u, jid, t] = PAST_JOBS[+b.dataset.re]; const v = unitV(u); const j = D.JOBS.find(x => x.id === jid);
      b.disabled = true; b.innerHTML = '<span class="spin"></span>'; setTimeout(() => { addKitToCart(v, j, t, buildKit(v, j, t), `${u} ${j.name}`); b.disabled = false; b.textContent = '✓ Added'; }, 400); });
    $$('[data-shop]').forEach(b => b.onclick = () => { H.setVehicle(b.dataset.shop); location.hash = '#/v/' + b.dataset.shop; });
    $$('[data-job]').forEach(b => b.onclick = () => { const [vid, jid] = b.dataset.job.split('|'); H.setVehicle(vid); location.hash = '#/jobs/' + jid; });
    $('#flFilter').addEventListener('input', e => { const t = e.target.value.toLowerCase().trim(); let n = 0; $$('#flBody tr').forEach(r => { const m = r.dataset.s.includes(t); r.hidden = !m; n += m; }); $('#flEmpty').hidden = n > 0; });
    $('#invite').onclick = () => {
      openModal(`<h2>Invite a user</h2><form id="invForm" class="form2"><label class="span2">Name<input id="invName" required placeholder="Jordan Lee"></label><label class="span2">Email<input type="email" placeholder="jordan@blackswamp.example"></label><label class="span2">Role<select id="invRole"><option>Technician</option><option>Shop foreman</option><option>Accounts payable</option></select></label><button class="btn btn-primary span2">Send invite</button></form>`);
      $('.m-box').classList.add('m-narrow');
      $('#invForm').addEventListener('submit', e => { e.preventDefault(); const n = $('#invName').value.trim(); if (!n) return $('#invName').classList.add('bad'); const r = $('#invRole').value; fleetUsers.push([n, r, r === 'Technician' ? 'Order with PO · needs approval' : r === 'Shop foreman' ? 'Order · approve up to $2,500' : 'Invoices only']); closeModal(); toast(`Invite sent to <b>${esc(n)}</b>`); pageFleet(); });
    };
  }
  H.routes.pro = pagePro;

  // ================= SEO guides =================
  function guideTitle(v, subId) {
    const f = D.findSub(subId); const pos = (f.sub.pos || [])[0];
    const nm = subId === 'wheel-hub-assembly' ? 'Front Wheel Hub' : (pos && !/Left|Right/.test(pos) ? pos + ' ' : '') + f.sub.name;
    return `${D.vehicleLabel(v)} ${nm}: Good vs Better vs Best`;
  }
  function guideCards(pairs) {
    return pairs.map(([v, s]) => { const ps = D.partsFor(v, s); const lo = Math.min(...ps.map(p => p.price)); const f = D.findSub(s);
      return `<a class="guide-card" href="#/guide/${D.guideSlug(v, s)}"><span class="gc-thumb">${icon(partIcon(s, f.cat.icon), 34)}<i>▶</i></span><span class="gc-t"><b>${esc(guideTitle(v, s))}</b><small>${shortEngine(v.engine)} · 3 tiers from ${money(lo)} · ${4 + (ps.length % 5)} min read</small></span></a>`; }).join('');
  }
  function pageGuides(parts, q) {
    const all = []; D.GUIDE_VEHICLES.forEach(g => { const v = D.findVehicle(D.vid(...g)); if (v) D.GUIDE_PARTS.forEach(s => { if (D.subsFor(D.findSub(s).cat, v).some(x => x.id === s)) all.push([v, s]); }); });
    const makes = [...new Set(all.map(([v]) => v.make))];
    const st = { make: 'All', part: '', t: '', n: 24 };
    app.innerHTML = `${crumbs([['Home', '#/'], ['Repair guides', '']])}
    <div class="gd-hero"><div><h1 class="page-h">Repair & buying guides</h1><p class="muted">Good vs Better vs Best comparisons, symptoms, and install notes for every vehicle and part we sell.</p></div>
      <div class="gd-stats"><span><b>2,847,310</b><small>guides published</small></span><span><b>41,200</b><small>vehicles</small></span><span><b>1,140</b><small>part types</small></span></div></div>
    <p class="tiny muted internal-note">INTERNAL NOTE: pages are generated from catalog × fitment data (vehicle × part type). ${all.length} examples shown here.</p>
    <div class="gd-filters"><div class="chips" id="gdMakes">${['All'].concat(makes).map(m => `<button class="chip ${m === 'All' ? 'on' : ''}" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div>
      <div class="filters-r"><select id="gdPart" aria-label="Part type"><option value="">All part types</option>${D.GUIDE_PARTS.map(s => `<option value="${s}">${esc(D.findSub(s).sub.name)}</option>`).join('')}</select><input type="search" class="tree-filter" id="gdQ" placeholder="Search guides…"></div></div>
    <div class="guide-grid" id="gdList"></div><div class="gd-more"><button class="btn" id="gdMore">Load more guides</button><span class="muted small" id="gdCount"></span></div>`;
    const draw = () => {
      const list = all.filter(([v, s]) => (st.make === 'All' || v.make === st.make) && (!st.part || s === st.part) && (!st.t || guideTitle(v, s).toLowerCase().includes(st.t)));
      $('#gdList').innerHTML = list.length ? guideCards(list.slice(0, st.n)) : '<div class="empty"><div class="empty-ico">📚</div><b>No guides match</b><br><span class="small">Try a different make or part.</span></div>';
      $('#gdMore').hidden = list.length <= st.n; $('#gdCount').textContent = `Showing ${Math.min(st.n, list.length)} of ${list.length}`;
    };
    $$('#gdMakes .chip').forEach(c => c.onclick = () => { st.make = c.dataset.m; st.n = 24; $$('#gdMakes .chip').forEach(x => x.classList.toggle('on', x === c)); draw(); });
    $('#gdPart').onchange = e => { st.part = e.target.value; st.n = 24; draw(); };
    $('#gdQ').oninput = e => { st.t = e.target.value.toLowerCase().trim(); draw(); };
    $('#gdMore').onclick = () => { const b = $('#gdMore'); b.innerHTML = '<span class="spin dark"></span> Loading…'; setTimeout(() => { st.n += 24; b.textContent = 'Load more guides'; draw(); }, 400); };
    draw();
  }
  function pageGuide(parts) {
    const [vidStr, subId] = (parts[1] || '').split('__'); const v = D.findVehicle(vidStr); const f = D.findSub(subId || '');
    if (!v || !f) return H.routes.__nf();
    const all = D.partsFor(v, subId); const pos = (f.sub.pos || [])[0]; const ps = pos ? all.filter(p => p.pos === pos) : all;
    const hub = subId === 'wheel-hub-assembly'; const title = guideTitle(v, subId); const nm = title.split(': ')[0].replace(D.vehicleLabel(v) + ' ', '');
    const top = t => ps.filter(p => p.tier === t).sort((a, b) => b.rating - a.rating)[0];
    const lo = t => Math.min(...ps.filter(p => p.tier === t).map(p => p.price));
    const rowsHub = [['Bearing', 'Double-row ball, standard steel', 'OE-spec double-row', 'Oversized tapered roller'], ['Seal', 'Single-lip', 'Double-lip', 'Triple-lip contamination'], ['ABS sensor', 'Sometimes sold separately', 'Included (most)', 'Included, armored lead'], ['Expected life', '40–60k mi', '80–120k mi', '150k+ mi, towing']];
    const rowsGen = D.tierMaterials(subId, 'good').map((_, k) => ['Build', D.tierMaterials(subId, 'good')[k], D.tierMaterials(subId, 'better')[k], D.tierMaterials(subId, 'best')[k]]).slice(0, 3);
    const faqs = [
      [`How do I know my ${nm.toLowerCase()} is going bad?`, hub ? 'A growl or hum that rises with speed, play in the wheel at 12 and 6 o\'clock, an ABS/traction light, or uneven tire wear. On 4WD Rams, a failing hub often triggers the ABS light first.' : 'Noise, vibration, warning lights or visibly worn components are the common signs. Our symptom checker in Build my job can narrow it down.'],
      [`Should I replace both sides at the same time?`, hub ? 'Yes, usually. Both front hubs have the same miles and load. Doing both at once saves a second teardown and the labor is mostly shared.' : 'For wear items like pads, rotors and shocks: always in axle pairs. For sensors and electrical parts: only the failed one.'],
      [`Which tier should I buy for a ${D.vehicleLabel(v)}?`, `If you tow more than a couple times a month or run it commercially, Best (Heavy Duty). For daily driving, Better matches the factory part. If you're selling soon, Good gets you there for less.`],
      [`How long does the job take?`, hub ? '2.5–3.5 hours per side in a driveway with hand tools. You\'ll need a 36 mm axle nut socket and a torque wrench (axle nut torque varies, so check your service manual).' : '1–3 hours for most DIYers. Our job kits list the exact tools you need.'],
      ['Is there a core charge?', all.some(p => p.core) ? 'Some remanufactured options have a refundable core. Send the old part back with the prepaid label in the box.' : 'No. This part has no core charge.']
    ];
    const related = D.JOBS.filter(j => j.items.some(i => i[0] === subId)).concat(D.JOBS.filter(j => !j.items.some(i => i[0] === subId) && (!j.diesel || v.diesel))).slice(0, 3);
    const otherParts = D.GUIDE_PARTS.filter(s => s !== subId && D.subsFor(D.findSub(s).cat, v).some(x => x.id === s)).slice(0, 4).map(s => [v, s]);
    const otherVeh = D.GUIDE_VEHICLES.map(g => D.findVehicle(D.vid(...g))).filter(x => x && x.id !== v.id).slice(0, 4).map(x => [x, subId]).filter(([x, s]) => D.subsFor(D.findSub(s).cat, x).some(y => y.id === s));
    app.innerHTML = `${crumbs([['Home', '#/'], ['Guides', '#/guides'], [v.make, '#/guides'], [v.model, '#/guides'], [String(v.year), '#/guides'], [nm, '']])}
    <article class="guide">
      <header class="g-head"><span class="ai-badge plain">Buying guide</span><h1>${esc(title)}</h1>
        <div class="g-by"><span class="rc-av">MK</span><span>By <b>Mike Kessler</b>, ASE Master Tech · Updated Oct 2, 2026 · 6 min read</span></div></header>
      <div class="g-answer"><b>Short answer:</b> For a ${esc(D.vehicleLabel(v))} ${esc(shortEngine(v.engine))}, the <b>Better (Daily Driver)</b> ${esc(nm.toLowerCase())} from ${money(lo('better'))} matches the factory part. If you tow heavy, step up to <b>Best (Heavy Duty)</b> from ${money(lo('best'))}. <b>Good</b> starts at ${money(lo('good'))}.</div>
      <button class="g-video" id="gVideo" aria-label="Play video"><span class="gv-ico">${icon(partIcon(subId, f.cat.icon), 90)}</span><span class="gv-play">▶</span><span class="gv-cap">${esc(nm)} replacement: ${esc(v.make)} ${esc(v.model)} · Good vs Better vs Best</span><span class="gv-dur">6:42</span></button>
      <h2>Good vs Better vs Best compared</h2>
      <div class="tscroll"><table class="cmp-table g-cmp"><thead><tr><th></th>${TIERS.map(t => `<th class="t-${t}"><span class="tier-pill t-${t}">${D.TIERS[t].rank}</span><br><b>${D.TIERS[t].label}</b></th>`).join('')}</tr></thead><tbody>
        <tr><th>Price from</th>${TIERS.map(t => `<td><b>${money(lo(t))}</b></td>`).join('')}</tr>
        <tr><th>Warranty</th>${TIERS.map(t => `<td>${D.TIERS[t].warranty}</td>`).join('')}</tr>
        ${(hub ? rowsHub : rowsGen).map(r => `<tr><th>${r[0]}</th><td>${esc(r[1])}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td></tr>`).join('')}
        <tr><th>Top rated</th>${TIERS.map(t => { const p = top(t); return `<td>${p ? `${esc(p.brand)}<br>${stars(p.rating)} <small>${p.rating} (${p.reviews})</small>` : '—'}</td>`; }).join('')}</tr>
        <tr><th>Best for</th>${TIERS.map(t => `<td>${D.TIERS[t].bestFor}</td>`).join('')}</tr>
        <tr><th></th>${TIERS.map(t => `<td><a class="btn btn-sm btn-primary" href="#/v/${v.id}/${subId}?tier=${t}">Shop ${D.TIERS[t].label}</a></td>`).join('')}</tr>
      </tbody></table></div>
      <h2>Buying guide</h2>
      <h3>When to replace it</h3><p>${hub ? `The ${esc(v.model)}'s front hub carries the full weight of the ${esc(shortEngine(v.engine))} up front. Most original hubs on these trucks last 80,000–120,000 miles, less with big tires, plowing or regular gooseneck towing.` : `Most ${esc(f.sub.name.toLowerCase())}s on the ${esc(D.vehicleLabel(v))} are replaced between 50,000 and 120,000 miles depending on use. Towing and short-trip driving shorten service life.`}</p>
      <h3>How to choose a tier</h3><ul class="g-list"><li><b>Good:</b> ${D.TIERS.good.bestFor}.</li><li><b>Better:</b> ${D.TIERS.better.bestFor}.</li><li><b>Best:</b> ${D.TIERS.best.bestFor}.</li></ul>
      <h3>What else to replace while you're in there</h3><p>${hub ? 'ABS wheel speed sensors (they usually break coming out), front brake pads, and axle U-joints. Our front hub job kit includes all of it.' : 'Related hardware and anything with similar wear. Build my job will add the parts mechanics commonly replace together.'}</p>
      <div class="g-fit">${H.FIT_BADGE}<span class="small">Every part linked here is verified to fit the ${esc(D.vehicleLabel(v))} ${esc(shortEngine(v.engine))}.</span></div>
      <h2>FAQs</h2><div class="faqs">${faqs.map(([qq, a], k) => `<details ${k === 0 ? 'open' : ''}><summary>${esc(qq)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
      <h2>Related jobs</h2><div class="job-grid sm">${related.map(j => `<a class="job-card" href="#/jobs/${j.id}" data-setv="${v.id}">${icon(j.icon, 28)}<b>${esc(j.name)}</b><div class="jc-m"><span>${diffHtml(j.diff)}</span><span>⏱ ${esc(j.time)}</span></div></a>`).join('')}</div>
      <h2>Related guides</h2><div class="guide-grid">${guideCards(otherParts.concat(otherVeh).slice(0, 6))}</div>
      <aside class="serp"><span class="internal">INTERNAL · SEARCH PREVIEW</span><div class="serp-url">${esc(S.name.toLowerCase())}.com › guides › ${esc(v.make.toLowerCase())} › ${esc(D.slug(v.model))} › ${v.year}</div><div class="serp-t">${esc(title)} | ${esc(S.name)}</div><div class="serp-d">Compare ${esc(nm.toLowerCase())} options for the ${esc(D.vehicleLabel(v))}: prices from ${money(lo('good'))}, warranties, top-rated brands and install tips. ★ 4.8 · FAQ · Video</div></aside>
    </article>`;
    $('#gVideo').onclick = () => toast('Video player opens here (mock)', 'info');
    $$('[data-setv]').forEach(a => a.addEventListener('click', () => H.setVehicle(a.dataset.setv)));
  }
  H.routes.guides = pageGuides;
  H.routes.guide = pageGuide;

  // ================= closeouts =================
  H.routes.deals = function () {
    const v = curV() || D.findVehicle(H.DEMO_GARAGE[0]);
    const deals = []; D.CATALOG.forEach(c => D.subsFor(c, v).forEach(s => D.partsFor(v, s.id).forEach(p => { if (p.tags.some(t => t === 'closeout' || t === 'wholesaler')) deals.push(p); })));
    deals.sort((a, b) => (b.tags.includes('wholesaler') - a.tags.includes('wholesaler')) || a.price - b.price);
    app.innerHTML = `${crumbs([['Home', '#/'], ['Closeouts', '']])}<h1 class="page-h">Closeouts for your ${esc(D.vehicleLabel(v))}</h1><p class="muted">${deals.length} closeout & wholesaler-closeout deals that fit. Quantities are limited and prices update daily.</p>
    <div class="deal-grid">${deals.slice(0, 24).map(p => { const f = D.findSub(p.subId); const was = p.price / (p.tags.includes('wholesaler') ? 0.7 : 0.78);
      return `<a class="deal" href="#/p/${v.id}/${p.subId}/${p.i}"><span class="dl-off">−${Math.round((1 - p.price / was) * 100)}%</span><span class="pr-img t-${p.tier}">${icon(partIcon(p.subId, f.cat.icon), 40)}</span><span class="pr-top">${tierPill(p.tier)}</span><b>${esc(p.subName)}${p.pos ? ' · ' + esc(p.pos) : ''}</b><small>${esc(p.brand)} ${esc(p.partNo)}</small><span class="dl-p"><b>${money(p.price)}</b><s>${money(was)}</s></span>${p.stock ? `<small class="neg">Only ${p.stock} left</small>` : '<small class="muted">Closeout</small>'}</a>`; }).join('')}</div>`;
  };
  H.routes.__nf = () => { app.innerHTML = '<div class="empty big"><div class="empty-ico">🧭</div><b>We couldn\'t find that page</b><br><a class="btn btn-primary" href="#/">Back to the store</a></div>'; };
})();
