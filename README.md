<div align="center">
  <img src="docs/banner.png" alt="种荚 · 播种者的衍生库" width="100%" />
</div>

<h1 align="center">种荚</h1>

<p align="center">SEEDPOD · 播种者的衍生库</p>

<p align="center"><b>在所有事情上，尽你所能。</b></p>

<p align="center">
  <img src="https://img.shields.io/badge/userscripts-37-000000?style=flat-square&logo=tampermonkey" />
  <img src="https://img.shields.io/badge/styles-1-8c796a?style=flat-square" />
  <img src="https://img.shields.io/badge/build-none%20%C2%B7%20single--file-success?style=flat-square" />
  <img src="https://img.shields.io/badge/branch-main-8957e5?style=flat-square" />
</p>

---

种荚收集直接挂进站点的单文件外挂：Tampermonkey 脚本与外部样式表。一个文件装进去就生效，没有构建步骤、没有依赖、没有后端。

模块之间互不依赖，装哪个只看那个模块的文档。

## 模块

| 模块 | 形态 | 规模 | 做什么 | 入口 |
|---|---|---|---|---|
| [`scripts/bluray/`](scripts/bluray/) | 单个 `.user.js` | 7129 行 | 原盘转载面板：批量筛选、跨站查重、BDInfo 排版、截图转存、填单推种 | [安装](scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](scripts/PTScripts/) | 37 个 `.user.js` | 每个 17~1947 行 | 站点日常操作：上传辅助、数据自隐、徽章与公告隐藏、批量送礼、下载标记 | [索引](scripts/PTScripts/README.md) |
| [`styles/r/`](styles/r/) | 单个 `.css` | 2666 行 | Broomhilda Red 浅色主题，站点外部样式表 | [挂载](styles/r/README.md) |

## 技术

| | bluray | PTScripts | styles/r |
|---|---|---|---|
| 运行环境 | Tampermonkey，`@run-at document-end` | Tampermonkey | 站点「外部样式表」字段 / jsDelivr |
| 语言 | ES2017（async/await、IIFE、无框架） | ES5/ES2017 混写 | 原生 CSS |
| 第三方依赖 | 无 | 部分脚本 `@require` jQuery 3.6 | 无 |
| 构建 | 无，单文件直发 | 无 | 无 |
| 数据存储 | `GM_setValue` / `GM_getValue` 键值 | 视脚本而定 | 无 |
| 版本方式 | `0.0.0.N` 四段递增，一版一文件 | 跟随上游 | jsDelivr tag 固定 |

### bluray 实现要点

- **权限**：`GM_xmlhttpRequest`（跨域抓取、图床上传）、`GM_setValue`/`GM_getValue`（词库、断点、设置）、`GM_addStyle`（面板样式）、`GM_setClipboard`、`GM_openInTab`、`unsafeWindow`，`@connect *`。
- **网络**：以 `GM_xmlhttpRequest` 走跨域，`fetch` / `XMLHttpRequest` 兜底；返回的 HTML 用 `DOMParser` 解析成文档再查，不注入页面。
- **存储**：全部走 GM 键值，按「站点 + 功能」分区；查重词库分片存储、带 30 天有效期、支持 JSON 导入导出；断点记录页号、列表地址与已查种子。
- **状态**：断点、暂停、限流退避、配额都是显式状态，重登后按保存时间回跳，两次拉取默认间隔 10 分钟。
- **布局**：单份 CSS 由 `GM_addStyle` 注入，网格用 `minmax(0,1fr)` + 固定行高 + `min-width:0`，避免内容把面板撑变形。
- **图片**：候选地址逐个用 `Image` 测 `naturalWidth` 取原图，`Blob` + `FormData` 二进制上传图床，返图再测宽复核。
- **对外集成**：qBittorrent WebUI API 推送种子并补设分类；图床直连（必要时走 PterClub 单点登录）；NexusPHP、UNIT3D、Gazelle、f3nix、M-Team 五类站点适配。
- **代码风格**：单文件 IIFE，整体 `try/catch` 兜底，出错不打断站点自身脚本；不用箭头函数堆砌，便于直接读改。

### styles/r 与 PTScripts

`styles/r` 是纯 CSS 主题：135 个自定义属性、398 处 `var()`、4 个 `@media` 断点，覆盖站点原有样式靠 `!important`（272 处），版本靠 jsDelivr 固定 tag 保证内容不漂移。

`PTScripts` 是 37 个互相独立的脚本，`@grant` 多为 `none` 或 `GM_xmlhttpRequest`，部分通过 `@require` 引入 jQuery；本库只保证文件完整，升级以上游为准。

## 安装

- 脚本：装 [Tampermonkey](https://www.tampermonkey.net/)，打开对应 `.user.js` 点 `Raw` 确认。
- 样式：复制 jsDelivr 直链填进站点的外部样式表字段，或按[说明](styles/r/README.md)临时测试。

## 版本规则

| 模块 | 规则 |
|---|---|
| bluray | `0.0.0.N` 四段递增，一版一个文件，旧版永不覆盖、永不删除；头部 `@version`、面板标题、注入日志三处必须同步 |
| PTScripts | 跟随上游 `DaMauu/Scripts`，本库只保证文件不丢 |
| styles | 每份样式一个文件，改动递增版本号并打 tag，旧 tag 永久保留可回退 |

## 结构

```
SEEDPOD/
├── docs/banner.png              封面图
├── scripts/
│   ├── bluray/                  原盘转载面板（docs/ 文档，legacy/ v0.0.0.1 ~ v0.0.0.47）
│   └── PTScripts/               37 个单文件脚本 + 索引
├── styles/r/                    Broomhilda Red 主题
└── README.md
```

## 已知问题

bluray 的复发问题与未解决项（K-01 ~ K-14）连同复发规律，记在 [`scripts/bluray/README.md`](scripts/bluray/README.md) 里，改动前先读那一节。

## 许可与免责

仅供个人在已获授权的私有站点之间搬运资源。请遵守各站规则：转种前确认无禁转、无重复。

<p align="center"><sub>由大肥鱼 DeepSeek 和主任深夜激情开发的结晶</sub></p>
