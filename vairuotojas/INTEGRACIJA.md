# Vairuotojo reiso forma – integracija į BetonPro HUB

Testinė versija: `vairuotojas/` (GitHub Pages). Pakeičia `go.php?mod=transp&act=valdymas` (šablonas `BetonProHub/templates/valdymas.html`).
Visi laukų pavadinimai sutampa su BetonPro DB (atkurta schema, 2026-11-03). Tikrus tipus patikrinti `SHOW CREATE TABLE`.

## 1. Statusai → `bet_<pad>_ord_trans`

| # | Statusas | Laukas | Kas įrašo | Formos veiksmas |
|---|---|---|---|---|
| – | W/C sąlytis (vandens ir cemento sąlytis, 90 min laikrodžiui) | `salytis` | BetonPro (mazgas) | tik rodoma |
| 1 | Pasikrovimas | `pakrovimas` | BetonPro (mazgas) | tik rodoma, užrakinta |
| 2 | Išvykimas iš betono mazgo | `isvyko` | BetonPro (mazgas) | tik rodoma, užrakinta |
| 3 | Atvykimas pas klientą | `atvyko` | vairuotojas | „Atvykau į objektą“ |
| 4 | Iškrovimo pradžia | `iskrovimo_pradzia` | vairuotojas | „Pradėjau iškrauti“ |
| 5 | Iškrovimo pabaiga | `iskrovimo_pabaiga` | vairuotojas | „Baigiau iškrauti“ |
| 6 | Išvykimas iš kliento | `isvyko_obj` | vairuotojas | „Išvykstu iš objekto“ |
| 7 | Grįžimas į betono mazgą | `gryzo` | vairuotojas | „Grįžau į mazgą“ – **tik jei betonvežiui priskirtas kitas reisas**. Jei kito reiso nėra, statusas nerodomas, pristatymas baigiamas išvykus iš objekto (`gryzo` = NULL) |
| 8 | Pateikimas pasirašyti | – | vairuotojas | „Pateikti pasirašyti“ → SMS klientui pasirašyti važtaraštį (esama logika) |

### 1a. `ord_trans.status` reikšmės (iš `vairuotojas.php` → `updateOrder`)

| Įvykis | `status` |
|---|---|
| laukia / nepradėta | ≤ 0 arba 5 |
| `isvyko` (išvyko iš mazgo) | 2 |
| `atvyko` | 6 |
| `iskrovimo_pradzia` | lieka 6 |
| `iskrovimo_pabaiga` | 7 |
| `isvyko_obj` | 8 |
| `gryzo` / pristatymas baigtas | 3 |

Dabartinė SMS forma (`transp.php` → `valdymas`) `iskrovimo_pabaiga` metu iš karto nustato `status = 3` ir apskaičiuoja `gryzo = pabaiga + kelionės laikas`. Siūloma naudoti tas pačias reikšmes kaip vairuotojo programėlėje: 6 → 7 → 8 → 3; jei kito reiso nėra, `status = 3` nustatomas po `isvyko_obj` (arba „Pateikti pasirašyti“). Laikai DB saugomi `time` (H:i) formatu, kiekvienas pakeitimas – į istoriją su žyma „(SMS Tracker)“.

Kiti laukai, kuriuos forma keičia: `distance` (km mazgas–objektas, **viena kryptis**, ne ×2), `driver`, `driver_tel`, `transp` (vairuotojo patvirtinti duomenys), `driver_accepted = 1`, `phone_confirmed = 1`.

Pastaba dėl esamos logikos: dabar po iškrovimo pabaigos `isvyko_obj` prilyginamas pabaigai, o `gryzo` apskaičiuojamas. Naujoje formoje abu spaudžia vairuotojas; jei nepaspaudė per X min – galima palikti dabartinį apskaičiavimą kaip atsarginį.

## 2. Ką forma rodo (skaito)

| Ekrane | Šaltinis |
|---|---|
| Reiso Nr. | `ord_trans.id` |
| Betonvežis | `ord_trans.cars` (`cars_id` → `automotive_cars`) |
| Vairuotojas, telefonas | `ord_trans.driver`, `driver_tel` (`driver_id` → `automotive_vairas.vairas`, `tel`) |
| Vežėjas | `ord_trans.transp` (`transp_id` → `automotive_transport.name`) |
| Kiekis, produktas | `ord_trans.kiekis`, `ord_trans.product` |
| Užsakymas, klientas | `ord.nr`, `ord.gavejas` (`gavejas_id` → `bet_cem_clients`) |
| Objektas, navigacija | `ord.adresas`, `ord.latitude`, `ord.longitude` |
| Kontaktas objekte | `ord.kontaktas`, `ord.tel` |
| Planuota objekte | `ord.pristatymo_laikas` / vežimo grafikas |
| Kitas reisas | kitas to paties `cars_id` vežimas pagal `planuojamas_krovimas` |
| Mazgas | padalinys (`sys_sites`) |

## 3. API pasiūlymas (vietoj atviro `id` + `db`)

Dabartinė spraga: išsaugojimas nesusietas su nuorodos žetonu – pakeitus ID galima įrašyti laikus bet kuriam vežimui. Siūloma:

