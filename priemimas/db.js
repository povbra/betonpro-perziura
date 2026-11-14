/* BetonPro duomenų bazė iš privačios GitHub saugyklos (povbra/betonpro-duomenys).
   Raktas (GitHub fine-grained token, tik skaityti) laikomas tik šioje naršyklėje. */
(function () {
  'use strict';
  const REPO = 'povbra/betonpro-duomenys', LSG = 'bp-priemimas-ghtoken';
  const PL = { 11: 'R', 13: 'S', 14: 'B' };
  const PLN = { 3: 'Panevėžys', 11: 'Runeikiai', 12: 'Vilnius', 13: 'Stašėnai', 14: 'Baisogala', 15: 'Šiauliai' };
  const LEGAL = new Set(['uab', 'ab', 'mb', 'iį', 'ii', 'všį', 'vsi', 'sia', 'ūb', 'ub', 'tūb', 'filialas', 'lietuvoje', 'as', 'a', 's', 'oü', 'ou']);
  const st = { ok: false, loading: false, err: null, at: null, n: {} };
  let IDX = null, LETTERS = null;

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

  async function load() {
    if (!tok()) { st.ok = false; st.err = null; return st; }
    st.loading = true; st.err = null;
    try {
      const [V, Sx, K, LT] = await Promise.all([get('vezimai.json'), get('saskaitu_eilutes.json'), get('klientai.json'), get('letters.json').catch(() => null)]);
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

  window.BPDB = { REPO, st, tok, setTok, load, keys, ck, ordersOf, card, summary, sameAddress, factsOn, usedCodes, price, dayTrips, dayInfo, get ready() { return !!IDX; }, get letters() { return LETTERS; } };
})();
