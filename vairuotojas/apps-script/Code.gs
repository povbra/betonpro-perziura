/**
 * BetonPro · Vairuotojo reiso forma (testas) – ataskaitos siuntimas el. paštu.
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
var GAVEJAI = ['pbraduls@gmail.com'];

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.action !== 'reiso_ataskaita') return out_({ ok: false, error: 'nežinomas veiksmas' });
    var raktas = PropertiesService.getScriptProperties().getProperty('RAKTAS');
    if (raktas && d.raktas !== raktas) return out_({ ok: false, error: 'neteisingas raktas' });
    var kam = String(d.kam || '').trim().toLowerCase();
    if (GAVEJAI.indexOf(kam) < 0) return out_({ ok: false, error: 'gavėjas neleidžiamas' });

    var json = JSON.stringify(d.duomenys || {}, null, 2);
    var failas = 'reisas_' + ((d.duomenys && d.duomenys.ord_trans && d.duomenys.ord_trans.id) || 'x') + '.json';
    MailApp.sendEmail({
      to: kam,
      subject: String(d.tema || 'Betono pristatymo ataskaita').slice(0, 200),
      body: String(d.tekstas || ''),
      htmlBody: String(d.html || ''),
      name: 'BetonPro HUB',
      attachments: [Utilities.newBlob(json, 'application/json', failas)]
    });
    // Žurnalas (neprivaloma): paskutinės 200 ataskaitų Script Properties nesaugomos – tik Logger.
    console.log('Ataskaita išsiųsta: ' + failas);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() { return out_({ ok: true, info: 'BetonPro vairuotojo formos ataskaitų siuntimas' }); }

function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
