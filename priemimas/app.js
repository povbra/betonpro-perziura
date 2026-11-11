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
const BP = '<span class="bp" aria-label="BetonPro">BP</span>';

const PLANTS = {
  R: { name: 'Runeikiai', area: 'Kėdainių r.', lat: 55.300, lng: 23.905 },
  S: { name: 'Stašėnai', area: 'Jonavos r.', lat: 55.063, lng: 24.255 },
  B: { name: 'Baisogala', area: 'Radviliškio r.', lat: 55.640, lng: 23.720 }
};
const PUMPS = [{ id: 'PUMI 28', len: 28 }, { id: 'PUMI 29', len: 29 }, { id: 'PUMP 36', len: 36 }, { id: 'PUMP 42', len: 42 }];
const BCODE = { I28: 'PUMI 28', I29: 'PUMI 29', P36: 'PUMP 36', P42: 'PUMP 42' };
const DAY = 720, PCAP = 35, TRIP = 7, LOAD = 8;
const TYPES = {
  naujas: { lab: 'Naujas užsakymas', sq: 'background:#1E8A5A' },
  grafikas: { lab: 'Savaitės grafikas', sq: 'background:#3B5B8C' },
  pakeitimas: { lab: 'Pakeitimas', sq: 'background:#F5C518;box-shadow:inset 0 0 0 1px #15171A' },
  atsaukimas: { lab: 'Atšaukimas', sq: 'background:#D2452F' },
  klausimas: { lab: 'Trūksta informacijos', sq: 'background:#F5C518;box-shadow:inset 0 0 0 1px #15171A' },
  ne_uzsakymas: { lab: 'Ne užsakymas', sq: 'border:1.5px dashed #8A9097' }
};
const MODELS = [['claude-sonnet-5-5', 'Claude Sonnet 5.5 (rekomenduojama)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (pigiausia, greičiausia)'], ['claude-opus-5-5', 'Claude Opus 5.5 (tiksliausia)']];

let LETTERS = [], RECIPES = [], BASE = [];
let S = null;
const busy = {};

const DEF = () => ({ v: 1, model: 'claude-sonnet-5-5', fleet: { R: 4, S: 7, B: 12 }, bg: true, res: {}, notes: {}, ed: {}, appr: {}, rej: {}, sel: null, filter: 'all', view: 'letters', loadDate: null, aiLog: [] });
function load() { try { const x = JSON.parse(localStorage.getItem(LS) || 'null'); if (x && x.v === 1) return Object.assign(DEF(), x); } catch (e) {} return DEF(); }
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
function classify(r, req) {
  const miss = req.filter((x) => !r.props.includes(x)), extra = r.props.filter((x) => !req.includes(x) && x !== 'X0');
  return { miss, extra, kind: miss.length ? 'miss' : extra.length ? 'extra' : 'fit' };
}
function recipeOptions(o) {
  const req = normProps(o.props && o.props.length ? o.props : [o.asked || '']);
  const pool = RECIPES.filter((r) => r.active && r.kind === 'betonas');
  const at = pool.filter((r) => r.plant === o.plant).map((r) => Object.assign({ r }, classify(r, req)));
  const wantS = o.slump || (o.pump && o.pump.need ? 'S4' : null);
  const sc = (x) => (wantS && x.r.slump === wantS ? 0 : wantS ? 1 : 0) * 1000 + (o.dmax && x.r.dmax !== o.dmax ? 500 : 0) + x.r.price;
  const fit = at.filter((x) => x.kind === 'fit').sort((a, b) => sc(a) - sc(b));
  const extra = at.filter((x) => x.kind === 'extra' && x.miss.length === 0).sort((a, b) => a.extra.length - b.extra.length || sc(a) - sc(b)).slice(0, 4);
  const elsewhere = req.length > 1 && !fit.length ? pool.filter((r) => r.plant !== o.plant && classify(r, req).kind === 'fit') : [];
  return { req, fit, extra, elsewhere, wantS };
}

