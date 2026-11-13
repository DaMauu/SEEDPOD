# AGENTS.md · SEEDPOD 面板（项目铁律）

这个文件是压缩后仍然有效的事实源。改代码前先读它，改完再更新 HANDOFF.md。

每次会话固定动作见 [CHECKLIST.md](CHECKLIST.md)：开工先 `bash scripts/sync-check.sh`，改完 push，发版 `ssh pta 'cd /opt/seedpod-git && git pull --ff-only && bash deploy.sh'`。
聊天记录会被压缩，这里的规则不会；两条冲突时以本文件 + HANDOFF.md 为准。

## 文件放置（长期规定）

pta 的开发文件只能放在 main/pta 下，不许跳出 pta 落到仓库根；仓库根只放仓库级文件，非 pta 文件也不许塞进 pta。新增 pta 代码/文档/脚本一律进 pta/。

## 项目是什么

个人 PT 转载/交叉做种面板：无构建静态 SPA + Node 后端（生产为 Fastify + SQLite）。

- 前端 `pta/web/index.html` + `pta/web/assets/{app.js,app.css,data.js}`（Vue 3 走本地脚本，无构建），hash 路由 `#dashboard #sites #crawl #queue #sources #logs #settings`
- 生产后端 `pta/server/app-fastify.js`（Fastify）+ `pta/server/routes-*.js` + `pta/server/db.js`（SQLite，数据在 `data/seedpod.db`）；适配器 `pta/server/adapters/nexusphp.js`，凭据加密 `pta/server/secretbox.js`
- 旧零依赖后端 `pta/server/app.js` 只作参考，不在生产运行；服务端改动一律进 v2
- 线上跑在测试机 `/opt/seedpod`，systemd 服务 `seedpod`，监听 8080，数据在 `/opt/seedpod/data`
- 公网入口是一个 pta 开头的域名，经 Cloudflare → nginx 反代到 8080
- 交付形态：功能完成后必须能用 Docker 部署（`Dockerfile` + `docker-compose.yml`，数据卷挂 `/data`）；换栈先写 `docs/DECISIONS.md`
- 阶段：`pta/web` 当前是前端 demo/原型，用来快速验证交互与流程，不是终稿；前端定稿后按目标架构整体搬迁一次，不在 demo 上做大规模重构
- 前端已切到 Vite 构建：源码在 `pta/web-src`，线上服务 `pta/web/dist`；`pta/web` 只作旧版回退，不再改
- 开发环境：Linux 为准；Windows 只用于聊天与备用，`run.cmd` 不是主入口

## 铁律（违反即为错误，不要协商）

1. 不碰真实 PT 站点：不自己找 cookie、不复用 cookie 去登录、不对真实站点做探测/压测/反复请求。抓取一律先干跑或本地夹具。
2. 真实站点清单、站名、凭据、服务器 IP 都不入仓库、不进提交、不写进回复。示例一律用占位符（`example.org`、`docs/*.example.json`）。
3. 面板账号密码不入库：只配在测试机 systemd 环境变量 `PTA_USER` / `PTA_PASS`。
4. 站点凭据只存密文：`data/credentials.json` + AES-256-GCM，接口只回 `hasCookie`。
5. 提交前必须 `pta/checks/run.sh` 全绿（Linux；Windows 备用 `run.cmd`）。没绿不提交；连续两轮修不绿就回滚并停手。
6. 站点登录只有 cookie，不要重新引入账号密码或 2FA；面板自己的登录（`PTA_USER`/`PTA_PASS`）是另一回事，别混。
7. 生产后端只有 v2：服务端改动只进 `app-fastify.js` / `routes-*.js` / `db.js`，旧 `app.js` 不接新需求，避免同一功能两套实现。

## 发版与同步（/opt/seedpod 是运行目录，/opt/seedpod-git 是仓库检出）

两边同一套流程，全程只用 main，不新建分支：

```
# 开工前：对一遍本地 / GitHub / VPS 三方提交，一致才 ff 拉取
bash scripts/sync-check.sh

# 改完：提交并推送
git add -A && git commit -m "0.7.xx 一句话说清改了什么" && git push origin main

# 发版（在 /opt/seedpod-git 里跑）
git pull --ff-only && bash deploy.sh
```

- 只有 Windows 推送 GitHub 才要带代理：`git -c http.proxy=http://127.0.0.1:4399 -c https.proxy=http://127.0.0.1:4399 push origin main`
- VPS 用部署密钥（`~/.ssh/github_seedpod`，origin 为 git@github.com:DaMauu/SEEDPOD.git），可直接 pull / push
- `deploy.sh` 用 rsync 把 pta/ 同步到 /opt/seedpod 并重启服务，排除 `data/`、`web/assets/sites-data.local.js`、`*.log`；package.json 与 CHANGELOG.md 单独 rsync
- `deploy.sh` 不传 `node_modules`：新机器先 `npm i --omit=dev`（或手工装 fastify 与 @fastify/static）再启动
- 改前端静态资源必须同步升 `pta/web/index.html` 里的 `?v=`
- 两边同时改会 push 失败（non-fast-forward），此时先 pull 再推，不要 force

