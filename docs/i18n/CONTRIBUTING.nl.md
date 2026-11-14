# Contributing（Nederlands）

> Deze pagina is de Nederlandse vertaling van [CONTRIBUTING.md](../../CONTRIBUTING.md). De English versie en het vereenvoudigd Chinees zijn leidend.
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各语言 / All languages](README.md)

Bedankt dat je SEEDPOD wilt verbeteren. Neem deze pagina eerst even door — dat scheelt het grootste deel van de heen-en-weer berichten.

### Wat deze repository is

Add-ons van één bestand: Tampermonkey-userscripts en externe stylesheets. **Geen build, geen afhankelijkheden, geen backend** — één bestand toevoegen en het werkt. Introduceer geen bundlers, npm-afhankelijkheden of compileerstappen in een PR.

### Indeling

| Pad | Inhoud |
|---|---|
| `scripts/bluray/legacy/` | Uitgebrachte versies van het bluray-paneel, één bestand per versie |
| `scripts/bluray/docs/` | Snelstart, handleiding, architectuur, ontwikkelnotities |
| `scripts/PTScripts/` | Verzameling tracker-hulpscripts, volgt upstream `DaMauu/Scripts` |
| `styles/r/` | Themastijlen voor trackers |
| `pta/` | Lokale pagina met notities over de tracker-architectuur |

### Versiebeheer

- **bluray**: bestandsnaam `pt-bluray-assistant-v0.0.0.N.user.js`, vier segmenten die oplopen. **Overschrijf of verwijder nooit een oude versie** — voeg een nieuw bestand toe. De `@version`-header, de paneeltitel en de regel in het injectielog moeten allemaal overeenkomen.
- **styles**: één bestand per stijl, verhoog bij een wijziging de versie en zet een tag; oude tags blijven voor altijd staan zodat gebruikers kunnen terugrollen.
- **PTScripts**: deze repo garandeert alleen dat de bestanden online blijven; upstream `DaMauu/Scripts` is de bron van waarheid. Dien wijzigingen eerst upstream in en synchroniseer daarna terug.

### Voordat je indient

1. Het script installeert in Tampermonkey en werkt echt op de doelsite — niet „zou moeten werken“.
2. Vermeld op welke trackertypes je het hebt geverifieerd (NexusPHP / UNIT3D / Gazelle / f3nix); sitenamen helpen.
3. Verwijder debug-`console.log`s, lokale paden en testaccounts.
4. Commit geen lokale trackerdata: `data/site-defs/` en `pta/data/site-arch.local.csv` staan in `.gitignore` — forceer ze nooit met `git add -f`.
5. **Commit nooit** cookies, passkeys, trackersleutels, API-sleutels of screenshots met persoonsgegevens.

### Commitberichten

Een korte beschrijving van wat er is veranderd en welke module het raakt, bijvoorbeeld:

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

Chinees of Engels, beide prima.

### Pull requests

- Eén onderwerp per PR; houd niet-gerelateerde opmaakwijzigingen erbuiten.
- Beschrijf: motivatie, betrokken modules, hoe je het hebt geverifieerd en het resultaat, en of bestanden van oude versies worden geraakt.
- Voeg screenshots toe bij wijzigingen aan paneel of stijl — met accounts en sleutels afgeschermd.

### Issues

Meld bugs en verzoeken via de templates. Open voor beveiligingsproblemen geen publieke Issue — zie [SECURITY.md](../../SECURITY.md).
