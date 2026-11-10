# HANDOFF · SEEDPOD 面板

最后更新：2026-11-10

先读 [AGENTS.md](AGENTS.md)：铁律、必须一起发的文件、发版命令、故障对照都在那里，聊天被压缩后以它为准。

## 现在是什么状态

前端 7 个页面 + 登录页，全部交互可点（142 个交互点无死按钮）。
后端是本机 Node 零依赖服务，已实现：会话登录、配置读写、站点清单、事件日志、SSE、静态托管。

线上：源码直跑在测试机 `/opt/seedpod`，systemd 服务 `seedpod`，nginx 反代 + Cloudflare，入口是 pta 开头的那个域名。
开机自启已配；改完代码 `systemctl restart seedpod` 生效。

测试机上 `/opt/seedpod` **不是 git 仓库**，发版是复制文件（发前先备份到 `/opt/seedpod/backup-时间戳/`）：

22 端口时通时断，scp 经常整条失败，用 base64 走 ssh 更稳（发完务必比 md5）：

```
for f in server/app.js pta/web/index.html pta/web/assets/app.js pta/web/assets/app.css; do
  base64 -w0 "$f" | ssh pta "base64 -d > /opt/seedpod/$f"
done
md5sum server/app.js pta/web/index.html pta/web/assets/app.js pta/web/assets/app.css
ssh pta 'md5sum /opt/seedpod/server/app.js /opt/seedpod/pta/web/index.html /opt/seedpod/pta/web/assets/app.js /opt/seedpod/pta/web/assets/app.css'
ssh pta 'systemctl restart seedpod && systemctl is-active seedpod'
```

发版要带上的文件（少一个就起不来或页面白屏）：

- `server/app.js` 与 `server/adapters/nexusphp.js`（少了 adapter 会 MODULE_NOT_FOUND 起不来）
- `pta/web/index.html`、`pta/web/assets/app.js`、`pta/web/assets/app.css`、`pta/web/assets/data.js`
- `data/site-defs/<host>.json`（站点定义，按需）

不要覆盖 `pta/web/assets/sites-data.local.js`、`pta/data/site-arch.local.csv`、`data/` 下任何文件。
Cloudflare 会缓存不带版本号的 js，换版本一定同步改 `index.html` 里的 `?v=`。

## 后端接口（已实现）

| 接口 | 说明 |
| --- | --- |
| GET /api/health | 探活，不需要登录 |
| POST /api/login | 账号密码换 HttpOnly 会话 cookie（12h） |
| GET /api/session | 当前是否已登录 |
| POST /api/logout | 注销 |
| GET /api/config | 系统硬底线 + 用户配置 + 双模式区间 |
| PATCH /api/config/user | 改速率，越界 400 |
| GET /api/sites | 305 个站点（host/url/arch）与架构统计 |
| GET /api/site-config | 服务端保存的站点配置（白名单字段） |
| PUT /api/site-config/:host | 合并写站点配置，密码/cookie/totp 拒收 |
| DELETE /api/site-config/:host | 删掉站点配置并恢复默认 |
| GET /api/credentials | 站点凭据状态（只回 hasCookie） |
| PUT /api/credentials/:host | 加密保存 cookie |
| DELETE /api/credentials/:host | 删除凭据 |
| POST /api/sites/:host/session-test | 只用 cookie 做一次会话自检（不碰密码与 2FA） |
| GET /api/flow | 抓取/查重/发布三套规则的服务端存档 |
| PUT /api/flow | 合并保存流程规则（形状有校验） |
| GET /api/site-search | 所有站点预设的汇总（列表页标已确认/未确认用） |
| GET /api/sites/:host/search | 该站的搜索预设（引擎/路径/参数名/分类 id） |
| PUT /api/sites/:host/search | 合并写搜索预设，字段有校验 |
| DELETE /api/sites/:host/search | 删搜索预设 |
| GET /api/downloaders | 已配置的下载器（密码只回 hasPass） |
| POST /api/downloaders | 新增下载器，地址必须是 http/https |
| PUT /api/downloaders/:id | 按字段改下载器 |
| DELETE /api/downloaders/:id | 删除下载器 |
| POST /api/downloaders/:id/test | 只连它自己填的地址做一次连通性探测 |
| GET /api/library | 本地片库（查重用，最多 2000 条） |
| POST /api/library | 新增本地库条目 |
| DELETE /api/library/:id | 删除本地库条目 |
| POST /api/queue/:id/check | 本地查重（队列 + 本地库，不联网），回写 check/checkCls |
| GET /api/queue | 待审核条目与各状态计数 |
| POST /api/queue | 新增待审核条目（title 必填） |
| GET /api/queue/:id | 单条详情 |
| POST /api/queue/:id/action | approve / reject / publish，带状态机校验与发布前置校验（缺标题/预设/下载器时 409 PUBLISH_BLOCKED） |
| DELETE /api/queue/:id | 删除条目 |
| POST /api/tasks | 提交干跑任务（只接 dryRun，不访问外部站点）；带 plan：页数/并发/分类组/预估查询数/警告 |
| GET /api/tasks | 最近 50 条任务，`?state=active` 只看在跑的 |
| GET /api/tasks/:id | 单条任务与步骤进度 |
| POST /api/tasks/:id/cancel | 取消排队/运行中的任务 |
| GET /api/logs | 最近事件，支持 level/src/since/limit 过滤 |
| GET /api/logs/stream | SSE，断线按 id 补历史 |

