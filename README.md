# Matlyst status

Statuskilden for Matlyst-appen. `status.json` er den eneste fila appen leser.

Live på **https://status.matlyst-app.no**

## Hvorfor den ligger her og ikke i Supabase

Poenget er å kunne si «serveren er nede» NÅR serveren er nede. En status som ligger på
det som er nede, er verdiløs. Derfor: GitHub Pages, eget repo, ingen avhengighet til
Supabase.

Adskilt fra `matlyst-landing` slik at en statusoppdatering aldri kan brekke
markedsføringssida, og slik at den kan redigeres fra GitHub-appen på telefonen.

## Filene

| Fil | Ansvar |
|---|---|
| `status.json` | Tilstanden. Eneste fila appen leser. |
| `index.html` | Menneskelesbar statusside for folk som besøker domenet |
| `maal.mjs` | Probelogikken. Kalt av workflowen, testbar alene. |
| `status.mjs` | CLI for menneskelig overstyring |
| `OLLAMA.md` | Instruks til en lokal modell |

## Kontrakten

| Felt | Type | Verdier |
|---|---|---|
| `tilstand` | string | `oppe`, `treg`, `nede`, `vedlikehold` |
| `siden` | ISO 8601 UTC | Når nåværende tilstand startet |
| `melding` | string | Maks 80 tegn. Tom når tilstanden er `oppe`. |
| `kilde` | string | `auto` eller `manuell` |
| `oppdatert` | ISO 8601 UTC | Når fila sist ble skrevet |

## Hvem skriver hva

`tilstand` eies av den automatiske jobben, alltid.
`melding` eies av mennesket når det finnes en, ellers av jobben.

Det betyr at en glemt melding rydder seg selv når serveren kommer tilbake. Se
`OLLAMA.md` for hvordan du overstyrer meldingen uten å røre noen av filene her.

## Design

Spec og implementasjonsplan ligger i hovedrepoet:
`docs/superpowers/specs/2026-08-27-nedetidsvarsling-design.md`
