# Contributing（Italiano）

> Questa pagina è la traduzione italiana di [CONTRIBUTING.md](../../CONTRIBUTING.md). Fanno fede le versioni English e cinese semplificato.
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各语言 / All languages](README.md)

Grazie per voler migliorare SEEDPOD. Dai prima una scorsa a questa pagina: evita gran parte dei botta e risposta.

### Che cos'è questo repository

Add-on in un unico file: userscript per Tampermonkey e fogli di stile esterni. **Nessuna build, nessuna dipendenza, nessun backend** — basta inserire un file e funziona. Non introdurre bundler, dipendenze npm o passaggi di compilazione in una PR.

### Struttura

| Percorso | Contenuto |
|---|---|
| `scripts/bluray/legacy/` | Versioni rilasciate del pannello bluray, un file per versione |
| `scripts/bluray/docs/` | Avvio rapido, guida, architettura, note di sviluppo |
| `scripts/PTScripts/` | Raccolta di utility per i tracker, segue l'upstream `DaMauu/Scripts` |
| `styles/r/` | Stili dei temi per i tracker |
| `pta/` | Pagina locale di note sull'architettura dei tracker |

### Versionamento

- **bluray**: nome file `pt-bluray-assistant-v0.0.0.N.user.js`, quattro segmenti incrementali. **Non sovrascrivere né eliminare mai una versione precedente** — aggiungi un nuovo file. L'header `@version`, il titolo del pannello e la riga del log di iniezione devono coincidere.
- **styles**: un file per stile, a ogni modifica incrementa la versione e crea un tag; i vecchi tag restano per sempre, così gli utenti possono tornare indietro.
- **PTScripts**: questo repository garantisce solo che i file restino online; l'upstream `DaMauu/Scripts` è la fonte di verità. Invia prima le modifiche upstream, poi risincronizza.

### Prima di inviare

1. Lo script si installa in Tampermonkey e funziona davvero sul sito di destinazione — non «dovrebbe funzionare».
2. Indica su quali tipi di tracker l'hai verificato (NexusPHP / UNIT3D / Gazelle / f3nix); i nomi dei siti aiutano.
3. Rimuovi i `console.log` di debug, i percorsi locali e gli account di test.
4. Non committare dati locali dei tracker: `data/site-defs/` e `pta/data/site-arch.local.csv` sono in `.gitignore` — non forzarli con `git add -f`.
5. **Non committare mai** cookie, passkey, chiavi dei tracker, chiavi API o screenshot con dati personali.

### Messaggi di commit

Una breve descrizione di cosa è cambiato e quale modulo coinvolge, ad esempio:

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

Cinese o inglese vanno bene entrambi.

### Pull request

- Un solo obiettivo per PR; lascia fuori modifiche di formattazione non correlate.
- Descrivi: motivazione, moduli interessati, come l'hai verificato e il risultato, e se i file delle vecchie versioni vengono toccati.
- Allega screenshot per modifiche a pannello o stili — con account e chiavi oscurati.

### Issue

Segnala bug e richieste usando i template. Per problemi di sicurezza non aprire una Issue pubblica — vedi [SECURITY.md](../../SECURITY.md).
