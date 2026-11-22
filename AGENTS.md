# AGENTS.md · SEEDPOD 面板（项目铁律）

这个文件是压缩后仍然有效的事实源。改代码前先读它，改完再更新 HANDOFF.md。

每次会话固定动作见 [CHECKLIST.md](CHECKLIST.md)：开工先 `bash scripts/sync-check.sh`，改完 push，发版 `ssh <部署主机> 'cd <部署仓库> && git pull --ff-only && DEPLOY_DIR=<部署目录> bash deploy.sh'`。
聊天记录会被压缩，这里的规则不会；两条冲突时以本文件 + HANDOFF.md 为准。

## 文件放置（长期规定）

pta 的开发文件只能放在 main/pta 下，不许跳出 pta 落到仓库根；仓库根只放仓库级文件，非 pta 文件也不许塞进 pta。新增 pta 代码/文档/脚本一律进 pta/。

## 项目是什么

个人 PT 转载/交叉做种面板：Vite + Vue 3 SFC 前端 + Node 后端（生产为 Fastify + SQLite）。

- 前端源码 `pta/web-src`（Vite + Vue 3 + SFC，页面在 `src/views/`，hash 路由 `#dashboard #sites #crawl #queue #sources #logs #settings`）；线上服务 `pta/web/dist`，`pta/web` 只放构建产物；旧 demo 已删除，不再保留
- 生产后端 `pta/server/app-fastify.js`（Fastify）+ `pta/server/routes-*.js` + `pta/server/db.js`（SQLite，数据在 `data/seedpod.db`）；适配器 `pta/server/adapters/nexusphp.js`，凭据加密 `pta/server/secretbox.js`
- 旧零依赖后端已删除，只保留 v2；服务端改动一律进 v2
- 线上部署目录由 `DEPLOY_DIR` 指定（本地参数放未入库的 `.deploy.env`），systemd 服务 `seedpod`，监听 8080，数据在 `$DEPLOY_DIR/data`
- 公网入口是一个 pta 开头的域名，经 Cloudflare → nginx 反代到 8080
- 交付形态：功能完成后必须能用 Docker 部署（`Dockerfile` + `docker-compose.yml`，数据卷挂 `/data`）；换栈先写 `pta/docs/DECISIONS.md`
- 阶段：七个页面已全部 SFC；登录/路由/顶栏/Toast/Confirm/页脚已搬进 `App.vue`，`src/legacy` 已删除
- Vite 构建：源码 `pta/web-src`，`npm run build` 输出 `pta/web/dist`；改前端只动 `pta/web-src`
- 开发环境：Linux 为准；Windows 用 WSL / Git Bash 跑 `run.sh`

## 铁律（违反即为错误，不要协商）

1. 真实站点只读探测按下方《真实站点探测规则》执行；仍不得自己找 cookie、不得复用别人的 cookie 登录、不得压测或绕过限制。抓取默认先干跑或本地夹具，真实探测必须先有计划。旧规则里“不对真实站点做探测”的绝对表述由该规则取代，其余限制继续有效。
2. 真实站点网址用 Base64 存 `pta/pack/site-urls.preset.json` / 运行时 `data/site-urls.json`，可随仓库和镜像分发；站点显示名、中英文名、分类标签/ID、禁转/限转/HR 明文放 `sites.preset.json` / `sites.json`；中文类型/媒介/分辨率/优惠/限制和站点字段模板只放 `presets.preset.json` / `data/presets.json`。Base64 只是遮挡，不是加密。cookie、密码、passkey、上传 token 仍只存 AES-256-GCM 密文，绝不入仓库、不进提交、不写进回复；聊天回复仍不写网址。示例一律用占位符（`example.org`、`pta/docs/*.example.json`）。
3. 面板账号密码不入库：只配在测试机 systemd 环境变量 `PTA_USER` / `PTA_PASS`。
4. 站点凭据只存密文：`data/cookies.json` + AES-256-GCM，接口只回 `hasCookie`；SQLite `credentials` 表只作迁移/测试镜像，不再作为运行时事实源。
5. 提交前必须 `pta/checks/run.sh` 全绿（Linux；Windows 用 WSL / Git Bash）。没绿不提交；连续两轮修不绿就回滚并停手。
6. 站点登录只有 cookie，不要重新引入账号密码或 2FA；面板自己的登录（`PTA_USER`/`PTA_PASS`）是另一回事，别混。
7. 生产后端只有 v2：服务端改动只进 `app-fastify.js` / `routes-*.js` / `db.js`，旧 `app.js` 已删除，避免同一功能两套实现。
8. 站点与预设随程序发布：镜像带 `pta/pack/sites.preset.json` / `site-urls.preset.json` / `presets.preset.json` / `cookies.example.json`，首次启动复制到 `/data`；运行时只读写 `data/sites.json`、`site-urls.json`、`presets.json`、`cookies.json`。旧 `site-defs` / `site-pack` 流程已删除。详见 `pta/docs/SITE-JSON.md`。
9. 质量审计固定进 `pta/checks/run.sh`：全库看 `pta/quality-baseline.json` 防回退；单文件/单功能先跑对应 scope；有「D」先修，不能带「D」提交。详见 `pta/docs/QUALITY.md`。

