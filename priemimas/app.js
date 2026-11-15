/* BetonPro · Užsakymų priėmimas — testinė versija (be serverio).
   Duomenys: data/letters.json (užkoduoti laiškai), data/recipes.json (BetonPro receptai),
   data/baseline-2026-11-03.json (tikras vienos dienos vežimų planas – „tipinės dienos“ fonas).
   AI: Claude API tiesiai iš naršyklės su vartotojo raktu (saugomas tik šioje naršyklėje). */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = (o) => JSON.parse(JSON.stringify(o));
const LS = 'bp-priemimas-test-v1', LSK = 'bp-priemimas-apikey';
const BP = '<span class="bpl" role="img" aria-label="BetonPro"><i class="a"></i><i class="b"></i><i class="c"></i><i class="y"></i>BP</span>';

const PLANTS = {
  R: { name: 'Runeikiai', area: 'Kėdainių r.', lat: 55.300, lng: 23.905 },
  S: { name: 'Stašėnai', area: 'Jonavos r.', lat: 55.063, lng: 24.255 },
  B: { name: 'Baisogala', area: 'Radviliškio r.', lat: 55.640, lng: 23.720 }
};
const PUMPS = [{ id: 'PUMI 28', len: 28 }, { id: 'PUMI 29', len: 29 }, { id: 'PUMP 36', len: 36 }, { id: 'PUMP 42', len: 42 }];
const BCODE = { I28: 'PUMI 28', I29: 'PUMI 29', P36: 'PUMP 36', P42: 'PUMP 42' };
const DAY = 720, PCAP = 35, TRIP = 7.5, LOAD = 30, UNL = 5; // pasikrovimas 30 min, išsikrovimas 5 min/m³, greitis 50 km/h
const TYPES = {
  naujas: { lab: 'Naujas užsakymas', sq: 'background:#1E8A5A' },
  grafikas: { lab: 'Savaitės grafikas', sq: 'background:#3B5B8C' },
  pakeitimas: { lab: 'Pakeitimas', sq: 'background:#F5C518;box-shadow:inset 0 0 0 1px #15171A' },
  atsaukimas: { lab: 'Atšaukimas', sq: 'background:#D2452F' },
  klausimas: { lab: 'Trūksta informacijos', sq: 'background:#F5C518;box-shadow:inset 0 0 0 1px #15171A' },
  ne_uzsakymas: { lab: 'Ne užsakymas', sq: 'border:1.5px dashed #8A9097' }
};
const DBX = () => window.BPDB && window.BPDB.ready;
const eur = (x) => x == null ? '—' : x.toFixed(2).replace('.', ',') + ' €/m³';
const MODELS = [['claude-sonnet-5-5', 'Claude Sonnet 5.5 (rekomenduojama)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (pigiausia, greičiausia)'], ['claude-opus-5-5', 'Claude Opus 5.5 (tiksliausia)']];

let LETTERS = [], RECIPES = [], BASE = [];
let S = null;
const busy = {};

const DEF = () => ({ v: 1, model: 'claude-sonnet-5-5', fleet: { R: 4, S: 7, B: 12 }, bg: true, res: {}, notes: {}, ed: {}, appr: {}, rej: {}, sel: null, filter: 'all', view: 'letters', loadDate: null, aiLog: [], ev: {}, nd: {}, bgSrc: 'db', closed: {}, oopen: {}, chOpen: {}, rcpOpen: {}, msgOpen: {} });
function load() { try { const x = JSON.parse(localStorage.getItem(LS) || 'null'); if (x && x.v === 1) { const o = Object.assign(DEF(), x); o.ev = o.ev || {}; o.nd = o.nd || {}; return o; } } catch (e) {} return DEF(); }
function save() { try { localStorage.setItem(LS, JSON.stringify(S)); } catch (e) {} }
function key() { try { return localStorage.getItem(LSK) || ''; } catch (e) { return ''; } }
function setKey(k) { try { k ? localStorage.setItem(LSK, k) : localStorage.removeItem(LSK); } catch (e) {} }

/* ---------- laikas ---------- */
const hm = (s) => { if (!s) return null; const m = String(s).match(/(\d{1,2})[:.](\d{2})/); if (!m) return null; return (Number(m[1]) - 6) * 60 + Number(m[2]); };
const fmt = (x) => { const m = Math.round(x); const h = 6 + Math.floor(m / 60), mm = ((m % 60) + 60) % 60; return String(h).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); };
const WD = ['sekmadienis', 'pirmadienis', 'antradienis', 'trečiadienis', 'ketvirtadienis', 'penktadienis', 'šeštadienis'];
const wd = (d) => { const t = new Date(d + 'T12:00:00'); return isNaN(t) ? '' : WD[t.getDay()]; };
const isWork = (d) => { const t = new Date(d + 'T12:00:00'); return !isNaN(t) && t.getDay() > 0 && t.getDay() < 6; };
const nr = (n) => (n % 10 === 1 && n % 100 !== 11) ? 'reisas' : (n % 10 >= 2 && (n % 100 < 10 || n % 100 > 20)) ? 'reisai' : 'reisų';
const bvGen = (n) => (n % 10 === 1 && n % 100 !== 11) ? 'betonvežio' : 'betonvežių';
const m3 = (x) => (Math.round(x * 10) / 10).toString().replace('.', ',') + ' m³';

/* ---------- savybės ---------- */
function normProps(list) {
  const out = [];
  const txt = (list || []).join(' ').toUpperCase().replace(/\(LT\)/g, '');
  const c = txt.match(/C?\s?(\d{1,2})\s?\/\s?(\d{1,2}(?:[.,]5)?)/);
  if (c) out.push('C' + c[1] + '/' + c[2].replace('.', ','));
  (txt.match(/X(?:0|C[0-4]|D[1-3]|S[1-3]|F[1-4]|A[1-3]|M[1-3]|R[1-3])(?![0-9])/g) || []).forEach((x) => { x = x === 'XC0' ? 'X0' : x; if (!out.includes(x)) out.push(x); });
  (txt.match(/(?<![A-Z])F(75|100|150|200|300)(?![0-9])/g) || []).forEach((x) => { if (!out.includes(x)) out.push(x); });
  (txt.match(/(?<![A-Z])W(\d{1,2})(?![0-9])/g) || []).forEach((x) => { if (!out.includes(x)) out.push(x); });
  return out;
}
// Aplinkos klasės: aukštesnė tos pačios grupės klasė tenkina žemesnę (XC4 ⊇ XC3 ⊇ XC2 ⊇ XC1, XD3 ⊇ XD2…, XF, XA, XS, XM).
const covers = (have, want) => { const a = /^X([CDSFAM])(\d)$/.exec(have), b = /^X([CDSFAM])(\d)$/.exec(want); return !!(a && b && a[1] === b[1] && Number(a[2]) >= Number(b[2])); };
function classify(r, req) {
  const reqX = req.some((x) => /^X[A-Z]/.test(x));
  const miss = req.filter((x) => !r.props.includes(x) && !r.props.some((h) => covers(h, x))), extra = r.props.filter((x) => !req.includes(x) && x !== 'X0' && !(!reqX && /^XC\d/.test(x)));
  return { miss, extra, kind: miss.length ? 'miss' : extra.length ? 'extra' : 'fit' };
}
function recipeOptions(o) {
  const req = normProps(o.props && o.props.length ? o.props : [o.asked || '']);
  const pool = RECIPES.filter((r) => r.active && r.kind === 'betonas');
  const at = pool.filter((r) => r.plant === o.plant).map((r) => Object.assign({ r }, classify(r, req)));
  const wantS = o.slump || (o.pump && o.pump.need ? 'S4' : null);
  const used = DBX() && o.client ? window.BPDB.usedCodes(o.client) : new Set();
  const sc = (x) => (wantS && x.r.slump === wantS ? 0 : wantS ? 1 : 0) * 1000 + (o.dmax && x.r.dmax !== o.dmax ? 500 : 0) - (used.has(String(x.r.code).toUpperCase()) ? 300 : 0) + x.r.price;
  const fit = at.filter((x) => x.kind === 'fit').sort((a, b) => sc(a) - sc(b));
  const extra = at.filter((x) => x.kind === 'extra' && x.miss.length === 0).sort((a, b) => a.extra.length - b.extra.length || sc(a) - sc(b)).slice(0, 4);
  const elsewhere = req.length > 1 && !fit.length ? pool.filter((r) => r.plant !== o.plant && classify(r, req).kind === 'fit') : [];
  // istorija: pirmiausia tas pats objektas (paskutinis), tada klientas (dažniausias); receptas turi turėti visas prašytas savybes
  let hist = null;
  if (DBX() && o.client && req.length) {
    const byCode = (code, why) => { const r = at.find((x) => String(x.r.code).toUpperCase() === String(code).toUpperCase() && !x.miss.length && (!wantS || !o.slump || x.r.slump === o.slump)); return r ? Object.assign({}, r, { why }) : null; };
    const same = window.BPDB.sameAddress(o.client, (o.address || '') + ' ' + (o.object || ''));
    for (let k = same.length - 1; k >= 0 && !hist; k--) hist = byCode(same[k].code, 'obj');
    // kodas pirmiausia: į tą patį objektą dažniausiai vežtas receptas tos pačios stiprumo klasės (net jei receptų DB savybės skiriasi)
    if (!hist && same.length) {
      const cnt = {}; same.forEach((x) => { const c = String(x.code).toUpperCase(); cnt[c] = (cnt[c] || 0) + 1; });
      const cls = req.find((x) => /^C\d/.test(x));
      Object.entries(cnt).sort((a, b) => b[1] - a[1]).some(([c, n]) => { const r = at.find((x) => String(x.r.code).toUpperCase() === c && (!cls || x.r.props.includes(cls)) && (!o.slump || !x.r.slump || x.r.slump === o.slump)); if (r) { const prod = (same.find((x) => String(x.code).toUpperCase() === c) || {}).product || ''; hist = Object.assign({}, r, { why: 'obj', n, dbDiff: r.miss.length ? 'receptų DB: ' + r.r.props.join(' ') + ' · BetonPro produkte: ' + prod.split(' - ').slice(-1)[0] : '' }); } return !!r; });
    }
    if (!hist) { const sm = window.BPDB.summary(o.client); if (sm) sm.codes.slice().sort((a, b) => b.n - a.n).some((c) => (hist = byCode(c.code, 'cl'))); }
  }
  return { req, fit, extra, elsewhere, wantS, used, hist };
}

/* ---------- talpos modelis ---------- */
function interval(o) { if (o.interval) return Math.max(8, Number(o.interval)); return Math.round(UNL * TRIP); }
const kmMin = (km) => Math.max(10, Math.round(Number(km) / 50 * 60)); // kelionė vienos krypties, min (50 km/h)
// Reisas: pasikrovimas 30 min + kelionė + išsikrovimas 5 min/m³ + grįžimas. Betonvežiai atvyksta vienas po kito (kai baigia iškrauti ankstesnis), nebent nurodytas intervalas.
function simTrips(o, plant, Sm, oid) {
  const Q = Number(o.qty) || 0, n = Math.max(1, Math.ceil(Q / TRIP - 1e-9)), T = Number(o.travel) || 40, out = [];
  const self = o.mode === 'savivartis';
  let arr = Sm;
  for (let k = 0; k < n; k++) {
    const q = Math.min(TRIP, Q - k * TRIP), un = Math.round(UNL * q);
    if (k) arr += o.interval ? Math.max(8, Number(o.interval)) : Math.round(UNL * Math.min(TRIP, Q - (k - 1) * TRIP));
    if (self) out.push([plant, oid, 0, '', arr - LOAD, arr, arr, q]);
    else out.push([plant, oid, 1, '', arr - T - LOAD, arr, arr + un + T, q]);
  }
  const lq = out[n - 1][7], la = out[n - 1][5], done = la + Math.round(UNL * lq);
  return { trips: out, n, ls: out[0][4], end: self ? la : done + T, last: la, done, U: n > 1 ? out[1][5] - out[0][5] : Math.round(UNL * lq), T, self };
}
function agg(trips) {
  const r = { tm: { R: new Array(DAY).fill(0), S: new Array(DAY).fill(0), B: new Array(DAY).fill(0) }, pl: { R: new Array(24).fill(0), S: new Array(24).fill(0), B: new Array(24).fill(0) }, pumps: [] };
  trips.forEach((t) => {
    const p = t[0]; if (!r.tm[p]) return;
    if (t[2]) for (let m = Math.max(0, Math.floor(t[4])); m < Math.min(DAY, Math.ceil(t[6])); m++) r.tm[p][m]++;
    const b = Math.floor(t[4] / 30); if (b >= 0 && b < 24) r.pl[p][b] += t[7];
  });
  return r;
}
function pumpBlocks(date, excludeOid) {
  const out = [];
  if (S.bg && !useDb() && isWork(date)) {
    const g = {};
    BASE.forEach((t) => { if (!t[3]) return; const k = t[3] + '|' + t[1]; const o = g[k] || (g[k] = { pump: BCODE[t[3]] || t[3], a: 1e9, e: -1e9, who: 'fonas #' + t[1] }); o.a = Math.min(o.a, t[5] - 30); o.e = Math.max(o.e, t[5] + 20); });
    Object.values(g).forEach((x) => out.push(x));
  }
  Object.entries(S.appr).forEach(([lid, a]) => (a.orders || []).forEach((o, i) => {
    if (o.date !== date || !o.pumpId || (lid + ':' + i) === excludeOid) return;
    out.push({ pump: o.pumpId, a: o.S - 30, e: o.lastArr + 20, who: o.client });
  }));
  return out;
}
function useDb() { return DBX() && S.bgSrc !== 'tpl'; }
function apprKeys(date) { const ks = new Set(); Object.values(S.appr).forEach((a) => (a.orders || []).forEach((o) => { if (o.date === date) window.BPDB.keys(o.client).forEach((k) => ks.add(k)); })); return ks; }
function dayTrips(date, excludeOid, exClient) {
  const t = [];
  if (S.bg && useDb()) { const ex = apprKeys(date); if (exClient) window.BPDB.keys(exClient).forEach((k) => ex.add(k)); window.BPDB.dayTrips(date, LOAD).forEach((x) => { if (!ex.has(x[8])) t.push(x); }); }
  else if (S.bg && isWork(date)) BASE.forEach((x) => t.push(x));
  Object.entries(S.appr).forEach(([lid, a]) => (a.orders || []).forEach((o, i) => { if (o.date === date && (lid + ':' + i) !== excludeOid && o.trips) o.trips.forEach((x) => t.push(x)); }));
  return t;
}
function check(o, plant, Sm, hire, oid) {
  const base = agg(dayTrips(o.date, oid, o.client)), s = simTrips(o, plant, Sm, oid), nt = agg(s.trips);
  let mx = 0; for (let m = 0; m < DAY; m++) mx = Math.max(mx, base.tm[plant][m] + nt.tm[plant][m]);
  const lim = (S.fleet[plant] || 0) + (hire || 0), short = s.self ? 0 : Math.max(0, mx - lim);
  const over = nt.pl[plant].some((v, i) => v > 0 && base.pl[plant][i] + v > PCAP);
  let pumpId = null, pumpConf = false;
  if (o.pump && o.pump.need && !s.self) {
    const want = Number(o.pump.len) || 0, blocks = pumpBlocks(o.date, oid), a = Sm - 30, e = s.last + 20;
    const cand = PUMPS.filter((p) => p.len >= want - 1);
    const free = cand.find((p) => !blocks.some((b) => b.pump === p.id && b.a < e && b.e > a));
    if (free) pumpId = free.id; else pumpConf = true;
  }
  const late = s.end > DAY - 10 || s.ls < 0;
  const why = [];
  if (short) why.push('trūksta ' + short + ' ' + bvGen(short));
  if (over) why.push('mazgas perkrautas');
  if (pumpConf) why.push('nėra laisvo siurblio');
  if (late) why.push(s.ls < 0 ? 'per anksti krauti' : 'baigtųsi po 18:00');
  return { ok: !short && !over && !pumpConf && !late, short, over, pumpConf, late, mx, lim, s, nt, base, why, pumpId, Sm, hire: hire || 0 };
}
function capOptions(o, oid) {
  if (!o.date || !o.plant || !(Number(o.qty) > 0)) return null;
  const S0 = hm(o.time) != null ? hm(o.time) : 120;
  const req = check(o, o.plant, S0, 0, oid), opts = [Object.assign(req, { kind: 'req' })];
  if (!req.ok) {
    const c = [];
    for (let Sm = 30; Sm <= DAY - 60; Sm += 15) { if (Sm === S0) continue; const r = check(o, o.plant, Sm, 0, oid); if (r.ok) c.push(Object.assign(r, { kind: 'alt', d: Math.abs(Sm - S0) })); }
    c.sort((a, b) => a.d - b.d); c.slice(0, 3).sort((a, b) => a.Sm - b.Sm).forEach((x) => opts.push(x));
    if (req.short && req.short <= 3 && !req.over && !req.pumpConf && !req.late) opts.push(Object.assign(check(o, o.plant, S0, req.short, oid), { kind: 'hire' }));
  }
  let def = 0; if (!req.ok) { const i = opts.findIndex((x) => x.ok && x.kind === 'alt'); def = i > 0 ? i : opts.findIndex((x) => x.ok); if (def < 0) def = 0; }
  return { S0, opts, def };
}

/* ---------- B3c forma: ar galime priimti (tikri BetonPro duomenys) ---------- */
const B3N = { 12: 'Vilnius', 13: 'Stašėnai', 11: 'Runeikiai', 14: 'Baisogala' };
const B3C = { 13: '#3A4652', 14: '#B9BEC4', 11: '#7D97B8', 12: '#A88F5E' };
const B3AP = '#6B7480';
const B3P = { R: 11, S: 13, B: 14 };
const TRF = 140, B3W = 100, B3LG = 56, B3H = 220, NS = 36;
const WIN = { rytas: [60, 300, 'rytas'], pirma_puse: [60, 360, 'pirma dienos pusė'], antra_puse: [360, 660, 'antra dienos pusė'], vakaras: [540, 720, 'vakaras'] };
const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const sp = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const pad36 = (a) => { const o = new Array(NS).fill(0); (a || []).forEach((v, i) => { if (i < NS) o[i] = v; }); return o; };
function ptypeOf(len) { len = Number(len) || 28; return len <= 29 ? 'PUMI 28' : len <= 36 ? 'PUMP 36' : 'PUMP 42'; }
function b3need(o, plant, Sabs) {
  if (o.mode === 'savivartis') return new Array(NS).fill(0);
  const s = simTrips(o, plant, Sabs - 360, 'x'), out = new Array(NS).fill(0);
  s.trips.forEach((t) => { const a = t[4] + 360, e = t[6] + 360; for (let i = 0; i < NS; i++) { const x = 360 + 30 * i; if (a < x + 30 && x < e) out[i]++; } });
  return out;
}
function b3hire(BT, nn, own2) {
  const hh = BT.map((v, i) => Math.max(0, v + nn[i] - own2)), n = Math.max(0, ...hh), lv = [];
  for (let k = 1; k <= n; k++) { const idx = hh.map((v, i) => v >= k ? i : -1).filter((i) => i >= 0); const hrs = Math.ceil((idx[idx.length - 1] - idx[0] + 1) / 2); lv.push({ a: idx[0], b: idx[idx.length - 1], hrs, c: 200 + 60 * hrs }); }
  return { hh, lv, n, cost: lv.reduce((s, x) => s + x.c, 0) };
}
function b3trf(BT, nn, own1, own2) { let t = 0; BT.forEach((v, i) => { t = Math.max(t, Math.min(Math.max(0, v + nn[i] - own1), own2 - own1)); }); return t; }
// Diena: BetonPro duomenys + čia patvirtinti užsakymai (išskyrus nagrinėjamą); ateities dienai – prognozė.
function b3data(date, exOid) {
  const B = window.BPDB, D0 = B.b3day(date); if (!D0) return null;
  const D = { date, c3: D0.c3, own: Object.assign({}, D0.own), trips: Object.assign({}, D0.trips), slots: {}, ap: {}, apTrips: {}, pumps: D0.pumps.slice(), forecast: D0.forecast, typN: 0 };
  B.B3PADS.forEach((p) => { D.slots[p] = pad36(D0.slots[p]); D.ap[p] = new Array(NS).fill(0); D.apTrips[p] = 0; });
  if (D0.forecast && B.b3typical) { const T = B.b3typical(); if (T) { D.own = Object.assign({}, T.own); D.typN = T.n; } }
  Object.entries(S.appr).forEach(([lid, a]) => (a.orders || []).forEach((o) => {
    if (o.date !== date || o.action === 'atsaukti' || (lid + ':' + (o._i != null ? o._i : -1)) === exOid) return;
    const p = B3P[o.plant]; if (!p) return;
    const nn = b3need(o, o.plant, (o.S || 0) + 360); nn.forEach((v, i) => { D.ap[p][i] += v; }); D.apTrips[p] += (o.trips || []).length;
    if (o.pump && o.pump.need && o.mode !== 'savivartis') { const f = pumpFleetMap().get(o.pumpCar || ''); D.pumps.push({ car: !o.pumpCar || o.pumpCar === 'samdomas' ? 'samdomas·' + lid + ':' + o._i : o.pumpCar, hired: !f, type: f ? f.type : ptypeOf(o.pump.len), owner: f ? f.owner : '', c3: f ? f.c3 : false, pad: p, client: 'Patvirt. · ' + (o.client || ''), s: (o.S || 0) + 360, e: (o.pumpEnd != null ? o.pumpEnd : (o.lastArr || o.S || 0) + 40) + 360, ap: true }); }
  }));
  return D;
}
function b3calc(D, view, nn) {
  const pads = view === 'V' ? window.BPDB.B3PADS : [Number(view)];
  const BT = new Array(NS).fill(0); pads.forEach((p) => { D.slots[p].forEach((v, i) => { BT[i] += v + D.ap[p][i]; }); });
  const own2 = D.c3, own1 = view === 'V' ? own2 : (D.own[view] || 0);
  const H = b3hire(BT, nn, own2), T = b3trf(BT, nn, own1, own2);
  return { pads, BT, own1, own2, H, T, cost: H.cost + T * TRF };
}
/* Siurbliai. Klientui išrašoma siurblio kaina (atvykimas + darbo val.), prastovos – ne. Mūsų kaštai:
   samdomas siurblys – 200 € atvykimas; bet kuris siurblys – prastova iki kito jo užsakymo (60 €/val.).
   Tarp dviejų užsakymų siurblys pervažiuoja per 60 min; tarpas > 4 val. – grįžta į bazę (prastovos nėra). */
