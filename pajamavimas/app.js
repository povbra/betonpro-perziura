// Medžiagų pajamavimas su AI · testinė forma (be BetonPro HUB).
// Nuotrauka → QR paieška → Google Apps Script (Claude) → patikrinimas → pateikimas el. paštu.
// Be ryšio: duomenys IndexedDB eilėje; Android – Background Sync (sw.js), visur – „online“ įvykis ir atidarius iš naujo.
(function () {
  'use strict';

  var CFG = window.PAJAM_AI || {};
  var ENDPOINT = CFG.endpoint || '';
  var DICT = window.PAJAM_I18N;
  var MAX_FOTO = 3;
  var ILGOJI = 2000;
  var LAIKAS_ATPAZINTI = 40000;
  var LAIKAS_PATEIKTI = 90000;
  var KEY_ROWS = ['supplier', 'waybill_no', 'doc_date', 'material', 'net_kg', 'vehicle_plate'];

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var st = {
    k: new URLSearchParams(location.search).get('k') || '',
    lang: 'lt', mazgas: '', uuid: '', photos: [], qr: [], ai: null, res: null,
    fields: {}, items: [], edited: {}, geo: null, offlineLater: false, manualNote: false,
    screen: '', submitting: false, waiting: false, nr: '', submittedAt: null,
  };

  // ---------------------------------------------------------------- Pagalbinės
  function ls(k, v) {
    try {
      if (v === undefined) return localStorage.getItem(k);
      if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v);
    } catch (e) { return null; }
  }
  function t(key, p) {
    var s = (DICT[st.lang] && DICT[st.lang][key]) || DICT.lt[key] || key;
    return s.replace(/\{(\w+)\}/g, function (_, k) { return p && p[k] !== undefined ? p[k] : ''; });
  }
  function kg(n) { return n === null || n === undefined || n === '' || isNaN(n) ? '–' : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function newUuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }
  function os() {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    return 'ios';   // iPhone ir kiti – be Background Sync
  }
  function nowIso() {
    var d = new Date(), p = function (n) { return String(Math.floor(Math.abs(n))).padStart(2, '0'); }, o = -d.getTimezoneOffset();
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + (o < 0 ? '-' : '+') + p(o / 60) + ':' + p(o % 60);
  }
  function unitText(u) { return { t: 't', kg: 'kg', m3: 'm³', l: 'l', vnt: 'vnt.', ibc: 'IBC' }[u] || ''; }

  function post(body, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms);
    // Google Apps Script neatsako į CORS išankstinę užklausą – JSON siunčiamas kaip text/plain.
    return fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctrl.signal })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .finally(function () { clearTimeout(timer); });
  }
  function get(params, ms) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, ms || 15000);
    return fetch(ENDPOINT + '?' + new URLSearchParams(params).toString(), { signal: ctrl.signal })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .finally(function () { clearTimeout(timer); });
  }

  // ---------------------------------------------------------------- IndexedDB eilė
  var DB = null;
  function db() {
    if (DB) return DB;
    DB = new Promise(function (res, rej) {
      var r = indexedDB.open('pajamavimas_ai', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('outbox', { keyPath: 'client_uuid' }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return DB;
  }
  function idb(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction('outbox', mode); var out = fn(tx.objectStore('outbox'));
        tx.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  var queue = {
    put: function (item) { return idb('readwrite', function (s) { return s.put(item); }); },
    del: function (id) { return idb('readwrite', function (s) { return s.delete(id); }); },
    all: function () { return idb('readonly', function (s) { return s.getAll(); }); },
  };

  // ---------------------------------------------------------------- Kalba, A+
  function applyI18n() {
    document.documentElement.lang = st.lang;
    $$('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
    $('[data-testid="lang-switch"]').value = st.lang;
    if (st.screen) render(st.screen);
  }
  function setAplus(on) {
    document.documentElement.classList.toggle('aplus', on);
    $('[data-testid="btn-aplus"]').setAttribute('aria-pressed', on ? 'true' : 'false');
    ls('pajam_ai_aplus', on ? '1' : null);
  }

  // ---------------------------------------------------------------- Ekranai
  function show(id) {
    st.screen = id;
    $$('.scr').forEach(function (s) { s.hidden = s.id !== id; });
    render(id);
    window.scrollTo(0, 0);
  }
  function render(id) {
    if (id === 's01') render01();
    if (id === 's03') render03();
    if (id === 's04') render04();
    if (id === 's05') render05();
    if (id === 's06') render06();
  }
  function banners() {
    var o = st.waiting ? os() : '';
    $('[data-testid="offline-banner-android"]').hidden = !(o === 'android' || (st.offlineLater && os() === 'android'));
    $('[data-testid="offline-banner-ios"]').hidden = !(o === 'ios' || (st.offlineLater && os() === 'ios'));
  }
  function sentBanner(nr) {
    var b = $('[data-testid="sent-banner"]');
    b.textContent = t('sent', { nr: nr });
    b.hidden = false;
    clearTimeout(sentBanner.t);
    sentBanner.t = setTimeout(function () { b.hidden = true; }, 15000);
  }

  function render01() {
    $('[data-testid="plant-name"]').textContent = st.mazgas;
    var car = ls('pajam_ai_auto');
    $('#car').hidden = !car || !$('#car-edit').hidden;
    $('#car-plate').textContent = (car || '').replace('/', ' · ');
  }

  function fieldRow(key, label, value, sub, flagText, edited) {
    var flag = !!flagText && !edited;
    var right = flag ? '<span class="badge" data-testid="flag-' + key + '">' + esc(t('flag_check')) + '</span>'
      : value ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>' : '';
    var subs = [sub, flag ? flagText : '', edited ? t('edited') : ''].filter(Boolean).join('. ');
    return '<div class="it' + (flag ? ' flag' : '') + '"><div class="it-t"><span class="it-l">' + esc(label) + '</span>' +
      '<b class="it-v" data-testid="field-' + key + '">' + esc(value || '–') + '</b>' +
      (subs ? '<span class="it-s">' + esc(subs) + '</span>' : '') + '</div>' + right + '</div>';
  }
  function flagFor(field, line) {
    var out = [];
    ((st.res && st.res.zymos) || []).forEach(function (z) {
      if (z.field !== field || (line !== undefined && (z.line_no || 1) !== line)) return;
      var s = t('flag_' + z.code);
      if (out.indexOf(s) < 0) out.push(s);
    });
    return out.join('. ');
  }

  function render03() {
    var r = st.res || {};
    var kick = st.photos.length === 0 ? t('kicker_manual')
      : r.data_source === 'qr_json' ? t('kicker_qr', { n: st.photos.length })
      : r.trukme_s ? t('kicker_check', { s: r.trukme_s, n: st.photos.length }) : t('kicker_manual');
    $('#s03-kick').textContent = kick;

    var th = st.photos.map(function (p) { return '<img src="' + p.url + '" alt="" data-testid="photo-thumb">'; }).join('');
    if (st.photos.length < MAX_FOTO && !st.waiting) th += '<button type="button" data-testid="btn-add-photo" aria-label="' + esc(t('add_photo')) + '">+</button>';
    $('#thumbs').innerHTML = th;

    // Bendros pastabos (nuotrauka, gavėjas)
    var notes = ((r.problemos) || []).filter(function (p) { return DICT.lt['problem_' + p]; }).map(function (p) { return t('problem_' + p); });
    ((r.zymos) || []).forEach(function (z) { if (z.code === 'kitas_gavejas') notes.push(t('flag_kitas_gavejas') + '.'); });
    var note = $('#s03-note');
    if (!note) { note = document.createElement('p'); note.className = 'note'; note.id = 's03-note'; $('#fields').insertAdjacentElement('beforebegin', note); }
    note.textContent = notes.join(' ');
    note.hidden = !notes.length;

    var f = st.fields, e = st.edited, html = '';
    var supSub = f.sender_code ? t('code', { code: f.sender_code }) : '';
    html += fieldRow('supplier', t('f_supplier'), f.supplier, supSub, flagFor('supplier'), e.supplier);
    html += fieldRow('waybill_no', t('f_waybill_short'), [f.waybill_no, f.doc_date].filter(Boolean).join(' · '), '',
      flagFor('waybill_no') || flagFor('doc_date'), e.waybill_no || e.doc_date);
    st.items.forEach(function (it, i) {
      var n = i + 1, sfx = n > 1 ? '-' + n : '', lab = st.items.length > 1 ? ' · ' + t('line', { n: n }) : '';
      var ai = (st.ai && st.ai.prekes && st.ai.prekes[i]) || {};
      var ed = e['net_kg' + (n > 1 ? '_' + n : '')];
      var main = !ed && ai.quantity_text && unitText(ai.unit) ? ai.quantity_text + ' ' + unitText(ai.unit) : kg(it.net_kg) + ' kg';
      var sub = [];
      if (!ed && ai.quantity_text && ai.unit !== 'kg' && it.net_kg) sub.push(kg(it.net_kg) + ' kg');
      if (!ed && ai.gross_kg && ai.tare_kg) sub.push(t('gross_tare', { g: kg(ai.gross_kg), t: kg(ai.tare_kg) }));
      html += fieldRow('material' + sfx, t('f_material') + lab, it.material_text, '', flagFor('material', n), e['material' + (n > 1 ? '_' + n : '')]);
      html += fieldRow('net_kg' + sfx, t('f_net_short') + lab, main, sub.join(' · '), flagFor('net_kg', n), ed);
    });
    html += fieldRow('vehicle_plate', t('f_vehicle'), [f.vehicle_plate, f.trailer_plate].filter(Boolean).join(' · '), '', '', e.vehicle_plate || e.trailer_plate);
    html += fieldRow('carrier_name', t('f_carrier'), f.carrier_name, '', '', e.carrier_name);
    $('#fields').innerHTML = html;

    var b = $('[data-testid="btn-submit"]');
    b.disabled = st.submitting || st.waiting;
    b.textContent = st.waiting ? t('waiting') : t('btn_submit');
    $('[data-testid="btn-edit"]').hidden = st.waiting;
    banners();
  }

  function input(key, label, value, opts) {
    opts = opts || {};
    return '<label class="fld' + (opts.flag ? ' flag' : '') + '" data-key="' + key + '"><span>' + esc(label) + '</span>' +
      '<input data-testid="input-' + key + '" name="' + key + '" value="' + esc(value === null || value === undefined ? '' : value) + '"' +
      (opts.type ? ' type="' + opts.type + '"' : '') + (opts.mode ? ' inputmode="' + opts.mode + '"' : '') +
      (opts.caps ? ' autocapitalize="characters"' : '') + ' autocomplete="off">' +
      (opts.note ? '<small>' + esc(opts.note) + '</small>' : '') + '<span class="err-t" hidden></span></label>';
  }

  function render04() {
    var f = st.fields, html = '';
    var note = st.offlineLater ? t('offline_later') : st.manualNote ? t('manual_note') : '';
    $('#s04-note').textContent = note;
    $('#s04-note').hidden = !note;
    html += input('supplier', t('f_supplier'), f.supplier, { flag: !!flagFor('supplier') && !st.edited.supplier });
    html += input('waybill_no', t('f_waybill'), f.waybill_no, { flag: !!flagFor('waybill_no') && !st.edited.waybill_no, caps: true });
    html += input('doc_date', t('f_date'), f.doc_date || '', { type: 'date', flag: !!flagFor('doc_date') });
    var items = st.items.length ? st.items : [{ material_text: '', net_kg: null }];
    items.forEach(function (it, i) {
      var n = i + 1, sfx = n > 1 ? '-' + n : '';
      var ai = (st.ai && st.ai.prekes && st.ai.prekes[i]) || {};
      if (items.length > 1) html += '<div class="line-h">' + esc(t('line', { n: n })) + '</div>';
      html += input('material' + sfx, t('f_material'), it.material_text, { flag: !!flagFor('material', n) });
      var fl = !!flagFor('net_kg', n);
      html += input('net_kg' + sfx, t('f_net'), it.net_kg === null || it.net_kg === undefined ? '' : String(it.net_kg), {
        mode: 'numeric', flag: fl,
        note: fl && ai.quantity_text ? t('on_waybill', { q: ai.quantity_text + ' ' + unitText(ai.unit) }) : '',
      });
    });
    html += input('vehicle_plate', t('f_truck'), f.vehicle_plate, { caps: true });
    html += input('trailer_plate', t('f_trailer'), f.trailer_plate, { caps: true });
    html += input('carrier_name', t('f_carrier'), f.carrier_name);
    $('#form').innerHTML = html;
    $('#s04-back').hidden = !st.photos.length;
    banners();
  }

  function render05() {
    var d = st.submittedAt || new Date();
    $('#s05-kick').textContent = t('kicker_done', { time: ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2), nr: st.nr });
    var it = st.items[0] || {};
    var sum = st.items.reduce(function (s, x) { return s + (Number(x.net_kg) || 0); }, 0);
    var lead = [it.material_text, sum ? kg(sum) + ' kg' : ''].filter(Boolean).join(' · ');
    $('#s05-text').textContent = (lead ? lead + '. ' : '') + t('text_done');
    banners();
  }

  function render06() {
    var r = st.res || {};
    var found = foundKeys();
    $('#s06-kick').textContent = t('kicker_failed', { n: found.length, m: KEY_ROWS.length });
    var probs = (r.problemos || []).filter(function (p) { return DICT.lt['problem_' + p]; }).map(function (p) { return t('problem_' + p); });
    $('#s06-text').textContent = probs.concat([t('text_failed')]).join(' ');
    var img = $('#s06-img');
    if (st.photos[0]) { img.src = st.photos[0].url; img.hidden = false; } else img.hidden = true;
    var names = { supplier: 'f_supplier', waybill_no: 'f_waybill', doc_date: 'f_date', material: 'f_material', net_kg: 'f_net_short', vehicle_plate: 'f_truck' };
    var list = function (keys) {
      return keys.map(function (k, i) { var s = t(names[k]); return i ? s.charAt(0).toLowerCase() + s.slice(1) : s; }).join(', ') || '–';
    };
    var missing = KEY_ROWS.filter(function (k) { return found.indexOf(k) < 0; });
    $('#s06-list').innerHTML =
      '<div class="it"><div class="it-t"><span class="it-l">' + esc(t('found')) + '</span><b class="it-v">' + esc(list(found)) + '</b></div>' +
      (found.length ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5"/></svg>' : '') + '</div>' +
      '<div class="it flag"><div class="it-t"><span class="it-l">' + esc(t('missing')) + '</span><b class="it-v">' + esc(list(missing)) + '</b></div><span class="badge">' + esc(t('flag_check')) + '</span></div>';
    banners();
  }

  function foundKeys() {
    var f = st.fields, it = st.items[0] || {};
    var v = { supplier: f.supplier || f.sender_code, waybill_no: f.waybill_no, doc_date: f.doc_date, material: it.material_text, net_kg: it.net_kg, vehicle_plate: f.vehicle_plate };
    return KEY_ROWS.filter(function (k) { return !!v[k]; });
  }

  // ---------------------------------------------------------------- Nuotraukos ir QR
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { res(img); };
      img.onerror = rej;
      img.src = url;
    });
  }
  function prepare(file) {
    var src = window.createImageBitmap ? createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () { return loadImage(file); }) : loadImage(file);
    return src.then(function (img) {
      var w = img.width, h = img.height, s = Math.min(1, ILGOJI / Math.max(w, h));
      var c = document.createElement('canvas');
      c.width = Math.round(w * s); c.height = Math.round(h * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return scanQr(c).then(function (codes) {
        return new Promise(function (res) {
          c.toBlob(function (blob) {
            var fr = new FileReader();
            fr.onload = function () { res({ b64: String(fr.result).split(',')[1], url: URL.createObjectURL(blob), qr: codes }); };
            fr.readAsDataURL(blob);
          }, 'image/jpeg', 0.85);
        });
      });
    });
  }
  function scanQr(canvas) {
    var viaJsQr = function () {
      try {
        if (!window.jsQR) return [];
        var d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        var r = window.jsQR(d.data, d.width, d.height, { inversionAttempts: 'dontInvert' });
        return r && r.data ? [r.data] : [];
      } catch (e) { return []; }
    };
    if ('BarcodeDetector' in window) {
      try {
        return new window.BarcodeDetector({ formats: ['qr_code'] }).detect(canvas)
          .then(function (list) { var a = list.map(function (b) { return b.rawValue; }).filter(Boolean); return a.length ? a : viaJsQr(); })
          .catch(viaJsQr);
      } catch (e) { /* toliau jsQR */ }
    }
    return Promise.resolve(viaJsQr());
  }

  function locate() {
    if (st.geo || !navigator.geolocation) return;
    try {
      navigator.geolocation.getCurrentPosition(function (p) { st.geo = { lat: p.coords.latitude, lng: p.coords.longitude }; }, function () {}, { timeout: 8000, maximumAge: 120000 });
    } catch (e) { /* be vietos */ }
  }

  // ---------------------------------------------------------------- Atpažinimas
  function fromResult(r) {
    st.res = r;
    st.ai = r.laukai ? { laukai: r.laukai, prekes: r.prekes || [] } : null;
    var l = r.laukai || {};
    var car = (ls('pajam_ai_auto') || '').split('/');
    st.fields = {
      supplier: l.supplier || '', sender_code: l.sender_code || '', waybill_no: l.waybill_no || '', doc_date: l.doc_date || '',
      carrier_name: l.carrier_name || '', vehicle_plate: l.vehicle_plate || car[0] || '', trailer_plate: l.trailer_plate || car[1] || '',
    };
    st.items = (r.prekes || []).map(function (p) { return { material_text: p.material_text || '', net_kg: p.net_kg }; });
    st.edited = {};
  }

  function recognize() {
    show('s02');
    st.offlineLater = false; st.manualNote = false;
    var body = { veiksmas: 'atpazinti', k: st.k, client_uuid: st.uuid, nuotraukos: st.photos.map(function (p) { return p.b64; }), qr: st.qr };
    if (st.geo) { body.lat = st.geo.lat; body.lng = st.geo.lng; }
    post(body, LAIKAS_ATPAZINTI).then(function (r) {
      if (!r.ok && (r.kodas === 410)) return show('s-expired');
      if (!r.ok) { fromResult({}); st.manualNote = true; return show('s04'); }     // riba, serverio klaida
      fromResult(r);
      if (r.ai_state === 'manual') { st.manualNote = true; return show('s04'); }
      if (r.ai_state === 'failed' || foundKeys().length < 4) return show('s06');
      show('s03');
    }).catch(function () {
      // Nėra ryšio arba neatsakė laiku
      fromResult({});
      if (!navigator.onLine) { st.offlineLater = true; return show('s04'); }
      show('s06');
    });
  }

  function addPhoto(file) {
    show('s02');
    prepare(file).then(function (p) {
      st.photos.push(p);
      p.qr.forEach(function (q) { if (st.qr.indexOf(q) < 0) st.qr.push(q); });
      recognize();
    }).catch(function () { show(st.photos.length ? 's03' : 's01'); });
  }

  // ---------------------------------------------------------------- Taisymas
  function readForm() {
    var v = function (k) { var el = $('#form [name="' + k + '"]'); return el ? el.value.trim() : ''; };
    var ok = true;
    var need = !(st.offlineLater && st.photos.length);
    var fields = {
      supplier: v('supplier'), sender_code: st.fields.sender_code || '', waybill_no: v('waybill_no').toUpperCase(), doc_date: v('doc_date'),
      vehicle_plate: v('vehicle_plate').replace(/[^A-Za-z0-9]/g, '').toUpperCase(), trailer_plate: v('trailer_plate').replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
      carrier_name: v('carrier_name'),
    };
    var items = $$('#form [name^="material"]').map(function (el, i) {
      var sfx = i ? '-' + (i + 1) : '';
      var raw = v('net_kg' + sfx).replace(/\s/g, '').replace(',', '.');
      return { material_text: el.value.trim(), net_kg: raw === '' ? null : Math.round(Number(raw)) };
    });
    $$('#form .fld').forEach(function (l) { l.classList.remove('err'); l.querySelector('.err-t').hidden = true; });
    var err = function (key) {
      var l = $('#form .fld[data-key="' + key + '"]'); if (!l) return;
      l.classList.add('err'); var e = l.querySelector('.err-t'); e.textContent = t('required'); e.hidden = false;
      if (ok) l.querySelector('input').focus();
      ok = false;
    };
    if (need) {
      if (!fields.supplier) err('supplier');
      if (!fields.waybill_no) err('waybill_no');
      items.forEach(function (it, i) {
        var sfx = i ? '-' + (i + 1) : '';
        if (!it.material_text) err('material' + sfx);
        if (!(it.net_kg > 0)) err('net_kg' + sfx);
      });
    }
    return ok ? { fields: fields, items: items } : null;
  }

  function computeEdited() {
    var e = {};
    if (!st.ai) return e;
    var l = st.ai.laukai;
    ['supplier', 'waybill_no', 'doc_date', 'vehicle_plate', 'trailer_plate', 'carrier_name'].forEach(function (k) {
      if (String(st.fields[k] || '') !== String(l[k] || '')) e[k] = { ai: l[k] || '', vairuotojas: st.fields[k] || '' };
    });
    st.items.forEach(function (it, i) {
      var a = st.ai.prekes[i] || {}, s = i ? '_' + (i + 1) : '';
      if (it.net_kg !== (a.net_kg === undefined ? null : a.net_kg)) e['net_kg' + s] = { ai: a.net_kg, vairuotojas: it.net_kg };
      if (it.material_text !== (a.material_text || '')) e['material' + s] = { ai: a.material_text || '', vairuotojas: it.material_text };
    });
    return e;
  }

  // ---------------------------------------------------------------- Pateikimas ir eilė
  function payload() {
    var p = {
      veiksmas: 'pateikti', k: st.k, client_uuid: st.uuid, laukai: st.fields, prekes: st.items, keista: st.edited,
      nuotraukos: st.photos.map(function (x) { return x.b64; }), qr: st.qr, sukurta: nowIso(),
      endpoint: ENDPOINT,
    };
    if (st.geo) { p.lat = st.geo.lat; p.lng = st.geo.lng; }
    return p;
  }

  function submit() {
    if (st.submitting || st.waiting) return;
    st.submitting = true;
    render03();
    var p = payload();
    ls('pajam_ai_auto', [st.fields.vehicle_plate, st.fields.trailer_plate].filter(Boolean).join('/') || null);
    var toQueue = function () {
      return queue.put(p).catch(function () { /* IndexedDB neprieinama */ }).then(function () {
        st.waiting = true;
        st.submitting = false;
        render03();
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then(function (reg) { if (reg.sync) return reg.sync.register('pajamavimas-outbox'); }).catch(function () {});
        }
      });
    };
    if (!navigator.onLine) return toQueue();
    post(p, LAIKAS_PATEIKTI).then(function (r) {
      st.submitting = false;
      if (!r.ok) {
        if (r.kodas === 410) return show('s-expired');
        throw new Error('server');
      }
      done(r.nr);
    }).catch(function () {
      st.submitting = false;
      toQueue();
    });
  }

  function done(nr) {
    st.nr = nr;
    st.waiting = false;
    st.submittedAt = new Date();
    show('s05');
  }

  var flushing = false;
  function flush() {
    if (flushing || !navigator.onLine || !ENDPOINT) return Promise.resolve();
    flushing = true;
    return queue.all().then(function (items) {
      return items.reduce(function (pr, it) {
        return pr.then(function () {
          return post(it, LAIKAS_PATEIKTI).then(function (r) {
            if (!r.ok && r.kodas !== 410) return;
            return queue.del(it.client_uuid).then(function () {
              if (!r.ok) return;
              sentBanner(r.nr);
              if (it.client_uuid === st.uuid && st.waiting) done(r.nr);
            });
          }).catch(function () { /* bandysime vėliau */ });
        });
      }, Promise.resolve());
    }).catch(function () {}).then(function () { flushing = false; });
  }

  function reset() {
    st.uuid = newUuid();
    $('[data-testid="form-root"]').setAttribute('data-client-uuid', st.uuid);
    st.photos.forEach(function (p) { try { URL.revokeObjectURL(p.url); } catch (e) {} });
    st.photos = []; st.qr = []; st.ai = null; st.res = null; st.fields = {}; st.items = []; st.edited = {};
    st.offlineLater = false; st.manualNote = false; st.waiting = false; st.submitting = false; st.nr = '';
    banners();
    show('s01');
  }

  // ---------------------------------------------------------------- Įvykiai
  function bind() {
    var fileInput = $('[data-testid="photo-input"]');
    var openCamera = function () { locate(); fileInput.value = ''; fileInput.click(); };
    $('[data-testid="btn-photo"]').addEventListener('click', openCamera);
    fileInput.addEventListener('change', function () { if (fileInput.files && fileInput.files[0]) addPhoto(fileInput.files[0]); });
    $('#thumbs').addEventListener('click', function (e) { if (e.target.closest('[data-testid="btn-add-photo"]')) openCamera(); });
    $('[data-testid="btn-manual"]').addEventListener('click', function () { locate(); fromResult({}); show('s04'); });
    $('[data-testid="btn-manual-missing"]').addEventListener('click', function () { show('s04'); });
    $('#s06-retake').addEventListener('click', function () {
      st.photos = []; st.qr = []; openCamera();
    });
    $('[data-testid="btn-edit"]').addEventListener('click', function () { show('s04'); });
    $('#s04-back').addEventListener('click', function () { show(st.res && st.res.ai_state === 'failed' ? 's06' : 's03'); });
    $('[data-testid="btn-save"]').addEventListener('click', function () {
      var r = readForm(); if (!r) return;
      st.fields = r.fields; st.items = r.items; st.edited = computeEdited();
      show('s03');
    });
    $('[data-testid="btn-submit"]').addEventListener('click', submit);
    $('#s05-next').addEventListener('click', reset);
    $('#car-change').addEventListener('click', function () {
      $('#car').hidden = true; $('#car-edit').hidden = false;
      $('#car-input').value = (ls('pajam_ai_auto') || '').replace('/', ' / '); $('#car-input').focus();
    });
    $('#car-save').addEventListener('click', function () {
      var parts = $('#car-input').value.split('/').map(function (s) { return s.replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }).filter(Boolean);
      ls('pajam_ai_auto', parts.length ? parts.join('/') : null);
      $('#car-edit').hidden = true; render01();
    });
    $('[data-testid="lang-switch"]').addEventListener('change', function (e) { st.lang = e.target.value; ls('pajam_ai_lang', st.lang); applyI18n(); });
    $('[data-testid="btn-aplus"]').addEventListener('click', function () { setAplus(!document.documentElement.classList.contains('aplus')); });
    window.addEventListener('online', function () { flush(); });
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', function (e) {
        var d = e.data || {};
        if (d.type === 'sent') { sentBanner(d.nr); if (d.client_uuid === st.uuid && st.waiting) done(d.nr); }
      });
    }
  }

  // ---------------------------------------------------------------- Pradžia
  function start() {
    var saved = ls('pajam_ai_lang');
    var nav = (navigator.language || 'lt').slice(0, 2);
    st.lang = DICT[saved] ? saved : (DICT[nav] ? nav : 'lt');
    setAplus(ls('pajam_ai_aplus') === '1');
    bind();
    applyI18n();
    st.uuid = newUuid();
    $('[data-testid="form-root"]').setAttribute('data-client-uuid', st.uuid);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(function () {});

    if (!st.k || !ENDPOINT) return show('s-expired');
    get({ veiksmas: 'info', k: st.k }).then(function (r) {
      if (!r.ok) { ls('pajam_ai_mazgas_' + st.k, null); return show('s-expired'); }
      st.mazgas = r.mazgas;
      ls('pajam_ai_mazgas_' + st.k, r.mazgas);
      show('s01');
      flush();
    }).catch(function () {
      var m = ls('pajam_ai_mazgas_' + st.k);
      if (!m) return show('s-expired');
      st.mazgas = m;
      show('s01');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