## 真实站点探测规则（2026-11-25 起）

允许为站点适配、分类/搜索参数识别做真实站点只读探测，不再一律禁止。但必须满足：

1. **先计划后请求**：每次探测前写清单，包含站点、目的、要访问的 URL/方法、预计请求数、间隔、停止条件，以及为什么现有夹具/缓存不够。预计超过 5 次或需要写操作，先经用户确认。
2. **最小必要**：单站单次默认不超过 5 个请求，只取完成识别所需的最少页面；不遍历全站、不枚举 ID、不抓用户资料、不批量下载种子；能离线判断就不发请求。
3. **串行限速**：同一站同时只允许 1 个在途请求，间隔不少于 10 秒；不并发、不循环重试，失败最多重试 1 次并退避 30 秒以上。
4. **失败即停**：出现 429/403/503、验证码、异常跳转、响应明显变慢，立即停止该站并记录；1 小时内不再探测，不换 IP、不换账号、不绕过限制。
5. **凭据与写操作**：只使用用户在该站已保存的 cookie/凭据，不新建账号、不找别人的 cookie；默认只读，上传/删除/发布等写操作必须逐次确认。
6. **记录与产物**：日志只记站点编号、状态码、耗时、请求数，不记 cookie/token；探测结果先落本地临时文件，人工确认后再更新预设/分类。
7. **禁止**：压测、批量扫描、自动定时探测、多账号轮换、绕过限速、无计划的请求。

## 发版与同步（`DEPLOY_DIR` 是运行目录，`VPS_DIR` 是仓库检出）

两边同一套流程，全程只用 main，不新建分支：

```
# 开工前：对一遍本地 / GitHub / VPS 三方提交，一致才 ff 拉取
bash scripts/sync-check.sh

# 改完：提交并推送
git add -A && git commit -m "0.7.xx 一句话说清改了什么" && git push origin main

# 发版（在部署仓库里跑，DEPLOY_DIR 指向运行目录）
git pull --ff-only && bash deploy.sh
```

- 只有 Windows 推送 GitHub 才要带代理：`git -c http.proxy=http://127.0.0.1:4399 -c https.proxy=http://127.0.0.1:4399 push origin main`
- VPS 用部署密钥（`~/.ssh/github_seedpod`，origin 为 git@github.com:DaMauu/SEEDPOD.git），可直接 pull / push
- `deploy.sh` 用 rsync 把 pta/ 同步到 `$DEPLOY_DIR` 并重启服务，排除 `data/`、`*.log`；package.json 与 CHANGELOG.md 单独 rsync
- `deploy.sh` 不传 `node_modules`：新机器先 `npm i --omit=dev`（或手工装 fastify 与 @fastify/static）再启动
- 改前端后跑 `npm run build`，部署脚本会重新生成 `pta/web/dist`；不再维护 `?v=`
- 两边同时改会 push 失败（non-fast-forward），此时先 pull 再推，不要 force

