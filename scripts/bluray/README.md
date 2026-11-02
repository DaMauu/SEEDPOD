# bluray — 原盘转载面板

单文件脚本，一个 `.user.js` 直接装，不需要构建、没有依赖。

来源：原 `Bluray` 仓库 `future` 分支的 `legacy/` 全量（v0.0.0.1 → v0.0.0.47），一个版本一个文件，**旧版本永不覆盖、永不删除**，回退时直接装旧号即可。

```
pt-bluray-assistant-v0.0.0.47.user.js   当前版本（安装这个）
pt-bluray-assistant-v0.0.0.1.user.js    最早的版本
...
```

用法：点开文件 → `Raw` → Tampermonkey 确认安装。

约定：

- 每次改动新建下一个版本号的文件，不原地改。
- 三个版本串必须同步：头部 `@version`、面板标题里的 `(vX)`、注入日志 `已注入 @`。
- 带构建的模块化工程（src/ dist/ test/）不在本分支，保留在 `collab` 分支。
