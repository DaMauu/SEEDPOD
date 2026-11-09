# HANDOFF · SEEDPOD 交接

最后更新：2026-11-09 01:55（Asia/Shanghai）

## 一、这是什么

个人 PT 工具库，全部油猴脚本 + 样式表集中在这里，不再分散到多个仓库。

仓库：`https://github.com/DaMauu/SEEDPOD`（原名 Bluray → SEEDER → SEEDPOD）
本地：`C:\Users\wiii\Desktop\SEEDPOD`
默认分支：`main`

```
SEEDPOD/
├── README.md                    仓库门面（精简导航）
├── .gitignore
├── scripts/
│   ├── README.md                脚本目录说明
│   ├── bluray/                  原盘转载面板（主项目）
│   │   ├── README.md            future 分支那份完整 README（含 K-01~K-14）
│   │   ├── docs/                QUICKSTART / GUIDE / ARCHITECTURE / DEVELOPMENT / AI-CONTEXT + banner、mascot
│   │   └── legacy/              pt-bluray-assistant-v0.0.0.1 ~ v0.0.0.50（50 个）
│   └── PTScripts/               PTScripts 合集：37 个单文件脚本 + 索引 README（38 个文件）
└── styles/
    ├── README.md
    └── r/                       Broomhilda Red 主题 v1.0.4（broomhilda-red.css）
```

## 二、分支

| 分支 | HEAD | 内容 | 说明 |
|---|---|---|---|
| `main` | 4db3b94 | 上述新结构 | 唯一在用的分支 |
| `collab` | 7707db3 | 旧 main 快照：`src/` `dist/` `test/` `package.json` `build.mjs` | 带构建的模块化工程，只做存档，不再演进 |
| `future` | 40d9cc7 | 旧单文件线（`legacy/` + `docs/`） | 历史分支，内容已并入 main，不再提交 |

## 三、当前状态

- 最新版本 **v0.0.0.51**，已落盘、已 `node --check` 通过、已复制到桌面 `原盘转载面板 v0.0.0.51.js`。
- 提交 `4db3b94`（v0.0.0.51 HDArea 预设）**已推送到 GitHub**，本地与 `origin/main` 同步。
- HANDOFF.md 仍未纳入版本库（`?? HANDOFF.md`），保持本地。

## 四、v0.0.0.44 → 50 做了什么

| 版本 | 内容 |
|---|---|
| 0.0.0.44 | f3nix/BHD 全站翻页拉取：补 `multiPage` 白名单 + 翻页循环分支 + 页码上限 + 每 30 页歇 90 秒 |
| 0.0.0.45 | 未查条目显示灰 `⏳ 未查`；「二查」目标扩成「可发 + 未查 + 仅 DIY」 |
| 0.0.0.46 | f3nix 唯一键退到详情地址（slug 无数字 id）；页码参数从分页器反推；抓回同页只留断点不记完成；补诊断日志 |
| 0.0.0.47 | 「自动翻页」兜底：后台抓不动时点站点自己的下一页，逐页记账、跳转后自动续跑、到头自动接查重；设置项「单次翻页上限」（默认 60） |
| 0.0.0.48 | 适配 HDWinG（NexusPHP）：`@match` 加 hdwing.org/.com，站点库加 `HDWing (蝴蝶)` |
| 0.0.0.49 | 修 HDWinG 搜索预设：原 np 预设按 CHDBits 的 id 勾 `cat401`（在 HDWinG 上等于「综艺」）且从不选媒介。新增 HDWinG 专用预设：类型只勾 `cat20` 原盘(Full BD)、媒介只勾 `medium11` Blu-ray、格式/编码/制作组全清空、促销=免费，勾不上时退回 `?cat20=1&medium11=1&spstate=2` |
| 0.0.0.50 | 修 HDWinG 列表解析（点拉取扫到 0 项）：审计与翻页只认 `#torrenttable`/`table.torrents`，HDWinG 用 `table.torrent_list`。补：行选择器 `table.torrent_list > tbody > tr:not(.tab_header)`、标题锚点 `td.t_name h3 a`、分类 `td.t_cat img.catchs`、大小 `td.t_size`、IMDb 从 `get_ext_info_ajax('torrent_N','<imdb>')` 取、禁转 `img[src*=share_rule_1]`；命中「原盘」分类时不再一律标 [复核]。工具条/跳过徽标改挂到 `h3` 外的 `td`（HDWinG 的标题链接在 `h3` 里，原写法会塞进标题）。`WCL Exclusive #NNN`（碟影传媒版本名）不再被当「独占」误杀。翻页 `page=N` 与站点一致（N=0 是第一页 1-100，现有逻辑从 page=1 起抓，正确） |
| 0.0.0.51 | 新增 HDArea 专用预设。通用 np 预设是 CHDBits 系的 id，落在 HDArea 上刚好勾中 `cat401`（Movies Blu-ray）和 `standard1/2/3/5`（1080p/1080i/720p/4K），但 `source*` 在 HDArea 不存在，所以媒介/标签保持站点上次筛选状态，看着像「被改坏」。新预设：类型勾 `cat300`（Movie UHD-4K）+ `cat401`（Movies Blu-ray），媒介勾 `medium1`（Blu-ray），`cat/medium/standard/codec/audiocodec/team/tag` 其余全清，促销=免费；勾不上退回 `?cat300=1&cat401=1&medium1=1&spstate=2` |

