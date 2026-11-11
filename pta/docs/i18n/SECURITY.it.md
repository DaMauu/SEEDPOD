# Security Policy（Italiano）

> Questa pagina è la traduzione italiana di [SECURITY.md](../../SECURITY.md). Fanno fede le versioni English e cinese semplificato.
> [简体中文](../../SECURITY.md) · [English](../../SECURITY.md) · [各语言 / All languages](README.md)

### Segnalare una vulnerabilità

Ti chiediamo di **non** segnalare problemi di sicurezza tramite Issue pubbliche. Usa il canale privato del repository:

1. Apri la scheda [Security](../../security/advisories) e fai clic su "Report a vulnerability";
2. Oppure contatta direttamente i maintainer indicando i passaggi di riproduzione e l'impatto.

Ci impegniamo a rispondere entro 7 giorni e, dopo la conferma, concorderemo con te la correzione e i tempi di divulgazione.

### Cosa segnalare

Gli userscript di SEEDPOD vengono eseguiti su pagine di tracker privati a cui hai effettuato l'accesso, possono leggere il contenuto della pagina e inviare richieste per tuo conto. Sono tutti problemi di sicurezza:

- Credenziali (cookie, passkey, chiavi del tracker, password dell'account) inviate a un indirizzo di terze parti
- Richieste in uscita non documentate (verso domini diversi dall'host delle immagini, dalla CDN o dai servizi descritti nella documentazione)
- Percorsi XSS che iniettano contenuti controllati da un attaccante nel pannello o nelle finestre di dialogo
- Iniezione di privilegi o di parametri nel dedupe cross-site, nella compilazione del modulo di upload o nel push al downloader
- Fogli di stile che caricano risorse non attendibili tramite `@import` esterno

### Fuori ambito

- Vulnerabilità nei tracker stessi (segnalale al sito interessato)
- Regole del sito, contenuto dei torrent o ban degli account
- Problemi che richiedono un accesso preventivo ai tuoi file locali o al contesto dell'estensione del browser

### In caso di Issue o PR

Prima di pubblicare log o screenshot, rimuovi: cookie, passkey, chiavi del tracker, indirizzi e password dei downloader e nomi utente del sito. Conserva lo stack trace; non incollare intere intestazioni delle richieste.