const PHIRE = 200, PIDLE = 60, PTRV = 60, PGAP = 240;
let PF = null;
let PFA = null;
function pumpFleetAll() { if (!PFA && DBX() && window.BPDB.pumpFleet) { PFA = new Map(); window.BPDB.pumpFleet().forEach((p) => PFA.set(p.car, p)); } return PFA || new Map(); }
function pumpFleetMap() { if (!PF && DBX() && window.BPDB.pumpFleet) { PF = new Map(); window.BPDB.pumpFleet().filter((p) => p.c3).forEach((p) => PF.set(p.car, p)); } return PF || new Map(); } // tik C3 siurbliai (transporto DB)
const sameKind = (type, ptype) => /PUMI/.test(ptype) ? /pumi/i.test(type) : !/pumi/i.test(type) && (!/42/.test(ptype) || /42/.test(type));
function pumpRows(D) {
  const rows = new Map();
  D.pumps.forEach((p) => { const k = p.car; (rows.get(k) || rows.set(k, { car: p.car, type: p.type, owner: p.owner, c3: p.c3, len: (pumpFleetAll().get(p.car) || {}).len || 0, hired: !!p.hired || /^samdomas/.test(p.car), jobs: [] }).get(k)).jobs.push({ a: p.s, b: p.e, pad: p.pad, client: p.client, ap: p.ap }); });
  pumpFleetMap().forEach((f) => { if (!rows.has(f.car)) rows.set(f.car, { car: f.car, type: f.type, owner: f.owner, c3: f.c3, len: f.len, jobs: [], idleFleet: true }); });
  return rows;
}
function idleOf(jobs) { let t = 0; const j = jobs.slice().sort((x, y) => x.a - y.a); for (let k = 1; k < j.length; k++) { const g = j[k].a - j[k - 1].b - PTRV; if (g > 0 && g <= PGAP) t += g; } return t; }
function pumpJob(o, Sabs, s) { return { a: Sabs, b: s.done + 360 + 30 }; } // nuo pirmo betonvežio iki paskutinio iškrovimo + 30 min plovimas
function pumpPick(D, o, Sabs, s, force) {
  if (!(o.pump && o.pump.need) || o.mode === 'savivartis') return null;
  const ptype = ptypeOf(o.pump.len), nj = pumpJob(o, Sabs, s);
  let best = null, forced = null;
  pumpRows(D).forEach((r) => {
    const hired = r.hired, isF = force && r.car === force;
    // kandidatai automatiškai – C3 siurbliai ir tą dieną jau samdyti to paties tipo; vadybininkas tempdamas gali parinkti bet kurį
    if (!isF && (hired ? ptLab(r.type) !== ptype : (!r.c3 || !sameKind(r.type, ptype)))) return;
    if (!r.jobs.every((j) => nj.b + PTRV <= j.a || nj.a - PTRV >= j.b)) return;
    const idle = Math.max(0, idleOf(r.jobs.concat([nj])) - idleOf(r.jobs)), other = !r.c3 && !hired, cost = Math.round(idle / 60 * PIDLE) + (other ? PHIRE : 0);
    const c = { car: r.car, type: r.type, owner: r.owner, c3: r.c3, own: !hired && !other, reuse: hired, other, idle, cost, busy: r.jobs.length };
    if (isF) { forced = c; return; }
    if (!best || c.cost < best.cost || (c.cost === best.cost && (c.busy > 0) - (best.busy > 0) > 0) || (c.cost === best.cost && (c.busy > 0) === (best.busy > 0) && c.c3 && !best.c3)) best = c;
  });
  if (force === 'samdomas') forced = { car: 'samdomas', type: ptype, own: false, idle: 0, cost: PHIRE };
  return Object.assign(forced || best || { car: 'samdomas', type: ptype, own: false, idle: 0, cost: PHIRE }, { job: nj, ptype, forced: !!forced, forceFail: !!force && !forced });
}
const hrs1 = (m) => String(Math.round(m / 6) / 10).replace('.', ',');
const plen = (type) => /42/.test(type || '') ? 42 : /36/.test(type || '') ? 36 : /pump/i.test(type || '') ? 36 : 28;
const ptLab = (type) => /PUM[IP] \d/.test(type || '') ? type : /pumi/i.test(type || '') ? 'PUMI 28' : /42/.test(type || '') ? 'PUMP 42' : 'PUMP 36';
function pumpTxt(pp) { return !pp ? '' : pp.other ? pp.car + ' (' + (pp.owner || 'kita įmonė') + ') · +' + PHIRE + ' €' : pp.own ? pp.car + (pp.idle ? ' · prastova ' + hrs1(pp.idle) + ' val.' : '') : pp.reuse ? 'jau samdytas ' + pp.ptype + (pp.idle ? ' · prastova ' + hrs1(pp.idle) + ' val.' : '') : 'samdomas ' + pp.ptype + ' +' + PHIRE + ' €'; }
// Laiko planas: variantai, rekomendacija, pasirinkimas. Naudoja ir forma, ir atsakymas, ir tvirtinimas.
function b3plan(o, oid) {
  const B = window.BPDB; if (!B || !B.ready || !B.b3day || !o.date || !o.plant || !(Number(o.qty) > 0)) return null;
  const D = b3data(o.date, oid); if (!D) return null;
  const plant = o.plant, pad = B3P[plant] || 13;
  const win = o.win && WIN[o.win] ? WIN[o.win] : null;
  const reqAbs = hm(o.time) != null ? hm(o.time) + 360 : win ? win[0] + 360 : 480;
  let times = [420, 480, 540, 600, 660, 720, 780, 840, 900, 960];
  if (win) times = times.filter((m) => m >= win[0] + 360 && m <= win[1] + 360);
  times = Array.from(new Set(times.concat([reqAbs]))).filter((m) => m >= 360 && m <= 1080).sort((a, b) => a - b);
  const st = (S.b3 = S.b3 || {})[oid] = S.b3[oid] || {};
  if (st.t && st.t >= 360 && st.t <= 1080 && !times.includes(st.t)) times = times.concat([st.t]).sort((a, b) => a - b);
  const view = st.v || String(pad), newHere = view === 'V' || Number(view) === pad;
  const T = Number(o.travel) || 40, self = o.mode === 'savivartis';
  const feas = (m) => (self ? m - LOAD : m - T - LOAD) >= 360;
  const Z = new Array(NS).fill(0), baseV = b3calc(D, String(pad), Z);
  const res = times.map((m) => {
    const nn = b3need(o, plant, m), own = b3calc(D, String(pad), nn), shown = view === String(pad) ? own : b3calc(D, view, newHere ? nn : Z);
    const pp = pumpPick(D, o, m, simTrips(o, plant, m - 360, 'x'), st.pc), pc = pp ? pp.cost : 0;
    return Object.assign(shown, { m, nn, pp, tcost: shown.cost, cost: shown.cost + (newHere ? pc : 0), ownCost: own.cost + pc, add: own.cost - baseV.cost + pc, ok: feas(m) });
  });
  // rekomendacija: artimiausias galimas prašomam laikui; kitas – tik jei sutaupo > 200 € ir ne toliau ±2 val.; lange – pigiausias, tada ankstyviausias
  const okr = res.filter((r) => r.ok); let best = null;
  if (okr.length) {
    if (win) { const iw = okr.filter((r) => r.m >= win[0] + 360 && r.m <= win[1] + 360); best = (iw.length ? iw : okr).slice().sort((a, b) => a.add - b.add || a.m - b.m)[0]; }
    else {
      const near = okr.slice().sort((a, b) => Math.abs(a.m - reqAbs) - Math.abs(b.m - reqAbs) || a.m - b.m)[0];
      const alt = okr.filter((r) => Math.abs(r.m - reqAbs) <= 120 && near.add - r.add > 200).sort((a, b) => a.add - b.add)[0];
      best = alt || near;
    }
  }
  const bestM = best ? best.m : reqAbs;
  const sel = st.t && times.includes(st.t) ? st.t : bestM, cur = res.find((r) => r.m === sel) || res[0];
  const s = simTrips(o, plant, sel - 360, 'x');
  return { D, plant, pad, win, reqAbs, times, view, newHere, res, best: bestM, sel, cur, s, pp: cur.pp, ok: cur.ok, why: cur.ok ? [] : ['per anksti krauti (mazgas pradeda 06:00, pasikrovimas 30 min + kelionė ' + T + ' min)'] };
}
function b3pumps(D, o, Sabs, s, HZ, pp, i) {
  const END = 360 + HZ * 30, rows = pumpRows(D), ptype = o.pump && o.pump.need ? ptypeOf(o.pump.len) : null;
  const nj = pp ? Object.assign({}, pp.job, { pad: B3P[o.plant] || 13, client: 'Naujas · ' + (o.client || ''), nw: true }) : null;
  const span = HZ * 30, X = (m) => ((Math.max(360, Math.min(END, m)) - 360) / span * B3W).toFixed(2), W = (a, b) => (Math.max(0, Math.min(END, b) - Math.max(360, a)) / span * B3W).toFixed(2);
  let conflict = false;
  const rowLen = {}, rowOwn = {}; rows.forEach((r) => { rowLen[r.car] = r.len || plen(r.type); rowOwn[r.car] = r.hired ? 'samdomas' : r.c3 ? 'C3' : (r.owner || 'kita įmonė'); }); if (ptype) { rowLen.samdomas = plen(ptype); rowOwn.samdomas = 'samdomas'; }
  const row = (key, l1, l2, jobs, hasNew, okKind) => {
    jobs = jobs.slice().sort((a, b) => a.a - b.a);
    let r = `<div class="b3pr${hasNew ? ' nwr' : ''}${okKind ? '' : ' oth'}" data-car="${esc(key)}" data-len="${esc(String(rowLen[key] || ''))}" data-own="${esc(rowOwn[key] || '')}"><span class="b3pl" title="${esc(l1 + ' · ' + l2)}"><b>${esc(l1)}</b><span>${esc(l2)}</span></span><div class="b3pt">`;
    jobs.forEach((j, k) => {
      const pv = jobs[k - 1], nx = jobs[k + 1];
      if (!pv || j.a - pv.b > PTRV + PGAP) r += `<i class="b3tv" style="left:${X(j.a - 60)}%;width:${W(j.a - 60, j.a)}%"></i>`;
      if (!nx || nx.a - j.b > PTRV + PGAP) r += `<i class="b3tv" style="left:${X(j.b)}%;width:${W(j.b, j.b + 60)}%"></i>`;
      else if (nx.a - j.b > PTRV) { r += `<i class="b3tv" style="left:${X(j.b)}%;width:${W(j.b, j.b + 60)}%"></i><i class="b3idle${(j.nw || nx.nw) ? ' nw' : ''}" style="left:${X(j.b + 60)}%;width:${W(j.b + 60, nx.a)}%" title="prastova ${hrs1(nx.a - j.b - 60)} val."></i>`; }
      const nm = String(j.client || '').replace(/^Patvirt\. · /, ''), lab = (j.nw ? 'Naujas' : j.ap ? 'Patvirt. · ' + nm : nm) + ' · ' + hhmm(j.a) + '–' + hhmm(j.b);
      if (j.b > 360 && j.a < END) r += `<span class="b3job${j.nw ? ' nw' : ''}${j.ap ? ' ap' : ''}" ${j.nw ? `data-drag="${i}"` : ''} style="left:${X(j.a)}%;width:${W(j.a, j.b)}%;${j.nw ? '' : '--c:' + (B3C[j.pad] || '#9AA0A7')};color:${j.nw || j.pad === 14 ? '#15171A' : '#fff'}" title="${esc(lab)}${j.nw ? ' – tempkite: į šonus – laikas, aukštyn / žemyn – kitas siurblys' : ''}">${esc(lab)}</span>`;
      if (nx && j.b + PTRV > nx.a) { r += `<i class="b3cf" style="left:${X(nx.a)}%;width:${W(nx.a, j.b + PTRV)}%"></i>`; if (j.nw || nx.nw) conflict = true; }
    });
    return r + '</div></div>';
  };
  const lab1 = (r) => ptLab(r.type) + ' · ' + (r.hired ? 'samdomas' : r.car);
  const lab2 = (r, mine) => (r.hired ? 'samdomas' : r.c3 ? 'C3' : (r.owner || 'kitas')) + ' · ' + (r.len || plen(r.type)) + ' m' + (mine && pp.idle ? ' · prastova ' + hrs1(pp.idle) + ' val.' : '') + (mine && !r.hired && !pp.idle ? ' · be prastovos' : '');
  let h = '', list = Array.from(rows.values()).filter((r) => r.jobs.length || (pp && r.car === pp.car));
  list.sort((x, y) => (x.hired - y.hired) || (y.c3 - x.c3) || x.car.localeCompare(y.car)).forEach((r) => { const mine = pp && r.car === pp.car; h += row(r.car, lab1(r), lab2(r, mine), mine ? r.jobs.concat([nj]) : r.jobs, mine, !ptype || (r.hired ? ptLab(r.type) === ptype : r.c3 && sameKind(r.type, ptype))); });
  const free = Array.from(rows.values()).filter((r) => r.c3 && !r.jobs.length && !r.hired && !(pp && r.car === pp.car));
  free.forEach((r) => { h += row(r.car, lab1(r), lab2(r) + ' · laisvas', [], false, !!(ptype && sameKind(r.type, ptype))); });
  if (pp && pp.car === 'samdomas') h += row('samdomas', pp.ptype + ' · samdomas', 'samdomas · ' + plen(pp.ptype) + ' m · +' + PHIRE + ' € atvykimas', [nj], true, true);
  else if (pp) h += row('samdomas', (ptype || '') + ' · samdomas', 'naujas samdomas · +' + PHIRE + ' € (tempkite čia)', [], false, true);
  if (!h) return { html: '<span class="muted" style="font-size:12px">Šią dieną siurbliai nedirba.</span>', car: null };
  const hl = []; for (let hh = 6; hh <= 6 + HZ / 2; hh += 2) hl.push(hh);
  h += `<div class="b3pr ax"><span class="b3pl"></span><div class="b3axis">${hl.map((x) => `<span style="left:${((x - 6) / (HZ / 2) * 100).toFixed(2)}%">${String(x % 24).padStart(2, '0')}</span>`).join('')}</div></div>`;
  if (conflict) h += `<div class="warn" style="font-size:12.5px">Naujas užsakymas persidengia su kitu šio siurblio darbu (raudona) – reikės kito siurblio arba kito laiko.</div>`;
  if (pp && pp.forceFail) h += `<div class="warn" style="font-size:12.5px">Pasirinktas siurblys šiuo laiku užimtas – parinktas kitas.</div>`;
  return { html: `<div class="b3pumps" data-i="${i}" data-hz="${HZ}">${h}</div>`, car: pp ? pp.car : null };
}
function b3chart(C, nn, tag, reqAbs, selAbs, newHere, D, HZ, win, DI) {
  const MX = Math.max(12, Math.max(...C.BT.slice(0, HZ).map((v, i) => v + nn[i])) + 4), y = (v) => v / MX * B3H, bw = B3W / HZ;
  const span = HZ * 30, X = (m) => ((m - 360) / span * B3W).toFixed(2);
  let bars = '';
  const env = new Array(NS).fill(0); C.H.lv.forEach((l) => { for (let i = l.a; i <= l.b; i++) env[i]++; });
  env.slice(0, HZ).forEach((v, i) => { if (v) bars += `<i class="b3env" style="left:${(i * bw).toFixed(2)}%;width:${bw.toFixed(2)}%;bottom:${y(C.own2).toFixed(1)}px;height:${y(v).toFixed(1)}px"></i>`; });
  if (C.own2 > C.own1) bars += `<i class="b3band" style="bottom:${y(C.own1).toFixed(1)}px;height:${(y(C.own2) - y(C.own1)).toFixed(1)}px"></i>`;
  for (let i = 0; i < HZ; i++) {
    let yb = 0;
    C.pads.forEach((p) => { const v = D.slots[p][i]; if (v) { bars += `<i class="b3b" style="left:calc(${(i * bw).toFixed(2)}% + 1px);width:calc(${bw.toFixed(2)}% - 2px);bottom:${y(yb).toFixed(1)}px;height:${y(v).toFixed(1)}px;background:${B3C[p]}"></i>`; yb += v; } });
    C.pads.forEach((p) => { const v = D.ap[p][i]; if (v) { bars += `<i class="b3b ap" title="patvirtinta čia · ${B3N[p]}" style="--c:${B3C[p]};left:calc(${(i * bw).toFixed(2)}% + 1px);width:calc(${bw.toFixed(2)}% - 2px);bottom:${y(yb).toFixed(1)}px;height:${y(v).toFixed(1)}px"></i>`; yb += v; } });
    if (nn[i]) bars += `<i class="b3b nw" data-drag="${DI}" title="Naujas užsakymas – tempkite, kad pakeistumėte laiką" style="left:calc(${(i * bw).toFixed(2)}% + 1px);width:calc(${bw.toFixed(2)}% - 2px);bottom:${y(yb).toFixed(1)}px;height:${y(nn[i]).toFixed(1)}px"></i>`;
  }
  bars += `<i class="b3l" style="bottom:${y(C.own1).toFixed(1)}px"></i><span class="b3lt" style="top:${(B3H - y(C.own1) + 4).toFixed(1)}px">mazgo ${C.own1}</span>`;
  if (C.own2 > C.own1) bars += `<i class="b3l d" style="bottom:${y(C.own2).toFixed(1)}px"></i><span class="b3lt" style="bottom:${(y(C.own2) + 3).toFixed(1)}px">+ pervaž. iš kitų mazgų iki ${C.own2}</span>`;
  if (newHere) {
    if (win) bars += `<i class="b3win" style="left:${X(win[0] + 360)}%;width:${((win[1] - win[0]) / span * B3W).toFixed(2)}%"></i><span class="b3mt w" style="left:${X(win[0] + 360)}%">klientas: ${esc(win[2])}</span>`;
    else bars += `<i class="b3m r" style="left:${X(reqAbs)}%"></i><span class="b3mt r" style="left:${X(reqAbs)}%">${hhmm(reqAbs)} klientas</span>`;
    if (selAbs !== reqAbs || win) bars += `<i class="b3m" style="left:${X(selAbs)}%"></i><span class="b3mt${!win && Math.abs(selAbs - reqAbs) < 120 ? ' lo' : ''}" style="left:${X(selAbs)}%">${hhmm(selAbs)}</span>`;
  }
  let ax = ''; for (let v = 0; v <= MX; v += 5) ax += `<span style="bottom:${(y(v) - 6).toFixed(1)}px">${v}</span>`;
  ax += `<span class="g" style="bottom:${(y(C.own1) - 6).toFixed(1)}px">${C.own1}</span>`; if (C.own2 > C.own1) ax += `<span class="g" style="bottom:${(y(C.own2) - 6).toFixed(1)}px">${C.own2}</span>`;
  const costs = C.H.lv.map((l) => l.c).sort((a, b) => b - a), cum = [0];
  for (let k = 1; k <= MX - C.own1; k++) cum.push(cum[k - 1] + (C.own1 + k <= C.own2 ? TRF : (costs[k - (C.own2 - C.own1) - 1] || 320)));
  const used = C.T + C.H.n, step = Math.max(1, Math.ceil(14 / y(1)));
  let rs = `<i class="b3ra" style="bottom:${y(C.own1).toFixed(1)}px"></i>`;
  for (let k = 0; k <= MX - C.own1; k += step) rs += `<span class="${k <= used ? 'u' : ''}${k === used && used ? ' b' : ''}" style="bottom:${(y(C.own1 + k) - 6).toFixed(1)}px">${sp(cum[k])} €</span>`;
  if (used && used % step && used <= MX - C.own1) rs += `<span class="u b" style="bottom:${(y(C.own1 + used) - 6).toFixed(1)}px;background:#fff">${sp(cum[used])} €</span>`;
  const tagt = [C.T ? 'perv. +' + C.T : '', C.H.n ? 'samd. +' + C.H.n : ''].filter(Boolean).join('<br>');
  if (tagt) rs += `<span class="tg" style="top:${(B3H - y(C.own1) + 4).toFixed(1)}px">${tagt}</span>`;
  const hl = []; for (let h = 6; h <= 6 + HZ / 2; h += 2) hl.push(h);
  return `<div class="b3c-t"><span class="eb muted">${tag}</span></div>
    <div class="b3c-hd"><span>betonvežiai, vnt.<br>↓</span><span class="o">papildoma<br>kaina, € ↓</span></div>
    <div class="b3c-ch"><div class="b3ax" style="height:${B3H}px">${ax}</div><div class="b3pl2" data-i="${DI}" data-hz="${HZ}" style="height:${B3H}px">${bars}</div><div class="b3rs" style="height:${B3H}px">${rs}</div></div>
    <div class="b3axrow"><i></i><div class="b3axis">${hl.map((h) => `<span style="left:${((h - 6) / (HZ / 2) * 100).toFixed(2)}%">${String(h % 24).padStart(2, '0')}</span>`).join('')}</div><i></i></div>`;
}
function b3scroll() { $$('.b3opts').forEach((el) => { const p = el.querySelector('[aria-pressed="true"]'); if (p) el.scrollLeft = Math.max(0, p.offsetLeft - el.offsetLeft - 160); }); }
function b3cHTML(o, oid, i, done) {
  const P = b3plan(o, oid); if (!P) return '';
  const { D, plant, win, reqAbs, view, newHere, res, best, sel, cur, s } = P;
  const nm = view === 'V' ? 'Visi mazgai' : B3N[view];
  const endAbs = s.end + 360, firstAbs = sel, lastAbs = s.last + 360;
  const lastSlot = (arr) => { let k = NS - 1; while (k > 0 && !arr[k]) k--; return 360 + 30 * (k + 1); };
  const HZ = Math.min(NS, Math.max(24, Math.ceil((Math.max(endAbs, lastSlot(cur.nn), lastSlot(cur.BT)) - 360) / 60) * 2));
  const tabs = [['V', 'Visi mazgai']].concat(window.BPDB.B3PADS.map((p) => [String(p), B3N[p]]));
  let h = `<div class="b3c" data-bi="${i}"><div class="b3fsbar"><button type="button" class="btn btn-sm b3fsb" data-b3fs="${i}" aria-label="Grafikas per visą ekraną">⤢ Visas ekranas</button><span class="b3fsn muted">Pasukite telefoną gulsčiai – matysite daugiau.</span><button type="button" class="btn btn-sm b3fsx" data-b3fs="-1">✕ Uždaryti</button></div><div class="b3tabs">${tabs.map(([k, n]) => `<button type="button" class="b3tab" data-b3v="${i}:${k}" aria-pressed="${String(view) === k}">${n}</button>`).join('')}</div>`;
  if (view === 'V') h += `<div class="b3info"><b>Tik informacijai.</b> Užsakymą vykdo vienas mazgas – laiką ir kainą rinkitės ${esc(PLANTS[plant].name)} skirtuke.</div>`;
  if (D.forecast) h += `<div class="b3info"><b>Prognozė.</b> BetonPro duomenų ${esc(o.date)} dar nėra: apkrova – tik čia patvirtinti užsakymai, savi betonvežiai mazguose – pagal įprastą pasiskirstymą (${D.typN} pask. darbo d.).</div>`;
  // laiko pasirinkimas – viršuje
  h += `<span class="eb" style="font-size:10.5px;color:#15171A;font-weight:700">Pasirinkite laiką${win ? ' · klientas: ' + esc(win[2]) + ' (' + hhmm(win[0] + 360) + '–' + hhmm(win[1] + 360) + ') – parenkama pagal betonvežius ir siurblius' : ''}</span>
    <div class="b3opts">${res.map((r) => {
      const rec = r.m === best && r.ok, kind = !r.ok ? 'Anksti' : r.m === reqAbs && !win ? (rec ? 'Prašo · rekom.' : 'Prašo') : rec ? 'Rekomenduojama' : 'Laisva';
      const parts = [r.T ? 'Perv. ' + r.T : '', r.H.n ? 'Samd. ' + r.H.n : '', newHere && r.pp && r.pp.cost ? 'Siurbl. ' + pumpTxt(r.pp) : '', r.cost ? 'Kaštai ' + sp(r.cost) + ' €' : ''].filter(Boolean).join(' · ');
      const txt = !r.ok ? `<div class="erl">anksti krauti${newHere && r.add ? ' · +' + sp(r.add) + ' €' : ''}</div>` : newHere ? (r.add ? `<div><strong>+${sp(r.add)} €</strong> <span class="muted">kaštai</span></div>` : '<div class="okt">be papild. kaštų</div>') : (r.cost ? `<div>${sp(r.cost)} € <span class="muted">kaštai</span></div>` : '<div class="okt">be papild. kaštų</div>');
      return `<button type="button" title="${esc(parts || (r.ok ? 'užtenka savų' : (r.why || []).join(', ')))}" class="b3o${rec ? ' rec' : ''}${r.ok ? '' : ' early'}" data-b3t="${i}:${r.m}" aria-pressed="${r.m === sel}" ${done ? 'disabled' : ''}><span class="eb">${kind}</span><b>${hhmm(r.m)}</b>${txt}</button>`;
    }).join('')}</div>`;
  if (!cur.ok) { const okT = (S.b3[oid] || {}).okT === sel; h += `<div class="${okT ? 'okbox' : 'warn'} tok" style="font-size:12.5px">${okT ? '✓ Laikas patvirtintas: ' + hhmm(sel) + ' (ankstyvas pasikrovimas)' : '⚠ ' + hhmm(sel) + ' – ' + esc(P.why.join(', ')) + '. Jei laikas tinka (pvz. betonvežiai jau mazge) – patvirtinkite.'} ${done ? '' : `<button type="button" class="btn btn-sm" data-timeok="${i}">${okT ? 'Atšaukti' : '✓ Laikas tinka'}</button>`}</div>`; }
  // naujo užsakymo santrauka
  const q = Number(o.qty) || 0, maxT = Math.max(...cur.nn), durH = (endAbs - firstAbs) / 60;
  if (endAbs > 1200 || durH > 10) h += `<div class="warn"><b>Didelis betonavimas – netelpa į darbo dieną</b> (baigtųsi ${endAbs >= 1440 ? 'kitą dieną ' : ''}${hhmm(endAbs)}). Siūloma: dalinti per kelias dienas, krauti iš dviejų mazgų arba didinti intervalą.</div>`;
  if (q > 100) h += `<div class="note">Betonavimas virš 100 m³ – reikia nepertraukiamo betonavimo plano (atsakingi mazgo darbuotojai).</div>`;
  // grafikas, laisvų juosta, siurbliai – visada matomi
  const tripsN = view === 'V' ? Object.values(D.trips).reduce((a, b) => a + b, 0) + Object.values(D.apTrips).reduce((a, b) => a + b, 0) : (D.trips[view] || 0) + (D.apTrips[view] || 0);
  h += b3chart(cur, cur.nn, `${D.forecast ? 'Prognozė · ' : ''}Betonvežiai · ${nm} · kiti reisai ${tripsN}${newHere ? ' · naujas ' + s.n + ' · pasirinkta ' + hhmm(sel) : ''}`, reqAbs, sel, newHere, D, HZ, win, i);
  let cells = '';
  for (let hc = 0; hc < HZ / 2; hc++) { const need = Math.max(cur.BT[2 * hc] + cur.nn[2 * hc], cur.BT[2 * hc + 1] + cur.nn[2 * hc + 1]), free = cur.own1 - need; const c = free >= 0 ? 'g' : need <= cur.own2 ? 'y' : 'r'; cells += `<div class="${c}">${free >= 0 ? '+' + free : '−' + (-free)}</div>`; }
  h += `<span class="eb muted">Laiko juosta · turime laisvų (+) arba trūksta (−)</span><div class="b3axrow"><i></i><div class="b3hrs" style="grid-template-columns:repeat(${HZ / 2},1fr)">${Array.from({ length: HZ / 2 }, (_, k) => `<span>${String((6 + k) % 24).padStart(2, '0')}</span>`).join('')}</div><i></i></div><div class="b3axrow"><i></i><div class="b3strip" style="grid-template-columns:repeat(${HZ / 2},1fr)">${cells}</div><i></i></div>`;
  const pp = b3pumps(D, o, sel, s, HZ, newHere ? cur.pp : null, i);
  h += `<span class="eb muted">Siurbliai · atvažiavimas 60 min, pervažiavimas tarp užsakymų 60 min · prastova (oranžinė) – mūsų kaštai</span>${pp.html}`;
  const pc = newHere && cur.pp ? cur.pp.cost : 0, tparts = [];
  if (cur.T) tparts.push(`pervažiuoja ${cur.T} C3 betonvežiai iš kitų mazgų (${cur.T} × ${TRF} €)`);
  if (cur.H.n) { const hrs = cur.H.lv.reduce((a, l) => a + l.hrs, 0); tparts.push(`samdomi ${cur.H.n} betonv. (${cur.H.n} × 200 + ${hrs} val. × 60)`); }
  if (pc) tparts.push(cur.pp.own ? `siurblio ${esc(cur.pp.car)} prastova ${hrs1(cur.pp.idle)} val. × ${PIDLE} €` : `samdomas siurblys ${esc(cur.pp.ptype)} – atvykimas ${PHIRE} €`);
  let cl;
  if (tparts.length) cl = `<b class="bad">${nm} · ${hhmm(sel)}: ${sp(cur.cost)} €</b> – ${tparts.join(' + ')}.${newHere ? ` Naujas užsakymas prideda <b>${sp(cur.add)} €</b>.` : ''}`;
  else cl = `<b class="okt">${nm} · ${hhmm(sel)}:</b> užtenka savų betonvežių${cur.pp ? ' ir siurblio ' + esc(cur.pp.car) : ''}${newHere ? ' – naujas užsakymas telpa be papildomų kaštų.' : '.'}`;
  h += `<div class="b3cost">${cl}<br><span class="muted">Siurblio atvykimas ir darbo valandos išrašomi klientui; prastovos – ne, todėl jos yra mūsų kaštai.</span></div>`;
  h += `<div class="legend">${window.BPDB.B3PADS.map((p) => `<span><i style="background:${B3C[p]}"></i>${B3N[p]}</span>`).join('')}<span><i class="lg-ap"></i>patvirtinta čia (mazgo spalva, brūkšniuota)</span><span><i style="background:#F5C518;box-shadow:inset 0 0 0 1px #15171A"></i>naujas užsakymas</span><span><i style="border-top:2px solid #1E8A5A;height:0"></i>mazgo C3</span><span><i style="border-top:2px dashed #1E8A5A;height:0"></i>+ pervažiuojantys</span><span><i class="b3env-i"></i>samdyti / prastova (apmokami)</span><span><i style="background:#D2452F;opacity:.6"></i>persidengia</span></div>`;
  return h + '</div>';
}
// Pasirinktas laikas (minutės nuo 06:00), tinkamumas, siurblys – B3c, jei yra DB, kitaip senasis modelis.
function timePlan(o, oid) {
  if (useDb() && window.BPDB.b3day) {
    const P = b3plan(o, oid); if (!P) return null;
    const pp = P.cur.pp;
    return { Sm: P.sel - 360, ok: P.ok, why: P.why, pumpId: o.pump && o.pump.need ? ptypeOf(o.pump.len) : null, pumpCar: pp ? pp.car : null, pp, s: P.s, hire: P.cur.H.n, req: P.reqAbs - 360, win: P.win };
  }
  const cap = capOptions(o, oid); if (!cap) return null;
  const ch = cap.opts[o.pick == null ? cap.def : o.pick];
  return { Sm: ch.Sm, ok: ch.ok, why: ch.why, pumpId: ch.pumpId, pumpCar: null, s: ch.s, hire: ch.hire, req: cap.S0, win: null, cap };
}