/* ---------- talpos modelis ---------- */
function interval(o) { if (o.interval) return Math.max(8, Number(o.interval)); return o.pump && o.pump.need ? 15 : 20; }
function simTrips(o, plant, Sm, oid) {
  const Q = Number(o.qty) || 0, n = Math.max(1, Math.ceil(Q / TRIP - 1e-9)), U = interval(o), T = Number(o.travel) || 40, out = [];
  const self = o.mode === 'savivartis' || o.mode === 'kriause';
  for (let k = 0; k < n; k++) {
    const arr = Sm + k * U, q = Math.min(TRIP, Q - k * TRIP);
    if (self) out.push([plant, oid, 0, '', arr - LOAD, arr, arr, q]);
    else out.push([plant, oid, 1, '', arr - T - LOAD, arr, arr + U + T, q]);
  }
  return { trips: out, n, ls: out[0][4], end: self ? Sm + n * U : Sm + (n - 1) * U + U + T, last: Sm + (n - 1) * U, U, T, self };
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
  if (S.bg && isWork(date)) {
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
function dayTrips(date, excludeOid) {
  const t = [];
  if (S.bg && isWork(date)) BASE.forEach((x) => t.push(x));
  Object.entries(S.appr).forEach(([lid, a]) => (a.orders || []).forEach((o, i) => { if (o.date === date && (lid + ':' + i) !== excludeOid && o.trips) o.trips.forEach((x) => t.push(x)); }));
  return t;
}
function check(o, plant, Sm, hire, oid) {
  const base = agg(dayTrips(o.date, oid)), s = simTrips(o, plant, Sm, oid), nt = agg(s.trips);
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
            laikas: { type: ['string', 'null'], description: 'HH:MM, pirmo betonvežio atvykimas į objektą arba atsiėmimo laikas. „Pirma dienos pusė“ – 08:00 ir pažymėk pastabose. null, jei nėra.' },
            objektas: { type: 'string' },
            adresas: { type: 'string' },
            koordinates: { type: ['string', 'null'] },
            marke_kaip_prase: { type: 'string', description: 'Tiksliai kaip parašė klientas, pvz. „C30/37 XC4XA1W6F150“.' },
            savybes: { type: 'array', items: { type: 'string' }, description: 'TIK tos savybės, kurias parašė klientas: stiprumo klasė (C30/37), aplinkos klasės (XC2, XA1, XF4…), F (F150), W (W6). Nieko nepridėk.' },
            slankumas: { type: ['string', 'null'], description: 'S1–S5, jei nurodė.' },
            dmax: { type: ['integer', 'null'] },
            kiekis_m3: { type: ['number', 'null'], description: 'Jei intervalas (6–7 m³) – didesnė reikšmė, pažymėk pastabose.' },
            siurblys_reikia: { type: 'boolean' },
            siurblio_ilgis_m: { type: ['integer', 'null'] },
            pristatymas: { type: 'string', enum: ['betonvezis', 'savivartis', 'kriause'], description: 'savivartis – klientas pasiima pats; kriause – betonvežis pila tiesiai iš kriaušės (be siurblio).' },
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
      klausimas_klientui: { type: ['string', 'null'], description: 'Vienas mandagus klausimas, jei be atsakymo negalima patvirtinti. Kitaip null.' },
      papildomas_tekstas: { type: ['string', 'null'], description: 'Neprivalomas 1–2 sakinių profesionalus papildymas atsakymui (pvz. dėl fibros, kristalų, lėtiklio, mokėtojo).' },
      atsakymas_ne_uzsakymui: { type: ['string', 'null'], description: 'Tik tipui ne_uzsakymas: trumpas profesionalus atsakymas be pasisveikinimo ir parašo, arba null, jei atsakyti nereikia.' },
      paaiskinimas: { type: 'string', description: 'Trumpai: iš kurių laiško vietų paimti duomenys ir kas neaišku.' }
    },
    required: ['tipas', 'santrauka', 'tikrumas', 'uzsakymai', 'truksta', 'paaiskinimas']
  }
};
function sysPrompt() {
  return [
    'Tu esi UAB „C3 Betonas“ (prekinis betonas, Lietuva) užsakymų priėmimo asistentas BetonPro sistemoje.',
    'Perskaityk kliento laišką (su priedų turiniu ir vadybininko pastabomis) ir grąžink struktūrizuotą juodraštį per įrankį uzsakymo_juodrastis.',
    'Mazgai: R – Runeikiai (Kėdainių r., prie Rail Baltica), S – Stašėnai (Jonavos r., arti Kauno, Jonavos, Ukmergės), B – Baisogala (Radviliškio r., Kemėrai, Šeduva, Šiauliai). Užsakymas vykdomas artimiausiame objektui mazge; jei klientas nurodo mazgą (pvz. „iš Stašėnų“) – jį. Objektai „89Q9+J8J Runeikiai“ ir Rail Baltica šalia Kėdainių – R. Kemėrų k. (Reino g., Rheinmetall) – B. Lapingė, Okainiai, Zujai, Jonava – S.',
    'Siurbliai: PUMI 28, PUMI 29 (pumikai), PUMP 36, PUMP 42. „Pumikas“ be ilgio – 28 m. „M36“ – 36 m.',
    'Savybes rašyk tik tas, kurias nurodė klientas. Neprisigalvok klasių. „C37/30“ greičiausiai reiškia C30/37 – pažymėk pastabose.',
    'Kiekvienai dienai/konstrukcijai – atskiras užsakymas. Savaitės grafikui – visi įrašai. Ankstesnės laiško versijos citatos (From:/Sent:) – tik kontekstas.',
    'Jei laiške tik parašas, o užsakymas priede – imk iš priedo. Jei priedo nėra arba neaišku – tipas „klausimas“.',
    'Laiškų vardai ir kontaktai užkoduoti (pvz. „A. S.“, „+370 6•• •• •••“) – taip ir palik.',
    'Rašyk lietuviškai, dalykiškai.'
  ].join('\n');
}
function userPrompt(L) {
  const prev = Object.entries(S.appr).flatMap(([lid, a]) => (a.orders || []).map((o) => `- ${o.client}: ${o.date} ${fmt(o.S)} · ${o.address || o.object} · ${o.qty} m³ ${o.asked}`));
  const att = (L.attachments || []).map((a) => `--- PRIEDAS: ${a.name} ---\n${a.text}`).join('\n\n');
  const notes = (S.notes[L.id] || []).map((n, i) => `P${i + 1}: ${n}`).join('\n');
  return `Laiškas gautas: ${L.received.replace('T', ' ')} (${wd(L.received.slice(0, 10))})\nKanalas: ${L.channel}, dėžutė ${L.box}\nSiuntėjas: ${L.contact.name}, ${L.company}\nTema: ${L.subject}\n\n${L.body}\n\n${att}${notes ? '\n\n--- VADYBININKO PASTABOS (svarbiau už laišką) ---\n' + notes : ''}${prev.length ? '\n\n--- JAU PATVIRTINTI UŽSAKYMAI (pakeitimams/atšaukimams susieti) ---\n' + prev.join('\n') : ''}`;
}
async function runAI(id) {
  const L = LETTERS.find((x) => x.id === id), k = key();
  if (!L) return;
  if (!k) { toast('Įveskite Claude API raktą skiltyje „Nustatymai ir AI“.'); return; }
  busy[id] = true; renderAll();
  const t0 = Date.now();
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: S.model, max_tokens: 8000, system: sysPrompt() + '\n\nATSAKYMO FORMA: visada atsakyk tik iškviesdamas įrankį uzsakymo_juodrastis (jokio kito teksto).', tools: [TOOL], tool_choice: { type: 'auto' }, messages: [{ role: 'user', content: userPrompt(L) }] })
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
    if (!inp || !inp.tipas) throw new Error('AI negrąžino struktūrizuoto atsakymo.');
    S.res[id] = Object.assign(inp, { _model: S.model, _ms: Date.now() - t0, _usage: j.usage, _at: new Date().toISOString() });
    S.aiLog.unshift({ id, ms: Date.now() - t0, in: j.usage && j.usage.input_tokens, out: j.usage && j.usage.output_tokens, model: S.model });
    S.aiLog = S.aiLog.slice(0, 60);
    initEdit(id, true);
  } catch (e) {
    S.res[id] = Object.assign(S.res[id] || {}, { _err: String(e.message || e) });
  }
  busy[id] = false; save(); renderAll();
}
function fromAI(u, L) {
  return {
    action: u.veiksmas || 'naujas', date: u.data || '', time: u.laikas || '', object: u.objektas || '', address: u.adresas || '', coords: u.koordinates || '',
    asked: u.marke_kaip_prase || '', props: normProps(u.savybes && u.savybes.length ? u.savybes : [u.marke_kaip_prase || '']), slump: u.slankumas || '', dmax: u.dmax || null,
    qty: u.kiekis_m3 == null ? '' : u.kiekis_m3, pump: { need: !!u.siurblys_reikia, len: u.siurblio_ilgis_m || (u.siurblys_reikia ? 28 : null) },
    mode: u.pristatymas || 'betonvezis', interval: u.intervalas_min || '', additives: u.priedai || '', plant: u.mazgas || 'S', travel: u.kelione_min || 40,
    notes: u.pastabos || '', ref: u.nuoroda || '', recipeId: null, pick: null, client: L.company
  };
}
function initEdit(id, fromRes) {
  const L = LETTERS.find((x) => x.id === id), R = S.res[id];
  const prev = S.ed[id] || {};
  const e = { orders: [], reply: null, replyBase: null, subj: null, rc: prev.rc || null };
  if (fromRes && R && R.uzsakymai) e.orders = R.uzsakymai.map((u) => fromAI(u, L));
  e.orders.forEach((o) => autoRecipe(o));
  S.ed[id] = e;
}
function autoRecipe(o) { if (o.action === 'atsaukti') return; const ro = recipeOptions(o); o.recipeId = ro.fit.length ? ro.fit[0].r.id : null; }

