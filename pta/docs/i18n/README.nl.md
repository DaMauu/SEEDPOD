# SEEDPOD（Nederlands）

> Deze pagina is de Nederlandse vertaling van [README.md](../../README.md). De English versie en het vereenvoudigd Chinees zijn leidend.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · De afgeleide bibliotheek van de zaaier" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · De afgeleide bibliotheek van de zaaier</p>

<p align="center"><b>Doe in alles je best.</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/userscripts-37-000000?style=flat-square&logo=tampermonkey" />
  <img src="https://img.shields.io/badge/JavaScript-ES2017-f7df1e?style=flat-square&logo=javascript&logoColor=black" />
  <img src="https://img.shields.io/badge/dependencies-none-2ea44f?style=flat-square" />
  <img src="https://img.shields.io/badge/styles-1-8c796a?style=flat-square" />
  <img src="https://img.shields.io/badge/build-none%20%C2%B7%20single--file-success?style=flat-square" />
  <img src="https://img.shields.io/badge/branch-main-8957e5?style=flat-square" />
</p>

<p align="center">
  <a href="../../README.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.ru.md">Русский</a> ·
  <a href="README.de.md">Deutsch</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt.md">Português</a> ·
  <a href="README.it.md">Italiano</a> ·
  <a href="README.nl.md">Nederlands</a> ·
  <a href="README.pl.md">Polski</a> ·
  <a href="README.tr.md">Türkçe</a> ·
  <a href="README.vi.md">Tiếng Việt</a> ·
  <a href="README.th.md">ไทย</a> ·
  <a href="README.id.md">Bahasa Indonesia</a> ·
  <a href="README.ar.md">العربية</a>
</p>

---

SEEDPOD verzamelt uitbreidingen van één bestand die direct aan een site worden gehangen: Tampermonkey-scripts en externe stylesheets. Eén bestand erin en het werkt, zonder buildstap, zonder afhankelijkheden, zonder backend.

De modules zijn onafhankelijk van elkaar; wat je installeert, bepaal je alleen aan de hand van de documentatie van die module.

## Modules

| Module | Vorm | Wat het doet | Toegang |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | Gebruikersscript | Paneel voor het overzetten van originele schijven: bulkfilter, dubbelcontrole tussen sites, BDInfo-opmaak, screenshots overzetten, formulier invullen en torrent aanleveren | [Installeren](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 gebruikersscripts | Dagelijkse handelingen op de site: hulp bij uploaden, eigen gegevens verbergen, badges en aankondigingen verbergen, bulkgeschenken, downloads markeren | [Index](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Licht thema Broomhilda Red, externe stijl voor de site | [Toepassen](../../styles/r/README.md) |

## Beschrijving

**bluray** is het belangrijkste script van deze verzameling, ongeveer 6300 regels, en brengt het repetitieve werk van het overzetten van originele schijven samen in één paneel dat altijd beschikbaar blijft: volgens regels de geschikte schijven uitfilteren, op de doelsite op duplicaten controleren, de opmaak van de detailpagina uitlezen, afbeeldingen naar een andere host overzetten, het uploadformulier invullen en naar de downloader sturen. Het ondersteunt vier soorten sites: NexusPHP, UNIT3D, Gazelle en f3nix. Documentatie: [snelstart](../../scripts/bluray/docs/QUICKSTART.md), [handleiding](../../scripts/bluray/docs/GUIDE.md), [architectuur](../../scripts/bluray/docs/ARCHITECTURE.md), [ontwikkeling](../../scripts/bluray/docs/DEVELOPMENT.md), [AI-context](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts** is een verzameling scripts die in zijn geheel van het upstreamproject `DaMauu/Scripts` is overgenomen; de bestanden blijven ongewijzigd en alleen de installatielinks wijzen naar deze verzameling, updates volgen de upstream. Zie de [index](../../scripts/PTScripts/README.md) voor het doel van elk script.

**styles/r** bevat de thema's voor de site. Het montageadres gebruikt vaste tags, zodat de inhoud niet verschuift; na een wijziging aan een stijl maak je gewoon een nieuwe tag.

## Installatie

- Scripts: installeer [Tampermonkey](https://www.tampermonkey.net/), open het betreffende `.user.js` en klik op `Raw` om te bevestigen.
- Stijlen: kopieer de directe jsDelivr-link naar het veld voor externe stylesheets van de site, of probeer het tijdelijk volgens de [uitleg](../../styles/r/README.md).

## Versieregels

| Module | Regel |
|---|---|
| bluray | `0.0.0.N` in vier oplopende delen, één versie per bestand, oude versies worden nooit overschreven of verwijderd; `@version` in de kop, de paneeltitel en het injectielog blijven synchroon |
| PTScripts | Volgt de upstream; deze verzameling garandeert alleen dat bestanden niet verloren gaan |
| styles | Eén bestand per stijl, bij een wijziging het versienummer ophogen en een tag maken, oude tags blijven permanent bewaard om terug te kunnen |

## Structuur

```
SEEDPOD/
├── docs/banner.png              omslagafbeelding
├── scripts/
│   ├── bluray/                  paneel voor het overzetten van originele schijven (docs/ documentatie, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 scripts van één bestand + index
├── styles/r/                    Broomhilda Red-thema
└── README.md
```

## Bekende problemen

De terugkerende problemen en openstaande punten van bluray (K-01 ~ K-14), samen met de patronen waarmee ze terugkomen, staan in [`scripts/bluray/README.md`](../../scripts/bluray/README.md). Lees die sectie voordat je iets wijzigt.

## Licentie en disclaimer

De code is beschikbaar onder [GPL-3.0](../../LICENSE): je mag hem vrij gebruiken, wijzigen en herverdelen, maar bij het verspreiden van een gewijzigde versie moet je die ook open source maken en de copyrightvermelding behouden; je mag hem niet gesloten verpakken en verkopen.

Alleen voor persoonlijk gebruik, om bronnen over te zetten tussen privésites waarvoor je toestemming hebt. Houd je aan de regels van elke site: controleer vóór het overzetten dat overzetten niet verboden is en dat er geen duplicaten zijn.

<p align="center"><sub>Het resultaat van de late nachtelijke, gepassioneerde ontwikkeling door 大肥鱼 DeepSeek en 主任</sub></p>
