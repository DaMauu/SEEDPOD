# 贡献指南

感谢你愿意改进种荚。先读这一页，能省掉大部分来回。

## 这个库的形态

单文件外挂：Tampermonkey 用户脚本与外部样式表。**没有构建、没有依赖、没有后端**，一个文件装进去就生效。提 PR 时不要引入打包器、npm 依赖或编译步骤。

## 目录约定

| 路径 | 放什么 |
|---|---|
| `scripts/bluray/legacy/` | bluray 面板的发布版本，一版一个文件 |
| `scripts/bluray/docs/` | 快速上手、使用手册、架构、开发指南 |
| `scripts/PTScripts/` | 站点小工具合集，跟随上游 `DaMauu/Scripts` |
| `styles/r/` | 站点主题样式 |
| `pta/` | 本地站点架构整理页 |

## 版本规则

- **bluray**：文件名 `pt-bluray-assistant-v0.0.0.N.user.js`，四段递增。**旧版永不覆盖、永不删除**，改一版就新增一个文件。头部 `@version`、面板标题、注入日志三处必须同步。
- **styles**：每份样式一个文件，改动递增版本号并打 tag，旧 tag 永久保留可回退。
- **PTScripts**：本库只保证文件不丢，升级以上游 `DaMauu/Scripts` 为准。要改这些脚本，请先向上游提交，再同步回来。

## 提交前自查

1. 脚本能直接在 Tampermonkey 里装上、在目标站点跑通，不是「理论可用」。
2. 说明在哪些站点类型上验证过（NexusPHP / UNIT3D / Gazelle / f3nix），最好给出站点名。
3. 删除调试用的 `console.log`、本地路径和测试账号。
4. 不要提交本地真实站点数据：`pta/web/assets/sites-data.local.js`、`pta/data/site-arch.local.csv` 已在 `.gitignore` 里，别用 `-f` 强推。
5. **绝对不要提交**任何 Cookie、passkey、Tracker 密钥、API key 或带个人信息的截图。

## 提交信息

中文简述改了什么、影响哪个模块，例如：

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

## Pull Request

- 一个 PR 只做一件事，别把无关格式化混进来。
- 在描述里写清：动机、影响的模块、验证方式与结果、是否会影响旧版本文件。
- 修改了面板或样式时附截图，但先遮挡账号与密钥。

## Issue

有 bug 或需求先开 Issue，按模板填写。安全问题不要开公开 Issue，走 [SECURITY.md](SECURITY.md)。
