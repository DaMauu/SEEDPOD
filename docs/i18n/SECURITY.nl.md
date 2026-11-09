# Security Policy（Nederlands）

> Deze pagina is de Nederlandse vertaling van [SECURITY.md](../../SECURITY.md). De English versie en het vereenvoudigd Chinees zijn leidend.
> [简体中文](../../SECURITY.md) · [English](../../SECURITY.md) · [各语言 / All languages](README.md)

### Een kwetsbaarheid melden

Meld beveiligingsproblemen **niet** via openbare Issue. Gebruik het privékanaal van de repository:

1. Open het tabblad [Security](../../security/advisories) en klik op "Report a vulnerability";
2. Of neem direct contact op met de maintainers met reproductiestappen en impact.

We streven ernaar binnen 7 dagen te reageren en stemmen na bevestiging de oplossing en het moment van openbaarmaking met je af.

### Wat je moet melden

De userscripts van SEEDPOD draaien op ingelogde pagina's van private trackers, kunnen de pagina-inhoud lezen en namens jou verzoeken versturen. Dit alles geldt als een beveiligingsprobleem:

- Inloggegevens (cookie, passkey, trackersleutels, accountwachtwoorden) die naar een adres van een derde partij worden gestuurd
- Ongedocumenteerde uitgaande verzoeken (naar domeinen anders dan de imagehost, de CDN of de in de documentatie beschreven diensten)
- XSS-paden die door een aanvaller bestuurde inhoud in het paneel of in dialoogvensters injecteren
- Rechten- of parameterinjectie bij cross-site dedupe, het invullen van het uploadformulier of de push naar de downloader
- Stylesheets die via externe `@import` niet-vertrouwde bronnen laden

### Buiten scope

- Kwetsbaarheden in de trackers zelf (meld die aan de betreffende site)
- Siteregels, torrentinhoud of accountbans
- Problemen waarvoor eerst toegang tot je lokale bestanden of de context van je browserextensie nodig is

### Bij het indienen van een Issue of PR

Verwijder voordat je logs of screenshots plaatst: cookie, passkey, trackersleutels, downloaderadressen en -wachtwoorden en sitegebruikersnamen. Behoud de stack trace; plak geen volledige requestheaders.
