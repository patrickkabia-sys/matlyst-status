// Kjør: node test-maal.mjs
//
// Bevisst uten testrammeverk. Dette repoet skal ikke ha avhengigheter: det er
// det som gjør at det virker når alt annet er nede, og at en lokal modell kan
// kjøre det uten å installere noe.
import assert from 'node:assert/strict'
import { probe, maalTilstand, flettStatus, MALMELDING } from './maal.mjs'
import { validerMelding, MAKS_MELDING_TEGN, tilUtc } from './status.mjs'

// ── En feilet probe må si HVORFOR ─────────────────────────────────────────
//
// ⚠️ Vakten her er ikke at probe returnerer null. Det gjorde den før også.
// Vakten er at det skrives en linje som forteller hvilken feil det var, for
// det var nettopp fraværet av den linja som gjorde 26 timers falsk nedetid
// 28.08.2026 umulig å diagnostisere uten å endre koden først.
{
  const linjer = []
  const logg = (l) => linjer.push(l)

  const ok = await probe(async () => ({ ok: true, status: 200 }), logg)
  assert.equal(typeof ok, 'number', 'et 200-svar gir svartid')
  assert.equal(linjer.length, 0, 'et vellykket svar logger ingenting')

  const feil = await probe(
    async () => ({ ok: false, status: 401, text: async () => '{"message":"Invalid API key"}' }),
    logg
  )
  assert.equal(feil, null, 'et ikke-ok svar teller som feilet')
  assert.equal(linjer.length, 1, 'et ikke-ok svar logger nøyaktig én linje')
  assert.match(linjer[0], /401/, 'statuskoden står i loggen')
  assert.match(linjer[0], /Invalid API key/, 'kroppen står i loggen')

  linjer.length = 0
  const kastet = await probe(async () => {
    throw Object.assign(new Error('fetch failed'), { name: 'TypeError' })
  }, logg)
  assert.equal(kastet, null)
  assert.equal(linjer.length, 1)
  assert.match(linjer[0], /TypeError: fetch failed/, 'kastet feil navngis i loggen')

  // En kropp som ikke lar seg lese skal ikke ta ned målingen, bare bli notert.
  linjer.length = 0
  await probe(
    async () => ({ ok: false, status: 403, text: async () => { throw new Error('nope') } }),
    logg
  )
  assert.equal(linjer.length, 1)
  assert.match(linjer[0], /403/)

  // Lange kropper avkortes, ellers drukner loggen i en HTML-feilside.
  linjer.length = 0
  await probe(async () => ({ ok: false, status: 503, text: async () => 'x'.repeat(5000) }), logg)
  assert.ok(linjer[0].length < 300, `loggelinja er ${linjer[0].length} tegn, for lang`)
}

// ── Tilstand ut fra prober ────────────────────────────────────────────────
assert.equal(maalTilstand([120, 90, 110]).tilstand, 'oppe')
assert.equal(maalTilstand([null, null, null]).tilstand, 'nede')
assert.equal(maalTilstand([120, null, 90]).tilstand, 'oppe', 'én feil av tre er ikke nede')
assert.equal(maalTilstand([4000, 3500, 5000]).tilstand, 'treg')
assert.equal(maalTilstand([4000, 90, 110]).tilstand, 'oppe', 'én treg av tre er ikke treg')

// ── Ansvarsdelingen: jobben eier tilstanden, mennesket eier kun meldingen ──
const NAA = '2026-08-27T18:00:00Z'
const manuell = {
  tilstand: 'nede',
  siden: '2026-08-27T15:00:00Z',
  melding: 'Tilbake ca. 18:00',
  kilde: 'manuell',
  oppdatert: '2026-08-27T15:30:00Z',
}

const fortsattNede = flettStatus(manuell, { tilstand: 'nede' }, NAA)
assert.equal(fortsattNede.melding, 'Tilbake ca. 18:00', 'menneskets melding beholdes mens det er nede')
assert.equal(fortsattNede.kilde, 'manuell')
assert.equal(fortsattNede.siden, '2026-08-27T15:00:00Z', 'siden nullstilles ikke av en måling')

const oppeIgjen = flettStatus(manuell, { tilstand: 'oppe' }, NAA)
assert.equal(oppeIgjen.tilstand, 'oppe')
assert.equal(oppeIgjen.melding, '', 'en glemt melding rydder seg selv')
assert.equal(oppeIgjen.kilde, 'auto')

// ── Vedlikehold står til det utløper, og utløper av seg selv ──────────────
const vedl = {
  tilstand: 'vedlikehold',
  siden: NAA,
  melding: 'Oppgraderer',
  kilde: 'manuell',
  utloper: '2026-08-27T19:00:00Z',
  oppdatert: NAA,
}
assert.equal(
  flettStatus(vedl, { tilstand: 'oppe' }, '2026-08-27T18:30:00Z').tilstand,
  'vedlikehold',
  'vedlikehold står til utløp'
)
assert.equal(
  flettStatus(vedl, { tilstand: 'oppe' }, '2026-08-27T19:30:00Z').tilstand,
  'oppe',
  'vedlikehold utløper av seg selv'
)

// ── Validering av meldinger fra menneske eller Ollama ─────────────────────
//
// ⚠️ Dette er det viktigste av de tre stedene budsjettet håndheves, for det er
// her det skrives fritt. Blir en melding for lang og slipper gjennom, brekker
// den banneret i appen for alle.
assert.equal(MAKS_MELDING_TEGN, 80)
assert.equal(validerMelding('Tilbake ca. 18:00').feil, null)
assert.equal(validerMelding('  Tilbake ca. 18:00  ').tekst, 'Tilbake ca. 18:00', 'trimmes')
assert.equal(validerMelding('').feil, 'Meldingen kan ikke være tom.')
assert.equal(validerMelding('   ').feil, 'Meldingen kan ikke være tom.')
assert.equal(validerMelding(undefined).feil, 'Meldingen kan ikke være tom.')
assert.match(validerMelding('x'.repeat(81)).feil, /1 tegn for lang/)
assert.match(validerMelding('x'.repeat(95)).feil, /15 tegn for lang/)

// Grunnmeldingen som faktisk brukes må få plass i budsjettet.
for (const [navn, tekst] of Object.entries(MALMELDING)) {
  assert.ok(tekst.length <= MAKS_MELDING_TEGN, `${navn} er ${tekst.length} tegn, over budsjettet`)
}

// ── Utløpstidspunkt tolkes i lokal tid, ikke med hardkodet UTC-forskyvning ─
const middag = new Date('2026-08-27T12:00:00')
assert.ok(tilUtc('19:00', middag) > middag.toISOString(), 'senere i dag')
assert.ok(tilUtc('09:00', middag) > middag.toISOString(), 'passert klokkeslett ruller til i morgen')
assert.equal(tilUtc('25:00'), null, 'ugyldig time avvises')
assert.equal(tilUtc('19:70'), null, 'ugyldig minutt avvises')
assert.equal(tilUtc('1900'), null, 'feil format avvises')
assert.equal(tilUtc(undefined), null)

console.log('alle tester passerte')
