// Kjør: node test-maal.mjs
//
// Bevisst uten testrammeverk. Dette repoet skal ikke ha avhengigheter: det er
// det som gjør at det virker når alt annet er nede, og at en lokal modell kan
// kjøre det uten å installere noe.
import assert from 'node:assert/strict'
import { maalTilstand, flettStatus, MALMELDING } from './maal.mjs'
import { validerMelding, MAKS_MELDING_TEGN, tilUtc } from './status.mjs'

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
