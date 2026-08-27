# Slik oppdaterer du Matlyst-statusen

Du står i mappa `~/Documents/Apps/matlyst-status`. Det finnes tre kommandoer.
Velg én, kjør den, ferdig.

⚠️ **Ikke rediger `status.json` for hånd.** Kommandoene validerer teksten og
pusher for deg. Redigerer du fila direkte, kan du skrive en melding som brekker
banneret i appen.

## Serveren er nede og du vil si fra

    node status.mjs ned "MELDING"

MELDING er én setning på **maks 80 tegn**, på norsk. Skriv hva som skjer, og
gjerne når du tror det er tilbake.

Eksempler som fungerer:

    node status.mjs ned "Tilbake ca. 18:00, vi holder på nå"
    node status.mjs ned "Databasen er treg. Vi jobber med det."
    node status.mjs ned "Vi har problemer med serveren. Vi ser på det nå."

Blir meldingen for lang, sier kommandoen fra nøyaktig hvor mange tegn du må
kutte. Prøv igjen med en kortere setning.

## Alt virker igjen

    node status.mjs opp

Du trenger som regel ikke denne. En automatisk jobb måler serveren hvert femte
minutt og setter statusen tilbake til oppe av seg selv når den svarer igjen.
Meldingen din fjernes da samtidig.

## Planlagt vedlikehold

    node status.mjs vedlikehold "Oppgraderer databasen" --til 19:00

Utløpstidspunktet er påkrevd og skrives som TT:MM i norsk tid. Uten det ville
statusen blitt stående for alltid. Har klokkeslettet allerede passert i dag,
tolkes det som i morgen.

## Se hva som står nå

    node status.mjs vis

## Hva du ikke kan gjøre

Du kan **ikke** sette tilstanden til oppe mens serveren faktisk er nede. Den
automatiske jobben måler hvert femte minutt og overstyrer deg.

Det er med vilje: du eier teksten, jobben eier tilstanden. Slik kan en glemt
melding aldri bli stående og lyve om nedetid som er over for lenge siden.

## Hvis noe går galt

Feiler `git push`, er det som regel fordi den automatiske jobben skrev samtidig.
Kjør dette, og prøv kommandoen på nytt:

    git pull --rebase

Endringen er live på https://status.matlyst-app.no rundt førti sekunder etter at
kommandoen er kjørt.
