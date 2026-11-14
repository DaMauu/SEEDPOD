# 贡献指南 / Contributing

[中文](#中文) · [English](#english) · [繁體中文](docs/i18n/CONTRIBUTING.zh-TW.md) · [日本語](docs/i18n/CONTRIBUTING.ja.md) · [한국어](docs/i18n/CONTRIBUTING.ko.md) · [Русский](docs/i18n/CONTRIBUTING.ru.md) · [Deutsch](docs/i18n/CONTRIBUTING.de.md) · [Français](docs/i18n/CONTRIBUTING.fr.md) · [Español](docs/i18n/CONTRIBUTING.es.md) · [Português](docs/i18n/CONTRIBUTING.pt.md) · [Italiano](docs/i18n/CONTRIBUTING.it.md) · [Nederlands](docs/i18n/CONTRIBUTING.nl.md) · [Polski](docs/i18n/CONTRIBUTING.pl.md) · [Türkçe](docs/i18n/CONTRIBUTING.tr.md) · [Tiếng Việt](docs/i18n/CONTRIBUTING.vi.md) · [ไทย](docs/i18n/CONTRIBUTING.th.md) · [Bahasa Indonesia](docs/i18n/CONTRIBUTING.id.md) · [العربية](docs/i18n/CONTRIBUTING.ar.md)

---

## 中文

感谢你愿意改进种荚。先读这一页，能省掉大部分来回。

### 这个库的形态

单文件外挂：Tampermonkey 用户脚本与外部样式表。**没有构建、没有依赖、没有后端**，一个文件装进去就生效。提 PR 时不要引入打包器、npm 依赖或编译步骤。

### 目录约定

| 路径 | 放什么 |
|---|---|
| `scripts/bluray/legacy/` | bluray 面板的发布版本，一版一个文件 |
| `scripts/bluray/docs/` | 快速上手、使用手册、架构、开发指南 |
| `scripts/PTScripts/` | 站点小工具合集，跟随上游 `DaMauu/Scripts` |
| `styles/r/` | 站点主题样式 |
| `pta/` | SEEDPOD 面板（Vue 3 + Fastify + SQLite） |

### 版本规则

- **bluray**：文件名 `pt-bluray-assistant-v0.0.0.N.user.js`，四段递增。**旧版永不覆盖、永不删除**，改一版就新增一个文件。头部 `@version`、面板标题、注入日志三处必须同步。
- **styles**：每份样式一个文件，改动递增版本号并打 tag，旧 tag 永久保留可回退。
- **PTScripts**：本库只保证文件不丢，升级以上游 `DaMauu/Scripts` 为准。要改这些脚本，请先向上游提交，再同步回来。

### 提交前自查

1. 脚本能直接在 Tampermonkey 里装上、在目标站点跑通，不是「理论可用」。
2. 说明在哪些站点类型上验证过（NexusPHP / UNIT3D / Gazelle / f3nix），最好给出站点名。
3. 删除调试用的 `console.log`、本地路径和测试账号。
4. 不要提交本地真实站点数据：`data/site-defs/`、`pta/data/site-arch.local.csv` 已在 `.gitignore` 里，别用 `-f` 强推。
5. **绝对不要提交**任何 Cookie、passkey、Tracker 密钥、API key 或带个人信息的截图。

### 提交信息

中文简述改了什么、影响哪个模块，例如：

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

### Pull Request

- 一个 PR 只做一件事，别把无关格式化混进来。
- 在描述里写清：动机、影响的模块、验证方式与结果、是否会影响旧版本文件。
- 修改了面板或样式时附截图，但先遮挡账号与密钥。

### Issue

有 bug 或需求先开 Issue，按模板填写。安全问题不要开公开 Issue，走 [SECURITY.md](SECURITY.md)。

---

## English

Thanks for improving SEEDPOD. Skim this page first — it saves most of the back-and-forth.

### What this repository is

Single-file add-ons: Tampermonkey userscripts and external stylesheets. **No build, no dependencies, no backend** — drop one file in and it works. Do not introduce bundlers, npm dependencies, or compile steps in a PR.

### Layout

| Path | Contents |
|---|---|
| `scripts/bluray/legacy/` | Released bluray panel versions, one file per version |
| `scripts/bluray/docs/` | Quickstart, guide, architecture, development notes |
| `scripts/PTScripts/` | Tracker utility collection, tracking upstream `DaMauu/Scripts` |
| `styles/r/` | Tracker theme styles |
| `pta/` | Local tracker architecture notes page |

### Versioning

- **bluray**: filename `pt-bluray-assistant-v0.0.0.N.user.js`, four segments incrementing. **Never overwrite or delete an old version** — add a new file instead. The `@version` header, the panel title, and the injection log line must all match.
- **styles**: one file per style, bump the version and tag on change; old tags stay forever so users can roll back.
- **PTScripts**: this repo only guarantees the files stay online; upstream `DaMauu/Scripts` is the source of truth. Submit changes upstream first, then sync back.

### Before you submit

1. The script installs in Tampermonkey and actually works on the target site — not "should work".
2. Say which tracker types you verified (NexusPHP / UNIT3D / Gazelle / f3nix); site names help.
3. Remove debug `console.log`s, local paths, and test accounts.
4. Do not commit local tracker data: `data/site-defs/` and `pta/data/site-arch.local.csv` are gitignored — never `git add -f` them.
5. **Never commit** cookies, passkeys, tracker keys, API keys, or screenshots containing personal data.

### Commit messages

A short description of what changed and which module it touches, for example:

```
bluray: 修复 UNIT3D 站点填单时海报字段丢失
styles/r: 调深列表分隔线
```

Chinese or English both fine.

### Pull requests

- One concern per PR; keep unrelated formatting out.
- Describe: motivation, affected modules, how you verified it and the result, and whether old version files are touched.
- Include screenshots for panel or style changes — with accounts and keys masked.

### Issues

File bugs and requests using the templates. For security issues, do not open a public Issue — see [SECURITY.md](SECURITY.md).
