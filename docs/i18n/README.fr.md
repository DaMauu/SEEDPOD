# SEEDPOD（Français）

> Cette page est la traduction française de [README.md](../../README.md). Les versions English et chinois simplifié font foi.
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · Bibliothèque des dérivés du semeur" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · Bibliothèque des dérivés du semeur</p>

<p align="center"><b>En toute chose, fais de ton mieux.</b></p>

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

SEEDPOD rassemble des extensions monofichier qui s'accrochent directement au site : scripts Tampermonkey et feuilles de style externes. Un fichier suffit, sans étape de build, sans dépendance, sans backend.

Les modules sont indépendants les uns des autres : pour savoir quoi installer, il suffit de lire la documentation du module concerné.

## Modules

| Module | Forme | Rôle | Accès |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | Script utilisateur | Panneau de repost de disques : filtrage en masse, contrôle des doublons entre sites, mise en forme BDInfo, transfert des captures, remplissage du formulaire et envoi | [Installation](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 scripts utilisateurs | Tâches quotidiennes sur le site : aide à l'upload, masquage de ses propres données, masquage des badges et annonces, cadeaux en masse, marquage des téléchargements | [Index](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Thème clair Broomhilda Red, feuille de style externe pour le site | [Intégration](../../styles/r/README.md) |

## Description

**bluray** est le script principal de la bibliothèque, environ 6300 lignes. Il regroupe le travail répétitif du transfert d'images de disques dans un panneau toujours disponible : sélectionner les images conformes selon des règles, vérifier les doublons sur le site cible, analyser la mise en page de la fiche, transférer les images vers un autre hébergeur, remplir le formulaire d'upload et l'envoyer au téléchargeur. Compatible avec quatre types de sites : NexusPHP, UNIT3D, Gazelle et f3nix. Documentation : [démarrage rapide](../../scripts/bluray/docs/QUICKSTART.md), [manuel](../../scripts/bluray/docs/GUIDE.md), [architecture](../../scripts/bluray/docs/ARCHITECTURE.md), [développement](../../scripts/bluray/docs/DEVELOPMENT.md), [contexte IA](../../scripts/bluray/docs/AI-CONTEXT.md).

**PTScripts** est un ensemble de scripts repris intégralement du dépôt amont `DaMauu/Scripts` ; les fichiers restent tels quels, seuls les liens d'installation pointent vers cette bibliothèque, et les mises à jour suivent l'amont. L'usage de chaque script est décrit dans l'[index](../../scripts/PTScripts/README.md).

**styles/r** contient les thèmes du site. L'adresse d'intégration utilise un tag fixe, le contenu ne bouge donc pas ; après une modification du style, il suffit de créer un nouveau tag.

## Installation

- Scripts : installez [Tampermonkey](https://www.tampermonkey.net/), ouvrez le `.user.js` correspondant et cliquez sur `Raw` pour confirmer.
- Styles : copiez le lien direct jsDelivr dans le champ de feuille de style externe du site, ou testez temporairement selon l'[explication](../../styles/r/README.md).

## Règles de version

| Module | Règle |
|---|---|
| bluray | `0.0.0.N`, quatre segments croissants, une version par fichier, les anciennes versions ne sont jamais écrasées ni supprimées ; `@version` en tête, titre du panneau et journal d'injection sont synchronisés |
| PTScripts | suit l'amont ; cette bibliothèque garantit seulement que les fichiers ne disparaissent pas |
| styles | un fichier par style, chaque modification incrémente le numéro de version et crée un tag ; les anciens tag sont conservés définitivement et permettent un retour arrière |

## Structure

```
SEEDPOD/
├── docs/banner.png              image de couverture
├── scripts/
│   ├── bluray/                  panneau de repost de disques (docs/ documentation, legacy/ v0.0.0.1 ~ v0.0.0.47)
│   └── PTScripts/               37 scripts monofichier + index
├── styles/r/                    thème Broomhilda Red
└── README.md
```

## Problèmes connus

Les problèmes récurrents de bluray et les points non résolus (K-01 ~ K-14), avec les schémas de réapparition, sont consignés dans [`scripts/bluray/README.md`](../../scripts/bluray/README.md) ; lisez cette section avant toute modification.

## Licence et avertissement

Le code est publié sous [GPL-3.0](../../LICENSE) : utilisation, modification et redistribution libres, mais toute version modifiée diffusée doit rester open source et conserver la mention de copyright ; une revente en boîte fermée n'est pas permise.

Réservé à un usage personnel de transfert entre sites privés pour lesquels vous êtes autorisé. Respectez les règles de chaque site : avant un repost, vérifiez qu'il n'est pas interdit et qu'il n'y a pas de doublon.

<p align="center"><sub>Fruit d'un développement passionné mené tard dans la nuit par 大肥鱼 DeepSeek et 主任</sub></p>
