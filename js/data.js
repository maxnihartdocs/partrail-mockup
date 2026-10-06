/* Jax Auto Parts prototype — ALL DATA IS FAKE. No real brands, prices, or part numbers. */
(function () {
  'use strict';

  // ---------- helpers ----------
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seedStr) {
    let a = hash(seedStr);
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const range = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(i); return r; };

  // ---------- vehicles ----------
  const E = (name, from, to, diesel) => ({ name, from, to, diesel: !!diesel });
  const MAKES = {
    'Ford': {
      'F-250 Super Duty': [E('6.7L V8 Power Stroke Diesel Turbo', 2011, 2025, 1), E('6.2L V8 Gas', 2011, 2025), E('7.3L V8 Gas', 2020, 2025)],
      'F-350 Super Duty': [E('6.7L V8 Power Stroke Diesel Turbo', 2011, 2025, 1), E('6.2L V8 Gas', 2011, 2025)],
      'F-150': [E('3.5L V6 EcoBoost Turbo', 2011, 2025), E('5.0L V8', 2011, 2025), E('2.7L V6 EcoBoost Turbo', 2015, 2025), E('3.0L V6 Power Stroke Diesel Turbo', 2018, 2021, 1)],
      'Escape': [E('1.5L L4 Turbo', 2017, 2024), E('2.0L L4 Turbo', 2013, 2024)]
    },
    'Ram': {
      '2500': [E('6.7L L6 Cummins Diesel Turbo', 2011, 2025, 1), E('6.4L V8 HEMI', 2014, 2025), E('5.7L V8 HEMI', 2011, 2018)],
      '3500': [E('6.7L L6 Cummins Diesel Turbo', 2011, 2025, 1), E('6.4L V8 HEMI', 2014, 2025)],
      '1500': [E('5.7L V8 HEMI', 2011, 2025), E('3.6L V6', 2013, 2025), E('3.0L V6 EcoDiesel Turbo', 2014, 2023, 1)]
    },
    'Chevrolet': {
      'Silverado 2500 HD': [E('6.6L V8 Duramax Diesel Turbo', 2011, 2025, 1), E('6.0L V8 Gas', 2011, 2019), E('6.6L V8 Gas', 2020, 2025)],
      'Silverado 3500 HD': [E('6.6L V8 Duramax Diesel Turbo', 2011, 2025, 1), E('6.6L V8 Gas', 2020, 2025)],
      'Silverado 1500': [E('5.3L V8', 2011, 2025), E('6.2L V8', 2014, 2025), E('3.0L L6 Duramax Diesel Turbo', 2020, 2025, 1)],
      'Malibu': [E('1.5L L4 Turbo', 2016, 2024), E('2.5L L4', 2013, 2018)]
    },
    'GMC': {
      'Sierra 2500 HD': [E('6.6L V8 Duramax Diesel Turbo', 2011, 2025, 1), E('6.6L V8 Gas', 2020, 2025)],
      'Sierra 1500': [E('5.3L V8', 2011, 2025), E('6.2L V8', 2014, 2025)]
    },
    'Toyota': {
      'Camry': [E('2.5L L4', 2012, 2025), E('3.5L V6', 2012, 2024)],
      'Tacoma': [E('3.5L V6', 2016, 2023), E('2.7L L4', 2011, 2023)]
    },
    'Honda': {
      'Accord': [E('1.5L L4 Turbo', 2018, 2025), E('2.4L L4', 2013, 2017)],
      'Civic': [E('2.0L L4', 2016, 2025), E('1.5L L4 Turbo', 2016, 2025)]
    }
  };
  const YEARS = range(2011, 2025).reverse();

  function makesFor(year) { return Object.keys(MAKES).filter(mk => modelsFor(year, mk).length); }
  function modelsFor(year, make) {
    return Object.keys(MAKES[make] || {}).filter(md => MAKES[make][md].some(e => year >= e.from && year <= e.to));
  }
  function enginesFor(year, make, model) {
    return ((MAKES[make] || {})[model] || []).filter(e => year >= e.from && year <= e.to);
  }
  function vid(year, make, model, engine) { return [year, slug(make), slug(model), slug(engine)].join('_'); }
  function findVehicle(id) {
    const [y, mk, md, en] = (id || '').split('_');
    const year = +y;
    for (const make of Object.keys(MAKES)) {
      if (slug(make) !== mk) continue;
      for (const model of Object.keys(MAKES[make])) {
        if (slug(model) !== md) continue;
        for (const e of enginesFor(year, make, model)) {
          if (slug(e.name) === en) return { id, year, make, model, engine: e.name, diesel: e.diesel, hd: /2500|3500|250|350/.test(model) };
        }
      }
    }
    return null;
  }
  function vehicleLabel(v) { return `${v.year} ${v.make} ${v.model}`; }

  // ---------- brands (made up) ----------
  const BRANDS = [
    { name: 'Dayline', tier: 'good', pre: 'DL' },
    { name: 'Pellman', tier: 'good', pre: 'PM' },
    { name: 'Truspan Value', tier: 'good', pre: 'TV' },
    { name: 'Corvane', tier: 'better', pre: 'CV' },
    { name: 'Bluecrest', tier: 'better', pre: 'BC' },
    { name: 'Northpine', tier: 'better', pre: 'NP' },
    { name: 'Kestrel Auto', tier: 'better', pre: 'KA' },
    { name: 'Ironbark HD', tier: 'best', pre: 'IB' },
    { name: 'Hammerfield', tier: 'best', pre: 'HF' },
    { name: 'Anvilworks Pro', tier: 'best', pre: 'AW' }
  ];

  const TIERS = {
    good: { key: 'good', label: 'Economy', rank: 'GOOD', tag: 'Gets you back on the road for less.', warranty: '1 yr / 12,000 mi', bestFor: 'Selling soon, older high-mile rigs, budget repairs', mult: [0.58, 0.78] },
    better: { key: 'better', label: 'Daily Driver', rank: 'BETTER', tag: 'OE-equivalent fit and life. Our most popular pick.', warranty: '3 yr / 36,000 mi', bestFor: 'Daily commuting, light towing, keeping the truck long-term', mult: [0.92, 1.12] },
    best: { key: 'best', label: 'Heavy Duty', rank: 'BEST', tag: 'Built heavier than OE for towing and hard work.', warranty: 'Limited lifetime', bestFor: 'Towing, plowing, hotshot, fleet & commercial use', mult: [1.32, 1.7] }
  };

  // ---------- warehouses ----------
  // ETA calculated from a fixed demo ZIP (Bryan, OH 43506)
  const WAREHOUSES = {
    TOL: { code: 'TOL', city: 'Toledo, OH', days: '1 day', d: 1, zoneMult: 0.8 },
    IND: { code: 'IND', city: 'Indianapolis, IN', days: '1–2 days', d: 2, zoneMult: 0.9 },
    HBG: { code: 'HBG', city: 'Harrisburg, PA', days: '2 days', d: 2, zoneMult: 1.0 },
    ATL: { code: 'ATL', city: 'Atlanta, GA', days: '2–3 days', d: 3, zoneMult: 1.1 },
    DFW: { code: 'DFW', city: 'Dallas, TX', days: '3 days', d: 3, zoneMult: 1.25 },
    RNO: { code: 'RNO', city: 'Reno, NV', days: '4–5 days', d: 5, zoneMult: 1.5 }
  };
  const WH_WEIGHTED = ['TOL', 'TOL', 'IND', 'IND', 'IND', 'HBG', 'HBG', 'ATL', 'DFW', 'RNO'];

  // ---------- catalog ----------
  // base = typical "Daily Driver" retail price, w = ship weight lb, core = core charge, pos = position notes, diesel = diesel-only
  const S = (name, base, w, o) => Object.assign({ id: slug(name), name, base, w }, o || {});
  const CATALOG = [
    { id: 'brake-wheel-hub', name: 'Brake & Wheel Hub', icon: 'disc', subs: [
      S('Wheel Hub Assembly', 189, 22, { pos: ['Front'], featured: true }),
      S('Brake Pad', 54, 6, { pos: ['Front', 'Rear'] }),
      S('Brake Rotor', 92, 28, { pos: ['Front', 'Rear'] }),
      S('Brake Caliper', 78, 14, { core: 40, pos: ['Front Left', 'Front Right', 'Rear Left', 'Rear Right'] }),
      S('Wheel Bearing & Seal Kit', 46, 4, { pos: ['Front', 'Rear'] }),
      S('ABS Wheel Speed Sensor', 38, 1, { pos: ['Front', 'Rear'] }),
      S('Brake Hydraulic Hose', 22, 1, { pos: ['Front', 'Rear'] })
    ] },
    { id: 'engine', name: 'Engine', icon: 'piston', subs: [
      S('Oil Filter', 12, 2), S('Serpentine Belt', 41, 1), S('Belt Tensioner', 69, 4),
      S('Engine Mount', 58, 6, { pos: ['Left', 'Right'] }), S('Valve Cover Gasket', 34, 1),
      S('EGR Valve', 289, 7, { diesel: true, core: 75 }), S('EGR Cooler', 412, 16, { diesel: true }),
      S('Turbocharger', 1340, 38, { diesel: true, core: 300 }), S('Oil Cooler', 214, 9)
    ] },
    { id: 'fuel-air', name: 'Fuel & Air', icon: 'filter', subs: [
      S('Air Filter', 29, 3), S('Fuel Filter', 36, 2), S('Fuel Injector', 389, 3, { diesel: true, core: 150 }),
      S('Fuel Lift Pump', 245, 6), S('MAP Sensor', 48, 1), S('Intake Air Temp Sensor', 27, 1)
    ] },
    { id: 'cooling', name: 'Cooling System', icon: 'fan', subs: [
      S('Radiator', 268, 32), S('Water Pump', 112, 9), S('Thermostat', 31, 1), S('Fan Clutch', 146, 11),
      S('Radiator Hose', 39, 2, { pos: ['Upper', 'Lower'] }), S('Coolant Reservoir', 52, 3)
    ] },
    { id: 'exhaust-emission', name: 'Exhaust & Emission', icon: 'pipe', subs: [
      S('DEF Pump', 398, 8, { diesel: true }), S('NOx Sensor', 274, 1, { diesel: true, pos: ['Upstream', 'Downstream'] }),
      S('Exhaust Gas Temp Sensor', 64, 1, { diesel: true }), S('DPF Pressure Sensor', 89, 1, { diesel: true }),
      S('Oxygen Sensor', 58, 1, { gas: true, pos: ['Upstream', 'Downstream'] }), S('Exhaust Manifold Gasket', 28, 1)
    ] },
    { id: 'suspension', name: 'Suspension', icon: 'spring', subs: [
      S('Shock Absorber', 74, 8, { pos: ['Front', 'Rear'] }), S('Ball Joint', 48, 3, { pos: ['Front Upper', 'Front Lower'] }),
      S('Tie Rod End', 36, 2, { pos: ['Inner', 'Outer'] }), S('Steering Stabilizer', 82, 6),
      S('Track Bar', 164, 14), S('Sway Bar Link', 28, 2, { pos: ['Front', 'Rear'] })
    ] },
    { id: 'electrical', name: 'Electrical', icon: 'bolt', subs: [
      S('Alternator', 248, 15, { core: 60 }), S('Starter', 189, 13, { core: 45 }), S('Battery', 179, 52, { core: 22 }),
      S('Glow Plug', 24, 1, { diesel: true }), S('Headlight Bulb', 19, 1), S('Ignition Coil', 46, 1, { gas: true })
    ] },
    { id: 'drivetrain', name: 'Drivetrain', icon: 'gear', subs: [
      S('Universal Joint', 34, 2), S('CV Axle Assembly', 132, 18, { pos: ['Front Left', 'Front Right'] }),
      S('Transfer Case Motor', 219, 6), S('Differential Cover Gasket', 14, 1)
    ] },
    { id: 'heat-ac', name: 'Heat & Air Conditioning', icon: 'snow', subs: [
      S('A/C Compressor', 412, 22, { core: 50 }), S('Blower Motor', 78, 5), S('Cabin Air Filter', 18, 1), S('Heater Core', 129, 6)
    ] },
    { id: 'wiper', name: 'Wiper & Washer', icon: 'wiper', subs: [
      S('Wiper Blade', 21, 1, { pos: ['Driver', 'Passenger'] }), S('Washer Pump', 26, 1)
    ] }
  ];

  function subsFor(cat, v) {
    return cat.subs.filter(s => (!s.diesel || v.diesel) && (!s.gas || !v.diesel));
  }
  function findSub(subId) {
    for (const c of CATALOG) for (const s of c.subs) if (s.id === subId) return { cat: c, sub: s };
    return null;
  }

  // ---------- part generation (deterministic per vehicle + sub) ----------
  const cache = {};
  function partsFor(v, subId) {
    const key = v.id + '/' + subId;
    if (cache[key]) return cache[key];
    const found = findSub(subId); if (!found) return [];
    const { sub } = found;
    const r = rng(key);
    const hdMult = v.hd ? 1.28 : 1;
    const out = [];
    const positions = sub.pos || [null];
    // pick 7-10 brands, always at least 2 per tier
    const pool = BRANDS.slice().sort(() => r() - 0.5);
    const chosen = [];
    for (const t of ['good', 'better', 'best']) chosen.push(...pool.filter(b => b.tier === t).slice(0, 2));
    for (const b of pool) if (!chosen.includes(b) && r() > 0.35) chosen.push(b);
    let idx = 0;
    positions.forEach(pos => {
      chosen.forEach(b => {
        const T = TIERS[b.tier];
        let price = sub.base * hdMult * (T.mult[0] + r() * (T.mult[1] - T.mult[0]));
        const tags = [];
        let stock = null;
        const roll = r();
        if (roll < 0.09) { tags.push('closeout'); price *= 0.78; }
        else if (roll < 0.16) { tags.push('wholesaler'); price *= 0.7; stock = 1 + Math.floor(r() * 5); }
        if (r() < 0.12 && b.tier !== 'good') tags.push('bestseller');
        price = Math.floor(price) + (r() < 0.5 ? 0.79 : 0.49);
        const costPct = tags.includes('wholesaler') ? 0.86 : 0.7 + r() * 0.1;
        const wh = WH_WEIGHTED[Math.floor(r() * WH_WEIGHTED.length)];
        const num = String(100000 + Math.floor(r() * 899999));
        const notes = noteFor(sub, v, pos, b.tier, r);
        out.push({
          key: key + '/' + idx,
          i: idx++,
          vid: v.id, subId: sub.id, subName: sub.name,
          brand: b.name, tier: b.tier, partNo: b.pre + '-' + num,
          pos, price: +price.toFixed(2), cost: +(price * costPct).toFixed(2),
          core: sub.core ? Math.round(sub.core * (b.tier === 'best' ? 1.2 : 1)) : 0,
          wh, weight: Math.max(1, Math.round(sub.w * (b.tier === 'best' ? 1.15 : 1) * hdMult)),
          tags, stock, notes,
          rating: +(3.6 + r() * 1.35 + (b.tier === 'best' ? 0.1 : 0)).toFixed(1),
          reviews: Math.floor(4 + r() * 180)
        });
      });
    });
    out.sort((a, b) => (a.pos || '').localeCompare(b.pos || '') || a.price - b.price);
    cache[key] = out;
    return out;
  }

  function noteFor(sub, v, pos, tier, r) {
    const n = [];
    if (sub.id === 'wheel-hub-assembly') {
      n.push(v.model.match(/2500|3500|250|350/) ? '4WD; 8-Lug' : '4WD; 6-Lug');
      n.push(r() < 0.6 ? 'Includes ABS sensor' : 'ABS sensor sold separately');
      if (tier === 'best') n.push('Oversized bearings; upgraded triple-lip seal');
      if (tier === 'good') n.push('Reuse original hub bolts');
    } else if (sub.core) {
      n.push(tier === 'good' ? 'Remanufactured' : tier === 'better' ? 'Remanufactured; 100% tested' : 'New; heavy-duty internals');
    } else {
      const generic = ['Direct fit', 'OE-style connector', 'Hardware included', 'Pre-greased', 'Ceramic', 'Semi-metallic', 'Coated for rust protection'];
      n.push(generic[Math.floor(r() * generic.length)]);
    }
    if (v.diesel && r() < 0.3) n.push('Diesel-specific');
    return n;
  }

  function findPart(vidStr, subId, i) {
    const v = findVehicle(vidStr); if (!v) return null;
    const list = partsFor(v, subId);
    return list[+i] ? { v, part: list[+i] } : null;
  }

  // Tier-specific materials copy, with an override for the featured hub line
  function tierMaterials(subId, tier) {
    if (subId === 'wheel-hub-assembly') return {
      good: ['Standard-grade bearing steel', 'Single-lip seal', 'Zinc-plated flange', 'Pre-installed wheel studs'],
      better: ['OE-spec double-row bearing', 'Integrated ABS sensor (most)', 'E-coated flange for corrosion', 'Matched-tolerance studs'],
      best: ['Oversized tapered roller bearings', 'Induction-hardened spindle', 'Triple-lip contamination seal', '2× OE salt-spray rating']
    }[tier];
    return {
      good: ['Meets basic fit & function', 'Standard materials', 'Value packaging'],
      better: ['OE-equivalent spec & fit', 'Corrosion-resistant finish', 'Hardware included where needed'],
      best: ['Exceeds OE spec', 'Upgraded materials for heat & load', 'Fleet / tow rated']
    }[tier];
  }

  // ---------- store identity (swap the name here only) ----------
  const STORE = {
    name: 'Jax Auto Parts',      // full display name
    nameA: 'Jax', nameB: 'Auto Parts', // logo split: plain + accent half
    tagline: 'Every part. Every brand. Good · Better · Best.',
    support: '1-800-555-0199',
    parent: "A Doc's Diesel company · Bryan, Ohio"
  };

  // ---------- VIN / plate mock decode ----------
  const VIN_DECODE = { vid: vid(2019, 'Ram', '2500', '6.7L L6 Cummins Diesel Turbo'), trim: 'Laramie Crew Cab 4x4, 6\'4" box', engine: '6.7L I6 Cummins Turbo Diesel (HO 400 hp / 1,000 lb-ft)', drive: '4WD · 6-spd Aisin AS69RC auto', gvwr: '10,000 lb (Class 2b)', plant: 'Saltillo, MX', axle: '3.73 rear, 11.5" AAM' };
  const PLATE_DECODE = { vid: vid(2018, 'Ford', 'F-250 Super Duty', '6.7L V8 Power Stroke Diesel Turbo'), trim: 'Lariat SuperCrew 4x4, 6\'9" box', engine: '6.7L V8 Power Stroke Turbo Diesel', drive: '4WD · 6R140 TorqShift 6-spd', gvwr: '10,000 lb (Class 2b)', vin: '1FT7W2BT•JE••4821' };
  const STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];

  // ---------- job kits ("Build my job") ----------
  // each item: [subId, qty, role, pos?]   role: req | together | hw | tool
  const JOBS = [
    { id: 'front-brakes', name: 'Front brake job', icon: 'disc', diff: 2, time: '1.5–2 hr', blurb: 'Pads, rotors and hardware for both front wheels.',
      items: [['brake-pad', 1, 'req', 'Front'], ['brake-rotor', 2, 'req', 'Front'], ['brake-caliper', 1, 'together', 'Front Left'], ['brake-caliper', 1, 'together', 'Front Right'], ['brake-hydraulic-hose', 2, 'together', 'Front']],
      extras: [['hw', 'Brake hardware & clip kit', 14.99], ['hw', 'DOT 4 brake fluid, 32 oz', 12.49], ['hw', 'Brake cleaner, 2-pack', 9.98], ['tool', 'Caliper piston compressor', 24.99], ['tool', 'Torque wrench, 1/2" 25–250 ft-lb', 59.99]] },
    { id: 'front-hubs', name: 'Front hub replacement (both sides)', icon: 'hub', diff: 3, time: '2.5–3.5 hr', blurb: 'Both front wheel hub assemblies plus everything that comes off with them.',
      items: [['wheel-hub-assembly', 2, 'req', 'Front'], ['abs-wheel-speed-sensor', 2, 'together', 'Front'], ['brake-pad', 1, 'together', 'Front'], ['universal-joint', 2, 'together']],
      extras: [['hw', 'Hub bolt set (8), grade 10.9', 21.99], ['hw', 'Axle nut, 36 mm, 2-pack', 18.49], ['hw', 'Anti-seize compound, 8 oz', 8.99], ['tool', 'Axle nut socket, 36 mm 12-pt', 16.99], ['tool', 'Hub puller / slide hammer', 64.99]] },
    { id: 'glow-plugs', name: 'Glow plug service', icon: 'bolt', diff: 3, time: '2–4 hr', blurb: 'Full set of glow plugs with the gaskets that should never be reused.', diesel: true,
      items: [['glow-plug', 6, 'req'], ['valve-cover-gasket', 1, 'together'], ['intake-air-temp-sensor', 1, 'together']],
      extras: [['hw', 'Glow plug harness connector (2)', 22.99], ['hw', 'Dielectric grease, 3 oz', 6.49], ['tool', 'Glow plug socket, 9 mm thin-wall', 14.99], ['tool', 'Glow plug tap/reamer kit', 49.99]] },
    { id: 'oil-change', name: 'Oil change + filters', icon: 'filter', diff: 1, time: '45 min', blurb: 'Oil, oil filter, fuel filters and air filter — the full service.',
      items: [['oil-filter', 1, 'req'], ['fuel-filter', 1, 'req'], ['air-filter', 1, 'together'], ['cabin-air-filter', 1, 'together']],
      extras: [['hw', '15W-40 CK-4 diesel oil, 12 qt', 64.99], ['hw', 'Drain plug washer, 5-pack', 4.99], ['tool', 'Cap-style filter wrench', 12.99], ['tool', '20 qt drain pan', 18.99]] },
    { id: 'front-end', name: 'Front end rebuild (steering)', icon: 'spring', diff: 4, time: '4–6 hr', blurb: 'Ball joints, tie rods, track bar and stabilizer — the death-wobble fix.',
      items: [['ball-joint', 2, 'req', 'Front Lower'], ['tie-rod-end', 2, 'req', 'Outer'], ['track-bar', 1, 'req'], ['steering-stabilizer', 1, 'together'], ['sway-bar-link', 2, 'together', 'Front']],
      extras: [['hw', 'Cotter pin & castle nut kit', 9.99], ['hw', 'Marine grease, 14 oz', 7.99], ['tool', 'Ball joint press kit (rental-grade)', 89.99], ['tool', 'Pickle fork / tie rod separator', 19.99]] }
  ];
  // free-text problem → likely causes → jobs
  const SYMPTOMS = [
    { re: /clunk|knock|pop|wobble|turn|steer|loose|wander/i, causes: [['Worn lower ball joints', 62, 'front-end'], ['Loose track bar bushing', 24, 'front-end'], ['Failing front wheel hub bearing', 14, 'front-hubs']] },
    { re: /grind|squeal|squeak|brak|stop|pedal|vibrat/i, causes: [['Pads worn to backing plate', 58, 'front-brakes'], ['Warped / thin rotors', 30, 'front-brakes'], ['Seized caliper slide', 12, 'front-brakes']] },
    { re: /hum|growl|roar|bearing|abs|speed|wheel noise/i, causes: [['Front hub bearing failing', 71, 'front-hubs'], ['ABS tone ring / sensor fault', 19, 'front-hubs'], ['Cupped tires', 10, null]] },
    { re: /start|cold|crank|smoke|white smoke|glow|winter/i, causes: [['One or more glow plugs open', 55, 'glow-plugs'], ['Glow plug relay / grid heater', 25, 'glow-plugs'], ['Water in fuel / clogged fuel filter', 20, 'oil-change']] },
    { re: /power|stall|fuel|filter|light|service|oil|miles/i, causes: [['Restricted fuel filter', 48, 'oil-change'], ['Overdue oil & filter service', 37, 'oil-change'], ['Dirty air filter', 15, 'oil-change']] }
  ];

  // ---------- fleet / shop account (fake) ----------
  const FLEET_CO = { name: 'Black Swamp Hauling & Excavating', acct: 'SHP-20417', tier: 'Shop Pro', discount: 0.12, terms: 'Net 30', limit: 25000, balance: 6842.17, since: 2023 };
  const FLEET = (function () {
    const r = rng('fleet'); const out = [];
    const models = [[2019, 'Ram', '2500', '6.7L L6 Cummins Diesel Turbo'], [2018, 'Ford', 'F-250 Super Duty', '6.7L V8 Power Stroke Diesel Turbo'], [2020, 'Chevrolet', 'Silverado 2500 HD', '6.6L V8 Duramax Diesel Turbo'], [2021, 'Ram', '3500', '6.7L L6 Cummins Diesel Turbo'], [2017, 'Ford', 'F-350 Super Duty', '6.7L V8 Power Stroke Diesel Turbo'], [2022, 'GMC', 'Sierra 2500 HD', '6.6L V8 Duramax Diesel Turbo']];
    const drivers = ['T. Ruiz', 'K. Bauer', 'D. Miller', 'S. Okafor', 'J. Lehman', 'R. Fry', 'A. Schaffer', 'M. Diaz', 'B. Kline', 'C. Yoder', 'P. Graber', 'L. Weaver'];
    const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
    for (let k = 0; k < 12; k++) {
      const m = models[k % models.length]; const pre = { Ram: '3C6UR5', Ford: '1FT7W2', Chevrolet: '1GC4YN', GMC: '1GT49R' }[m[1]];
      let tail = ''; for (let j = 0; j < 11; j++) tail += chars[Math.floor(r() * chars.length)];
      const miles = Math.round(48000 + r() * 210000);
      out.push({ unit: 'U-' + String(101 + k), vid: vid(m[0], m[1], m[2], m[3]), vin: pre + tail, miles, driver: drivers[k], status: miles > 200000 ? 'Due: front end' : r() < 0.3 ? 'Due: oil service' : 'OK' });
    }
    return out;
  })();
  const FLEET_USERS = [['Dana Hostetler', 'Owner / admin', 'All permissions'], ['Kyle Bauer', 'Shop foreman', 'Order · approve up to $2,500'], ['Tomas Ruiz', 'Technician', 'Order with PO · needs approval'], ['Ashley Graber', 'Accounts payable', 'Invoices & statements only']];
  const FLEET_SPEND = [['May', 3120], ['Jun', 4480], ['Jul', 3905], ['Aug', 5260], ['Sep', 4710], ['Oct', 1985]];

  // ---------- SEO guides (programmatic vehicle × part pages) ----------
  const GUIDE_VEHICLES = [
    [2019, 'Ram', '2500', '6.7L L6 Cummins Diesel Turbo'], [2018, 'Ford', 'F-250 Super Duty', '6.7L V8 Power Stroke Diesel Turbo'], [2020, 'Chevrolet', 'Silverado 2500 HD', '6.6L V8 Duramax Diesel Turbo'],
    [2021, 'Ram', '3500', '6.7L L6 Cummins Diesel Turbo'], [2017, 'Ford', 'F-350 Super Duty', '6.7L V8 Power Stroke Diesel Turbo'], [2022, 'GMC', 'Sierra 2500 HD', '6.6L V8 Duramax Diesel Turbo'],
    [2016, 'Ram', '2500', '6.7L L6 Cummins Diesel Turbo'], [2015, 'Ford', 'F-250 Super Duty', '6.7L V8 Power Stroke Diesel Turbo'], [2019, 'Ford', 'F-150', '3.5L V6 EcoBoost Turbo'], [2020, 'Toyota', 'Tacoma', '3.5L V6']
  ];
  const GUIDE_PARTS = ['wheel-hub-assembly', 'brake-pad', 'brake-rotor', 'ball-joint', 'fuel-filter', 'alternator', 'water-pump', 'glow-plug', 'shock-absorber', 'starter'];
  function guideSlug(v, subId) { return v.id + '__' + subId; }

  window.DATA = {
    YEARS, MAKES, makesFor, modelsFor, enginesFor, vid, findVehicle, vehicleLabel,
    BRANDS, TIERS, WAREHOUSES, CATALOG, subsFor, findSub, partsFor, findPart, tierMaterials, rng, slug,
    STORE, VIN_DECODE, PLATE_DECODE, STATES, JOBS, SYMPTOMS, FLEET_CO, FLEET, FLEET_USERS, FLEET_SPEND, GUIDE_VEHICLES, GUIDE_PARTS, guideSlug
  };
})();
