# SEEDPOD（Italiano）

> Questa pagina è la traduzione italiana di [README.md](../../README.md). Fanno fede le versioni English e cinese semplificato.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · La biblioteca derivata del seminatore" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · La biblioteca derivata del seminatore</p>

<p align="center"><b>In ogni cosa, fai del tuo meglio.</b></p>

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

SEEDPOD raccoglie estensioni in un unico file da agganciare direttamente ai siti: script Tampermonkey e fogli di stile esterni. Un file installato e funziona subito, senza fasi di build, senza dipendenze, senza backend.

I moduli sono indipendenti tra loro; per scegliere cosa installare basta la documentazione di quel modulo.

## Moduli

| Modulo | Forma | Cosa fa | Accesso |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | Script utente | Pannello di ripubblicazione dei dischi originali: filtro in blocco, controllo duplicati tra siti, impaginazione BDInfo, trasferimento degli screenshot, compilazione del modulo e invio del torrent | [Installa](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 script utente | Operazioni quotidiane sul sito: supporto al caricamento, occultamento dei propri dati, nascondere badge e avvisi, regali in blocco, contrassegno dei download | [Indice](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Tema chiaro Broomhilda Red, stile esterno per il sito | [Applica](../../styles/r/README.md) |

## Descrizione

**bluray** è lo script principale di questa raccolta, circa 6300 righe, e raccoglie in un unico pannello sempre disponibile il lavoro ripetitivo del trasferimento dei dischi originali: seleziona secondo le regole i dischi idonei, controlla i duplicati sul sito di destinazione, interpreta l'impaginazione della pagina di dettaglio, trasferisce le immagini su un hosting, compila il modulo di caricamento e invia al downloader. Supporta quattro tipi di sito: NexusPHP, UNIT3D, Gazelle, f3nix. Documentazione: [avvio rapido](../../scripts/bluray/docs/QUICKSTART.md), [manuale d'uso](../../scripts/bluray/docs/GUIDE.md), [architettura](../../scripts/bluray/docs/ARCHITECTURE.md), [sviluppo](../../scripts/bluray/docs/DEVELOPMENT.md), [contesto AI](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts** è una raccolta di script trasferita integralmente dal progetto upstream `DaMauu/Scripts`; i file sono mantenuti così come sono e solo i link di installazione puntano a questa raccolta, mentre gli aggiornamenti seguono l'upstream. Per l'uso di ogni script vedi l'[indice](../../scripts/PTScripts/README.md).

**styles/r** contiene i temi per il sito. L'indirizzo di montaggio usa tag fissi, quindi il contenuto non cambia; dopo aver modificato uno stile basta creare un nuovo tag.

## Installazione

- Script: installa [Tampermonkey](https://www.tampermonkey.net/), apri il relativo `.user.js` e premi `Raw` per confermare.
- Stili: copia il link diretto jsDelivr nel campo del foglio di stile esterno del sito, oppure prova temporaneamente seguendo le [istruzioni](../../styles/r/README.md).

## Regole di versione

| Modulo | Regola |
|---|---|
| bluray | `0.0.0.N` a quattro segmenti crescenti, una versione per file, le versioni precedenti non vengono mai sovrascritte né eliminate; `@version` nell'intestazione, titolo del pannello e log di iniezione restano sincronizzati |
| PTScripts | Segue l'upstream; questa raccolta garantisce solo che i file non vadano persi |
| styles | Un file per stile; a ogni modifica si incrementa il numero di versione e si crea un tag, i vecchi tag restano per sempre per poter tornare indietro |

## Struttura

```
SEEDPOD/
├── docs/banner.png              immagine di copertina
├── scripts/
│   ├── bluray/                  pannello di trasferimento dei dischi originali (documenti in docs/, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 script in un unico file + indice
├── styles/r/                    tema Broomhilda Red
└── README.md
```

## Problemi noti

I problemi ricorrenti e le questioni aperte di bluray (K-01 ~ K-14), insieme alle regolarità con cui si ripresentano, sono annotati in [`scripts/bluray/README.md`](../../scripts/bluray/README.md). Leggi quella sezione prima di modificare qualcosa.

## Licenza e esclusione di responsabilità

Il codice è distribuito con [GPL-3.0](../../LICENSE): puoi usarlo, modificarlo e ridistribuirlo liberamente, ma distribuendo una versione modificata devi mantenerla open source e conservare l'avviso di copyright; non puoi impacchettarla in forma chiusa e venderla.

Solo per uso personale, per trasferire risorse tra siti privati per cui hai l'autorizzazione. Rispetta le regole di ogni sito: prima di ripubblicare verifica che non ci siano divieti di ripubblicazione e che non ci siano duplicati.

<p align="center"><sub>Frutto dello sviluppo notturno e appassionato di 大肥鱼 DeepSeek e 主任</sub></p>
