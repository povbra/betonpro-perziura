// Paraiškos forma: validacija, siuntimas, būsenos (specs/08-tinklapis/spec.md, duomenys.md).
// Tekstai ateina iš šablono data-* atributų (lt.json), todėl šiame faile jų nėra.
(function () {
  'use strict';

  // SVG (SMIL) animacijų CSS neišjungia, todėl sumažinto judesio režime jos stabdomos čia.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('svg').forEach(function (s) { s.pauseAnimations(); });
  }

  var forma = document.querySelector('#bandymas form');
  if (!forma) return;

  var LAIKAS_MS = 10000;
  var JSON_I_LAUKA = { m3_per_metus: 'm3', dabar_naudoja: 'dabar', vairuotoju_telefonai: 'vairuotojai', sutikimas_dts: 'dts' };
  var T = forma.dataset;
  var mygtukas = forma.querySelector('button[type="submit"]');
  var mygtukoTekstas = mygtukas.textContent;
  var serverioKlaida = forma.querySelector('.forma-klaida');
  var sekme = forma.parentNode.querySelector('.forma-sekme');
  var siunciama = false;

  forma.noValidate = true; // Be JS veikia naršyklės required tikrinimas.

  function reiksme(vardas) { return forma.elements[vardas].value.trim(); }

  function patikrinti() {
    var k = {};
    var imone = reiksme('imone');
    var vardas = reiksme('vardas');
    var tel = reiksme('tel');
    var email = reiksme('email');
    var mazgai = reiksme('mazgai');
    var m3 = reiksme('m3').replace(/\s/g, '');

    if (imone.length < 2 || imone.length > 120) k.imone = T.klaidaImone;
    if (vardas.length < 2 || vardas.length > 80) k.vardas = T.klaidaVardas;
    if (!/^[\d+ ]{6,20}$/.test(tel)) k.tel = T.klaidaTel;
    if (!email) k.email = T.klaidaEmailTuscias;
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) k.email = T.klaidaEmail;
    if (forma.elements.mazgai.validity.badInput || (mazgai && !(/^\d+$/.test(mazgai) && +mazgai >= 1 && +mazgai <= 50))) k.mazgai = T.klaidaMazgai;
    if (m3 && !(/^\d+$/.test(m3) && +m3 <= 2000000)) k.m3 = T.klaidaM3;
    if (!forma.elements.dts.checked) k.dts = T.klaidaDts;
    return k;
  }

  function valytiLauka(el) {
    var vieta = document.getElementById('klaida-' + el.name);
    if (!vieta) return;
    el.removeAttribute('aria-invalid');
    el.removeAttribute('aria-describedby');
    vieta.textContent = '';
    vieta.hidden = true;
  }

  function laukai() {
    return Array.prototype.filter.call(forma.elements, function (el) { return el.name; });
  }

  // Rodo klaidas prie laukų; fokusas – į pirmą klaidingą lauką formos eilės tvarka.
  function rodytiKlaidas(klaidos) {
    var pirmas = null;
    laukai().forEach(function (el) {
      valytiLauka(el);
      if (!klaidos[el.name]) return;
      var vieta = document.getElementById('klaida-' + el.name);
      vieta.textContent = klaidos[el.name];
      vieta.hidden = false;
      el.setAttribute('aria-invalid', 'true');
      el.setAttribute('aria-describedby', vieta.id);
      pirmas = pirmas || el;
    });
    if (pirmas) pirmas.focus();
    return !!pirmas;
  }

  function dabarIso() {
    var d = new Date();
    var p = function (n) { return String(Math.floor(Math.abs(n))).padStart(2, '0'); };
    var o = -d.getTimezoneOffset();
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
      'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) +
      (o < 0 ? '-' : '+') + p(o / 60) + ':' + p(o % 60);
  }

  function saltinis() {
    var utm = location.search.slice(1).split('&').filter(function (p) { return /^utm_[^=]*=/.test(p); });
    return location.pathname + (utm.length ? '?' + utm.join('&') : '');
  }

  function duomenys() {
    var mazgai = reiksme('mazgai');
    var m3 = reiksme('m3').replace(/\s/g, '');
    return {
      imone: reiksme('imone'),
      salis: reiksme('salis'),
      vardas: reiksme('vardas'),
      tel: reiksme('tel'),
      email: reiksme('email'),
      mazgai: mazgai ? parseInt(mazgai, 10) : null,
      m3_per_metus: m3 ? parseInt(m3, 10) : null,
      betonveziai: reiksme('betonveziai'),
      dabar_naudoja: reiksme('dabar'),
      vairuotoju_telefonai: reiksme('vairuotojai'),
      sutikimas_dts: forma.elements.dts.checked,
      kalba: document.documentElement.lang,
      saltinis: saltinis(),
      pateikta: dabarIso(),
    };
  }

  function busenaSiunciama(taip) {
    siunciama = taip;
    mygtukas.disabled = taip;
    if (taip) mygtukas.setAttribute('aria-busy', 'true');
    else mygtukas.removeAttribute('aria-busy');
    mygtukas.textContent = taip ? T.siunciama : mygtukoTekstas;
  }

  function rodytiServerioKlaida() {
    serverioKlaida.textContent = T.klaidaServerio;
    serverioKlaida.hidden = false;
  }

  function rodytiSekme() {
    forma.hidden = true;
    sekme.hidden = false;
    sekme.focus();
  }

  // Iš 4xx atsakymo paima { laukai: { "<json raktas>": "<klaida>" } }; jei tokių nėra – null.
  function serverioLaukai(ats) {
    return ats.json().then(function (d) {
      if (!d || !d.laukai) return null;
      var k = {};
      Object.keys(d.laukai).forEach(function (r) { k[JSON_I_LAUKA[r] || r] = d.laukai[r]; });
      return k;
    }).catch(function () { return null; });
  }

  // Formų tarpininkas gali atsakyti 200 su { success: false } (pvz., adresas dar neaktyvuotas).
  function priimta(ats) {
    return ats.json().then(function (d) {
      return !(d && (d.success === false || d.success === 'false'));
    }).catch(function () { return true; });
  }

  function siusti() {
    var valdiklis = new AbortController();
    var laikmatis = setTimeout(function () { valdiklis.abort(); }, LAIKAS_MS);
    busenaSiunciama(true);

    var adresas = forma.getAttribute('action');
    // Google Apps Script neatsako į CORS išankstinę užklausą, todėl jam tas pats JSON siunčiamas kaip text/plain.
    var tipas = adresas.indexOf('https://script.google.com/') === 0 ? 'text/plain;charset=utf-8' : 'application/json';

    fetch(adresas, {
      method: 'POST',
      headers: { 'Content-Type': tipas, Accept: 'application/json' },
      body: JSON.stringify(duomenys()),
      signal: valdiklis.signal,
    }).then(function (ats) {
      if (ats.ok) return priimta(ats).then(function (taip) { if (taip) rodytiSekme(); else rodytiServerioKlaida(); });
      var galiButiLaukai = ats.status >= 400 && ats.status < 500;
      return (galiButiLaukai ? serverioLaukai(ats) : Promise.resolve(null)).then(function (klaidos) {
        if (!klaidos || !rodytiKlaidas(klaidos)) rodytiServerioKlaida();
      });
    }).catch(rodytiServerioKlaida).then(function () {
      clearTimeout(laikmatis);
      busenaSiunciama(false);
    });
  }

  forma.addEventListener('submit', function (e) {
    e.preventDefault();
    if (siunciama) return;
    serverioKlaida.hidden = true;
    if (!rodytiKlaidas(patikrinti())) siusti();
  });

  function pakeistas(e) {
    if (e.target.getAttribute('aria-invalid') === 'true') valytiLauka(e.target);
  }
  forma.addEventListener('input', pakeistas);
  forma.addEventListener('change', pakeistas);
})();
