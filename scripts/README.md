# scripts

脚本目录。每个脚本（或一组脚本）一个子目录，互不干扰。

```
scripts/
├── README.md        本文件
├── bluray/          原盘转载面板
│   ├── README.md
│   ├── docs/        快速上手、使用手册、架构、开发指南、AI 上下文、封面与角色图
│   └── legacy/      pt-bluray-assistant-v0.0.0.1 ~ v0.0.0.47，一版一个文件
└── PTScripts/       PterClub / Gazelle / GGn 等站点的小工具合集
    ├── README.md    索引（表格，点名字直接装）
    └── *.user.js    36 个单文件脚本 + 1 个无扩展名文件
```

## bluray

单文件油猴脚本，装一个 `.user.js` 就能用，不需要构建、没有依赖。来源是原 `Bluray` 仓库 `future` 分支的 `legacy/` 全量。

- 当前版本：`bluray/legacy/pt-bluray-assistant-v0.0.0.47.user.js`，点开 → `Raw` → Tampermonkey 确认
- 版本规则：`0.0.0.N` 四段式递增，**旧版本永不覆盖、永不删除**，回退时直接装旧号
- 每次改动新建下一个版本号的文件，不原地改；三个版本串必须同步：头部 `@version`、面板标题里的 `(vX)`、注入日志 `已注入 @`
- 带构建的模块化工程（`src/` `dist/` `test/` `package.json`）不在 `main` 分支，保留在 `collab` 分支

## PTScripts

从 `DaMauu/Scripts` 仓库整体搬过来的脚本合集，文件原样保留，只把合集 `README.md` 里的安装链接改指向本库路径。

- 入口：`PTScripts/README.md`，表格里点脚本名即装
- 覆盖站点：PterClub（PTC_ 系列）、Gazelle 系（PT_GzMusic 系列）、GGn、FSM 等
- 这些不是本项目维护的脚本，升级以上游为准；本库里只保证文件不丢
