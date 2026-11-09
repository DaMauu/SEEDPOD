# Security Policy（Deutsch）

> Dies ist die deutsche Übersetzung von [SECURITY.md](../../SECURITY.md). Maßgeblich sind das englische Original und die vereinfachte chinesische Fassung.
> [简体中文](../../SECURITY.md) · [English](../../SECURITY.md) · [各语言 / All languages](README.md)

### Sicherheitslücken melden

Bitte melde Sicherheitsprobleme **nicht** über öffentliche Issues. Nutze den privaten Kanal des Repositorys:

1. Öffne den Tab [Security](../../security/advisories) und klicke auf „Report a vulnerability“;
2. Oder wende dich direkt an die Maintainer und nenne Repro-Schritte und Auswirkungen.

Wir bemühen uns um eine erste Antwort innerhalb von 7 Tagen und stimmen nach Bestätigung den Fix und den Veröffentlichungszeitpunkt mit dir ab.

### Was gemeldet werden sollte

Die Userscripts von SEEDPOD laufen auf angemeldeten Seiten privater Tracker, können Seiteninhalte lesen und in deinem Namen Anfragen senden. All das gilt als Sicherheitsproblem:

- Anmeldedaten (cookie, passkey, Tracker-Keys, Account-Passwörter), die an eine Drittadresse gesendet werden
- Nicht dokumentierte ausgehende Anfragen (an Domains außer dem Bildhost, dem CDN oder den in der Doku beschriebenen Diensten)
- XSS-Pfade, die angreifergesteuerte Inhalte in das Panel oder in Dialoge einschleusen
- Rechte- oder Parameterinjektion beim siteübergreifenden Duplikatabgleich, beim Ausfüllen des Upload-Formulars oder beim Push an den Downloader
- Stylesheets, die über externes `@import` nicht vertrauenswürdige Ressourcen laden

### Nicht im Geltungsbereich

- Schwachstellen in den Trackern selbst (melde diese an die jeweilige Seite)
- Seitenregeln, Torrent-Inhalte oder Account-Sperren
- Probleme, die vorherigen Zugriff auf deine lokalen Dateien oder den Kontext deiner Browsererweiterung erfordern

### Beim Erstellen von Issue oder PR

Entferne vor dem Posten von Logs oder Screenshots: cookie, passkey, Tracker-Keys, Downloader-Adressen und -Passwörter sowie Site-Benutzernamen. Behalte den Stacktrace; füge keine vollständigen Request-Header ein.
