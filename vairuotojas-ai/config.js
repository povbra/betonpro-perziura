// Vairuotojo reiso forma · testinė versija su AI laikų patikra.
// endpoint – Google Apps Script žiniatinklio programos adresas (Deploy → Web app → URL, baigiasi /exec).
// Kol endpoint tuščias, ataskaita parodoma ekrane ir siūloma išsiųsti per el. pašto programėlę.
// AI raktas čia NERAŠOMAS: testuotojas jį įveda telefone vieną kartą (saugoma tik tame telefone).
window.BP_REISAS = {
  endpoint: '',
  ataskaitaKam: 'pbraduls@gmail.com',
  raktas: 'bp-test-2026',
  operatoriui: 'pbraduls@gmail.com',
  aiModelis: 'claude-haiku-5-5'
};