- `GET  go.php?mod=transp&act=reisas&token=<bendras_short_links.token>` → JSON (struktūra kaip `REISAI` objektas `app.js`).
- `POST go.php?mod=transp&act=reisas_statusas` `{ token, laukas, laikas, lat, lon, client_uuid }`
  - `laukas` ∈ `atvyko, iskrovimo_pradzia, iskrovimo_pabaiga, isvyko_obj, gryzo`;
  - serveris tikrina žetoną **įrašant** (ne tik atidarant) ir galiojimą (`expires_at`);
  - eilės tvarka: laikas ≥ ankstesnio statuso, ≤ dabar; idempotentiška pagal `client_uuid` + `laukas`.
- `POST ...&act=reisas_taisymas` `{ token, laukas, laikas, buvo }` – taisyti galima tik dabartinį ir ankstesnius vairuotojo statusus; BetonPro laikų (`pakrovimas`, `isvyko`) – ne.
- `POST ...&act=reisas_pateikti` `{ token, distance, driver, driver_tel, transp }` → `status = 3`, SMS klientui pasirašyti.
- Kiekvienas veiksmas – į užsakymo istoriją su žyma „(SMS Tracker)“ (formoje tai `istorija` masyvas).

## 4. Vieta (telefono GPS)

- Vairuotojas paspaudžia „Įjungti“ → `navigator.geolocation` (tik kol forma atidaryta). Koordinatės pridedamos prie kiekvieno statuso paspaudimo (`lat`, `lon`, `acc`) ir rodomos ataskaitoje kaip nuoroda į žemėlapį. Saugoti `automotive_coord` arba naujoje lentelėje.

## 4a. Statusų juosta

Juoda – įvykę statusai, geltona – dabartinis (paskutinis įvykęs), pilka – laukiantys. Atšaukti galima tik paskutinį vairuotojo statusą (10 s pranešime arba mygtuku). Apsauga nuo dvigubo paspaudimo – 0,6 s.

## 5. Ataskaita

Pateikus – laiškas (HTML lentelės, tinka persiųsti klientui) + JSON priedas `reisas_<id>.json` su tais pačiais laukais. Teste siunčia Google Apps Script (`apps-script/Code.gs`); HUB'e – esamas el. pašto siuntimas.

Rodikliai: kelionė (`atvyko − isvyko`), laukimas objekte / prastova (`iskrovimo_pradzia − atvyko`), iškrovimas, laikas nuo W/C sąlyčio iki iškrovimo pabaigos (`iskrovimo_pabaiga − salytis`, riba 90 min), atvykimas pagal planą, reiso ciklas (`gryzo` arba `isvyko_obj` − `pakrovimas`).


## 6. Betono kokybė → `bet_<pad>_ord_trans`

Pasirinkimai ir tekstai paimti iš BetonPro vairuotojo modulio (`vairuotojas.php`, `lithuanian.json` → `text_vairuotojas_*`).

| Formoje | Laukas | Reikšmė |
|---|---|---|
| Slankumas per didelis / per mažas | `ql_slankumas` | `1` / `-1`, kitaip `0` |
| Blogai atsiskiria vanduo | `ql_vanduo` | `0` (gerai – `1`) |
| Blogai pumpuojamas | `ql_pump` | `0` (gerai – `1`) |
| Pridėta vandens, l | `vanduo` | litrai. Jei `vanduo > 0` ir `vanduo_tvirt` tuščias → esama `send_vanduo_sms` objekto atstovui; vairuotojui rodoma „Vandens užpylimui laukite objekto atstovo patvirtinimo.“ |
| Grąžinta betono, m³ + priežastis | `grazintas_betonas`, `grazinto_betono_priezastis` | kaip akte `conr_excess` |
| Kiekio neatitikimas, Kita, pastaba | `quality_comment` | tekstas |
| Betonvežis išplautas objekte | `apsiplovimas` | `1` / `0` |

`pretenzijos_tipai` (JSON) atitinka `ord_pretenzija` kategorijas: `slankumas`, `vanduo`, `pompa`, `kiekis`, `kita` – jei reikia automatiškai sukurti pretenziją.

## 7. Pranešimas operatoriui (bet kuriame ekrane po atvykimo)

Mygtukas „Pranešti operatoriui apie kokybę“ rodomas nuo `atvyko` iki pateikimo. Lape: kokybės pasirinkimai (6 sk.), komentaras, iki 4 nuotraukų (telefono kamera, sumažinama iki 1600 px JPEG). Pranešimas siunčiamas iš karto:

- HUB'e – esamas `push_it($ccar, "message", ...)` su tekstu „Pranešimas iš vairuotojo apie mišinio kokybės neatitikimą objekte. Auto : {cars}, važtaraščio ID - {id}.“ + el. laiškas `uzsakymai@c3betonas.lt` su nuotraukomis;
- teste – Apps Script veiksmas `operatoriaus_pranesimas` (gavėjas `config.js` → `operatoriui`, testui `pbraduls@gmail.com`); kol `endpoint` tuščias – telefono „Bendrinti“ (su nuotraukomis) arba `mailto:`.

Siūlomas API: `POST ...&act=reisas_pranesimas` `{ token, ql_slankumas, ql_vanduo, ql_pump, vanduo, grazintas_betonas, grazinto_betono_priezastis, komentaras, nuotraukos[] }`. Nuotraukos – prie užsakymo failų (`ord_files` ar pan.). Pranešimai klientui nesiunčiami ir į kliento ataskaitą nepatenka (ataskaitoje – tik kokybės santrauka).
