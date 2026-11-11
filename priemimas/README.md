# BetonPro · Užsakymų priėmimas (testinė versija)

Atidarymas: https://povbra.github.io/betonpro-perziura/priemimas/

## Kaip testuoti
1. **Nustatymai ir AI**: įveskite Claude API raktą (console.anthropic.com → API Keys), pasirinkite modelį ir paspauskite „Patikrinti ryšį“. Raktas saugomas tik jūsų naršyklėje, siunčiamas tik į api.anthropic.com.
2. **Užsakymų priėmimas**: atidarykite laišką ir spauskite „[BP] Analizuoti laišką“ (arba „Analizuoti visus“). AI grąžina juodraštį: tipą, užsakymus, trūkstamus duomenis.
3. Patikrinkite, ar teisingai parinktas receptas, laikas, mazgas ir siurblys. Prireikus pataisykite laukus. Receptai siūlomi tik tie, kurių savybės sutampa su kliento prašymu.
4. „Papildoma informacija“: įrašykite, ką klientas sakė telefonu, ir spauskite „Pateikti [BP]“. AI perskaitys laišką iš naujo.
5. Paspauskite „Patvirtinti ir sumodeliuoti dieną“. Užsakymas įtraukiamas į dienos planą, tolesni laiškai jau tikrinami pagal naują apkrovą.
6. **Dienos apkrova**: rodo betonvežių užimtumą, krovimą mazge ir siurblius pagal datą. Fonas yra tikras BetonPro 2026-11-03 planas.
7. „Pradėti testą iš naujo“ išvalo rezultatus. API raktas lieka.

## Duomenys (`data/`)
- `letters.json`: 30 paskutinių laiškų iš uzsakymai@ (2026-11-03 – 11-11) su priedų (Excel) turiniu. Žmonių vardai, telefonai ir el. paštai užkoduoti, privatūs adresai paslėpti.
- `recipes.json` / `recipes.csv`: receptų duomenų bazė iš BetonPro (Runeikiai, Stašėnai, Baisogala, 183 receptai): kodas, pavadinimas, savybės (klasė, X, F, W), slankumas, Dmax, cementas, kainoraštis, savikaina. Tinka ir kitiems testams.
- `baseline-2026-11-03.json`: tikras vienos dienos vežimų planas (95 reisai), naudojamas kaip tipinės dienos fonas.

## Prielaidos
Parkas: Runeikiai 4, Stašėnai 7, Baisogala 12 betonvežių (keičiama nustatymuose). Krovimas 8 min. reisui, mazgo riba 35 m³ per 30 min., reisas ≤ 7 m³. Darbo laikas 06:00–18:00. Klientams niekas nesiunčiama.
