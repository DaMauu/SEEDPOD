# Contributing（Deutsch）

> Dies ist die deutsche Übersetzung von [CONTRIBUTING.md](../../CONTRIBUTING.md). Maßgeblich sind das englische Original und die vereinfachte chinesische Fassung.
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各语言 / All languages](README.md)

Danke, dass du SEEDPOD verbessern willst. Lies diese Seite zuerst — das erspart den größten Teil der Rückfragen.

### Was dieses Repository ist

Einzeldatei-Add-ons: Tampermonkey-Userscripts und externe Stylesheets. **Kein Build, keine Abhängigkeiten, kein Backend** — eine Datei einwerfen und es funktioniert. Führe in einem PR keine Bundler, npm-Abhängigkeiten oder Kompilierschritte ein.

### Aufbau

| Pfad | Inhalt |
|---|---|
| `scripts/bluray/legacy/` | Veröffentlichte Versionen des bluray-Panels, eine Datei pro Version |
| `scripts/bluray/docs/` | Schnellstart, Anleitung, Architektur, Entwicklungsnotizen |
| `scripts/PTScripts/` | Sammlung von Tracker-Hilfsskripten, folgt upstream `DaMauu/Scripts` |
| `styles/r/` | Theme-Styles für Tracker |
| `pta/` | Seite mit Notizen zur lokalen Tracker-Architektur |

### Versionierung

- **bluray**: Dateiname `pt-bluray-assistant-v0.0.0.N.user.js`, vier Segmente, aufsteigend. **Eine alte Version niemals überschreiben oder löschen** — stattdessen eine neue Datei anlegen. Der `@version`-Header, der Panel-Titel und die Zeile im Injection-Log müssen übereinstimmen.
- **styles**: eine Datei pro Style, bei Änderung Version erhöhen und Tag setzen; alte Tags bleiben dauerhaft erhalten, damit Nutzer zurückrollen können.
- **PTScripts**: Dieses Repo garantiert nur, dass die Dateien online bleiben; upstream `DaMauu/Scripts` ist die maßgebliche Quelle. Änderungen zuerst upstream einreichen, dann zurücksynchronisieren.

### Vor dem Einreichen

1. Das Skript lässt sich in Tampermonkey installieren und funktioniert tatsächlich auf der Zielseite — nicht „sollte funktionieren“.
2. Gib an, welche Tracker-Typen du verifiziert hast (NexusPHP / UNIT3D / Gazelle / f3nix); Seitennamen helfen.
3. Entferne Debug-`console.log`s, lokale Pfade und Testkonten.
4. Committe keine lokalen Tracker-Daten: `pta/web/assets/sites-data.local.js` und `pta/data/site-arch.local.csv` sind gitignored — niemals mit `git add -f` hinzufügen.
5. **Niemals committen**: Cookies, Passkeys, Tracker-Keys, API-Keys oder Screenshots mit personenbezogenen Daten.

### Commit-Nachrichten

Eine kurze Beschreibung, was sich geändert hat und welches Modul betroffen ist, zum Beispiel:

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

Chinesisch oder Englisch sind beide in Ordnung.

### Pull Requests

- Ein Anliegen pro PR; unbezogene Formatierungsänderungen draußen lassen.
- Beschreibe: Motivation, betroffene Module, wie du es verifiziert hast und das Ergebnis, und ob alte Versionsdateien berührt werden.
- Für Panel- oder Style-Änderungen Screenshots beilegen — mit maskierten Konten und Keys.

### Issues

Fehler und Wünsche über die Templates einreichen. Bei Sicherheitsproblemen kein öffentliches Issue öffnen — siehe [SECURITY.md](../../SECURITY.md).