## 常见故障对照

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 服务起不来，MODULE_NOT_FOUND | 只发了入口文件 | 补发 `routes-*.js`、`db.js`、`crawl.js`、`adapters/`、`secretbox.js`；确认目标机 `node_modules` 有 fastify |
| 页面白屏 / 按钮无反应 | 构建产物不完整或旧缓存 | 跑 `npm run build`，确认 `pta/web/dist` 完整；Vite 产物带 hash，硬刷新 |
| 线上行为像旧版 | Cloudflare/浏览器缓存 | 换新构建 hash 的文件；清站点数据/硬刷新 |
| ssh 超时 | 22 端口时通时断 | 重试 base64 方式，别改端口 |
| 登录进不去 | 前端旧缓存 | 清站点数据/硬刷新；服务端 `POST /api/login` 本地应回 200 |

## 数据与不入库的东西

数据目录 `data/`（0600）：`seedpod.db`（SQLite：队列/词条/日志/配置）、`sites.json`（站点定义）、`site-urls.json`（Base64 网址）、`presets.json`（全局预设，首次从 pack 复制）、`cookies.json`（密文 cookie）、`library.json` / `site-status.json`（文件数据）、`.secret`（凭据密钥）、`events.log`；`_v1-backup-*` 只作迁移备份，v2 不读。

只在本地/测试机、已被 gitignore：`data/site-defs/`、`data/samples/`、`cookies.tmp.json`、`pta/data/*.local.*`、`pta/data/site-arch.local.csv`；`docs` 里只有 example。

Telegram bot token / webhook 只放环境变量或面板加密配置；不入库明文、不进仓库、不打印。

## 环境与产品边界（长期有效，2026-11-15）

- 先定正确的产品形态，再让本机环境去适配它；不许为了本机权限/路径/服务差异，把产品代码写成只能在这台机器跑。
- 本机问题在本机解决：权限、目录、systemd、端口、私有凭据文件，优先改本机配置/环境变量/文件权限，不改产品逻辑。
- 只有真实产品约束（Docker 非 root、数据卷权限、无 systemd）才抽象成配置项、启动检查或文档，不写死主机路径。
- 产品代码、脚本和当前操作说明不写死主机路径；主机路径只放未入库的 `.deploy.env` 或环境变量。历史 HANDOFF/PLAN 里的旧路径只作记录，不作为运行参数。
- 凭据/密钥只通过环境变量或面板加密配置进入产品；不因本机文件权限降级安全设计。
- 遇到“本机跑不通”先判断：这是产品约束还是本机差异？本机差异改本机，产品约束改配置/文档。

## 干活方式

- Agent skills（自动/显式均可）：@review 审查 · @build 实现 · @debug 修复 · @refactor 拆分 · @test 测试 · @ui 界面 · @site 站点 · @db 数据层 · @security 安全 · @ship 发版

- 开发与运行以 Linux 为准，本机命令用 Bash；检查脚本 `pta/checks/run.sh`（build → smoke-live 21 → adapter 21 → security 3 → api-v2 23 → form 5 → publish 4 → scheduler 5 → detect 5 → target 10 → meta 11 → meta-ext 5 → media 7 → media-api 6 → clients 5 → clients-ext 4 → cli 7 → notify 7 → web 7 → 质量审计 → 规则体检）
- 改完：跑检查 → 提交（信息用中文一句话，说清做了什么）→ 发版 → 线上探活 → 更新 HANDOFF.md
- 改完先跑 `node pta/scripts/audit-quality.js --feature <name>`（单文件用 `--file`）；看「D」项和发现清单，再跑全量 `run.sh`
- 一段工作结束就把 HANDOFF.md 的「现在是什么状态」改成事实，不要留旧数字
- 少工具步数：一条命令跑多步，先 grep/glob 定位再 read 局部，大输出先截断
- 前端不引入构建工具；后端运行时依赖只有 Fastify + @fastify/static（已装，写进 package.json），新增依赖先说明理由
- 涉及上传/元数据/截图/种子/客户端/站点适配：先读 `pta/docs/UPSTREAM.md`，在文末追加研究记录；不复制 UA/upbrr 代码、品牌、key、站点配置
- 站点适配做成开箱即用：引擎逻辑进代码；站点差异放站点包（加密包随程序发布，仓库只含密文；私有 `data/` 包优先覆盖）

## 用户写需求的最低要求（四要素）

有效提需求的形状，缺一项我就得猜：