/* ---------- AI ---------- */
const TOOL = {
  name: 'uzsakymo_juodrastis',
  description: 'Struktūrizuotas betono užsakymo laiško atpažinimo rezultatas.',
  input_schema: {
    type: 'object',
    properties: {
      tipas: { type: 'string', enum: ['naujas', 'grafikas', 'pakeitimas', 'atsaukimas', 'klausimas', 'ne_uzsakymas'], description: 'naujas – vienas ar keli konkretūs užsakymai; grafikas – savaitės/kelių dienų grafikas; pakeitimas – keičia anksčiau pateiktą; atsaukimas; klausimas – užsakymas, bet trūksta esminių duomenų; ne_uzsakymas – deklaracijos, sąskaitos, padėkos, kiti klausimai.' },
      santrauka: { type: 'string', description: 'Viena trumpa eilutė lietuviškai, pvz. „11-12 08:00 · 90 m³ C20/25 · siurblys 28 m“.' },
      tikrumas: { type: 'integer', minimum: 0, maximum: 100 },
      uzsakymai: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            veiksmas: { type: 'string', enum: ['naujas', 'keisti', 'atsaukti'] },
            data: { type: ['string', 'null'], description: 'YYYY-MM-DD. Santykines datas („rytoj“, „ketvirtadieniui“, „11.12“) apskaičiuok pagal laiško gavimo datą. null, jei nėra.' },
            laikas: { type: ['string', 'null'], description: 'HH:MM – tik jei klientas nurodė konkretų laiką (pirmo betonvežio atvykimas į objektą arba atsiėmimas). Jei laikas apytikslis („rytą“, „antra dienos pusė“, „po pietų“) – null ir užpildyk laiko_langas. Niekada neįrašyk numatytojo laiko.' },
            laiko_langas: { type: ['string', 'null'], enum: ['rytas', 'pirma_puse', 'antra_puse', 'vakaras', null], description: 'Jei laikas apytikslis: rytas (07–11), pirma_puse (07–12), antra_puse / po pietų (12–17), vakaras (15–18). Laiką lange parinks sistema pagal mazgo apkrovą – klientui apie tai neklausk.' },
            objektas: { type: 'string' },
            adresas: { type: 'string' },
            koordinates: { type: ['string', 'null'] },
            marke_kaip_prase: { type: 'string', description: 'Tiksliai kaip parašė klientas, pvz. „C30/37 XC4XA1W6F150“.' },
            savybes: { type: 'array', items: { type: 'string' }, description: 'TIK tos savybės, kurias parašė klientas: stiprumo klasė (C30/37), aplinkos klasės (XC2, XA1, XF4…), F (F150), W (W6). Nieko nepridėk.' },
            slankumas: { type: ['string', 'null'], description: 'S1–S5, jei nurodė.' },
            dmax: { type: ['integer', 'null'] },
            kiekis_m3: { type: ['number', 'null'], description: 'Jei intervalas ar „apie“ (44–48 m³) – didesnė reikšmė ir kiekis_apytikslis = true. Dėl kiekio neklausk.' },
            kiekis_apytikslis: { type: 'boolean', description: 'true, jei klientas kiekį nurodė intervalu ar apytiksliai – atsakyme parašysime „Kiekį patikslinsime paskutiniu betonvežiu“.' },
            siurblys_reikia: { type: 'boolean' },
            siurblio_ilgis_m: { type: ['integer', 'null'], description: '„pumikas“, „pumi“, „pumikas 28–31 m“ → 28; 36 m → 36; 42 m → 42. Kliento nurodyto siurblio NEklausk.' },
            pristatymas: { type: 'string', enum: ['betonvezis', 'savivartis', 'kriause'], description: 'savivartis – KLIENTO TRANSPORTAS (bet kokia kliento transporto priemonė: savivartis, dumperis, savas betonvežis, priekaba, „pasiimsime patys“); kriause – mūsų betonvežis pila tiesiai iš kriaušės (be siurblio).' },
            kliento_transportas: { type: ['string', 'null'], description: 'Jei pristatymas savivartis – kokia kliento transporto priemonė, kaip parašyta: „savivartis“, „dumperis“, „savas betonvežis“. Kitaip null.' },
            intervalas_min: { type: ['integer', 'null'] },
            priedai: { type: ['string', 'null'], description: 'Fibra, kristalai, lėtiklis ir pan.' },
            mazgas: { type: 'string', enum: ['R', 'S', 'B'] },
            kelione_min: { type: 'integer', description: 'Apytikslis važiavimo laikas iš mazgo į objektą vienos krypties, min.' },
            pastabos: { type: 'string' },
            nuoroda: { type: ['string', 'null'], description: 'Kokį anksčiau pateiktą užsakymą keičia ar atšaukia (data, objektas, Nr.).' }
          },
          required: ['veiksmas', 'data', 'laikas', 'objektas', 'adresas', 'marke_kaip_prase', 'savybes', 'kiekis_m3', 'siurblys_reikia', 'pristatymas', 'mazgas', 'kelione_min', 'pastabos']
        }
      },
      truksta: { type: 'array', items: { type: 'string' } },
      kalba: { type: 'string', enum: ['lt', 'en', 'lv', 'pl', 'ru'], description: 'Kokia kalba rašė užsakovas (ne persiuntėjas). Atsakymas klientui bus šia kalba (lt arba en).' },
      uzsakovas: { type: ['object', 'null'], properties: { vardas: { type: 'string' }, imone: { type: 'string' }, el_pastas: { type: ['string', 'null'] }, tel: { type: ['string', 'null'] } }, description: 'Tikrasis užsakovas, jei laišką PERSIUNTĖ kitas asmuo (Fw:/Fwd:, „From: … Sent: …“ citata, persiuntėjas iš kitos įmonės, pvz. ESSPO). Kontaktus perrašyk iš persiųsto laiško. Jei laišką rašė pats užsakovas – null.' },
      persiuntejas: { type: ['object', 'null'], properties: { vardas: { type: 'string' }, imone: { type: 'string' }, el_pastas: { type: ['string', 'null'] } }, description: 'Kas persiuntė laišką (jei persiųstas). Kitaip null.' },
      klausimas_klientui: { type: ['string', 'null'], description: 'TIK jei nėra datos, kiekio ar markės ir jų negalima nustatyti iš laiško, kitų kliento laiškų ar istorijos. Neklausk laiko, objekto (imk iš istorijos), siurblio, slankumo, aplinkos klasių, ar tikrai tokia markė. Kitaip null.' },
      papildomas_tekstas: { type: ['string', 'null'], description: 'Neprivalomas 1–2 sakinių papildymas atsakymui (pvz. dėl fibros, lėtiklio, mokėtojo). NEkartok objekto, markės, priedų, kainų ar laiko (jie lentelėje), nerašyk „laikome“, „manome“, „jei netinka – praneškite“.' },
      atsakymas_ne_uzsakymui: { type: ['string', 'null'], description: 'Tik tipui ne_uzsakymas: trumpas profesionalus atsakymas be pasisveikinimo ir parašo, arba null, jei atsakyti nereikia. KIEKVIENAS faktas / įkainis – ATSKIRA EILUTĖ, pvz. „PUMI 28 (28 m): atvykimas 180 €, darbas 80 €/val. (min. 2 val.)“. Viena aiški kaina, be „tikslią kainą pateiksime vėliau“. Prašymas klientui – atskira eilutė pabaigoje.' },
      paaiskinimas: { type: 'string', description: 'Trumpai: iš kurių laiško vietų paimti duomenys ir kas neaišku. Rašyk dalykiškai, be pasiteisinimų (ne „neprisigalvojau“, „neturiu“), – ką radai ir ką darai.' },
      adresatas: { type: 'string', description: 'C3 darbuotojas, kuriam klientas asmeniškai rašo (vardas iš kreipinio, pvz. „Justina“), jei toks yra; kitaip tuščia.' },
      sprendimas: { type: 'string', description: 'VISADA: konkretus siūlomas sprendimas vadybininkui – iki 4 trumpų sakinių, kiekvienas atskira mintis, be pasikartojimų su laukais. Atsakymų į vadybininko pastabas (P1…) čia NErašyk – jie eina į atsakymai_i_pastabas.' },
      atsakymai_i_pastabas: { type: 'array', items: { type: 'object', properties: { nr: { type: 'integer', description: 'Pastabos numeris (1 = P1)' }, tekstas: { type: 'string', description: 'Trumpas atsakymas į tą pastabą (1–3 sakiniai). Jei pakeitei laukus – pabaigoje „Pakeista: …“.' } }, required: ['nr', 'tekstas'] }, description: 'Atsakymai į kiekvieną vadybininko pastabą (P1, P2…), kaip pokalbyje. Jei pastabų nėra – tuščias masyvas.' }
    },
    required: ['tipas', 'santrauka', 'tikrumas', 'uzsakymai', 'truksta', 'paaiskinimas', 'sprendimas']
  }
};
function sysPrompt() {
  return [
    'Tu esi UAB „C3 Betonas“ (prekinis betonas, Lietuva) užsakymų priėmimo asistentas BetonPro sistemoje.',
    'Perskaityk kliento laišką (su priedų turiniu ir vadybininko pastabomis) ir grąžink struktūrizuotą juodraštį per įrankį uzsakymo_juodrastis.',
    'Mazgai: R – Runeikiai (Kėdainių r., prie Rail Baltica), S – Stašėnai (Jonavos r., arti Kauno, Jonavos, Ukmergės), B – Baisogala (Radviliškio r., Kemėrai, Šeduva, Šiauliai). Užsakymas vykdomas artimiausiame objektui mazge; jei klientas nurodo mazgą (pvz. „iš Stašėnų“) – jį. Objektai „89Q9+J8J Runeikiai“ ir Rail Baltica šalia Kėdainių – R. Kemėrų k. (Reino g., Rheinmetall) – B. Lapingė, Okainiai, Zujai, Jonava – S.',
    'Siurbliai: PUMI 28, PUMI 29 (pumikai), PUMP 36, PUMP 42. „Pumikas“ be ilgio – 28 m. „M36“ – 36 m.',
    'Savybes rašyk tik tas, kurias nurodė klientas. Neprisigalvok klasių.',
    'Akivaizdžias rašymo klaidas taisyk pats ir dėl jų klientui NEklausk: „C37/30“ → C30/37, „C25/30XC4“ → C25/30 XC4, sukeisti skaičiai klasėje ir pan. Pastabose parašyk „pataisyta: C37/30 → C30/37“. Netikslaus laiko („antra dienos pusė“) taip pat neklausk – grąžink laiko_langas. Klausimas klientui – tik kai be atsakymo užsakymo priimti neįmanoma (nėra datos, kiekio ar markės).',
    'Kiekvienai dienai/konstrukcijai – atskiras užsakymas. Savaitės grafikui – visi įrašai. Ankstesnės laiško versijos citatos (From:/Sent:) – tik kontekstas.',
    'Jei laiške tik parašas, o užsakymas priede – imk iš priedo. Jei priedo nėra arba neaišku – tipas „klausimas“.',
    (window.BPDB && window.BPDB.letters ? 'Laiškai su tikrais kontaktais – kontaktinius asmenis ir telefonus perrašyk tiksliai.' : 'Laiškų vardai ir kontaktai užkoduoti (pvz. „A. S.“, „+370 6•• •• •••“) – taip ir palik.'),
    'Jei pateikta KLIENTO ISTORIJA iš BetonPro – naudok ją mazgui, objekto adresui ir pristatymo būdui nustatyti (tam pačiam objektui klientas paprastai kraunasi tame pačiame mazge). Betono savybes vis tiek imk tik iš laiško; istorijos receptą minėk tik pastabose.',
    'KAINORAŠTIS (be PVM): betonas – recepto kainoraštis €/m³ (sistema įrašo pati); PUMI 28/29 siurblys – atvykimas 180 €, darbas 80 €/val.; PUMP 36 ir PUMP 42 kainoraščio sistemoje nėra. Jei klientas klausia kainų arba jam receptas dar netiektas – sprendime siūlyk kainą pagal kainoraštį (konkretūs skaičiai), o ne rašyk, kad kainų nėra.',
    'PAGRINDINIS PRINCIPAS: BetonPro supaprastina komunikaciją, o ne ją ištempia klausimais. Viską, ką galima nuspręsti iš laiško, kitų to paties kliento laiškų, istorijos, kainoraščio ir apkrovos – nuspręsk ir pasiūlyk (laikas, objektas, mazgas, receptas, kaina, siurblys). Atsakymas klientui – patvirtinimas su pasiūlymu („Jei netinka – praneškite“).',
    'LAIKAS: „ryte“, „iš ryto“, „rytą“ → laikas null, laiko_langas rytas; „po pietų“, „antroje pusėje“ → antra_puse. Tikslų laiką parinks sistema pagal betonvežius ir siurblius. Niekada nerašyk „pristatyti prašytu laiku negalime“, jei klientas valandos nenurodė.',
    'OBJEKTAS: jei laiške objekto nėra – imk paskutinį kliento objektą iš istorijos (adresas, mazgas) ir pastabose parašyk „objektas pagal paskutinį užsakymą“.',
    '„TAS PATS BETONAS“, „kaip praeitą kartą“, „kaip kalbėjome“: receptą (markę, slankumą, priedus) imk iš naujausio šaltinio – pirmiausia iš KITŲ ŠIO KLIENTO LAIŠKŲ (ypač tos pačios dienos), tada iš paskutinių BetonPro užsakymų. Objektą – iš paskutinio pristatymo. Jei ankstesnis laiškas buvo tas pats užsakymas (pvz. pasikeitė kiekis ar pristatymo būdas) – veiksmas „keisti“ ir nuoroda į tą laišką, ne naujas užsakymas. „Vežame“ – pristatymas betonvežiu. Jei data nenurodyta, o laiške „vežame“, „šiandien“ – laiško gavimo diena. Kliento aiškiai parašytos markės neklausk, net jei anksčiau ėmė kitą.',
    'TRŪKSTA: į „truksta“ rašyk tik tai, be ko užsakymo priimti neįmanoma. Nerašyk siurblio ilgio (jei klientas nurodė siurblį), tikslaus laiko (jei yra laiko langas), slankumo, aplinkos klasių.',
    'PAAIŠKINIME neminėk kitų klientų užsakymų, nebent jie tiesiogiai susiję (tas pats objektas ar laikas).',
    'KAINOS UŽKLAUSA: jei klientas klausia kainų – sprendime ir atsakyme iškart pateik kainas: pirmiausia SUTARTINĖS KAINOS (iš kliento sąskaitų), jei jų nėra – kainoraštis; siurbliams visada pateik ir PUMI 28 (atvykimas 180 €, 80 €/val.), ir PUMP 36 (kaina – „patvirtinsime atskirai“, jei nėra sutartinės). Objektą ir mazgą imk iš istorijos. Neklausk adreso ar datos, jei kainai pateikti jų nereikia.',
    'KLIENTO TRANSPORTAS: jei klientas mini savo transporto priemonę (savivartis, dumperis, „pasiimsime patys“, savas betonvežis) – pristatymas savivartis ir kliento_transportas = priemonė; sąlygos EXW (kaina be pristatymo).',
    'PERSIŲSTI LAIŠKAI: jei laišką persiuntė kitas asmuo (pvz. ESSPO darbuotojas persiuntė kliento užsakymą) – užpildyk uzsakovas (tikrasis klientas su kontaktais iš persiųsto laiško) ir persiuntejas. Atsakymas eis užsakovui, persiuntėjui – kopija. kalba – užsakovo kalba.',
    'ILGI GRAFIKAI (> 8 eilučių): laukus pildyk trumpai – pastabos iki 60 simbolių, adresą kartok tik kai keičiasi.',
    'SIURBLIO MINIMALI APMOKAMA TRUKMĖ – 2 val.',
    'ATSAKYMO TEKSTAS KLIENTUI: kiekvienas faktas ar įkainis – atskira eilutė, trumpos pastraipos; nekartok to, kas užsakymo lentelėje (objektas, markė, priedai, kaina); nerašyk „laikome“, „manome“; jokio „tikslią kainą pateiksime vėliau“ – visada viena aiški kaina.',
    'VADYBININKO PASTABOS (P1, P2…): į kiekvieną atsakyk atskirai lauke atsakymai_i_pastabas (kaip pokalbyje), ne sprendime.',
    'KAINOS: naudok pateiktus skyrius SIURBLIŲ KAINOS, BETONO KAINOS TAME PAČIAME OBJEKTE, MAZGE, PASTABOSE MINIMŲ KLIENTŲ. Visada nurodyk kainos šaltinį trumpai (pvz. „kaip PST, BM8110, 117,20 €/m³, 2026-10“). Nerašyk „kainų nėra, įrašykite ranka“, jei bent viename skyriuje yra tinkama kaina – pasiūlyk konkrečią.',
    'Rašyk lietuviškai, dalykiškai.'
  ].join('\n');
}
function userPrompt(L) {
  const prev = Object.entries(S.appr).flatMap(([lid, a]) => (a.orders || []).map((o) => `- ${o.client}: ${o.date} ${fmt(o.S)} · ${o.address || o.object} · ${o.qty} m³ ${o.asked}`));
  const att = (L.attachments || []).map((a) => `--- PRIEDAS: ${a.name} ---\n${a.text}`).join('\n\n');
  const notes = (S.notes[L.id] || []).map((n, i) => `P${i + 1}: ${n}`).join('\n');
  const hist = histPrompt(L) + otherLetters(L);
  return `Laiškas gautas: ${L.received.replace('T', ' ')} (${wd(L.received.slice(0, 10))})\nKanalas: ${L.channel}, dėžutė ${L.box}\nSiuntėjas: ${L.contact.name}, ${L.company}\nTema: ${L.subject}\n\n${L.body}\n\n${att}${notes ? '\n\n--- VADYBININKO PASTABOS (svarbiau už laišką) ---\n' + notes : ''}${prev.length ? '\n\n--- JAU PATVIRTINTI UŽSAKYMAI (pakeitimams/atšaukimams susieti) ---\n' + prev.join('\n') : ''}${hist}`;
}
// Kiti to paties kliento laiškai per 7 d. iki šio laiško (su BP juodraščiais) – „tas pats betonas“, papildymai, pakeitimai.
function otherLetters(L) {
  const ks = DBX() ? new Set(window.BPDB.keys(L.company)) : null, t0 = L.received;
  const same = (x) => x.id !== L.id && (x.company === L.company || (ks && window.BPDB.keys(x.company).some((k) => ks.has(k))));
  const lst = LETTERS.filter((x) => same(x) && x.received <= t0 && (new Date(t0) - new Date(x.received)) / 864e5 <= 7).sort((a, b) => b.received.localeCompare(a.received)).slice(0, 4);
  if (!lst.length) return '';
  return '\n\n--- KITI ŠIO KLIENTO LAIŠKAI (7 d. iki šio laiško, naujausi pirmi) ---\n' + lst.map((x) => { const r = S.res[x.id], a = S.appr[x.id]; return `[${x.id} · ${x.received.replace('T', ' ')} · ${x.subject || ''}${a ? ' · PATVIRTINTA' : ''}]\n${String(x.body).replace(/\s+/g, ' ').slice(0, 700)}${r && r.santrauka ? '\nBP juodraštis: ' + r.santrauka : ''}`; }).join('\n\n');
}
function histPrompt(L) {
  if (!DBX()) return '';
  return histClient(L) + priceCtx(L);
}
// Kainos BP: siurbliai pagal tipą, betonas tame pačiame objekte, mazge ir pastabose minimų klientų – su šaltiniu.
function priceCtx(L) {
  const B = window.BPDB; if (!B.pricesAt) return '';
  const f2l = (x) => Number(x).toFixed(2).replace('.', ',');
  const row = (x) => `- ${x.client} · ${x.code} ${x.cls} · ${f2l(x.p)} €/m³ ${x.ty} · ${x.obj || x.plant} · ${x.date}`;
  const notes = (S.notes[L.id] || []).join(' '), txt = (L.subject || '') + ' ' + L.body + ' ' + (L.attachments || []).map((a) => a.text.slice(0, 2000)).join(' ') + ' ' + notes;
  let h = '';
  const sv = B.services(L.company);
  if (sv && sv.byT) {
    const ln = ['28', '36', '42'].map((k) => { const b = sv.byT[k]; const t = k === '28' ? 'PUMI 28' : 'PUMP ' + k; const a = b.atv.client || b.atv.med, v = b.val.client || b.val.med; return a || v ? `- ${t}: atvykimas ${a ? sp(a) + ' €' : '—'}, ${v ? sp(v) + ' €/val.' : '—'} (${b.atv.client || b.val.client ? 'šio kliento ankstesnės sąlygos' : 'mediana iš sąskaitų'}); min. 2 val.` : `- ${t}: kainų sąskaitose nėra`; });
    h += '\n\n--- SIURBLIŲ KAINOS (iš sąskaitų, pagal siurblio tipą; sąskaitose PUMP 36 irgi vadinamas „PUMI atvykimas / valandos“) ---\n' + ln.join('\n') + (sv.ext && (sv.ext.client || sv.ext.med) ? `\n- Betonvežio papildoma valanda objekte: ${sp(sv.ext.client || sv.ext.med)} €/val.` : '');
  }
  const ho = B.summary(L.company), addrTxt = ho ? ho.addrs.slice(0, 3).map((a) => a.address).join(' ') : '';
  const at = B.pricesAt((L.subject || '') + ' ' + L.body.slice(0, 600) + ' ' + notes + ' ' + addrTxt, 12);
  if (at.length) h += '\n\n--- BETONO KAINOS TAME PAČIAME OBJEKTE (visi klientai, paskutinės, iš sąskaitų) ---\n' + at.map(row).join('\n');
  const pls = new Set(); if (ho) ho.plants.slice(0, 1).forEach((p) => pls.add(p[0])); [['baisog', 'Baisogala'], ['stašėn', 'Stašėnai'], ['stasen', 'Stašėnai'], ['runeik', 'Runeikiai']].forEach(([k, n]) => { if (txt.toLowerCase().includes(k)) pls.add(n); });
  pls.forEach((pn) => { const pp = B.pricesPlant(pn, 10); if (pp.length) h += `\n\n--- BETONO KAINOS MAZGE ${pn.toUpperCase()} (paskutinės, iš sąskaitų) ---\n` + pp.map(row).join('\n'); });
  if (notes) { const pc = B.pricesClient(notes, 12).filter((x) => B.ck(x.client) !== B.ck(L.company)); if (pc.length) h += '\n\n--- PASTABOSE MINIMŲ KLIENTŲ KAINOS (iš sąskaitų) ---\n' + pc.map(row).join('\n'); }
  return h;
}
function histClient(L) {
  const h = window.BPDB.summary(L.company, L.received.slice(0, 10));
  if (!h) return '\n\n--- KLIENTO ISTORIJA (BetonPro) ---\nŠio kliento užsakymų per paskutinius 6 mėn. nerasta (naujas arba retas klientas).';
  const ad = h.addrs.slice(0, 8).map((a) => `- ${a.address}: ${a.n} užs., ${Math.round(a.m3)} m³, paskutinis ${a.last}, mazgas ${a.plant}, receptai ${a.codes.slice(0, 3).join(', ')}`);
  const cd = h.codes.slice(0, 8).map((c) => `- ${c.code}: ${c.product.split(' - ').slice(-1)[0]} – ${c.n} užs., ${Math.round(c.m3)} m³ (${c.plant})`);
  const lo = window.BPDB.lastOrders(L.company, L.received.slice(0, 16), 3).map((o) => `- ${o.date} ${o.time} · ${o.address} (${Math.round(o.km || 0)} km) · ${o.code} ${o.cls} · ${String(Math.round(o.m3 * 10) / 10).replace('.', ',')} m³ · ${o.plantName}`);
  const pr = h.codes.slice(0, 8).map((c) => { const p = window.BPDB.price(c.code, L.company); return p && p.client != null ? `- ${c.code} ${c.cls || ''}: ${p.client.toFixed(2).replace('.', ',')} €/m³ be PVM` : ''; }).filter(Boolean);
  return `\n\n--- KLIENTO ISTORIJA (BetonPro, iki laiško datos) ---\n${h.n} užsakymai, ${Math.round(h.m3)} m³ (${h.first} – ${h.lastDate}). Mazgai: ${h.plants.map((p) => p[0] + ' ' + p[1]).join(', ')}.\nPaskutiniai užsakymai:\n${lo.join('\n')}\nObjektai:\n${ad.join('\n')}\nReceptai:\n${cd.join('\n')}${pr.length ? '\nSutartinės kainos (iš sąskaitų):\n' + pr.join('\n') : ''}`;
}
async function runAI(id) {
  const L = LETTERS.find((x) => x.id === id), k = key();
  if (!L) return;
  if (!k) { toast('Įveskite Claude API raktą skiltyje „Nustatymai ir AI“.'); return; }
  busy[id] = true; keep(id === S.sel ? renderAll : renderList);
  const t0 = Date.now();
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: S.model, max_tokens: 16000, system: sysPrompt() + '\n\nATSAKYMO FORMA: visada atsakyk tik iškviesdamas įrankį uzsakymo_juodrastis (jokio kito teksto). Laukas uzsakymai visada yra JSON masyvas (ne tekstas). Savaitės grafiko atveju kiekviena grafiko eilutė (data + konstrukcija/elementas) yra atskiras įrašas masyve uzsakymai; laukus pildyk trumpai, be pasikartojančių kontaktų.', tools: [TOOL], tool_choice: { type: 'auto' }, messages: [{ role: 'user', content: userPrompt(L) }] })
    });
    const j = await r.json();
    if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
    const tu = (j.content || []).find((c) => c.type === 'tool_use');
    let inp = tu && tu.input;
    if (!inp) {
      const txt = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
      const m = txt.match(/\{[\s\S]*\}/);
      if (m) { try { inp = JSON.parse(m[0]); } catch (e) {} }
    }
    if (inp) ['uzsakymai', 'truksta'].forEach((f) => { if (typeof inp[f] === 'string') { try { inp[f] = JSON.parse(inp[f]); } catch (e) { const m2 = inp[f].match(/\[[\s\S]*\]/); try { inp[f] = m2 ? JSON.parse(m2[0]) : []; } catch (e2) { inp[f] = []; } } } if (inp[f] && !Array.isArray(inp[f])) inp[f] = Object.values(inp[f]); });
    if (j.stop_reason === 'max_tokens' && (!inp || !(inp.uzsakymai || []).length)) throw new Error('Laiškas per ilgas vienam atsakymui (pasiektas atsakymo ilgio limitas). Pabandykite dar kartą arba pasirinkite kitą modelį.');
    if (!inp || !inp.tipas) throw new Error('AI negrąžino struktūrizuoto atsakymo.');
    if (inp.tipas !== 'ne_uzsakymas' && inp.tipas !== 'klausimas' && !(inp.uzsakymai || []).length) throw new Error('AI atpažino „' + (inp.tipas === 'grafikas' ? 'savaitės grafiką' : inp.tipas) + '“, bet negrąžino užsakymų eilučių. Spauskite „Pateikti“ dar kartą.');
    S.res[id] = Object.assign(inp, { _model: S.model, _ms: Date.now() - t0, _usage: j.usage, _at: new Date().toISOString() });
    S.aiLog.unshift({ id, ms: Date.now() - t0, in: j.usage && j.usage.input_tokens, out: j.usage && j.usage.output_tokens, model: S.model });
    S.aiLog = S.aiLog.slice(0, 60);
    initEdit(id, true);
  } catch (e) {
    S.res[id] = Object.assign(S.res[id] || {}, { _err: String(e.message || e) });
  }
  busy[id] = false; save(); keep(id === S.sel ? renderAll : renderList);
}
function keep(fn) {
  const a = document.activeElement; let g = null;
  if (a && (a.tagName === 'TEXTAREA' || a.tagName === 'INPUT')) {
    const ks = a.dataset.k ? [...document.querySelectorAll('[data-k="' + a.dataset.k + '"]')] : [];
    g = { id: a.id && !a.id.startsWith('f-') ? a.id : null, k: a.dataset.k, i: ks.indexOf(a), v: a.value, s: null, e: null, cb: a.type === 'checkbox' };
    try { g.s = a.selectionStart; g.e = a.selectionEnd; } catch (e) {}
  }
  fn();
  if (!g || g.cb) return;
  const b = g.id ? document.getElementById(g.id) : g.k ? document.querySelectorAll('[data-k="' + g.k + '"]')[g.i] : null;
  if (!b || b.disabled) return;
  b.value = g.v; b.focus();
  try { if (g.s != null) b.setSelectionRange(g.s, g.e); } catch (e) {}
}
function fromAI(u, L) {
  return {
    action: u.veiksmas || 'naujas', date: u.data || '', time: u.laiko_langas ? '' : okTime(u.laikas), qtyApprox: !!u.kiekis_apytikslis, win: u.laiko_langas && WIN[u.laiko_langas] ? u.laiko_langas : '', object: u.objektas || '', address: u.adresas || '', coords: u.koordinates || '',
    asked: u.marke_kaip_prase || '', props: normProps(u.savybes && u.savybes.length ? u.savybes : [u.marke_kaip_prase || '']), slump: u.slankumas || '', dmax: u.dmax || null,
    qty: u.kiekis_m3 == null ? '' : u.kiekis_m3, pump: { need: !!u.siurblys_reikia, len: u.siurblio_ilgis_m || (u.siurblys_reikia ? 28 : null) },
    mode: u.pristatymas || 'betonvezis', ctype: u.kliento_transportas || '', terms: u.pristatymas === 'savivartis' ? 'exw' : '', interval: u.intervalas_min || '', additives: u.priedai || '', plant: u.mazgas || 'S', travel: u.kelione_min || 40,
    notes: u.pastabos || '', ref: u.nuoroda || '', recipeId: null, pick: null, client: L.company
  };
}
function initEdit(id, fromRes) {
  const L = LETTERS.find((x) => x.id === id), R = S.res[id];
  const prev = S.ed[id] || {};
  const e = { orders: [], reply: null, replyBase: null, subj: null, rc: prev.rc || null };
  if (fromRes && R && R.uzsakymai) e.orders = R.uzsakymai.map((u) => fromAI(u, L));
  e.orders.forEach((o) => { if (o.win) o.time = ''; o.time = okTime(o.time); fillFromHistory(o, L); autoRecipe(o); });
  e.orders.forEach((o, i) => { if (!o.recipeId) { const k = e.orders.findIndex((x, j) => j < i && x.recipeId && rcpKey(x) === rcpKey(o)); if (k >= 0) { o.recipeId = e.orders[k].recipeId; o.rcpWhy = 'same'; o.rcpFrom = k + 1; } } });
  S.ed[id] = e;
}
// Objektas ir kelionė iš BetonPro istorijos: kai objekto nėra – paskutinis kliento objektas; atstumas (km) – iš to objekto užsakymų.
function fillFromHistory(o, L) {
  if (!DBX() || !o.client || o.action === 'atsaukti') return;
  const before = (L && L.received ? L.received.slice(0, 10) : '');
  const noObj = !(o.address && !/nenurodyt/i.test(o.address)) && !(o.object && !/nenurodyt/i.test(o.object));
  if (noObj && o.mode !== 'savivartis') { const lo = window.BPDB.lastOrders(o.client, L && L.received ? L.received.slice(0, 16) : before, 1)[0]; if (lo && lo.address) { o.address = lo.address; if (/nenurodyt/i.test(o.object || '')) o.object = ''; o.objSrc = 'paskutinis užsakymas ' + lo.date; if (lo.plant) o.plant = lo.plant; } }
  const la = window.BPDB.lastAt(o.client, (o.address || '') + ' ' + (o.object || ''), before);
  if (la && la.km > 0) { o.km = la.km; o.travel = kmMin(la.km); o.trSrc = 'hist'; }
}
function autoRecipe(o) { if (o.action === 'atsaukti') return; const ro = recipeOptions(o); if (ro.hist) { o.recipeId = ro.hist.r.id; o.rcpWhy = 'hist'; } else { const pick = ro.fit[0] || ro.extra[0]; o.recipeId = pick ? pick.r.id : null; o.rcpWhy = o.recipeId ? 'bp' : ''; } o.rcpMan = false; o.rcpFrom = null; }
const rcpKey = (o) => o.plant + '|' + normProps(o.props && o.props.length ? o.props : [o.asked || '']).join(' ') + '|' + (o.slump || '');
function propagateRecipe(E, i) { const src = E.orders[i]; if (!src || !src.recipeId) return; E.orders.forEach((o, k) => { if (k === i || o.rcpMan || o.action === 'atsaukti' || rcpKey(o) !== rcpKey(src)) return; o.recipeId = src.recipeId; o.rcpWhy = 'same'; o.rcpFrom = i + 1; }); }