/* ---------- atsakymas ---------- */
function sig(L) {
  const j = /justina/.test(L.box || '');
  return 'Pagarbiai\n' + (j ? 'Justina Kavaliauskaitė' : 'Alina Veber') + '\nVadybininkė · UAB „C3 Betonas“\nuzsakymai@c3betonas.lt';
}
function recipeById(id) { return RECIPES.find((r) => r.id === Number(id)); }
function orderLine(o, cap) {
  const r = recipeById(o.recipeId), ch = cap && cap.opts[o.pick == null ? cap.def : o.pick];
  const t = ch ? fmt(ch.Sm) : (o.time || '[laikas]');
  const what = r ? (r.cls + (r.props.slice(1).length ? ' ' + r.props.slice(1).join(' ') : '') + (r.slump ? ' ' + r.slump : '')) : (o.asked || '[markė]');
  const lines = [];
  lines.push('Data: ' + (o.date || '[data]') + (o.date ? ' (' + wd(o.date) + ')' : '') + ', ' + (o.mode === 'savivartis' ? 'atsiėmimas nuo ' : 'pristatymo pradžia ') + t);
  lines.push((o.mode === 'savivartis' ? 'Mazgas: ' + PLANTS[o.plant].name + ' (' + PLANTS[o.plant].area + ')' : 'Objektas: ' + ([o.object, o.address].filter((x) => x && !/^nenurodyt/i.test(x)).join(', ') || '[objektas]')));
  lines.push('Betonas: ' + what + ', ' + (o.qty ? String(o.qty).replace('.', ',') : '[kiekis]') + ' m³' + (o.additives ? ' · ' + o.additives : ''));
  if (o.mode !== 'savivartis') lines.push('Siurblys: ' + (o.pump && o.pump.need ? (ch && ch.pumpId ? ch.pumpId : (o.pump.len ? o.pump.len + ' m' : 'reikia')) : (o.mode === 'kriause' ? 'nereikia, pylimas iš kriaušės' : 'nereikia')));
  return { text: lines.join('\n'), changed: ch && o.time && hm(o.time) != null && ch.Sm !== hm(o.time) ? { asked: o.time, got: t, why: (cap.opts[0].why || []).join(', ') } : null };
}
function genReply(id) {
  const L = LETTERS.find((x) => x.id === id), R = S.res[id], E = S.ed[id];
  if (!R || !E) return '';
  const hello = 'Laba diena,\n\n';
  if (R.tipas === 'ne_uzsakymas') return R.atsakymas_ne_uzsakymui ? hello + R.atsakymas_ne_uzsakymui + '\n\n' + sig(L) : '';
  const act = E.orders.filter((o) => o.action !== 'atsaukti'), canc = E.orders.filter((o) => o.action === 'atsaukti');
  let body = '';
  if (canc.length && !act.length) {
    body = 'patvirtiname, kad ' + (canc.length > 1 ? 'šie užsakymai atšaukti' : 'užsakymas atšauktas') + ':\n\n' + canc.map((o) => '– ' + [o.date, o.time, o.object || o.address, o.qty ? o.qty + ' m³' : '', o.ref].filter(Boolean).join(' · ')).join('\n') + '\n\nNaują betonavimo datą galite nurodyti atsakydami į šį laišką.';
  } else if (R.tipas === 'klausimas' && R.klausimas_klientui) {
    body = 'dėkojame už užsakymą.\n\n' + R.klausimas_klientui + '\n\nGavę atsakymą užsakymą įrašysime iš karto ir atsiųsime patvirtinimą.';
  } else {
    const parts = act.map((o, i) => { const cap = capOptions(o, id + ':' + E.orders.indexOf(o)); return orderLine(o, cap); });
    body = (R.tipas === 'pakeitimas' ? 'pagal Jūsų prašymą pakeitėme užsakymą' + (act.length > 1 ? 'us' : '') + ':\n\n' : 'patvirtiname Jūsų užsakym' + (act.length > 1 ? 'us' : 'ą') + ':\n\n') + parts.map((p) => p.text).join('\n\n');
    const ch = parts.filter((p) => p.changed);
    if (ch.length) body += '\n\n' + ch.map((p) => 'Jūsų prašytu laiku (' + p.changed.asked + ') ' + (p.changed.why || 'pristatyti negalime') + ', todėl siūlome pradžią ' + p.changed.got + '.').join('\n') + ' Jei šis laikas netinka, praneškite – pasiūlysime kitą.';
    if (R.klausimas_klientui) body += '\n\n' + R.klausimas_klientui;
    if (R.papildomas_tekstas) body += '\n\n' + R.papildomas_tekstas;
    if (act.some((o) => o.mode !== 'savivartis')) body += '\n\nTikslų betonvežių atvykimo grafiką pranešime dieną prieš pristatymą.';
  }
  return hello + body + '\n\n' + sig(L);
}

/* ---------- būsenos ---------- */
function status(id) {
  if (S.appr[id]) return { k: 'ok', lab: 'PATVIRTINTA' };
  if (S.rej[id]) return { k: 'bad', lab: 'ATMESTA' };
  if (busy[id]) return { k: 'wait', lab: 'BP SKAITO…' };
  if (S.res[id] && S.res[id]._err) return { k: 'bad', lab: 'AI KLAIDA' };
  if (S.res[id] && S.res[id].tipas) return { k: 'wait', lab: 'LAUKIA JŪSŲ' };
  return { k: '', lab: 'NEANALIZUOTA' };
}

