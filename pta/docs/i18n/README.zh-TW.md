# 種莢 SEEDPOD（繁體中文）

> 本頁是 [README.md](../../README.md) 的繁體中文譯本。以 English 原文與简体中文為準。
> [简体中文](../../README.md) · [English](../../README.md) · [各語言 / All languages](README.md)

<div align="center">
  <img src="../../docs/banner.png" alt="種莢 · 播種者的衍生庫" width="100%" />
</div>

<h1 align="center">種莢</h1>

<p align="center">SEEDPOD · 播種者的衍生庫</p>

<p align="center"><b>在所有事情上，盡你所能。</b></p>

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

種莢收集直接掛進站點的單檔案外掛：Tampermonkey 腳本與外部樣式表。一個檔案裝進去就生效，沒有建置步驟、沒有依賴、沒有後端。

模組之間互不依賴，裝哪個只看那個模組的文件。

## 模組

| 模組 | 形態 | 做什麼 | 入口 |
|---|---|---|---|
| [`scripts/bluray/`](../../scripts/bluray/) | 使用者腳本 | 原盤轉載面板：批次篩選、跨站查重、BDInfo 排版、截圖轉存、填單推種 | [安裝](../../scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](../../scripts/PTScripts/) | 37 個使用者腳本 | 站點日常操作：上傳輔助、資料自隱、徽章與公告隱藏、批次送禮、下載標記 | [索引](../../scripts/PTScripts/README.md) |
| [`styles/r/`](../../styles/r/) | CSS | Broomhilda Red 淺色主題，站點外掛樣式 | [掛載](../../styles/r/README.md) |

## 說明

**bluray** 是本庫的主力腳本，約 6300 行，把原盤搬運的重複勞動收進一個懸掛面板：按規則篩出合格原盤、向目標站查重、解析詳情頁排版、轉存圖床、填入上傳表單並推送到下載器。適配 NexusPHP、UNIT3D、Gazelle、f3nix 四類站點。文件見[快速上手](../../scripts/bluray/docs/QUICKSTART.md)、[使用手冊](../../scripts/bluray/docs/GUIDE.md)、[架構](../../scripts/bluray/docs/ARCHITECTURE.md)、[開發](../../scripts/bluray/docs/DEVELOPMENT.md)、[AI 上下文](../../scripts/bluray/docs/AI-CONTEXT.md)。

**PTScripts** 是從上游 `DaMauu/Scripts` 整體搬來的腳本合集，檔案原樣保留，只把安裝連結改指向本庫，升級以上游為準。逐個腳本的用途見[索引](../../scripts/PTScripts/README.md)。

**styles/r** 存放站點主題。掛載位址用固定 tag，內容不會漂移；改樣式後打新 tag 即可。

## 安裝

- 腳本：裝 [Tampermonkey](https://www.tampermonkey.net/)，開啟對應 `.user.js` 點 `Raw` 確認。
- 樣式：複製 jsDelivr 直鏈填進站點的外部樣式表欄位，或按[說明](../../styles/r/README.md)臨時測試。

## 版本規則

| 模組 | 規則 |
|---|---|
| bluray | `0.0.0.N` 四段遞增，一版一個檔案，舊版永不覆蓋、永不刪除；頭部 `@version`、面板標題、注入日誌三處同步 |
| PTScripts | 跟隨上游，本庫只保證檔案不丟 |
| styles | 每份樣式一個檔案，改動遞增版本號並打 tag，舊 tag 永久保留可回退 |

## 結構

```
SEEDPOD/
├── docs/banner.png              封面圖
├── scripts/
│   ├── bluray/                  原盤轉載面板（docs/ 文件，legacy/ v0.0.0.1 ~ v0.0.0.47）
│   └── PTScripts/               37 個單檔案腳本 + 索引
├── styles/r/                    Broomhilda Red 主題
└── README.md
```

## 已知問題

bluray 的復發問題與未解決項（K-01 ~ K-14）連同復發規律，記在 [`scripts/bluray/README.md`](../../scripts/bluray/README.md) 裡，改動前先讀那一節。

## 授權與免責

程式碼以 [GPL-3.0](../../LICENSE) 授權：可以自由使用、修改、再散布，但散布修改版時必須同樣開源並保留著作權聲明，不能閉源打包出售。

僅供個人在已獲授權的私有站點之間搬運資源。請遵守各站規則：轉種前確認無禁轉、無重複。

<p align="center"><sub>由大肥魚 DeepSeek 和主任深夜激情開發的結晶</sub></p>