事件会写进 `data/events.log`：服务启动、登录成功/失败、退出、改配置、改站点配置、改搜索预设、待审核条目增删与状态变更、干跑任务新建与完成、任务取消。

数据文件（都在 `data/` 下，0600）：`config.json` 面板配置、`site-config.json` 站点配置（密码类字段不落盘）、
`queue.json` 待审核条目、`downloaders.json` 下载器（密码只写不读）、`site-search.local.json` 搜索预设（在 `pta/data/`，不入库）。

## 搜索预设怎么来的（可复现）

用本机 Chrome 的登录态读每个站的种子页（`/torrents.php` 或 `/torrents`），从页面里解析三类写法：
分类链接（`?cat=401`、`cat406=1`）、下拉框 option、图标 `img[title]`；再按标签关键词归到用途（movie/tv/doc/anime/music/book/game/other），
顺带记下该页真实存在的搜索参数名（`search` / `search_area` / `search_mode`，UNIT3D 是 `name` + `categories[]`，Gazelle 是 `searchstr` + `filter_cat[]`）。

Chrome 必须以 `--remote-debugging-port=9222` 启动，脚本用 CDP 连过去，每站新开标签、只发一次 GET、读完即关，站与站之间停 4 秒。
采集结果写 `pta/data/site-search.local.json`，再复制到 `/opt/seedpod/data/` 并重启服务。

截至 2026-11-10：已采 7 站 / 108 个分类 id，其余站点还没采。

## 站点搜索预设为什么单独存

同一个分类 id 在不同站点对应的类型不一样，搜索参数名也各不相同（nexusphp 用 search/cat，unit3d 用 name/categories[]，gazelle 用 searchstr/filter_cat）。
写死一套会导致「想搜电影却点到别的类型」，所以按站存一份：引擎、搜索路径、参数名、每个用途对应的分类 id。
真实预设只在本机与测试机，仓库里只有 `docs/site-search.example.json` 示例。

## 线上验证（最近一次）

改了四个文件后重启，实测：登录通过、`/api/sites` 305 条（NP 83 / UNIT3D 46）、`/api/site-search` 0 条（还没采）、
`/api/queue` 0 条、`/api/downloaders` 0 条、干跑任务能提交并按 5 步跑完、公网入口 200。
带 `?v=` 的新前端已经生效，不带版本号的 app.js 仍是 Cloudflare 旧缓存。

## 站点适配（新）

- `server/adapters/nexusphp.js`：纯解析层，`detect / parseCategories / parseList / buildSearchUrl / parseLoginForm`，不发任何请求
- `pta/fixtures/nexusphp-browse.html`：脱敏夹具，`pta/checks/adapter.js` 5 条断言守着它
- `pta/data/site-defs/<host>.json`：每站一份定义（登录、搜索参数、分类、限速），由 `scripts/collect-site-defs.js` 从采集结果生成，不入库
- 示例结构见 `docs/site-def.example.json`

真实页面回放（本机保存的、脱敏前不落库）：三页各 100 行，标题/分类/下载链接都是 100/100，
大小字段还没对齐——这几个站的大小不在行内文本里（有被用户脚本改写或放在别的列），要按站单独取。

适配器的坑记一下：NexusPHP 的行内嵌了 `<table>`，按 `<tr>` 切行会把一行切成几段；
现在改成「按 details.php 链接定位 + 前后窗口取字段」，并且必须排除 `userdetails.php`（它包含 `details.php` 子串）。

## 站点凭据（只有 cookie）

站点登录改成只用 cookie：面板里粘贴或由脚本导入，服务端 AES-256-GCM 加密存 `data/credentials.json`，
接口只回 `hasCookie`，`POST /api/sites/:host/session-test` 用 cookie 访问首页判活。账号密码与 2FA 已移除；
面板自己的登录（`PTA_USER`/`PTA_PASS`）没有动。

## 旧记录：凭据与登录自检

`server/totp.js` 已删除，相关接口与测试一并移除，这一节只留作历史。

- `server/secretbox.js`：AES-256-GCM 加解密，密钥 `PTA_SECRET` → `data/.secret`（0600）
- `data/credentials.json`：只存密文；接口与日志都不出现明文
- 登录页采样用无痕上下文（否则已登录会跳走）：7 站里 6 站拿到表单，其中 2 站有 2FA 字段

## cookie 导入流程（推荐路径）

```
node scripts/import-cookies.js                 # 本机 Chrome（9222）读各站 cookie → pta/data/cookies.tmp.json（0600）
base64 -w0 pta/data/cookies.tmp.json | ssh pta "base64 -d > /tmp/cookies.json && chmod 600 /tmp/cookies.json"
ssh pta 'cd /opt/seedpod && PTA_DATA=/opt/seedpod/data node scripts/load-cookies.js /tmp/cookies.json; rm -f /tmp/cookies.json'
```