1. 要什么：一句话动词短语
2. 改哪里：文件名 / 接口路径 / 页面名
3. 怎么算成功：能验证的现象（某个检查通过、某个接口返回、页面某个状态）
4. 什么不许动：明确否定项

例：把站点页的登录方式改成只存 cookie，改 `pta/web-src/src/views/Sites.vue` 的登录页签和 `pta/server/routes-data.js` 的凭据接口；成功标准是保存后只回 hasCookie 且自检能出结论；不要动面板账号密码登录，不要再加 2FA。

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
- 新条件先对照 `pta/docs/RULES-RECONCILIATION.md` / `RULES-TREE.md`，再改 `pta/web-src/src/data/rules.js`，最后跑 `node pta/scripts/gen-rules-tree.js`

## 结构气味（提示，不是验收）

这些只提示“该拆了”，不证明功能做对：

- 单个 SFC 超过 800 行或一个文件被改 3 次以上仍没有模块边界
- 同一个文件被改过 3 次以上仍没有模块边界
- 页面上的规则/开关与服务端契约对不上（用 `node pta/scripts/audit-rules.js` 查）

## 交付闸门（真正的验收）

以 `pta/docs/DELIVERY.md` 为准，七条全过才算项目落地：

1. 七个页面全是 SFC，`src/legacy` 已删除，共享壳在 App.vue，旧 web 已删除
2. 页面上每个开关服务端都有读者；没有就删/禁用/标未接
3. 主流程能跑通：cookie → 抓取 → 查重 → 送审 → 队列 → 真发布 → 校验
4. 定时抓取/送审/发布能跑能停
5. 登录限速/锁定、会话落库、cookie Secure、密钥分离
6. Docker 一键起，数据卷持久化，备份恢复有文档
7. 检查全绿 + 质量审计基线不回退 + 端到端脚本跑通

行数不是验收标准。

## 每轮自查五问

答不上就不动代码：

1. 这条规则谁会读？服务端哪个文件、哪一行？
2. 什么时候读？请求时、发布前、还是只存配置？
3. 不设置会怎样？默认值是什么？
4. 当前体量/结构是否已经越过切换线？
5. 这块对标 UA/upbrr 的哪一块？查过并记录到 `UPSTREAM.md` 了吗？

## 设计约束（UI）

**WebUI 已冻结（2026-11-16 用户确认）**：除非用户明确要求改界面，不改 `pta/web-src` 的样式、布局、文案。确需改动时，改完必须跑 `node pta/scripts/ui-freeze.js --update` 更新基线；否则 `run.sh` 的 UI 冻结检查会失败。

- 先线框后代码：静态 HTML 或截图确认后再改对应 SFC
- 只用 `pta/docs/DESIGN.md` 里的变量与组件，不新造样式；共用样式放 `pta/web-src/src/styles/index.css`（按级联顺序 import `src/styles/*.css` 模块），页面新增样式优先 SFC `<style scoped>`，不再往 `public/assets` 放 CSS
- 桌面和手机共用一套 Vue 代码；允许组件级换布局，不做独立移动站/两套前端；规范见 `pta/docs/RESPONSIVE.md`
- 文案：标签用名词，说明 ≤ 20 字，错误说「怎么办」
- 验收四宽度 360 / 390 / 768 / 1280（新增页面加 1440），无横向滚动，首屏能看到主卡

## 八、版本与交付说明（2026-11-12 起执行）

1. 每次改动都要升版本号：`package.json` 的 version 递增一位（0.4.1 → 0.4.2 …）；前端产物由 `npm run build` 生成，不再维护 `?v=`。
2. 每个页面底部固定一行开发说明（`#dev-foot`），内容全部来自 `/api/dev`，不写死：版本号、开发日期、前端与后端技术栈、页面数、接口数、站点/预设/词条/待审/下载器数量、已运行时长。
3. 面板必须带更新日志：删除 / 新增 / 优化 / 调整 / 重排，逐条记，落在 `CHANGELOG.md`，面板里能打开。
4. 面板始终显示全部功能与更新日志；不再提供基础版/开发版切换。
5. 交付前必须实测：登录后打开改过的页面，逐个控件点一遍，并核对 `/api/dev` 的数字与实际一致。
