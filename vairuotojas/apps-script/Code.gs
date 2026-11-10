/**
 * BetonPro · Vairuotojo reiso forma (testas) – ataskaitos ir pranešimų operatoriui siuntimas el. paštu.
 *
 * Veiksmai: reiso_ataskaita (po „Pateikti pasirašyti“), operatoriaus_pranesimas (kokybės neatitikimas,
 * komentaras, nuotraukos – bet kada po atvykimo į objektą).
 *
 * Diegimas (vieną kartą):
 * 1. script.google.com → New project → įklijuokite šį failą.
 * 2. Project Settings → Script Properties → pridėkite RAKTAS = bp-test-2026 (tas pats kaip config.js).
 * 3. Deploy → New deployment → Web app: Execute as „Me“, Who has access „Anyone“.
 * 4. Gautą URL (baigiasi /exec) įrašykite į vairuotojas/config.js → endpoint.
 *
 * Laiškas siunčiamas iš jūsų Google paskyros (MailApp). Gavėjai apriboti GAVEJAI sąrašu,
 * kad viešo adreso nebūtų galima panaudoti siųsti kitiems.
 */
var GAVEJAI = ['pbraduls@gmail.com', 'uzsakymai@c3betonas.lt'];

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.action !== 'reiso_ataskaita' && d.action !== 'operatoriaus_pranesimas') return out_({ ok: false, error: 'nežinomas veiksmas' });
    var raktas = PropertiesService.getScriptProperties().getProperty('RAKTAS');
    if (raktas && d.raktas !== raktas) return out_({ ok: false, error: 'neteisingas raktas' });
    var kam = String(d.kam || '').trim().toLowerCase();
    if (GAVEJAI.indexOf(kam) < 0) return out_({ ok: false, error: 'gavėjas neleidžiamas' });

    var id = (d.duomenys && ((d.duomenys.ord_trans && d.duomenys.ord_trans.id) || d.duomenys.ord_trans_id)) || 'x';
    var priedai = [Utilities.newBlob(JSON.stringify(d.duomenys || {}, null, 2), 'application/json', (d.action === 'reiso_ataskaita' ? 'reisas_' : 'pranesimas_') + id + '.json')];
    (d.nuotraukos || []).slice(0, 4).forEach(function (n, i) {
      priedai.push(Utilities.newBlob(Utilities.base64Decode(String(n.base64 || '')), 'image/jpeg', String(n.name || ('nuotrauka_' + (i + 1) + '.jpg'))));
    });
    var laiskas = {
      to: kam,
      subject: String(d.tema || (d.action === 'reiso_ataskaita' ? 'Betono pristatymo ataskaita' : 'Vairuotojo pranešimas')).slice(0, 200),
      body: String(d.tekstas || ''),
      name: 'BetonPro HUB',
      attachments: priedai
    };
    if (d.html) laiskas.htmlBody = String(d.html);
    MailApp.sendEmail(laiskas);
    console.log(d.action + ' išsiųsta: ' + id + ', nuotraukų ' + (priedai.length - 1));
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() { return out_({ ok: true, info: 'BetonPro vairuotojo formos ataskaitų siuntimas' }); }

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
