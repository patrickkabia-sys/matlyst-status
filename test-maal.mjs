// Kjør: node test-maal.mjs
//
// Bevisst uten testrammeverk. Dette repoet skal ikke ha avhengigheter: det er
// det som gjør at det virker når alt annet er nede, og at en lokal modell kan
// kjøre det uten å installere noe.
import assert from 'node:assert/strict'
import { maalTilstand, flettStatus } from './maal.mjs'

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

console.log('alle tester passerte')
