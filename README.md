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

| 模块 | 形态 | 做什么 | 入口 |
|---|---|---|---|
| [`scripts/bluray/`](scripts/bluray/) | 用户脚本 | 原盘转载面板：批量筛选、跨站查重、BDInfo 排版、截图转存、填单推种 | [安装](scripts/bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js) |
| [`scripts/PTScripts/`](scripts/PTScripts/) | 37 个用户脚本 | 站点日常操作：上传辅助、数据自隐、徽章与公告隐藏、批量送礼、下载标记 | [索引](scripts/PTScripts/README.md) |
| [`styles/r/`](styles/r/) | CSS | Broomhilda Red 浅色主题，站点外挂样式 | [挂载](styles/r/README.md) |

## 说明

**bluray** 是本库的主力脚本，约 6300 行，把原盘搬运的重复劳动收进一个挂起面板：按规则筛出合格原盘、向目标站查重、解析详情页排版、转存图床、填入上传表单并推送到下载器。适配 NexusPHP、UNIT3D、Gazelle、f3nix 四类站点。文档见[快速上手](scripts/bluray/docs/QUICKSTART.md)、[使用手册](scripts/bluray/docs/GUIDE.md)、[架构](scripts/bluray/docs/ARCHITECTURE.md)、[开发](scripts/bluray/docs/DEVELOPMENT.md)、[AI 上下文](scripts/bluray/docs/AI-CONTEXT.md)。

**PTScripts** 是从上游 `DaMauu/Scripts` 整体搬来的脚本合集，文件原样保留，只把安装链接改指向本库，升级以上游为准。逐个脚本的用途见[索引](scripts/PTScripts/README.md)。

**styles/r** 存放站点主题。挂载地址用固定 tag，内容不会漂移；改样式后打新 tag 即可。

## 安装

- 脚本：装 [Tampermonkey](https://www.tampermonkey.net/)，打开对应 `.user.js` 点 `Raw` 确认。
- 样式：复制 jsDelivr 直链填进站点的外部样式表字段，或按[说明](styles/r/README.md)临时测试。

## 版本规则

| 模块 | 规则 |
|---|---|
| bluray | `0.0.0.N` 四段递增，一版一个文件，旧版永不覆盖、永不删除；头部 `@version`、面板标题、注入日志三处同步 |
| PTScripts | 跟随上游，本库只保证文件不丢 |
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