/* ---------- atsakymas ---------- */
// Persiųstas laiškas: tikrasis užsakovas (iš BP) skiriasi nuo siuntėjo.
function fwdOf(L) { const R = S.res[L.id], u = R && R.uzsakovas; if (!u || !(u.el_pastas || u.vardas)) return null; if (u.el_pastas && L.contact.mail && u.el_pastas.toLowerCase() === L.contact.mail.toLowerCase()) return null; return { u, p: R.persiuntejas || null }; }
// Atsakymą pasirašo prisijungęs vartotojas (teste – pasirenkamas „Nustatymai ir AI“).
const USERS = [{ k: 'alina', n: 'Alina Veber', r: ['Vadybininkė', 'Sales manager'], re: /\balin\w*/i }, { k: 'justina', n: 'Justina Kavaliauskaitė', r: ['Vadybininkė', 'Sales manager'], re: /\bjustin\w*/i }, { k: 'povilas', n: 'Povilas', r: ['Direktorius', 'Director'], re: /\bpovil\w*/i }];
const me = () => USERS.find((u) => u.k === S.me) || USERS[0];
// Kam adresuotas laiškas: BP laukas „adresatas“ arba kreipinys pirmose eilutėse („Justina, …“, „Sveika Alina“).
function addrOf(L) {
  const R = S.res[L.id], a = R && R.adresatas ? String(R.adresatas) : String(L.body || '').split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 2).join(' ').slice(0, 120);
  const u = USERS.find((x) => x.re.test(a)); return u || null;
}
function sig(L) {
  const u = me();
  return TX('Pagarbiai\n', 'Best regards\n') + u.n + TX('\n' + u.r[0] + ' · UAB „C3 Betonas“', '\n' + u.r[1] + ' · UAB "C3 Betonas"') + '\nuzsakymai@c3betonas.lt';
}
function recipeById(id) { return RECIPES.find((r) => r.id === Number(id)); }
// Kainoraštis (be PVM). Betonas – recepto kainoraštis €/m³; PUMI – mediana iš BetonPro sąskaitų (PUMI atvykimas 180 €, valanda 80 €).
const PUMP_KAIN = { pumi: { atv: 180, val: 80 } };
let LANG = 'lt'; const TX = (lt, en) => LANG === 'en' ? en : lt;
const WD_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const wdL = (d) => { if (LANG !== 'en') return wd(d); const t = new Date(d + 'T12:00:00'); return isNaN(t) ? '' : WD_EN[t.getDay()]; };
const TR_MED = 65; // transportas €/reisą (mediana iš sąskaitų, jei DB neįkelta)
const isClientTr = (o) => o.mode === 'savivartis';
const pnum = (v) => { if (v == null || v === '') return null; const x = Number(String(v).replace(/\s/g, '').replace(',', '.')); return isFinite(x) ? x : null; };
const num = (v) => { const x = pnum(v); return x != null && x > 0 ? x : null; };
const f2 = (x) => x == null ? '' : Number(x).toFixed(2).replace('.', ',');
const PMIN = 2; // siurblio minimali apmokama trukmė, val.
const pumpHrs = (h) => Math.max(PMIN, Math.ceil(h || 0));
// Sąlygos: ddp – kaina su pristatymu; sep – betonas + transportas atskirai (€/reisą); exw – kliento transportas.
function defTerms(o, r) {
  if (isClientTr(o)) return 'exw';
  const sv = DBX() && window.BPDB.services ? window.BPDB.services(o.client) : null;
  if (sv && sv.tr.client != null) return 'sep';
  const pq = DBX() && r ? window.BPDB.price(r.code, o.client) : null;
  if (pq && pq.byT && pq.byT.DDP) return 'ddp';
  return 'sep';
}
const termsOf = (o, r) => isClientTr(o) ? 'exw' : (o.terms || defTerms(o, r));
const TERMS = { ddp: 'Su pristatymu (DDP)', sep: 'Betonas + transportas atskirai', exw: 'Kliento transportas (EXW)' };
// Siurblio kaina klientui pagal tipą: sąskaitose PUMP 36 irgi „PUMI atvykimas / valandos“, tipas – pagal užsakymo siurblio ilgį (db.js).
function pumpKain(o) {
  const t = ptypeOf(o.pump && o.pump.len), k = /PUMI/.test(t) ? '28' : /42/.test(t) ? '42' : '36';
  const sv = DBX() && window.BPDB.services ? window.BPDB.services(o.client) : null, bt = sv && sv.byT ? sv.byT[k] : null;
  const cA = bt && bt.atv.client, cV = bt && bt.val.client, g28 = k === '28' && sv;
  const atv = num(o.pAtv) || cA || (g28 && sv.atv.client) || (bt && bt.atv.med) || (k === '28' ? PUMP_KAIN.pumi.atv : null);
  const val = num(o.pVal) || cV || (g28 && sv.val.client) || (bt && bt.val.med) || (k === '28' ? PUMP_KAIN.pumi.val : null);
  if (!atv || !val) return null;
  const src = num(o.pAtv) || num(o.pVal) ? 'įvesta' : (cA || cV || (g28 && sv.atv.client)) ? 'ankstesnės sąlygos' : bt && bt.atv.med ? 'mediana iš sąskaitų (' + t + ')' : 'kainoraštis';
  return { lab: t, atv, val, src };
}
function trKain(o) {
  const sv = DBX() && window.BPDB.services ? window.BPDB.services(o.client) : null;
  const m = num(o.trPrice); if (m) return { v: m, src: 'įvesta' };
  if (sv && sv.tr.client != null) return { v: sv.tr.client, src: 'ankstesnės sąlygos' };
  return { v: (sv && sv.tr.med) || TR_MED, src: 'kainoraštis (mediana)' };
}
function clientPrice(r, o) { const pr = DBX() && r ? window.BPDB.price(r.code, o.client) : null; return pr && pr.client != null ? pr.client : null; }
// Siūloma betono kaina pagal sąlygas: DDP – kliento DDP kaina; EXW / atskirai – kliento EXW kaina; kitaip – kainoraštis (reikia patvirtinti).
function suggestPrice(r, o) {
  const t = termsOf(o, r), pq = DBX() && r ? window.BPDB.price(r.code, o.client) : null, b = (pq && pq.byT) || {};
  const want = t === 'ddp' ? 'DDP' : 'EXW', other = t === 'ddp' ? 'EXW' : 'DDP';
  const sane = (x) => x && x.p >= r.cost * 0.5 && x.p <= r.price * 3;
  if (b[want] && sane(b[want])) return { v: b[want].p, src: 'ankstesnės sąlygos, ' + want + ', ' + Math.round(b[want].q) + ' m³', need: false };
  if (b['?'] && sane(b['?'])) return { v: b['?'].p, src: 'ankstesnės sąlygos (sąlygos nenurodytos), ' + Math.round(b['?'].q) + ' m³', need: false };
  if (b[other] && sane(b[other])) return { v: r.price, src: 'kainoraštis – kliento kaina tik ' + other + ' (' + eur(b[other].p) + ')', need: true };
  return { v: r.price, src: 'kainoraštis', need: true };
}
const manPrice = (o) => num(o.price);
// Ar reikia patvirtinti kainą: betono kaina iš kainoraščio arba transporto / siurblio kaina iš kainoraščio.
function priceNeed(o) {
  const r = recipeById(o.recipeId); if (!r || o.action === 'atsaukti') return false;
  const t = termsOf(o, r), why = [];
  if (manPrice(o) == null && suggestPrice(r, o).need) why.push('betono');
  if (t === 'sep' && trKain(o).src.startsWith('kainoraštis')) why.push('transporto');
  if (!isClientTr(o) && o.pump && o.pump.need) { const pk = pumpKain(o); if (!pk || !/įvesta|ankstesnės/.test(pk.src)) why.push('siurblio'); }
  return why.length ? why : false;
}
const finalPrice = (o, r) => manPrice(o) != null ? manPrice(o) : suggestPrice(r, o).v;
// Kainos patikra: mažiau už savikainą arba > ±30 % nuo siūlomos – „Patikrinkite kainą“.
function priceOdd(o) { const r = recipeById(o.recipeId); if (!r || o.action === 'atsaukti') return null; const v = finalPrice(o, r), sg = suggestPrice(r, o).v; if (v < r.cost) return 'mažesnė už savikainą (' + f2(r.cost) + ')'; if (sg && Math.abs(v - sg) / sg > 0.3) return 'skiriasi nuo siūlomos (' + f2(sg) + ') daugiau nei 30 %'; return null; }
function orderLine(o, tp) {
  const r = recipeById(o.recipeId), ch = tp;
  const t = ch ? fmt(ch.Sm) : (o.time || '[laikas]');
  const what = r ? (r.cls + (r.props.slice(1).length ? ' ' + r.props.slice(1).join(' ') : '') + (r.slump ? ' ' + r.slump : '')) : (o.asked || '[markė]');
  const lines = [];
  lines.push(TX('Data: ', 'Date: ') + (o.date || TX('[data]', '[date]')) + (o.date ? ', ' + wdL(o.date) : ''));
  lines.push((isClientTr(o) ? TX('Atsiėmimas: ', 'Pick-up: ') : TX('Pradžia: ', 'Start: ')) + t);
  if (isClientTr(o)) lines.push(TX('Transportas: kliento', 'Transport: customer') + (o.ctype ? ' (' + o.ctype + ')' : '') + TX(', atsiėmimas iš mazgo ', ', pick-up at plant ') + PLANTS[o.plant].name + ' (' + PLANTS[o.plant].area + ')');
  else lines.push(TX('Objektas: ', 'Site: ') + ([o.object, o.address].filter((x) => x && !/^nenurodyt/i.test(x)).join(', ') || TX('[objektas]', '[site]')));
  lines.push(TX('Betonas: ', 'Concrete: ') + what + ', ' + (o.qty ? String(o.qty).replace('.', ',') : TX('[kiekis]', '[qty]')) + ' m³' + (o.additives ? ' · ' + o.additives : ''));
  const pk = !isClientTr(o) && o.mode !== 'savivartis' && o.pump && o.pump.need ? pumpKain(o) : null;
  if (!isClientTr(o)) lines.push(TX('Siurblys: ', 'Pump: ') + (o.pump && o.pump.need ? (pk ? pk.lab + TX(' · atvykimas ', ' · arrival ') + f2(pk.atv) + TX(' €, ', ' €, ') + f2(pk.val) + TX(' €/val. (min. ' + PMIN + ' val.)', ' €/h (min. ' + PMIN + ' h)') : ptypeOf(o.pump.len) + TX(' · kainą patvirtinsime atskirai', ' · price to be confirmed')) : (o.mode === 'kriause' ? TX('nereikia, pylimas iš kriaušės', 'not needed, direct discharge from the chute') : TX('nereikia', 'not needed'))));
  if (r && o.action !== 'atsaukti') {
    const t = termsOf(o, r), v = finalPrice(o, r);
    if (t === 'ddp') lines.push(TX('Kaina (DDP): ', 'Price (DDP): ') + eur(v) + TX(' su pristatymu', ' incl. delivery'));
    else if (t === 'exw') lines.push(TX('Kaina (EXW): ', 'Price (EXW): ') + eur(v) + ', ' + PLANTS[o.plant].name);
    else { const tk = trKain(o), n = Math.max(1, Math.ceil((Number(o.qty) || 0) / TRIP - 1e-9)); lines.push(TX('Kaina: ', 'Price: ') + eur(v)); lines.push(TX('Transportas: ', 'Transport: ') + String(tk.v.toFixed(2)).replace('.', ',') + TX(' €/reisą (', ' €/trip (') + n + TX(' reis.)', ' trips)')); }
  }
  if (o.mode !== 'savivartis' && o.action !== 'atsaukti') lines.push(TX('Papild. val.: ', 'Extra hour: ') + f2(num(o.papVal) || PAPILD_VAL) + TX(' €/val. (betonvežio laukimas)', ' €/h (truck waiting)'));
  return { text: lines.join('\n'), win: o.win && WIN[o.win] && ch ? { lab: WIN[o.win][2], got: t, date: o.date } : null, changed: ch && o.time && hm(o.time) != null && ch.Sm !== hm(o.time) ? { asked: o.time, got: t, why: ch.ok === false ? '' : (ch.cap ? (ch.cap.opts[0].why || []).join(', ') : (hm(o.time) + 360 - (Number(o.travel) || 40) - LOAD < 360 ? 'per anksti krauti – mazgas pradeda 06:00' : '')) } : null };
}
// Ar vadybininkas (ar BP) užpildė viską, ko reikia patvirtinimui: data, kiekis, receptas visiems tvirtinamiems užsakymams.
function complete(id) {
  const E = S.ed[id]; if (!E || !E.orders.length) return false; const ai = apprIdx(id);
  const act = E.orders.filter((o, i) => !ai.has(i) && !o.skip && o.action !== 'atsaukti');
  return act.length > 0 && act.every((o) => o.date && Number(o.qty) > 0 && o.recipeId);
}
const isQuestion = (id) => { const R = S.res[id]; return !!(R && R.tipas === 'klausimas' && !complete(id)); };
function genReply(id) {
  const L = LETTERS.find((x) => x.id === id), R = S.res[id], E = S.ed[id];
  if (!R || !E) return '';
  LANG = R.kalba === 'en' ? 'en' : 'lt';
  try {
  const hello = TX('Laba diena,\n\n', 'Hello,\n\n');
  if (R.tipas === 'ne_uzsakymas') return R.atsakymas_ne_uzsakymui ? hello + R.atsakymas_ne_uzsakymui + '\n\n' + sig(L) : '';
  const ai = apprIdx(id), live = E.orders.map((o, i) => ({ o, i })).filter((x) => !ai.has(x.i));
  const skipped = live.filter((x) => isSkip(id, x.o, x.i) && x.o.action !== 'atsaukti');
  const actX = live.filter((x) => x.o.action !== 'atsaukti' && !isSkip(id, x.o, x.i));
  const act = actX.map((x) => x.o), canc = live.filter((x) => x.o.action === 'atsaukti').map((x) => x.o);
  let body = '';
  if (canc.length && !act.length) {
    body = TX('patvirtiname, kad ' + (canc.length > 1 ? 'šie užsakymai atšaukti' : 'užsakymas atšauktas') + ':', 'we confirm that ' + (canc.length > 1 ? 'these orders are' : 'the order is') + ' cancelled:') + '\n\n' + canc.map((o) => '– ' + [o.date, o.time, o.object || o.address, o.qty ? o.qty + ' m³' : '', o.ref].filter(Boolean).join(' · ')).join('\n') + '\n\n' + TX('Naują betonavimo datą galite nurodyti atsakydami į šį laišką.', 'You can give a new pouring date by replying to this e-mail.');
  } else if (isQuestion(id) && R.klausimas_klientui) {
    body = TX('dėkojame už užsakymą.', 'thank you for your order.') + '\n\n' + R.klausimas_klientui + '\n\n' + TX('Gavę atsakymą užsakymą įrašysime iš karto ir atsiųsime patvirtinimą.', 'Once we have your answer, we will book the order and send a confirmation.');
  } else {
    const parts = actX.map((x) => orderLine(x.o, timePlan(x.o, id + ':' + x.i)));
    body = (R.tipas === 'pakeitimas' ? TX('pagal Jūsų prašymą pakeitėme užsakymą' + (act.length > 1 ? 'us' : '') + ':', 'as requested, we have changed your order' + (act.length > 1 ? 's' : '') + ':') : TX('patvirtiname Jūsų užsakym' + (act.length > 1 ? 'us' : 'ą') + ':', 'we confirm your order' + (act.length > 1 ? 's' : '') + ':')) + '\n\n' + parts.map((p) => p.text).join('\n\n');
    if (actX.some((x) => x.o.recipeId)) body += '\n\n' + TX('Visos kainos nurodytos be PVM.', 'All prices exclude VAT.');
    const ch = parts.filter((p) => p.changed);
    if (ch.length) body += '\n\n' + ch.map((p) => TX('Jūsų prašytu laiku (' + p.changed.asked + ') ' + (p.changed.why || 'pristatyti negalime') + ', todėl siūlome pradžią ' + p.changed.got + '.', 'We cannot deliver at the requested time (' + p.changed.asked + '), so we propose ' + p.changed.got + '.')).join('\n') + TX(' Jei šis laikas netinka, praneškite – pasiūlysime kitą.', ' If this time does not suit you, let us know and we will offer another.');
    const wn = parts.filter((p) => p.win);
    if (wn.length) body += '\n\n' + TX('Pradžios laiką parinkome pagal Jūsų nurodytą („' + Array.from(new Set(wn.map((p) => p.win.lab))).join('“, „') + '“). Jei laikas netinka – praneškite.', 'We chose the start time within your requested window. If it does not suit you, please let us know.');
    if (skipped.length) body += '\n\n' + skipped.map((x) => TX('Dėl ' + (x.i + 1) + ' užsakymo (' + (x.o.date ? x.o.date.slice(5) : 'be datos') + (x.o.object ? ', ' + x.o.object : '') + ') patikslinsime atskirai.', 'We will confirm order ' + (x.i + 1) + ' (' + (x.o.date ? x.o.date.slice(5) : 'no date') + ') separately.')).join('\n');
    if (R.klausimas_klientui && !complete(id)) body += '\n\n' + R.klausimas_klientui;
    if (act.some((o) => o.qtyApprox)) body += '\n\n' + TX('Kiekį patikslinsime paskutiniu betonvežiu.', 'The final quantity will be adjusted with the last truck.');
    if (R.papildomas_tekstas) body += '\n\n' + R.papildomas_tekstas;
    if (act.some((o) => !isClientTr(o))) body += '\n\n' + TX('Tikslų betonvežių atvykimo grafiką pranešime dieną prieš pristatymą.', 'We will send the exact truck arrival schedule the day before delivery.');
  }
  return hello + body + '\n\n' + sig(L);
  } finally { LANG = 'lt'; }
}

/* ---------- būsenos ---------- */
function apprIdx(id) { const a = S.appr[id]; return new Set(a ? (a.orders || []).map((o) => o._i).concat(a.doneIdx || []) : []); }
function isSkip(id, o, i) { return !!o.skip; }
function isPending(id) { return !(S.closed && S.closed[id]) && !S.rej[id] && (!S.appr[id] || S.appr[id].partial); }
function orderProbs(id, o, i) {
  const p = []; if (o.action === 'atsaukti') return p;
  if (!o.date) p.push({ f: 'date', t: 'nėra datos' });
  if (!(Number(o.qty) > 0)) p.push({ f: 'qty', t: 'nėra kiekio' });
  if (!o.recipeId) p.push({ f: 'rcp', t: 'neparinktas receptas' });
  const tp = timePlan(o, id + ':' + i); if (tp && !tp.ok && !(S.b3 && S.b3[id + ':' + i] && S.b3[id + ':' + i].okT === tp.Sm + 360)) p.push({ f: 'time', t: tp.why.join(', ') + ' – patvirtinkite laiką' });
  const pn = priceNeed(o); if (pn && !o.priceOk) p.push({ f: 'price', t: 'patvirtinkite ' + pn.join(', ') + ' kainą (kainoraštis)' });
  const od = priceOdd(o); if (od && !o.priceChk) p.push({ f: 'price', t: 'patikrinkite kainą: ' + f2(finalPrice(o, recipeById(o.recipeId))) + ' €/m³ – ' + od });
  return p;
}
function status(id) {
  if (S.closed && S.closed[id]) return { k: '', lab: 'UŽDARYTA' };
  if (S.appr[id] && S.appr[id].partial) return { k: 'wait', lab: 'DALINAI PATVIRTINTA' };
  if (S.appr[id]) return { k: 'ok', lab: 'PATVIRTINTA' };
  if (S.rej[id]) return { k: 'bad', lab: 'ATMESTA' };
  if (busy[id]) return { k: 'wait', lab: 'BP SKAITO…' };
  if (S.res[id] && S.res[id]._err) return { k: 'bad', lab: 'AI KLAIDA' };
  if (S.res[id] && S.res[id].tipas) return { k: 'wait', lab: 'LAUKIA JŪSŲ' };
  return { k: '', lab: 'NEANALIZUOTA' };
}

/* ---------- vaizdai ---------- */
function renderAll() { if (S.view === 'load') S.view = 'letters'; renderNav(); if (S.view === 'letters') renderLetters(); else if (S.view === 'load') renderLoad(); else if (S.view === 'recipes') renderRecipes(); else renderSettings(); }
function renderNav() {
  $$('.nvl').forEach((b) => b.setAttribute('aria-current', b.dataset.view === S.view ? 'page' : 'false'));
  $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + S.view; });
  const pending = LETTERS.filter((L) => isPending(L.id)).length;
  $('#nvPending').textContent = pending;
  if ($('#nvApproved')) $('#nvApproved').textContent = Object.values(S.appr).reduce((a, x) => a + (x.orders || []).length, 0);
  const on = !!key(); $('#nvAi').className = 'nv-dot' + (on ? ' on' : ''); $('#nvAi').title = on ? 'AI prijungtas' : 'AI neprijungtas';
  $('#aiState').textContent = on ? 'AI: ' + (MODELS.find((m) => m[0] === S.model) || [S.model, S.model])[1].replace(/ \(.*\)/, '') : 'AI: neprijungtas';
  const B = window.BPDB; $('#aiState').textContent += ' · DB: ' + (B.st.loading ? 'kraunama…' : B.st.ok ? 'prijungta' : 'neprijungta');
  const T = { letters: ['Užsakymai · Priėmimas', 'Gauti laiškai ir tvirtinimas'], load: ['Planavimas · Modeliavimas', 'Dienos apkrova'], recipes: ['Duomenys · BetonPro', 'Receptų duomenų bazė'], settings: ['Testas', 'Nustatymai ir AI'] }[S.view];
  $('#crumb').textContent = T[0]; $('#pageTitle').textContent = T[1];
}
function evC(w) { return Object.values(S.ev).filter((e) => w === 'ok' ? e.ok === true : e.ok === false).length; }
function evalHTML(id) {
  const e = S.ev[id] || {};
  return `<div class="evbar"><span class="eb" style="color:#15171A;font-weight:600">Testo įvertinimas</span><button type="button" class="btn btn-sm ev-ok" data-ev="ok" aria-pressed="${e.ok === true}">✓ Gerai</button><button type="button" class="btn btn-sm ev-bad" data-ev="bad" aria-pressed="${e.ok === false}">✗ Blogai</button>${e.ok != null ? `<input id="evCom" type="text" value="${esc(e.c || '')}" placeholder="${e.ok === false ? 'Kas blogai? pvz.: ne tas receptas, turėjo būti pakeitimas' : 'Komentaras (nebūtina)'}">` : ''}</div>`;
}
function filtered() {
  const lq = (S.lq || '').trim().toLowerCase();
  return LETTERS.filter((L) => {
    const st = status(L.id).k, R = S.res[L.id];
    if (lq && !(L.company + ' ' + (L.subject || '') + ' ' + L.body).toLowerCase().includes(lq)) return false;
    if (S.filter === 'todo') return isPending(L.id);
    if (S.filter === 'closed') return !!(S.closed && S.closed[L.id]);
    if (S.filter === 'orders') return R && R.tipas && R.tipas !== 'ne_uzsakymas';
    if (S.filter === 'done') return st === 'ok';
    if (S.filter === 'none') return !R || !R.tipas;
    if (S.filter === 'bad') return S.ev[L.id] && S.ev[L.id].ok === false;
    if (S.filter === 'unev') return !S.ev[L.id] || S.ev[L.id].ok == null;
    return true;
  });
}
/* Telefone: grafikai rodo ±3 val. aplink pasirinktą laiką, kitas valandas – slenkant (kairė / dešinė skalės lieka vietoje);
   paspaudus „Visas ekranas“ – visa diena per visą ekraną. Visi grafiko blokai slenka kartu. */
