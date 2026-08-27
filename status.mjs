#!/usr/bin/env node
// Menneskelig overstyring av statusmeldingen.
//
// ⚠️ Denne skal virke UTEN Claude og uten tokens. Den kjøres av Patrick i
// terminalen eller av en lokal modell i Ollama. Derfor: tre kommandoer, ingen
// flagg å huske, og all validering skjer her i stedet for hos den som skriver.
// En 7B-modell skal kunne velge riktig kommando og skrive én setning uten å
// kunne ødelegge noe.
//
//   node status.mjs ned "Tilbake ca. 18:00, vi holder på nå"
//   node status.mjs opp
//   node status.mjs vedlikehold "Oppgraderer databasen" --til 19:00
//   node status.mjs vis
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { MALMELDING } from './maal.mjs'

/**
 * ⚠️ Speiler MAKS_MELDING_TEGN i lib/nedetidMeldinger.ts i matlyst-repoet.
 * Utledningen fra layoutverdiene står der. Endres den ene, må den andre følge
 * etter, ellers slipper en melding gjennom her som brekker banneret i appen.
 */
export const MAKS_MELDING_TEGN = 80

export function validerMelding(tekst) {
  const t = typeof tekst === 'string' ? tekst.trim() : ''
  if (!t) return { feil: 'Meldingen kan ikke være tom.' }
  if (t.length > MAKS_MELDING_TEGN) {
    return {
      feil: `Meldingen er ${t.length - MAKS_MELDING_TEGN} tegn for lang. Maks er ${MAKS_MELDING_TEGN}.`,
    }
  }
  return { feil: null, tekst: t }
}

/**
 * Tolker «19:00» som et tidspunkt i LOKAL tid, og gir ISO i UTC.
 *
 * ⚠️ Lokal tid, ikke hardkodet UTC-forskyvning. Første utkast trakk fra to
 * timer for norsk sommertid, som ville blitt feil hver vinter uten at noen
 * merket det før et vedlikehold sto en time for lenge.
 */
export function tilUtc(klokke, naa = new Date()) {
  if (!/^\d{2}:\d{2}$/.test(klokke ?? '')) return null
  const [t, m] = klokke.split(':').map(Number)
  if (t > 23 || m > 59) return null
  const utloper = new Date(naa)
  utloper.setHours(t, m, 0, 0)
  if (utloper <= naa) utloper.setDate(utloper.getDate() + 1)
  return utloper.toISOString()
}

function les() {
  return JSON.parse(readFileSync('status.json', 'utf8'))
}

function skriv(status, commitTekst) {
  writeFileSync('status.json', JSON.stringify(status, null, 2) + '\n')
  execFileSync('git', ['add', 'status.json'])
  execFileSync('git', ['commit', '-m', commitTekst])
  execFileSync('git', ['push'])
  console.log(`✓ ${commitTekst}`)
  console.log('  Live om et par minutter på https://status.matlyst-app.no')
}

function kjor() {
  const [kommando, ...rest] = process.argv.slice(2)
  const naa = new Date().toISOString()

  if (kommando === 'vis') {
    const s = les()
    console.log(`tilstand: ${s.tilstand}`)
    console.log(`melding:  ${s.melding || '(ingen)'}`)
    console.log(`kilde:    ${s.kilde}`)
    console.log(`siden:    ${s.siden}`)
    if (s.utloper) console.log(`utløper:  ${s.utloper}`)
    return
  }

  if (kommando === 'ned') {
    const v = validerMelding(rest.join(' '))
    if (v.feil) { console.error(v.feil); process.exit(1) }
    const gammel = les()
    skriv({
      tilstand: 'nede',
      siden: gammel.tilstand === 'nede' ? gammel.siden : naa,
      melding: v.tekst,
      kilde: 'manuell',
      oppdatert: naa,
    }, `status: nede, ${v.tekst}`)
    return
  }

  if (kommando === 'opp') {
    skriv({
      tilstand: 'oppe',
      siden: naa,
      melding: MALMELDING.oppe,
      kilde: 'auto',
      oppdatert: naa,
    }, 'status: oppe')
    return
  }

  if (kommando === 'vedlikehold') {
    const tilIndeks = rest.indexOf('--til')
    if (tilIndeks === -1) {
      console.error('Vedlikehold krever et utløpstidspunkt. Eksempel: --til 19:00')
      process.exit(1)
    }
    const v = validerMelding(rest.slice(0, tilIndeks).join(' '))
    if (v.feil) { console.error(v.feil); process.exit(1) }
    const klokke = rest[tilIndeks + 1]
    const utloper = tilUtc(klokke)
    if (!utloper) {
      console.error('Utløpstidspunktet må være på formen TT:MM, for eksempel 19:00.')
      process.exit(1)
    }
    skriv({
      tilstand: 'vedlikehold',
      siden: naa,
      melding: v.tekst,
      kilde: 'manuell',
      utloper,
      oppdatert: naa,
    }, `status: vedlikehold til ${klokke}, ${v.tekst}`)
    return
  }

  console.log('Bruk: node status.mjs [ned "melding" | opp | vedlikehold "melding" --til TT:MM | vis]')
  process.exit(kommando ? 1 : 0)
}

// Eksakt sammenligning, ikke endsWith. Samme felle som i maal.mjs.
if (process.argv[1] === fileURLToPath(import.meta.url)) kjor()
