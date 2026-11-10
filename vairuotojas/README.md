# Vairuotojo reiso forma · testas telefone

Nuorodos (vietoj SMS):
- https://povbra.github.io/betonpro-perziura/vairuotojas/?r=48213 – Savanorių pr. 12, Kaunas · yra kitas reisas (su grįžimu į mazgą)
- https://povbra.github.io/betonpro-perziura/vairuotojas/?r=48219 – Ukmergės g. 40, Jonava · kito reiso nėra (be grįžimo)
- https://povbra.github.io/betonpro-perziura/vairuotojas/?r=48224 – Ozo g. 25, Vilnius · yra kitas reisas
- https://povbra.github.io/betonpro-perziura/vairuotojas/ – visų testinių reisų sąrašas

Eiga telefone išsaugoma; apačioje „Testas: pradėti šį reisą iš naujo“.

## Ataskaita el. paštu
1. `apps-script/Code.gs` įkelti į script.google.com, Script Properties → `RAKTAS = bp-test-2026`.
2. Deploy → Web app (Execute as: Me, Access: Anyone) → URL įrašyti į `config.js` → `endpoint`.
3. Kol `endpoint` tuščias, po „Pateikti pasirašyti“ rodoma ataskaita ir mygtukas „Siųsti į pbraduls@gmail.com“ (atidaro el. pašto programėlę).

## Pranešimas operatoriui apie kokybę
Nuo „Atvykau į objektą“ kiekviename ekrane yra mygtukas „Pranešti operatoriui apie kokybę“: BetonPro kokybės pasirinkimai, komentaras, iki 4 nuotraukų (kamera). Gavėjas – `config.js` → `operatoriui` (testui pbraduls@gmail.com, gamyboje uzsakymai@c3betonas.lt). Kol `endpoint` tuščias, telefone atidaromas „Bendrinti“ (pasirinkite el. paštą – nuotraukos pridedamos) arba el. pašto programėlė.

Programuotojams: `INTEGRACIJA.md`.