let B3FS = null;
function b3mob() {
  const mob = isMob();
  $$('.b3c').forEach((c) => {
    const fs = B3FS != null && String(B3FS) === c.dataset.bi;
    c.classList.toggle('fs', fs); document.body.classList.toggle('b3fs-on', B3FS != null && !!$('.b3c.fs'));
    const zoom = mob && !fs;
    c.classList.toggle('zm', zoom);
    if (!zoom) { c.style.removeProperty('--zw'); c.style.removeProperty('--zwp'); return; }
    // matomas langas – 6 val.: kairė etikečių / skalės juosta 92 px, dešinė 70 px – visuose blokuose vienodai
    const pl = c.querySelector('.b3pl2'), hz = Number(pl && pl.dataset.hz) || 24, span = hz * 30;
    const W = c.clientWidth, vw = Math.max(120, W - 162), zw = Math.round(vw * Math.max(1, hz / 2 / 6)); c.style.setProperty('--zw', zw + 'px');
    const sc = [...c.querySelectorAll('.b3c-ch, .b3axrow, .b3pumps')];
    const sel = c.querySelector('.b3o[aria-pressed="true"]'), m = sel ? Number(sel.dataset.b3t.split(':')[1]) : 480;
    const x = Math.max(0, (m - 360) / span * zw - vw / 2);
    if (c.dataset.zinit !== String(m)) { sc.forEach((s) => { s.scrollLeft = x; }); c.dataset.zinit = String(m); }
    if (!c.dataset.zsync) {
      c.dataset.zsync = '1'; let lock = false;
      sc.forEach((s) => s.addEventListener('scroll', () => { if (lock) return; lock = true; sc.forEach((o) => { if (o !== s) o.scrollLeft = s.scrollLeft; }); requestAnimationFrame(() => { lock = false; }); }, { passive: true }));
    }
  });
}
const isMob = () => window.matchMedia('(max-width:820px)').matches;
function renderLetters() { renderList(); renderDetail(); renderSide(); }
// Matavimas: kiek užsakymų laiškų galima priimti iš karto (BP užpildė datą, kiekį, receptą; laikas galimas; klausti nereikia), kiek reikia pataisyti, kiek lieka klausimų klientui.
function quickStats() {
  const r = { quick: [], fix: [], ask: [], err: [], info: [], orders: 0, ordersQuick: 0 };
  LETTERS.forEach((L) => {
    const R = S.res[L.id]; if (!R || !R.tipas) { if (R && R._err) r.err.push(L.id); return; }
    if (R.tipas === 'ne_uzsakymas') { r.info.push(L.id); return; }
    const E = S.ed[L.id] || { orders: [] }, os = E.orders.map((o, i) => ({ o, i })).filter((x) => x.o.action !== 'atsaukti');
    if (!E.orders.length) { r.err.push(L.id); return; }
    if (!os.length) { r.quick.push(L.id); return; }
    r.orders += os.length;
    const ok = os.filter((x) => x.o.date && Number(x.o.qty) > 0 && x.o.recipeId && !orderProbs(L.id, x.o, x.i).length);
    r.ordersQuick += ok.length;
    if (isQuestion(L.id)) r.ask.push(L.id); else if (ok.length === os.length) r.quick.push(L.id); else r.fix.push(L.id);
  });
  const n = r.quick.length + r.fix.length + r.ask.length + r.err.length; r.n = n; r.pct = n ? Math.round(r.quick.length / n * 100) : 0;
  return r;
}
function tagOf(L) {
  const R = S.res[L.id], ty = R && R.tipas ? TYPES[R.tipas] : null, E = S.ed[L.id];
  let lab = ty ? ty.lab : 'Neanalizuota';
  if (R && R.tipas === 'naujas') lab = '+ Naujas užsakymas' + (R.kalba && R.kalba !== 'lt' ? ' · ' + R.kalba.toUpperCase() : '');
  if (R && R.tipas === 'grafikas') lab = 'Grafikas' + (E && E.orders.length ? ' · ' + E.orders.length + ' užs.' : '');
  let c = 'y';
  if (S.sent && S.sent[L.id]) { c = 'g'; lab = '✓ Atsakyta'; }
  else if (S.closed && S.closed[L.id]) { c = 'n'; lab = 'Uždaryta'; }
  else if (S.rej[L.id]) { c = 'n'; lab = 'Atmesta'; }
  else if (S.appr[L.id] && !S.appr[L.id].partial) { c = 'g'; lab = '✓ Patvirtinta'; }
  else if (S.appr[L.id]) { c = 'y'; lab = 'Dalinai patvirtinta'; }
  else if (busy[L.id]) { c = 'y'; lab = 'BP skaito…'; }
  else if (R && R._err && !R.tipas) { c = 'r'; lab = 'AI klaida'; }
  else if (!ty || (R && R.tipas === 'ne_uzsakymas')) c = 'n';
  return `<span class="ltag ltag-${c}">${esc(lab)}</span>`;
}
function renderList() {
  const q = quickStats(), cnt = (f) => LETTERS.filter((L) => f === 'all' ? true : f === 'todo' ? isPending(L.id) : f === 'done' ? status(L.id).k === 'ok' : !S.res[L.id] || !S.res[L.id].tipas).length;
  const nOk = cnt('done'), nAll = Math.max(1, LETTERS.length), nWait = Math.max(0, cnt('todo') - cnt('none'));
  $('#strip').innerHTML = `<div class="segf" role="group" aria-label="Filtrai">${[['all', 'Gauti'], ['todo', 'Laukia peržiūros'], ['done', 'Patvirtinti'], ['none', 'Neanalizuoti']].map(([k, l]) => `<button type="button" data-f="${k}" aria-pressed="${S.filter === k}">${l} <b>${cnt(k)}</b></button>`).join('')}</div>
    <div class="kprog" title="Žalia – patvirtinta ${nOk}; geltona – BP perskaitė, laukia ${nWait}"><div class="kbar"><i class="g" style="width:${(nOk / nAll * 100).toFixed(1)}%"></i><i class="y" style="width:${(nWait / nAll * 100).toFixed(1)}%"></i><span class="shim"></span></div><div class="kpl"><span>Priimama iš karto <b>${q.n ? q.pct + ' %' : '–'}</b></span><span>${q.n ? q.quick.length + ' iš ' + q.n + (q.fix.length ? ' · taisyti ' + q.fix.length : '') : 'dar neanalizuota'}</span></div></div>`;
  $('#filters').innerHTML = `<div class="lh"><span class="eb">Gautieji · uzsakymai@</span><span class="mono muted">${LETTERS.length}</span></div>
    <div class="lsearch"><input type="search" id="lq" value="${esc(S.lq || '')}" placeholder="Ieškoti: klientas, objektas, markė" aria-label="Ieškoti laiškų"></div>
    <div class="ltest"><button type="button" class="flt" id="runAll" ${key() ? '' : 'disabled'} title="Perskaityti visus neanalizuotus laiškus su AI">${BP} Analizuoti visus</button><button type="button" class="flt" data-f="bad" aria-pressed="${S.filter === 'bad'}">✗ Blogai</button><button type="button" class="flt" data-f="unev" aria-pressed="${S.filter === 'unev'}">Neįvertinti</button></div>`;
  const list = filtered();
  if (!S.sel || !LETTERS.find((L) => L.id === S.sel)) S.sel = LETTERS[0] && LETTERS[0].id;
  $('#list').innerHTML = list.map((L) => {
    const R = S.res[L.id];
    const qc = R && R.tipas === 'ne_uzsakymas' && isPending(L.id) ? `<button type="button" class="li-x" data-close="${L.id}" title="Atlikta – nerodyti" aria-label="Atlikta – nerodyti">✓</button>` : '';
    return `<li class="li-w">${qc}<button type="button" class="li" data-id="${L.id}" aria-current="${S.sel === L.id}">
      <span class="li-top"><b>${esc(L.company)}</b><span class="li-time mono">${L.received.slice(5, 16).replace('T', ' ')}</span></span>
      <span class="li-snip">${esc((L.subject ? L.subject + ' – ' : '') + L.body.replace(/\s+/g, ' ').slice(0, 160))}</span>
      <span class="li-top">${tagOf(L)}<span style="flex:1"></span>${S.ev[L.id] && S.ev[L.id].ok != null ? `<span class="evm ${S.ev[L.id].ok ? 'ok' : 'bad'}" title="${esc(S.ev[L.id].c || '')}">${S.ev[L.id].ok ? '✓' : '✗'}</span>` : ''}</span>
    </button></li>`;
  }).join('') || '<li class="empty">Nėra laiškų pagal filtrą</li>';
}
function fieldHTML(label, name, val, opts) {
  opts = opts || {};
  const id = 'f-' + name + '-' + Math.random().toString(36).slice(2, 7);
  const inp = opts.select ? `<select id="${id}" data-k="${name}">${opts.select.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(val) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
    : `<input id="${id}" data-k="${name}" type="${opts.type || 'text'}" value="${esc(val)}" ${opts.ph ? `placeholder="${esc(opts.ph)}"` : ''} ${opts.step ? `step="${opts.step}"` : ''}>`;
  return `<div class="fld${opts.miss ? ' miss' : ''}"><label for="${id}">${label}</label>${inp}${opts.src ? `<span class="src">${esc(opts.src)}</span>` : ''}</div>`;
}
function chartHTML(base, nt, plant, lim, step) {
  step = step || 10; const bars = [];
  let mxv = Math.max(lim + 2, 6);
  for (let m = 0; m < DAY; m += step) { let b = 0, n = 0; for (let k = m; k < m + step; k++) { b = Math.max(b, base.tm[plant][k]); n = Math.max(n, base.tm[plant][k] + (nt ? nt.tm[plant][k] : 0)); } bars.push([b, n]); mxv = Math.max(mxv, n); }
  const h = (v) => (v / mxv * 100).toFixed(1) + '%';
  return `<div class="chart" role="img" aria-label="Betonvežių užimtumas ${PLANTS[plant].name}">${bars.map(([b, n]) => n > b ? `<div class="bar ${n > lim ? 'over' : 'new'}" style="height:${h(n)}" title="${n} betonv."></div>` : `<div class="bar${b > lim ? ' over' : ''}" style="height:${h(b)}" title="${b} betonv."></div>`).join('')}<span class="lim" style="bottom:${h(lim)}"></span></div>
  <div class="axis"><span>06</span><span>08</span><span>10</span><span>12</span><span>14</span><span>16</span><span>18</span></div>`;
}
// Atpažinti laiško fragmentai – geltonai (pagal užpildytus laukus).
const sentences = (s) => String(s || '').split(/\n+|(?<=[.!?])\s+(?=[A-ZĄČĘĖĮŠŲŪŽ„(0-9])/).map((x) => x.trim()).filter(Boolean);
// BP atsakymai į pastabas: iš atsakymai_i_pastabas; seniems rezultatams – sprendimas, prasidedantis „P1:“.
function noteReplies(R) {
  const m = {}; if (!R) return m;
  (R.atsakymai_i_pastabas || []).forEach((a) => { if (a && a.nr) m[a.nr] = a.tekstas; });
  if (!Object.keys(m).length) { const k = String(R.sprendimas || '').trim().match(/^P(\d+)\s*[:–-]\s*/); if (k) m[k[1]] = String(R.sprendimas).trim().slice(k[0].length); }
  return m;
}
function markTerms(E) {
  const out = [];
  (E ? E.orders : []).forEach((o) => {
    [o.asked, o.object, o.address, o.ctype, o.additives].forEach((v) => { String(v || '').split(/[,;]/).map((x) => x.trim()).filter((x) => x.length >= 4 && !/nenurodyt/i.test(x)).forEach((x) => out.push(x)); });
    (o.props || []).forEach((x) => { if (String(x).length >= 3) out.push(String(x)); });
    if (o.time) out.push(o.time, o.time.replace(':', '.'), String(Number(o.time.slice(0, 2))) + ' val');
    if (o.date) { const m = Number(o.date.slice(5, 7)), d = Number(o.date.slice(8, 10)); out.push(m + '.' + d + 'd', m + '.' + d, String(m).padStart(2, '0') + '.' + String(d).padStart(2, '0'), o.date.slice(5)); }
    if (o.pump && o.pump.len) out.push(String(o.pump.len) + ' m', 'pumi', 'pumik', 'siurbl');
    if (Number(o.qty) > 0) { const q = String(o.qty).replace('.', '[.,]'); out.push({ re: '(\\d+[,.]?\\d*\\s*[-–]\\s*)?' + q + '\\s*(m3|m³|kub|kubai|kub\\.)' }); }
  });
  ['ryte', 'rytą', 'po pietų', 'pirmoje pusėje', 'antroje pusėje', 'vakare'].forEach((w) => out.push(w));
  return out;
}
function markText(txt, E, on) {
  const base = esc(txt); if (!on || !E) return base;
  const parts = markTerms(E).map((x) => typeof x === 'string' ? esc(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : x.re).filter(Boolean);
  if (!parts.length) return base;
  parts.sort((a, b) => b.length - a.length);
  let re; try { re = new RegExp('(' + parts.join('|') + ')', 'gi'); } catch (e) { return base; }
  return base.split(/(<[^>]+>)/).map((seg) => seg.startsWith('<') ? seg : seg.replace(re, '<mark>$1</mark>')).join('');
}
const LOGO = (c) => `<span class="bpl"${c ? ` style="color:${c}"` : ''} role="img" aria-label="BetonPro"><i class="a"></i><i class="b"></i><i class="c"></i><i class="y"></i>BP</span>`;
const XB = (attr, lab, open) => `<button type="button" class="xb" ${attr} aria-label="${lab}" title="${lab}" aria-expanded="${!!open}"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="${open ? 'M3 9l4-4 4 4' : 'M3 5l4 4 4-4'}" fill="none" stroke="currentColor" stroke-width="1.8"/></svg></button>`;
function clientChips(L) {
  const U = fwdOf(L); let h = '';
  if (U) h += `<div class="chips"><span class="eb muted">Užsakovas</span><span class="chip"><b>${esc(U.u.vardas || '')}</b>${U.u.imone ? '&nbsp;· ' + esc(U.u.imone) : ''}</span>${U.u.tel ? `<span class="chip mono">${esc(U.u.tel)}</span>` : ''}${U.u.el_pastas ? `<span class="chip mono">${esc(U.u.el_pastas)}</span>` : ''}</div><div class="chips"><span class="eb muted">Persiuntė</span><span class="chip"><b>${esc(L.contact.name)}</b>${U.p && U.p.imone ? '&nbsp;· ' + esc(U.p.imone) : ''}</span>${L.contact.mail ? `<span class="chip mono">${esc(L.contact.mail)}</span>` : ''}</div>`;
  const db = [];
  if (DBX()) {
    const c = window.BPDB.card(L.company), hs = window.BPDB.summary(L.company), n = (x) => Number(x) || 0;
    if (hs) db.push(`<span class="chip">6 mėn.: ${hs.n} užs. · ${Math.round(hs.m3)} m³ · ${hs.plants.map((p) => esc(p[0]) + ' ' + p[1]).join(', ')}</span>`);
    if (c) { db.push(`<span class="chip">Kredito limitas ${n(c.kredito_dydis).toLocaleString('lt')} € · terminas ${n(c.terminas)} d.</span>`); if (n(c.skolos_dydis)) { const over = n(c.skolos_dydis) - n(c.kredito_dydis); db.push(`<span class="chip${over > 0 ? ' chip-bad' : ''}"><b>Skola ${Math.round(n(c.skolos_dydis)).toLocaleString('lt')} €${over > 0 ? ' · viršyta ' + Math.round(over).toLocaleString('lt') + ' €' : ''}</b></span>`); } }
    if (!c && !hs) db.push('<span class="chip muted">BetonPro kortelės nerasta</span>');
  }
  const AD = addrOf(L); if (AD) h += `<div class="chips"><span class="chip">Adresuota: <b>&nbsp;${esc(AD.n.split(' ')[0])}</b></span></div>`;
  if (!U) h += `<div class="chips"><span class="chip"><b>${esc(L.contact.name)}</b>${L.contact.role ? '&nbsp;· ' + esc(L.contact.role) : ''}</span>${L.contact.tel ? `<span class="chip mono">${esc(L.contact.tel)}</span>` : ''}${L.contact.mail ? `<span class="chip mono">${esc(L.contact.mail)}</span>` : ''}${db.join('')}</div>`;
  else if (db.length) h += `<div class="chips">${db.join('')}</div>`;
  return h;
}
function renderDetail() {
  const L = LETTERS.find((x) => x.id === S.sel), el = $('#detail');
  if (!L) { el.innerHTML = '<div class="card empty">Pasirinkite laišką</div>'; return; }
  const R = S.res[L.id], E = S.ed[L.id], done = !!S.appr[L.id] && !S.appr[L.id].partial;
  const notes = S.notes[L.id] || [];
  const fl = filtered(), pos = fl.findIndex((x) => x.id === L.id), prv = pos > 0 ? fl[pos - 1] : null, nxt = pos >= 0 && pos < fl.length - 1 ? fl[pos + 1] : null;
  const FLAB = { all: 'Gauti', todo: 'Laukia peržiūros', none: 'Neanalizuoti', done: 'Patvirtinti', bad: '✗ Blogai', unev: 'Neįvertinti' };
  const ty = R && R.tipas ? (TYPES[R.tipas] || TYPES.naujas) : null, rd = !!(R && R.tipas);
  let h = evalHTML(L.id) + `<nav class="lnav" aria-label="Laiškai"><button type="button" class="btn mback" data-mback>← Visi laiškai</button><button type="button" class="btn btn-ghost" data-lgo="${prv ? prv.id : ''}" ${prv ? '' : 'disabled'}>← Ankstesnis</button><span class="mono muted">${pos >= 0 ? pos + 1 : '–'} iš ${fl.length} · ${esc(FLAB[S.filter] || '')}</span><button type="button" class="btn btn-dark" data-lgo="${nxt ? nxt.id : ''}" ${nxt ? '' : 'disabled'}>Kitas laiškas →</button></nav>`;
  h += `<article class="card lcard"><div class="lbar">${LOGO('#FAF9F6')}<b>${esc(ty ? ty.lab : 'Naujas laiškas')}</b><span style="flex:1"></span><span class="mono">${esc(L.box)} · ${L.received.replace('T', ' ').slice(0, 16)} · ${esc(L.channel)}</span></div>
    <div class="lbody"><span class="ar lco">${esc(L.company)}</span>${clientChips(L)}
    <div class="lmsg"><div class="lmsg-h"><span><span class="eb">Laiško tekstas</span> · Tema: ${markText(L.subject || '', E, rd)}</span>${rd ? `<button type="button" class="lnk" data-msg="${L.id}">${S.msgOpen[L.id] ? 'Suskleisti laišką' : 'Rodyti visą laišką'}</button>` : ''}</div>
      <div class="msg${rd && !S.msgOpen[L.id] ? ' clamp' : ''}">${markText(L.body, E, rd)}</div>
      ${(L.attachments || []).map((a) => `<details class="att" ${R ? '' : 'open'}><summary>📎 ${esc(a.name)}</summary><pre>${esc(a.text)}</pre></details>`).join('')}
      ${rd ? `<div class="lmsg-f">Geltonai pažymėta tai, ką ${BP} atpažino.</div>` : ''}</div></div>`;
  if (rd) {
    const tr = trukstaShown(L.id), li = [];
    const oldP = !(R.atsakymai_i_pastabas || []).length && /^P\d+\s*[:–-]/.test(String(R.sprendimas || '').trim());
    if (!oldP) sentences(R.sprendimas).forEach((x) => li.push(x));
    sentences(R.paaiskinimas).slice(0, 4).forEach((x) => li.push(x));
    if (tr.length) li.push('Trūksta: ' + tr.join('; '));
    if (R._err) li.push('Paskutinis bandymas nepavyko: ' + R._err);
    h += `<div class="sol"><b>Siūlomas sprendimas</b><ul>${li.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`;
  }
  h += `</article>`;
  if (busy[L.id]) h += `<div class="ai-band"><span class="spin"></span><span class="sum">${BP} skaito laišką ir priedus…</span></div>`;
  else if (!R || (!R.tipas && !R._err)) h += `<div class="card"><div class="card-b"><span>${BP} šio laiško dar neskaitė.</span><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-dark" id="runOne" ${key() ? '' : 'disabled'}>${BP} Analizuoti laišką</button><button type="button" class="btn" id="manual">Pildyti ranka</button></div>${key() ? '' : '<span class="warn">AI neprijungtas – įveskite API raktą skiltyje „Nustatymai ir AI“. Be AI galite pildyti juodraštį ranka.</span>'}</div></div>`;
  else if (R._err && !R.tipas) h += `<div class="err">AI klaida: ${esc(R._err)} <button type="button" class="btn btn-sm" id="runOne">Bandyti dar kartą</button></div>`;
  if (R && R.tipas && ['grafikas', 'naujas', 'pakeitimas'].includes(R.tipas) && !(R.uzsakymai || []).length) h += `<div class="err"><b>${BP} atsakymas nepilnas</b> – atpažintas ${esc((TYPES[R.tipas] || {}).lab || R.tipas)}, bet užsakymų eilučių negrąžinta. <button type="button" class="btn btn-sm" id="rerun" ${key() ? '' : 'disabled'}>${BP} Skaityti iš naujo</button></div>`;
  h += `<div class="card pinfo"><span class="eb" style="font-weight:600;color:#15171A">Papildoma informacija</span>
      ${(() => { const nr = noteReplies(R); return notes.map((n, i) => `<div class="bub"><b class="badge">P${i + 1}</b> ${esc(n)}</div>` + (nr[i + 1] ? `<div class="bub-bp">${BP}<span>${sentences(nr[i + 1]).map(esc).join('<br>')}</span></div>` : busy[L.id] && i === notes.length - 1 ? `<div class="bub-bp">${BP}<span class="muted">skaito…</span></div>` : '')).join(''); })()}
      <div class="pinfo-r"><textarea id="noteTa" rows="1" aria-label="Papildoma informacija" placeholder="pvz.: skambino – siurblio reikia 36 m, pradžia 9:00" ${done ? 'disabled' : ''}>${esc(S.nd[L.id] || '')}</textarea><button type="button" class="btn" id="noteSend" ${done ? 'disabled' : ''}>Pateikti ${LOGO()}</button></div></div>`;
  if (E) {
    if (!E.orders.length && R && R.tipas !== 'ne_uzsakymas') h += `<div class="warn">Užsakymų nerasta.</div>`;
    if (E.orders.length > 1) { const ai = apprIdx(L.id); h += `<nav class="onav" aria-label="Užsakymai">${E.orders.map((o, i) => { const pb = ai.has(i) || done ? [] : orderProbs(L.id, o, i); return `<button type="button" class="onav-b ${ai.has(i) || done ? 'ok' : pb.length ? 'bad' : 'ok'}" data-jumpo="${i}" title="${esc(orderSummary(o, null))}">${i + 1}<small>${ai.has(i) || done ? '✓' : pb.length ? '⚠' : '✓'}</small></button>`; }).join('')}</nav>`; }
    E.orders.forEach((o, i) => { h += orderHTML(L, o, i, done && !(S.appr[L.id] || {}).partial); });
    if (!done) h += `<div><button type="button" class="btn btn-ghost" id="addOrder">+ Pridėti užsakymą ranka</button></div>`;
  }
  el.innerHTML = h;
}
// „Trūksta“ – tik tai, ko iš tikrųjų nėra formoje: siurblio ilgis (kai siurblys parinktas), laikas (kai yra laiko langas ar laikas), slankumas, apytikslis kiekis – sprendžiame patys.
function trukstaShown(id) {
  const R = S.res[id], E = S.ed[id]; if (!R) return [];
  const os = E ? E.orders : [], all = (f) => os.length && os.every(f);
  return (R.truksta || []).filter((t) => {
    const x = String(t).toLowerCase();
    if (/siurbl|pumi|pump/.test(x) && all((o) => !o.pump || !o.pump.need || o.pump.len)) return false;
    if (/laik|valand/.test(x) && all((o) => o.time || o.win)) return false;
    if (/slankum/.test(x)) return false;
    if (/kiek/.test(x) && all((o) => Number(o.qty) > 0)) return false;
    if (/dat/.test(x) && all((o) => o.date)) return false;
    if (/objekt|adres/.test(x) && all((o) => o.address || o.object)) return false;
    if (/mark|klas|recept/.test(x) && all((o) => o.recipeId)) return false;
    return true;
  });
}
function dbCardHTML(L) {
  if (!DBX()) return '';
  const c = window.BPDB.card(L.company), h = window.BPDB.summary(L.company);
  if (!c && !h) return `<div class="dbc"><span class="eb muted">BetonPro</span><span class="muted">Kliento kortelės ir užsakymų nerasta.</span></div>`;
  const n = (x) => Number(x) || 0;
  return `<div class="dbc"><span class="eb muted">BetonPro kortelė</span>${c ? `<b>${esc(c.name)}</b>${c.person ? `<span class="chip"><b>${esc(c.person)}</b></span>` : ''}${c.tel ? `<a class="chip mono" href="tel:${esc(String(c.tel).replace(/\s/g, ''))}">${esc(c.tel)}</a>` : ''}${c.email ? `<a class="chip mono" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}
    <span class="chip">kredito limitas ${n(c.kredito_dydis).toLocaleString('lt')} € · terminas ${n(c.terminas)} d.${n(c.skolos_dydis) ? ' · skola ' + Math.round(n(c.skolos_dydis)).toLocaleString('lt') + ' €' : ''}</span>` : '<span class="muted">kortelės nerasta</span>'}
    ${h ? `<span class="chip">6 mėn.: ${h.n} užs. · ${Math.round(h.m3)} m³ · ${h.plants.map((p) => esc(p[0]) + ' ' + p[1]).join(', ')}</span>` : ''}</div>`;
}
function histHTML(L, o) {
  if (!DBX() || !o.client) return '';
  const before = L.received.slice(0, 10), same = window.BPDB.sameAddress(o.client, (o.address || '') + ' ' + (o.object || ''), before);
  const fact = o.date ? window.BPDB.factsOn(o.client, o.date) : [];
  const row = (x) => `<tr><td class="mono">${x.date} ${x.time}</td><td>${esc(x.plantName)}</td><td class="mono">${esc(x.code)}</td><td>${esc(x.cls)}</td><td class="mono">${(Math.round(x.m3 * 10) / 10).toString().replace('.', ',')}</td><td class="mono">${x.trips.length}</td><td>${esc(x.address)}</td></tr>`;
  let h = `<div class="hist"><span class="eb muted">BetonPro istorija · ${esc(o.client)}</span>`;
  if (same.length) { const l = same[same.length - 1]; h += `<div class="okbox">Į šį objektą vežta ${same.length} k. Paskutinį kartą ${l.date} iš ${esc(l.plantName)} (${esc(l.code)}, ${esc(l.cls)}).${o.plant && PLANTS[o.plant] && l.plant && l.plant !== o.plant ? ' <b>Dabar parinktas kitas mazgas – ' + esc(PLANTS[o.plant].name) + '.</b>' : ''}</div>`; }
  else h += `<div class="note">Į šį objektą (pagal adresą) iki laiško nevežta.</div>`;
  if (fact.length) h += `<details open><summary class="muted" style="font-size:12.5px;cursor:pointer">Faktas BetonPro ${esc(o.date)} – kaip šis užsakymas buvo įvykdytas (${fact.length})</summary><table class="tb"><thead><tr><th>Laikas</th><th>Mazgas</th><th>Kodas</th><th>Klasė</th><th>m³</th><th>Reisai</th><th>Adresas</th></tr></thead><tbody>${fact.map(row).join('')}</tbody></table></details>`;
  else if (o.date) h += `<div class="muted" style="font-size:12.5px">BetonPro ${esc(o.date)} šiam klientui užsakymų nėra.</div>`;
  return h + `</div>`;
}
// Laikas – valandos tikslumu: 06:00 … 22:00 (jei klientas nurodė pvz. 07:30 – paliekama ir ši reikšmė).
function timeOpts(cur) { const a = [['', '— nenurodyta']]; for (let h = 6; h <= 22; h++) a.push([String(h).padStart(2, '0') + ':00', String(h).padStart(2, '0') + ':00']); if (cur && !a.some((x) => x[0] === cur)) a.push([cur, cur]); return a.sort((x, y) => x[0].localeCompare(y[0])); }
const okTime = (t) => { const m = String(t || '').match(/^(\d{1,2})[:.](\d{2})/); if (!m) return ''; const h = Number(m[1]), mi = Number(m[2]); return h >= 5 && h <= 22 && mi < 60 ? String(h).padStart(2, '0') + ':' + m[2] : ''; };
function orderSummary(o, tp) {
  const r = recipeById(o.recipeId), t = tp ? fmt(tp.Sm) : (o.win && WIN[o.win] ? WIN[o.win][2] : (o.time || '—'));
  const mode = o.mode === 'savivartis' ? 'pasiima pats' : o.mode === 'kriause' ? 'kriaušė' : (o.pump && o.pump.need ? ptypeOf(o.pump.len) : 'betonvežiu');
  return [o.date ? ['Sk', 'Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št'][new Date(o.date + 'T12:00:00').getDay()] + ' ' + o.date.slice(5) : 'be datos', t, o.object || o.address || '', r ? r.code + ' ' + r.cls : (o.asked || '—'), o.qty ? String(o.qty).replace('.', ',') + ' m³' : '— m³', mode, PLANTS[o.plant] ? PLANTS[o.plant].name : ''].filter(Boolean).map(esc).join(' · ');
}
// Antraštė dviem eilutėmis: 1) data · laikas (prašo → parinkta) · objektas; 2) m³ · receptas · siurblys · mazgas.
function orderHead(o, tp) {
  const r = recipeById(o.recipeId), got = tp ? fmt(tp.Sm) : '';
  const day = o.date ? ['Sk', 'Pr', 'An', 'Tr', 'Kt', 'Pn', 'Št'][new Date(o.date + 'T12:00:00').getDay()] + ' ' + o.date.slice(5) : 'be datos';
  let t = got || o.time || '—';
  if (o.win && WIN[o.win] && got) t = WIN[o.win][2] + ' → ' + got; else if (o.time && got && o.time !== got) t = 'prašo ' + o.time + ' → ' + got;
  const obj = [o.object, o.address].filter((x) => x && !/nenurodyt/i.test(x))[0] || 'objektas nenurodytas';
  const pump = isClientTr(o) ? 'kliento transportas' + (o.ctype ? ' (' + o.ctype + ')' : '') : o.pump && o.pump.need ? ptypeOf(o.pump.len) + (tp && tp.pumpCar ? ' · ' + (tp.pumpCar === 'samdomas' ? 'samdomas' : tp.pumpCar) : '') : o.mode === 'kriause' ? 'iš kriaušės' : 'betonvežiu';
  const l1 = [day, t, obj].map(esc).join(' · ');
  const l2 = [`<b>${o.qty ? String(o.qty).replace('.', ',') : '—'} m³</b>`, r ? esc(r.code + ' ' + [r.cls].concat(r.props.slice(1)).join(' ') + (r.slump ? ' ' + r.slump : '')) : '<span class="bad">receptas neparinktas</span>', r ? esc(eur(finalPrice(o, r)) + ' ' + ({ ddp: 'DDP', sep: 'EXW', exw: 'EXW' })[termsOf(o, r)]) : '', esc(pump), PLANTS[o.plant] ? esc(PLANTS[o.plant].name) : ''].filter(Boolean).join(' · ');
  return `<span class="osum">${l1}</span><span class="osum2">${l2}</span>`;
}
// Recepto blokas: kodas + savybės, kaina klientui + DDP/EXW, marža, kainų stulpeliai (kliento, vidutinė, kainoraštis, savikaina).
const PAPILD_VAL = 40; // betonvežio papildoma valanda objekte, €/val. (kainoraštis)
function rcpBlockHTML(o, r, i, done, ro) {
  const t = termsOf(o, r), sg = suggestPrice(r, o), v = finalPrice(o, r), pq = DBX() ? window.BPDB.price(r.code, o.client) : null, pn = priceNeed(o);
  const used = ro && ro.used, took = !!((pq && pq.client != null) || (used && used.has && used.has(String(r.code).toUpperCase())));
  const badge = o.rcpWhy === 'same' && o.rcpFrom ? 'Kaip ' + o.rcpFrom + ' užsakyme' : DBX() && o.client ? (took ? 'Pagal istoriją' : 'Šiam klientui netiekta') : 'Parinkta';
  const x = classify(r, ro ? ro.req : []);
  const pr = r.props.map((p) => `<span class="tag${x.extra && x.extra.includes(p) ? ' y' : ''}">${esc(p)}</span>`).join('') + (r.slump ? `<span class="tag">${esc(r.slump)}</span>` : '') + (r.dmax ? `<span class="tag">Dmax${r.dmax}</span>` : '');
  const cl = isClientTr(o), exw = t !== 'ddp';
  const pc = (l, val, sm) => `<div class="pc"><span class="eb">${l}</span><b>${val}</b><small>${sm || '&nbsp;'}</small></div>`;
  const n2 = (x) => x == null ? '—' : x.toFixed(2).replace('.', ',');
  const cm = [];
  if (x.extra && x.extra.length) cm.push('neprašyta: ' + x.extra.join(', '));
  if (DBX() && o.client) { const same = window.BPDB.sameAddress ? window.BPDB.sameAddress(o.client, (o.address || '') + ' ' + (o.object || ''), '') : []; if (same && same.length) cm.push('vežta į ' + (o.object || 'šį objektą') + ' ' + same.length + ' k.'); }
  let h = `<div class="blk" data-f="price" id="rcp-${i}"><div class="blk-h"><b class="mono" style="font-size:15px;margin-right:6px">${esc(r.code)}</b>${pr}<span style="flex:1"></span><span class="eb okchip">${esc(badge)}</span>${done ? '' : XB(`data-rcpopen="${i}"`, 'Keisti receptą', false)}</div>
    <div class="blk-b"><div class="rp"><div class="rp-in"><label class="eb" for="pk-${i}">Kaina klientui, €/m³</label>
      <div class="rp-r"><input id="pk-${i}" data-k="price" type="text" inputmode="decimal" autocomplete="off" value="${manPrice(o) != null ? f2(manPrice(o)) : ''}" placeholder="${f2(sg.v)}" ${done ? 'disabled' : ''}><label><input type="radio" name="tr-${i}" data-k="terms" value="ddp" ${!exw ? 'checked' : ''} ${done || cl ? 'disabled' : ''}> DDP</label><label><input type="radio" name="tr-${i}" data-k="terms" value="sep" ${exw ? 'checked' : ''} ${done || cl ? 'disabled' : ''}> EXW</label></div>
      <span class="${v - r.cost > 0 ? 'okt' : 'bad'}" style="font-size:12px">marža <b class="mono">${n2(v - r.cost)} €/m³</b></span></div>
      <div class="rp-c">${pc('Kliento', pq && pq.client != null ? n2(pq.client) : '—', pq && pq.client != null ? Math.round(pq.clientQ) + ' m³' + (pq.type ? ' · ' + esc(pq.type) : '') : 'netiekta')}${pc('Vidutinė', pq ? n2(pq.avg) : '—', 'visų klientų')}${pc('Kainoraštis', n2(r.price))}${pc('Savikaina', n2(r.cost))}</div></div>
      ${cm.length ? `<span class="rcp-cm">${esc(cm.join(' · '))}</span>` : ''}
      ${(() => { const od = priceOdd(o); return od ? (o.priceChk ? `<span class="okt" style="font-size:12.5px">✓ Kaina patikrinta ${done ? '' : `<button type="button" class="lnk" data-pricechk="${i}">atšaukti</button>`}</span>` : `<div class="pneed">⚠ Patikrinkite kainą: ${esc(f2(v))} €/m³ – ${esc(od)} ${done ? '' : `<button type="button" class="btn btn-sm btn-dark" data-pricechk="${i}">✓ Kaina teisinga</button>`}</div>`) : ''; })()}
      ${pn && pn.includes('betono') ? (o.priceOk ? `<span class="okt" style="font-size:12.5px">✓ Kaina patvirtinta ${done ? '' : `<button type="button" class="lnk" data-priceok="${i}">atšaukti</button>`}</span>` : `<div class="pneed">⚠ Betono kaina pagal kainoraštį – patvirtinkite arba įveskite savo ${done ? '' : `<button type="button" class="btn btn-sm btn-dark" data-priceok="${i}">✓ Tvirtinu kainą</button>`}</div>`) : ''}
    </div></div>`;
  return h;
}
// Transporto kainos klientui: betonvežis (DDP – įskaičiuota, EXW – €/reisą, kliento – nėra), siurblys, papildoma valanda. Išskleidus – redaguojama.
function trBlockHTML(o, r, i, done, tp) {
  if (isClientTr(o)) return `<div class="blk" id="tr-${i}"><div class="blk-h"><b>Transportas</b><span style="flex:1"></span></div><div class="blk-b"><span>Kliento transportas${o.ctype ? ' (' + esc(o.ctype) + ')' : ''} – EXW, transporto kaina neskaičiuojama.</span></div></div>`;
  const oid = S.sel + ':' + i, open = !!(S.trOpen && S.trOpen[oid]), t = termsOf(o, r), pn = priceNeed(o) || [];
  const pc = (l, val, sm) => `<div class="pc"><span class="eb">${l}</span><b>${val}</b><small>${sm || '&nbsp;'}</small></div>`;
  const nT = Math.max(1, Math.ceil((Number(o.qty) || 0) / TRIP - 1e-9)), tk = trKain(o), pk = o.pump && o.pump.need ? pumpKain(o) : null;
  const hrsJ = tp && tp.pp && tp.pp.job ? (tp.pp.job.b - tp.pp.job.a) / 60 : null;
  const pv = num(o.papVal) || PAPILD_VAL;
  const ed = open && !done, inp = (k, v, ph) => ed ? `<input data-k="${k}" type="text" inputmode="decimal" autocomplete="off" value="${num(v) != null ? f2(num(v)) : ''}" placeholder="${f2(pnum(ph))}" aria-label="${k}">` : '';
  const cell = (l, val, sm, input) => `<div class="pc"><span class="eb">${l}</span><b>${val}</b><small>${sm || '&nbsp;'}</small>${input || ''}</div>`;
  let cells = t === 'ddp' ? cell('Betonvežis', 'įskaičiuota', 'DDP') : cell('Betonvežio reisas', f2(tk.v) + ' €', nT + ' reis. = ' + sp(nT * tk.v) + ' € · ' + esc(tk.src), inp('trPrice', o.trPrice, tk.v));
  if (o.pump && o.pump.need) cells += pk ? cell('Siurblio atvykimas', f2(pk.atv) + ' €', esc(pk.lab) + ' · ' + esc(pk.src), inp('pAtv', o.pAtv, pk.atv)) + cell('Siurblio valanda', f2(pk.val) + ' €/val.', hrsJ ? (Math.ceil(hrsJ) < PMIN ? 'min. ' + PMIN + ' val.' : '~' + Math.ceil(hrsJ) + ' val.') + ' = ' + sp(pk.val * pumpHrs(hrsJ)) + ' €' : 'min. ' + PMIN + ' val.', inp('pVal', o.pVal, pk.val)) : cell('Siurblys', esc(ptypeOf(o.pump.len)), 'kainą patvirtinsime atskirai');
  cells += cell('Betonvežio papild. val.', f2(pv) + ' €/val.', num(o.papVal) ? 'įvesta' : 'kainoraštis', inp('papVal', o.papVal, PAPILD_VAL));
  let h = `<div class="blk" id="tr-${i}"><div class="blk-h"><b>Transporto kainos klientui</b><span style="flex:1"></span>${done ? '' : XB(`data-tropen="${i}"`, open ? 'Baigti redaguoti' : 'Redaguoti transporto kainas', open)}</div><div class="blk-b"><div class="trg${ed ? ' ed' : ''}">${cells}</div>`;
  const trn = pn.filter((x) => x !== 'betono');
  if (trn.length) h += o.priceOk ? `<span class="okt" style="font-size:12.5px">✓ Kainos patvirtintos ${done ? '' : `<button type="button" class="lnk" data-priceok="${i}">atšaukti</button>`}</span>` : `<div class="pneed">⚠ ${esc(trn.join(', '))} kaina pagal kainoraštį – patvirtinkite ${done ? '' : `<button type="button" class="btn btn-sm btn-dark" data-priceok="${i}">✓ Tvirtinu</button>`}</div>`;
  return h + `</div></div>`;
}
function orderHTML(L, o, i, letterDone) {
  const oid = L.id + ':' + i, cancel = o.action === 'atsaukti', ai = apprIdx(L.id), done = letterDone || ai.has(i);
  const actLab = { naujas: 'Naujas', keisti: 'Pakeitimas', atsaukti: 'Atšaukimas' }[o.action] || 'Naujas';
  const probs = done ? [] : orderProbs(L.id, o, i), tp = cancel ? null : timePlan(o, oid);
  const open = S.oopen[oid] != null ? S.oopen[oid] : (!done && probs.some((p) => p.f !== 'rcp' && p.f !== 'time' && p.f !== 'price'));
  const multi = ((S.ed[L.id] || {}).orders || []).length > 1;
  const col = S.ocol && S.ocol[oid] != null ? S.ocol[oid] : (done || (multi && !probs.length));
  const PEN = `<button type="button" class="xb${open ? ' on' : ''}" data-oopen="${i}" aria-label="Redaguoti užsakymo duomenis" title="Redaguoti užsakymo duomenis" aria-pressed="${!!open}" ${done ? 'disabled' : ''}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 12l.6-2.6L9.4 2.6a1.2 1.2 0 011.7 0l.3.3a1.2 1.2 0 010 1.7L4.6 11.4z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>`;
  let h = `<section class="order${col ? ' col' : ''}" data-i="${i}" id="ord-${i}"><div class="order-h"><b class="onum">${i + 1}</b><span class="st ${cancel ? 'st-bad' : done ? 'st-ok' : ''}">${done ? 'Patvirtinta' : actLab}</span>
    <span class="ohd">${orderHead(o, tp)}</span>${col ? '' : PEN}${XB(`data-ocol="${i}"`, col ? 'Išskleisti užsakymą' : 'Suskleisti užsakymą', !col)}</div>`;
  if (probs.length) h += `<div class="oerr">${probs.map((p) => `<button type="button" class="oerr-b" data-jump="${i}:${p.f}">⚠ ${esc(p.t.charAt(0).toUpperCase() + p.t.slice(1))}</button>`).join('')}</div>`;
  if (col) return h + '</section>';
  h += `<div class="order-b">`;
  if (open) {
    h += `<fieldset style="border:0;margin:0;padding:0" ${done ? 'disabled' : ''}><div class="grid-f">` +
      fieldHTML('Data', 'date', o.date, { type: 'date', miss: !o.date }) +
      fieldHTML('Laikas (prašo)', 'time', o.time || '', { select: timeOpts(o.time), miss: !o.time && !o.win && !cancel, src: o.win && WIN[o.win] ? 'langas: ' + WIN[o.win][2] + ' ' + hhmm(WIN[o.win][0] + 360) + '–' + hhmm(WIN[o.win][1] + 360) : (!o.time ? 'nenurodyta' : '') }) +
      fieldHTML('Kiekis, m³', 'qty', o.qty, { type: 'number', step: '0.1', miss: !(Number(o.qty) > 0) && !cancel }) +
      fieldHTML('Markė (kaip prašo)', 'asked', o.asked, { miss: !o.asked && !cancel }) +
      fieldHTML('Objektas', 'object', o.object) +
      fieldHTML('Adresas / vieta', 'address', o.address) +
      fieldHTML('Pristatymas', 'mode', o.mode, { select: [['betonvezis', 'Betonvežiu'], ['kriause', 'Betonvežiu, iš kriaušės'], ['savivartis', 'Kliento transportas']] }) +
      (isClientTr(o) ? fieldHTML('Kliento transportas', 'ctype', o.ctype || '', { ph: 'savivartis, dumperis…' }) : '') +
      fieldHTML('Siurblys, m', 'pumpLen', o.pump && o.pump.need ? (o.pump.len || '') : '', { type: 'number', ph: 'nereikia' }) +
      fieldHTML('Mazgas', 'plant', o.plant, { select: Object.entries(PLANTS).map(([k, p]) => [k, p.name]) }) +
      fieldHTML('Veiksmas', 'action', o.action, { select: [['naujas', 'Naujas'], ['keisti', 'Pakeitimas'], ['atsaukti', 'Atšaukimas']] }) +
      fieldHTML('Laiko langas', 'win', o.win || '', { select: [['', '— konkretus laikas'], ['rytas', 'Rytas 07–11'], ['pirma_puse', 'Pirma pusė 07–12'], ['antra_puse', 'Antra pusė 12–17'], ['vakaras', 'Vakaras 15–18']] }) +
      fieldHTML('Kelionė į objektą, min', 'travel', o.travel, { type: 'number' }) +
      fieldHTML('Intervalas, min', 'interval', o.interval, { type: 'number', ph: String(interval(o)) }) +
      fieldHTML('Priedai', 'additives', o.additives) +
      `</div></fieldset>`;
    if (o.notes || o.ref) h += `<div class="onote">${BP} ${o.ref ? '<b>Susieta:</b> ' + esc(o.ref) + '. ' : ''}${esc(o.notes || '')}</div>`;
    h += histHTML(L, o);
  }
  if (!cancel) {
    const ro = recipeOptions(o), cur = recipeById(o.recipeId);
    const rqk = S.sel + ':' + i, rqv = (S.rqo && S.rqo[rqk]) || '', ropen = !!S.rcpOpen[oid] || !!rqv.trim() || !cur;
    if (!ropen) h += rcpBlockHTML(o, cur, i, done, ro);
    else {
      h += `<div class="blk" data-f="rcp" id="rcp-${i}"><div class="blk-h"><b>Receptas</b><span class="muted" style="font-size:12.5px">· ${PLANTS[o.plant].name} · klientas prašo: ${ro.req.map((x) => `<span class="tag">${esc(x)}</span>`).join(' ') || '—'}${ro.wantS ? ' <span class="tag">' + ro.wantS + '</span>' : ''}</span><span style="flex:1"></span>${cur ? XB(`data-rcpopen="${i}"`, 'Suskleisti', true) : ''}</div><div class="blk-b">
      <label class="rcp-q"><span class="sr">Recepto paieška</span><input type="search" class="rcp-qi" data-rqo="${i}" value="${esc(rqv)}" placeholder="Ieškoti recepto: kodas, klasė, savybės" ${done ? 'disabled' : ''}></label>`;
      if (rqv.trim()) {
        const tk = rqv.toUpperCase().split(/[\s,;]+/).filter(Boolean);
        const hits = RECIPES.filter((r) => r.active && r.kind === 'betonas' && r.plant === o.plant && tk.every((t) => (r.code + ' ' + r.name + ' ' + r.props.join(' ') + ' ' + (r.slump || '') + ' DMAX' + (r.dmax || '') + ' ' + (r.cement || '')).toUpperCase().includes(t)));
        h += `<span class="muted" style="font-size:12px">Paieška „${esc(rqv)}“ · ${PLANTS[o.plant].name}: ${hits.length} ${hits.length === 1 ? 'receptas' : 'receptai'}${hits.length > 8 ? ' (rodomi 8)' : ''}</span>`;
        hits.slice(0, 8).forEach((r) => { const x = Object.assign({ r, used: ro.used }, classify(r, ro.req)); h += rcpRow(x, o, done, true); });
        if (!hits.length) h += `<div class="warn">Pagal „${esc(rqv)}“ receptų nerasta.</div>`;
      } else {
        if (!ro.req.length) h += `<div class="warn">Nenurodyta markė – receptą rinkitės paieška.</div>`;
        const shown = new Set(), list = [];
        if (ro.hist) { list.push(Object.assign({ used: ro.used }, ro.hist)); shown.add(ro.hist.r.id); }
        if (cur && !shown.has(cur.id)) { list.push(Object.assign({ r: cur, used: ro.used }, classify(cur, ro.req))); shown.add(cur.id); }
        ro.fit.forEach((x) => { if (!shown.has(x.r.id) && list.length < 6) { x.used = ro.used; list.push(x); shown.add(x.r.id); } });
        if (ro.req.length && !ro.fit.length && !ro.hist) h += `<div class="note">${PLANTS[o.plant].name} mazge nėra recepto tiksliai su šiomis savybėmis${ro.elsewhere.length ? ' (yra: ' + ro.elsewhere.slice(0, 3).map((r) => r.code + ' ' + r.plantName).join(', ') + ')' : ''}. Žemiau artimiausi arba paieška.</div>`;
        list.forEach((x) => { h += rcpRow(x, o, done, true); });
        const ex = ro.extra.filter((x) => !shown.has(x.r.id));
        if (ex.length) h += `<details><summary class="muted" style="font-size:12.5px;cursor:pointer">Turi daugiau savybių nei prašė klientas (${ex.length})</summary><div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${ex.map((x) => rcpRow(Object.assign(x, { used: ro.used }), o, done, true)).join('')}</div></details>`;
      }
      h += `</div></div>`;
    }
    if (useDb() && window.BPDB.b3day) {
      h += `<div class="blk cap" data-f="time"><div class="blk-b">${o.date && Number(o.qty) > 0 ? b3cHTML(o, oid, i, done) : '<span class="warn">Talpai patikrinti reikia datos ir kiekio.</span>'}</div></div>`;
    } else {
      const cap = capOptions(o, oid);
      if (cap) {
        const pick = o.pick == null ? cap.def : o.pick, ch = cap.opts[pick] || cap.opts[0];
        h += `<div class="blk cap" data-f="time"><div class="blk-b"><span class="eb muted">Ar galime priimti · ${PLANTS[o.plant].name} · ${o.date}</span>
          <div class="${cap.opts[0].ok ? 'okbox' : 'warn'}">${cap.opts[0].ok ? 'Prašomu laiku ' + fmt(cap.S0) + ' galima priimti.' : 'Prašomu laiku ' + fmt(cap.S0) + ' negalima: ' + esc(cap.opts[0].why.join(', ')) + '.'} ${ch.s.self ? 'Klientas pasiima pats – betonvežiai neužimami.' : `${ch.s.n} ${nr(ch.s.n)} po ≤7,5 m³ · intervalas ${ch.s.U} min · kelionė ${ch.s.T} min`}${ch.pumpId ? ' · siurblys ' + ch.pumpId : ''}</div>
          <div class="opts" role="group" aria-label="Laiko pasirinkimai">${cap.opts.map((x, k) => `<button type="button" class="opt" data-pick="${i}:${k}" aria-pressed="${k === pick}" ${done ? 'disabled' : ''}><b>${fmt(x.Sm)}</b><span>${x.kind === 'req' ? 'kaip prašo' : x.kind === 'hire' ? '+' + x.hire + ' samdyt. betonv.' : 'laisvas langas'}${k === cap.def && x.kind !== 'req' ? ' · ' + BP + ' siūlo' : ''}</span><span style="color:${x.ok ? '#17704A' : '#B23A26'}">${x.ok ? 'galima' : esc(x.why[0] || '')}</span></button>`).join('')}</div>
          ${ch.s.self ? '' : `<div class="row2"><span class="rl">Betonvežiai<br>riba ${ch.lim}</span><div>${chartHTML(ch.base, ch.nt, o.plant, ch.lim, 10)}</div></div>`}</div></div>`;
      } else h += `<div class="blk cap" data-f="time"><div class="blk-b"><span class="warn">Talpai patikrinti reikia datos, mazgo ir kiekio.</span></div></div>`;
    }
    if (cur) h += trBlockHTML(o, cur, i, done, tp);
  }
  return h + '</div></section>';
}
function rcpRow(x, o, disabled, selectable) {
  const r = x.r, on = r.id === Number(o.recipeId);
  const pr = r.props.map((p) => `<span class="pchip${x.extra && x.extra.includes(p) ? ' extra' : ''}">${esc(p)}</span>`).join('');
  const dbc = DBX() && o.client, pq = DBX() ? window.BPDB.price(r.code, o.client) : null;
  const took = !!((pq && pq.client != null) || (x.used && x.used.has && x.used.has(String(r.code).toUpperCase())));
  let badge = '';
  if (on) badge = o.rcpWhy === 'same' && o.rcpFrom ? 'PARINKTA KAIP ' + o.rcpFrom + ' UŽSAKYME' : dbc ? (took ? 'PARINKTA PAGAL ISTORIJĄ' : 'ŠIAM KLIENTUI NETIEKTA') : 'PARINKTA';
  const cm = [];
  if (x.why === 'obj') cm.push('anksčiau vežta į šį objektą' + (x.n ? ' (' + x.n + ' k.)' : ''));
  if (x.dbDiff) cm.push(x.dbDiff);
  else if (x.why === 'cl') cm.push('šis klientas ėmė anksčiau');
  else if (dbc && !(on && badge !== 'PARINKTA' && !/KAIP/.test(badge))) cm.push(took ? 'šiam klientui tiekta' : 'šiam klientui netiekta');
  if (x.extra && x.extra.length) cm.push('neprašyta: ' + x.extra.join(', '));
  const price = pq ? `${o.client && pq.client != null ? '<span>šiam klientui <b>' + eur(pq.client) + '</b> <span class="muted">(' + Math.round(pq.clientQ) + ' m³' + (pq.type ? ', ' + esc(pq.type) : '') + ')</span></span>' : dbc ? '<span>siūloma <b>' + eur(r.price) + '</b> <span class="muted">(kainoraštis)</span></span>' : ''}<span>vidutinė <b>${eur(pq.avg)}</b></span>` : (dbc ? '<span>siūloma <b>' + eur(r.price) + '</b> <span class="muted">(kainoraštis)</span></span>' : '');
  return `<button type="button" class="rcp-row" data-rcp="${r.id}" aria-pressed="${on}" ${disabled && !on ? 'disabled' : ''}>
    <span class="rcp-l1"><span class="rcp-ch"><b>${esc(r.code)}</b>${pr}${r.slump ? `<span class="pchip">${r.slump}</span>` : ''}${r.dmax ? `<span class="pchip">Dmax${r.dmax}</span>` : ''}<span class="nm">${esc(r.cement || '')}</span></span>${badge ? `<span class="st st-ok rcp-b">${badge}</span>` : ''}</span>
    <span class="rcp-l2">${price}<span>kainoraštis <b>${r.price.toFixed(2).replace('.', ',')} €/m³</b></span><span>savikaina <b>${r.cost.toFixed(2).replace('.', ',')} €/m³</b></span><span>marža ${(r.price - r.cost).toFixed(2).replace('.', ',')} €/m³</span></span>
    ${cm.length ? `<span class="rcp-cm">${esc(cm.join(' · '))}</span>` : ''}</button>`;
}
// El. laiškas su formatavimu: užsakymų eilutės „Etiketė: reikšmė“ – lentelė; kainos – nuorodos į recepto / transporto blokus.
function mailHTML(text, id) {
  const E = S.ed[id], ai = apprIdx(id), idx = E ? E.orders.map((o, i) => ({ o, i })).filter((x) => !ai.has(x.i) && x.o.action !== 'atsaukti' && !isSkip(id, x.o, x.i)).map((x) => x.i) : [];
  let tk = 0;
  const money = /(\d{1,3}(?:[  ]\d{3})*(?:,\d{2})?\s?€(?:\/(?:m³|val\.|h|reisą|trip))?)/g;
  const linkify = (v, i, lab) => esc(v).replace(money, (m) => { const tr = /val|\/h|reis|trip/.test(m) || /Siurbl|Pump|Papild|Extra|Transport/i.test(lab); return `<a href="#" class="mlnk" data-jump="${i}:${tr ? 'tr' : 'price'}" title="Atidaryti redagavimui">${m}</a>`; });
  return String(text || '').split(/\n{2,}/).map((b) => {
    const ls = b.split('\n');
    if (/^— /.test(b)) return `<p class="mfoot">${BP}<span>${esc(b.replace(/^— /, ''))}</span></p>`;
    if (ls.length > 1 && ls.every((l) => { const k = l.indexOf(': '); return k > 0 && k < 45; })) {
      const i = idx[tk++] != null ? idx[tk - 1] : idx[0];
      return `<table class="mtb" width="100%" style="table-layout:fixed"><colgroup><col style="width:32%"><col></colgroup><tbody>${ls.map((l) => { const k = l.indexOf(': '), lab = l.slice(0, k), v = l.slice(k + 2), b1 = /^(Data|Date|Pradžia|Start|Atsiėmimas|Pick-up|Betonas|Concrete)$/.test(lab) && !/€/.test(v); return `<tr><td>${esc(lab)}</td><td>${b1 ? '<b>' : ''}${linkify(v, i, lab)}${b1 ? '</b>' : ''}</td></tr>`; }).join('')}</tbody></table>`;
    }
    return `<p>${ls.map(esc).join('<br>')}</p>`;
  }).join('');
}
// SMS – trumpas tekstas be formatavimo.
function smsText(id) {
  const L = LETTERS.find((x) => x.id === id), R = S.res[id], E = S.ed[id]; if (!R || !E) return '';
  const who = (sig(L).split('\n').filter(Boolean)[1] || '').trim(), one = (s) => String(s || '').replace(/\n+/g, '; ').replace(/\s+/g, ' ').replace(/;\s*;/g, ';').trim();
  // be pasisveikinimo ir parašo: viskas nuo „Pagarbiai“ / „—“ nukerpama, pasisveikinimo eilutė praleidžiama
  const core = (s) => { const out = []; for (const ln of String(s || '').split('\n')) { const x = ln.trim(); if (/^(pagarbiai|su pagarba|best regards|regards|—)/i.test(x)) break; if (/^(laba diena|labas|sveiki|hello|dear)\b[^\n]{0,40}[,!.]?$/i.test(x) && !/\d/.test(x)) continue; out.push(ln); } return out.join('\n').trim(); };
  // jei el. laiškas redaguotas ranka – SMS iš redaguoto teksto
  if (E.reply != null && E.fmt !== 'sms') { const ps = core(E.reply).split(/\n{2,}/).map((x) => x.trim()).filter(Boolean); if (ps.length) return 'C3 Betonas: ' + one(ps.slice(0, 2).join(' ')) + ' ' + who; }
  if (R.tipas === 'ne_uzsakymas') return R.atsakymas_ne_uzsakymui ? 'C3 Betonas: ' + one(core(R.atsakymas_ne_uzsakymui)) + ' ' + who : '';
  if (isQuestion(id) && R.klausimas_klientui) return 'C3 Betonas: ' + one(core(R.klausimas_klientui)) + ' ' + who;
  const ai = apprIdx(id), act = E.orders.map((o, i) => ({ o, i })).filter((x) => !ai.has(x.i) && x.o.action !== 'atsaukti' && !isSkip(id, x.o, x.i));
  const lines = act.map(({ o, i }) => { const tp = timePlan(o, id + ':' + i), r = recipeById(o.recipeId); return [o.date ? o.date.slice(5) : '', tp ? fmt(tp.Sm) : o.time || '', r ? r.cls : o.asked || '', o.qty ? String(o.qty).replace('.', ',') + ' m3' : '', r ? finalPrice(o, r).toFixed(2).replace('.', ',') + ' EUR/m3 ' + (termsOf(o, r) === 'ddp' ? 'DDP' : 'EXW') : '', o.object || o.address || ''].filter(Boolean).join(', '); }).filter(Boolean);
  if (!lines.length) { const c = E.orders.filter((o) => o.action === 'atsaukti'); return c.length ? 'C3 Betonas: patvirtiname atšaukimą ' + c.map((o) => [o.date, o.object].filter(Boolean).join(' ')).join('; ') + '. ' + who : ''; }
  return 'C3 Betonas: patvirtiname ' + (lines.length > 1 ? 'užsakymus' : 'užsakymą') + ' ' + lines.join('; ') + '. ' + who;
}
// Patvirtinta poraštė (F): geltona linija, „Parengta su“ + logotipas 05.H4. Neredaguojama.
const LOGO_HUB = '<span class="bp-logo" role="img" aria-label="BetonPro HUB"><svg viewBox="0 0 34 34" aria-hidden="true"><rect x="0" y="3" width="22" height="7" fill="#F5C518"/><rect x="8" y="13.5" width="26" height="7" fill="currentColor"/><rect x="3" y="24" width="18" height="7" fill="currentColor" opacity=".45"/></svg><span class="z">BetonPro</span><span class="hub"><i></i><i></i><i></i><i></i>HUB</span></span>';
const MFOOT = `<div class="mfootF" contenteditable="false"><span>Parengta su</span>${LOGO_HUB}</div>`;
const isMail = (v) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v), isTel = (v) => /^\+?\d[\d\s-]{7,}$/.test(v);
function renderSide() {
  const L = LETTERS.find((x) => x.id === S.sel), el = $('#side');
  if (!L) { el.innerHTML = ''; return; }
  const R = S.res[L.id], E = S.ed[L.id], done = S.appr[L.id] && !S.appr[L.id].partial ? S.appr[L.id] : null, closed = S.closed && S.closed[L.id];
  if (!E && R && R.tipas === 'ne_uzsakymas') { el.innerHTML = closed ? `<div class="note">Laiškas uždarytas – nerodomas „Laukia peržiūros“.</div><button type="button" class="btn btn-act" id="unclose"><span>Grąžinti į eilę</span><span>↺</span></button>` : `<button type="button" class="btn btn-go btn-act" id="closeL"><span>Atlikta – nerodyti</span><span aria-hidden="true">✓</span></button>`; return; }
  if (!E) { el.innerHTML = `<div class="card"><div class="card-b muted"><span>Atsakymas klientui atsiras, kai ${BP} perskaitys laišką arba užpildysite juodraštį ranka.</span></div></div>`; return; }
  const sms = E.fmt === 'sms', gen = sms ? smsText(L.id) : genReply(L.id);
  const edited = (E.reply != null || E.replyH != null) && !done, txt = done ? (done.reply || gen) : E.reply != null ? E.reply : gen, stale = edited && E.replyBase != null && E.replyBase !== gen;
  const sentL = S.sent && S.sent[L.id];
  const subj = E.subj != null ? E.subj : 'Re: ' + String(L.subject || '').replace(/^(re|ats\.?|fwd?):\s*/i, '');
  const rc = E.rc || { tel: false, mail: L.channel === 'email', umail: true };
  const noReply = R && R.tipas === 'ne_uzsakymas' && !gen && !edited;
  const probs = [], ai = apprIdx(L.id);
  const pend = E.orders.map((o, i) => ({ o, i })).filter((x) => !ai.has(x.i)), toApp = pend.filter((x) => !isSkip(L.id, x.o, x.i));
  toApp.forEach(({ o, i }) => orderProbs(L.id, o, i).forEach((p) => probs.push({ i, f: p.f, t: (i + 1) + ': ' + p.t })));
  const isQ = isQuestion(L.id), dis = done ? 'disabled' : '';
  const row = (id, on, b, v, disabled) => `<label class="rcr${disabled ? ' off' : ''}" title="${esc(v)}"><input type="checkbox" id="${id}" ${on ? 'checked' : ''} ${done || disabled ? 'disabled' : ''}><span class="badge">${b}</span><span class="mono rcv">${esc(v)}</span></label>`;
  let h = `<div class="card"><div class="card-h"><span class="eb">Atsakymas klientui</span>${edited ? '<span class="badge" style="background:#FBEFB8">REDAGUOTA</span>' : `<span class="eb muted">${BP} paruošė</span>`}</div><div class="card-b sideb">`;
  if (noReply) h += `<div class="note">Atsakymas nesiunčiamas – ${BP} mano, kad atsakyti nereikia. Galite parašyti patys.</div><button type="button" class="btn btn-sm" id="writeOwn" ${dis}>Rašyti atsakymą</button>`;
  else {
    const U = fwdOf(L), c = DBX() ? window.BPDB.card(L.company) : null, AD = addrOf(L);
    if (AD && AD.k !== me().k && !done) h += `<div class="warn" style="font-size:12.5px">Klientas rašė ${esc(AD.n.split(' ')[0].replace(/as$/, 'ui').replace(/a$/, 'ai'))} – atsakote savo vardu (${esc(me().n)}).</div>`;
    h += `<div class="fl"><span class="eb muted">1 · Kam</span><div class="kam">`;
    if (U) h += `<span class="muted" style="font-size:12px">Užsakovas</span><div><b>${esc(U.u.vardas || '')}</b>${U.u.imone ? ' <span class="muted">· ' + esc(U.u.imone) + '</span>' : ''}</div>${U.u.el_pastas ? row('rcUMail', rc.umail !== false, 'Paštu', U.u.el_pastas) : ''}${U.u.tel ? row('rcUTel', rc.utel, 'SMS', U.u.tel) : ''}
      <span class="muted" style="font-size:12px;margin-top:4px">Kopija (persiuntė)</span>${row('rcMail', rc.mail, 'CC', (L.contact.mail || '') + ' · ' + L.contact.name)}${R && R.kalba && R.kalba !== 'lt' ? `<span class="muted" style="font-size:12px">Užsakovas rašė ${esc(R.kalba.toUpperCase())} – atsakymas ${R.kalba === 'en' ? 'angliškai' : 'lietuviškai'}.</span>` : ''}`;
    else {
      h += `<span class="muted" style="font-size:12px">Laiško siuntėjas</span><div><b>${esc(L.contact.name)}</b> <span class="muted">· ${esc(L.company)}</span></div>`;
      if (L.contact.mail) h += row('rcMail', rc.mail, 'Paštu', L.contact.mail);
      if (c && c.email && String(c.email).toLowerCase() !== String(L.contact.mail || '').toLowerCase()) h += row('rcCMail', rc.cmail, 'Paštu', c.email);
      h += L.contact.tel ? row('rcTel', rc.tel, 'SMS', L.contact.tel) : row('rcTelX', false, 'SMS', 'telefonas laiške nenurodytas', true);
    }
    (E.xrc || []).forEach((x, k) => { h += `<div class="rcx">${row('rcX' + k, x.on !== false, x.k === 'tel' ? 'SMS' : 'Paštu', x.v)}${done ? '' : `<button type="button" class="xdel" data-xdel="${k}" aria-label="Pašalinti ${esc(x.v)}" title="Pašalinti">✕</button>`}</div>`; });
    if (!done) h += `<div class="xadd"><input id="xrcIn" type="text" placeholder="el. paštas arba +370…" aria-label="Naujas adresatas"><button type="button" class="btn" id="xrcAdd">+ Pridėti</button></div><span id="xrcMsg" class="bad" style="font-size:12px"></span>`;
    h += `</div></div>`;
    if (!sms) h += `<div class="fl"><label for="subj" class="eb muted">2 · Tema</label><input id="subj" value="${esc(subj)}" ${dis}></div>`;
    const dsms = done ? /^C3 Betonas:/.test(done.reply || '') : sms;
    h += `<div class="fl"><span class="eb muted">${sms ? '2' : '3'} · Laiško turinys</span>${done ? `<span class="muted" style="font-size:12px">Išsaugotas ${dsms ? 'SMS' : 'el. laiškas'} (patvirtinta ${esc(done.at.slice(11, 16))}). Norėdami keisti – atšaukite patvirtinimą.</span>` : `<div class="seg"><button type="button" class="segb" data-fmt="mail" aria-pressed="${!sms}">El. paštas</button><button type="button" class="segb" data-fmt="sms" aria-pressed="${sms}">SMS</button></div>`}
      ${stale ? `<div class="warn">Laukai pakeisti po jūsų redagavimo – tekstas neatnaujintas. Paspauskite „Peržiūrėti pagal įvestus duomenis“.</div>` : ''}
      ${dsms ? `<textarea id="replyTa" rows="5" aria-label="SMS tekstas" ${done ? 'readonly' : ''}>${esc(txt)}</textarea>` : `<div id="replyEd" class="mail${done ? ' ro' : ''}" ${done ? '' : 'contenteditable="true"'} role="textbox" aria-multiline="true" aria-label="El. laiško tekstas">${done ? (done.replyH || mailHTML(txt, L.id)).replace(/<div class="mfootF"[\s\S]*$/, '') : (E.replyH != null ? E.replyH : mailHTML(txt, L.id))}</div>${MFOOT}`}
      ${sms ? `<span class="muted" style="font-size:12px">${txt.length} simb. · trumpas tekstas be formatavimo</span>` : ''}
      ${edited && !done ? `<button type="button" class="lnk" id="replyReset2" style="align-self:flex-end">Grąžinti ${BP} tekstą</button>` : ''}</div>`;
  }
  h += `</div></div>`;
  if (closed && sentL) {
    h += `<div class="okbox">Atsakyta ${esc(sentL.at.slice(11, 16))}. (Testas – laiškas klientui nesiunčiamas.)</div><button type="button" class="btn btn-act" id="unclose"><span>Grąžinti į eilę</span><span>↺</span></button>`;
  } else if (closed) {
    h += `<div class="note">Laiškas uždarytas – nerodomas „Laukia peržiūros“.</div><button type="button" class="btn btn-act" id="unclose"><span>Grąžinti į eilę</span><span>↺</span></button>`;
  } else if (done) {
    h += `<div class="okbox">Patvirtinta ${esc(done.at.slice(11, 16))}. ${done.orders.length ? 'Į dienos planą įtraukta: ' + done.orders.map((o) => o.date + ' ' + fmt(o.S) + ' ' + PLANTS[o.plant].name + ' ' + o.qty + ' m³').join('; ') + '.' : 'Užsakymų į planą neįtraukta.'} ${done.cancelled ? done.cancelled : ''} (Testas – laiškas klientui nesiunčiamas.)</div>
      <div class="acts"><button type="button" class="btn btn-act" id="undo"><span>Atšaukti patvirtinimą</span><span>↺</span></button></div>`;
  } else if (S.rej[L.id]) {
    h += `<div class="note">Užsakymas atmestas.</div><button type="button" class="btn btn-act" id="unrej"><span>Grąžinti į eilę</span><span>↺</span></button>`;
  } else {
    const neu = R && R.tipas === 'ne_uzsakymas';
    if (S.appr[L.id] && S.appr[L.id].partial) h += `<div class="okbox">Dalinai patvirtinta: ${S.appr[L.id].orders.length} užs. įtraukta į planą. Likę laukia. <button type="button" class="btn btn-sm" id="undo">Atšaukti patvirtinimą</button></div>`;
    if (probs.length && !neu) h += `<div class="warn"><b>Prieš tvirtinant:</b>${probs.map((p) => `<button type="button" class="plink" data-jump="${p.i}:${p.f}">${esc(p.t)} →</button>`).join('')}</div>`;
    h += `<div class="acts">`;
    if (!noReply) h += `<button type="button" class="btn btn-act" id="replyFromFields" title="Sugeneruoti atsakymą iš įvestų duomenų"><span>Peržiūrėti pagal įvestus duomenis</span><span>↻</span></button>`;
    if (neu) h += gen || edited ? `<button type="button" class="btn btn-go btn-act" id="sendR"><span>Siųsti atsakymą klientui</span><span aria-hidden="true">→</span></button><button type="button" class="btn btn-act btn-ghost" id="closeL"><span>Uždaryti be atsakymo</span><span aria-hidden="true">✕</span></button>` : `<button type="button" class="btn btn-go btn-act" id="closeL"><span>Atlikta – nerodyti</span><span aria-hidden="true">✓</span></button>`;
    else {
      const n = toApp.filter((x) => x.o.action !== 'atsaukti').length, m = pend.filter((x) => x.o.action !== 'atsaukti').length;
      const lab = isQ ? 'Siųsti klausimą klientui' : E.orders.length && E.orders.every((o) => o.action === 'atsaukti') ? 'Patvirtinti atšaukimą' : m > 1 || n < m ? `Patvirtinti ${n} iš ${m} ir informuoti` : 'Patvirtinti ir informuoti klientą';
      const block = !isQ && probs.length > 0;
      h += `<button type="button" class="btn btn-go btn-act" id="approve" ${block || (!isQ && !n && !E.orders.some((o) => o.action === 'atsaukti')) ? 'disabled' : ''}><span>${lab}</span><span aria-hidden="true">→</span></button>`;
      if (block) h += `<label style="display:flex;gap:8px;align-items:center;font-size:12.5px"><input type="checkbox" id="force"> Tvirtinti nepaisant pastabų (testui)</label>`;
      h += `<button type="button" class="btn btn-act btn-ghost" id="reject"><span>Atmesti užsakymą</span><span aria-hidden="true">✕</span></button>`;
    }
    h += `</div>`;
  }
  el.innerHTML = h;
}

/* ---------- dienos apkrova ---------- */
function renderLoad() {
  const dates = new Set();
  Object.values(S.appr).forEach((a) => (a.orders || []).forEach((o) => dates.add(o.date)));
  const list = Array.from(dates).filter(Boolean).sort();
  if (!S.loadDate || !list.includes(S.loadDate)) S.loadDate = list[0] || '2026-11-12';
  const d = S.loadDate, trips = dayTrips(d), A = agg(trips);
  const orders = []; Object.entries(S.appr).forEach(([lid, a]) => (a.orders || []).forEach((o, i) => { if (o.date === d) orders.push(Object.assign({ lid }, o)); }));
  const pb = pumpBlocks(d);
  let h = `<div class="card"><div class="card-b" style="flex-direction:row;flex-wrap:wrap;align-items:flex-end;gap:12px">
    <div class="fld" style="max-width:200px"><label for="ld">Data</label><input type="date" id="ld" value="${esc(d)}"></div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">${list.map((x) => `<button type="button" class="flt" data-ld="${x}" aria-pressed="${x === d}">${x.slice(5)} ${wd(x).slice(0, 3)}</button>`).join('') || '<span class="muted">Dar nėra patvirtintų užsakymų – patvirtinkite laiškus.</span>'}</div>
    <span style="flex:1"></span><label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="bgT" ${S.bg ? 'checked' : ''}> Fonas</label>${DBX() ? `<select id="bgSrc" aria-label="Fono šaltinis"><option value="db" ${S.bgSrc !== 'tpl' ? 'selected' : ''}>tikras BetonPro tos dienos planas</option><option value="tpl" ${S.bgSrc === 'tpl' ? 'selected' : ''}>tipinė diena (2026-11-03, 95 reisai)</option></select>` : '<span class="muted" style="font-size:12.5px">tipinė diena (2026-11-03) – prijunkite duomenų bazę, kad būtų tikras planas</span>'}</div>
    ${useDb() ? (() => { const di = window.BPDB.dayInfo(d); return `<div class="card-b" style="padding-top:0"><span class="muted" style="font-size:12.5px">BetonPro ${esc(d)}: ${di.n} užsakymai, ${di.trips} reisai, ${m3(di.m3)} (visi mazgai, rodomi Runeikiai, Stašėnai, Baisogala). Patvirtinto laiško kliento tos dienos BetonPro užsakymai iš fono išimami, kad nesidubliuotų.</span></div>`; })() : ''}</div>`;
  h += `<div class="strip">${[[orders.length, 'Patvirtinta užsakymų ' + d], [m3(orders.reduce((a, o) => a + Number(o.qty || 0), 0)), 'Iš laiškų'], [m3(trips.reduce((a, t) => a + t[7], 0)), 'Viso su fonu'], [Object.keys(PLANTS).filter((p) => Math.max.apply(null, A.tm[p]) > S.fleet[p]).length, 'Mazgai, kuriems trūksta betonvežių']].map((x, i) => `<div><span class="n">${x[0]}</span><span class="l">${String(i + 1).padStart(2, '0')} · ${x[1]}</span></div>`).join('')}</div>`;
  h += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:12px">`;
  Object.entries(PLANTS).forEach(([p, P]) => {
    const peak = Math.max.apply(null, A.tm[p]), vol = trips.filter((t) => t[0] === p).reduce((a, t) => a + t[7], 0), mine = orders.filter((o) => o.plant === p);
    const own = agg(trips.filter((t) => t[0] === p && String(t[1]).includes(':')));
    const bars = [], mxl = Math.max(PCAP + 5, ...A.pl[p]);
    for (let b = 0; b < 24; b++) bars.push(`<div class="bar${A.pl[p][b] > PCAP ? ' over' : own.pl[p][b] ? ' new' : ''}" style="height:${(A.pl[p][b] / mxl * 100).toFixed(1)}%" title="${fmt(b * 30)}: ${m3(A.pl[p][b])}"></div>`);
    h += `<div class="plant"><div class="plant-h"><b>${P.name}</b><span class="muted">${P.area}</span><span style="flex:1"></span><span class="${peak > S.fleet[p] ? 'st st-bad' : 'st st-ok'}">piko metu ${peak}/${S.fleet[p]} betonv.</span></div>
      <span class="mono muted" style="font-size:11.5px">${m3(vol)} · ${trips.filter((t) => t[0] === p).length} reisų · iš laiškų ${mine.length} užs.${useDb() ? ' · BetonPro tą dieną dirbo ' + (window.BPDB.dayInfo(d).cars[p] || 0) + ' betonv. (savi ir samdyti)' : ''}</span>
      <div class="row2"><span class="rl">Betonvežiai</span><div>${chartHTML(agg(trips.filter((t) => !String(t[1]).includes(':'))), agg(trips.filter((t) => String(t[1]).includes(':'))), p, S.fleet[p], 10)}</div></div>
      <div class="row2"><span class="rl">Krovimas m³/30 min<br>riba ${PCAP}</span><div><div class="chart" style="height:60px">${bars.join('')}<span class="lim" style="bottom:${(PCAP / mxl * 100).toFixed(1)}%"></span></div></div></div>
      ${mine.length ? `<table class="tb"><thead><tr><th>Laikas</th><th>Klientas</th><th>m³</th><th>Receptas</th><th>Siurblys</th></tr></thead><tbody>${mine.sort((a, b) => a.S - b.S).map((o) => `<tr><td class="mono">${fmt(o.S)}</td><td>${esc(o.client)}<br><span class="muted">${esc(o.object || o.address || '')}</span></td><td class="mono">${String(o.qty).replace('.', ',')}</td><td class="mono">${esc(o.recipeCode || '')}</td><td class="mono">${esc(o.pumpId || (o.mode === 'savivartis' ? 'pasiima' : '—'))}</td></tr>`).join('')}</tbody></table>` : ''}
    </div>`;
  });
  h += `</div>`;
  h += `<div class="card"><div class="card-h"><span class="eb muted">Siurbliai · ${d}</span></div><div class="card-b">${PUMPS.map((P) => { const bl = pb.filter((b) => b.pump === P.id); return `<div class="row2"><span class="rl">${P.id}</span><div style="position:relative;height:22px;background:#F2F3F5">${bl.map((b) => `<span title="${esc(b.who)} ${fmt(b.a)}–${fmt(b.e)}" style="position:absolute;top:2px;bottom:2px;left:${Math.max(0, b.a / DAY * 100)}%;width:${Math.max(0.5, (Math.min(DAY, b.e) - Math.max(0, b.a)) / DAY * 100)}%;background:${String(b.who).startsWith('fonas') ? '#B4B9BF' : '#F5C518'};box-shadow:inset 0 0 0 1px #15171A"></span>`).join('')}</div></div>`; }).join('')}<div class="axis" style="margin-left:98px"><span>06</span><span>08</span><span>10</span><span>12</span><span>14</span><span>16</span><span>18</span></div>
    <div class="legend"><span><i style="background:#C7CBD0"></i>fonas</span><span><i style="background:#F5C518;box-shadow:inset 0 0 0 1px #15171A"></i>patvirtinta iš laiškų</span><span><i style="background:#D2452F"></i>virš ribos</span></div></div></div>`;
  $('#view-load').innerHTML = h;
}

/* ---------- receptai ---------- */
function renderRecipes() {
  const q = (S.rq || '').trim().toUpperCase(), p = S.rp || '';
  const req = normProps([q]);
  const rows = RECIPES.filter((r) => (!p || r.plant === p) && (!q || (r.code + ' ' + r.name + ' ' + r.props.join(' ')).toUpperCase().includes(q) || (req.length > 1 && classify(r, req).kind === 'fit')));
  $('#view-recipes').innerHTML = `<div class="card"><div class="card-b" style="flex-direction:row;flex-wrap:wrap;gap:12px;align-items:flex-end">
    <div class="fld" style="flex:1 1 280px"><label for="rq">Paieška (kodas, pavadinimas arba savybės, pvz. „C30/37 XC2“)</label><input id="rq" value="${esc(S.rq || '')}"></div>
    <div class="fld" style="width:180px"><label for="rp">Mazgas</label><select id="rp"><option value="">Visi</option>${Object.entries(PLANTS).map(([k, P]) => `<option value="${k}" ${p === k ? 'selected' : ''}>${P.name}</option>`).join('')}</select></div>
    <a class="btn" href="data/recipes.csv" download>Atsisiųsti CSV</a><a class="btn btn-ghost" href="data/recipes.json" download>JSON</a></div>
    <div class="card-b" style="padding-top:0"><span class="muted" style="font-size:12.5px">${rows.length} iš ${RECIPES.length} receptų · šaltinis: BetonPro (lt-mob.hmbetonpro.eu), ištraukta 2026-11-11 · Runeikiai, Stašėnai, Baisogala. ${req.length > 1 ? 'Paieška pagal savybes rodo tik receptus su tiksliai tokiomis savybėmis.' : ''}</span></div></div>
    <div class="tbwrap"><table class="tb"><thead><tr><th>Mazgas</th><th>Kodas</th><th>Savybės</th><th>S</th><th>Dmax</th><th>Pavadinimas</th><th>Kainoraštis</th><th>Savikaina</th></tr></thead><tbody>${rows.map((r) => `<tr${r.active ? '' : ' style="color:#8A9097"'}><td>${r.plantName}</td><td class="mono">${esc(r.code)}</td><td>${r.props.map((x) => `<span class="pchip">${esc(x)}</span>`).join(' ')}</td><td class="mono">${r.slump || ''}</td><td class="mono">${r.dmax || ''}</td><td>${esc(r.name)}</td><td class="mono">${r.price.toFixed(2)}</td><td class="mono">${r.cost.toFixed(2)}</td></tr>`).join('')}</tbody></table></div>`;
}

/* ---------- nustatymai ---------- */
function renderSettings() {
  const k = key(), log = S.aiLog || [];
  const tin = log.reduce((a, x) => a + (x.in || 0), 0), tout = log.reduce((a, x) => a + (x.out || 0), 0);
  $('#view-settings').innerHTML = `<div class="card"><div class="card-h"><span class="eb muted">Claude API (AI – ${BP})</span><span class="${k ? 'st st-ok' : 'st st-bad'}">${k ? 'PRIJUNGTA' : 'NEPRIJUNGTA'}</span></div><div class="card-b">
    <div class="note">Raktas saugomas tik šioje naršyklėje (localStorage) ir siunčiamas tik į api.anthropic.com. Laiškuose žmonių vardai ir kontaktai jau užkoduoti. Raktą galite susikurti console.anthropic.com → API Keys; testui rekomenduojama nustatyti išlaidų limitą.</div>
    <div class="set-grid"><div class="fld"><label for="apik">API raktas</label><input id="apik" type="password" autocomplete="off" placeholder="sk-ant-…" value="${k ? '••••••••' + esc(k.slice(-4)) : ''}"></div>
    <div class="fld"><label for="meU">Prisijungęs vartotojas (atsakymų parašas)</label><select id="meU">${USERS.map((u) => `<option value="${u.k}" ${me().k === u.k ? 'selected' : ''}>${esc(u.n)} · ${esc(u.r[0])}</option>`).join('')}</select></div>
    <div class="fld"><label for="mdl">Modelis</label><select id="mdl">${MODELS.map(([v, l]) => `<option value="${v}" ${S.model === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-dark" id="saveKey">Išsaugoti raktą</button><button type="button" class="btn" id="testKey" ${k ? '' : 'disabled'}>Patikrinti ryšį</button><button type="button" class="btn btn-ghost" id="delKey" ${k ? '' : 'disabled'}>Ištrinti raktą</button></div><div id="keyMsg"></div></div></div>
    ${dbSettingsHTML()}
    <div class="card"><div class="card-h"><span class="eb muted">Parkas ir modelio prielaidos</span></div><div class="card-b"><div class="set-grid">
    ${Object.entries(PLANTS).map(([p, P]) => `<div class="fld"><label for="fl${p}">${P.name}: savų betonvežių</label><input id="fl${p}" data-fleet="${p}" type="number" min="0" max="40" value="${S.fleet[p]}"></div>`).join('')}</div>
    <div class="note">Krovimas – ${LOAD} min. reisui, mazgo riba ${PCAP} m³ per 30 min. (~70 m³/val.), reisas ≤ ${TRIP} m³. Intervalas pagal nutylėjimą: su siurbliu 15 min., be siurblio 20 min. Kelionės laiką siūlo ${BP}, jį galima pakeisti. Diena 06:00–18:00. Fonas – kai prijungta duomenų bazė, tikras tos dienos BetonPro planas (reisai pagal planuotą atvykimo laiką, kelionė pagal km); be jos – 2026-11-03 planas visoms darbo dienoms. Parko skaičiai – prielaidos (savi betonvežiai); dienos apkrovoje matosi, kiek betonvežių BetonPro tą dieną dirbo iš tikrųjų.</div></div></div>
    <div class="card"><div class="card-h"><span class="eb muted">AI užklausos šioje naršyklėje</span></div><div class="card-b"><span class="mono" style="font-size:12.5px">${log.length} užklausų · įvesties ${tin.toLocaleString('lt')} · išvesties ${tout.toLocaleString('lt')} žetonų</span>
    ${log.length ? `<table class="tb"><thead><tr><th>Laiškas</th><th>Modelis</th><th>Laikas</th><th>Žetonai</th></tr></thead><tbody>${log.slice(0, 15).map((x) => `<tr><td>${x.id}</td><td class="mono">${esc(x.model)}</td><td class="mono">${(x.ms / 1000).toFixed(1)} s</td><td class="mono">${x.in || 0} / ${x.out || 0}</td></tr>`).join('')}</tbody></table>` : ''}</div></div>`;
}

function dbSettingsHTML() {
  const B = window.BPDB, t = B.tok(), st = B.st;
  const badge = st.loading ? '<span class="st">KRAUNAMA…</span>' : st.ok ? '<span class="st st-ok">PRIJUNGTA</span>' : '<span class="st st-bad">NEPRIJUNGTA</span>';
  return `<div class="card"><div class="card-h"><span class="eb muted">Duomenų bazė (privati saugykla ${esc(B.REPO)})</span>${badge}</div><div class="card-b">
    <div class="note">Užsakymų istorija, kainos, klientų kortelės ir tikras dienos planas imami iš privačios GitHub saugyklos. Reikia GitHub rakto, kuris leidžia tik skaityti šią saugyklą. Raktas saugomas tik šioje naršyklėje ir siunčiamas tik į api.github.com.<br><b>Kaip gauti:</b> github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. Repository access: <i>Only select repositories</i> → betonpro-duomenys. Permissions → Repository permissions → Contents: <i>Read-only</i>.</div>
    <div class="set-grid"><div class="fld"><label for="ghk">GitHub raktas</label><input id="ghk" type="password" autocomplete="off" placeholder="github_pat_…" value="${t ? '••••••••' + esc(t.slice(-4)) : ''}"></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-dark" id="saveGh">Išsaugoti ir įkelti</button><button type="button" class="btn" id="reloadDb" ${t ? '' : 'disabled'}>Įkelti iš naujo</button><button type="button" class="btn btn-ghost" id="delGh" ${t ? '' : 'disabled'}>Ištrinti raktą</button></div>
    ${st.err ? `<div class="err">${esc(st.err)}</div>` : ''}${st.ok ? `<div class="okbox">Įkelta ${esc(st.at.slice(11, 16))}: ${st.n.uzsakymai.toLocaleString('lt')} užsakymų (${st.n.vezimai.toLocaleString('lt')} reisų), ${st.n.saskaitu_eilutes.toLocaleString('lt')} sąskaitų eilučių, ${st.n.klientai} klientų${st.n.laiskai ? ', ' + st.n.laiskai + ' laiškų su kontaktais (P01–P' + String(st.n.laiskai).padStart(2, '0') + ')' : ''}.</div>` : ''}</div></div>`;
}
async function loadDb() { if (!window.BPDB.tok()) return; renderNav(); if (S.view === 'settings') renderSettings(); await window.BPDB.load(); if (window.BPDB.letters) { LETTERS = window.BPDB.letters; if (!LETTERS.find((L) => L.id === S.sel)) S.sel = LETTERS[0].id; } renderAll(); if (window.BPDB.st.ok) toast('Duomenų bazė įkelta.'); else if (window.BPDB.st.err) toast('Duomenų bazės įkelti nepavyko.'); }
/* ---------- veiksmai ---------- */
function curOrder(t) { const sec = t.closest('section.order'); if (!sec) return null; const E = S.ed[S.sel]; return E && E.orders[Number(sec.dataset.i)]; }
function approve() {
  const L = LETTERS.find((x) => x.id === S.sel), E = S.ed[L.id], R = S.res[L.id] || {};
  const prev = S.appr[L.id] || null, ai = apprIdx(L.id);
  const out = prev ? prev.orders.slice() : [], doneIdx = prev ? (prev.doneIdx || []).slice() : []; let cancelled = prev ? prev.cancelled || '' : '';
  E.orders.forEach((o, i) => {
    if (ai.has(i) || isSkip(L.id, o, i)) return;
    if (o.action === 'atsaukti') {
      const hit = Object.entries(S.appr).find(([lid, a]) => lid !== L.id && a.orders.some((x) => x.client === o.client && x.date === o.date && (!o.qty || Number(x.qty) === Number(o.qty))));
      if (hit) { const [lid, a] = hit; a.orders = a.orders.filter((x) => !(x.client === o.client && x.date === o.date)); cancelled = 'Atšauktas anksčiau patvirtintas ' + o.client + ' ' + o.date + ' užsakymas – išimtas iš plano.'; }
      else cancelled = 'Atšaukimas užfiksuotas (šiame teste susieto patvirtinto užsakymo nėra).';
      doneIdx.push(i); return;
    }
    if (isQuestion(L.id) || R.tipas === 'ne_uzsakymas') { doneIdx.push(i); return; }
    const oid = L.id + ':' + i, tp = timePlan(o, oid); if (!tp) return;
    const s = simTrips(o, o.plant, tp.Sm, oid), rc = recipeById(o.recipeId);
    out.push(Object.assign(clone(o), { _i: i, S: tp.Sm, lastArr: s.last, pumpEnd: s.done + 30, trips: s.trips, pumpId: tp.pumpId, pumpCar: tp.pumpCar, hire: tp.hire, recipeCode: rc ? rc.code : '', client: L.company }));
  });
  const got = new Set(out.map((o) => o._i).concat(doneIdx)), partial = E.orders.some((o, i) => !got.has(i));
  const ta = $('#replyTa'), ed = $('#replyEd');
  S.appr[L.id] = { at: new Date().toISOString(), orders: out, doneIdx, cancelled, reply: ed ? ed.innerText + '\n\n—\nParengta su BetonPro HUB' : ta ? ta.value : '', replyH: ed ? ed.innerHTML + MFOOT : null, partial };
  E.reply = null; E.replyH = null; E.replyBase = null;
  save(); toast((out.length ? 'Patvirtinta: ' + out.length + ' užs. įtraukta į dienos planą.' : 'Patvirtinta.') + (partial ? ' Likę užsakymai laukia.' : ' Atidarytas kitas laukiantis laiškas.'));
  if (partial) renderAll(); else goNext();
}
// Po veiksmo – kitas laukiantis laiškas (pagal sąrašo eilę po dabartinio, kitaip pirmas laukiantis).
function goNext() {
  const ids = filtered().map((x) => x.id), all = LETTERS.map((x) => x.id), cur = all.indexOf(S.sel);
  const order = all.slice(cur + 1).concat(all.slice(0, cur + 1));
  const n = order.find((id) => id !== S.sel && isPending(id) && (ids.includes(id) || S.filter === 'all' || S.filter === 'todo'));
  if (n) S.sel = n; save(); renderAll(); scrollSel(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function scrollSel() { const b = document.querySelector('.li[aria-current="true"]'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest' }); }
function jumpTo(i, f) {
  const oid = S.sel + ':' + i;
  S.ocol = S.ocol || {}; S.ocol[oid] = false;
  if (f === 'rcp') S.rcpOpen[oid] = true; else if (f !== 'time' && f !== 'price' && f !== 'tr') S.oopen[oid] = true;
  save(); renderDetail();
  const sec = document.getElementById('ord-' + i); if (!sec) return;
  const el = f === 'rcp' ? sec.querySelector('.rcp') : f === 'time' ? sec.querySelector('.cap') : f === 'price' ? sec.querySelector('[data-f="price"]') || sec.querySelector('.blk[id^="tr-"]') : f === 'tr' ? sec.querySelector('.blk[id^="tr-"]') : sec.querySelector('[data-k="' + f + '"]');
  const box = (el && el.closest('.fld')) || el || sec;
  box.scrollIntoView({ behavior: 'smooth', block: 'center' }); box.classList.add('flash'); setTimeout(() => box.classList.remove('flash'), 1800);
  const inp = f === 'rcp' ? sec.querySelector('.rcp-qi') : el && /INPUT|SELECT/.test(el.tagName) ? el : null; if (inp) setTimeout(() => inp.focus({ preventScroll: true }), 350);
}
// Tempimas: geltoni naujo užsakymo stulpeliai / siurblio blokas – keičia laiką (pilnos valandos); siurblio blokas į kitą eilutę – keičia siurblį.
function dragBind() {
  let D = null;
  const info = (i) => { const E = S.ed[S.sel], o = E && E.orders[i]; if (!o) return null; const P = b3plan(o, S.sel + ':' + i); return P ? { o, P } : null; };
  const tAt = (track, hz, x) => { const r = track.getBoundingClientRect(), f = Math.max(0, Math.min(1, (x - r.left) / r.width)); return 360 + Math.round(f * hz * 30 / 60) * 60; };
  document.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest('[data-drag]'); if (!el) return;
    const pump = !!el.closest('.b3pumps'), box = pump ? el.closest('.b3pumps') : el.closest('.b3pl2'), track = pump ? el.closest('.b3pt') : box;
    const i = Number(el.dataset.drag), hz = Number(box.dataset.hz), X = info(i); if (!X || !track) return;
    ev.preventDefault();
    const ghost = document.createElement('div'); ghost.className = 'dragg'; track.appendChild(ghost);
    D = { i, hz, pump, box, track, ghost, X, x0: ev.clientX, y0: ev.clientY, m: X.P.sel, car: null, moved: false };
    document.body.classList.add('dragging');
    const mv = (e) => {
      if (!D) return; D.moved = D.moved || Math.abs(e.clientX - D.x0) > 4 || Math.abs(e.clientY - D.y0) > 6;
      const m = tAt(D.track, D.hz, e.clientX), o = D.X.o, T = Number(o.travel) || 40, ok = (o.mode === 'savivartis' ? m - LOAD : m - T - LOAD) >= 360;
      const w = D.X.P.win, inWin = !w || (m >= w[0] + 360 && m <= w[1] + 360);
      const r = D.X.P.res.find((x) => x.m === m);
      let tx = hhmm(m) + (r ? ' · +' + sp(r.add) + ' €' : '') + (!ok ? ' · anksti krauti' : !inWin ? ' · už kliento lango' : '');
      if (D.pump) { const tr = document.elementFromPoint(e.clientX, e.clientY), row = tr && tr.closest('.b3pr[data-car]'); $$('.b3pr.drop').forEach((x) => x.classList.remove('drop')); if (row && !row.classList.contains('ax')) { row.classList.add('drop'); D.car = row.dataset.car; D.len = Number(row.dataset.len) || 0; const want = Number((D.X.o.pump || {}).len) || 28; tx += ' · ' + row.querySelector('.b3pl b').textContent + (row.dataset.own && row.dataset.own !== 'C3' ? ' · ' + row.dataset.own : '') + (D.len && Math.abs(D.len - want) > 2 && (D.len < want || ptypeOf(D.len) !== ptypeOf(want)) ? ' · ' + D.len + ' m ≠ ' + want + ' m' : ''); } else D.car = null; }
      D.m = m;
      D.ghost.style.left = ((m - 360) / (D.hz * 30) * 100).toFixed(2) + '%'; D.ghost.dataset.t = tx; D.ghost.classList.toggle('early', !ok);
    };
    const up = () => {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
      document.body.classList.remove('dragging'); $$('.b3pr.drop').forEach((x) => x.classList.remove('drop'));
      const d = D; D = null; if (d.ghost) d.ghost.remove(); if (!d.moved) return;
      const oid = S.sel + ':' + d.i, st = (S.b3 = S.b3 || {})[oid] = S.b3[oid] || {};
      if (d.m != null) st.t = d.m;
      if (d.pump && d.car) {
        const o = d.X.o, want = Number((o.pump || {}).len) || 28;
        if (d.len && d.car !== 'samdomas' && ptypeOf(d.len) !== ptypeOf(want)) {
          if (!window.confirm('Klientas prašo ' + want + ' m siurblio, o šis siurblys – ' + d.len + ' m (' + ptypeOf(d.len) + '). Pakeisti užsakymo siurblį į ' + d.len + ' m?')) { save(); keep(renderDetail); return; }
          o.pump = Object.assign({}, o.pump, { need: true, len: d.len }); o.priceOk = false;
        }
        st.pc = d.car;
        // jei pasirinktas siurblys tuo metu užimtas – pasiūlyti artimiausią laisvą valandą
        const P = b3plan(o, oid);
        if (P && P.pp && P.pp.forceFail) {
          const cand = []; for (let m = 420; m <= 1020; m += 60) { const pp = pumpPick(P.D, o, m, simTrips(o, o.plant, m - 360, 'x'), d.car); const T = Number(o.travel) || 40; if (pp && !pp.forceFail) cand.push(m + (m - T - LOAD >= 360 ? 0 : 0.5)); }
          const near0 = cand.sort((a, b) => (a % 1) - (b % 1) || Math.abs(a - P.sel) - Math.abs(b - P.sel))[0], near = near0 == null ? null : Math.floor(near0);
          if (near != null && window.confirm('Siurblys ' + d.car.replace(/^samdomas·.*/, 'samdomas') + ' ' + hhmm(P.sel) + ' užimtas. Perkelti užsakymą į ' + hhmm(near) + '?')) st.t = near;
          else if (near == null) toast('Šis siurblys visą dieną užimtas – liko ankstesnis siurblys.');
        }
      }
      save(); keep(renderDetail); renderSide(); b3scroll();
      toast('Pasirinkta ' + (d.m != null ? hhmm(d.m) : 'laikas nepakeistas') + (d.pump && d.car ? ' · siurblys ' + (d.car === 'samdomas' ? 'naujas samdomas' : d.car.replace(/^samdomas·.*/, 'jau samdytas')) : '') + '.');
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    mv(ev);
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.target.id === 'xrcIn' && ev.key === 'Enter') { ev.preventDefault(); const b = $('#xrcAdd'); if (b) b.click(); return; }
    const el = ev.target.closest && ev.target.closest('[data-b3t]'); if (!el || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
    const [i, m] = el.dataset.b3t.split(':'); const oid = S.sel + ':' + i, st = (S.b3 = S.b3 || {})[oid] = S.b3[oid] || {};
    const cur = st.t || Number(m); st.t = Math.max(360, Math.min(1080, (Number($('.b3o[aria-pressed="true"]') ? $('.b3o[aria-pressed="true"]').dataset.b3t.split(':')[1] : cur)) + (ev.key === 'ArrowRight' ? 60 : -60)));
    ev.preventDefault(); save(); keep(renderDetail); b3scroll(); const n = $('.b3o[aria-pressed="true"]'); if (n) n.focus();
  });
}
function bind() {
  dragBind();
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('button,a'); if (!t) return;
    if (t.classList.contains('nvl')) { S.view = t.dataset.view; save(); renderAll(); return; }
    if (t.dataset.goto) { S.view = t.dataset.goto; if (t.dataset.date) S.loadDate = t.dataset.date; save(); renderAll(); window.scrollTo(0, 0); return; }
    if (t.dataset.lgo != null) { if (t.dataset.lgo) { S.sel = t.dataset.lgo; save(); renderLetters(); scrollSel(); window.scrollTo({ top: 0 }); } return; }
    if (t.classList.contains('li')) { S.sel = t.dataset.id; save(); renderLetters(); if (isMob()) { document.body.classList.add('m-detail'); window.scrollTo({ top: 0 }); } else if (window.innerWidth < 1100) $('#detail').scrollIntoView({ behavior: 'smooth' }); return; }
    if (t.dataset.mback != null) { document.body.classList.remove('m-detail'); scrollSel(); const s = $('.li[aria-current="true"], .li.on'); if (s) s.scrollIntoView({ block: 'center' }); return; }
    if (t.dataset.f) { S.filter = t.dataset.f; save(); renderLetters(); return; }
    if (t.dataset.ld) { S.loadDate = t.dataset.ld; save(); renderLoad(); return; }
    if (t.id === 'runAll') { runAll(); return; }
    if (t.id === 'runOne' || t.id === 'rerun') { runAI(S.sel); return; }
    if (t.id === 'manual') { S.res[S.sel] = { tipas: 'naujas', santrauka: 'Juodraštis pildomas ranka', tikrumas: 0, uzsakymai: [], truksta: [], paaiskinimas: 'Be AI.' }; S.ed[S.sel] = { orders: [blankOrder()], reply: null }; save(); renderLetters(); return; }
    if (t.id === 'addOrder') { S.ed[S.sel].orders.push(blankOrder()); save(); renderLetters(); return; }
    if (t.dataset.del != null) { S.ed[S.sel].orders.splice(Number(t.dataset.del), 1); save(); renderLetters(); return; }
    if (t.dataset.rcp) { const o = curOrder(t); if (o) { const E = S.ed[S.sel], i = E.orders.indexOf(o); o.recipeId = Number(t.dataset.rcp); o.priceOk = false; o.rcpMan = true; o.rcpWhy = 'man'; o.rcpFrom = null; propagateRecipe(E, i); S.rcpOpen[S.sel + ':' + i] = false; if (S.rqo) delete S.rqo[S.sel + ':' + i]; save(); renderLetters(); } return; }
    if (t.dataset.pricechk != null) { const o = S.ed[S.sel].orders[Number(t.dataset.pricechk)]; o.priceChk = !o.priceChk; save(); renderLetters(); return; }
    if (t.dataset.priceok != null) { const o = S.ed[S.sel].orders[Number(t.dataset.priceok)]; o.priceOk = !o.priceOk; save(); renderLetters(); return; }
    if (t.dataset.ocol != null) { const k = S.sel + ':' + t.dataset.ocol, sec = t.closest('section.order'); S.ocol = S.ocol || {}; S.ocol[k] = !(sec && sec.classList.contains('col')); save(); keep(renderDetail); return; }
    if (t.dataset.tropen != null) { const k = S.sel + ':' + t.dataset.tropen; S.trOpen = S.trOpen || {}; S.trOpen[k] = !S.trOpen[k]; save(); keep(renderDetail); return; }
    if (t.dataset.rcpopen != null) { const k = S.sel + ':' + t.dataset.rcpopen; S.rcpOpen[k] = !S.rcpOpen[k]; save(); renderDetail(); return; }
    if (t.dataset.oopen != null) { const k = S.sel + ':' + t.dataset.oopen, sec = t.closest('section.order'); const cur = sec && sec.querySelector('.grid-f'); S.oopen[k] = !cur; save(); keep(renderDetail); return; }
    if (t.dataset.chopen != null) { const k = S.sel + ':' + t.dataset.chopen; S.chOpen[k] = !S.chOpen[k]; save(); keep(renderDetail); return; }
    if (t.dataset.msg) { S.msgOpen[t.dataset.msg] = !S.msgOpen[t.dataset.msg]; save(); renderDetail(); return; }
    if (t.dataset.jump) { ev.preventDefault(); const [i, f] = t.dataset.jump.split(':'); jumpTo(Number(i), f); return; }
    if (t.dataset.jumpo != null) { S.ocol = S.ocol || {}; S.ocol[S.sel + ':' + t.dataset.jumpo] = false; renderDetail(); const sec = document.getElementById('ord-' + t.dataset.jumpo); if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (t.dataset.close) { S.closed[t.dataset.close] = true; save(); toast('Laiškas uždarytas.'); renderAll(); return; }
    if (t.id === 'xrcAdd') { const inp = $('#xrcIn'), v = (inp.value || '').trim(), msg = $('#xrcMsg'); if (!v) return; const k = isMail(v) ? 'mail' : isTel(v) ? 'tel' : null; if (!k) { msg.textContent = 'Neteisingas el. pašto adresas ar telefonas.'; return; } const E = S.ed[S.sel]; E.xrc = E.xrc || []; if (E.xrc.some((x) => x.v.toLowerCase() === v.toLowerCase())) { msg.textContent = 'Toks adresatas jau yra.'; return; } E.xrc.push({ v: k === 'tel' ? v.replace(/[\s-]/g, '') : v, k, on: true }); save(); renderSide(); return; }
    if (t.dataset.xdel != null) { const E = S.ed[S.sel]; (E.xrc || []).splice(Number(t.dataset.xdel), 1); save(); renderSide(); return; }
    if (t.id === 'sendR') { const ed = $('#replyEd'), ta = $('#replyTa'); S.sent = S.sent || {}; S.sent[S.sel] = { at: new Date().toISOString(), reply: ed ? ed.innerText + '\n\n—\nParengta su BetonPro HUB' : ta ? ta.value : '', replyH: ed ? ed.innerHTML + MFOOT : null }; S.closed[S.sel] = true; save(); toast('Atsakymas pažymėtas kaip išsiųstas (testas) – atidarytas kitas laiškas.'); goNext(); return; }
    if (t.id === 'closeL') { S.closed[S.sel] = true; save(); toast('Laiškas uždarytas – atidarytas kitas laukiantis.'); goNext(); return; }
    if (t.id === 'unclose') { delete S.closed[S.sel]; if (S.sent) delete S.sent[S.sel]; save(); renderAll(); return; }
    if (t.dataset.b3fs != null) { const v = Number(t.dataset.b3fs); B3FS = v >= 0 ? v : null; b3mob(); return; }
    if (t.id === 'toTop') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (t.id === 'toAppr') { const x = apprEl(); if (x) { (x.closest('.card') || x).scrollIntoView({ behavior: 'smooth', block: 'end' }); } return; }
    if (t.dataset.b3v) { const [i, v] = t.dataset.b3v.split(':'); const oid = S.sel + ':' + i; S.b3 = S.b3 || {}; (S.b3[oid] = S.b3[oid] || {}).v = v; save(); keep(renderDetail); b3scroll(); return; }
    if (t.dataset.timeok != null) { const oid = S.sel + ':' + t.dataset.timeok, st = (S.b3 = S.b3 || {})[oid] = S.b3[oid] || {}; const E = S.ed[S.sel], P = b3plan(E.orders[Number(t.dataset.timeok)], oid); st.okT = st.okT === P.sel ? null : P.sel; save(); keep(renderDetail); renderSide(); return; }
    if (t.dataset.b3t) { const [i, m] = t.dataset.b3t.split(':'); const oid = S.sel + ':' + i; S.b3 = S.b3 || {}; (S.b3[oid] = S.b3[oid] || {}).t = Number(m); save(); keep(renderDetail); b3scroll(); return; }
    if (t.dataset.pick) { const [i, k] = t.dataset.pick.split(':').map(Number); S.ed[S.sel].orders[i].pick = k; save(); renderLetters(); return; }
    if (t.id === 'noteSend') { const v = $('#noteTa').value.trim(); if (!v) return; (S.notes[S.sel] = S.notes[S.sel] || []).push(v); delete S.nd[S.sel]; save(); if (key()) runAI(S.sel); else { toast('Pastaba išsaugota. AI neprijungtas – juodraštį koreguokite ranka.'); renderLetters(); } return; }
    if (t.id === 'replyReset' || t.id === 'replyReset2' || t.id === 'replyFromFields') { const E = S.ed[S.sel]; if (t.id === 'replyFromFields' && E.reply != null && E.reply !== (E.fmt === 'sms' ? smsText(S.sel) : genReply(S.sel)) && !window.confirm('Ranka redaguotas tekstas bus pakeistas atsakymu pagal įvestus duomenis. Tęsti?')) return; E.reply = null; E.replyH = null; E.replyBase = null; save(); renderSide(); const ta = $('#replyTa') || $('#replyEd'); if (ta) { ta.classList.add('flash'); setTimeout(() => ta.classList.remove('flash'), 1500); } return; }
    if (t.id === 'writeOwn') { const E = S.ed[S.sel]; E.reply = 'Laba diena,\n\n\n\n' + sig(LETTERS.find((x) => x.id === S.sel)); E.replyBase = ''; save(); renderSide(); return; }
    if (t.dataset.ev) { const e = S.ev[S.sel] = S.ev[S.sel] || {}; const v = t.dataset.ev === 'ok'; e.ok = e.ok === v ? null : v; e.at = new Date().toISOString(); save(); renderList(); renderDetail(); if (e.ok === false) { const c = $('#evCom'); if (c) c.focus(); } return; }
    if (t.dataset.fmt) { const E = S.ed[S.sel]; if ((E.fmt || 'mail') !== t.dataset.fmt) { if ((E.reply != null || E.replyH != null) && !window.confirm('Ranka redaguotas tekstas bus pakeistas. Tęsti?')) return; E.fmt = t.dataset.fmt; E.reply = null; E.replyH = null; E.replyBase = null; save(); renderSide(); } return; }
    if (t.id === 'approve') { approve(); return; }
    if (t.id === 'undo') { delete S.appr[S.sel]; save(); renderAll(); return; }
    if (t.id === 'undoPart') { delete S.appr[S.sel]; save(); renderAll(); return; }
    if (t.id === 'reject') { S.rej[S.sel] = true; save(); goNext(); return; }
    if (t.id === 'unrej') { delete S.rej[S.sel]; save(); renderAll(); return; }
    if (t.id === 'btnReset') { if (window.confirm('Išvalyti visą testo būseną (AI rezultatus, patvirtinimus, pastabas)? API raktas liks.')) { S = DEF(); save(); renderAll(); } return; }
    if (t.id === 'saveKey') { const v = $('#apik').value.trim(); if (v && !v.startsWith('••')) { setKey(v); $('#keyMsg').innerHTML = '<div class="okbox">Raktas išsaugotas šioje naršyklėje.</div>'; renderNav(); renderSettings(); } return; }
    if (t.id === 'delKey') { setKey(''); renderNav(); renderSettings(); return; }
    if (t.id === 'testKey') { testKey(); return; }
    if (t.id === 'saveGh') { const v = $('#ghk').value.trim(); if (v && !v.startsWith('••')) window.BPDB.setTok(v); loadDb(); return; }
    if (t.id === 'reloadDb') { loadDb(); return; }
    if (t.id === 'delGh') { window.BPDB.setTok(''); window.BPDB.st.ok = false; window.BPDB.st.err = null; location.reload(); return; }
  });
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.id === 'replyEd') { const E = S.ed[S.sel]; if (E.reply == null && E.replyH == null) E.replyBase = genReply(S.sel); E.replyH = t.innerHTML; E.reply = t.innerText; save(); return; }
    if (t.id === 'replyTa') { const E = S.ed[S.sel]; if (E.reply == null) E.replyBase = E.fmt === 'sms' ? smsText(S.sel) : genReply(S.sel); E.reply = t.value; save(); return; }
    if (t.id === 'noteTa') { S.nd[S.sel] = t.value; save(); return; }
    if (t.id === 'lq') { S.lq = t.value; clearTimeout(bind._l); bind._l = setTimeout(() => { renderList(); const x = $('#lq'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 250); return; }
    if (t.id === 'evCom') { const e = S.ev[S.sel] = S.ev[S.sel] || {}; e.c = t.value; e.at = new Date().toISOString(); save(); return; }
    if (t.id === 'subj') { S.ed[S.sel].subj = t.value; save(); return; }
    if (t.dataset && t.dataset.rqo != null) { const k = S.sel + ':' + t.dataset.rqo; S.rqo = S.rqo || {}; S.rqo[k] = t.value; clearTimeout(bind._o); bind._o = setTimeout(() => { keep(renderDetail); const x = document.querySelector('.rcp-qi[data-rqo="' + t.dataset.rqo + '"]'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 250); return; }
    if (t.id === 'rq') { S.rq = t.value; clearTimeout(bind._q); bind._q = setTimeout(() => { renderRecipes(); const x = $('#rq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); return; }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.k) {
      const o = curOrder(t); if (!o) return; const k = t.dataset.k, v = t.value;
      if (k === 'pumpLen') o.pump = { need: !!v, len: v ? Number(v) : null };
      else if (['price', 'trPrice', 'pAtv', 'pVal', 'papVal'].includes(k)) { const x = pnum(v); o[k] = x == null ? '' : Math.round(x * 100) / 100; o.priceChk = false; }
      else if (['qty', 'travel', 'interval'].includes(k)) o[k] = v === '' ? '' : Number(String(v).replace(',', '.'));
      else if (k === 'mode') { o.mode = v; if (v === 'savivartis') o.terms = 'exw'; else if (o.terms === 'exw') o.terms = ''; }
      else if (k === 'asked') { o.asked = v; o.props = normProps([v]); }
      else if (k === 'win') { o.win = v; if (v) o.time = ''; }
      else if (k === 'time') { o.time = v; if (v) o.win = ''; }
      else o[k] = v;
      if (['asked', 'plant', 'pumpLen', 'action'].includes(k)) autoRecipe(o);
      if (['asked', 'plant', 'terms', 'mode', 'pumpLen'].includes(k)) o.priceOk = false;
      if (['date', 'time', 'win', 'plant', 'qty', 'pumpLen', 'mode', 'travel', 'interval'].includes(k)) { o.pick = null; const E = S.ed[S.sel], st = S.b3 && S.b3[S.sel + ':' + E.orders.indexOf(o)]; if (st) { delete st.t; delete st.pc; if (k === 'plant') delete st.v; } }
      save(); renderLetters(); return;
    }
    if (t.dataset.skip != null) { const o = S.ed[S.sel].orders[Number(t.dataset.skip)]; o.skip = !t.checked; save(); renderLetters(); return; }
    if (/^rcX\d+$/.test(t.id)) { const E = S.ed[S.sel], x = (E.xrc || [])[Number(t.id.slice(3))]; if (x) { x.on = t.checked; save(); } return; }
    if (['rcTel', 'rcMail', 'rcUTel', 'rcUMail', 'rcCMail'].includes(t.id)) { const E = S.ed[S.sel], L = LETTERS.find((x) => x.id === S.sel); E.rc = E.rc || { tel: false, mail: L.channel === 'email', umail: true }; E.rc[{ rcTel: 'tel', rcMail: 'mail', rcUTel: 'utel', rcUMail: 'umail', rcCMail: 'cmail' }[t.id]] = t.checked; save(); renderSide(); return; }
    if (t.id === 'force') { const b = $('#approve'); if (b) b.disabled = !t.checked; return; }
    if (t.id === 'ld') { S.loadDate = t.value; save(); renderLoad(); return; }
    if (t.id === 'bgT') { S.bg = t.checked; save(); renderLoad(); return; }
    if (t.id === 'bgSrc') { S.bgSrc = t.value; save(); renderLoad(); return; }
    if (t.id === 'rp') { S.rp = t.value; renderRecipes(); return; }
    if (t.id === 'meU') { S.me = t.value; save(); renderNav(); toast('Atsakymus pasirašys: ' + me().n + '.'); return; }
    if (t.id === 'mdl') { S.model = t.value; save(); renderNav(); return; }
    if (t.dataset.fleet) { S.fleet[t.dataset.fleet] = Math.max(0, Number(t.value) || 0); save(); return; }
  });
}
function blankOrder() { const L = LETTERS.find((x) => x.id === S.sel); return { action: 'naujas', date: '', time: '', object: '', address: '', asked: '', props: [], slump: '', qty: '', pump: { need: false, len: null }, mode: 'betonvezis', interval: '', additives: '', plant: 'S', travel: 40, notes: '', ref: '', recipeId: null, pick: null, client: L ? L.company : '' }; }
async function runAll() {
  const ids = LETTERS.filter((L) => !(S.res[L.id] && S.res[L.id].tipas)).map((L) => L.id);
  toast(BP.replace(/<[^>]+>/g, '') + ' skaito ' + ids.length + ' laiškus…');
  for (const id of ids) await runAI(id);
  toast('Baigta: perskaityta ' + ids.length + ' laiškų.');
}
async function testKey() {
  const m = $('#keyMsg'); m.innerHTML = '<span class="spin dk"></span>';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key(), 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }, body: JSON.stringify({ model: S.model, max_tokens: 20, messages: [{ role: 'user', content: 'Atsakyk vienu žodžiu: veikia?' }] }) });
    const j = await r.json(); if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
    m.innerHTML = '<div class="okbox">Ryšys veikia (' + esc(S.model) + ').</div>';
  } catch (e) { m.innerHTML = '<div class="err">' + esc(e.message) + '</div>'; }
}
let tT = null;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(tT); tT = setTimeout(() => { t.hidden = true; }, 3500); }

function fabUpd() {
  const b = document.getElementById('toTop'); if (b) b.hidden = window.scrollY < 500;
  const a = document.getElementById('toAppr'), x = apprEl();
  if (a) { const r = x && x.getBoundingClientRect(); a.hidden = !x || !x.offsetParent || (r.top < window.innerHeight - 40 && r.bottom > 60); }
}
// Tvirtinimo vieta: veiksmų mygtukai dešiniajame skydelyje (telefone – po laišku).
const apprEl = () => document.querySelector('#side .acts');
window.addEventListener('scroll', fabUpd, { passive: true }); window.addEventListener('resize', () => { fabUpd(); b3mob(); });
new MutationObserver(() => requestAnimationFrame(b3mob)).observe(document.getElementById('detail') || document.body, { childList: true, subtree: false });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && B3FS != null) { B3FS = null; b3mob(); } });
setInterval(fabUpd, 800);
async function boot() {
  S = load();
  try {
    const [a, b, c] = await Promise.all(['data/letters.json', 'data/recipes.json', 'data/baseline-2026-11-03.json'].map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); })));
    LETTERS = a; RECIPES = b.recipes; BASE = c;
  } catch (e) { document.body.insertAdjacentHTML('afterbegin', '<div class="err">Nepavyko įkelti duomenų: ' + esc(e.message) + '</div>'); return; }
  bind(); renderAll(); loadDb();
}
window.__bp = { quickStats, orderProbs, isQuestion, complete, get S() { return S; }, normProps, recipeOptions, capOptions, genReply, fromAI, initEdit, approve, renderAll, status, save, get LETTERS() { return LETTERS; }, setRes: (id, r) => { S.res[id] = r; initEdit(id, true); save(); renderAll(); } };
boot();
})();
