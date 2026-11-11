# Contributing（繁體中文）

> 本頁是 [CONTRIBUTING.md](../../CONTRIBUTING.md) 的繁體中文譯本。以 English 原文與简体中文為準。
> [简体中文](../../CONTRIBUTING.md) · [English](../../CONTRIBUTING.md) · [各語言 / All languages](README.md)

感謝你願意改進種莢（SEEDPOD）。先讀這一頁，能省掉大部分來回。

### 這個庫的形態

單檔外掛：Tampermonkey 使用者腳本與外部樣式表。**沒有建置、沒有依賴、沒有後端**，一個檔案裝進去就生效。提 PR 時不要引入打包器、npm 依賴或編譯步驟。

### 目錄約定

| 路徑 | 放什麼 |
|---|---|
| `scripts/bluray/legacy/` | bluray 面板的發行版本，一版一個檔案 |
| `scripts/bluray/docs/` | 快速上手、使用手冊、架構、開發指南 |
| `scripts/PTScripts/` | 站點小工具合集，跟隨上游 `DaMauu/Scripts` |
| `styles/r/` | 站點主題樣式 |
| `pta/` | 本地站點架構整理頁 |

### 版本規則

- **bluray**：檔名 `pt-bluray-assistant-v0.0.0.N.user.js`，四段遞增。**舊版永不覆蓋、永不刪除**，改一版就新增一個檔案。頭部 `@version`、面板標題、注入日誌三處必須同步。
- **styles**：每份樣式一個檔案，改動遞增版本號並打 tag，舊 tag 永久保留可回退。
- **PTScripts**：本庫只保證檔案不丟，升級以上游 `DaMauu/Scripts` 為準。要改這些腳本，請先向上游提交，再同步回來。

### 提交前自查

1. 腳本能直接在 Tampermonkey 裡裝上、在目標站點跑通，不是「理論可用」。
2. 說明在哪些站點類型上驗證過（NexusPHP / UNIT3D / Gazelle / f3nix），最好給出站點名。
3. 刪除除錯用的 `console.log`、本地路徑和測試帳號。
4. 不要提交本地真實站點資料：`pta/web/assets/sites-data.local.js`、`pta/data/site-arch.local.csv` 已在 `.gitignore` 裡，別用 `-f` 強推。
5. **絕對不要提交**任何 Cookie、passkey、Tracker 金鑰、API key 或帶個人資訊的截圖。

### 提交訊息

簡述改了什麼、影響哪個模組，例如：

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

中文或英文皆可。

### Pull Request

- 一個 PR 只做一件事，別把無關格式化混進來。
- 在描述裡寫清：動機、影響的模組、驗證方式與結果、是否會影響舊版本檔案。
- 修改了面板或樣式時附截圖，但先遮擋帳號與金鑰。

### Issue

有 bug 或需求先開 Issue，按模板填寫。安全問題不要開公開 Issue，走 [SECURITY.md](../../SECURITY.md)。