/* ---------- vaizdai ---------- */
function renderAll() { renderNav(); if (S.view === 'letters') renderLetters(); else if (S.view === 'load') renderLoad(); else if (S.view === 'recipes') renderRecipes(); else renderSettings(); }
function renderNav() {
  $$('.nvl').forEach((b) => b.setAttribute('aria-current', b.dataset.view === S.view ? 'page' : 'false'));
  $$('.view').forEach((v) => { v.hidden = v.id !== 'view-' + S.view; });
  const pending = LETTERS.filter((L) => !S.appr[L.id] && !S.rej[L.id]).length;
  $('#nvPending').textContent = pending;
  $('#nvApproved').textContent = Object.values(S.appr).reduce((a, x) => a + (x.orders || []).length, 0);
  const on = !!key(); $('#nvAi').className = 'nv-dot' + (on ? ' on' : ''); $('#nvAi').title = on ? 'AI prijungtas' : 'AI neprijungtas';
  $('#aiState').textContent = on ? 'AI: ' + (MODELS.find((m) => m[0] === S.model) || [S.model, S.model])[1].replace(/ \(.*\)/, '') : 'AI: neprijungtas';
  const T = { letters: ['Užsakymai · Priėmimas', 'Gauti laiškai ir tvirtinimas'], load: ['Planavimas · Modeliavimas', 'Dienos apkrova'], recipes: ['Duomenys · BetonPro', 'Receptų duomenų bazė'], settings: ['Testas', 'Nustatymai ir AI'] }[S.view];
  $('#crumb').textContent = T[0]; $('#pageTitle').textContent = T[1];
}
function filtered() {
  return LETTERS.filter((L) => {
    const st = status(L.id).k, R = S.res[L.id];
    if (S.filter === 'todo') return !S.appr[L.id] && !S.rej[L.id];
    if (S.filter === 'orders') return R && R.tipas && R.tipas !== 'ne_uzsakymas';
    if (S.filter === 'done') return st === 'ok';
    if (S.filter === 'none') return !R || !R.tipas;
    return true;
  });
}
function renderLetters() {
  const n = LETTERS.length, an = LETTERS.filter((L) => S.res[L.id] && S.res[L.id].tipas).length, ap = Object.keys(S.appr).length, rj = Object.keys(S.rej).length;
  $('#strip').innerHTML = [[n, 'Laiškų teste (30 paskutinių)'], [an, 'Perskaitė ' + BP + ' (AI)'], [n - ap - rj, 'Laukia jūsų'], [ap, 'Patvirtinta · ' + Object.values(S.appr).reduce((a, x) => a + (x.orders || []).length, 0) + ' užs.']].map((x, i) => `<div><span class="n">${x[0]}</span><span class="l">${String(i + 1).padStart(2, '0')} · ${x[1]}</span></div>`).join('');
  const F = [['all', 'Visi'], ['todo', 'Laukia'], ['none', 'Neanalizuoti'], ['orders', 'Užsakymai'], ['done', 'Patvirtinti']];
  $('#filters').innerHTML = F.map(([k, l]) => `<button type="button" class="flt" data-f="${k}" aria-pressed="${S.filter === k}">${l}</button>`).join('') +
    `<button type="button" class="flt" id="runAll" ${key() ? '' : 'disabled'} title="Perskaityti visus neanalizuotus laiškus su AI">${BP} Analizuoti visus</button>`;
  const list = filtered();
  if (!S.sel || !LETTERS.find((L) => L.id === S.sel)) S.sel = LETTERS[0] && LETTERS[0].id;
  $('#list').innerHTML = list.map((L) => {
    const R = S.res[L.id], st = status(L.id), ty = R && R.tipas ? TYPES[R.tipas] : null;
    const tag = !ty ? '<span class="tag muted"><i style="border:1.5px solid #B4B9BF"></i>neanalizuota</span>' : R.tipas === 'naujas' ? '<span class="tag tag-new">+ NAUJAS UŽSAKYMAS</span>' : `<span class="tag"><i style="${ty.sq}"></i>${ty.lab}</span>`;
    return `<li><button type="button" class="li" data-id="${L.id}" aria-current="${S.sel === L.id}">
      <span class="li-top"><b>${esc(L.company)}</b><span class="li-time mono">${L.received.slice(5, 16).replace('T', ' ')}</span></span>
      <span class="li-top">${tag}<span style="flex:1"></span><span class="st ${st.k ? 'st-' + st.k : ''}">${st.lab}</span></span>
      ${R && R.santrauka ? `<span class="li-gist mono">→ ${esc(R.santrauka)}</span>` : ''}
      <span class="li-snip">„${esc((L.subject || '') + ' – ' + L.body.replace(/\s+/g, ' ').slice(0, 160))}“</span>
    </button></li>`;
  }).join('') || '<li class="empty">Nėra laiškų pagal filtrą</li>';
  renderDetail(); renderSide();
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
function renderDetail() {
  const L = LETTERS.find((x) => x.id === S.sel), el = $('#detail');
  if (!L) { el.innerHTML = '<div class="card empty">Pasirinkite laišką</div>'; return; }
  const R = S.res[L.id], E = S.ed[L.id], done = !!S.appr[L.id];
  const notes = S.notes[L.id] || [];
  let h = `<article class="card"><div class="card-h"><span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span class="eb muted">${esc(L.box)} · ${L.received.replace('T', ' ')} · ${esc(L.channel)}</span><b class="ar" style="font-size:20px">${esc(L.company)}</b><span style="color:#4A4F55">${esc(L.subject)}</span></span>
    <span class="contacts"><span class="chip"><b>${esc(L.contact.name)}</b>${L.contact.role ? ' · ' + esc(L.contact.role) : ''}</span>${L.contact.tel ? `<span class="chip mono">${esc(L.contact.tel)}</span>` : ''}${L.contact.mail ? `<span class="chip mono">${esc(L.contact.mail)}</span>` : ''}</span></div>
    <div class="card-b"><div class="msg">${esc(L.body)}</div>
    ${(L.attachments || []).map((a) => `<details class="att" ${R ? '' : 'open'}><summary>📎 ${esc(a.name)}</summary><pre>${esc(a.text)}</pre></details>`).join('')}
    <div style="display:flex;flex-direction:column;gap:8px;padding-top:12px;border-top:1px solid #E6E8EB">
      <span style="display:flex;flex-direction:column;gap:2px"><label for="noteTa" class="eb" style="color:#15171A;font-weight:600">Papildoma informacija</label><span class="muted" style="font-size:12.5px">Ko nėra laiške: ką klientas sakė telefonu, vadybos pastabos. ${BP} perskaitys iš naujo.</span></span>
      ${notes.map((n, i) => `<div class="warn"><b class="badge">P${i + 1}</b> ${esc(n)}</div>`).join('')}
      <textarea id="noteTa" rows="2" placeholder="pvz.: skambino – siurblio reikia 36 m, pradžia 9:00" ${done ? 'disabled' : ''}></textarea>
      <div style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-dark" id="noteSend" ${done ? 'disabled' : ''}>Pateikti ${BP}</button></div>
    </div></div></article>`;
  if (busy[L.id]) h += `<div class="ai-band"><span class="spin"></span><span class="sum">${BP} skaito laišką ir priedus…</span></div>`;
  else if (!R || (!R.tipas && !R._err)) h += `<div class="card"><div class="card-b"><span>${BP} šio laiško dar neskaitė.</span><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-dark" id="runOne" ${key() ? '' : 'disabled'}>${BP} Analizuoti laišką</button><button type="button" class="btn" id="manual">Pildyti ranka</button></div>${key() ? '' : '<span class="warn">AI neprijungtas – įveskite API raktą skiltyje „Nustatymai ir AI“. Be AI galite pildyti juodraštį ranka.</span>'}</div></div>`;
  else if (R._err && !R.tipas) h += `<div class="err">AI klaida: ${esc(R._err)} <button type="button" class="btn btn-sm" id="runOne">Bandyti dar kartą</button></div>`;
  if (R && R.tipas) {
    const ty = TYPES[R.tipas] || TYPES.naujas;
    h += `<div class="ai-band">${BP}<span class="tag" style="color:#fff"><i style="${ty.sq}"></i>${ty.lab}</span><span class="sum">${esc(R.santrauka)}</span><span class="conf">TIKRUMAS <i><b style="width:${R.tikrumas || 0}%"></b></i>${R.tikrumas || 0} %</span>${R._model ? `<span class="mono" style="font-size:11px;color:#B4B9BF">${esc(R._model)} · ${(R._ms / 1000).toFixed(1)} s</span>` : ''}</div>`;
    if (R._err) h += `<div class="err">Paskutinis bandymas nepavyko: ${esc(R._err)}</div>`;
    h += `<div class="note">${esc(R.paaiskinimas || '')}${(R.truksta || []).length ? `<br><b>Trūksta:</b> ${esc(R.truksta.join('; '))}` : ''}</div>`;
  }
  if (E) {
    if (!E.orders.length && R && R.tipas !== 'ne_uzsakymas') h += `<div class="warn">Užsakymų nerasta.</div>`;
    E.orders.forEach((o, i) => { h += orderHTML(L, o, i, done); });
    if (!done) h += `<div><button type="button" class="btn btn-ghost" id="addOrder">+ Pridėti užsakymą ranka</button></div>`;
  }
  el.innerHTML = h;
}
function orderHTML(L, o, i, done) {
  const oid = L.id + ':' + i, cancel = o.action === 'atsaukti';
  const actLab = { naujas: 'NAUJAS', keisti: 'PAKEITIMAS', atsaukti: 'ATŠAUKIMAS' }[o.action] || 'NAUJAS';
  let h = `<section class="order" data-i="${i}"><div class="order-h"><b class="badge">${i + 1}</b><span class="st ${cancel ? 'st-bad' : ''}">${actLab}</span><b>${esc(o.date || '—')} ${o.date ? wd(o.date) : ''}</b><span class="muted">${esc(o.object || o.address || '')}</span><span style="flex:1"></span>${done ? '' : `<button type="button" class="btn btn-sm btn-ghost" data-del="${i}">Pašalinti</button>`}</div>`;
  h += `<fieldset style="border:0;margin:0;padding:0" ${done ? 'disabled' : ''}><div class="grid-f">` +
    fieldHTML('Veiksmas', 'action', o.action, { select: [['naujas', 'Naujas'], ['keisti', 'Pakeitimas'], ['atsaukti', 'Atšaukimas']] }) +
    fieldHTML('Data', 'date', o.date, { type: 'date', miss: !o.date }) +
    fieldHTML('Laikas (prašo)', 'time', o.time, { type: 'time', miss: !o.time && !cancel, src: !o.time ? 'nenurodyta – modelis ims 08:00' : '' }) +
    fieldHTML('Objektas', 'object', o.object) +
    fieldHTML('Adresas / vieta', 'address', o.address, { src: o.coords ? 'koord.: ' + o.coords : '' }) +
    fieldHTML('Markė (kaip prašo)', 'asked', o.asked, { miss: !o.asked && !cancel, src: 'savybės: ' + (normProps(o.props && o.props.length ? o.props : [o.asked]).join(' ') || '—') + (o.slump ? ' · ' + o.slump : '') }) +
    fieldHTML('Kiekis, m³', 'qty', o.qty, { type: 'number', step: '0.1', miss: !(Number(o.qty) > 0) && !cancel }) +
    fieldHTML('Pristatymas', 'mode', o.mode, { select: [['betonvezis', 'Betonvežiu'], ['kriause', 'Betonvežiu, iš kriaušės'], ['savivartis', 'Pasiima pats']] }) +
    fieldHTML('Siurblys, m', 'pumpLen', o.pump && o.pump.need ? (o.pump.len || '') : '', { type: 'number', ph: 'nereikia', src: 'tuščia – be siurblio' }) +
    fieldHTML('Mazgas', 'plant', o.plant, { select: Object.entries(PLANTS).map(([k, p]) => [k, p.name]), src: 'vykdoma savo mazge' }) +
    fieldHTML('Kelionė į objektą, min', 'travel', o.travel, { type: 'number' }) +
    fieldHTML('Intervalas, min', 'interval', o.interval, { type: 'number', ph: String(interval(o)) }) +
    fieldHTML('Priedai', 'additives', o.additives) +
    `</div></fieldset>`;
  if (o.notes || o.ref) h += `<div style="padding:0 14px 10px;font-size:12.5px;color:#4A4F55">${o.ref ? '<b>Susieta:</b> ' + esc(o.ref) + '. ' : ''}${esc(o.notes || '')}</div>`;
  if (!cancel) {
    const ro = recipeOptions(o), cur = recipeById(o.recipeId);
    h += `<div class="rcp"><span class="eb muted">Receptas · ${PLANTS[o.plant].name} · klientas prašo: ${ro.req.map((x) => `<span class="pchip">${esc(x)}</span>`).join(' ') || '—'}${ro.wantS ? ' <span class="pchip">' + ro.wantS + '</span>' : ''}</span>`;
    if (!ro.req.length) h += `<div class="warn">Nenurodyta markė – receptas neparinktas.</div>`;
    else if (!ro.fit.length) h += `<div class="err">${PLANTS[o.plant].name} mazge nėra recepto tiksliai su šiomis savybėmis. ${ro.elsewhere.length ? 'Yra kituose mazguose: ' + ro.elsewhere.slice(0, 4).map((r) => r.code + ' (' + r.plantName + ')').join(', ') + '.' : ''} Receptai su papildomomis savybėmis rodomi žemiau, bet jų siūlyti negalima.</div>`;
    ro.fit.slice(0, 5).forEach((x) => { h += rcpRow(x, o, done, true); });
    if (ro.fit.length > 5) h += `<span class="muted" style="font-size:12px">+ dar ${ro.fit.length - 5} tinkami receptai (žr. skiltį „Receptai“).</span>`;
    if (ro.extra.length) h += `<details><summary class="muted" style="font-size:12.5px;cursor:pointer">Turi daugiau savybių nei prašė klientas (${ro.extra.length}) – nesiūloma</summary><div style="display:flex;flex-direction:column;gap:4px;margin-top:6px">${ro.extra.map((x) => rcpRow(x, o, true, false)).join('')}</div></details>`;
    h += `</div>`;
    const cap = capOptions(o, oid);
    if (cap) {
      const pick = o.pick == null ? cap.def : o.pick, ch = cap.opts[pick] || cap.opts[0];
      h += `<div class="cap"><span class="eb muted">Ar galime priimti · ${PLANTS[o.plant].name} · ${o.date} ${S.bg && isWork(o.date) ? '· su tipinės dienos fonu' : ''}</span>
        <div class="${cap.opts[0].ok ? 'okbox' : 'warn'}">${cap.opts[0].ok ? 'Prašomu laiku ' + fmt(cap.S0) + ' galima priimti.' : 'Prašomu laiku ' + fmt(cap.S0) + ' negalima: ' + esc(cap.opts[0].why.join(', ')) + '.'} ${ch.s.self ? 'Klientas pasiima pats – betonvežiai neužimami.' : `${ch.s.n} ${nr(ch.s.n)} po ≤7 m³ · intervalas ${ch.s.U} min · kelionė ${ch.s.T} min · krovimas ${fmt(ch.s.ls)}–${fmt(ch.s.trips[ch.s.n - 1][4] + LOAD)}`}${ch.pumpId ? ' · siurblys ' + ch.pumpId : ''}</div>
        <div class="opts" role="group" aria-label="Laiko pasirinkimai">${cap.opts.map((x, k) => `<button type="button" class="opt" data-pick="${i}:${k}" aria-pressed="${k === pick}" ${done ? 'disabled' : ''}><b>${fmt(x.Sm)}</b><span>${x.kind === 'req' ? 'kaip prašo' : x.kind === 'hire' ? '+' + x.hire + ' samdyt. betonv.' : 'laisvas langas'}${k === cap.def && x.kind !== 'req' ? ' · ' + BP + ' siūlo' : ''}</span><span style="color:${x.ok ? '#17704A' : '#B23A26'}">${x.ok ? 'galima' : esc(x.why[0] || '')}</span></button>`).join('')}</div>
        ${ch.s.self ? '' : `<div class="row2"><span class="rl">Betonvežiai<br>riba ${ch.lim}</span><div>${chartHTML(ch.base, ch.nt, o.plant, ch.lim, 10)}</div></div>`}
      </div>`;
    } else h += `<div class="cap"><span class="warn">Talpai patikrinti reikia datos, mazgo ir kiekio.</span></div>`;
  }
  return h + '</section>';
}
function rcpRow(x, o, disabled, selectable) {
  const r = x.r, on = r.id === Number(o.recipeId);
  const pr = r.props.map((p) => `<span class="pchip${x.extra.includes(p) ? ' extra' : ''}">${esc(p)}</span>`).join(' ');
  return `<button type="button" class="rcp-row" data-rcp="${r.id}" aria-pressed="${on}" ${disabled && !on ? 'disabled' : ''}>
    <span class="rcp-l1"><b>${esc(r.code)}</b>${pr}${r.slump ? `<span class="pchip">${r.slump}</span>` : ''}${r.dmax ? `<span class="pchip">Dmax${r.dmax}</span>` : ''}<span class="nm">${esc(r.cement || '')}</span>${on ? '<span class="st st-ok" style="flex:none">PARINKTA</span>' : ''}</span>
    <span class="rcp-l2"><span>kainoraštis <b>${r.price.toFixed(2).replace('.', ',')} €/m³</b></span><span>savikaina <b>${r.cost.toFixed(2).replace('.', ',')} €/m³</b></span><span>${!selectable && x.extra.length ? '<span style="color:#8A6A00">neprašyta: ' + esc(x.extra.join(', ')) + '</span>' : 'marža ' + (r.price - r.cost).toFixed(2).replace('.', ',') + ' €/m³'}</span></span></button>`;
}
function renderSide() {
  const L = LETTERS.find((x) => x.id === S.sel), el = $('#side');
  if (!L) { el.innerHTML = ''; return; }
  const R = S.res[L.id], E = S.ed[L.id], done = S.appr[L.id];
  if (!E) { el.innerHTML = `<div class="card"><div class="card-b muted">Atsakymas klientui atsiras, kai ${BP} perskaitys laišką arba užpildysite juodraštį ranka.</div></div>`; return; }
  const gen = genReply(L.id);
  const edited = E.reply != null, txt = edited ? E.reply : gen, stale = edited && E.replyBase !== gen && !done;
  const subj = E.subj != null ? E.subj : 'Re: ' + String(L.subject || '').replace(/^(re|ats\.?|fwd?):\s*/i, '');
  const rc = E.rc || { tel: false, mail: L.channel === 'email' };
  const noReply = R && R.tipas === 'ne_uzsakymas' && !gen && !edited;
  // problemos
  const probs = [];
  E.orders.forEach((o, i) => {
    if (o.action === 'atsaukti') return;
    if (!o.date) probs.push((i + 1) + ': nėra datos');
    if (!(Number(o.qty) > 0)) probs.push((i + 1) + ': nėra kiekio');
    if (!o.recipeId) probs.push((i + 1) + ': neparinktas receptas');
    const cap = capOptions(o, L.id + ':' + i); if (cap) { const ch = cap.opts[o.pick == null ? cap.def : o.pick]; if (!ch.ok) probs.push((i + 1) + ': ' + ch.why.join(', ')); }
  });
  const isQ = R && R.tipas === 'klausimas';
  let h = `<div class="card"><div class="card-h"><span class="eb muted">Atsakymas klientui</span>${edited ? '<span class="badge" style="background:#FBEFB8">REDAGUOTA</span>' : `<span class="muted" style="font-size:12px">${BP} paruošė</span>`}</div>`;
  if (noReply) h += `<div class="card-b"><div class="note">Atsakymas nesiunčiamas – ${BP} mano, kad atsakyti nereikia. Galite parašyti patys.</div><button type="button" class="btn btn-sm" id="writeOwn" ${done ? 'disabled' : ''}>Rašyti atsakymą</button></div>`;
  else {
    h += `<div class="card-b" style="gap:8px"><div class="rc-list"><span class="eb muted">Kam</span><div class="rc-item"><b>${esc(L.contact.name)}</b><span class="muted">${esc(L.company)}</span></div>
      <div class="rc-item">${L.contact.tel ? `<label><input type="checkbox" id="rcTel" ${rc.tel ? 'checked' : ''} ${done ? 'disabled' : ''}><span class="badge">SMS</span><span class="mono">${esc(L.contact.tel)}</span></label>` : ''}${L.contact.mail ? `<label><input type="checkbox" id="rcMail" ${rc.mail ? 'checked' : ''} ${done ? 'disabled' : ''}><span class="badge">PAŠTU</span><span class="mono">${esc(L.contact.mail)}</span></label>` : ''}</div></div>
      ${rc.mail ? `<div class="fld"><label for="subj">Tema</label><input id="subj" value="${esc(subj)}" ${done ? 'disabled' : ''}></div>` : ''}
      ${stale ? `<div class="warn">Juodraštis pasikeitė po jūsų redagavimo. <button type="button" class="btn btn-sm" id="replyReset">Atnaujinti tekstą</button></div>` : ''}
      <textarea id="replyTa" rows="18" aria-label="Atsakymo klientui tekstas" style="min-height:420px" ${done ? 'readonly' : ''}>${esc(txt)}</textarea>
      ${edited && !done ? `<div style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-sm btn-ghost" id="replyReset2">Grąžinti ${BP} tekstą</button></div>` : ''}</div>`;
  }
  h += `</div>`;
  if (done) {
    h += `<div class="okbox">Patvirtinta ${esc(done.at.slice(11, 16))}. ${done.orders.length ? 'Į dienos planą įtraukta: ' + done.orders.map((o) => o.date + ' ' + fmt(o.S) + ' ' + PLANTS[o.plant].name + ' ' + o.qty + ' m³').join('; ') + '.' : 'Užsakymų į planą neįtraukta.'} ${done.cancelled ? done.cancelled : ''} (Testas – laiškas klientui nesiunčiamas.)</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="undo">Atšaukti patvirtinimą</button><button type="button" class="btn btn-dark" data-goto="load" data-date="${esc((done.orders[0] || {}).date || '')}">Žiūrėti dienos apkrovą →</button></div>`;
  } else if (S.rej[L.id]) {
    h += `<div class="note">Laiškas pažymėtas kaip ne užsakymas / atmestas.</div><button type="button" class="btn" id="unrej">Grąžinti į eilę</button>`;
  } else {
    if (probs.length) h += `<div class="warn"><b>Prieš tvirtinant:</b><br>${probs.map(esc).join('<br>')}</div>`;
    const lab = isQ ? 'Siųsti klausimą klientui' : (R && R.tipas === 'ne_uzsakymas') ? 'Pažymėti kaip apdorotą' : E.orders.every((o) => o.action === 'atsaukti') && E.orders.length ? 'Patvirtinti atšaukimą' : 'Patvirtinti ir sumodeliuoti dieną';
    const block = !isQ && R && R.tipas !== 'ne_uzsakymas' && probs.length > 0;
    h += `<button type="button" class="btn btn-go" id="approve" ${block ? 'disabled' : ''}>${lab}<span aria-hidden="true">→</span></button>`;
    if (block) h += `<label style="display:flex;gap:8px;align-items:center;font-size:12.5px"><input type="checkbox" id="force"> Tvirtinti nepaisant pastabų (testui)</label>`;
    h += `<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-ghost" id="reject" style="flex:1">Ne užsakymas / atmesti</button>${R && R.tipas ? `<button type="button" class="btn btn-ghost" id="rerun" ${key() ? '' : 'disabled'} style="flex:1">${BP} Skaityti iš naujo</button>` : ''}</div>`;
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
    <span style="flex:1"></span><label style="display:flex;gap:8px;align-items:center;font-size:13px"><input type="checkbox" id="bgT" ${S.bg ? 'checked' : ''}> Tipinės dienos fonas (tikras BetonPro 2026-11-03 planas, 95 reisai)</label></div></div>`;
  h += `<div class="strip">${[[orders.length, 'Patvirtinta užsakymų ' + d], [m3(orders.reduce((a, o) => a + Number(o.qty || 0), 0)), 'Iš laiškų'], [m3(trips.reduce((a, t) => a + t[7], 0)), 'Viso su fonu'], [Object.keys(PLANTS).filter((p) => Math.max.apply(null, A.tm[p]) > S.fleet[p]).length, 'Mazgai, kuriems trūksta betonvežių']].map((x, i) => `<div><span class="n">${x[0]}</span><span class="l">${String(i + 1).padStart(2, '0')} · ${x[1]}</span></div>`).join('')}</div>`;
  h += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(380px,1fr));gap:12px">`;
  Object.entries(PLANTS).forEach(([p, P]) => {
    const peak = Math.max.apply(null, A.tm[p]), vol = trips.filter((t) => t[0] === p).reduce((a, t) => a + t[7], 0), mine = orders.filter((o) => o.plant === p);
    const own = agg(trips.filter((t) => t[0] === p && String(t[1]).includes(':')));
    const bars = [], mxl = Math.max(PCAP + 5, ...A.pl[p]);
    for (let b = 0; b < 24; b++) bars.push(`<div class="bar${A.pl[p][b] > PCAP ? ' over' : own.pl[p][b] ? ' new' : ''}" style="height:${(A.pl[p][b] / mxl * 100).toFixed(1)}%" title="${fmt(b * 30)}: ${m3(A.pl[p][b])}"></div>`);
    h += `<div class="plant"><div class="plant-h"><b>${P.name}</b><span class="muted">${P.area}</span><span style="flex:1"></span><span class="${peak > S.fleet[p] ? 'st st-bad' : 'st st-ok'}">piko metu ${peak}/${S.fleet[p]} betonv.</span></div>
      <span class="mono muted" style="font-size:11.5px">${m3(vol)} · ${trips.filter((t) => t[0] === p).length} reisų · iš laiškų ${mine.length} užs.</span>
      <div class="row2"><span class="rl">Betonvežiai</span><div>${chartHTML(agg(trips.filter((t) => !String(t[1]).includes(':'))), agg(trips.filter((t) => String(t[1]).includes(':'))), p, S.fleet[p], 10)}</div></div>
      <div class="row2"><span class="rl">Krovimas m³/30 min<br>riba ${PCAP}</span><div><div class="chart" style="height:60px">${bars.join('')}<span class="lim" style="bottom:${(PCAP / mxl * 100).toFixed(1)}%"></span></div></div></div>
      ${mine.length ? `<table class="tb"><thead><tr><th>Laikas</th><th>Klientas</th><th>m³</th><th>Receptas</th><th>Siurblys</th></tr></thead><tbody>${mine.sort((a, b) => a.S - b.S).map((o) => `<tr><td class="mono">${fmt(o.S)}</td><td>${esc(o.client)}<br><span class="muted">${esc(o.object || o.address || '')}</span></td><td class="mono">${String(o.qty).replace('.', ',')}</td><td class="mono">${esc(o.recipeCode || '')}</td><td class="mono">${esc(o.pumpId || (o.mode === 'savivartis' ? 'pasiima' : '—'))}</td></tr>`).join('')}</tbody></table>` : ''}
    </div>`;
  });
  h += `</div>`;
  h += `<div class="card"><div class="card-h"><span class="eb muted">Siurbliai · ${d}</span></div><div class="card-b">${PUMPS.map((P) => { const bl = pb.filter((b) => b.pump === P.id); return `<div class="row2"><span class="rl">${P.id}</span><div style="position:relative;height:22px;background:#F2F3F5">${bl.map((b) => `<span title="${esc(b.who)} ${fmt(b.a)}–${fmt(b.e)}" style="position:absolute;top:2px;bottom:2px;left:${Math.max(0, b.a / DAY * 100)}%;width:${Math.max(0.5, (Math.min(DAY, b.e) - Math.max(0, b.a)) / DAY * 100)}%;background:${String(b.who).startsWith('fonas') ? '#B4B9BF' : '#F5C518'};box-shadow:inset 0 0 0 1px #15171A"></span>`).join('')}</div></div>`; }).join('')}<div class="axis" style="margin-left:98px"><span>06</span><span>08</span><span>10</span><span>12</span><span>14</span><span>16</span><span>18</span></div>
    <div class="legend"><span><i style="background:#C7CBD0"></i>fonas (11-03 planas)</span><span><i style="background:#F5C518;box-shadow:inset 0 0 0 1px #15171A"></i>patvirtinta iš laiškų</span><span><i style="background:#D2452F"></i>virš ribos</span></div></div></div>`;
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
    <div class="fld"><label for="mdl">Modelis</label><select id="mdl">${MODELS.map(([v, l]) => `<option value="${v}" ${S.model === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-dark" id="saveKey">Išsaugoti raktą</button><button type="button" class="btn" id="testKey" ${k ? '' : 'disabled'}>Patikrinti ryšį</button><button type="button" class="btn btn-ghost" id="delKey" ${k ? '' : 'disabled'}>Ištrinti raktą</button></div><div id="keyMsg"></div></div></div>
    <div class="card"><div class="card-h"><span class="eb muted">Parkas ir modelio prielaidos</span></div><div class="card-b"><div class="set-grid">
    ${Object.entries(PLANTS).map(([p, P]) => `<div class="fld"><label for="fl${p}">${P.name}: savų betonvežių</label><input id="fl${p}" data-fleet="${p}" type="number" min="0" max="40" value="${S.fleet[p]}"></div>`).join('')}</div>
    <div class="note">Krovimas – ${LOAD} min. reisui, mazgo riba ${PCAP} m³ per 30 min. (~70 m³/val.), reisas ≤ ${TRIP} m³. Intervalas pagal nutylėjimą: su siurbliu 15 min., be siurblio 20 min. Kelionės laiką siūlo ${BP}, jį galima pakeisti. Diena 06:00–18:00. Fonas – tikras 2026-11-03 BetonPro vežimų planas, taikomas visoms darbo dienoms. Parko skaičiai – prielaidos, patikslinkite.</div></div></div>
    <div class="card"><div class="card-h"><span class="eb muted">AI užklausos šioje naršyklėje</span></div><div class="card-b"><span class="mono" style="font-size:12.5px">${log.length} užklausų · įvesties ${tin.toLocaleString('lt')} · išvesties ${tout.toLocaleString('lt')} žetonų</span>
    ${log.length ? `<table class="tb"><thead><tr><th>Laiškas</th><th>Modelis</th><th>Laikas</th><th>Žetonai</th></tr></thead><tbody>${log.slice(0, 15).map((x) => `<tr><td>${x.id}</td><td class="mono">${esc(x.model)}</td><td class="mono">${(x.ms / 1000).toFixed(1)} s</td><td class="mono">${x.in || 0} / ${x.out || 0}</td></tr>`).join('')}</tbody></table>` : ''}</div></div>`;
}

/* ---------- veiksmai ---------- */
function curOrder(t) { const sec = t.closest('section.order'); if (!sec) return null; const E = S.ed[S.sel]; return E && E.orders[Number(sec.dataset.i)]; }
function approve() {
  const L = LETTERS.find((x) => x.id === S.sel), E = S.ed[L.id], R = S.res[L.id] || {};
  const out = []; let cancelled = '';
  E.orders.forEach((o, i) => {
    if (o.action === 'atsaukti') {
      const hit = Object.entries(S.appr).find(([lid, a]) => lid !== L.id && a.orders.some((x) => x.client === o.client && x.date === o.date && (!o.qty || Number(x.qty) === Number(o.qty))));
      if (hit) { const [lid, a] = hit; a.orders = a.orders.filter((x) => !(x.client === o.client && x.date === o.date)); cancelled = 'Atšauktas anksčiau patvirtintas ' + o.client + ' ' + o.date + ' užsakymas – išimtas iš plano.'; }
      else cancelled = 'Atšaukimas užfiksuotas (šiame teste susieto patvirtinto užsakymo nėra).';
      return;
    }
    if (R.tipas === 'klausimas' || R.tipas === 'ne_uzsakymas') return;
    const oid = L.id + ':' + out.length, cap = capOptions(o, oid); if (!cap) return;
    const ch = cap.opts[o.pick == null ? cap.def : o.pick];
    const s = simTrips(o, o.plant, ch.Sm, oid), rc = recipeById(o.recipeId);
    out.push(Object.assign(clone(o), { S: ch.Sm, lastArr: s.last, trips: s.trips, pumpId: ch.pumpId, hire: ch.hire, recipeCode: rc ? rc.code : '', client: L.company }));
  });
  const ta = $('#replyTa');
  S.appr[L.id] = { at: new Date().toISOString(), orders: out, cancelled, reply: ta ? ta.value : '' };
  save(); toast(out.length ? 'Patvirtinta: ' + out.length + ' užs. įtraukta į dienos planą.' : 'Patvirtinta.');
  renderAll();
}
function bind() {
  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('button,a'); if (!t) return;
    if (t.classList.contains('nvl')) { S.view = t.dataset.view; save(); renderAll(); return; }
    if (t.dataset.goto) { S.view = t.dataset.goto; if (t.dataset.date) S.loadDate = t.dataset.date; save(); renderAll(); window.scrollTo(0, 0); return; }
    if (t.classList.contains('li')) { S.sel = t.dataset.id; save(); renderLetters(); if (window.innerWidth < 1100) $('#detail').scrollIntoView({ behavior: 'smooth' }); return; }
    if (t.dataset.f) { S.filter = t.dataset.f; save(); renderLetters(); return; }
    if (t.dataset.ld) { S.loadDate = t.dataset.ld; save(); renderLoad(); return; }
    if (t.id === 'runAll') { runAll(); return; }
    if (t.id === 'runOne' || t.id === 'rerun') { runAI(S.sel); return; }
    if (t.id === 'manual') { S.res[S.sel] = { tipas: 'naujas', santrauka: 'Juodraštis pildomas ranka', tikrumas: 0, uzsakymai: [], truksta: [], paaiskinimas: 'Be AI.' }; S.ed[S.sel] = { orders: [blankOrder()], reply: null }; save(); renderLetters(); return; }
    if (t.id === 'addOrder') { S.ed[S.sel].orders.push(blankOrder()); save(); renderLetters(); return; }
    if (t.dataset.del != null) { S.ed[S.sel].orders.splice(Number(t.dataset.del), 1); save(); renderLetters(); return; }
    if (t.dataset.rcp) { const o = curOrder(t); if (o) { o.recipeId = Number(t.dataset.rcp); save(); renderLetters(); } return; }
    if (t.dataset.pick) { const [i, k] = t.dataset.pick.split(':').map(Number); S.ed[S.sel].orders[i].pick = k; save(); renderLetters(); return; }
    if (t.id === 'noteSend') { const v = $('#noteTa').value.trim(); if (!v) return; (S.notes[S.sel] = S.notes[S.sel] || []).push(v); save(); if (key()) runAI(S.sel); else { toast('Pastaba išsaugota. AI neprijungtas – juodraštį koreguokite ranka.'); renderLetters(); } return; }
    if (t.id === 'replyReset' || t.id === 'replyReset2') { const E = S.ed[S.sel]; E.reply = null; E.replyBase = null; save(); renderSide(); return; }
    if (t.id === 'writeOwn') { const E = S.ed[S.sel]; E.reply = 'Laba diena,\n\n\n\n' + sig(LETTERS.find((x) => x.id === S.sel)); E.replyBase = ''; save(); renderSide(); return; }
    if (t.id === 'approve') { approve(); return; }
    if (t.id === 'undo') { delete S.appr[S.sel]; save(); renderAll(); return; }
    if (t.id === 'reject') { S.rej[S.sel] = true; save(); renderAll(); return; }
    if (t.id === 'unrej') { delete S.rej[S.sel]; save(); renderAll(); return; }
    if (t.id === 'btnReset') { if (window.confirm('Išvalyti visą testo būseną (AI rezultatus, patvirtinimus, pastabas)? API raktas liks.')) { S = DEF(); save(); renderAll(); } return; }
    if (t.id === 'saveKey') { const v = $('#apik').value.trim(); if (v && !v.startsWith('••')) { setKey(v); $('#keyMsg').innerHTML = '<div class="okbox">Raktas išsaugotas šioje naršyklėje.</div>'; renderNav(); renderSettings(); } return; }
    if (t.id === 'delKey') { setKey(''); renderNav(); renderSettings(); return; }
    if (t.id === 'testKey') { testKey(); return; }
  });
  document.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.id === 'replyTa') { const E = S.ed[S.sel]; if (E.reply == null) E.replyBase = genReply(S.sel); E.reply = t.value; save(); return; }
    if (t.id === 'subj') { S.ed[S.sel].subj = t.value; save(); return; }
    if (t.id === 'rq') { S.rq = t.value; clearTimeout(bind._q); bind._q = setTimeout(() => { renderRecipes(); const x = $('#rq'); x.focus(); x.setSelectionRange(x.value.length, x.value.length); }, 250); return; }
  });
  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.dataset.k) {
      const o = curOrder(t); if (!o) return; const k = t.dataset.k, v = t.value;
      if (k === 'pumpLen') o.pump = { need: !!v, len: v ? Number(v) : null };
      else if (k === 'qty' || k === 'travel' || k === 'interval') o[k] = v === '' ? '' : Number(v);
      else if (k === 'asked') { o.asked = v; o.props = normProps([v]); }
      else o[k] = v;
      if (['asked', 'plant', 'pumpLen', 'action'].includes(k)) autoRecipe(o);
      if (['date', 'time', 'plant', 'qty', 'pumpLen', 'mode', 'travel', 'interval'].includes(k)) o.pick = null;
      save(); renderLetters(); return;
    }
    if (t.id === 'rcTel' || t.id === 'rcMail') { const E = S.ed[S.sel], L = LETTERS.find((x) => x.id === S.sel); E.rc = E.rc || { tel: false, mail: L.channel === 'email' }; E.rc[t.id === 'rcTel' ? 'tel' : 'mail'] = t.checked; save(); renderSide(); return; }
    if (t.id === 'force') { const b = $('#approve'); if (b) b.disabled = !t.checked; return; }
    if (t.id === 'ld') { S.loadDate = t.value; save(); renderLoad(); return; }
    if (t.id === 'bgT') { S.bg = t.checked; save(); renderLoad(); return; }
    if (t.id === 'rp') { S.rp = t.value; renderRecipes(); return; }
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

async function boot() {
  S = load();
  try {
    const [a, b, c] = await Promise.all(['data/letters.json', 'data/recipes.json', 'data/baseline-2026-11-03.json'].map((u) => fetch(u).then((r) => { if (!r.ok) throw new Error(u + ': ' + r.status); return r.json(); })));
    LETTERS = a; RECIPES = b.recipes; BASE = c;
  } catch (e) { document.body.insertAdjacentHTML('afterbegin', '<div class="err">Nepavyko įkelti duomenų: ' + esc(e.message) + '</div>'); return; }
  bind(); renderAll();
}
window.__bp = { get S() { return S; }, normProps, recipeOptions, capOptions, genReply, fromAI, initEdit, approve, renderAll, setRes: (id, r) => { S.res[id] = r; initEdit(id, true); save(); renderAll(); } };
boot();
})();