服务端用 `data/.secret` 加密后写 `data/credentials.json`；接口只回 `hasCookie`。
2026-11-10 实测：导入 7 站，服务端用这些 cookie 访问首页全部判定为可用（服务端 IP 与浏览器不同也没被拦）。

## 批量采样（脚本）

`node scripts/sample-sites.js [数量] [偏移]`：连本机 Chrome 的调试端口（9222），逐站打开种子页、等渲染后取 `page.content()`，
gzip 存到 `pta/data/samples/<host>.html.gz`，状态写 `_state.json`。

- 每站只发一次 GET，读完关标签，站间随机 4–6 秒
- 已有样本自动跳过，可以按偏移分批续跑
- 样本与状态都在 `pta/data/` 下，不入库

2026-11-10 首批 12 站：10 个存下（1 个页面过小、1 个证书链无效直接跳过），离线分析 8/10 可解析（分类与列表都出来了），
另外 2 个不是 NexusPHP 结构、需要单独看；大小字段普遍还取不到，按站的表格列差异较大。

## 站点适配现状（2026-11-10 全量采样后）

清单 307 个站，**每站都有站点定义与搜索预设**：

- 真实采样确认引擎：91 站（其中 7 站是 JS 空壳页，按页面资源特征认出引擎、分类待补）
- 按清单架构推断：216 站（定义里 source.kind=arch，预设 source=arch，面板上标「按清单架构推断」）
- 没拿到的原因是登录墙、连不上、Cloudflare、路径 404、停放域名，分类清单见 pta/data/blocked-*.txt（不入库）

当前原始样本 113 份在 `pta/data/samples/`（不入库）。流水线一条命令：

```
node scripts/pipeline.js           # 分析 + 生成定义/预设 + 校验 + 覆盖率
node scripts/pipeline.js --sample  # 先补采样（每站一次 GET，站间 4-6 秒）
```

产物：`pta/data/{analysis.json,site-defs/,site-search.local.json,coverage.json}`；
详细流程与失败分类见 `docs/PIPELINE.md`。

## 检查

```
pta\checks\run.cmd
```

线上面板真机验证（要本机 Chrome 开着调试端口，只访问面板自己的域名）：

```
PTA_UI_URL=https://面板域名 PTA_UI_USER=xxx PTA_UI_PASS=xxx node scripts/verify-live-ui.js
```

10 条断言：能登录、站点清单渲染、覆盖统计条、预设列显示引擎与组数、详情能开、
设置能切到搜索预设页签、页签里显示引擎与来源、显示分类 id、能确认预设、登录页签有 cookie 自检按钮。
2026-11-10 实测 10/10 通过（确认预设那步会真写一次服务端预设）。

- smoke.js 22 条：登录、七页渲染、分类映射、越界拦截、上传/查重、导出下载、确认弹窗、无 JS 错
- audit.js：逐个点所有可点元素，报死按钮（目前 0 问题）
- adapter.js 13 条：四种引擎（NexusPHP / UNIT3D / Gazelle / 兜底）的分类、列表、搜索 URL、登录态判定
- api.js 31 条：健康、配置区间、落盘、站点清单、凭据读写与批量导入、预设读写、定义摘要、干跑任务、日志轮转、登录与 401

改完必须全绿再提交。

## 收尾核对（2026-11-10 第 13 轮）

- `pta\checks\run.cmd` 一次跑完：ALL CHECKS PASSED（smoke 21 + audit 0 问题 + api 26）
- 工作区干净，本地分支与 origin/main 一致（8437e58）
- 线上服务 active，公网入口 200，七个新接口未登录均返回 401（存在且受保护）
- 仓库里没有服务器 IP；真实清单与预设文件都被 gitignore

已知待你决定的一件事：`scripts/PTScripts/*.user.js` 里带真实站点域名（他自己写的油猴脚本，早于本项目的提交），
仓库是公开的，要不要脱敏或移出仓库由你定，我没动。

## 下一步

1. 采样补齐：连不上的站需要代理或换网络再跑一次 `--sample`；登录墙的站要先在浏览器里登录
2. 登录墙的 21 站拿到 cookie 后，用 `/api/credentials/import` 批量导入，再跑 `--sample` 补齐分类
3. 详情页解析（种子大小、原盘判定）还没接，目前只用列表页字段
4. 真抓取执行器仍是干跑，接真站前要先过「最小请求 + 配额」评审

真抓取、真实站点登录一律不做：按用户要求不碰真实站点，不许自己找 cookie，也不做探测或压测。
采样是用户授权的、每站一次 GET 的一次性配额，不要反复重跑。

## 注意

- 真实站点清单只在本机与测试机：`pta/web/assets/sites-data.local.js`、`pta/data/site-arch.local.csv`，都已被 gitignore，不要提交
- 面板账号密码不入库，只配在测试机 systemd 环境变量里
- Cloudflare 会缓存 js/css，静态资源已加 no-cache 与版本号；换版本记得改 `?v=` 参数
