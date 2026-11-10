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

  /* ---------- Statusai (BetonPro) ---------- */
  // laukas – bet_<pad>_ord_trans stulpelis; src – kas įrašo.
  var STATUSAI = [
    { f: 'pakrovimas',        t: 'Pasikrovimas',              k: 'Krovimas', src: 'betonpro' },
    { f: 'isvyko',            t: 'Išvykimas iš betono mazgo', k: 'Išvyko',   src: 'betonpro' },
    { f: 'atvyko',            t: 'Atvykimas pas klientą',     k: 'Atvyko',   src: 'vairuotojas' },
    { f: 'iskrovimo_pradzia', t: 'Iškrovimo pradžia',         k: 'Pradžia',  src: 'vairuotojas' },
    { f: 'iskrovimo_pabaiga', t: 'Iškrovimo pabaiga',         k: 'Pabaiga',  src: 'vairuotojas' },
    { f: 'isvyko_obj',        t: 'Išvykimas iš kliento',      k: 'Išvyko',   src: 'vairuotojas' },
    { f: 'gryzo',             t: 'Grįžimas į betono mazgą',   k: 'Grįžo',    src: 'vairuotojas', optional: true }
  ];
  var IKONOS = [
    '<path d="M12 3v10M7 9l5 5 5-5M4 17h16v4H4z"/>',
    '<path d="M2 7h11v9H2zM13 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    '<path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    '<path d="M7 5l12 7-12 7z"/>',
    '<path d="M6 6h12v12H6z"/>',
    '<path d="M10 4H4v16h6M14 8l4 4-4 4M18 12H9"/>',
    '<path d="M3 11l9-7 9 7M5 10v10h14V10"/>'
  ];

  /* ---------- Testiniai reisai ---------- */
  // Struktūra = ką serveris grąžintų pagal trumposios nuorodos žetoną (bendras_short_links.token).
  var REISAI = {
    '48213': {
      ord_trans: { id: 48213, o_id: 9311, nr: 3, kiekis: 8, product: 'C30/37 XC2 S3 Dmax16', cars: 'LKA 482', cars_id: 214,
        driver: 'Tomas Petrauskas', driver_id: 77, driver_tel: '+370 612 34567', transp: 'UAB „Kelio ratas“', transp_id: 12,
        distance: 17, city_km: 6, transp_kaina: 1 },
      ord: { id: 9311, nr: 'U-2026-9311', gavejas: 'UAB „Statybų partneris“', adresas: 'Savanorių pr. 12, Kaunas',
        latitude: 54.9035, longitude: 23.9312, kontaktas: 'Darbų vadovas Mantas', tel: '+370 600 11111', kiekis: 48 },
      mazgas: { pavadinimas: 'Kauno betono mazgas', adresas: 'Raudondvario pl. 150, Kaunas' },
      kelione_min: 28, iki_objekto_min: 30,
      kitas_reisas: { laikas_po_min: 70, ka: 'Pakrovimas Kaune', kur: '9 m³ C25/30 → Ukmergės g. 40, Jonava' }
    },
    '48219': {
      ord_trans: { id: 48219, o_id: 9318, nr: 1, kiekis: 9, product: 'C25/30 XC1 S4 Dmax16', cars: 'KNS 117', cars_id: 231,
        driver: 'Andrius Kazlauskas', driver_id: 81, driver_tel: '+370 655 22222', transp: 'UAB „Betono vežėjai“', transp_id: 15,
        distance: 24, city_km: 4, transp_kaina: 1 },
      ord: { id: 9318, nr: 'U-2026-9318', gavejas: 'MB „Namų statyba“', adresas: 'Ukmergės g. 40, Jonava',
        latitude: 55.0733, longitude: 24.2797, kontaktas: 'Rimas', tel: '+370 600 22222', kiekis: 9 },
      mazgas: { pavadinimas: 'Kauno betono mazgas', adresas: 'Raudondvario pl. 150, Kaunas' },
      kelione_min: 35, iki_objekto_min: 40,
      kitas_reisas: null
    },
    '48224': {
      ord_trans: { id: 48224, o_id: 9322, nr: 2, kiekis: 6, product: 'C35/45 XC4 XF1 S3 Dmax16', cars: 'HPN 330', cars_id: 245,
        driver: 'Jonas Žukauskas', driver_id: 90, driver_tel: '+370 677 33333', transp: 'UAB „Kelio ratas“', transp_id: 12,
        distance: 11, city_km: 9, transp_kaina: 1 },
      ord: { id: 9322, nr: 'U-2026-9322', gavejas: 'UAB „Infra statyba“', adresas: 'Ozo g. 25, Vilnius',
        latitude: 54.7104, longitude: 25.2735, kontaktas: 'Inžinierė Laura', tel: '+370 600 33333', kiekis: 30 },
      mazgas: { pavadinimas: 'Vilniaus betono mazgas', adresas: 'Savanorių pr. 178, Vilnius' },
      kelione_min: 22, iki_objekto_min: 25,
      kitas_reisas: { laikas_po_min: 55, ka: 'Pakrovimas Vilniuje', kur: '6 m³ C35/45 → Ozo g. 25, Vilnius' }
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
  function now() { return Date.now(); }
  function svg(p, cls) { return '<svg class="' + (cls || 'ico') + '" viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>'; }
  function uuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  var params = new URLSearchParams(location.search);
  var hashR = (location.hash.match(/r=(\d+)/) || [])[1];
  var rid = params.get('r') || hashR;

  /* A+ */
  var aplus = !!ls('bp-aplus');
  function applyAplus() { document.documentElement.classList.toggle('aplus', aplus); document.getElementById('btn-aplus').setAttribute('aria-pressed', String(aplus)); }
  document.getElementById('btn-aplus').addEventListener('click', function () { aplus = !aplus; ls('bp-aplus', aplus); applyAplus(); });
  document.getElementById('btn-lang').addEventListener('click', function () { toast('Testinėje versijoje – tik lietuvių kalba.'); });
  applyAplus();

  var toastT;
  function toast(msg, btn, fn, ms) {
    var el = document.getElementById('toast');
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (btn ? '<button type="button">' + esc(btn) + '</button>' : '');
    el.hidden = false;
    if (btn) el.querySelector('button').onclick = function () { el.hidden = true; fn(); };
    clearTimeout(toastT); toastT = setTimeout(function () { el.hidden = true; }, ms || 4000);
  }

  /* ---------- Būsena ---------- */
  var R, S, KEY;

  function naujaBusena(r) {
    var t = now();
    var ot = r.ord_trans;
    return {
      client_uuid: uuid(),
      atidaryta: t,
      ekranas: 'patvirtinimas',
      // Laikai iš BetonPro (testui – atidarymo metu): salytis = maišymo pradžia, pakrovimas, isvyko.
      ord_trans: {
        id: ot.id, o_id: ot.o_id, nr: ot.nr, status: 1,
        salytis: t - 9 * 60000, pakrovimas: t - 8 * 60000, isvyko: t - 2 * 60000,
        atvyko: null, iskrovimo_pradzia: null, iskrovimo_pabaiga: null, isvyko_obj: null, gryzo: null,
        driver: ot.driver, driver_tel: ot.driver_tel, transp: ot.transp, driver_accepted: 0, phone_confirmed: 0,
        distance: ot.distance
      },
      planuota_objekte: t - 2 * 60000 + r.iki_objekto_min * 60000,
      taisymai: {},        // laukas → {buvo, tapo, kada}
      istorija: [],        // {kada, laukas, reiksme, veiksmas}
      gps: { saltinis: 'telefonas', ijungta: false, taskai: {} },
      pristatymas_baigtas_be_grizimo: false,
      pateikta: null, siuntimas: null
    };
  }
  function save() { ls(KEY, S); }
  function log(laukas, reiksme, veiksmas) { S.istorija.push({ kada: now(), laukas: laukas, reiksme: reiksme == null ? null : sqlDt(reiksme), veiksmas: veiksmas || 'set' }); }

  function dabartinis() { // pirmas neįvykęs statusas
    for (var i = 0; i < STATUSAI.length; i++) { if (!S.ord_trans[STATUSAI[i].f]) return i; }
    return STATUSAI.length;
  }

  /* ---------- GPS ---------- */
  var watchId = null, paskutineVieta = null;
  function gpsStart() {
    if (!('geolocation' in navigator)) { toast('Šis telefonas vietos nepateikia.'); return; }
    S.gps.ijungta = true; save();
    if (watchId != null) return;
    watchId = navigator.geolocation.watchPosition(function (p) {
      paskutineVieta = { lat: +p.coords.latitude.toFixed(5), lon: +p.coords.longitude.toFixed(5), acc: Math.round(p.coords.accuracy), t: p.timestamp };
      var el = document.getElementById('gps-txt'); if (el) el.textContent = gpsTekstas();
    }, function (e) {
      S.gps.ijungta = false; save(); watchId = null;
      toast(e.code === 1 ? 'Vietos leidimas nesuteiktas.' : 'Vietos nepavyko nustatyti.');
      render();
    }, { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
  }
  function gpsTekstas() {
    if (S.gps.saltinis === 'vezejas') return 'VEŽĖJO GPS · TESTE NEPRIJUNGTA';
    if (!S.gps.ijungta) return 'TELEFONO GPS IŠJUNGTAS';
    if (!paskutineVieta) return 'IEŠKOMA VIETOS…';
    return paskutineVieta.lat + ', ' + paskutineVieta.lon + ' · ±' + paskutineVieta.acc + ' m';
  }

  /* ---------- Veiksmai ---------- */
  var paskutinis = null; // atšaukimui
  function irasyti(laukas) {
    var t = now();
    S.ord_trans[laukas] = t;
    if (paskutineVieta && S.gps.saltinis === 'telefonas') S.gps.taskai[laukas] = paskutineVieta;
    log(laukas, t);
    paskutinis = laukas;
    save(); render();
    var idx = STATUSAI.findIndex(function (s) { return s.f === laukas; });
    toast(STATUSAI[idx].t + ' · ' + hm(t), 'Atšaukti', function () { atsaukti(laukas); }, 10000);
  }
  function atsaukti(laukas) {
    laukas = laukas || paskutinis;
    if (!laukas || !S.ord_trans[laukas]) return;
    S.ord_trans[laukas] = null; delete S.gps.taskai[laukas];
    if (laukas === 'isvyko_obj' || laukas === 'gryzo') S.pristatymas_baigtas_be_grizimo = false;
    log(laukas, null, 'atsaukta');
    S.ekranas = ekranasPagalBusena(); save(); render();
  }
  function ekranasPagalBusena() {
    var o = S.ord_trans;
    if (!o.driver_accepted) return 'patvirtinimas';
    if (!o.atvyko) return 'kelyje';
    if (!o.iskrovimo_pradzia) return 'laukia';
    if (!o.iskrovimo_pabaiga) return 'iskrauna';
    if (!o.isvyko_obj) return 'pabaiga';
    if (!o.gryzo && !S.pristatymas_baigtas_be_grizimo) return 'grizimas';
    return 'pateikimas';
  }

  /* ---------- Bendri blokai ---------- */
  function juosta() {
    var cur = dabartinis();
    var h = '<ol class="bpst" aria-label="Reiso eiga pagal BetonPro statusus">';
    STATUSAI.forEach(function (s, i) {
      var cls = '';
      if (S.ord_trans[s.f]) cls = 'd';
      else if (i === cur && S.ekranas !== 'pateikimas') cls = 'c';
      else if (s.optional && S.pristatymas_baigtas_be_grizimo) cls = 'o';
      h += '<li class="' + cls + '"' + (cls === 'c' ? ' aria-current="step"' : '') + ' title="' + esc(s.t) + '"><span>' + svg(IKONOS[i], '') + '</span><span>' + esc(s.k) + '</span></li>';
    });
    return h + '</ol>';
  }
  function didelisMygtukas(id, mazas, didelis) {
    return '<button type="button" class="btn btn-y pulse" id="' + id + '"><span><span class="s">' + esc(mazas) + '</span><span class="b">' + didelis + '</span></span><span class="arr" aria-hidden="true">→</span></button>';
  }
  function atsauktiMyg() {
    return '<button type="button" class="btn btn-l" id="btn-undo">' + svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 010 12h-3"/>') + 'Atšaukti paskutinį žingsnį</button>';
  }
  function navigacija() {
    var a = R.ord.adresas, q = encodeURIComponent(a);
    var ll = R.ord.latitude + ',' + R.ord.longitude;
    var pin = svg('<path d="M12 21s-7-6.5-7-11a7 7 0 0114 0c0 4.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>');
    var arr = svg('<path d="M3 11l18-8-8 18-2-8z"/>');
    var map = svg('<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>');
    return '<div class="nav3" role="group" aria-label="Navigacija iki objekto">' +
      '<a href="https://www.google.com/maps/dir/?api=1&destination=' + ll + '&travelmode=driving" target="_blank" rel="noopener">' + pin + 'Google Maps</a>' +
      '<a href="https://waze.com/ul?ll=' + ll + '&navigate=yes&q=' + q + '" target="_blank" rel="noopener">' + arr + 'Waze</a>' +
      '<a href="https://maps.apple.com/?daddr=' + ll + '&dirflg=d&q=' + q + '" target="_blank" rel="noopener">' + map + 'Apple Maps</a></div>';
  }
  function gpsKortele() {
    var on = S.gps.saltinis === 'vezejas' || (S.gps.ijungta);
    return '<div class="card" style="padding:10px 12px">' +
      '<span class="gpsline"><span class="live' + (on ? '' : ' off') + '"></span><span id="gps-txt">' + esc(gpsTekstas()) + '</span></span>' +
      '<div class="seg" role="group" aria-label="Vietos šaltinis">' +
      '<button type="button" data-gps="telefonas" aria-pressed="' + (S.gps.saltinis === 'telefonas') + '">Telefono GPS</button>' +
      '<button type="button" data-gps="vezejas" aria-pressed="' + (S.gps.saltinis === 'vezejas') + '">Vežėjo GPS</button></div></div>';
  }

  // Betono laikrodis: 90 min nuo sąlyčio (ord_trans.salytis).
  function laikrodis(centras) {
    var o = S.ord_trans, R0 = 100, C = 2 * Math.PI * R0;
    var praejo = Math.min(90, Math.max(0, (now() - o.salytis) / 60000));
    function arc(m) { return (m / 90) * C; }
    var planM = Math.min(90, (S.planuota_objekte - o.salytis) / 60000);
    var ang = (planM / 90) * 2 * Math.PI - Math.PI / 2;
    var px = 120 + Math.cos(ang) * 100, py = 120 + Math.sin(ang) * 100;
    var px2 = 120 + Math.cos(ang) * 124, py2 = 120 + Math.sin(ang) * 124;
    var na = (praejo / 90) * 2 * Math.PI - Math.PI / 2;
    var nx = 120 + Math.cos(na) * 100, ny = 120 + Math.sin(na) * 100;
    var spalva = praejo >= 80 ? '#E5533D' : '#15171A';
    return '<div class="clock"><svg viewBox="-12 -12 264 264" role="img" aria-label="Betono laikrodis: maišoma ' + Math.round(praejo) + ' min iš 90">' +
      '<circle cx="120" cy="120" r="100" fill="none" stroke="#ECEAE4" stroke-width="20"/>' +
      '<circle cx="120" cy="120" r="100" fill="none" stroke="' + spalva + '" stroke-width="20" stroke-dasharray="' + arc(praejo) + ' ' + C + '" transform="rotate(-90 120 120)"/>' +
      '<rect x="116" y="4" width="8" height="32" fill="#15171A"/>' +
      '<line x1="' + px + '" y1="' + py + '" x2="' + px2 + '" y2="' + py2 + '" stroke="#15171A" stroke-width="4"/>' +
      '<circle cx="' + nx + '" cy="' + ny + '" r="11" fill="#F5C518" stroke="#15171A" stroke-width="3"/>' +
      '</svg><div class="mid">' + centras + '</div></div>' +
      '<div class="muted" style="text-align:center">Riba 90 min · ' + hm(o.salytis + 90 * 60000) + ' · Objekte ' + hm(S.planuota_objekte) + '</div>';
  }

  /* ---------- Ekranai ---------- */
  var E = {};

  E.pasirinkimas = function () {
    var h = '<section class="scr"><div class="card"><span class="kick">Testas · SMS vietoje</span><h1>Pasirinkite reisą</h1>' +
      '<span class="muted">Tikrame naudojime vairuotojas gauna SMS su nuoroda. Čia nuorodos pakeičia SMS.</span></div>';
    Object.keys(REISAI).forEach(function (k) {
      var r = REISAI[k], st = ls('bp-reisas-' + k);
      var bus = st ? (st.pateikta ? 'Pateikta ' + hm(st.pateikta) : 'Pradėta') : 'Naujas';
      h += '<a class="sms" href="?r=' + k + '"><span class="kick"><span>SMS · JNB ' + k + '</span><span>' + esc(bus) + '</span></span>' +
        '<b>' + esc(r.ord.adresas) + '</b><span class="muted">' + r.ord_trans.kiekis + ' m³ ' + esc(r.ord_trans.product) + ' · ' + esc(r.ord_trans.cars) +
        (r.kitas_reisas ? '' : ' · be kito reiso') + '</span></a>';
    });
    $main.innerHTML = h + '</section>';
  };

  E.patvirtinimas = function () {
    var o = S.ord_trans;
    return juosta() +
      '<div class="card"><span class="kick">SMS gautas · ' + hm(S.atidaryta) + ' · Vairuotojas</span><h1 style="font-size:1.25rem">Patikrinkite savo duomenis</h1>' +
      '<div class="fld"><label for="f-driver">Vardas, pavardė</label><input id="f-driver" name="driver" autocomplete="name" value="' + esc(o.driver) + '"></div>' +
      '<div class="fld"><label for="f-tel">Telefonas</label><input id="f-tel" name="driver_tel" type="tel" autocomplete="tel" class="mono" value="' + esc(o.driver_tel) + '"></div>' +
      '<div class="fld"><label for="f-transp">Įmonė</label><input id="f-transp" name="transp" autocomplete="organization" value="' + esc(o.transp) + '"></div></div>' +
      '<div class="note" role="note">' + svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>') +
      '<span><b>Spauskite mygtukus atsakingai</b> – tik tada, kai iš tikrųjų atvykstate, pradedate ir baigiate iškrauti. Šiuos laikus mato klientas.</span></div>' +
      '<div class="card"><div class="truck">' + svg('<path d="M2 7h11v9H2zM13 10h4l4 4v2h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>', 'ico') +
      '<div><b>' + esc(R.ord_trans.cars) + '</b><span class="muted">Reisas JNB ' + o.id + ' · ' + esc(R.ord.nr) + '</span></div></div>' +
      '<div class="grid2"><div><span>Objektas</span><b>' + esc(R.ord.adresas) + '</b></div><div><span>Betonas</span><b>' + R.ord_trans.kiekis + ' m³ ' + esc(R.ord_trans.product.split(' ')[0]) + '</b></div>' +
      '<div><span>Pakrauta</span><b>' + hm(o.pakrovimas) + '</b></div><div><span>Planuota objekte</span><b>' + hm(S.planuota_objekte) + '</b></div></div></div>' +
      '<div class="grow"></div>' + didelisMygtukas('btn-accept', 'DUOMENYS TEISINGI', 'Patvirtinu.<br>Reisą priimu.') +
      '<button type="button" class="btn btn-l" id="btn-notmine">' + svg('<path d="M6 6l12 12M18 6L6 18"/>') + 'Ne, tai ne mano reisas</button>';
  };

  E.kelyje = function () {
    var o = S.ord_trans;
    var eta = Math.max(now(), o.isvyko + R.kelione_min * 60000);
    var velu = Math.round((eta - S.planuota_objekte) / 60000);
    var centras = '<small>ATVYKSITE</small><b>' + hm(eta) + '</b><span>' + (velu > 2 ? 'Vėluojate ' + velu + ' min' : 'Planuota ' + hm(S.planuota_objekte) + ' · spėsite') + '</span>';
    return juosta() +
      '<div class="card"><span class="kick">Betono laikrodis · JNB ' + o.id + '</span>' + laikrodis(centras) +
      (velu > 2 ? '<div class="late">' + svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>') + '<span><b>Eismas lėtesnis nei planuota.</b> Klientą informuosime už jus.</span></div>' : '') + '</div>' +
      gpsKortele() + '<div class="grow"></div>' + navigacija() +
      didelisMygtukas('btn-atvyko', 'SPAUSKITE ATVYKĘ', 'Atvykau<br>į objektą');
  };

  E.laukia = function () {
    var o = S.ord_trans;
    var m = Math.floor((now() - o.atvyko) / 60000), s = Math.floor((now() - o.atvyko) / 1000) % 60;
    var liko = Math.round(90 - (now() - o.salytis) / 60000);
    return juosta() +
      '<div class="card"><span class="kick">Atvykote pas klientą · ' + hm(o.atvyko) + '</span><h1>Laukiate iškrovimo</h1>' +
      '<div class="big" id="laukia">' + pad(m) + ':' + pad(s) + '</div><div class="muted" style="text-align:center">Laukimas fiksuojamas – tai prastovos įrodymas.</div></div>' +
      '<div class="card"><div class="rows">' +
      '<div class="row"><span>Objektas</span><b>' + esc(R.ord.adresas) + '</b></div>' +
      '<div class="row"><span>Kontaktas</span><b><a href="tel:' + esc(R.ord.tel.replace(/\s/g, '')) + '">' + esc(R.ord.tel) + '</a></b></div>' +
      '<div class="row"><span>Maišoma</span><b>' + Math.round((now() - o.salytis) / 60000) + ' min</b></div>' +
      '<div class="row strong"><span>Iki 90 min ribos</span><b>' + liko + ' min</b></div></div></div>' +
      '<div class="grow"></div>' + didelisMygtukas('btn-pradzia', 'SPAUSKITE PRADĖJĘ PILTI', 'Pradėjau<br>iškrauti') + atsauktiMyg();
  };

  E.iskrauna = function () {
    var o = S.ord_trans;
    var liko = Math.round(90 - (now() - o.salytis) / 60000);
    var centras = '<small>MIN IKI RIBOS</small><b>' + Math.max(0, liko) + '</b><span>Baigti iki ' + hm(o.salytis + 90 * 60000) + '</span>';
    return juosta() +
      '<div class="card"><span class="kick">Iškraunate nuo ' + hm(o.iskrovimo_pradzia) + '</span>' + laikrodis(centras) + '</div>' +
      '<div class="card" style="flex-direction:row;align-items:center;justify-content:space-between"><span><span style="display:block;font-size:.875rem">Km nuo mazgo iki objekto</span><span class="muted">pagal maršrutą, viena kryptis</span></span>' +
      '<span class="km"><button type="button" id="km-" aria-label="Mažiau">−</button><b id="km">' + o.distance + '</b><button type="button" id="km+" aria-label="Daugiau">+</button></span></div>' +
      '<div class="grow"></div>' + didelisMygtukas('btn-pabaiga', 'SPAUSKITE BAIGĘ PILTI', 'Baigiau<br>iškrauti') + atsauktiMyg();
  };

  E.pabaiga = function () {
    var o = S.ord_trans;
    var skirt = mins(S.planuota_objekte, o.atvyko);
    var antr = skirt <= 0 ? 'Reisą atlikote ' + (skirt < 0 ? Math.abs(skirt) + ' min anksčiau' : 'laiku') + '. Ačiū!' : 'Reisas atliktas. Ačiū!';
    return juosta() +
      '<div class="card"><span class="kick">Iškrovimo pabaiga · ' + hm(o.iskrovimo_pabaiga) + '</span><h1>' + esc(antr) + '</h1>' +
      '<span class="muted">Betonas išpiltas per ' + minTxt(mins(o.salytis, o.iskrovimo_pabaiga)) + ' nuo maišymo pradžios.</span></div>' +
      kitasReisas() + '<div class="grow"></div>' +
      didelisMygtukas('btn-isvyko', 'SPAUSKITE IŠVAŽIUODAMI', 'Išvykstu iš objekto') + atsauktiMyg();
  };

  function kitasReisas() {
    if (!R.kitas_reisas) return '<div class="card"><span class="kick">Kitas reisas</span><b>Šiandien daugiau reisų nėra</b><span class="muted">Išvykus pristatymas bus baigtas – grįžti į mazgą nereikia.</span></div>';
    var k = R.kitas_reisas;
    return '<div class="card card-d"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="kick">Jūsų kitas reisas</span><b class="mono" style="font-size:1.5rem;color:#F5C518">' + hm(S.atidaryta + k.laikas_po_min * 60000) + '</b></div>' +
      '<b style="font-family:var(--sriftas-display);font-size:1.1875rem">' + esc(k.ka) + '</b><span style="font-size:.9375rem;color:#C9CDD1">' + esc(k.kur) + '</span></div>';
  }

  E.grizimas = function () {
    var o = S.ord_trans;
    var eta = o.isvyko_obj + R.kelione_min * 60000;
    return juosta() +
      '<div class="card"><span class="kick">Išvykote iš kliento · ' + hm(o.isvyko_obj) + '</span><h1>Grįžtate į betono mazgą</h1></div>' +
      '<div class="card"><div class="rows"><div class="row"><span>Mazgas</span><b>' + esc(R.mazgas.pavadinimas) + '</b></div>' +
      '<div class="row"><span>Iki mazgo</span><b>' + o.distance + ' km</b></div><div class="row strong"><span>Numatomas grįžimas</span><b>' + hm(eta) + '</b></div></div></div>' +
      kitasReisas() + '<div class="grow"></div>' + didelisMygtukas('btn-gryzo', 'SPAUSKITE GRĮŽĘ', 'Grįžau<br>į mazgą') +
      '<button type="button" class="btn btn-o" id="btn-bebaigti">' + svg('<path d="M5 21V4h11l-2 4 2 4H5"/>') + 'Kito reiso nėra – baigti pristatymą</button>' + atsauktiMyg();
  };

  var taisomas = null;
  E.pateikimas = function () {
    var o = S.ord_trans;
    var redaguojami = STATUSAI.filter(function (s) { return s.src === 'vairuotojas' && o[s.f]; });
    if (!taisomas || !o[taisomas]) taisomas = null;
    var h = juosta();
    if (taisomas) {
      var i = STATUSAI.findIndex(function (s) { return s.f === taisomas; });
      var t = o[taisomas], rib = ribos(taisomas);
      h += '<div class="card"><span class="kick">Taisoma · ' + (i + 1) + ' iš 7' + (S.taisymai[taisomas] ? ' · buvo ' + hm(S.taisymai[taisomas].buvo) : '') + '</span>' +
        '<h1 style="font-size:1.25rem">' + esc(STATUSAI[i].t) + '</h1><div class="big">' + hm(t) + '</div>' +
        '<div class="pm">' + [-5, -1, 1, 5].map(function (d) {
          var nt = t + d * 60000, ok = nt >= rib[0] && nt <= rib[1];
          return '<button type="button" data-pm="' + d + '"' + (ok ? '' : ' disabled') + '>' + (d > 0 ? '+' : '−') + Math.abs(d) + '</button>';
        }).join('') + '</div>' +
        '<span class="muted" style="text-align:center">minutės · tarp ' + hm(rib[0]) + ' ir ' + hm(rib[1]) + '</span>' +
        '<div class="act2"><button type="button" id="ed-cancel">Atšaukti</button><button type="button" id="ed-save">Išsaugoti laiką</button></div></div>';
    } else {
      h += '<div class="card"><span class="kick">Reisas JNB ' + o.id + ' · ' + esc(R.ord_trans.cars) + '</span><h1>Patikrinkite laikus ir pateikite pasirašyti</h1>' +
        '<span class="muted">Paspauskite savo laiką, jei reikia pataisyti.</span></div>';
    }
    h += '<div class="card"><div class="tl">';
    STATUSAI.forEach(function (s, i) {
      var v = o[s.f], n = '<span class="n">' + (i + 1) + '</span>';
      if (s.src === 'betonpro') {
        h += '<div class="it bp"><span>' + n + esc(s.t) + '</span><b>' + hm(v) + '</b><span aria-label="BetonPro laikas, taisyti negalima">' + svg('<rect x="5" y="11" width="14" height="10"/><path d="M8 11V7a4 4 0 018 0v4"/>', 'ico') + '</span></div>';
      } else if (v) {
        var tais = S.taisymai[s.f];
        h += '<button type="button" class="it" data-edit="' + s.f + '" aria-pressed="' + (taisomas === s.f) + '"><span>' + n + esc(s.t) + '</span><b>' + (tais ? '<s>' + hm(tais.buvo) + '</s>' : '') + hm(v) + '</b>' +
          svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 'ico') + '</button>';
      } else {
        h += '<div class="it fut"><span>' + n + esc(s.t) + '</span><b>' + (s.optional && S.pristatymas_baigtas_be_grizimo ? 'nebuvo' : '—') + '</b><span></span></div>';
      }
    });
    h += '</div></div><div class="grow"></div>';
    var n = Object.keys(S.taisymai).length;
    h += '<button type="button" class="btn btn-y pulse" id="btn-pateikti" style="min-height:72px"><span><span class="s">PASKUTINIS ŽINGSNIS' + (n ? ' · ' + n + ' PATAISYTA' : '') + '</span><span class="b" style="font-size:1.5rem">Pateikti pasirašyti</span></span><span class="arr" aria-hidden="true">→</span></button>';
    return h;
  };
  function ribos(f) {
    var o = S.ord_trans, i = STATUSAI.findIndex(function (s) { return s.f === f; });
    var min = 0, max = now();
    for (var a = i - 1; a >= 0; a--) if (o[STATUSAI[a].f]) { min = o[STATUSAI[a].f]; break; }
    for (var b = i + 1; b < STATUSAI.length; b++) if (o[STATUSAI[b].f]) { max = o[STATUSAI[b].f]; break; }
    return [min, max];
  }

  E.pateikta = function () {
    var s = S.siuntimas || {};
    var kam = CFG.ataskaitaKam;
    var h = juosta();
    if (s.busena === 'siunciama') h += '<div class="card"><span class="kick">Siunčiama</span><h1>Siunčiame ataskaitą…</h1></div>';
    else if (s.busena === 'issiusta') h += '<div class="ok">' + svg('<path d="M4 12.5l5 5L20 6.5"/>') + '<span><b>Pateikta pasirašyti ' + hm(S.pateikta) + '.</b><br>Ataskaita išsiųsta į ' + esc(kam) + '.</span></div>';
    else h += '<div class="ok">' + svg('<path d="M4 12.5l5 5L20 6.5"/>') + '<span><b>Pateikta pasirašyti ' + hm(S.pateikta) + '.</b></span></div>' +
      (s.busena === 'klaida' ? '<div class="err">Ataskaitos nepavyko išsiųsti automatiškai' + (s.klaida ? ' (' + esc(s.klaida) + ')' : '') + '. Išsiųskite el. paštu žemiau.</div>' :
        '<div class="err" style="background:#FFF8D9;color:#15171A">Automatinis siuntimas dar neprijungtas (config.js → endpoint). Išsiųskite el. paštu žemiau.</div>');
    if (s.busena !== 'issiusta') {
      h += '<a class="btn btn-k" href="' + mailto() + '">' + svg('<path d="M3 5h18v14H3z"/><path d="M3 6l9 7 9-7"/>') + 'Siųsti į ' + esc(kam) + '</a>';
      if (CFG.endpoint) h += '<button type="button" class="btn btn-o" id="btn-retry">Bandyti siųsti dar kartą</button>';
    }
    h += '<div class="card" style="padding:10px"><span class="kick" style="padding:0 6px 6px">Ataskaitos peržiūra</span><div class="prev">' + ataskaitaHtml() + '</div></div>' +
      '<a class="btn btn-o" href="?">Kiti testiniai reisai</a>';
    return h;
  };

  /* ---------- Ataskaita ---------- */
  function ataskaitaDuomenys() {
    var o = S.ord_trans;
    var eil = STATUSAI.map(function (s) {
      return { laukas: s.f, statusas: s.t, laikas: sqlDt(o[s.f]), saltinis: s.src, taisyta_is: S.taisymai[s.f] ? sqlDt(S.taisymai[s.f].buvo) : null,
        gps: S.gps.taskai[s.f] || null, nebuvo: !o[s.f] && s.optional && S.pristatymas_baigtas_be_grizimo };
    });
    return {
      versija: 'vairuotojo-forma-test-1', client_uuid: S.client_uuid, pateikta: sqlDt(S.pateikta),
      // bet_<pad>_ord_trans laukai, kuriuos forma keičia
      ord_trans: {
        id: o.id, o_id: o.o_id, status: 3, salytis: sqlDt(o.salytis), pakrovimas: sqlDt(o.pakrovimas), isvyko: sqlDt(o.isvyko), atvyko: sqlDt(o.atvyko),
        iskrovimo_pradzia: sqlDt(o.iskrovimo_pradzia), iskrovimo_pabaiga: sqlDt(o.iskrovimo_pabaiga), isvyko_obj: sqlDt(o.isvyko_obj), gryzo: sqlDt(o.gryzo),
        distance: o.distance, driver: o.driver, driver_tel: o.driver_tel, transp: o.transp, driver_accepted: o.driver_accepted, phone_confirmed: o.phone_confirmed,
        cars: R.ord_trans.cars, cars_id: R.ord_trans.cars_id, driver_id: R.ord_trans.driver_id, transp_id: R.ord_trans.transp_id, kiekis: R.ord_trans.kiekis, product: R.ord_trans.product
      },
      ord: R.ord,
      statusai: eil,
      rodikliai: rodikliai(),
      gps_saltinis: S.gps.saltinis,
      pristatymas_baigtas_be_grizimo: S.pristatymas_baigtas_be_grizimo,
      istorija: S.istorija.map(function (x) { return { kada: sqlDt(x.kada), laukas: x.laukas, reiksme: x.reiksme, veiksmas: x.veiksmas, saltinis: 'SMS Tracker' }; })
    };
  }
  function rodikliai() {
    var o = S.ord_trans;
    var amzius = mins(o.salytis, o.iskrovimo_pabaiga);
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

  // El. laiškui tinkamas HTML: lentelės, tik įterpti stiliai.
  function ataskaitaHtml() {
    var o = S.ord_trans, r = rodikliai();
    var F = 'font-family:Arial,Helvetica,sans-serif;';
    var td = 'style="' + F + 'padding:8px 10px;border-bottom:1px solid #E4E1D9;font-size:14px;color:#15171A;vertical-align:top"';
    var tdl = 'style="' + F + 'padding:8px 10px;border-bottom:1px solid #E4E1D9;font-size:13px;color:#5A5F66;width:42%;vertical-align:top"';
    var th = 'style="' + F + 'padding:8px 10px;background:#ECEAE4;font-size:12px;color:#4A4F55;text-align:left;text-transform:uppercase;letter-spacing:.04em"';
    function kv(k, v) { return '<tr><td ' + tdl + '>' + esc(k) + '</td><td ' + td + '>' + v + '</td></tr>'; }
    var h = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:680px;margin:0 auto;background:#FFFFFF;border:1px solid #D9D6CE">' +
      '<tr><td style="background:#15171A;padding:18px 22px"><span style="' + F + 'font-size:20px;font-weight:bold;color:#FAF9F6">BetonPro</span> <span style="' + F + 'font-size:13px;font-weight:bold;color:#FAF9F6;border:1px solid #FAF9F6;padding:2px 6px;letter-spacing:.06em">HUB</span>' +
      '<div style="' + F + 'font-size:12px;color:#A9AEB4;margin-top:6px;letter-spacing:.06em">BETONO PRISTATYMO ATASKAITA</div></td></tr>' +
      '<tr><td style="background:#F5C518;height:6px;line-height:6px;font-size:0">&nbsp;</td></tr>' +
      '<tr><td style="padding:20px 22px 6px"><div style="' + F + 'font-size:22px;font-weight:bold;color:#15171A">' + esc(R.ord.adresas) + '</div>' +
      '<div style="' + F + 'font-size:14px;color:#4A4F55;margin-top:4px">' + dt(o.pakrovimas) + ' · Užsakymas ' + esc(R.ord.nr) + ' · Reisas JNB ' + o.id + '</div></td></tr>' +
      '<tr><td style="padding:12px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
      kv('Klientas', esc(R.ord.gavejas)) + kv('Objektas', esc(R.ord.adresas)) +
      kv('Betonas', '<b>' + R.ord_trans.kiekis + ' m³</b> · ' + esc(R.ord_trans.product)) +
      kv('Betonvežis', esc(R.ord_trans.cars)) +
      kv('Vairuotojas', esc(o.driver) + ' · ' + esc(o.driver_tel)) + kv('Vežėjas', esc(o.transp)) +
      kv('Betono mazgas', esc(R.mazgas.pavadinimas)) + '</table></td></tr>' +
      '<tr><td style="padding:8px 22px 4px"><div style="' + F + 'font-size:15px;font-weight:bold;color:#15171A">Pristatymo laikai</div></td></tr>' +
      '<tr><td style="padding:4px 22px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
      '<tr><th ' + th + '>#</th><th ' + th + '>Statusas</th><th ' + th + '>Laikas</th><th ' + th + '>Šaltinis</th></tr>';
    STATUSAI.forEach(function (s, i) {
      var v = o[s.f], tais = S.taisymai[s.f], g = S.gps.taskai[s.f];
      var laikas = v ? '<b>' + hm(v) + '</b>' : (s.optional && S.pristatymas_baigtas_be_grizimo ? 'netaikoma' : '—');
      var src = s.src === 'betonpro' ? 'BetonPro (mazgas)' : (v ? 'Vairuotojas' : '—');
      if (tais) src += '<br><span style="color:#8A6D00">pataisyta, buvo ' + hm(tais.buvo) + '</span>';
      if (g) src += '<br><a href="https://www.google.com/maps?q=' + g.lat + ',' + g.lon + '" style="color:#4A4F55">vieta ±' + g.acc + ' m</a>';
      h += '<tr><td ' + td + '>' + (i + 1) + '</td><td ' + td + '>' + esc(s.t) + '</td><td ' + td + '>' + laikas + '</td><td ' + td + ' >' + src + '</td></tr>';
    });
    h += '</table></td></tr>' +
      '<tr><td style="padding:8px 22px 4px"><div style="' + F + 'font-size:15px;font-weight:bold;color:#15171A">Rodikliai</div></td></tr>' +
      '<tr><td style="padding:4px 22px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
      kv('Kelionė iki objekto', minTxt(r.kelione_iki_objekto_min)) +
      kv('Atvykimas pagal planą (' + hm(S.planuota_objekte) + ')', r.atvykimas_pries_plana_min == null ? '—' : (r.atvykimas_pries_plana_min >= 0 ? r.atvykimas_pries_plana_min + ' min anksčiau' : Math.abs(r.atvykimas_pries_plana_min) + ' min vėliau')) +
      kv('Laukimas objekte iki iškrovimo', minTxt(r.laukimas_objekte_min)) +
      kv('Iškrovimo trukmė', minTxt(r.iskrovimas_min)) +
      kv('Betono amžius iškrovimo pabaigoje', minTxt(r.betono_amzius_iskrovus_min) + (r.riba_90_min_islaikyta == null ? '' : r.riba_90_min_islaikyta ? ' · <b style="color:#2C7A5B">90 min riba išlaikyta</b>' : ' · <b style="color:#B3261E">viršyta 90 min riba</b>')) +
      kv('Atstumas mazgas–objektas', o.distance + ' km') +
      kv('Reiso ciklas', minTxt(r.reiso_ciklas_min) + (S.pristatymas_baigtas_be_grizimo ? ' (iki išvykimo iš objekto)' : '')) +
      '</table></td></tr>' +
      '<tr><td style="padding:12px 22px 20px;border-top:1px solid #E4E1D9"><div style="' + F + 'font-size:12px;line-height:1.5;color:#5A5F66">' +
      'Laikus pateikė vairuotojas ' + esc(o.driver) + ' ' + (S.pateikta ? dt(S.pateikta) + ' ' + hm(S.pateikta) : '') + '. Pasikrovimo ir išvykimo laikai – iš betono mazgo sistemos BetonPro. ' +
      'Vietos šaltinis: ' + (S.gps.saltinis === 'vezejas' ? 'vežėjo GPS' : (Object.keys(S.gps.taskai).length ? 'vairuotojo telefono GPS' : 'nenaudota')) + '.<br>' +
      'Ataskaita sugeneruota automatiškai BetonPro HUB · testinė aplinka.</div></td></tr></table>';
    return h;
  }
  function ataskaitaTekstas() {
    var o = S.ord_trans, r = rodikliai();
    var t = 'BETONO PRISTATYMO ATASKAITA · BetonPro HUB\n\n' + R.ord.adresas + '\n' + dt(o.pakrovimas) + ' · Užsakymas ' + R.ord.nr + ' · Reisas JNB ' + o.id + '\n\n' +
      'Klientas: ' + R.ord.gavejas + '\nBetonas: ' + R.ord_trans.kiekis + ' m³ ' + R.ord_trans.product + '\nBetonvežis: ' + R.ord_trans.cars + '\nVairuotojas: ' + o.driver + ', ' + o.driver_tel + '\nVežėjas: ' + o.transp + '\n\nPRISTATYMO LAIKAI\n';
    STATUSAI.forEach(function (s, i) {
      var tais = S.taisymai[s.f];
      t += (i + 1) + '. ' + s.t + ': ' + (o[s.f] ? hm(o[s.f]) : (s.optional && S.pristatymas_baigtas_be_grizimo ? 'netaikoma' : '—')) + ' (' + (s.src === 'betonpro' ? 'BetonPro' : 'vairuotojas') + (tais ? ', pataisyta, buvo ' + hm(tais.buvo) : '') + ')\n';
    });
    t += '\nRODIKLIAI\nKelionė iki objekto: ' + minTxt(r.kelione_iki_objekto_min) + '\nLaukimas objekte: ' + minTxt(r.laukimas_objekte_min) + '\nIškrovimas: ' + minTxt(r.iskrovimas_min) +
      '\nBetono amžius iškrovus: ' + minTxt(r.betono_amzius_iskrovus_min) + (r.riba_90_min_islaikyta ? ' (90 min riba išlaikyta)' : r.riba_90_min_islaikyta === false ? ' (viršyta 90 min riba)' : '') +
      '\nAtstumas: ' + o.distance + ' km\n\nAtaskaita sugeneruota automatiškai BetonPro HUB · testinė aplinka.';
    return t;
  }
  function tema() { return 'Betono pristatymo ataskaita · ' + R.ord.adresas + ' · ' + dt(S.ord_trans.pakrovimas) + ' · JNB ' + S.ord_trans.id; }
  function mailto() { return 'mailto:' + encodeURIComponent(CFG.ataskaitaKam || '') + '?subject=' + encodeURIComponent(tema()) + '&body=' + encodeURIComponent(ataskaitaTekstas()); }

  function siusti() {
    if (!CFG.endpoint) { S.siuntimas = { busena: 'nenustatyta' }; save(); render(); return; }
    S.siuntimas = { busena: 'siunciama' }; save(); render();
    var body = { action: 'reiso_ataskaita', raktas: CFG.raktas, kam: CFG.ataskaitaKam, tema: tema(), html: ataskaitaHtml(), tekstas: ataskaitaTekstas(), duomenys: ataskaitaDuomenys() };
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var tm = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    fetch(CFG.endpoint, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (j) { clearTimeout(tm); if (!j || !j.ok) throw new Error((j && j.error) || 'atsakymas be ok'); S.siuntimas = { busena: 'issiusta', kada: now() }; save(); render(); })
      .catch(function (e) { clearTimeout(tm); S.siuntimas = { busena: 'klaida', klaida: String(e.message || e).slice(0, 80) }; save(); render(); });
  }

  /* ---------- Atvaizdavimas ---------- */
  var tick = null;
  function render() {
    if (!R) { E.pasirinkimas(); return; }
    var ekr = S.pateikta ? 'pateikta' : S.ekranas;
    $main.innerHTML = '<section class="scr">' + E[ekr]() + '</section>' +
      '<div class="reset"><button type="button" id="btn-reset">Testas: pradėti šį reisą iš naujo</button></div>';
    bind();
    clearInterval(tick);
    if (ekr === 'laukia') tick = setInterval(function () { var el = document.getElementById('laukia'); if (!el) return; var d = Math.floor((now() - S.ord_trans.atvyko) / 1000); el.textContent = pad(Math.floor(d / 60)) + ':' + pad(d % 60); }, 1000);
    else if (ekr === 'kelyje' || ekr === 'iskrauna') tick = setInterval(function () { if (!document.activeElement || document.activeElement === document.body) render(); }, 30000);
  }
  function on(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
  function bind() {
    on('btn-reset', function () { if (confirm('Pradėti šį testinį reisą iš naujo?')) { ls(KEY, null); start(); } });
    on('btn-accept', function () {
      var o = S.ord_trans;
      ['driver', 'driver_tel', 'transp'].forEach(function (k) {
        var v = document.querySelector('[name="' + k + '"]').value.trim();
        if (v !== o[k]) log(k, null, 'pakeista: ' + v);
        o[k] = v;
      });
      if (!o.driver || !o.driver_tel) { toast('Įveskite vardą ir telefoną.'); return; }
      o.driver_accepted = 1; o.phone_confirmed = 1; log('driver_accepted', now(), 'patvirtinta');
      S.ekranas = 'kelyje'; save(); render(); window.scrollTo(0, 0);
    });
    on('btn-notmine', function () { toast('Dispečeriui pranešta, kad reisas ne jūsų (teste – nesiunčiama).', null, null, 5000); log('driver_accepted', null, 'ne mano reisas'); save(); });
    on('btn-atvyko', function () { irasyti('atvyko'); S.ekranas = 'laukia'; save(); render(); });
    on('btn-pradzia', function () { irasyti('iskrovimo_pradzia'); S.ekranas = 'iskrauna'; save(); render(); });
    on('btn-pabaiga', function () { S.ord_trans.status = 3; irasyti('iskrovimo_pabaiga'); S.ekranas = 'pabaiga'; save(); render(); });
    on('btn-isvyko', function () {
      irasyti('isvyko_obj');
      if (!R.kitas_reisas) { S.pristatymas_baigtas_be_grizimo = true; S.ekranas = 'pateikimas'; } else S.ekranas = 'grizimas';
      save(); render();
    });
    on('btn-gryzo', function () { irasyti('gryzo'); S.ekranas = 'pateikimas'; save(); render(); });
    on('btn-bebaigti', function () { S.pristatymas_baigtas_be_grizimo = true; log('gryzo', null, 'pristatymas baigtas be grįžimo'); S.ekranas = 'pateikimas'; save(); render(); });
    on('btn-undo', function () { atsaukti(); });
    on('km-', function () { S.ord_trans.distance = Math.max(0, S.ord_trans.distance - 1); save(); document.getElementById('km').textContent = S.ord_trans.distance; });
    on('km+', function () { S.ord_trans.distance += 1; save(); document.getElementById('km').textContent = S.ord_trans.distance; });
    Array.prototype.forEach.call(document.querySelectorAll('[data-gps]'), function (b) {
      b.addEventListener('click', function () {
        S.gps.saltinis = b.getAttribute('data-gps'); save();
        if (S.gps.saltinis === 'telefonas') gpsStart();
        render();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-edit]'), function (b) {
      b.addEventListener('click', function () { var f = b.getAttribute('data-edit'); taisomas = f; S._buvo = S.ord_trans[f]; render(); window.scrollTo(0, 0); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-pm]'), function (b) {
      b.addEventListener('click', function () { S.ord_trans[taisomas] += +b.getAttribute('data-pm') * 60000; render(); });
    });
    on('ed-cancel', function () { if (S._buvo) S.ord_trans[taisomas] = S._buvo; taisomas = null; render(); });
    on('ed-save', function () {
      var f = taisomas, buvo = S._buvo, tapo = S.ord_trans[f];
      if (buvo !== tapo) {
        var orig = S.taisymai[f] ? S.taisymai[f].buvo : buvo;
        if (orig === tapo) delete S.taisymai[f]; else S.taisymai[f] = { buvo: orig, tapo: tapo, kada: now() };
        log(f, tapo, 'pataisyta');
      }
      taisomas = null; delete S._buvo; save(); render(); toast('Laikas išsaugotas.');
    });
    on('btn-pateikti', function () {
      if (taisomas) { toast('Pirma išsaugokite arba atšaukite taisomą laiką.'); return; }
      S.pateikta = now(); log('pateikta', S.pateikta, 'pateikta pasirašyti'); save(); render(); window.scrollTo(0, 0); siusti();
    });
    on('btn-retry', siusti);
  }

  function start() {
    R = REISAI[rid] || null;
    if (!R) { render(); return; }
    KEY = 'bp-reisas-' + rid;
    S = ls(KEY);
    if (!S || !S.ord_trans) { S = naujaBusena(R); save(); }
    if (S.gps.ijungta && S.gps.saltinis === 'telefonas') gpsStart();
    document.title = 'BetonPro · Reisas JNB ' + rid;
    render();
  }
  start();
})();