## 常见故障对照

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 服务起不来，MODULE_NOT_FOUND | 只发了入口文件 | 补发 `routes-*.js`、`db.js`、`crawl.js`、`adapters/`、`secretbox.js`；确认目标机 `node_modules` 有 fastify |
| 页面白屏 / 按钮无反应 | 少了 data.js 或 ?v= 没升 | 补发 data.js、升版本号 |
| 线上行为像旧版 | Cloudflare 缓存 | 升 `?v=` 并硬刷新 |
| ssh 超时 | 22 端口时通时断 | 重试 base64 方式，别改端口 |
| 登录进不去 | 前端旧缓存 | 升 `?v=`；服务端 `POST /api/login` 本地应回 200 |

## 数据与不入库的东西

数据目录 `data/`（0600）：`config.json`、`site-config.json`、`queue.json`、`downloaders.json`、`credentials.json`、`events.log`、`.secret`。

只在本地/测试机、已被 gitignore：`pta/web/assets/sites-data.local.js`、`pta/data/{sites-bookmark.local.json,site-search.local.json,site-arch.local.csv,site-defs/,samples/,cookies.tmp.json}`、`docs` 里只有 example。

## 干活方式

- 开发与运行以 Linux 为准，本机命令用 Bash；检查脚本 `pta/checks/run.sh`（5 段：adapter 19 / smoke 23（5 条 demo 期遗留待重写）/ audit 全部交互点 / security 2 / api-v2 15 / web 构建 7 路由）
- 改完：跑检查 → 提交（信息用中文一句话，说清做了什么）→ 发版 → 线上探活 → 更新 HANDOFF.md
- 一段工作结束就把 HANDOFF.md 的「现在是什么状态」改成事实，不要留旧数字
- 少工具步数：一条命令跑多步，先 grep/glob 定位再 read 局部，大输出先截断
- 前端不引入构建工具；后端运行时依赖只有 Fastify + @fastify/static（已装，写进 package.json），新增依赖先说明理由

## 用户写需求的最低要求（四要素）

有效提需求的形状，缺一项我就得猜：

1. 要什么：一句话动词短语
2. 改哪里：文件名 / 接口路径 / 页面名
3. 怎么算成功：能验证的现象（某个检查通过、某个接口返回、页面某个状态）
4. 什么不许动：明确否定项

例：把站点页的登录方式改成只存 cookie，改 `pta/web/assets/app.js` 的登录设置页和 `pta/server/app.js` 的凭据接口；成功标准是保存后只回 hasCookie 且自检能出结论；不要动面板账号密码登录，不要再加 2FA。

改主意时直接说「现在以 X 为准」，不要让我从多条里推断哪条是最新的。

## 协作协议（2026-11-13 起）

每次需求先出四件套，缺一件不动代码：

1. 我理解的需求：三句话，不含方案
2. 缺口清单：每条带默认值，用户只需回「行 / 不行」
3. 三个方案 + 代价：改哪里、加多少行、以后怎么改
4. 风险与这次明确不做什么

确认后一次只做一个需求，一个提交只解决一件事。做完落一张需求卡（模板见 `pta/docs/REQUIREMENTS-TEMPLATE.md`），并更新 HANDOFF.md。

## 复杂度预算（流程页与所有设置页）

- 每个手风琴最多 8 行，超了合并或挪进「高级」
- 新增一条规则必须回答：不设会怎样、默认值是什么、用户在哪关掉
- 一条进一条出：加新条件时必须合并或删掉一条旧的，不允许只加不减
- 能给默认值就不给开关；能三档预设就不给独立选项
- 新条件先进 `pta/docs/PIPELINE-RULES.md` 清单，再改 `data.js`，最后跑 `node pta/scripts/gen-rules-tree.js`

## 设计约束（UI）

- 先线框后代码：静态 HTML 或截图确认后再改 `app.js`
- 只用 `pta/docs/DESIGN.md` 里的变量与组件，不新造样式；CSS 必须 scoped
- 文案：标签用名词，说明 ≤ 20 字，错误说「怎么办」
- 验收三宽度 1280 / 768 / 390，无横向滚动，首屏能看到主卡

## 八、版本与交付说明（2026-11-12 起执行）

1. 每次改动都要升版本号：`package.json` 的 version 递增一位（0.4.1 → 0.4.2 …），同时把 `pta/web/index.html` 里 assets 的 `?v=` 缓存号改掉，二者都要改。
2. 每个页面底部固定一行开发说明（`#dev-foot`），内容全部来自 `/api/dev`，不写死：版本号、开发日期、前端与后端技术栈、页面数、接口数、站点/预设/词条/待审/下载器数量、已运行时长。
3. 开发版必须带更新日志：删除 / 新增 / 优化 / 调整 / 重排，逐条记，落在 `CHANGELOG.md`，面板里能打开。
4. 面板提供「基础版 / 开发版」切换：基础版只保留日常要用的功能，开发版显示全部功能与更新日志；切换结果记在浏览器里。
5. 交付前必须实测：登录后打开改过的页面，逐个控件点一遍，并核对 `/api/dev` 的数字与实际一致。
