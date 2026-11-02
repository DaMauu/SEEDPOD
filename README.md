<div align="center">

<h1>种荚</h1>

<p><b>在所有事情上，尽你所能。</b></p>

<p>SEEDPOD · 播种者的衍生库</p>

</div>

---

种荚（SEEDPOD）是播种者的衍生库。

播种者负责开头，种荚负责把长出来的东西收拢、护住、交给下一双手。凡是播种者已有的能力，这里不重做；这里只放那些从它派生出去、又值得单独留一份的东西——一个脚本一个目录，各带各的文档，互不干扰。

## 目录

| 目录 | 是什么 | 文档 |
|---|---|---|
| [`scripts/bluray/`](scripts/bluray/) | 原盘转载面板，Tampermonkey 单文件脚本，筛选 · 查重 · 排版 · 填单 · 推种 | [说明](scripts/bluray/README.md) · [快速上手](scripts/bluray/docs/QUICKSTART.md) · [使用手册](scripts/bluray/docs/GUIDE.md) |
| [`scripts/PTScripts/`](scripts/PTScripts/) | 站点小工具合集，37 个单文件脚本 | [索引](scripts/PTScripts/README.md) |
| [`styles/`](styles/) | 站点样式表 | [说明](styles/README.md) |

## 安装

各脚本互不依赖，装哪个看哪个的文档：

- 原盘转载面板：装 [Tampermonkey](https://www.tampermonkey.net/) → 打开 [`scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js`](scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) → 点 `Raw` 确认。
- PTScripts：打开 [`scripts/PTScripts/README.md`](scripts/PTScripts/README.md)，表格里点脚本名即装。

## 与播种者的关系

这个库不在播种者的主线里，也不打算取代它。派生意味着两件事：一是上游改动要能被带下来，二是这里只放已经跑通、值得留底的部分，实验性内容不往上塞。

## 已知问题

原盘转载面板的复发问题与未解决项，连同复发规律一起记在 [`scripts/bluray/README.md`](scripts/bluray/README.md#反复出现与未解决的问题) 里，接手前先读那一节。

## 许可与免责

仅供个人在已获授权的私有 PT 站之间搬运资源。请遵守各站规则：转种前确认无禁转、无重复。

<p align="center"><sub>由大肥鱼 DeepSeek 和主任深夜激情开发的结晶</sub></p>
