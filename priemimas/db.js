/* BetonPro duomenų bazė iš privačios GitHub saugyklos (povbra/betonpro-duomenys).
   Raktas (GitHub fine-grained token, tik skaityti) laikomas tik šioje naršyklėje. */
(function () {
  'use strict';
  const REPO = 'povbra/betonpro-duomenys', LSG = 'bp-priemimas-ghtoken';
  const PL = { 11: 'R', 13: 'S', 14: 'B' };
  const PLN = { 3: 'Panevėžys', 11: 'Runeikiai', 12: 'Vilnius', 13: 'Stašėnai', 14: 'Baisogala', 15: 'Šiauliai' };
  const LEGAL = new Set(['uab', 'ab', 'mb', 'iį', 'ii', 'všį', 'vsi', 'sia', 'ūb', 'ub', 'tūb', 'filialas', 'lietuvoje', 'as', 'a', 's', 'oü', 'ou']);
  const st = { ok: false, loading: false, err: null, at: null, n: {} };
  let IDX = null, LETTERS = null, CARS = null;

  const tok = () => { try { return localStorage.getItem(LSG) || ''; } catch (e) { return ''; } };
  const setTok = (t) => { try { t ? localStorage.setItem(LSG, t) : localStorage.removeItem(LSG); } catch (e) {} };
  const clean = (s) => String(s == null ? '' : s).replace(/\r/g, '').trim();
  function ck(name) {
    return clean(name).toLowerCase().replace(/[„“"'”«»]/g, ' ').split(/[^\p{L}\p{N}&]+/u).filter((w) => w && !LEGAL.has(w)).join(' ');
  }
  function keys(company) {
    const s = clean(company), m = s.match(/^([^(]*)\(([^)]*)\)/);
    const out = [ck(m ? m[1] : s)]; if (m) out.push(ck(m[2]));
    return out.filter((k) => k && k !== 'fizinis asmuo');
  }
  const hm = (s) => { const m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? (Number(m[1]) - 6) * 60 + Number(m[2]) : null; };
  const words = (s) => new Set(clean(s).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3 && !/^(lietuva|gatvė|gatve|sav|savivaldybė|rajono|kaimas|seniūnija)$/.test(w) && !/^\d{5}$/.test(w)));

  async function get(f) {
    const r = await fetch('https://api.github.com/repos/' + REPO + '/contents/' + f + '?ref=main', { headers: { Authorization: 'Bearer ' + tok(), Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' }, cache: 'no-store' });
    if (!r.ok) {
      let m = 'HTTP ' + r.status;
      if (r.status === 401) m = 'raktas netinkamas arba nebegalioja (401)';
      if (r.status === 403) m = 'raktui neleista skaityti (403)';
      if (r.status === 404) m = 'nerasta – raktas neturi prieigos prie ' + REPO + ' (404)';
      throw new Error(f + ': ' + m);
    }
    return r.json();
  }

  function build(V, Sx, K) {
    const vi = (k) => V.cols.indexOf(k), si = (k) => Sx.cols.indexOf(k), ki = (k) => K.cols.indexOf(k);
    const orders = new Map();
    V.rows.forEach((r) => {
      const pad = Number(r[vi('padalinys_id')]), id = r[vi('uzs_id')], k = pad + '_' + id;
      let o = orders.get(k);
      if (!o) {
        const prod = clean(r[vi('produktas')]), dt = clean(r[vi('pristatymas')]);
        o = { k, id, pad, plant: PL[pad] || null, plantName: PLN[pad] || String(pad), client: clean(r[vi('klientas')]), address: clean(r[vi('adresas')]), product: prod, code: prod.split(' - ')[0].trim(), date: dt.slice(0, 10), time: dt.slice(11, 16), interval: Number(r[vi('intervalas')]) || 0, km: Number(r[vi('km')]) || 0, m3: 0, trips: [] };
        o.ck = ck(o.client); o.cls = (prod.match(/C\d{1,2}\/\d{1,2}(?:[.,]5)?/) || [''])[0];
        orders.set(k, o);
      }
      const q = Number(r[vi('m3')]) || 0; o.m3 += q;
      o.trips.push({ nr: Number(r[vi('reisas')]) || 0, car: clean(r[vi('auto')]), q, at: clean(r[vi('pristatyti')]).slice(0, 5) });
    });
    const all = Array.from(orders.values()).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const byCk = new Map(), byDate = new Map();
    all.forEach((o) => { (byCk.get(o.ck) || byCk.set(o.ck, []).get(o.ck)).push(o); (byDate.get(o.date) || byDate.set(o.date, []).get(o.date)).push(o); });
    // kainos iš sąskaitų eilučių
    const pAll = new Map(), pCl = new Map();
    Sx.rows.forEach((r) => {
      const code = clean(r[si('kodas')]).toUpperCase(), q = Number(r[si('kiekis')]) || 0, p = Number(r[si('pard_kaina')]) || 0;
      const mat = clean(r[si('matas')]).toLowerCase();
      if (!code || q <= 0 || p <= 0 || !['', '0', 'm3', 'm³'].includes(mat)) return;
      const c = ck(r[si('uzsakovas')]), d = clean(r[si('fakt_data')]) || clean(r[si('salytis')]).slice(0, 10);
      const a = pAll.get(code) || pAll.set(code, { q: 0, s: 0, cost: 0, cq: 0 }).get(code);
      a.q += q; a.s += p * q; const sv = Number(r[si('savikaina')]) || 0; if (sv > 0) { a.cost += sv * q; a.cq += q; }
      const kk = c + '|' + code, b = pCl.get(kk) || pCl.set(kk, { q: 0, s: 0, last: '', lastP: 0, type: '' }).get(kk);
      b.q += q; b.s += p * q; if (d >= b.last) { b.last = d; b.lastP = p; b.type = clean(r[si('kainos_tipas')]); }
    });
    const cards = new Map();
    K.rows.forEach((r) => { const o = {}; K.cols.forEach((c, i) => { o[c] = r[i]; }); cards.set(ck(o.name), o); void ki; });
    return { all, byCk, byDate, pAll, pCl, cards };
  }

  function buildCars(AU, VZ) {
    if (!AU) return null;
    const zn = {}; if (VZ) VZ.rows.forEach((r) => { zn[r[0]] = clean(r[1]); });
    const ai = (k) => AU.cols.indexOf(k), m = new Map();
    AU.rows.forEach((r) => { const own = zn[r[ai('transp_id')]] || ''; m.set(clean(r[ai('name')]), { type: clean(r[ai('tipas')]), owner: own.replace(/,?\s*UAB\b/g, '').trim(), c3: /^C3/i.test(own), pump: /pump|pumi/i.test(clean(r[ai('tipas')])) }); });
    return m;
  }
  // B3c forma: vienos dienos betonvežių užimtumas pagal mazgą (30 min langai 06:00–18:00), C3 betonvežiai, tikri siurbliai
  const B3PADS = [12, 13, 11, 14], B3NS = 36;
  const nmz = (x) => String(x || '').toLowerCase().replace(/[„“"']/g, '').replace(/\b(uab|mb|ab)\b/g, '').replace(/[,.]/g, ' ').replace(/\s+/g, ' ').trim();
  function clientCar(owner, client) { const a = nmz(owner), b = nmz(client); return !!(a && b && (a.includes(b) || b.includes(a))); }
  function b3day(date) {
    if (!IDX) return null;
    const os = IDX.byDate.get(date) || [], hmA = (s) => { const x = String(s || '').match(/(\d{1,2}):(\d{2})/); return x ? Number(x[1]) * 60 + Number(x[2]) : null; };
    const L = [], pj = new Map(), c3trips = new Map();
    os.forEach((o) => {
      const tr = Math.max(10, Math.round((o.km || 20) / 40 * 60));
      const arrs = [];
      o.trips.forEach((t, j) => {
        const info = CARS ? CARS.get(t.car) : null;
        let a = hmA(t.at); if (a == null) a = hmA(o.time) != null ? hmA(o.time) + j * (o.interval || 20) : null;
        if (a == null) return;
        if (info && info.pump) { const k = o.k + '|' + t.car; if (!pj.has(k)) pj.set(k, { car: t.car, type: info.type, owner: info.owner, c3: info.c3, pad: o.pad, client: o.client, s: null, e: null, k: o.k }); return; }
        arrs.push(a);
        if (info && clientCar(info.owner, o.client)) return; // kliento betonvežis (pasiima pats)
        const un = t.q ? Math.max(10, Math.round(20 * t.q / 7.5)) : 15;
        L.push({ pad: o.pad, car: t.car, s: a - tr - 10, e: a + un + tr });
        if (info && info.c3) { const c = c3trips.get(t.car) || c3trips.set(t.car, {}).get(t.car); c[o.pad] = (c[o.pad] || 0) + 1; }
      });
      pj.forEach((p) => { if (p.k === o.k && arrs.length) { p.s = Math.min(...arrs); p.e = Math.max(...arrs) + 30; } });
    });
    const pumps = Array.from(pj.values()).filter((p) => p.s != null);
    const c3all = CARS ? Array.from(CARS.entries()).filter(([, v]) => v.c3 && !v.pump).map(([k]) => k) : [];
    const own = {}; B3PADS.forEach((p) => { own[p] = 0; });
    c3trips.forEach((c) => { const best = Object.entries(c).sort((a, b) => b[1] - a[1])[0]; if (best && own[best[0]] != null) own[best[0]]++; });
    const slots = {}, trips = {};
    B3PADS.forEach((p) => {
      const l = L.filter((x) => x.pad === p); trips[p] = l.length;
      slots[p] = Array.from({ length: B3NS }, (_, i) => { const a = 360 + 30 * i, b = a + 30; return new Set(l.filter((x) => x.s < b && a < x.e).map((x) => x.car)).size; });
    });
    const any = B3PADS.some((p) => trips[p] > 0);
    return { date, own, c3: c3all.length || 6, slots, trips, pumps, forecast: !any };
  }
  // Įprastas savų C3 betonvežių pasiskirstymas pagal mazgus (paskutinės 20 darbo dienų su duomenimis) – prognozei.
  let TYP = null;
  function b3typical() {
    if (TYP || !IDX) return TYP;
    const ds = Array.from(IDX.byDate.keys()).sort().reverse().filter((d) => { const t = new Date(d + 'T12:00:00').getDay(); return t > 0 && t < 6; });
    const acc = {}; B3PADS.forEach((p) => { acc[p] = []; }); let n = 0;
    for (const d of ds) { const D = b3day(d); if (!D || D.forecast) continue; B3PADS.forEach((p) => acc[p].push(D.own[p] || 0)); if (++n >= 20) break; }
    const med = (a) => { if (!a.length) return 0; const b = a.slice().sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
    TYP = { n, own: {} }; B3PADS.forEach((p) => { TYP.own[p] = med(acc[p]); });
    return TYP;
  }

  async function load() {
    if (!tok()) { st.ok = false; st.err = null; return st; }
    st.loading = true; st.err = null;
    try {
      const [V, Sx, K, LT, AU, VZ] = await Promise.all([get('vezimai.json'), get('saskaitu_eilutes.json'), get('klientai.json'), get('letters.json').catch(() => null), get('automobiliai.json').catch(() => null), get('vezejai.json').catch(() => null)]);
      CARS = buildCars(AU, VZ);
      LETTERS = Array.isArray(LT) && LT.length ? LT : null;
      IDX = build(V, Sx, K);
      st.ok = true; st.at = new Date().toISOString();
      st.n = { laiskai: LETTERS ? LETTERS.length : 0, vezimai: V.rows.length, uzsakymai: IDX.all.length, saskaitu_eilutes: Sx.rows.length, klientai: K.rows.length };
    } catch (e) { st.ok = false; st.err = String(e.message || e); IDX = null; }
    st.loading = false; return st;
  }

  function ordersOf(company) {
    if (!IDX) return [];
    const ks = keys(company), seen = new Set(), out = [];
    ks.forEach((k) => (IDX.byCk.get(k) || []).forEach((o) => { if (!seen.has(o.k)) { seen.add(o.k); out.push(o); } }));
    return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }
  function card(company) { if (!IDX) return null; for (const k of keys(company)) { const c = IDX.cards.get(k); if (c) return c; } return null; }
  function summary(company, before) {
    const os = ordersOf(company).filter((o) => !before || o.date < before);
    if (!os.length) return null;
    const plants = {}, addr = new Map(), codes = new Map();
    os.forEach((o) => {
      plants[o.plantName] = (plants[o.plantName] || 0) + 1;
      const a = addr.get(o.address) || addr.set(o.address, { address: o.address, n: 0, m3: 0, last: '', plant: '', codes: new Map() }).get(o.address);
      a.n++; a.m3 += o.m3; if (o.date >= a.last) { a.last = o.date; a.plant = o.plantName; } a.codes.set(o.code, (a.codes.get(o.code) || 0) + 1);
      const c = codes.get(o.code) || codes.set(o.code, { code: o.code, cls: o.cls, product: o.product, n: 0, m3: 0, plant: o.plantName }).get(o.code);
      c.n++; c.m3 += o.m3;
    });
    return {
      n: os.length, m3: os.reduce((s, o) => s + o.m3, 0), plants: Object.entries(plants).sort((a, b) => b[1] - a[1]),
      addrs: Array.from(addr.values()).sort((a, b) => b.last.localeCompare(a.last)).map((a) => Object.assign(a, { codes: Array.from(a.codes.entries()).sort((x, y) => y[1] - x[1]).map((x) => x[0]) })),
      codes: Array.from(codes.values()).sort((a, b) => b.m3 - a.m3), last: os.slice(-5).reverse(), first: os[0].date, lastDate: os[os.length - 1].date
    };
  }
  function sameAddress(company, text, before) {
    const w = words(text); if (!w.size) return [];
    return ordersOf(company).filter((o) => (!before || o.date < before) && Array.from(words(o.address)).some((x) => w.has(x)));
  }
  function factsOn(company, date) { return ordersOf(company).filter((o) => o.date === date); }
  function usedCodes(company) { return new Set(ordersOf(company).map((o) => o.code.toUpperCase())); }
  function price(code, company) {
    if (!IDX || !code) return null;
    code = String(code).toUpperCase();
    const a = IDX.pAll.get(code); let c = null;
    for (const k of keys(company || '')) { const x = IDX.pCl.get(k + '|' + code); if (x) { c = x; break; } }
    if (!a && !c) return null;
    return { avg: a ? a.s / a.q : null, avgQ: a ? a.q : 0, cost: a && a.cq ? a.cost / a.cq : null, client: c ? c.s / c.q : null, clientQ: c ? c.q : 0, clientLast: c ? c.lastP : null, clientLastDate: c ? c.last : '', type: c ? c.type : '' };
  }
  // fonas: tikri tos dienos BetonPro reisai trims mazgams. Formatas kaip app.js: [plant, oid, own, pump, loadStart, arrive, return, q, ck]
  function dayTrips(date, LOAD) {
    if (!IDX) return [];
    const out = [];
    (IDX.byDate.get(date) || []).forEach((o) => {
      if (!o.plant) return;
      const T = Math.max(15, Math.min(120, Math.round((o.km || 30) * 1.2)));
      o.trips.forEach((t, j) => {
        let arr = hm(t.at); if (arr == null) arr = hm(o.time) != null ? hm(o.time) + j * (o.interval || 20) : null;
        if (arr == null) return;
        out.push([o.plant, 'db:' + o.k, 1, '', arr - T - LOAD, arr, arr + 20 + T, t.q || 0, o.ck]);
      });
    });
    return out;
  }
  function dayInfo(date) { const os = IDX ? (IDX.byDate.get(date) || []).filter((o) => o.plant) : []; const cars = {}; os.forEach((o) => { cars[o.plant] = cars[o.plant] || new Set(); o.trips.forEach((t) => t.car && cars[o.plant].add(t.car)); }); return { n: os.length, m3: os.reduce((s, o) => s + o.m3, 0), trips: os.reduce((s, o) => s + o.trips.length, 0), cars: Object.fromEntries(Object.entries(cars).map(([k, v]) => [k, v.size])) }; }

  window.BPDB = { REPO, st, tok, setTok, load, b3day, b3typical, B3PADS, B3NS, keys, ck, ordersOf, card, summary, sameAddress, factsOn, usedCodes, price, dayTrips, dayInfo, get ready() { return !!IDX; }, get letters() { return LETTERS; } };
})();
