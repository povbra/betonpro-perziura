# Vairuotojo reiso forma – testinė versija su AI laikų patikra

Peržiūra: https://povbra.github.io/betonpro-perziura/vairuotojas-ai/?r=48219 (taip pat `?r=48213`, `?r=48224`).

Ta pati forma kaip `vairuotojas/`, tik prieš „Pateikti pasirašyti“ laikai patikrinami:

1. **Programinės taisyklės** (veikia visada): vienodi laikai, visi mygtukai paspausti per kelias sekundes, iškrovimas < 1 min/m³ arba labai ilgas, kelionė greičiau nei 80 km/h, laikai tvirtinami > 15 min po pabaigos, kai iškrovimas trumpas, „Atvykau“ paspausta > 300 m nuo objekto.
2. **Claude (claude-haiku-5-5)** įvertina laikus pagal kiekį, atstumą, paspaudimų eigą ir taisyklių radinius. Atsakymas – JSON (`busena: gerai|tikrinti`, `pastabos[]`, siūlomas laikas).

Jei viskas gerai – pateikiama iš karto. Jei ne – lapas „Patikrinkite laikus“: „Pataisyti laikus“ arba „Laikai teisingi – pateikti“. Fiziškai neįmanomi dalykai (pvz. 24 km per 2 min) rodomi visada. Jei AI nepasiekiamas (12 s, klaida, neteisingas raktas) – tikrinama taisyklėmis. Rezultatas įrašomas į ataskaitą (eilutė „Laikų patikra“) ir istoriją.

**Raktas.** Šiame repozitorijume rakto nėra (repozitorijus viešas). Testuotojas raktą įveda telefone vieną kartą – jis saugomas tik to telefono naršyklėje (`localStorage['bp-ai-raktas']`) ir siunčiamas tik į `api.anthropic.com`. Apačioje esanti nuoroda „AI raktas“ leidžia jį pakeisti ar pašalinti. Gamyboje Claude kviečia serveris, raktas – serverio `.env` (žr. paketą `vairuotojo-forma-v2.zip`).