## 五、待验证 / 未完成

1. **HDWinG 实测**：搜索预设已被用户截图确认正确（类型=原盘、媒介=Blu-ray、格式空）。列表解析 v0.0.0.50 用用户提供的真实 `table.torrent_list` 片段校对过选择器，但没有在登录页跑完整流程，仍需确认：
   - 点「拉取/查重」后第一条日志应是 `[NexusPHP] 扫描 100 项`，且每行标题上方出现工具条；
   - HDWinG 的置顶（`tr.sticky_bg` + `img.sticky`）会每页重复出现，按 tid 去重，属正常；
   - 若工具条挤压标题排版，给出截图再调插入位置（当前插在 `td.t_name` 内层 `td` 的 `h3` 前）。
   - 另外 HDWinG 的 4K UHD 盘可能挂在 `cat410`（4K UltraHD 类型）而不是 `cat20`，若发现 4K 盘搜不到，把类型改成 `cat20+cat410` 再出一版。
2. **HDArea 预设**：v0.0.0.51 按 PTD 的映射（`cat300`/`cat401`/`medium1`）写，没在登录页实测。验证点：点搜索预设后，类型只剩「Movie UHD-4K」「Movies Blu-ray」勾选，媒介只剩「Blu-ray」，分辨率/编码/制作组/标签全空。若「标签」仍留着中字/国语，说明 tag 用的不是 `tag1`/`tag[]` 命名，需要提供标签那几行的 HTML。
3. **BHD 自动翻页**：v0.0.0.47 的浏览器翻页模式尚未拿到用户实测日志（会不会跳页、页码是否读对、是否被站点拦）。
4. **BHD 预设 500**：v0.0.0.43 改成点表单控件后，未有用户确认日志。
5. **`⏳ 未查` + 二查**：v0.0.0.45 未实测。
6. 遗留问题见 `scripts/bluray/README.md` 的 K-01~K-14，其中未解决：K-08（目标站 429/被踢）、K-12（图床压长图）、K-01（缩略图）、K-02（图床判重）。

## 六、硬性约定（改代码前必读）

1. 版本号 `0.0.0.N` 四段式，每次改动新建文件，**旧版本永不覆盖、永不删除**，作废号不回收。
2. 三处版本串必须同步：头部 `@version`、面板标题 `📀 原盘转载面板 (vX)`、注入日志 `已注入 @`。
3. 标题只从源元素原样取，只在空时填，用户改过就不动。
4. 不保存站点密码；图床只走 SSO 标签页；永不自动提交发布。
5. 文档里不写具体站点名；脚本里的 `@match` / 站点库是功能必需，保留。
6. 单文件脚本只用 `var` + 函数声明，IIFE 包裹，无构建。

## 七、环境与命令

```powershell
# 语法校验
node --check scripts\bluray\legacy\pt-bluray-assistant-v0.0.0.51.user.js

# node 绝对路径（DSH 自带）
C:\Users\wiii\AppData\Local\Programs\DeepSeek Harness\resources\runtime\primary-runtime\dependencies\node\bin\node.exe

# 提交 + 推送（网络经常断，需重试；rejected 时先 pull --rebase）
git -C C:\Users\wiii\Desktop\SEEDPOD add -A
git -C C:\Users\wiii\Desktop\SEEDPOD commit -m "feat(v0.0.0.N): ..."
git -C "C:\Program Files\Git\cmd\git.exe" push origin main
```

新增版本的标准流程：复制上一个 `legacy/*.user.js` → 改三处版本串 → 改代码 → `node --check` → 复制到 `C:\Users\wiii\Desktop\原盘转载面板 vX.Y.Z.N.js` → 删掉桌面上的旧版（只留最新一份，历史全在仓库 `legacy/`）→ 提交推送。

## 八、踩过的坑（不要再踩）

- **PowerShell 拼接 JS**：CRLF 和中文块会让字符串替换失配，出现重复行或丢花括号。优先用精确替换工具，必须拼接就立刻 `node --check`。
- **`Set-Content -NoNewline`**：传数组会把整个文件拍成一行，文本文件要用 `[System.IO.File]::WriteAllText` 或 `Get-Content -Raw` + `Set-Content -NoNewline`。
- **站点适配有五个入口**：`AUDIT_HANDLERS`、`PRESET_HANDLERS`、`siteUrl`、翻页白名单、详情穿透。漏一处就是静默失败还显示「完成」。
- **后台翻页**：不少站点的筛选存在服务端会话里，`GM_xmlhttpRequest` 带 page 参数拿回来仍是同一页，要退到「浏览器翻页」。
- **桌面只留最新一份交付文件**，且与仓库同版本文件字节一致；旧版桌面副本发新版后删掉（2026-11-09 已清掉 v43~v50），回滚从 `legacy/` 取。
