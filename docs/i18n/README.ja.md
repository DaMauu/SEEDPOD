# SEEDPOD（日本語）

> 本ページは [README.md](../../README.md) の日本語訳です。正式な内容は English 原文と簡体字中国語版に準じます。
> [简体中文](../../README.md) · [English](../../README.md) · [各语言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="SEEDPOD · 播種者の派生ライブラリ" width="100%" />
</div>

<h1 align="center">SEEDPOD</h1>

<p align="center">SEEDPOD · 播種者の派生ライブラリ</p>

<p align="center"><b>何事においても、全力を尽くす。</b></p>

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

SEEDPOD は、サイトに直接組み込む単一ファイルの拡張を集めたものです。Tampermonkey スクリプトと外部スタイルシート。ファイルを 1 つ入れるだけで有効になり、ビルド手順も依存関係もバックエンドもありません。

モジュール同士は互いに依存しません。どれを入れるかは、そのモジュールのドキュメントだけを見て決められます。

## モジュール

| モジュール | 形態 | できること | 入口 |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | ユーザースクリプト | 原盤転載パネル：一括絞り込み、サイト間の重複チェック、BDInfo 整形、スクリーンショットの転送、フォーム入力とアップロード | [インストール](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | ユーザースクリプト 37 個 | サイトの日常作業：アップロード補助、データの自己非表示、バッジとお知らせの非表示、一括ギフト、ダウンロードのマーク | [索引](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Broomhilda Red のライトテーマ、サイト向け外部スタイル | [適用](../../styles/r/README.md) |

## 説明

**bluray** は本ライブラリの主力スクリプトで、約 6300 行あります。原盤の移動作業で繰り返される手間を 1 つの常駐パネルにまとめます。規則に沿って条件を満たす原盤を抽出し、対象サイトで重複を確認し、詳細ページの整形を解析し、画像を別ホストへ転送し、アップロードフォームに入力してダウンローダーへ送信します。NexusPHP、UNIT3D、Gazelle、f3nix の 4 種類のサイトに対応します。ドキュメントは[クイックスタート](../../scripts/bluray/docs/QUICKSTART.md)、[使用ガイド](../../scripts/bluray/docs/GUIDE.md)、[アーキテクチャ](../../scripts/bluray/docs/ARCHITECTURE.md)、[開発](../../scripts/bluray/docs/DEVELOPMENT.md)、[AI コンテキスト](../../scripts/bluray/docs/AI-CONTEXT.md)を参照してください。

**PTScripts** は上流の `DaMauu/Scripts` からまるごと移したスクリプト集です。ファイルはそのまま保持し、インストールリンクだけを本ライブラリに向けています。更新は上流に従います。各スクリプトの用途は[索引](../../scripts/PTScripts/README.md)を参照してください。

**styles/r** はサイトテーマを置いています。適用アドレスは固定の tag を使うため内容が変わりません。スタイルを変更したら新しい tag を打つだけです。

## インストール

- スクリプト：[Tampermonkey](https://www.tampermonkey.net/) を入れ、該当する `.user.js` を開いて `Raw` を押して確認します。
- スタイル：jsDelivr の直リンクをコピーしてサイトの外部スタイルシート欄に貼るか、[説明](../../styles/r/README.md)に従って一時的に試します。

## バージョン規則

| モジュール | ルール |
|---|---|
| bluray | `0.0.0.N` の 4 段で増加、1 バージョン 1 ファイル、旧版は上書きも削除もしない；先頭の `@version`、パネルタイトル、注入ログの 3 か所を同期 |
| PTScripts | 上流に従う。本ライブラリはファイルを失わないことだけを保証 |
| styles | スタイルごとに 1 ファイル、変更時にバージョン番号を増やして tag を打ち、古い tag は永久に残して巻き戻せるようにする |

## 構造

```
SEEDPOD/
├── docs/banner.png              カバー画像
├── scripts/
│   ├── bluray/                  原盤転載パネル（docs/ ドキュメント、legacy/ v0.0.0.1 ~ v0.0.0.47）
│   └── PTScripts/               37 個の単一ファイルスクリプト + 索引
├── styles/r/                    Broomhilda Red テーマ
└── README.md
```

## 既知の問題

bluray の再発する問題と未解決項目（K-01 ~ K-14）、および再発の傾向は [`scripts/bluray/README.md`](../../scripts/bluray/README.md) に記録しています。変更前にその節を読んでください。

## ライセンスと免責

コードは [GPL-3.0](../../LICENSE) で提供されます。自由に使用、変更、再配布できますが、変更版を配布する際は同じくオープンソースにし、著作権表示を保持する必要があります。クローズドソースでパッケージ販売することはできません。

個人が、利用許可を得た非公開サイト間でリソースを移す場合に限ります。各サイトの規則に従ってください。転載前に転載禁止がないこと、重複がないことを確認してください。

<p align="center"><sub>大肥鱼 DeepSeek と主任が深夜に情熱を注いで開発した結晶</sub></p>
