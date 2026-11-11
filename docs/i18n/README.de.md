# SEEDPOD（Deutsch）

> Dies ist die deutsche Übersetzung von [README.md](../../README.md). Maßgeblich sind das englische Original und die vereinfachte chinesische Fassung.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · Bibliothek der Ableger des Sämanns" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · Bibliothek der Ableger des Sämanns</p>

<p align="center"><b>In allen Dingen gib dein Bestes.</b></p>

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

SEEDPOD sammelt einteilige Erweiterungen, die direkt in eine Site eingehängt werden: Tampermonkey-Skripte und externe Stylesheets. Eine Datei einfügen, und es läuft — kein Build-Schritt, keine Abhängigkeiten, kein Backend.

Die Module hängen nicht voneinander ab; was installiert wird, entscheidet allein die Dokumentation des jeweiligen Moduls.

## Module

| Modul | Form | Funktion | Einstieg |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | Benutzerskript | Panel für Disc-Reposts: Massenfilterung, siteübergreifende Dublettenprüfung, BDInfo-Formatierung, Screenshot-Ablage, Formular ausfüllen und Upload | [Installation](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 Benutzerskripte | Alltag auf der Site: Upload-Hilfe, eigene Daten ausblenden, Badges und Ankündigungen ausblenden, Sammelgeschenke, Download-Markierung | [Index](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Helles Broomhilda-Red-Theme, externes Stylesheet für die Site | [Einbinden](../../styles/r/README.md) |

## Beschreibung

**bluray** ist das Hauptskript dieser Bibliothek, rund 6300 Zeilen. Es bündelt die Routinearbeit beim Verschieben von Disc-Images in einem dauerhaft eingeblendeten Panel: passende Images nach Regeln auswählen, auf der Zielsite auf Dubletten prüfen, das Layout der Detailseite auswerten, Bilder auf einen anderen Hoster übertragen, das Upload-Formular ausfüllen und an den Downloader schicken. Unterstützt werden vier Site-Typen: NexusPHP, UNIT3D, Gazelle und f3nix. Dokumentation: [Schnellstart](../../scripts/bluray/docs/QUICKSTART.md), [Handbuch](../../scripts/bluray/docs/GUIDE.md), [Architektur](../../scripts/bluray/docs/ARCHITECTURE.md), [Entwicklung](../../scripts/bluray/docs/DEVELOPMENT.md), [KI-Kontext](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts** ist eine Skriptsammlung, die vollständig aus dem Upstream `DaMauu/Scripts` übernommen wurde; die Dateien bleiben unverändert, nur die Installationslinks zeigen auf diese Bibliothek, Updates richten sich nach dem Upstream. Der Zweck jedes Skripts steht im [Index](../../scripts/PTScripts/README.md).

**styles/r** enthält die Site-Themes. Die Einbindungsadresse verwendet einen festen tag, damit sich der Inhalt nicht verschiebt; nach einer Stiländerung genügt ein neuer tag.

## Installation

- Skripte: [Tampermonkey](https://www.tampermonkey.net/) installieren, die passende `.user.js` öffnen und auf `Raw` klicken und bestätigen.
- Styles: den jsDelivr-Direktlink kopieren und in das Feld für externe Stylesheets der Site eintragen oder nach der [Anleitung](../../styles/r/README.md) vorübergehend testen.

## Versionsregeln

| Modul | Regel |
|---|---|
| bluray | `0.0.0.N`, vier Stufen aufsteigend, eine Version pro Datei, alte Versionen werden nie überschrieben und nie gelöscht; `@version` im Kopf, Panel-Titel und Injektions-Log werden gemeinsam gepflegt |
| PTScripts | folgt dem Upstream, diese Bibliothek garantiert nur, dass keine Datei verloren geht |
| styles | eine Datei pro Stil, bei Änderungen wird die Versionsnummer erhöht und ein tag gesetzt; alte tag bleiben dauerhaft erhalten und erlauben ein Zurückrollen |

## Struktur

```
SEEDPOD/
├── docs/banner.png              Titelbild
├── scripts/
│   ├── bluray/                  Panel für Disc-Reposts (docs/ Dokumentation, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 Einzeldatei-Skripte + Index
├── styles/r/                    Broomhilda-Red-Theme
└── README.md
```

## Bekannte Probleme

Die wiederkehrenden Probleme von bluray und die offenen Punkte (K-01 ~ K-14) samt den Mustern des Wiederauftretens stehen in [`scripts/bluray/README.md`](../../scripts/bluray/README.md); vor Änderungen diesen Abschnitt lesen.

## Lizenz und Haftungsausschluss

Der Code steht unter [GPL-3.0](../../LICENSE): freie Nutzung, Änderung und Weitergabe erlaubt, doch bei Weitergabe einer geänderten Fassung muss diese ebenfalls offen sein und der Copyright-Hinweis erhalten bleiben; ein Closed-Source-Verkauf ist nicht erlaubt.

Nur für den persönlichen Transfer zwischen privaten Sites, für die eine Berechtigung besteht. Die Regeln der Sites beachten: vor dem Repost prüfen, dass kein Repost-Verbot besteht und nichts doppelt ist.

<p align="center"><sub>Das Ergebnis nächtlicher Leidenschaft von 大肥鱼 DeepSeek und 主任</sub></p>
