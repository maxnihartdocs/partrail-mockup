/* Storefront prototype app — hash router, fake data, localStorage cart/garage/orders */
(function () {
  'use strict';
  const D = window.DATA;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const app = $('#app');
  const H = window.PRX = window.PRX || { routes: {} };
  const money = n => (n < -0.004 ? '−' : '') + '$' + (Math.round(Math.abs(n) * 100) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- state ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('pr_' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('pr_' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  const DEMO_GARAGE = [D.vid(2019, 'Ram', '2500', '6.7L L6 Cummins Diesel Turbo'), D.vid(2018, 'Ford', 'F-250 Super Duty', '6.7L V8 Power Stroke Diesel Turbo')];
  let garage = store.get('garage', null) || DEMO_GARAGE.slice();
  let cart = store.get('cart', []);
  let compare = [];
  const saveGarage = () => store.set('garage', garage);
  const saveCart = () => { store.set('cart', cart); updateCartCount(); };
  const currentVid = () => store.get('vehicle', garage[0] || null);
  const setVehicle = id => { store.set('vehicle', id); if (!garage.includes(id)) { garage.unshift(id); garage = garage.slice(0, 6); saveGarage(); } };

  function updateCartCount() {
    const n = cart.reduce((a, l) => a + l.qty, 0);
    $('#cartCount').textContent = n;
    $('#cartCount').classList.toggle('on', n > 0);
  }
  function toast(msg, kind) {
    const t = $('#toast'); t.className = 'toast ' + (kind || 'ok');
    t.innerHTML = `<span class="t-ico">${kind === 'err' ? '!' : kind === 'info' ? 'i' : '✓'}</span><span>${msg}</span>`; t.hidden = false;
    t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
    clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  const FIT_BADGE = '<span class="fitg" title="If it doesn\'t fit the vehicle in your garage, we pay return shipping. No restocking fee.">🛡 Fits-or-we-pay-the-return</span>';

  // ---------- pricing / shipping model (fake) ----------
  const SHIP_METHODS = [
    { id: 'ground', name: 'Ground', mult: 1, add: 0, labelPct: 0.66 },
    { id: '2day', name: '2-Day', mult: 1.9, add: 6, labelPct: 0.74 },
    { id: 'overnight', name: 'Overnight', mult: 3.1, add: 14, labelPct: 0.8 }
  ];
  function groundRate(weight, wh) { return +((4.99 + weight * 0.38) * D.WAREHOUSES[wh].zoneMult).toFixed(2); }
  function shipOptions(weight, wh) {
    const g = groundRate(weight, wh), W = D.WAREHOUSES[wh];
    return SHIP_METHODS.map(m => {
      const charged = +(g * m.mult + m.add).toFixed(2);
      const eta = m.id === 'ground' ? 'Est. ' + W.days : m.id === '2day' ? 'Guaranteed in 2 days' : 'Next business day';
      return { ...m, charged, label: +(charged * m.labelPct).toFixed(2), eta };
    });
  }
  const DROPSHIP_FEE = 2.75; // per box, charged by distributor
  const payFee = total => +(total * 0.029 + 0.30).toFixed(2);
  const TAX_RATE = 0.0725;

  function groupByWh(lines) {
    const g = {};
    lines.forEach(l => { (g[l.wh] = g[l.wh] || []).push(l); });
    return Object.keys(g).sort((a, b) => D.WAREHOUSES[a].d - D.WAREHOUSES[b].d).map(wh => ({ wh, lines: g[wh], weight: g[wh].reduce((a, l) => a + l.weight * l.qty, 0) }));
  }

  // ---------- shared UI ----------
  function tierPill(t) { return `<span class="tier-pill t-${t}">${D.TIERS[t].rank} · ${D.TIERS[t].label}</span>`; }
  function tagHtml(p) {
    return p.tags.map(t => t === 'closeout' ? '<span class="tag tag-close">CLOSEOUT</span>'
      : t === 'wholesaler' ? `<span class="tag tag-whc">WHOLESALER CLOSEOUT${p.stock ? ' · only ' + p.stock + ' left' : ''}</span>`
      : t === 'bestseller' ? '<span class="tag tag-best">Best seller</span>' : '').join('');
  }
  function stars(r) {
    const full = Math.round(r);
    return `<span class="stars" aria-label="${r} of 5">${'★'.repeat(full)}<i>${'★'.repeat(5 - full)}</i></span>`;
  }
  function crumbs(items) {
    return `<nav class="crumbs">${items.map((it, i) => i < items.length - 1 ? `<a href="${it[1]}">${esc(it[0])}</a><span>›</span>` : `<b>${esc(it[0])}</b>`).join('')}</nav>`;
  }
  function renderVehBar() {
    const v = D.findVehicle(currentVid());
    const bar = $('#vehBar');
    if (!v) { bar.innerHTML = `<div class="wrap vehbar-in"><span class="vb-l">No vehicle selected</span><button class="vb-c vb-lk" id="vbLookup">Add by VIN / plate / Y-M-M →</button></div>`; bar.hidden = false; $('#vbLookup').onclick = () => H.openLookup && H.openLookup(); return; }
    bar.hidden = false;
    bar.innerHTML = `<div class="wrap vehbar-in"><span class="vb-l">Shopping for</span><a class="vb-v" href="#/v/${v.id}"><b>${esc(D.vehicleLabel(v))}</b> <span>${esc(v.engine)}</span></a><button class="vb-lk" id="vbLookup">VIN / Plate</button><a class="vb-c" href="#/garage">Change</a></div>`;
    $('#vbLookup').onclick = () => H.openLookup && H.openLookup();
  }

  // vehicle selector (Year → Make → Model → Engine)
  function selectorHtml(prefix) {
    return `<div class="selector" id="${prefix}Sel">
      <label><span>1 · Year</span><select data-k="year"><option value="">Year</option>${D.YEARS.map(y => `<option>${y}</option>`).join('')}</select></label>
      <label><span>2 · Make</span><select data-k="make" disabled><option value="">Make</option></select></label>
      <label><span>3 · Model</span><select data-k="model" disabled><option value="">Model</option></select></label>
      <label><span>4 · Engine</span><select data-k="engine" disabled><option value="">Engine</option></select></label>
      <button class="btn btn-primary sel-go" disabled>Shop parts →</button>
    </div>`;
  }
  function wireSelector(root, onDone) {
    const sel = k => $(`select[data-k="${k}"]`, root);
    const go = $('.sel-go', root);
    const fill = (k, opts, ph) => { const s = sel(k); s.innerHTML = `<option value="">${ph}</option>` + opts.map(o => `<option>${esc(o)}</option>`).join(''); s.disabled = !opts.length; };
    const reset = ks => ks.forEach(k => { const s = sel(k); s.innerHTML = `<option value="">${k[0].toUpperCase() + k.slice(1)}</option>`; s.disabled = true; });
    const val = k => sel(k).value;
    sel('year').addEventListener('change', () => { reset(['model', 'engine']); go.disabled = true; if (val('year')) fill('make', D.makesFor(+val('year')), 'Make'); else reset(['make']); });
    sel('make').addEventListener('change', () => { reset(['engine']); go.disabled = true; if (val('make')) fill('model', D.modelsFor(+val('year'), val('make')), 'Model'); else reset(['model']); });
    sel('model').addEventListener('change', () => {
      go.disabled = true;
      if (!val('model')) return reset(['engine']);
      const eng = D.enginesFor(+val('year'), val('make'), val('model')).map(e => e.name);
      fill('engine', eng, 'Engine');
      if (eng.length === 1) { sel('engine').value = eng[0]; go.disabled = false; }
    });
    sel('engine').addEventListener('change', () => { go.disabled = !val('engine'); });
    go.addEventListener('click', e => {
      e.preventDefault();
      const id = D.vid(+val('year'), val('make'), val('model'), val('engine'));
      setVehicle(id); onDone(id);
    });
  }

  function fromPrice(v, subId) { const ps = D.partsFor(v, subId); return Math.min.apply(null, ps.map(p => p.price)); }

  // ---------- pages ----------
  function pageHome() {
    const featured = D.findVehicle(DEMO_GARAGE[0]);
    const hubFrom = fromPrice(featured, 'wheel-hub-assembly');
    const samplePn = D.partsFor(featured, 'wheel-hub-assembly')[3].partNo;
    app.innerHTML = `
    <section class="hero">
      <div class="hero-copy">
        <span class="hero-kicker">Trusted by 1.2M+ truck owners & 9,800 shops</span>
        <h1>Every part. Every brand.<br><em>Good · Better · Best.</em></h1>
        <p>Pick your truck, pick your tier. Warehouse-direct prices on 400,000+ parts from dozens of brands — no membership, no markup games.</p>
        <div class="hero-stats"><span><b>4.8</b>${stars(4.8)}<small>21,486 reviews</small></span><span><b>98.7%</b><small>fitment accuracy</small></span><span><b>6</b><small>US warehouses</small></span></div>
        <div class="hero-ctas"><a class="btn btn-primary" href="#/jobs">✨ Build my job</a><a class="btn btn-ghost-l" href="#/pro">For Shops & Fleets</a></div>
      </div>
      <div class="hero-card">
        <h2>Find parts for your vehicle</h2>
        ${H.lookupHtml ? H.lookupHtml('home') : selectorHtml('home')}
        <div class="or"><span>or search by part / OE number</span></div>
        <form class="pn-search" id="pnForm"><input type="search" id="pnInput" placeholder="e.g. ${esc(samplePn)}"><button class="btn">Find</button></form>
      </div>
    </section>

    <section class="promise promise4">
      <div><b>📦 Ships from the warehouse closest to you</b><span>6 distribution centers · most orders leave same day</span></div>
      <div><b>💲 Wholesale-direct pricing</b><span>Closeouts & wholesaler closeouts every day</span></div>
      <div><b>🛡 Fits-or-we-pay-the-return</b><span>Shop by garage vehicle and fitment is on us</span></div>
      <div><b>↩︎ Easy returns & core refunds</b><span>Prepaid core labels · 60-day returns</span></div>
    </section>

    <section class="block">
      <div class="block-h"><h2>My Garage</h2><a href="#/garage">Manage</a></div>
      <div class="garage-chips">${garage.map(id => { const v = D.findVehicle(id); return v ? `<a class="gchip ${id === currentVid() ? 'on' : ''}" href="#/v/${id}" data-vid="${id}"><b>${esc(D.vehicleLabel(v))}</b><span>${esc(v.engine)}</span></a>` : ''; }).join('')}
      <a class="gchip add" href="#/garage">+ Add vehicle</a></div>
    </section>

    <a class="feature-strip" href="#/v/${featured.id}/wheel-hub-assembly">
      <span class="fs-ico">${icon('hub', 44)}</span>
      <span class="fs-t"><small>Popular right now</small><b>Wheel Hub Assemblies for ${esc(D.vehicleLabel(featured))} Cummins</b><span>3 tiers · ${D.partsFor(featured, 'wheel-hub-assembly').length} options from ${money(hubFrom)}</span></span>
      <span class="fs-go">Shop →</span>
    </a>

    <section class="block">
      <div class="block-h"><h2>Shop by category</h2><span class="muted small">Select a vehicle first for exact fit</span></div>
      <div class="cat-grid">${D.CATALOG.map(c => `<a class="cat" href="${currentVid() ? '#/v/' + currentVid() + '?open=' + c.id : '#/garage'}">${icon(c.icon, 36)}<b>${esc(c.name)}</b><span>${c.subs.slice(0, 3).map(s => s.name).join(', ')}…</span></a>`).join('')}</div>
    </section>

    <section class="block tiers-explain">
      <div class="block-h"><h2>How Good · Better · Best works</h2></div>
      <div class="tx-grid">${['good', 'better', 'best'].map(t => { const T = D.TIERS[t]; return `<div class="tx t-${t}"><div class="tx-rank">${T.rank}</div><h3>${T.label}</h3><p>${T.tag}</p><ul><li><b>Warranty:</b> ${T.warranty}</li><li><b>Best for:</b> ${T.bestFor}</li></ul></div>`; }).join('')}</div>
    </section>`;
    if (H.wireLookup) H.wireLookup($('#homeLk'), id => { location.hash = '#/v/' + id; }); else wireSelector($('#homeSel'), id => { location.hash = '#/v/' + id; });
    if (H.homeExtras) H.homeExtras();
    $('#pnForm').addEventListener('submit', e => { e.preventDefault(); location.hash = '#/search?q=' + encodeURIComponent($('#pnInput').value.trim()); });
    $$('.gchip[data-vid]').forEach(a => a.addEventListener('click', () => setVehicle(a.dataset.vid)));
  }

  function pageGarage() {
    app.innerHTML = `${crumbs([['Home', '#/'], ['My Garage', '']])}
    <h1 class="page-h">My Garage</h1>
    <div class="garage-list">${garage.map(id => { const v = D.findVehicle(id); if (!v) return ''; return `<div class="gitem ${id === currentVid() ? 'on' : ''}">
      <div class="gi-ico">${icon('gear', 30)}</div><div class="gi-t"><b>${esc(D.vehicleLabel(v))}</b><span>${esc(v.engine)}</span></div>
      <a class="btn btn-sm btn-primary" href="#/v/${id}" data-vid="${id}">Shop</a><button class="btn btn-sm btn-ghost" data-del="${id}" aria-label="Remove">✕</button></div>`; }).join('') || '<div class="empty"><div class="empty-ico">🚚</div><b>Your garage is empty</b><br><span class="small">Add a truck by VIN, plate or year/make/model below and every part we show you will fit.</span></div>'}</div>
    <div class="panel"><h2>Add a vehicle</h2>${H.lookupHtml ? H.lookupHtml('gar') : selectorHtml('gar')}</div>`;
    if (H.wireLookup) H.wireLookup($('#garLk'), id => { location.hash = '#/v/' + id; }); else wireSelector($('#garSel'), id => { location.hash = '#/v/' + id; });
    $$('[data-vid]').forEach(a => a.addEventListener('click', () => setVehicle(a.dataset.vid)));
    $$('[data-del]').forEach(b => b.addEventListener('click', () => {
      garage = garage.filter(x => x !== b.dataset.del); saveGarage();
      if (currentVid() === b.dataset.del) store.set('vehicle', garage[0] || null);
      render();
    }));
  }

  function pageCatalog(vidStr, q) {
    const v = D.findVehicle(vidStr);
    if (!v) return notFound();
    if (currentVid() !== v.id) setVehicle(v.id);
    renderVehBar();
    const open = new Set([(q.get('open') || 'brake-wheel-hub')]);
    app.innerHTML = `${crumbs([['Home', '#/'], [D.vehicleLabel(v) + ' ' + v.engine, '']])}
      <div class="cat-head"><div><h1 class="page-h">${esc(D.vehicleLabel(v))}</h1><div class="muted">${esc(v.engine)}${v.diesel ? ' · <span class="diesel">DIESEL</span>' : ''}</div></div>
      <input class="tree-filter" id="treeFilter" type="search" placeholder="Filter categories (e.g. hub, filter)"></div>
      <ul class="tree" id="tree">${D.CATALOG.map(c => {
        const subs = D.subsFor(c, v);
        return `<li class="tnode ${open.has(c.id) ? 'open' : ''}" data-cat="${c.id}">
          <button class="trow" aria-expanded="${open.has(c.id)}"><span class="tbox"></span>${icon(c.icon, 22)}<b>${esc(c.name)}</b><span class="tcount">${subs.length}</span></button>
          <ul class="tsubs">${subs.map(s => { const ps = D.partsFor(v, s.id); const brands = new Set(ps.map(p => p.brand)).size;
            return `<li data-name="${esc(s.name.toLowerCase())}"><a href="#/v/${v.id}/${s.id}"><span class="ts-n">${esc(s.name)}${s.featured ? ' <span class="tag tag-new">G·B·B</span>' : ''}</span><span class="ts-m">${brands} brands · from <b>${money(Math.min.apply(null, ps.map(p => p.price)))}</b></span></a></li>`; }).join('')}</ul>
        </li>`; }).join('')}</ul>`;
    $$('.trow').forEach(b => b.addEventListener('click', () => { const li = b.parentElement; li.classList.toggle('open'); b.setAttribute('aria-expanded', li.classList.contains('open')); }));
    $('#treeFilter').addEventListener('input', e => {
      const t = e.target.value.trim().toLowerCase();
      $$('.tnode').forEach(n => {
        let any = false;
        $$('.tsubs li', n).forEach(li => { const m = !t || li.dataset.name.includes(t); li.hidden = !m; any = any || m; });
        n.hidden = !any; n.classList.toggle('open', !!t && any || (!t && open.has(n.dataset.cat)));
      });
    });
  }

  function pageListing(vidStr, subId, q) {
    const v = D.findVehicle(vidStr); const f = D.findSub(subId);
    if (!v || !f) return notFound();
    if (currentVid() !== v.id) setVehicle(v.id);
    renderVehBar();
    const all = D.partsFor(v, subId);
    const positions = [...new Set(all.map(p => p.pos).filter(Boolean))];
    const state = { tier: q.get('tier') || 'all', pos: positions[0] || null, sort: 'price', hideClose: false };
    compare = [];

    const tierCard = t => {
      const T = D.TIERS[t]; const ps = all.filter(p => p.tier === t && (!state.pos || p.pos === state.pos));
      const lo = Math.min.apply(null, ps.map(p => p.price));
      const brands = [...new Set(ps.map(p => p.brand))];
      return `<div class="tcard t-${t} ${state.tier === t ? 'sel' : ''}" data-tier="${t}">
        ${t === 'better' ? '<div class="tc-flag">Most popular</div>' : ''}
        <div class="tc-rank">${T.rank}</div>
        <h3>${T.label}</h3>
        <div class="tc-price"><small>from</small> ${money(lo)}</div>
        <p class="tc-tag">${T.tag}</p>
        <ul class="tc-list">${D.tierMaterials(subId, t).map(m => `<li>${esc(m)}</li>`).join('')}</ul>
        <div class="tc-meta"><span><b>Warranty</b>${T.warranty}</span><span><b>Brands</b>${brands.length}</span></div>
        <button class="btn tc-btn">See ${ps.length} ${T.label} option${ps.length === 1 ? '' : 's'}</button>
      </div>`;
    };

    function rows() {
      let ps = all.filter(p => (state.tier === 'all' || p.tier === state.tier) && (!state.pos || p.pos === state.pos) && (!state.hideClose || !p.tags.length || p.tags.every(t => t === 'bestseller')));
      ps = ps.slice().sort(state.sort === 'price' ? (a, b) => a.price - b.price : state.sort === 'price-d' ? (a, b) => b.price - a.price : state.sort === 'rating' ? (a, b) => b.rating - a.rating : (a, b) => D.WAREHOUSES[a.wh].d - D.WAREHOUSES[b.wh].d || a.price - b.price);
      if (!ps.length) return '<div class="empty"><div class="empty-ico">🔍</div><b>No parts match these filters</b><br><span class="small">Try showing closeouts or a different tier.</span></div>';
      return ps.map(p => { const W = D.WAREHOUSES[p.wh];
        return `<div class="prow t-${p.tier}">
          <label class="pr-cmp" title="Compare"><input type="checkbox" data-cmp="${p.i}" ${compare.includes(p.i) ? 'checked' : ''}><span>Compare</span></label>
          <a class="pr-img" href="#/p/${v.id}/${subId}/${p.i}">${icon(partIcon(subId, f.cat.icon), 46)}</a>
          <div class="pr-main">
            <div class="pr-top">${tierPill(p.tier)}${tagHtml(p)}</div>
            <a class="pr-name" href="#/p/${v.id}/${subId}/${p.i}"><b>${esc(p.brand)}</b> ${esc(p.partNo)}</a>
            <div class="pr-notes">${p.pos ? `<b>${esc(p.pos)}</b>; ` : ''}${p.notes.map(esc).join('; ')}</div>
            <div class="pr-rate">${stars(p.rating)} <span>${p.rating} (${p.reviews})</span> · <a href="#/p/${v.id}/${subId}/${p.i}">Info & fitment</a></div>
            <div class="pr-fit">${FIT_BADGE}</div>
          </div>
          <div class="pr-ship"><span class="dot d${Math.min(W.d, 4)}"></span><div><b>${esc(W.city)}</b><span>Arrives in ${W.days} to 43506</span></div></div>
          <div class="pr-price"><b>${money(p.price)}</b>${p.core ? `<span class="core">+ ${money(p.core)} core</span>` : '<span class="core muted">no core</span>'}</div>
          <div class="pr-buy"><select data-qty="${p.i}" aria-label="Quantity">${[1, 2, 3, 4].map(n => `<option>${n}</option>`).join('')}</select><button class="btn btn-primary" data-add="${p.i}">Add</button></div>
        </div>`; }).join('');
    }

    function draw() {
      app.innerHTML = `${crumbs([['Home', '#/'], [D.vehicleLabel(v), '#/v/' + v.id], [f.cat.name, '#/v/' + v.id + '?open=' + f.cat.id], [f.sub.name, '']])}
      <div class="list-head"><h1 class="page-h">${esc(f.sub.name)}</h1><div class="fit-banner"><span>✓ Showing only parts that fit your <b>${esc(D.vehicleLabel(v))}</b></span>${FIT_BADGE}</div><div class="muted">${esc(D.vehicleLabel(v))} · ${esc(v.engine)} · <b>${all.length}</b> options from <b>${new Set(all.map(p => p.brand)).size}</b> brands</div></div>
      ${positions.length > 1 ? `<div class="seg" id="posSeg">${positions.map(p => `<button class="${p === state.pos ? 'on' : ''}" data-pos="${esc(p)}">${esc(p)}</button>`).join('')}</div>` : ''}
      <div class="tiers" id="tiers">${['good', 'better', 'best'].map(tierCard).join('')}</div>
      <div class="tier-compare-link"><button class="linkbtn" id="tierTable">Compare tiers side-by-side ›</button></div>
      <div class="filters">
        <div class="chips" id="tierChips">${[['all', 'All tiers'], ['good', 'Economy'], ['better', 'Daily Driver'], ['best', 'Heavy Duty']].map(([k, l]) => `<button class="chip ${state.tier === k ? 'on' : ''} ${k !== 'all' ? 'c-' + k : ''}" data-t="${k}">${l}</button>`).join('')}</div>
        <div class="filters-r"><label class="ck"><input type="checkbox" id="hideClose" ${state.hideClose ? 'checked' : ''}> Hide closeouts</label>
        <select id="sortSel" aria-label="Sort"><option value="price">Price: low → high</option><option value="price-d">Price: high → low</option><option value="ship">Fastest shipping</option><option value="rating">Top rated</option></select></div>
      </div>
      <div class="plist-head"><span></span><span></span><span>Part</span><span>Ships from</span><span>Price</span><span></span></div>
      <div class="plist" id="plist">${rows()}</div>
      <p class="fine muted">Prices are per each. Core charges are refunded when you return your old part. Warehouse ETAs estimated to ZIP 43506.</p>`;
      $('#sortSel').value = state.sort;
      wire();
    }
    function redrawRows() { $('#plist').innerHTML = rows(); wireRows(); }
    function wire() {
      $$('.tcard').forEach(c => c.addEventListener('click', () => { state.tier = state.tier === c.dataset.tier ? 'all' : c.dataset.tier; draw(); $('#plist').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
      $$('#tierChips .chip').forEach(c => c.addEventListener('click', () => { state.tier = c.dataset.t; draw(); }));
      $$('#posSeg button').forEach(b => b.addEventListener('click', () => { state.pos = b.dataset.pos; draw(); }));
      $('#sortSel').addEventListener('change', e => { state.sort = e.target.value; redrawRows(); });
      $('#hideClose').addEventListener('change', e => { state.hideClose = e.target.checked; redrawRows(); });
      $('#tierTable').addEventListener('click', () => showTierModal(subId, all));
      wireRows();
    }
    function wireRows() {
      $$('[data-add]').forEach(b => b.addEventListener('click', () => {
        const p = all[+b.dataset.add]; const qty = +$(`[data-qty="${p.i}"]`).value;
        addToCart(p, qty, v);
      }));
      $$('[data-cmp]').forEach(c => c.addEventListener('change', () => {
        const i = +c.dataset.cmp;
        if (c.checked) { if (compare.length >= 4) { c.checked = false; return toast('Compare up to 4 parts'); } compare.push(i); }
        else compare = compare.filter(x => x !== i);
        drawCompareBar(all, v, f);
      }));
    }
    draw();
    drawCompareBar(all, v, f);
  }

  function drawCompareBar(all, v, f) {
    const bar = $('#compareBar');
    if (!compare.length) { bar.hidden = true; return; }
    bar.hidden = false;
    bar.innerHTML = `<div class="wrap cb-in"><span><b>${compare.length}</b> selected</span><div class="cb-items">${compare.map(i => `<span>${esc(all[i].brand)}</span>`).join('')}</div>
      <button class="btn btn-ghost btn-sm" id="cbClear">Clear</button><button class="btn btn-primary btn-sm" id="cbGo" ${compare.length < 2 ? 'disabled' : ''}>Compare ${compare.length < 2 ? '(pick 2+)' : ''}</button></div>`;
    $('#cbClear').onclick = () => { compare = []; $$('[data-cmp]').forEach(c => { c.checked = false; }); bar.hidden = true; };
    $('#cbGo').onclick = () => {
      const ps = compare.map(i => all[i]);
      const row = (l, fn) => `<tr><th>${l}</th>${ps.map(p => `<td>${fn(p)}</td>`).join('')}</tr>`;
      openModal(`<h2>Compare ${esc(f.sub.name)}</h2><div class="tscroll"><table class="cmp-table">
        <thead><tr><th></th>${ps.map(p => `<th>${icon(partIcon(f.sub.id, f.cat.icon), 34)}<br><b>${esc(p.brand)}</b><br><small>${esc(p.partNo)}</small></th>`).join('')}</tr></thead><tbody>
        ${row('Tier', p => tierPill(p.tier))}${row('Price', p => `<b>${money(p.price)}</b>`)}${row('Core', p => p.core ? money(p.core) : '—')}
        ${row('Warranty', p => D.TIERS[p.tier].warranty)}${row('Ships from', p => D.WAREHOUSES[p.wh].city + '<br><small>' + D.WAREHOUSES[p.wh].days + '</small>')}
        ${row('Notes', p => p.notes.map(esc).join('<br>'))}${row('Rating', p => stars(p.rating) + ' ' + p.rating)}
        ${row('', p => `<button class="btn btn-primary btn-sm" data-madd="${p.i}">Add to cart</button>`)}
      </tbody></table></div>`);
      $$('[data-madd]').forEach(b => b.addEventListener('click', () => { addToCart(all[+b.dataset.madd], 1, v); closeModal(); }));
    };
  }

  function showTierModal(subId, all) {
    const tiers = ['good', 'better', 'best'];
    const lo = t => Math.min.apply(null, all.filter(p => p.tier === t).map(p => p.price));
    openModal(`<h2>Good · Better · Best — ${esc(D.findSub(subId).sub.name)}</h2><div class="tscroll"><table class="cmp-table tier-table">
      <thead><tr><th></th>${tiers.map(t => `<th class="t-${t}"><span class="tier-pill t-${t}">${D.TIERS[t].rank}</span><br><b>${D.TIERS[t].label}</b></th>`).join('')}</tr></thead>
      <tbody><tr><th>Starting at</th>${tiers.map(t => `<td><b>${money(lo(t))}</b></td>`).join('')}</tr>
      <tr><th>Warranty</th>${tiers.map(t => `<td>${D.TIERS[t].warranty}</td>`).join('')}</tr>
      <tr><th>Materials</th>${tiers.map(t => `<td><ul>${D.tierMaterials(subId, t).map(m => `<li>${esc(m)}</li>`).join('')}</ul></td>`).join('')}</tr>
      <tr><th>Best for</th>${tiers.map(t => `<td>${D.TIERS[t].bestFor}</td>`).join('')}</tr>
      <tr><th>Brands</th>${tiers.map(t => `<td>${[...new Set(all.filter(p => p.tier === t).map(p => p.brand))].join(', ')}</td>`).join('')}</tr></tbody></table></div>`);
  }

  function addToCart(p, qty, v) {
    const ex = cart.find(l => l.key === p.key);
    if (ex) ex.qty += qty;
    else cart.push({ key: p.key, vid: v.id, subId: p.subId, i: p.i, vlabel: D.vehicleLabel(v), name: p.subName, pos: p.pos, brand: p.brand, partNo: p.partNo, tier: p.tier, price: p.price, cost: p.cost, core: p.core, wh: p.wh, weight: p.weight, qty });
    saveCart();
    toast(`Added <b>${esc(p.brand)} ${esc(p.partNo)}</b> · <a href="#/cart">View cart →</a>`);
  }

  function pageDetail(vidStr, subId, i) {
    const r = D.findPart(vidStr, subId, i); const f = D.findSub(subId);
    if (!r || !f) return notFound();
    const { v, part: p } = r; const T = D.TIERS[p.tier]; const W = D.WAREHOUSES[p.wh];
    renderVehBar();
    const all = D.partsFor(v, subId);
    const rr = D.rng(p.key + 'detail');
    const hub = subId === 'wheel-hub-assembly';
    const specs = hub ? [
      ['Position', p.pos], ['Drive type', '4WD'], ['Bolt pattern', v.hd ? '8 × 6.5 in' : '6 × 5.5 in'], ['Number of studs', v.hd ? 8 : 6],
      ['Flange diameter', (v.hd ? 7.9 : 6.6) + ' in'], ['Hub pilot diameter', (v.hd ? 4.94 : 3.81) + ' in'], ['ABS sensor', p.notes.some(n => /Includes ABS/.test(n)) ? 'Included' : 'Not included'],
      ['Bearing type', p.tier === 'best' ? 'Tapered roller, oversized' : 'Double-row ball'], ['Seal', p.tier === 'best' ? 'Triple-lip' : p.tier === 'better' ? 'Double-lip' : 'Single-lip'], ['Ship weight', p.weight + ' lb']
    ] : [['Position', p.pos || 'N/A'], ['Condition', p.core ? (p.tier === 'best' ? 'New' : 'Remanufactured') : 'New'], ['Notes', p.notes.join('; ')], ['Ship weight', p.weight + ' lb'], ['Country of origin', ['USA', 'Mexico', 'Taiwan', 'China', 'India'][Math.floor(rr() * 5)]]];
    const years = []; const eng = D.enginesFor(v.year, v.make, v.model).find(e => e.name === v.engine);
    for (let y = Math.max(eng.from, v.year - 3); y <= Math.min(eng.to, v.year + 2); y++) years.push(y);
    const sister = { '2500': '3500', 'F-250 Super Duty': 'F-350 Super Duty', 'Silverado 2500 HD': 'Silverado 3500 HD' }[v.model];
    const fit = years.map(y => [y, v.make, v.model, v.engine, p.pos || '—']).concat(sister ? years.slice(0, 3).map(y => [y, v.make, sister, v.engine, (p.pos || '—') + ' · SRW only']) : []);
    const oe = ['OE-' + (51 + Math.floor(rr() * 40)) + Math.floor(1e5 + rr() * 9e5) + 'AB', 'OE-' + (51 + Math.floor(rr() * 40)) + Math.floor(1e5 + rr() * 9e5) + 'AC'];
    const xrefs = all.filter(x => x.brand !== p.brand && x.pos === p.pos).slice(0, 5);
    const reviewers = ['Dale K. · OH', 'Marcus T. · TX', 'Jenna R. · PA', 'Luis G. · IN', 'Brett W. · MI'];
    const rtext = {
      good: ['Fit fine, did the job for the price. Truck is going to auction in a few months so this was perfect.', 'Bit of noise after 8k miles but for the price no complaints.'],
      better: ['Bolted right in, ABS light went off. Feels just like the factory part.', 'Third one I have bought from here, consistent quality and showed up next day.'],
      best: ['Pull a 14k gooseneck every week — previous hub lasted 30k, this one is at 60k and tight.', 'Noticeably heavier than stock. Worth it if you tow.']
    }[p.tier];

    app.innerHTML = `${crumbs([['Home', '#/'], [D.vehicleLabel(v), '#/v/' + v.id], [f.sub.name, '#/v/' + v.id + '/' + subId], [p.partNo, '']])}
    <div class="pd">
      <div class="pd-media"><div class="pd-img t-${p.tier}">${icon(partIcon(subId, f.cat.icon), 160)}<span class="pd-ph">Product photo</span></div>
        <div class="pd-thumbs">${[0, 1, 2].map(() => `<span>${icon(partIcon(subId, f.cat.icon), 30)}</span>`).join('')}</div></div>
      <div class="pd-buy">
        <div class="pr-top">${tierPill(p.tier)}${tagHtml(p)}</div>
        <h1>${esc(p.brand)} ${esc(p.partNo)}</h1>
        <div class="pd-sub">${esc(f.sub.name)}${p.pos ? ' · ' + esc(p.pos) : ''} · fits ${esc(D.vehicleLabel(v))} ${esc(v.engine)}</div>
        <div class="pr-rate">${stars(p.rating)} <span>${p.rating} · ${p.reviews} reviews</span></div>
        <div class="fit-row"><div class="fit-ok">✓ Fits your ${esc(D.vehicleLabel(v))}</div>${FIT_BADGE}</div>
        <div class="pd-stock">● In stock · <b>${12 + (p.reviews % 40)}</b> sold in the last 30 days</div>
        <div class="pd-price"><b>${money(p.price)}</b>${p.core ? `<span>+ ${money(p.core)} refundable core charge</span>` : ''}</div>
        <div class="pd-ship"><span class="dot d${Math.min(W.d, 4)}"></span> Ships from <b>${esc(W.city)}</b> · arrives in ${W.days} to 43506</div>
        <div class="pd-warr">🛡 ${T.warranty} warranty · ${T.label} tier</div>
        <div class="pd-cta"><select id="pdQty" aria-label="Quantity">${[1, 2, 3, 4].map(n => `<option>${n}</option>`).join('')}</select><button class="btn btn-primary btn-lg" id="pdAdd">Add to cart</button></div>
        <ul class="pd-notes">${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
        <div class="pd-trust"><span>🔒 Secure checkout</span><span>↩︎ 60-day returns</span><span>🚚 Ships ${W.d <= 1 ? 'today' : 'in 24h'}</span></div>
        <button class="linkbtn small" id="pdAsk">💬 Ask ${esc(D.STORE.name)}: will this fit my truck?</button>
      </div>
    </div>

    <div class="pd-sections">
      <section class="panel"><h2>Specifications</h2><table class="kv">${specs.map(([k, val]) => `<tr><th>${esc(k)}</th><td>${esc(val)}</td></tr>`).join('')}</table></section>
      <section class="panel"><h2>Where this fits in Good · Better · Best</h2>
        <div class="tier-ladder">${['good', 'better', 'best'].map(t => { const lo = Math.min.apply(null, all.filter(x => x.tier === t && x.pos === p.pos).map(x => x.price)); return `<a class="tl t-${t} ${t === p.tier ? 'cur' : ''}" href="#/v/${v.id}/${subId}?tier=${t}"><span class="tl-r">${D.TIERS[t].rank}</span><b>${D.TIERS[t].label}</b><span>from ${money(lo)}</span><span>${D.TIERS[t].warranty}</span>${t === p.tier ? '<em>This part</em>' : ''}</a>`; }).join('')}</div>
        <p><b>${T.label}:</b> ${T.tag} Best for ${T.bestFor.toLowerCase()}.</p>
        <ul class="tc-list">${D.tierMaterials(subId, p.tier).map(m => `<li>${esc(m)}</li>`).join('')}</ul>
      </section>
      <section class="panel"><h2>Vehicle fitment</h2><div class="tscroll"><table class="grid"><thead><tr><th>Year</th><th>Make</th><th>Model</th><th>Engine</th><th>Notes</th></tr></thead><tbody>${fit.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
      <section class="panel"><h2>Interchange & OE numbers</h2>
        <p class="small muted">OE reference numbers (fictitious):</p><div class="oe">${oe.map(o => `<code>${o}</code>`).join('')}</div>
        <p class="small muted">Also sold as / interchanges with:</p>
        <div class="tscroll"><table class="grid"><tbody>${xrefs.map(x => `<tr><td><a href="#/p/${v.id}/${subId}/${x.i}">${esc(x.brand)} ${esc(x.partNo)}</a></td><td>${tierPill(x.tier)}</td><td class="r">${money(x.price)}</td></tr>`).join('')}</tbody></table></div>
      </section>
      <section class="panel"><h2>Warranty</h2><p><b>${T.warranty}</b> from date of purchase, covering defects in materials and workmanship. ${p.tier === 'best' ? 'Includes commercial / fleet use. ' : p.tier === 'good' ? 'Personal use only. ' : 'Personal and light commercial use. '}Warranty handled by ${esc(D.STORE.name)} — no shipping your claim to the manufacturer.</p>${p.core ? `<p>Core: return your old unit within 60 days using the prepaid label in the box for a ${money(p.core)} refund.</p>` : ''}</section>
      <section class="panel"><h2>Reviews <span class="muted small">${p.rating} avg · ${p.reviews}</span></h2>
        ${rtext.map((t, k) => `<div class="review">${stars(Math.max(3, Math.round(p.rating - k * 0.4)))}<p>${esc(t)}</p><span class="muted small">${reviewers[(k + p.i) % 5]} · Verified buyer · ${v.year} ${esc(v.model)}</span></div>`).join('')}
      </section>
    </div>`;
    $('#pdAdd').addEventListener('click', () => addToCart(p, +$('#pdQty').value, v));
    $('#pdAsk').addEventListener('click', () => H.chatAsk && H.chatAsk('fit', { v, p }));
  }

  function cartTotals(lines, choices) {
    const groups = groupByWh(lines);
    let ship = 0, label = 0;
    groups.forEach(g => { const opt = shipOptions(g.weight, g.wh).find(o => o.id === ((choices || {})[g.wh] || 'ground')); g.opt = opt; ship += opt.charged; label += opt.label; });
    const sub = lines.reduce((a, l) => a + l.price * l.qty, 0);
    const core = lines.reduce((a, l) => a + l.core * l.qty, 0);
    const tax = +(sub * TAX_RATE).toFixed(2);
    return { groups, sub, core, ship: +ship.toFixed(2), label, tax, total: +(sub + core + ship + tax).toFixed(2) };
  }

  function pageCart() {
    renderVehBar();
    if (!cart.length) {
      app.innerHTML = `${crumbs([['Home', '#/'], ['Cart', '']])}<h1 class="page-h">Your cart</h1><div class="empty big"><div class="empty-ico">🛒</div><b>Your cart is empty</b><br><span class="small">Not sure where to start? Let us build the whole job for you.</span><br><a class="btn btn-dark" href="#/jobs">✨ Build my job</a> <a class="btn btn-primary" href="#/v/${DEMO_GARAGE[0]}/wheel-hub-assembly">Try the Ram 2500 hub demo →</a> <button class="btn" id="demoCart">Load a demo cart</button></div>`;
      $('#demoCart').onclick = loadDemoCart; return;
    }
    const t = cartTotals(cart);
    app.innerHTML = `${crumbs([['Home', '#/'], ['Cart', '']])}<h1 class="page-h">Your cart</h1>
    <p class="muted small">Your order ships from <b>${t.groups.length}</b> warehouse${t.groups.length > 1 ? 's' : ''} — each closest to you for that part. Shipping is calculated per warehouse.</p>
    <div class="co">
      <div class="co-main">${t.groups.map(g => `<div class="whgroup">
        <div class="wh-h"><span class="dot d${Math.min(D.WAREHOUSES[g.wh].d, 4)}"></span><b>Ships from ${esc(D.WAREHOUSES[g.wh].city)}</b><span class="muted">${g.weight} lb · Ground ${D.WAREHOUSES[g.wh].days} · from ${money(shipOptions(g.weight, g.wh)[0].charged)}</span></div>
        ${g.lines.map(l => `<div class="cline">
          <div class="cl-ico">${icon(partIcon(l.subId), 34)}</div>
          <div class="cl-t">${l.extra ? `<b>${esc(l.name)}</b><span class="muted small">Job kit add-on · ${esc(l.vlabel)}</span>` : `<a href="#/p/${l.vid}/${l.subId}/${l.i}"><b>${esc(l.brand)} ${esc(l.partNo)}</b></a><span>${esc(l.name)}${l.pos ? ' · ' + esc(l.pos) : ''}</span><span class="small fit-txt">✓ Fits ${esc(l.vlabel)}</span>${tierPill(l.tier)}`}</div>
          <div class="cl-q"><button data-dq="${l.key}" aria-label="Decrease">−</button><span>${l.qty}</span><button data-iq="${l.key}" aria-label="Increase">+</button></div>
          <div class="cl-p"><b>${money(l.price * l.qty)}</b>${l.core ? `<span class="core">+ ${money(l.core * l.qty)} core</span>` : ''}<button class="linkbtn small" data-rm="${l.key}">Remove</button></div>
        </div>`).join('')}</div>`).join('')}</div>
      <aside class="co-side panel">
        <h2>Summary</h2>
        <div class="sum"><span>Parts</span><b>${money(t.sub)}</b></div>
        ${t.core ? `<div class="sum"><span>Core charges <small>(refundable)</small></span><b>${money(t.core)}</b></div>` : ''}
        <div class="sum"><span>Shipping (Ground, ${t.groups.length} box${t.groups.length > 1 ? 'es' : ''})</span><b>${money(t.ship)}</b></div>
        <div class="sum"><span>Est. tax</span><b>${money(t.tax)}</b></div>
        <div class="sum total"><span>Total</span><b>${money(t.total)}</b></div>
        <a class="btn btn-primary btn-lg btn-block" href="#/checkout">🔒 Secure checkout →</a>
        <p class="tiny muted">Faster shipping options available at checkout.</p>
        <div class="cart-fit">${FIT_BADGE}<p class="tiny muted">Every part in this cart is checked against your garage vehicle. If it doesn't fit, we email a prepaid return label.</p></div>
        ${H.payIcons ? H.payIcons() : ''}
      </aside>
    </div>`;
    const find = k => cart.find(l => l.key === k);
    $$('[data-iq]').forEach(b => b.onclick = () => { find(b.dataset.iq).qty++; saveCart(); pageCart(); });
    $$('[data-dq]').forEach(b => b.onclick = () => { const l = find(b.dataset.dq); l.qty--; if (l.qty < 1) cart = cart.filter(x => x !== l); saveCart(); pageCart(); });
    $$('[data-rm]').forEach(b => b.onclick = () => { cart = cart.filter(x => x.key !== b.dataset.rm); saveCart(); pageCart(); });
  }

  function loadDemoCart() {
    const ram = D.findVehicle(DEMO_GARAGE[0]);
    const hubs = D.partsFor(ram, 'wheel-hub-assembly');
    const pads = D.partsFor(ram, 'brake-pad');
    const filt = D.partsFor(ram, 'fuel-filter');
    const alt = D.partsFor(ram, 'alternator');
    const pickWh = (list, exclude) => list.find(p => !exclude.includes(p.wh)) || list[0];
    const a = hubs.find(p => p.tier === 'better') || hubs[0];
    const b = pickWh(pads.filter(p => p.tier === 'best'), [a.wh]);
    const c = filt.find(p => p.wh === a.wh) || filt[0];
    const d = pickWh(alt, [a.wh, b.wh]);
    cart = [];
    addToCart(a, 2, ram); addToCart(b, 1, ram); addToCart(c, 2, ram); addToCart(d, 1, ram);
    $("#toast").hidden = true;
    render();
  }

  let shipChoices = {}; let bizMode = false; let poNum = '';
  function pageCheckout() {
    renderVehBar();
    if (!cart.length) { location.hash = '#/cart'; return; }
    if (/biz=1/.test(location.hash)) bizMode = true;
    const draw = () => {
      const t = cartTotals(cart, shipChoices);
      const bizDisc = bizMode ? +(t.sub * D.FLEET_CO.discount).toFixed(2) : 0;
      app.innerHTML = `${crumbs([['Home', '#/'], ['Cart', '#/cart'], ['Checkout', '']])}<h1 class="page-h">Checkout</h1>
      <div class="co">
        <div class="co-main">
          <section class="panel"><h2><span class="step">1</span>Ship to</h2>
            <div class="form2"><label>Name<input value="Max Nihart"></label><label>Phone<input value="(419) 555-0142"></label>
            <label class="span2">Address<input value="1200 Demo Industrial Pkwy"></label><label>City<input value="Bryan"></label>
            <label class="half"><span>State</span><input value="OH"></label><label class="half"><span>ZIP</span><input value="43506"></label></div>
          </section>
          <section class="panel"><h2><span class="step">2</span>Shipping — ${t.groups.length} warehouse${t.groups.length > 1 ? 's' : ''}</h2>
            <p class="muted small">Parts ship directly from the distribution center that has them closest to you. Each box has its own shipping options.</p>
            ${t.groups.map((g, gi) => `<div class="whship">
              <div class="wh-h"><span class="dot d${Math.min(D.WAREHOUSES[g.wh].d, 4)}"></span><b>Box ${gi + 1} · ${esc(D.WAREHOUSES[g.wh].city)}</b><span class="muted">${g.weight} lb</span></div>
              <ul class="whitems">${g.lines.map(l => `<li>${l.qty}× ${esc(l.brand)} ${esc(l.partNo)} <span class="muted">${esc(l.name)}</span></li>`).join('')}</ul>
              <div class="shipopts">${shipOptions(g.weight, g.wh).map(o => `<label class="so ${g.opt.id === o.id ? 'on' : ''}"><input type="radio" name="ship-${g.wh}" value="${o.id}" data-wh="${g.wh}" ${g.opt.id === o.id ? 'checked' : ''}><span class="so-n">${o.name}</span><span class="so-e">${o.eta}</span><b>${money(o.charged)}</b></label>`).join('')}</div>
            </div>`).join('')}
          </section>
          <section class="panel"><h2><span class="step">3</span>Payment</h2>
            <label class="ck biz-ck"><input type="checkbox" id="bizAcct" ${bizMode ? 'checked' : ''}> <span>Bill to my shop account <span class="tier-pill t-better">${esc(D.FLEET_CO.terms)}</span><br><span class="muted small">${esc(D.FLEET_CO.name)} · ${esc(D.FLEET_CO.acct)}</span></span></label>
            ${bizMode ? `<div class="form2 biz-f"><label>Purchase order #<input id="poNum" value="${esc(poNum)}" placeholder="e.g. PO-88412"></label><label>Unit / job reference<input value="U-104 · front end"></label><label class="span2">Approver<select><option>Kyle Bauer, Shop foreman (up to $2,500)</option><option>Dana Hostetler, Owner</option></select></label></div><p class="small muted">Invoice goes on your ${esc(D.FLEET_CO.terms)} statement. ${esc(D.FLEET_CO.tier)} pricing (−${Math.round(D.FLEET_CO.discount * 100)}%) applied.</p>` : `
            <div class="paytabs"><span class="on">Card</span><span>PayPal</span><span>Apple Pay</span><span>Affirm</span></div>
            <div class="form2"><label class="span2">Card number<input value="4242 4242 4242 4242" inputmode="numeric"></label><label class="half">Expiry<input value="08 / 29"></label><label class="half">CVC<input value="123"></label></div>`}
            ${H.payIcons ? H.payIcons() : ''}
          </section>
        </div>
        <aside class="co-side panel">
          <h2>Order summary</h2>
          ${cart.map(l => `<div class="sum li"><span>${l.qty}× ${esc(l.brand)} ${esc(l.name)}</span><b>${money(l.price * l.qty)}</b></div>`).join('')}
          <hr>
          <div class="sum"><span>Parts</span><b>${money(t.sub)}</b></div>
          ${t.core ? `<div class="sum"><span>Core charges <small>(refundable)</small></span><b>${money(t.core)}</b></div>` : ''}
          ${t.groups.map((g, gi) => `<div class="sum sub"><span>Ship box ${gi + 1} · ${esc(D.WAREHOUSES[g.wh].city)} (${g.opt.name})</span><b>${money(g.opt.charged)}</b></div>`).join('')}
          <div class="sum"><span>Shipping total</span><b>${money(t.ship)}</b></div>
          ${bizMode ? `<div class="sum disc"><span>${esc(D.FLEET_CO.tier)} pricing (−${Math.round(D.FLEET_CO.discount * 100)}%)</span><b>${money(-bizDisc)}</b></div>` : ''}
          <div class="sum"><span>Est. tax (7.25%)</span><b>${money(t.tax)}</b></div>
          <div class="sum total"><span>Total</span><b>${money(t.total - bizDisc)}</b></div>
          <button class="btn btn-primary btn-lg btn-block" id="placeOrder">${bizMode ? 'Submit PO order' : 'Place order'} · ${money(t.total - bizDisc)}</button>
          <div class="cart-fit">${FIT_BADGE}</div>
          <p class="tiny muted">Prototype — no payment is taken.</p>
        </aside>
      </div>`;
      $$('.shipopts input').forEach(r => r.addEventListener('change', () => { shipChoices[r.dataset.wh] = r.value; draw(); }));
      $('#bizAcct').addEventListener('change', e => { bizMode = e.target.checked; draw(); });
      if ($('#poNum')) $('#poNum').addEventListener('input', e => { poNum = e.target.value; e.target.classList.remove('bad'); });
      $('#placeOrder').addEventListener('click', () => {
        if (bizMode && !poNum.trim()) { $('#poNum').classList.add('bad'); $('#poNum').focus(); return toast('Enter a purchase order number for shop billing', 'err'); }
        const btn = $('#placeOrder'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Placing order…';
        setTimeout(() => {
          const id = 'JX' + Math.floor(100000 + Math.random() * 899999);
          const order = { id, date: new Date().toISOString(), lines: cart.slice(), choices: Object.assign({}, shipChoices), po: bizMode ? poNum : null };
          const orders = store.get('orders', []); orders.unshift(order); store.set('orders', orders.slice(0, 10));
          cart = []; saveCart(); shipChoices = {};
          location.hash = '#/order/' + id;
        }, 900);
      });
    };
    draw();
  }

  function getOrder(id) { return store.get('orders', []).find(o => o.id === id); }

  function pageOrder(id) {
    const o = getOrder(id); if (!o) return notFound();
    const t = cartTotals(o.lines, o.choices);
    app.innerHTML = `<div class="panel confirm"><div class="big-check">✓</div><h1>Order ${esc(o.id)} placed</h1>
      <p>${t.groups.length} box${t.groups.length > 1 ? 'es' : ''} shipping from ${t.groups.map(g => D.WAREHOUSES[g.wh].city).join(', ')}. Total <b>${money(t.total)}</b>.</p>
      ${o.po ? `<p>Billed to shop account · PO <b>${esc(o.po)}</b></p>` : ''}<p class="muted small">You'll get a separate tracking number for each warehouse. Questions? Our 24/7 assistant already knows this order.</p>
      <div class="confirm-cta"><a class="btn" href="#/">Keep shopping</a><button class="btn" id="trackBtn">💬 Track this order</button><a class="btn btn-dark" href="#/admin/${esc(o.id)}">Internal: see margin on this order →</a></div></div>`;
    $('#trackBtn').onclick = () => H.chatAsk && H.chatAsk('order');
  }

  // ---------- admin / margin mock ----------
  function sampleOrder() {
    const saveCartTmp = cart; cart = [];
    const ram = D.findVehicle(DEMO_GARAGE[0]);
    const hubs = D.partsFor(ram, 'wheel-hub-assembly'); const pads = D.partsFor(ram, 'brake-pad'); const alt = D.partsFor(ram, 'alternator');
    const a = hubs.find(p => p.tier === 'better'); const b = pads.find(p => p.tier === 'best' && p.wh !== a.wh) || pads[0]; const d = alt.find(p => p.wh !== a.wh && p.wh !== b.wh) || alt[0];
    const mk = (p, q) => ({ key: p.key, vid: ram.id, subId: p.subId, i: p.i, vlabel: D.vehicleLabel(ram), name: p.subName, pos: p.pos, brand: p.brand, partNo: p.partNo, tier: p.tier, price: p.price, cost: p.cost, core: p.core, wh: p.wh, weight: p.weight, qty: q });
    cart = saveCartTmp;
    return { id: 'SAMPLE', date: new Date().toISOString(), lines: [mk(a, 2), mk(b, 1), mk(d, 1)], choices: {} };
  }

  function pageAdmin(id) {
    renderVehBar();
    const orders = store.get('orders', []);
    const o = (id && getOrder(id)) || orders[0] || sampleOrder();
    let markup = null; // null = use actual charged rates
    const draw = () => {
      const t = cartTotals(o.lines, o.choices);
      const lineRows = o.lines.map(l => ({ l, sell: l.price * l.qty, cost: l.cost * l.qty }));
      const partsSell = lineRows.reduce((a, r) => a + r.sell, 0), partsCost = lineRows.reduce((a, r) => a + r.cost, 0);
      const shipRows = t.groups.map(g => { const charged = markup == null ? g.opt.charged : +(g.opt.label * (1 + markup / 100)).toFixed(2); return { g, charged, label: g.opt.label, fee: DROPSHIP_FEE }; });
      const shipCharged = shipRows.reduce((a, r) => a + r.charged, 0), shipLabel = shipRows.reduce((a, r) => a + r.label, 0), dsFees = shipRows.length * DROPSHIP_FEE;
      const custTotal = partsSell + t.core + shipCharged + t.tax;
      const fees = payFee(custTotal);
      const partsGP = partsSell - partsCost, shipGP = shipCharged - shipLabel - dsFees;
      const net = partsGP + shipGP - fees;
      const revenue = partsSell + shipCharged;
      const pct = n => (n * 100).toFixed(1) + '%';
      const cls = n => n >= 0 ? 'pos' : 'neg';
      app.innerHTML = `${crumbs([['Home', '#/'], ['Admin', ''], ['Order ' + o.id, '']])}
      <div class="admin-head"><div><span class="internal">INTERNAL · MOCK</span><h1 class="page-h">Order margin — ${esc(o.id)}</h1><div class="muted small">${o.id === 'SAMPLE' ? 'Sample order (place an order in checkout to see your own)' : new Date(o.date).toLocaleString()} · drop-ship via distributor network</div></div>
        ${orders.length ? `<select id="ordSel">${orders.map(x => `<option value="${x.id}" ${x.id === o.id ? 'selected' : ''}>${x.id}</option>`).join('')}</select>` : ''}</div>

      <div class="kpis">
        <div class="kpi"><span>Customer paid</span><b>${money(custTotal)}</b><small>incl. tax & refundable cores</small></div>
        <div class="kpi"><span>Revenue (parts + ship)</span><b>${money(revenue)}</b></div>
        <div class="kpi"><span>Net margin</span><b class="${cls(net)}">${money(net)}</b><small>${pct(net / revenue)} of revenue</small></div>
        <div class="kpi"><span>Shipping profit</span><b class="${cls(shipGP)}">${money(shipGP)}</b><small>after labels & drop-ship fees</small></div>
      </div>

      <section class="panel"><h2>Parts</h2><div class="tscroll"><table class="grid money-t"><thead><tr><th>Part</th><th>Qty</th><th class="r">Sell</th><th class="r">Distributor cost</th><th class="r">Gross $</th><th class="r">GM %</th></tr></thead><tbody>
        ${lineRows.map(r => `<tr><td><b>${esc(r.l.brand)} ${esc(r.l.partNo)}</b><br><span class="small muted">${esc(r.l.name)} · ${D.TIERS[r.l.tier].label} · ${esc(D.WAREHOUSES[r.l.wh].city)}</span></td><td data-l="Qty">${r.l.qty}</td><td data-l="Sell" class="r">${money(r.sell)}</td><td data-l="Dist. cost" class="r">${money(r.cost)}</td><td data-l="Gross $" class="r ${cls(r.sell - r.cost)}">${money(r.sell - r.cost)}</td><td data-l="GM %" class="r">${pct((r.sell - r.cost) / r.sell)}</td></tr>`).join('')}
        <tr class="tot"><td>Parts total</td><td class="hm"></td><td data-l="Sell" class="r">${money(partsSell)}</td><td data-l="Dist. cost" class="r">${money(partsCost)}</td><td data-l="Gross $" class="r ${cls(partsGP)}">${money(partsGP)}</td><td data-l="GM %" class="r">${pct(partsGP / partsSell)}</td></tr></tbody></table></div>
        ${t.core ? `<p class="small muted">Core charges (${money(t.core)}) pass through: collected from customer, refunded on return, credited by distributor — margin-neutral.</p>` : ''}</section>

      <section class="panel"><h2>Shipping — charged vs. actual</h2>
        <div class="slider"><label>What-if: shipping markup over label cost <b id="mkv">${markup == null ? 'current rate card' : markup + '%'}</b></label>
          <input type="range" id="mk" min="0" max="80" step="5" value="${markup == null ? 40 : markup}"><button class="linkbtn small" id="mkReset">reset</button></div>
        <div class="tscroll"><table class="grid money-t"><thead><tr><th>Box / warehouse</th><th>Method</th><th class="r">Charged</th><th class="r">Label cost</th><th class="r">Drop-ship fee</th><th class="r">Ship profit</th></tr></thead><tbody>
        ${shipRows.map((r, i) => `<tr><td>Box ${i + 1} · ${esc(D.WAREHOUSES[r.g.wh].city)}<br><span class="small muted">${r.g.weight} lb</span></td><td data-l="Method">${r.g.opt.name}</td><td data-l="Charged" class="r">${money(r.charged)}</td><td data-l="Label cost" class="r">${money(r.label)}</td><td data-l="Drop-ship fee" class="r">${money(r.fee)}</td><td data-l="Ship profit" class="r ${cls(r.charged - r.label - r.fee)}">${money(r.charged - r.label - r.fee)}</td></tr>`).join('')}
        <tr class="tot"><td>Shipping total</td><td class="hm"></td><td data-l="Charged" class="r">${money(shipCharged)}</td><td data-l="Label cost" class="r">${money(shipLabel)}</td><td data-l="Drop-ship fees" class="r">${money(dsFees)}</td><td data-l="Ship profit" class="r ${cls(shipGP)}">${money(shipGP)}</td></tr></tbody></table></div>
        <p class="small muted">Label cost = our negotiated carrier rate. The customer sees a fair per-warehouse rate; the spread covers the distributor's drop-ship fee and leaves a few dollars per box.</p></section>

      <section class="panel"><h2>Order P&L</h2><table class="kv pl">
        <tr><th>Parts gross profit</th><td class="r ${cls(partsGP)}">${money(partsGP)}</td></tr>
        <tr><th>Shipping profit (charged − labels − drop-ship fees)</th><td class="r ${cls(shipGP)}">${money(shipGP)}</td></tr>
        <tr><th>Payment processing (2.9% + $0.30 on ${money(custTotal)})</th><td class="r neg">${money(-fees)}</td></tr>
        <tr><th>Sales tax collected (remitted)</th><td class="r muted">${money(t.tax)} pass-through</td></tr>
        <tr class="tot"><th>Net margin</th><td class="r ${cls(net)}"><b>${money(net)}</b> · ${pct(net / revenue)}</td></tr></table>
        <div class="bar-split" title="Where the net comes from">
          <span style="flex:${Math.max(partsGP, 0)}" class="bs-parts"></span><span style="flex:${Math.max(shipGP, 0.01)}" class="bs-ship"></span><span style="flex:${fees}" class="bs-fee"></span>
        </div><div class="bs-legend"><span><i class="bs-parts"></i>Parts GP ${money(partsGP)}</span><span><i class="bs-ship"></i>Shipping profit ${money(shipGP)}</span><span><i class="bs-fee"></i>Payment fees ${money(fees)}</span></div></section>`;
      const mk = $('#mk');
      mk.addEventListener('input', () => { markup = +mk.value; draw(); });
      $('#mkReset').onclick = () => { markup = null; draw(); };
      const os = $('#ordSel'); if (os) os.onchange = () => { location.hash = '#/admin/' + os.value; };
    };
    draw();
  }

  function pageSearch(q) {
    const term = (q.get('q') || '').trim();
    const t = term.toLowerCase();
    const results = [];
    if (t) {
      const vids = [...new Set(garage.concat(DEMO_GARAGE, [D.vid(2020, 'Chevrolet', 'Silverado 2500 HD', '6.6L V8 Duramax Diesel Turbo')]))];
      vids.forEach(id => { const v = D.findVehicle(id); if (!v) return;
        D.CATALOG.forEach(c => D.subsFor(c, v).forEach(s => D.partsFor(v, s.id).forEach(p => { if (p.partNo.toLowerCase().includes(t)) results.push({ v, p }); })));
      });
    }
    const subs = []; D.CATALOG.forEach(c => c.subs.forEach(s => { if (t && (s.name.toLowerCase().includes(t) || t.split(/\s+/).every(w => s.name.toLowerCase().includes(w.replace(/s$/, ''))))) subs.push({ c, s }); }));
    const cv = D.findVehicle(currentVid());
    app.innerHTML = `${crumbs([['Home', '#/'], ['Search', '']])}<h1 class="page-h">Results for “${esc(term)}”</h1>
      ${subs.length ? `<section class="panel"><h2>Part types</h2><ul class="simple">${subs.map(({ c, s }) => `<li><a href="${cv ? '#/v/' + cv.id + '/' + s.id : '#/garage'}"><b>${esc(s.name)}</b></a> <span class="muted small">in ${esc(c.name)}${cv ? ' · for ' + esc(D.vehicleLabel(cv)) : ' · choose a vehicle'}</span></li>`).join('')}</ul></section>` : ''}
      ${results.length ? `<section class="panel"><h2>Part numbers</h2><ul class="simple">${results.slice(0, 30).map(({ v, p }) => `<li><a href="#/p/${v.id}/${p.subId}/${p.i}"><b>${esc(p.brand)} ${esc(p.partNo)}</b></a> ${tierPill(p.tier)} <span class="muted small">${esc(p.subName)} · ${esc(D.vehicleLabel(v))}</span> <b>${money(p.price)}</b></li>`).join('')}</ul></section>` : ''}
      ${!subs.length && !results.length ? `<div class="empty">No matches. Try “hub”, “filter”, or a part number like <code>${esc(D.partsFor(D.findVehicle(DEMO_GARAGE[0]), 'wheel-hub-assembly')[0].partNo)}</code>.</div>` : ''}`;
  }

  function notFound() { app.innerHTML = '<div class="empty big"><div class="empty-ico">🧭</div><b>We couldn\'t find that page</b><br><a class="btn btn-primary" href="#/">Back to the store</a></div>'; }

  // ---------- modal ----------
  function openModal(html) {
    const m = $('#modal');
    m.innerHTML = `<div class="m-bg"></div><div class="m-box" role="dialog" aria-modal="true"><button class="m-x" aria-label="Close">✕</button>${html}</div>`;
    m.hidden = false; document.body.classList.add('noscroll');
    $('.m-bg', m).onclick = closeModal; $('.m-x', m).onclick = closeModal;
  }
  function closeModal() { $('#modal').hidden = true; document.body.classList.remove('noscroll'); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // ---------- router ----------
  function render() {
    const raw = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = raw.split('?');
    const q = new URLSearchParams(qs || '');
    const parts = path.split('/').filter(Boolean);
    closeModal();
    if (parts[0] !== 'v' || !parts[2]) { $('#compareBar').hidden = true; compare = []; }
    renderVehBar();
    if (!parts.length) pageHome();
    else if (parts[0] === 'garage') pageGarage();
    else if (parts[0] === 'v' && parts[2]) pageListing(parts[1], parts[2], q);
    else if (parts[0] === 'v') pageCatalog(parts[1], q);
    else if (parts[0] === 'p') pageDetail(parts[1], parts[2], parts[3]);
    else if (parts[0] === 'cart') pageCart();
    else if (parts[0] === 'checkout') pageCheckout();
    else if (parts[0] === 'order') pageOrder(parts[1]);
    else if (parts[0] === 'admin') pageAdmin(parts[1]);
    else if (parts[0] === 'search') pageSearch(q);
    else if (H.routes[parts[0]]) H.routes[parts[0]](parts, q);
    else notFound();
    $$('.mainnav a').forEach(a => a.classList.toggle('on', a.dataset.nav === (parts[0] || 'home')));
    if (H.afterRender) H.afterRender(parts);
    renderVehBar();
    window.scrollTo(0, 0);
  }

  $('#searchForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#searchInput').value.trim(); if (v) location.hash = '#/search?q=' + encodeURIComponent(v); });
  window.addEventListener('hashchange', render);
  // expose for screenshot harness
  window.PR = { loadDemoCart: () => { loadDemoCart(); } };
  // shared context for js/features.js (loaded after this file, before first render)
  Object.assign(H, {
    D, $, $$, app, money, esc, store, toast, crumbs, stars, tierPill, openModal, closeModal, render, renderVehBar, FIT_BADGE,
    selectorHtml, wireSelector, setVehicle, currentVid, addToCart, saveCart, updateCartCount, cartTotals, groupByWh, DEMO_GARAGE,
    getGarage: () => garage, getCart: () => cart, setCart: c => { cart = c; saveCart(); }, getOrders: () => store.get('orders', []), sampleOrder
  });
  document.addEventListener('DOMContentLoaded', () => {
    if (H.init) H.init();
    if (/demo=cart/.test(location.search) && !cart.length) loadDemoCart();
    updateCartCount();
    render();
  });
})();
