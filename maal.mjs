// Måler om Supabase svarer, og skriver status.json.
//
// ⚠️ Prober med ANON-nøkkelen, ikke med management-API-et. To grunner:
//
// 1. Anon-nøkkelen ligger allerede i app-bundlen, altså offentlig. Repoet
//    trenger da ingen nøkkel som ville vært et tap å lekke. Den leses fra en
//    GitHub Secret og skrives aldri til fil eller logg.
// 2. Den måler nøyaktig veien brukerne går. Management-API-et sa
//    ACTIVE_HEALTHY 27.08.2026 mens brukerne ikke kom inn i det hele tatt.
//    En helsesjekk som spør et annet sted enn brukeren, måler feil ting.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SB = process.env.SUPABASE_URL
const ANON = process.env.SUPABASE_ANON_KEY

/** Over dette regnes svaret som tregt. Normalt svar er 100 til 300 ms. */
const TREG_MS = 3000
const TIMEOUT_MS = 10000
const ANTALL_PROBER = 3
const PAUSE_MS = 10000

/**
 * Ferdigskrevne meldinger, aldri genererte.
 *
 * Selv med null menneskelig involvering skal brukeren møte noe som høres ut som
 * en person, ikke en feilkode. Tonen følger CLAUDE.md: norsk bokmål, direkte og
 * varm, ingen utropstegn.
 */
export const MALMELDING = {
  nede: 'Vi har problemer med serveren vår. Vi jobber med saken.',
  treg: 'Det går tregere enn vanlig akkurat nå. Vi ser på det.',
  oppe: '',
}

/** Én probe. Returnerer svartid i ms, eller null hvis den feilet. */
export async function probe(hent = fetch) {
  const start = Date.now()
  try {
    const r = await hent(`${SB}/rest/v1/profiles?select=id&limit=1`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return r.ok ? Date.now() - start : null
  } catch {
    return null
  }
}

/**
 * Tilstand ut fra tre prober.
 *
 * ⚠️ Mot flakking: `nede` krever at ALLE feiler, `treg` at ALLE er trege. Én
 * dårlig probe er nettverksstøy, ikke et utfall, og et banner som blinker av og
 * på er verre for brukeren enn ingen banner.
 *
 * `oppe` meldes derimot ved første suksess. Der er det ingen grunn til å nøle:
 * å holde brukeren i lesemodus lenger enn nødvendig koster bare tillit.
 */
export function maalTilstand(svartider) {
  const alleFeilet = svartider.every((t) => t === null)
  if (alleFeilet) return { tilstand: 'nede', treg: false }
  const alleTrege = svartider.every((t) => t !== null && t > TREG_MS)
  if (alleTrege) return { tilstand: 'treg', treg: true }
  return { tilstand: 'oppe', treg: false }
}

/**
 * Fletter en måling inn i eksisterende status.
 *
 * ⚠️ Ansvarsdelingen, og den viktigste regelen i hele fila: jobben eier
 * `tilstand`, mennesket eier kun `melding`.
 *
 * Skriver noen en melding og glemmer den, setter jobben `oppe` og tømmer
 * teksten når serveren er tilbake. Uten dette kunne appen stått og løyet om
 * nedetid i dagevis fordi ingen ryddet opp, og en app som lyver om at den er
 * nede er verre enn en app som ikke sier noe.
 *
 * Vedlikehold er unntaket, og derfor er utløpstidspunkt påkrevd der.
 */
export function flettStatus(gammel, maalt, naa) {
  const utloptVedlikehold =
    gammel.tilstand === 'vedlikehold' && gammel.utloper && gammel.utloper <= naa

  if (gammel.tilstand === 'vedlikehold' && !utloptVedlikehold) {
    return { ...gammel, oppdatert: naa }
  }

  const tilstand = maalt.tilstand
  const byttet = tilstand !== gammel.tilstand || utloptVedlikehold
  const beholdManuell =
    gammel.kilde === 'manuell' && tilstand === gammel.tilstand && tilstand !== 'oppe'

  return {
    tilstand,
    siden: byttet ? naa : gammel.siden,
    melding: beholdManuell ? gammel.melding : MALMELDING[tilstand],
    kilde: beholdManuell ? 'manuell' : 'auto',
    oppdatert: naa,
  }
}

// Kjøres av workflowen.
//
// ⚠️ EKSAKT sammenligning, ikke endsWith. Den første versjonen brukte
// `process.argv[1]?.endsWith('maal.mjs')`, som også er sann for
// «test-maal.mjs». Testfila kjørte da hele måleren i stedet for å importere fra
// den, og testen fanget det umiddelbart. Samme felle som korte nøkkelord som
// treffer midt inne i lengre ord.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!SB || !ANON) {
    console.error('Mangler SUPABASE_URL eller SUPABASE_ANON_KEY.')
    process.exit(1)
  }
  const svartider = []
  for (let i = 0; i < ANTALL_PROBER; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, PAUSE_MS))
    svartider.push(await probe())
  }
  const gammel = JSON.parse(readFileSync('status.json', 'utf8'))
  const ny = flettStatus(gammel, maalTilstand(svartider), new Date().toISOString())
  writeFileSync('status.json', JSON.stringify(ny, null, 2) + '\n')
  console.log(`svartider ${JSON.stringify(svartider)} → ${ny.tilstand}`)
}
