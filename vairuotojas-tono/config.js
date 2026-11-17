// Vairuotojo reiso forma · testinė versija.
// endpoint – Google Apps Script žiniatinklio programos adresas (Deploy → Web app → URL, baigiasi /exec).
// Kol endpoint tuščias, ataskaita parodoma ekrane ir siūloma išsiųsti per el. pašto programėlę.
window.BP_REISAS = {
  endpoint: '',
  ataskaitaKam: 'pbraduls@gmail.com',
  // Tas pats raktas įrašomas Apps Script nustatymuose (Script Properties → RAKTAS).
  raktas: 'bp-test-2026',
  // Vairuotojo pranešimai apie kokybę, komentarai ir nuotraukos. Testui – pbraduls@gmail.com, gamyboje – uzsakymai@c3betonas.lt.
  operatoriui: 'pbraduls@gmail.com'
};
