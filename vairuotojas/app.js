/* BetonPro · Vairuotojo reiso forma (SMS nuoroda) · testinė versija.
 *
 * Duomenų laukų pavadinimai sutampa su BetonPro DB (bet_<pad>_ord_trans, bet_<pad>_ord,
 * automotive_vairas, automotive_transport), kad programuotojams būtų lengva perkelti į
 * go.php?mod=transp&act=valdymas. Žr. INTEGRACIJA.md.
 *
 * Testas: ?r=<ord_trans.id> (pvz. ?r=48213). Būsena saugoma telefone (localStorage).
 */
(function () {
  'use strict';

  var CFG = window.BP_REISAS || {};
  var $main = document.getElementById('main');
  var $foot = document.getElementById('foot');

  /* ---------- Statusai (BetonPro) ---------- */
  // f – bet_<pad>_ord_trans stulpelis; src – kas įrašo. gryzo – tik kai vairuotojui priskirtas kitas reisas.
  var VISI_STATUSAI = [
    { f: 'pakrovimas',        t: 'Pasikrovimas',              k: 'Krovimas', src: 'betonpro',    i: '<path d="M12 3v10M7 9l5 5 5-5M4 17h16v4H4z"/>' },
    { f: 'isvyko',            t: 'Išvykimas iš betono mazgo', k: 'Išvyko',   src: 'betonpro',    i: '<path d="M2 7h11v9H2zM13 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>' },
    { f: 'atvyko',            t: 'Atvykimas pas klientą',     k: 'Atvyko',   src: 'vairuotojas', i: '<path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>' },
    { f: 'iskrovimo_pradzia', t: 'Iškrovimo pradžia',         k: 'Pradžia',  src: 'vairuotojas', i: '<path d="M7 5l12 7-12 7z"/>' },
    { f: 'iskrovimo_pabaiga', t: 'Iškrovimo pabaiga',         k: 'Pabaiga',  src: 'vairuotojas', i: '<path d="M6 6h12v12H6z"/>' },
    { f: 'isvyko_obj',        t: 'Išvykimas iš kliento',      k: 'Išvyko',   src: 'vairuotojas', i: '<path d="M10 4H4v16h6M14 8l4 4-4 4M18 12H9"/>' },
    { f: 'gryzo',             t: 'Grįžimas į betono mazgą',   k: 'Grįžo',    src: 'vairuotojas', i: '<path d="M3 11l9-7 9 7M5 10v10h14V10"/>' }
  ];
  var STATUSAI = VISI_STATUSAI; // nustatoma start() pagal kitą reisą

  /* ---------- Testiniai reisai ---------- */
  // Struktūra = ką serveris grąžintų pagal trumposios nuorodos žetoną (bendras_short_links.token).
  var REISAI = {
    '48213': {
      ord_trans: { id: 48213, o_id: 9311, nr: 3, kiekis: 8, product: 'C30/37 XC2 S3 Dmax16', cars: 'LKA 482', cars_id: 214,
        driver: 'Tomas Petrauskas', driver_id: 77, driver_tel: '+37061234567', transp: 'UAB „Kelio ratas“', transp_id: 12,
        distance: 17, transp_kaina: 1 },
      ord: { id: 9311, nr: 'U-2026-9311', gavejas: 'UAB „Statybų partneris“', adresas: 'Savanorių pr. 12, Kaunas',
        latitude: 54.9035, longitude: 23.9312, kontaktas: 'Darbų vadovas Mantas', tel: '+37060011111' },
      mazgas: { pavadinimas: 'Kauno betono mazgas', adresas: 'Raudondvario pl. 150, Kaunas' },
      kelione_min: 28, iki_objekto_min: 30,
      kitas_reisas: { laikas_po_min: 70, ka: 'Pakrovimas Kauno mazge', kur: '9 m³ C25/30 → Ukmergės g. 40, Jonava' }
    },
    '48219': {
      ord_trans: { id: 48219, o_id: 9318, nr: 1, kiekis: 9, product: 'C25/30 XC1 S4 Dmax16', cars: 'KNS 117', cars_id: 231,
        driver: 'Andrius Kazlauskas', driver_id: 81, driver_tel: '+37065522222', transp: 'UAB „Betono vežėjai“', transp_id: 15,
        distance: 24, transp_kaina: 1 },
      ord: { id: 9318, nr: 'U-2026-9318', gavejas: 'MB „Namų statyba“', adresas: 'Ukmergės g. 40, Jonava',
        latitude: 55.0733, longitude: 24.2797, kontaktas: 'Rimas', tel: '+37060022222' },
      mazgas: { pavadinimas: 'Kauno betono mazgas', adresas: 'Raudondvario pl. 150, Kaunas' },
      kelione_min: 35, iki_objekto_min: 40,
      kitas_reisas: null
    },
    '48224': {
      ord_trans: { id: 48224, o_id: 9322, nr: 2, kiekis: 6, product: 'C35/45 XC4 XF1 S3 Dmax16', cars: 'HPN 330', cars_id: 245,
        driver: 'Jonas Žukauskas', driver_id: 90, driver_tel: '+37067733333', transp: 'UAB „Kelio ratas“', transp_id: 12,
        distance: 11, transp_kaina: 1 },
      ord: { id: 9322, nr: 'U-2026-9322', gavejas: 'UAB „Infra statyba“', adresas: 'Ozo g. 25, Vilnius',
        latitude: 54.7104, longitude: 25.2735, kontaktas: 'Inžinierė Laura', tel: '+37060033333' },
      mazgas: { pavadinimas: 'Vilniaus betono mazgas', adresas: 'Savanorių pr. 178, Vilnius' },
      kelione_min: 22, iki_objekto_min: 25,
      kitas_reisas: { laikas_po_min: 55, ka: 'Pakrovimas Vilniaus mazge', kur: '6 m³ C35/45 → Ozo g. 25, Vilnius' }
    }
  };

  /* ---------- Pagalbinės ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hm(ts) { if (!ts) return '—'; var d = new Date(ts); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dt(ts) { var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function sqlDt(ts) { if (!ts) return null; var d = new Date(ts); return dt(ts) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function mins(a, b) { return (a && b) ? Math.round((b - a) / 60000) : null; }
  function minTxt(m) { if (m == null) return '—'; if (m < 60) return m + ' min'; return Math.floor(m / 60) + ' val. ' + pad(m % 60) + ' min'; }
  function tel(s) { return String(s || '').replace(/[^\d+]/g, ''); }
  function now() { return Date.now(); }
  function svg(p, cls) { return '<svg class="' + (cls == null ? 'ico' : cls) + '" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; }
  function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function idx(f) { for (var i = 0; i < STATUSAI.length; i++) if (STATUSAI[i].f === f) return i; return -1; }

  var params = new URLSearchParams(location.search);
  var rid = params.get('r') || (location.hash.match(/r=(\d+)/) || [])[1];

  /* A+ ir kalba */
  var aplus = !!ls('bp-aplus');
  function applyAplus() { document.documentElement.classList.toggle('aplus', aplus); document.getElementById('btn-aplus').setAttribute('aria-pressed', String(aplus)); }
  document.getElementById('btn-aplus').addEventListener('click', function () { aplus = !aplus; ls('bp-aplus', aplus); applyAplus(); });
  document.getElementById('btn-lang').addEventListener('click', function () { toast('Kitos kalbos (EN, RU, PL) bus įjungtos vėliau.'); });
  applyAplus();

  var toastT;
  function toast(msg, btn, fn, ms) {
    var el = document.getElementById('toast');
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (btn ? '<button type="button">' + esc(btn) + '</button>' : '');
    el.hidden = false;
    if (btn) el.querySelector('button').onclick = function () { el.hidden = true; fn(); };
    clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, ms || 4000);
  }
  function toastHide() { document.getElementById('toast').hidden = true; }

  /* ---------- Būsena ---------- */
  var R, S, KEY;
  function arKitas() { return !!(R && R.kitas_reisas); }

  function naujaBusena(r) {
    var t = now(), ot = r.ord_trans;
    return {
      v: 2, client_uuid: uuid(), atidaryta: t, ekranas: 'patvirtinimas',
      // Laikai iš BetonPro (testui – nuorodos atidarymo metu): salytis = maišymo pradžia.
      ord_trans: {
        id: ot.id, o_id: ot.o_id, nr: ot.nr, status: 1,
        salytis: t - 9 * 60000, pakrovimas: t - 8 * 60000, isvyko: t - 2 * 60000,
        atvyko: null, iskrovimo_pradzia: null, iskrovimo_pabaiga: null, isvyko_obj: null, gryzo: null,
        driver: ot.driver, driver_tel: tel(ot.driver_tel), transp: ot.transp, driver_accepted: 0, phone_confirmed: 0,
        distance: ot.distance
      },
      planuota_objekte: t - 2 * 60000 + r.iki_objekto_min * 60000,
      taisymai: {}, istorija: [], vieta: { ijungta: false, taskai: {} },
      pateikta: null, siuntimas: null
    };
  }
  function save() { ls(KEY, S); }
  function log(laukas, reiksme, veiksmas) { S.istorija.push({ kada: now(), laukas: laukas, reiksme: reiksme == null ? null : sqlDt(reiksme), veiksmas: veiksmas || 'irasyta' }); }
  function paskutinisIvykes() { var p = -1; for (var i = 0; i < STATUSAI.length; i++) if (S.ord_trans[STATUSAI[i].f]) p = i; return p; }

  /* ---------- Vieta (telefono GPS) ---------- */
  var watchId = null, vieta = null;
  function vietaStart() {
    if (!('geolocation' in navigator)) { toast('Šis telefonas vietos nepateikia.'); return; }
    S.vieta.ijungta = true; save();
    if (watchId != null) return;
    watchId = navigator.geolocation.watchPosition(function (p) {
      vieta = { lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy) };
      var el = document.getElementById('vieta-txt'); if (el) el.textContent = vietaTekstas();
      var d = document.getElementById('vieta-dot'); if (d) d.className = 'live';
    }, function (e) {
      S.vieta.ijungta = false; save(); watchId = null;
      toast(e.code === 1 ? 'Vietos naudoti neleista. Ją galima įjungti telefono nustatymuose.' : 'Vietos nustatyti nepavyko.', null, null, 6000);
      render();
    }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
  }
  function vietaTekstas() {
    if (!S.vieta.ijungta) return 'Vieta neperduodama';
    if (!vieta) return 'Nustatoma vieta…';
    return 'Vieta perduodama · ±' + vieta.acc + ' m';
  }

  /* ---------- Veiksmai ---------- */
  function irasyti(laukas, kitasEkranas) {
    var t = now();
    S.ord_trans[laukas] = t;
    if (laukas === 'iskrovimo_pabaiga') S.ord_trans.status = 3;
    if (vieta && S.vieta.ijungta) S.vieta.taskai[laukas] = vieta;
    log(laukas, t);
    S.ekranas = kitasEkranas;
    save(); render(); window.scrollTo(0, 0);
    toast(STATUSAI[idx(laukas)].t + ' · ' + hm(t), 'Atšaukti', function () { atsaukti(laukas); }, 10000);
  }
  // Atšaukti galima tik paskutinį įrašytą vairuotojo statusą.
  function atsaukti(laukas) {
    var p = paskutinisIvykes();
    if (p < 0 || STATUSAI[p].src !== 'vairuotojas' || S.pateikta) return;
    if (laukas && STATUSAI[p].f !== laukas) return;
    var f = STATUSAI[p].f;
    S.ord_trans[f] = null; delete S.vieta.taskai[f]; delete S.taisymai[f];
    if (f === 'iskrovimo_pabaiga') S.ord_trans.status = 1;
    log(f, null, 'atšaukta');
    S.ekranas = ekranasPagalBusena(); save(); toastHide(); render();
    toast(STATUSAI[p].t + ' atšauktas.');
  }
  function ekranasPagalBusena() {
    var o = S.ord_trans;
    if (!o.driver_accepted) return 'patvirtinimas';
    if (!o.atvyko) return 'kelyje';
    if (!o.iskrovimo_pradzia) return 'laukia';
    if (!o.iskrovimo_pabaiga) return 'iskrauna';
    if (!o.isvyko_obj) return 'pabaiga';
    if (arKitas() && !o.gryzo) return 'grizimas';
    return 'pateikimas';
  }

  /* ---------- Bendri blokai ---------- */
  // Juosta rodo realų reiso statusą: juoda – įvykę, geltona – dabartinis (paskutinis įvykęs), pilka – laukiantys.
  function juosta() {
    var cur = S.pateikta ? -1 : paskutinisIvykes();
    var h = '<ol class="bpst" style="grid-template-columns:repeat(' + STATUSAI.length + ',minmax(0,1fr))" aria-label="Reiso statusas">';
    STATUSAI.forEach(function (s, i) {
      var cls = S.ord_trans[s.f] ? (i === cur ? 'c' : 'd') : '';
      h += '<li class="' + cls + '"' + (cls === 'c' ? ' aria-current="step"' : '') + ' title="' + esc(s.t) + '"><span>' + svg(s.i, '') + '</span><span>' + esc(s.k) + '</span></li>';
    });
    return h + '</ol>';
  }
  function geltonas(id, mazas, didelis) {
    return '<button type="button" class="btn btn-y" id="' + id + '"><span><span class="s">' + esc(mazas) + '</span><span class="b">' + didelis + '</span></span><span class="arr" aria-hidden="true">→</span></button>';
  }
  function atsauktiMyg() {
    return '<button type="button" class="btn btn-l" id="btn-undo">' + svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>') + 'Atšaukti paskutinį žingsnį</button>';
  }
  function navigacija() {
    var q = encodeURIComponent(R.ord.adresas), ll = R.ord.latitude + ',' + R.ord.longitude;
    return '<div class="nav3" role="group" aria-label="Navigacija iki objekto">' +
      '<a href="https://www.google.com/maps/dir/?api=1&destination=' + ll + '&travelmode=driving" target="_blank" rel="noopener">' + svg('<path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>') + '<span>Google Maps</span></a>' +
      '<a href="https://waze.com/ul?ll=' + ll + '&navigate=yes" target="_blank" rel="noopener">' + svg('<path d="M3 11l18-8-8 18-2-8z"/>') + '<span>Waze</span></a>' +
      '<a href="https://maps.apple.com/?daddr=' + ll + '&dirflg=d&q=' + q + '" target="_blank" rel="noopener">' + svg('<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>') + '<span>Apple Maps</span></a></div>';
  }
  function vietosEilute() {
    return '<div class="vieta"><span id="vieta-dot" class="live' + (S.vieta.ijungta && vieta ? '' : ' off') + '"></span><span id="vieta-txt">' + esc(vietaTekstas()) + '</span>' +
      (S.vieta.ijungta ? '' : '<button type="button" id="btn-vieta">Įjungti</button>') + '</div>';
  }

  // Betono laikrodis: 90 min nuo sąlyčio (ord_trans.salytis).
  function laikrodis(centras) {
    var o = S.ord_trans, C = 2 * Math.PI * 100;
    var praejo = Math.min(90, Math.max(0, (now() - o.salytis) / 60000));
    var planM = Math.min(90, (S.planuota_objekte - o.salytis) / 60000);
    var a = (planM / 90) * 2 * Math.PI - Math.PI / 2, n = (praejo / 90) * 2 * Math.PI - Math.PI / 2;
    var spalva = praejo >= 80 ? '#B3261E' : '#15171A';
    return '<div class="clock"><svg viewBox="-12 -12 264 264" role="img" aria-label="Betono laikrodis: maišoma ' + Math.round(praejo) + ' min iš 90">' +
      '<circle cx="120" cy="120" r="100" fill="none" stroke="#ECEAE4" stroke-width="20"/>' +
      '<circle cx="120" cy="120" r="100" fill="none" stroke="' + spalva + '" stroke-width="20" stroke-dasharray="' + ((praejo / 90) * C).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 120 120)"/>' +
      '<rect x="116" y="4" width="8" height="32" fill="#15171A"/>' +
      '<line x1="' + (120 + Math.cos(a) * 100).toFixed(1) + '" y1="' + (120 + Math.sin(a) * 100).toFixed(1) + '" x2="' + (120 + Math.cos(a) * 126).toFixed(1) + '" y2="' + (120 + Math.sin(a) * 126).toFixed(1) + '" stroke="#15171A" stroke-width="4"/>' +
      '<circle cx="' + (120 + Math.cos(n) * 100).toFixed(1) + '" cy="' + (120 + Math.sin(n) * 100).toFixed(1) + '" r="11" fill="#F5C518" stroke="#15171A" stroke-width="3"/>' +
      '</svg><div class="mid">' + centras + '</div></div>' +
      '<div class="muted c">Maišoma ' + Math.round(praejo) + ' min · riba 90 min (' + hm(o.salytis + 90 * 60000) + ')</div>';
  }
  function kitasReisas() {
    if (!arKitas()) return '<div class="card"><span class="kick">Kitas reisas</span><b>Kitų reisų šiandien nepriskirta</b><span class="muted">Išvykus iš objekto pristatymas bus užbaigtas.</span></div>';
    var k = R.kitas_reisas;
    return '<div class="card card-d"><div class="sp"><span class="kick">Jūsų kitas reisas</span><b class="mono y">' + hm(S.atidaryta + k.laikas_po_min * 60000) + '</b></div>' +
      '<b class="dsp">' + esc(k.ka) + '</b><span class="lt">' + esc(k.kur) + '</span></div>';
  }
  function eilute(k, v, cls) { return '<div class="row' + (cls ? ' ' + cls : '') + '"><span>' + esc(k) + '</span><b>' + v + '</b></div>'; }

  /* ---------- Ekranai: grąžina { b: turinys, f: apatinė juosta } ---------- */
  var E = {};

  E.pasirinkimas = function () {
    var h = '<div class="card"><span class="kick">Testas · nuorodos vietoje SMS</span><h1>Pasirinkite reisą</h1>' +
      '<span class="muted">Realiai vairuotojas gauna SMS žinutę su asmenine nuoroda į savo reisą.</span></div>';
    Object.keys(REISAI).forEach(function (k) {
      var r = REISAI[k], st = ls('bp-reisas-' + k);
      var bus = st && st.v === 2 ? (st.pateikta ? 'Pateikta ' + hm(st.pateikta) : 'Vykdomas') : 'Naujas';
      h += '<a class="sms" href="?r=' + k + '"><span class="kick sp"><span>SMS · reisas ' + k + '</span><span>' + esc(bus) + '</span></span>' +
        '<b>' + esc(r.ord.adresas) + '</b><span class="muted">' + r.ord_trans.kiekis + ' m³ ' + esc(r.ord_trans.product) + ' · ' + esc(r.ord_trans.cars) +
        ' · ' + (r.kitas_reisas ? 'yra kitas reisas' : 'kito reiso nėra') + '</span></a>';
    });
    return { b: h, f: '' };
  };

  E.patvirtinimas = function () {
    var o = S.ord_trans;
    return {
      b: juosta() +
        '<div class="card"><span class="kick">Vairuotojo duomenys</span><h1>Patikrinkite savo duomenis</h1>' +
        '<div class="fld"><label for="f-driver">Vardas, pavardė</label><input id="f-driver" name="driver" autocomplete="name" value="' + esc(o.driver) + '"></div>' +
        '<div class="fld"><label for="f-tel">Telefonas</label><input id="f-tel" name="driver_tel" type="tel" inputmode="tel" autocomplete="tel" class="mono" value="' + esc(o.driver_tel) + '"></div>' +
        '<div class="fld"><label for="f-transp">Įmonė</label><input id="f-transp" name="transp" autocomplete="organization" value="' + esc(o.transp) + '"></div></div>' +
        '<div class="note" role="note">' + svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>') +
        '<span>Mygtukus spauskite tą akimirką, kai atvykstate, pradedate ir baigiate iškrauti. Laikai perduodami klientui.</span></div>' +
        '<div class="card"><div class="truck">' + svg('<path d="M2 7h11v9H2zM13 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>') +
        '<b>' + esc(R.ord_trans.cars) + '</b><span class="muted">Reisas ' + o.id + '</span><button type="button" class="lnk" id="btn-notmine">Ne mano reisas</button></div>' +
        '<div class="grid2"><div><span>Objektas</span><b>' + esc(R.ord.adresas) + '</b></div><div><span>Betonas</span><b>' + R.ord_trans.kiekis + ' m³ ' + esc(R.ord_trans.product.split(' ')[0]) + '</b></div>' +
        '<div><span>Pakrauta</span><b>' + hm(o.pakrovimas) + '</b></div><div><span>Planuota objekte</span><b>' + hm(S.planuota_objekte) + '</b></div></div></div>' +
        '',
      f: geltonas('btn-accept', 'DUOMENYS TEISINGI', 'Patvirtinu. Reisą priimu.')
    };
  };

  E.kelyje = function () {
    var o = S.ord_trans;
    var eta = Math.max(now(), o.isvyko + R.kelione_min * 60000);
    var velu = Math.round((eta - S.planuota_objekte) / 60000);
    var centras = '<small>ATVYKSITE</small><b>' + hm(eta) + '</b><span>' + (velu > 2 ? 'Vėluojate ' + velu + ' min' : 'Planuota ' + hm(S.planuota_objekte)) + '</span>';
    return {
      b: juosta() +
        '<div class="card"><span class="kick">Kelyje · ' + esc(R.ord.adresas) + '</span>' + laikrodis(centras) +
        (velu > 2 ? '<div class="late">' + svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') + '<span>Numatomas vėlavimas ' + velu + ' min. Klientas informuojamas automatiškai.</span></div>' : '') + '</div>' +
        vietosEilute() + navigacija(),
      f: geltonas('btn-atvyko', 'SPAUSKITE ATVYKĘ', 'Atvykau į objektą')
    };
  };

  E.laukia = function () {
    var o = S.ord_trans;
    var d = Math.floor((now() - o.atvyko) / 1000);
    var liko = Math.round(90 - (now() - o.salytis) / 60000);
    return {
      b: juosta() +
        '<div class="card"><span class="kick">Atvykote · ' + hm(o.atvyko) + '</span><h1>Laukiate iškrovimo</h1>' +
        '<div class="big" id="laukia">' + pad(Math.floor(d / 60)) + ':' + pad(d % 60) + '</div>' +
        '<div class="muted c">Laukimo laikas įrašomas į pristatymo ataskaitą.</div></div>' +
        '<div class="card"><div class="rows">' +
        eilute('Objektas', esc(R.ord.adresas)) +
        eilute('Kontaktas', esc(R.ord.kontaktas) + '<br><a href="tel:' + tel(R.ord.tel) + '" class="mono">' + tel(R.ord.tel) + '</a>') +
        eilute('Betonas', R.ord_trans.kiekis + ' m³ ' + esc(R.ord_trans.product)) +
        eilute('Iki 90 min ribos', Math.max(0, liko) + ' min', 'strong') + '</div></div>' + atsauktiMyg(),
      f: geltonas('btn-pradzia', 'SPAUSKITE PRADĖJĘ PILTI', 'Pradėjau iškrauti')
    };
  };

  E.iskrauna = function () {
    var o = S.ord_trans;
    var liko = Math.round(90 - (now() - o.salytis) / 60000);
    var centras = '<small>IKI RIBOS</small><b>' + Math.max(0, liko) + '<i> min</i></b><span>Baigti iki ' + hm(o.salytis + 90 * 60000) + '</span>';
    return {
      b: juosta() +
        '<div class="card"><span class="kick">Iškraunate nuo ' + hm(o.iskrovimo_pradzia) + '</span>' + laikrodis(centras) + '</div>' +
        '<div class="card kmrow"><span><span class="l">Atstumas mazgas–objektas</span><span class="muted">viena kryptis, km</span></span>' +
        '<span class="km"><button type="button" id="km-" aria-label="Sumažinti">−</button><b id="km">' + o.distance + '</b><button type="button" id="km+" aria-label="Padidinti">+</button></span></div>' +
        atsauktiMyg(),
      f: geltonas('btn-pabaiga', 'SPAUSKITE BAIGĘ PILTI', 'Baigiau iškrauti')
    };
  };

  E.pabaiga = function () {
    var o = S.ord_trans, skirt = mins(o.atvyko, S.planuota_objekte);
    var planas = skirt > 0 ? 'Atvykote ' + skirt + ' min anksčiau nei planuota.' : skirt < 0 ? 'Atvykote ' + Math.abs(skirt) + ' min vėliau nei planuota.' : 'Atvykote laiku.';
    var amz = mins(o.salytis, o.iskrovimo_pabaiga);
    return {
      b: juosta() +
        '<div class="card"><span class="kick">Iškrovimas baigtas · ' + hm(o.iskrovimo_pabaiga) + '</span><h1>Ačiū, betonas pristatytas</h1>' +
        '<span class="muted">' + esc(planas) + ' Betono amžius iškrovimo pabaigoje – ' + minTxt(amz) + ' (riba 90 min).</span></div>' +
        kitasReisas() + atsauktiMyg(),
      f: geltonas('btn-isvyko', 'SPAUSKITE IŠVAŽIUODAMI', 'Išvykstu iš objekto')
    };
  };

  E.grizimas = function () {
    var o = S.ord_trans;
    return {
      b: juosta() +
        '<div class="card"><span class="kick">Išvykote iš objekto · ' + hm(o.isvyko_obj) + '</span><h1>Grįžtate į betono mazgą</h1>' +
        '<div class="rows">' + eilute('Mazgas', esc(R.mazgas.pavadinimas)) + eilute('Atstumas', o.distance + ' km') +
        eilute('Numatomas grįžimas', hm(o.isvyko_obj + R.kelione_min * 60000), 'strong') + '</div></div>' +
        kitasReisas() + atsauktiMyg(),
      f: geltonas('btn-gryzo', 'SPAUSKITE GRĮŽĘ', 'Grįžau į mazgą')
    };
  };

  var taisomas = null;
  E.pateikimas = function () {
    var o = S.ord_trans;
    var h = juosta();
    if (taisomas) {
      var i = idx(taisomas), t = o[taisomas], rib = ribos(taisomas);
      h += '<div class="card"><span class="kick">Taisoma · ' + (i + 1) + ' iš ' + STATUSAI.length + (S.taisymai[taisomas] ? ' · buvo ' + hm(S.taisymai[taisomas].buvo) : '') + '</span>' +
        '<h1>' + esc(STATUSAI[i].t) + '</h1><div class="big">' + hm(t) + '</div>' +
        '<div class="pm">' + [-5, -1, 1, 5].map(function (d) {
          var nt = t + d * 60000, ok = nt >= rib[0] && nt <= rib[1];
          return '<button type="button" data-pm="' + d + '"' + (ok ? '' : ' disabled') + ' aria-label="' + (d > 0 ? 'Pridėti ' : 'Atimti ') + Math.abs(d) + ' min">' + (d > 0 ? '+' : '−') + Math.abs(d) + '</button>';
        }).join('') + '</div>' +
        '<span class="muted c">Galima nuo ' + hm(rib[0]) + ' iki ' + hm(rib[1]) + '</span>' +
        '<div class="act2"><button type="button" id="ed-cancel">Atšaukti</button><button type="button" id="ed-save">Išsaugoti laiką</button></div></div>';
    } else {
      h += '<div class="card"><span class="kick">Reisas ' + o.id + ' · ' + esc(R.ord_trans.cars) + '</span><h1>Patikrinkite laikus</h1>' +
        '<span class="muted">Jei laikas netikslus, paspauskite jį ir pataisykite. Pasikrovimo ir išvykimo laikus įrašo betono mazgas.</span></div>';
    }
    h += '<div class="card"><div class="tl">';
    STATUSAI.forEach(function (s, i) {
      var v = o[s.f], n = '<span class="n">' + (i + 1) + '</span>';
      if (s.src === 'betonpro') {
        h += '<div class="it bp"><span>' + n + esc(s.t) + '</span><b>' + hm(v) + '</b>' + svg('<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 018 0v4"/>') + '</div>';
      } else {
        var tais = S.taisymai[s.f];
        h += '<button type="button" class="it" data-edit="' + s.f + '" aria-pressed="' + (taisomas === s.f) + '"' + (taisomas && taisomas !== s.f ? ' disabled' : '') + '><span>' + n + esc(s.t) + '</span><b>' + (tais ? '<s>' + hm(tais.buvo) + '</s>' : '') + hm(v) + '</b>' +
          svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>') + '</button>';
      }
    });
    h += '</div></div>' + (taisomas ? '' : atsauktiMyg());
    var n = Object.keys(S.taisymai).length;
    return {
      b: h,
      f: '<button type="button" class="btn btn-y" id="btn-pateikti"' + (taisomas ? ' disabled' : '') + '><span><span class="s">PASKUTINIS ŽINGSNIS' + (n ? ' · PATAISYTA: ' + n : '') + '</span><span class="b">Pateikti pasirašyti</span></span><span class="arr" aria-hidden="true">→</span></button>'
    };
  };
  function ribos(f) {
    var o = S.ord_trans, i = idx(f), min = 0, max = now();
    for (var a = i - 1; a >= 0; a--) if (o[STATUSAI[a].f]) { min = o[STATUSAI[a].f]; break; }
    for (var b = i + 1; b < STATUSAI.length; b++) if (o[STATUSAI[b].f]) { max = o[STATUSAI[b].f]; break; }
    return [min, max];
  }

  E.pateikta = function () {
    var s = S.siuntimas || {}, kam = CFG.ataskaitaKam, h = juosta(), f = '';
    if (s.busena === 'siunciama') h += '<div class="card"><span class="kick">Siunčiama</span><h1>Siunčiama ataskaita…</h1></div>';
    else {
      h += '<div class="ok">' + svg('<path d="M4 12.5l5 5L20 6.5"/>') + '<span><b>Pateikta pasirašyti ' + hm(S.pateikta) + '.</b>' +
        (s.busena === 'issiusta' ? '<br>Ataskaita išsiųsta: ' + esc(kam) + '.' : '<br>Reiso laikai išsaugoti, ataskaita parengta.') + '</span></div>';
      if (s.busena === 'klaida') h += '<div class="err">Ataskaitos išsiųsti automatiškai nepavyko' + (s.klaida ? ' (' + esc(s.klaida) + ')' : '') + '.</div>';
      if (s.busena !== 'issiusta') f = '<a class="btn btn-k" href="' + mailto() + '">' + svg('<path d="M3 5h18v14H3z"/><path d="M3 6l9 7 9-7"/>') + 'Siųsti ataskaitą el. paštu</a>' +
        (CFG.endpoint ? '<button type="button" class="btn btn-l" id="btn-retry">Bandyti siųsti automatiškai dar kartą</button>' : '');
    }
    h += '<div class="card pv"><span class="kick">Ataskaita</span><div class="prev">' + ataskaitaHtml() + '</div></div>' +
      '<a class="btn btn-o" href="?">Kiti testiniai reisai</a>';
    return { b: h, f: f };
  };

  /* ---------- Ataskaita ---------- */
  function rodikliai() {
    var o = S.ord_trans, amzius = mins(o.salytis, o.iskrovimo_pabaiga);
    return {
      kelione_iki_objekto_min: mins(o.isvyko, o.atvyko),
      laukimas_objekte_min: mins(o.atvyko, o.iskrovimo_pradzia),
      iskrovimas_min: mins(o.iskrovimo_pradzia, o.iskrovimo_pabaiga),
      objekte_is_viso_min: mins(o.atvyko, o.isvyko_obj),
      betono_amzius_iskrovus_min: amzius,
      riba_90_min_islaikyta: amzius != null ? amzius <= 90 : null,
      atvykimas_pries_plana_min: mins(o.atvyko, S.planuota_objekte),
      reiso_ciklas_min: mins(o.pakrovimas, o.gryzo || o.isvyko_obj)
    };
  }
  function ataskaitaDuomenys() {
    var o = S.ord_trans;
    return {
      versija: 'vairuotojo-forma-test-2', client_uuid: S.client_uuid, pateikta: sqlDt(S.pateikta),
      ord_trans: {
        id: o.id, o_id: o.o_id, status: 3, salytis: sqlDt(o.salytis), pakrovimas: sqlDt(o.pakrovimas), isvyko: sqlDt(o.isvyko), atvyko: sqlDt(o.atvyko),
        iskrovimo_pradzia: sqlDt(o.iskrovimo_pradzia), iskrovimo_pabaiga: sqlDt(o.iskrovimo_pabaiga), isvyko_obj: sqlDt(o.isvyko_obj), gryzo: sqlDt(o.gryzo),
        distance: o.distance, driver: o.driver, driver_tel: o.driver_tel, transp: o.transp, driver_accepted: o.driver_accepted, phone_confirmed: o.phone_confirmed,
        cars: R.ord_trans.cars, cars_id: R.ord_trans.cars_id, driver_id: R.ord_trans.driver_id, transp_id: R.ord_trans.transp_id, kiekis: R.ord_trans.kiekis, product: R.ord_trans.product
      },
      ord: R.ord, kitas_reisas: arKitas(),
      statusai: STATUSAI.map(function (s) { return { laukas: s.f, statusas: s.t, laikas: sqlDt(o[s.f]), saltinis: s.src, taisyta_is: S.taisymai[s.f] ? sqlDt(S.taisymai[s.f].buvo) : null, vieta: S.vieta.taskai[s.f] || null }; }),
      rodikliai: rodikliai(),
      istorija: S.istorija.map(function (x) { return { kada: sqlDt(x.kada), laukas: x.laukas, reiksme: x.reiksme, veiksmas: x.veiksmas, saltinis: 'SMS Tracker' }; })
    };
  }
  // El. laiškui tinkamas HTML: lentelės, tik įterpti stiliai (be <style>, <img>, <span>).
  function ataskaitaHtml() {
    var o = S.ord_trans, r = rodikliai();
    var F = 'font-family:Arial,Helvetica,sans-serif;';
    var td = 'style="' + F + 'padding:8px 10px;border-bottom:1px solid #E4E1D9;font-size:14px;color:#15171A;vertical-align:top"';
    var tdl = 'style="' + F + 'padding:8px 10px;border-bottom:1px solid #E4E1D9;font-size:13px;color:#5A5F66;width:42%;vertical-align:top"';
    var th = 'style="' + F + 'padding:8px 10px;background:#ECEAE4;font-size:12px;color:#4A4F55;text-align:left"';
    function kv(k, v) { return '<tr><td ' + tdl + '>' + esc(k) + '</td><td ' + td + '>' + v + '</td></tr>'; }
    var h = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:680px;margin:0 auto;background:#FFFFFF;border:1px solid #D9D6CE">' +
      '<tr><td style="background:#15171A;padding:18px 22px"><b style="' + F + 'font-size:20px;color:#FAF9F6">BetonPro HUB</b>' +
      '<div style="' + F + 'font-size:12px;color:#A9AEB4;margin-top:6px;letter-spacing:.06em">BETONO PRISTATYMO ATASKAITA</div></td></tr>' +
      '<tr><td style="background:#F5C518;height:6px;line-height:6px;font-size:0">&nbsp;</td></tr>' +
      '<tr><td style="padding:20px 22px 6px"><div style="' + F + 'font-size:20px;font-weight:bold;color:#15171A">' + esc(R.ord.adresas) + '</div>' +
      '<div style="' + F + 'font-size:14px;color:#4A4F55;margin-top:4px">' + dt(o.pakrovimas) + ' · Užsakymas ' + esc(R.ord.nr) + ' · Reisas ' + o.id + '</div></td></tr>' +
      '<tr><td style="padding:12px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
      kv('Klientas', esc(R.ord.gavejas)) + kv('Objektas', esc(R.ord.adresas)) +
      kv('Betonas', '<b>' + R.ord_trans.kiekis + ' m³</b> · ' + esc(R.ord_trans.product)) +
      kv('Betonvežis', esc(R.ord_trans.cars)) + kv('Vairuotojas', esc(o.driver) + ', ' + esc(o.driver_tel)) + kv('Vežėjas', esc(o.transp)) +
      kv('Betono mazgas', esc(R.mazgas.pavadinimas)) + '</table></td></tr>' +
      '<tr><td style="padding:8px 22px 4px"><div style="' + F + 'font-size:15px;font-weight:bold;color:#15171A">Pristatymo laikai</div></td></tr>' +
      '<tr><td style="padding:4px 22px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
      '<tr><th ' + th + '>Nr.</th><th ' + th + '>Statusas</th><th ' + th + '>Laikas</th><th ' + th + '>Šaltinis</th></tr>';
    STATUSAI.forEach(function (s, i) {
      var v = o[s.f], tais = S.taisymai[s.f], g = S.vieta.taskai[s.f];
      var src = s.src === 'betonpro' ? 'Betono mazgas' : (v ? 'Vairuotojas' : '—');
      if (tais) src += '<br><i style="color:#8A6D00">pataisyta, buvo ' + hm(tais.buvo) + '</i>';
      if (g) src += '<br><a href="https://www.google.com/maps?q=' + g.lat + ',' + g.lon + '" style="color:#4A4F55">vieta žemėlapyje</a>';
      h += '<tr><td ' + td + '>' + (i + 1) + '</td><td ' + td + '>' + esc(s.t) + '</td><td ' + td + '>' + (v ? '<b>' + hm(v) + '</b>' : '—') + '</td><td ' + td + '>' + src + '</td></tr>';
    });
    var ap = r.atvykimas_pries_plana_min;
    h += '</table></td></tr>' +
      '<tr><td style="padding:8px 22px 4px"><div style="' + F + 'font-size:15px;font-weight:bold;color:#15171A">Rodikliai</div></td></tr>' +
      '<tr><td style="padding:4px 22px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
      kv('Kelionė iki objekto', minTxt(r.kelione_iki_objekto_min)) +
      kv('Atvykimas, palyginti su planu (' + hm(S.planuota_objekte) + ')', ap == null ? '—' : ap > 0 ? ap + ' min anksčiau' : ap < 0 ? Math.abs(ap) + ' min vėliau' : 'laiku') +
      kv('Laukimas objekte iki iškrovimo', minTxt(r.laukimas_objekte_min)) +
      kv('Iškrovimo trukmė', minTxt(r.iskrovimas_min)) +
      kv('Betono amžius iškrovimo pabaigoje', minTxt(r.betono_amzius_iskrovus_min) + (r.riba_90_min_islaikyta == null ? '' : r.riba_90_min_islaikyta ? ' · <b style="color:#2C7A5B">neviršyta 90 min riba</b>' : ' · <b style="color:#B3261E">viršyta 90 min riba</b>')) +
      kv('Atstumas mazgas–objektas', o.distance + ' km') +
      kv('Reiso trukmė', minTxt(r.reiso_ciklas_min) + (arKitas() ? ' (iki grįžimo į mazgą)' : ' (iki išvykimo iš objekto)')) +
      '</table></td></tr>' +
      '<tr><td style="padding:12px 22px 20px;border-top:1px solid #E4E1D9"><div style="' + F + 'font-size:12px;line-height:1.5;color:#5A5F66">' +
      'Laikus patvirtino vairuotojas ' + esc(o.driver) + (S.pateikta ? ' ' + dt(S.pateikta) + ' ' + hm(S.pateikta) : '') + '. Pasikrovimo ir išvykimo iš mazgo laikus įrašė betono mazgo sistema.<br>' +
      'Ataskaita parengta automatiškai sistemoje BetonPro HUB (testinė aplinka).</div></td></tr></table>';
    return h;
  }
  function ataskaitaTekstas() {
    var o = S.ord_trans, r = rodikliai();
    var t = 'BETONO PRISTATYMO ATASKAITA – BetonPro HUB\n\n' + R.ord.adresas + '\n' + dt(o.pakrovimas) + ' · Užsakymas ' + R.ord.nr + ' · Reisas ' + o.id + '\n\n' +
      'Klientas: ' + R.ord.gavejas + '\nBetonas: ' + R.ord_trans.kiekis + ' m³ ' + R.ord_trans.product + '\nBetonvežis: ' + R.ord_trans.cars + '\nVairuotojas: ' + o.driver + ', ' + o.driver_tel + '\nVežėjas: ' + o.transp + '\n\nPRISTATYMO LAIKAI\n';
    STATUSAI.forEach(function (s, i) {
      var tais = S.taisymai[s.f];
      t += (i + 1) + '. ' + s.t + ': ' + hm(o[s.f]) + ' (' + (s.src === 'betonpro' ? 'betono mazgas' : 'vairuotojas') + (tais ? ', pataisyta, buvo ' + hm(tais.buvo) : '') + ')\n';
    });
    t += '\nRODIKLIAI\nKelionė iki objekto: ' + minTxt(r.kelione_iki_objekto_min) + '\nLaukimas objekte: ' + minTxt(r.laukimas_objekte_min) + '\nIškrovimo trukmė: ' + minTxt(r.iskrovimas_min) +
      '\nBetono amžius iškrovimo pabaigoje: ' + minTxt(r.betono_amzius_iskrovus_min) + '\nAtstumas: ' + o.distance + ' km\n\nAtaskaita parengta automatiškai sistemoje BetonPro HUB (testinė aplinka).';
    return t;
  }
  function tema() { return 'Betono pristatymo ataskaita · ' + R.ord.adresas + ' · ' + dt(S.ord_trans.pakrovimas) + ' · reisas ' + S.ord_trans.id; }
  function mailto() { return 'mailto:' + (CFG.ataskaitaKam || '') + '?subject=' + encodeURIComponent(tema()) + '&body=' + encodeURIComponent(ataskaitaTekstas()); }

  function siusti() {
    if (!CFG.endpoint) { S.siuntimas = { busena: 'nenustatyta' }; save(); render(); return; }
    S.siuntimas = { busena: 'siunciama' }; save(); render();
    var body = { action: 'reiso_ataskaita', raktas: CFG.raktas, kam: CFG.ataskaitaKam, tema: tema(), html: ataskaitaHtml(), tekstas: ataskaitaTekstas(), duomenys: ataskaitaDuomenys() };
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    fetch(CFG.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(tm); if (!j || !j.ok) throw new Error((j && j.error) || 'nepavyko'); S.siuntimas = { busena: 'issiusta', kada: now() }; save(); render(); })
      .catch(function (e) { clearTimeout(tm); S.siuntimas = { busena: 'klaida', klaida: navigator.onLine ? String(e.message || e).slice(0, 80) : 'nėra ryšio' }; save(); render(); });
  }

  /* ---------- Atvaizdavimas ---------- */
  var tick = null;
  function render() {
    var ekr = !R ? 'pasirinkimas' : (S.pateikta ? 'pateikta' : S.ekranas);
    var e = E[ekr]();
    $main.innerHTML = '<section class="scr" data-ekranas="' + ekr + '">' + e.b +
      (R ? '<div class="reset"><button type="button" id="btn-reset">Testas: pradėti šį reisą iš naujo</button></div>' : '') + '</section>';
    $foot.innerHTML = e.f; $foot.hidden = !e.f;
    bind();
    clearInterval(tick);
    if (ekr === 'laukia') tick = setInterval(function () { var el = document.getElementById('laukia'); if (!el) return; var d = Math.floor((now() - S.ord_trans.atvyko) / 1000); el.textContent = pad(Math.floor(d / 60)) + ':' + pad(d % 60); }, 1000);
    else if (ekr === 'kelyje' || ekr === 'iskrauna') tick = setInterval(function () { var a = document.activeElement; if (!a || a === document.body) render(); }, 30000);
  }
  function on(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  var busy = false; // apsauga nuo dvigubo paspaudimo
  function vienas(fn) { return function (ev) { if (busy) return; busy = true; setTimeout(function () { busy = false; }, 600); fn(ev); }; }
  function bind() {
    on('btn-reset', function () { if (confirm('Pradėti šį testinį reisą iš naujo?')) { ls(KEY, null); taisomas = null; start(); } });
    var ft = document.getElementById('f-tel');
    if (ft) ft.addEventListener('input', function () { var p = ft.selectionStart, v = ft.value, n = tel(v); if (v !== n) { ft.value = n; try { ft.setSelectionRange(p - (v.length - n.length), p - (v.length - n.length)); } catch (e) {} } });
    on('btn-accept', vienas(function () {
      var o = S.ord_trans, val = {};
      ['driver', 'driver_tel', 'transp'].forEach(function (k) { val[k] = document.querySelector('[name="' + k + '"]').value.trim(); });
      val.driver_tel = tel(val.driver_tel);
      if (!val.driver) { toast('Įveskite vardą ir pavardę.'); document.getElementById('f-driver').focus(); return; }
      if (!/^\+?\d{8,15}$/.test(val.driver_tel)) { toast('Patikrinkite telefono numerį.'); document.getElementById('f-tel').focus(); return; }
      if (!val.transp) { toast('Įveskite įmonę.'); document.getElementById('f-transp').focus(); return; }
      Object.keys(val).forEach(function (k) { if (val[k] !== o[k]) log(k, null, 'pakeista: ' + val[k]); o[k] = val[k]; });
      o.driver_accepted = 1; o.phone_confirmed = 1; log('driver_accepted', now(), 'reisas priimtas');
      S.ekranas = 'kelyje'; save(); render(); window.scrollTo(0, 0);
    }));
    on('btn-notmine', function () { log('driver_accepted', null, 'ne mano reisas'); save(); toast('Pranešta dispečeriui. Su jumis susisieks.', null, null, 5000); });
    on('btn-vieta', vietaStart);
    on('btn-atvyko', vienas(function () { irasyti('atvyko', 'laukia'); }));
    on('btn-pradzia', vienas(function () { irasyti('iskrovimo_pradzia', 'iskrauna'); }));
    on('btn-pabaiga', vienas(function () { irasyti('iskrovimo_pabaiga', 'pabaiga'); }));
    on('btn-isvyko', vienas(function () { irasyti('isvyko_obj', arKitas() ? 'grizimas' : 'pateikimas'); }));
    on('btn-gryzo', vienas(function () { irasyti('gryzo', 'pateikimas'); }));
    on('btn-undo', function () { atsaukti(); });
    on('km-', function () { S.ord_trans.distance = Math.max(1, S.ord_trans.distance - 1); save(); document.getElementById('km').textContent = S.ord_trans.distance; });
    on('km+', function () { S.ord_trans.distance = Math.min(300, S.ord_trans.distance + 1); save(); document.getElementById('km').textContent = S.ord_trans.distance; });
    each('[data-edit]', function (b) { b.addEventListener('click', function () { if (taisomas) return; taisomas = b.getAttribute('data-edit'); S._buvo = S.ord_trans[taisomas]; render(); window.scrollTo(0, 0); }); });
    each('[data-pm]', function (b) {
      b.addEventListener('click', function () {
        var nt = S.ord_trans[taisomas] + (+b.getAttribute('data-pm')) * 60000, rib = ribos(taisomas);
        if (nt < rib[0] || nt > rib[1]) return;
        S.ord_trans[taisomas] = nt; render();
      });
    });
    on('ed-cancel', function () { if (S._buvo) S.ord_trans[taisomas] = S._buvo; taisomas = null; delete S._buvo; save(); render(); });
    on('ed-save', function () {
      var f = taisomas, buvo = S._buvo, tapo = S.ord_trans[f];
      if (buvo !== tapo) {
        var orig = S.taisymai[f] ? S.taisymai[f].buvo : buvo;
        if (orig === tapo) delete S.taisymai[f]; else S.taisymai[f] = { buvo: orig, tapo: tapo, kada: now() };
        log(f, tapo, 'pataisyta');
      }
      taisomas = null; delete S._buvo; save(); render(); toast('Laikas išsaugotas.');
    });
    on('btn-pateikti', vienas(function () {
      if (taisomas) return;
      S.pateikta = now(); log('pateikta', S.pateikta, 'pateikta pasirašyti'); save(); toastHide(); render(); window.scrollTo(0, 0); siusti();
    }));
    on('btn-retry', siusti);
  }

  function start() {
    R = REISAI[rid] || null;
    if (!R) { document.title = 'BetonPro · Testiniai reisai'; render(); return; }
    STATUSAI = R.kitas_reisas ? VISI_STATUSAI : VISI_STATUSAI.filter(function (s) { return s.f !== 'gryzo'; });
    KEY = 'bp-reisas-' + rid;
    S = ls(KEY);
    if (!S || S.v !== 2 || !S.ord_trans) { S = naujaBusena(R); save(); }
    delete S._buvo;
    if (S.vieta.ijungta) vietaStart();
    document.title = 'BetonPro · Reisas ' + rid;
    render();
  }
  start();
})();
