# 更新日志

## v0.7.140 · 2026-11-16

### 修复
- 手机底部导航：旧图标轨 CSS 把 `.dock-label` 设为绝对定位、`opacity:0`、`visibility:hidden`，而 `App.vue` 只有文字标签，导致导航只剩空胶囊。
- 标签改为始终可见；手机端底栏去掉 `max-width`，全宽显示，并加 `viewport-fit=cover` + `env(safe-area-inset-bottom)`，适配 iPhone XS 的底部安全区。
- 1280 恢复底部文字胶囊，1440 恢复右侧文字导航；375 / 390 / 1280 / 1440 无横向滚动。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21。

## v0.7.139 · 2026-11-16

### 站点包接入
- 第一版 `pta/pack/site-pack.enc` 已生成：308 站，约 217KB；明文 host 泄漏扫描 0。
- `target.js` / `crawl.js` 接入内置包回退：私有 `data/` 优先，缺密钥自动回退，不阻塞启动。
- `/api/dev` 返回 `pack` 状态（是否解密、站点数、包版本）；设置页展示待补。
- 生成器补充 `catList`，抓取分类轮转可以直接用包内分类。
- `site-pack` 检查 5/5；全量 ALL CHECKS PASSED。

## v0.7.138 · 2026-11-16

### 站点包基础设施
- 新增 `pta/server/site-pack.js`：AES-256-GCM 解密、校验、缓存；缺 `PTA_SITE_PACK_KEY` 回退 `NO_KEY`，不阻塞启动。
- 新增 `pta/scripts/build-site-pack.js`：离线生成、分类自动匹配、`--dry` 覆盖率、例外私有报告；密文写 `pta/pack/site-pack.enc`。
- 新增 `pta/checks/site-pack.js`：roundtrip、缺密钥、错误密钥、篡改、密文无明文 host、生成器 dry-run；5/5，已进 `run.sh`。
- 现有 308 站 dry-run：1409 个分类自动匹配 913（64.8%）；真实密文包待部署密钥后生成。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、api-v2 23/23、form 5/5、site-pack 5/5、target 10/10。

## v0.7.137 · 2026-11-16

### 计划
- 站点包与自动化方案定稿：站点包随程序发布，仓库只放 AES-256-GCM 密文，密钥只放部署环境变量 `PTA_SITE_PACK_KEY`；用户不单独下载、不导入。
- 私有 `data/site-defs` / `data/site-pack.json` 优先覆盖内置包；缺密钥回退并提示，不崩溃。
- 新增 `pta/docs/SITE-PACK.md`；AGENTS 铁律 2/8 更新；DECISIONS D16；ROADMAP M11。
- 本次只写计划，不改运行代码。

## v0.7.136 · 2026-11-16

### 修复
- 按 NexusPHP 开源实现校正默认上传映射：表单页 `/upload.php`，提交页 `/takeupload.php`；字段 `small_descr`、`type`、`uplver=yes`。
- 站点定义 `catMap` 数组按 `purpose` 自动转成目标站分类对象，发布时 `type` 能填 401/402 等，不再把 `movie` 当分类 ID。
- 站点检查新增 NexusPHP 默认字段/分类数组用例；target 10/10。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、api-v2 23/23、form 5/5、target 10/10。

## v0.7.135 · 2026-11-16

### 修复
- 上传表单识别拆成“提交路径”和“识别页路径”：NexusPHP 的 `/takeupload.php` 是 POST 提交地址，GET 表单页通常是另一个地址。
- 站点定义 `uploadMap` 新增 `formPath`；识别用 `formPath`（留空回退 `path`），提交仍用 `path`。
- 目标站夹具覆盖两者不同的情况：识别 `/upload-form`，提交 `/takeupload.php`。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、api-v2 23/23、form 5/5、target 9/9。

## v0.7.134 · 2026-11-16

### 功能
- 上传配置新增“上传表单”字段表：上传路径、文件字段、目标字段/值模板，支持增删改，保存写回 site-def 的 `uploadMap`。
- “从目标站识别”：确认后对目标站上传页发一次只读 GET，解析字段填入表格；同站 60 秒冷却，失败保留手工编辑。
- 解析器 `pta/server/form.js` + 本地夹具 `pta/fixtures/upload-form.html`；新增 form 检查 5/5。

### 检查
- api-v2 23/23、form 5/5、target 9/9、smoke 21/21；全量 ALL CHECKS PASSED。

## v0.7.133 · 2026-11-16

### 功能
- 站点抽屉 → 设置 → 上传配置新增分类映射表格：
  - `catMap` 数组：站点分类（名称 + ID）→ 库内分类（电影 / 剧集 / 纪录片等），保存时重建 `cats`。
  - `catMap` 对象：库内分类 → 目标站分类 ID，保持对象结构。
  - 支持增、删、改；保存写回 `/api/site-def/:host`，站点定义其他字段不丢。
- 窄屏站点详情设置区改为单列，分类表在 390 下可用。

### 检查
- api-v2 22/22（新增数组/对象映射回读）；smoke 21/21（新增对象映射保存、数组改用途、删行）；target 8/8；全量 ALL CHECKS PASSED。

## v0.7.132 · 2026-11-16

### 对账
- 50 条未接规则逐条对账：转正 2 条（发布后校验、截图至少几张），删除 8 条重复/无读者行，剩余 40 条继续禁用。
- 服务端：真发布前按“截图至少几张”拦（默认 3，干跑不拦）；“发布后校验”关掉时只提交不回查，手动回查仍可用。
- `rules.js` 58 → 50 条非分组规则；`RULES-TREE.md` 重新生成；新增 `RULES-RECONCILIATION.md`。
- target 检查 6 → 8（新增截图门槛、回查开关）。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 8/8、meta 11/11、meta-ext 5/5、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.131 · 2026-11-16

### 清理
- 选择器级 CSS 清理：按源码类名 + 线上 DOM + 动态类白名单删除 453 条无引用规则，恢复 2 条归档样式，净减 451 条。
- `app.css` 137,605 → 103,703 字节（-33,902）；保留分类映射 `.cm-*` / `.map-row` 样式给下一项复用。
- 修复窄屏设置页长说明溢出：`#set-panel` 的 220px 控件宽度在 ≤1000px 改为 100%，长文本换行。

### 验证
- 三宽度 1280 / 768 / 390：七页无横向滚动、0 JS 报错；总览、站点、流程、设置截图核对。
- 选择器审计剩 14 条候选，其中 12 条为分类映射/混合选择器保留项。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、meta-ext 5/5、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.130 · 2026-11-16

### 清理
- 删除旧 demo 中确认无引用的 CSS 规则：旧流程手风琴 `.rule-*` / `#rule-body`、旧移动菜单 `.menu*` / `#menu*`，共 168 条。
- `app.css` 152.4KB → 137.6KB（-14.8KB）；build 和 smoke 21/21 正常。

### 检查
- `run.sh` 全绿；线上待验证。

## v0.7.129 · 2026-11-16

### 清理
- 修正 `app-fastify.js` 里“v1 已归档”的过期注释（实际已删除）。
- `TASKS.md` 的 `run.cmd` 旧入口统一改为 `run.sh`。

## v0.7.128 · 2026-11-16

### 清理
- 删除 `pta/archive`（旧 web demo + v1 后端）；删除 `pta/checks/api.js`、`pta/checks/run.cmd`。
- `routes-missing.js` 改名 `routes-extra.js`；删除零引用的一次性 scripts（clean/collect/discover/merge/migrate/reshape/verify）。
- v1 文档：`DECISIONS.md`、`PRIOR-ART.md`、两个 example 迁到 `pta/docs/`；v1 的 API/ARCHITECTURE/DEPLOY/PIPELINE 删除。
- `README` 用的 `docs/i18n`、banner 保留；`scripts/bluray` 是独立项目，保留。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、meta-ext 5/5、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.127 · 2026-11-16

### 重构
- 删除 `src/legacy`：登录、hash 路由、顶栏、Toast/Confirm、页脚全部搬进 `App.vue`。
- 规则数据移到 `src/data/rules.js`；`gen-rules-tree`/`audit-rules` 路径同步。
- 登录页去掉没有实际作用的“记住登录”开关；会话由服务器 cookie 控制。
- 路由切换后补一次合成事件，保证页面组件在 DOM 可见后拉数据。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、meta-ext 5/5、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.126 · 2026-11-16

### 清理
- legacy `app.js` 从 5321 行降到 1314 行：删掉 8 个已不在启动列表的页面函数和死流程 helper；启动只剩 chrome/nav/menu/router。
- 删掉 App.vue 里四个已死的旧弹窗（site/bulk/target/node/rule）；确认弹窗保留。
- 旧 v1 后端移到 `pta/archive/server-v1.js`；删除 `smoke-legacy.js` / `audit-legacy.js`；`run.cmd` 退休为提示入口。
- 全量检查保持全绿。

## v0.7.125 · 2026-11-16

### 自检修复
- 恢复 `pta/checks/run.sh` 可执行位（644 → 755），避免直接 `./pta/checks/run.sh` 失败。

## v0.7.124 · 2026-11-16

### 新增
- 外部元数据两种来源：无 key 用 Wikipedia 公共接口；有 key 用 TMDB（`TMDB_API_KEY`，不进仓库）。
- `GET /api/meta/providers`、`POST /api/meta/fetch`；待审核页加“查资料”，查到后填副标题/简介。
- `pta/checks/meta-ext.js`：本地 mock Wikipedia/TMDB，5/5。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、meta-ext 5/5、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.123 · 2026-11-16

### 自检修复
- 全量检查、线上七路由、服务日志、JS 语法均正常；Docker 镜像重建后 health/登录/session 通过。
- 发现 smoke 没覆盖新加的“添加站点 / 上传配置”，补上；smoke-live 21/21。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。
- Docker：`docker build` 成功；临时容器 health 200、登录 200、session 200。

## v0.7.122 · 2026-11-15

### 新增
- 面板内添加/移除站点：`POST/DELETE /api/sites`；`GET /api/sites` 合并 base 清单和面板添加的站点。
- 上传定义编辑：`PUT /api/site-def/:host`，存 `data/site-defs/<host>.json`（0600）；站点页加“添加站点”弹窗和“上传配置”页签。
- api-v2 增加站点配置契约，21/21。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.121 · 2026-11-15

### 新增
- 下载器直连 rTorrent（XML-RPC）与 Deluge（Web JSON-RPC）：探测、加种、按 infohash 回查；`kind` 支持 qb/watch/rtorrent/deluge。
- 发布链路按 `kind` 分派；rTorrent/Deluge 添加后回查并写 `qb.client/state/progress/verified`。
- 下载器设置 UI 支持四种类型；`clients-ext` 夹具用本地 mock XML-RPC/JSON-RPC，4/4。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.120 · 2026-11-15

### 调整
- 硬约束：产品代码/脚本不写死主机路径。`deploy.sh` 用 `DEPLOY_DIR`（可放未入库 `.deploy.env`）；`sync-check.sh` 用 `SSH_HOST/VPS_DIR`；`load-cookies.js` 不再自动读 `/etc/seedpod.secret`；`notify-tg.sh` 不再默认 `/etc`；`goal-autoresume.py` 用 `OPENCODE_TG_ENV_FILE/OPENCODE_GOAL_OFF_FILE`。
- `AGENTS.md` 删除“部署脚本例外”，改为“主机路径只放未入库 `.deploy.env` 或环境变量”；`docs/DEPLOY.md` 示例路径改 `<部署目录>` 并改 v2 入口。
- `.deploy.env` 进 gitignore/dockerignore。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 5/5、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.119 · 2026-11-15

### 新增
- 调度器重试 `failed` 队列条目：`retryMax`（默认 2）、`retryBackoffMin`（默认 15）可配；失败写 `retries/lastRetryAt/nextRetryAt/retryMsg`，成功后转 published。
- 重试失败会计入调度通知文本；`clients` 夹具加“调度重试 failed 条目”，5/5。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 5/5、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.118 · 2026-11-15

### 新增
- Telegram 通知：环境变量优先，面板可保存 token（AES-GCM）/Chat ID；调度失败、发布失败、目标站提交失败推送；设置页可发送测试。
- `GET/PUT /api/notify`、`POST /api/notify/test`；token 只写不读，接口只回是否配置/来源/chat。
- Docker compose 支持 `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ALLOWED_USER_ID`；`.env` 已 gitignore。
- `pta/checks/notify.js`：本地 mock Bot API，7/7（发送/跳过/面板加密兜底/未配置）。

### 调整
- `AGENTS.md` 增加“环境与产品边界”：本机权限/路径问题改本机，不把主机路径写进产品代码。
- `scripts/load-cookies.js` 不再自动读 `/etc/seedpod.secret`；找不到密钥退出 2，不自动新建。
- `scripts/notify-tg.sh` 不再默认 `/etc` 环境文件；`deploy.sh` 用 `TELEGRAM_ENV_FILE` 显式指定。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.117 · 2026-11-15

### 新增
- `pta/cli.js` + `package.json` 的 `bin.pta`：`status / queue / crawl / screen / publish / targets / target-upload / verify`，默认干跑，`--real` 才真抓/真发；凭据只从环境读，不打印。
- `pta/checks/cli.js`：临时后端 + 真实 CLI 子进程，7/7（状态、抓取干跑、送审、队列、发布干跑、目标站列表、缺参退出码）。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 4/4、cli 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.116 · 2026-11-15

### 新增
- 待审核页加“媒体”卡：填 `PTA_MEDIA_ROOT` 下的文件路径，可探测、生成 3 张截图（直接写入队列）、生成种子；生成的种子 base64 会随“提交目标站”一起发送，省一次源站下载。
- smoke 增加媒体卡渲染断言，smoke-live 20/20。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 4/4、build 7/7、规则体检 0 缺读者。

## v0.7.115 · 2026-11-15

### 新增
- 下载器加 `kind`（qb/watch）；watch 目录客户端写入 `.torrent`（0600，原子 rename），探测可写与余量。
- 发布链路支持 watch：写目录后标记 `client:'watch'`/`state:'watch'`/`verified:true`；qB 路径行为不变。
- 下载器设置 UI 支持类型切换；`GET /api/downloaders` 回 `kind/watchPath`。
- `pta/checks/clients.js`：watch 模块 + 下载器 API + 发布到 watch，4/4。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 4/4、build 7/7、规则体检 0 缺读者。

## v0.7.114 · 2026-11-15

### 新增
- `pta/server/routes-media.js`：`GET /api/media/config`、`POST /api/media/probe|shots|torrent`；路径限制在 `PTA_MEDIA_ROOT`（默认 `data/media`），拒绝越界；截图返回 data URL，种子落 `data/torrents`。
- `pta/checks/media-api.js`：合成视频 + 临时后端，6/6（路径越界、探测、截图、种子、坏 announce）。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、build 7/7、规则体检 0 缺读者。

## v0.7.113 · 2026-11-15

### 新增
- `pta/server/media.js`：ffprobe 媒体信息、ffmpeg 截图（HDR tonemap + 失败回退）、clean-room bencode 生成单文件 `.torrent`。
- `pta/checks/media.js`：ffmpeg 合成 2 秒视频，覆盖探测/截图/bencode/种子解析/坏输入，7/7。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.112 · 2026-11-15

### 新增
- `pta/server/meta.js`：标题解析（片名/年份/季集/分辨率/来源/编码/音轨/HDR/制作组/分类）与 `buildNames` 规范名/副标题/简介。
- `GET /api/meta/parse?title=...`；`/api/publish/preview` 返回 `parsed`/`releaseTitle`，副标题与简介用解析结果补全。
- `pta/checks/meta.js`：11 条夹具（电影/剧集/动漫/音乐/修复版/年份歧义），11/11。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、build 7/7、规则体检 0 缺读者。

## v0.7.111 · 2026-11-15

### 新增
- `pta/server/target.js` + `routes-target.js`：NexusPHP/UNIT3D/Gazelle 的提交路径与字段骨架，`data/site-pack.json` 私有包覆盖；`GET /api/targets`、`plan/upload/verify`。
- 真提交受 `realPublish` 门禁；成功后把 `targetUpload/targetVerify` 写回队列；待审核页加“提交目标站”。
- `pta/checks/target.js`：本地 mock 上传页夹具，覆盖私有包、干跑、门禁、NexusPHP 真提交、UNIT3D/Gazelle 干跑、回查，6/6。
- `pta/docs/site-pack.example.json` 与 ADAPTERS/UPSTREAM 记录。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、build 7/7、规则体检 0 缺读者。

## v0.7.110 · 2026-11-15

### 调整
- 旧前端 demo 归档到 `pta/archive/web-demo`；`pta/web` 只保留 Vite 构建产物 `dist` 和说明，不再改旧 `index.html/assets`。
- `gen-rules-tree.js` 改读 `pta/web-src/src/legacy/data.js`；`routes-data.js` 只从 `data/sites-data.local.js` 读私有站点清单；`deploy.sh` 排除 `archive/`；dev compose 挂载改到 `pta/server` 与 `pta/web/dist`。
- AGENTS/HANDOFF/DESIGN/PIPELINE-RULES/ARCHITECTURE-TARGET 等文档对齐 Vite + SFC，删除 `?v=` 与旧 demo 目录说明。

### 检查
- `npm run build` 通过；`run.sh` 全绿；smoke-live 20/20。

## v0.7.109 · 2026-11-15

### 调整
- 下载器抽屉拆进 `views/Nodes.vue`：卡片列表、在线/版本/余量、增删改、连接测试、qB 分类只读；legacy `initNodes` 不再初始化。
- 只保留服务端真有的字段（名称/地址/账号/密码/免密）；同时下载数、限速、分享率、保种天数、分类选择这些还没服务端读者的项不放进 UI，等 M5–M7 接 qB 策略时再加。
- 在线冒烟增加“下载器抽屉”，smoke-live 20/20。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.108 · 2026-11-15

### 调整
- 流程页的规则卡与演练拆进 `views/Crawl.vue`：抓取（搜索预设 + 请求限制 + 抓详情页）、查重（自动查重 + 按条件筛选）、发布（规则组、目标站、正则测试）；演练/看地址/抓一页都接真实接口。legacy `initCrawlSettings` 不再初始化。
- 新增 `components/RuleControl.vue`：统一渲染开关、单选、下拉、数字、文本、按钮、chips 与固定值。
- 下载器抽屉仍由 legacy `initNodes` 接管，下一提交单独拆。
- `run.sh` 全绿；smoke-live 19/19（含 8 个流程组、4 个限制输入、50 个未接徽章、`#rx-deny` 可用）。

## v0.7.107 · 2026-11-15

### 调整
- 站点页拆进 `views/Sites.vue`：站点列表、架构/登录/预设/抓取筛选、分页、统计条、详情抽屉（概览/登录/搜索预设/站点覆盖）、cookie 保存与自检、单站抓取、批量设置、恢复默认；legacy `initSites` 不再初始化。
- 面板暂不支持新增/移除站点（站点清单来自私有包），按钮标未接并禁用；搜索预设只读，确认入口未接。
- 在线冒烟补站点清单夹具与“站点列表、筛选与抽屉”断言，smoke-live 19/19。

### 检查
- `run.sh` 全绿：smoke-live 19/19、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.106 · 2026-11-15

### 调整
- 数据清单页拆进 `views/Sources.vue`：搜索、站点/类型/状态/标记筛选、分页、送审、归档/恢复、本地查重、目标站查重、批量归档、导出 JSON；legacy `initSources` 不再初始化。
- `/api/site-defs` 增回 `cats` 分类映射，旧词条可按站点定义显示中文类型。
- `/api/catalog/bulk` 支持 `host` 与 `includeDup`，让“归档已跳过/已有”真正包含标了已有的新词条。
- 在线冒烟增加“数据清单渲染、筛选与标记”，smoke-live 19/19。

### 检查
- `run.sh` 全绿：smoke-live 19/19、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.105 · 2026-11-15

### 调整
- 待审核页拆进 `views/Queue.vue`：筛选/搜索/分页、详情表单、目标站、截图上传与删除、草稿预览、驳回/跳过/发布、批量查重/批准/发布；legacy `initQueue` 不再初始化。
- 在线冒烟增加“待审核列表与详情”，smoke-live 18/18。

### 检查
- `run.sh` 全绿：smoke-live 18/18、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.104 · 2026-11-15

### 接口
- `GET /api/queue` 支持 `status=a,b`、`offset`、`q`，返回 `matched/limit/offset`。
- `POST /api/queue/bulk` 支持 `fromStatus` 和 `publish`（走 publisher，真发布关闭时逐条记失败）。
- `POST /api/queue/:id/check` 补队列/已发布/词条库比对，返回 `duplicate`。
- `POST /api/queue/:id/action` 合并标题/副标题/简介/目标站/图床/匿名；`publish` 统一走 `/api/publish` 的 qB 链路。

### 检查
- api-v2 20/20；smoke-live 17/17；adapter 21/21；security 3/3；publish 4/4；scheduler 5/5；detect 5/5；build 7/7；规则体检 0 缺读者。

## v0.7.103 · 2026-11-15

### 说明
- 队列页 SFC 暂缓：现有 `/api/queue` 筛选/分页、批量 `fromStatus`、单条查重、发布表单字段与发布语义都对不上，硬搬会丢功能。
- 缺口与验收写进 `TASKS.md` 第八节；补完接口再搬队列页。

## v0.7.102 · 2026-11-15

### 调整
- 总览页拆进 `views/Dashboard.vue`：统计、实时日志、系统状态、最近发布、待审核；legacy 的 `initDashboardVue` 不再初始化。
- 在线冒烟增加“总览数据块渲染”，smoke-live 17/17。

### 检查
- `run.sh` 全绿：smoke-live 17/17、adapter 21/21、security 3/3、api-v2 16/16、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.101 · 2026-11-15

### 调整
- 设置页拆进 `views/Settings.vue`：版本模式、面板账号、调度、系统四张卡；legacy 的 `initSettings` 不再初始化。
- 在线冒烟增加“设置页调度开关可用”，smoke-live 16/16。

### 检查
- `run.sh` 全绿：smoke-live 16/16、adapter 21/21、security 3/3、api-v2 16/16、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.100 · 2026-11-15

### 调整
- 新增 `pta/checks/smoke-live.js`：临时 v2 后端 + dist，15 条在线断言（登录/七路由/站点抽屉/规则卡/调度卡/空状态/无报错）。
- 旧 `smoke.js` / `audit.js` 改名 `smoke-legacy.js` / `audit-legacy.js`，退出主检查；`run.sh` 改为 build → smoke-live → 其余检查。
- `run.cmd` 保留为 Windows legacy 备用，指向 legacy 文件。

### 检查
- `bash pta/checks/run.sh` 全绿：smoke-live 15/15、adapter 21/21、security 3/3、api-v2 16/16、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.99 · 2026-11-15

### 新增
- Docker 两阶段构建：构建阶段 `npm ci` + `npm run build`，运行阶段只带 `dist`、server 和生产依赖；`CMD` 指向 `pta/server/app-fastify.js`。
- `pta/docs/DOCKER.md`：build/run/compose、数据卷、密钥与 Secure 说明。
- `.dockerignore` 收敛构建上下文；compose 去掉 v2 不认的 `PTA_TOKEN`，默认只绑 `127.0.0.1`。

### 验证
- `docker build` 成功；临时容器 health 200（0.7.98）、登录 200、会话 200、静态资源与 changelog 200。

## v0.7.98 · 2026-11-14

### 新增
- `pta/server/detect.js`：按页面特征识别 NexusPHP / UNIT3D / Gazelle，特征不足回退 generic，不猜。
- `pta/checks/detect.js`：5 条离线夹具（三引擎 + 不足 + 仅 URL 提示）。
- `pta/docs/ADAPTERS.md`：引擎/站点实例/私有站点包三层结构，识别与上传表单映射流程。

### 检查
- detect 5/5；api-v2 16/16；adapter 21/21；security 3/3；publish 4/4；scheduler 5/5；build 7/7。

## v0.7.97 · 2026-11-14

### 安全
- 加密密钥支持 `PTA_SECRET_FILE`；线上 key 移到 `/etc/seedpod.secret`（0600 seedpod），`data/.secret` 已移除。
- `scripts/load-cookies.js` 在未显式设置时默认读 `/etc/seedpod.secret`，避免手工脚本生成新 key。
- security 检查新增“密钥从独立文件读取”，3/3。

## v0.7.96 · 2026-11-14

### 调整
- 站点适配方向改为开箱即用：内置 NexusPHP/UNIT3D/Gazelle 引擎 + 自动识别上传表单；真实站配置放 `data/` 私有包，不推给用户维护，也不入 git。
- 同步更新 `UPSTREAM.md`、`ROADMAP.md`、`DELIVERY.md`、`AGENTS.md`。

## v0.7.95 · 2026-11-14

### 安全
- 登录失败限速：同一 IP+用户名 5 次失败锁 10 分钟，返回 429；前端显示服务端提示。
- 会话落 SQLite `sessions` 表，重启服务不再全员掉线；过期会话自动清理。
- cookie 支持 `Secure`：`PTA_COOKIE_SECURE=1` 或 `X-Forwarded-Proto: https` 时加。

### 检查
- api-v2 增加连续失败限速断言，16/16；publish 4/4；scheduler 5/5；adapter 21/21；security 2/2；build 7/7。

## v0.7.94 · 2026-11-14

### 新增
- `pta/server/scheduler.js`：定时抓取 → 送审 → 发布；默认关，间隔 30–1440 分钟（默认 60），可暂停，失败写 `lastError/lastResult`。
- `GET/PATCH /api/scheduler`、`POST /api/scheduler/run`；设置页增加「调度」卡（开关、间隔、立即跑一次、上次结果）。
- `pta/checks/scheduler.js`：开关、间隔校验、送审复用、发布失败记录，5 条断言。

### 调整
- 送审与发布核心抽成 `pta/server/screen.js` / `pta/server/publish.js`，路由和调度器共用，避免两份实现。
- `run.sh` 增加 scheduler 检查；AGENTS 检查清单同步。

### 检查
- scheduler 5/5；publish 4/4；api-v2 15/15；adapter 21/21；security 2/2；build 7/7；规则体检 0 缺读者。

## v0.7.93 · 2026-11-14

### 新增
- `pta/docs/UPSTREAM.md`：UA/upbrr 许可边界、能力矩阵、clean-room 规则、M5–M10 对标路线、研究记录模板。
- `ROADMAP.md` / `DELIVERY.md` 增加 V2 对标 UA/upbrr 的里程碑。

### 调整
- 每轮自查从四问改为五问，新增“对标 UA/upbrr 的哪一块、查过并记录了吗”。
- `package.json` 许可改为 GPL-3.0-or-later，与根 LICENSE 一致。

## v0.7.92 · 2026-11-14

### 新增
- qB 发布后校验：解析 `.torrent` 的 `info.name` 与 infohash，回查 `torrents/info`，把 `hash/state/progress/verified` 记到队列条目。
- `publish.js` 增加第 4 条断言：mock qB 能查到种子并记录状态。

### 修复
- `parseTorrent` 加越界保护，修掉畸形 bencode 导致的死循环。

### 检查
- publish 4/4；api-v2 15/15；adapter 21/21；security 2/2；build 7/7；规则体检 0 缺读者。

## v0.7.91 · 2026-11-14

### 新增
- qB `torrents/add`：`qb.addTorrent` 用 multipart 把种子加进 qB，cookie 失效自动重登。
- 发布接口 `POST /api/publish/:id` 真模式：取来源站 cookie → 下载种子 → 加 qB → 状态 published 并记录 `qb`；dryRun 仍不发请求。
- `pta/checks/publish.js`：本地 mock qB + mock 种子源，3 条端到端断言。

### 说明
- 真发布仍默认关闭（`realPublish`）；目标站表单提交与发布后校验未开始。

## v0.7.90 · 2026-11-14

### 修复
- 规则分诊在真实 Vue 卡片生效：抓取/查重/发布卡的未接行加「未接」徽章并禁用；之前只改了旧 `rule-item` 渲染，页面看不到。
- 保存时未接行保持默认值，不会被界面改写。

### 检查
- build 7/7、api-v2 15/15、adapter 21/21、security 2/2、规则体检保留 8/未接 50/缺读者 0。

## v0.7.89 · 2026-11-14

### 修复
- `/api/dev` 的前后端栈改为从 package.json 读真实版本：`Vue 3.5.45 + Vite 7.3.8 + SFC（构建）` / `Node 22.23.4 + Fastify 5.12.8 + SQLite`，不再写“无构建”。
- `app-fastify.js` 头部“生产仍跑旧服务”的过期注释改掉。

## v0.7.88 · 2026-11-14

### 调整
- 按 `RULES-TRIAGE.md` 落地：`data.js` 50 条加 `todo:true`，9 条固定/装饰规则删除，规则总数 67 → 58。
- 规则行渲染「未接」徽章并禁用控件；保存与摘要跳过 todo 行。
- `audit-rules.js` 区分保留/未接，`--fail` 只拦“保留规则 0 命中”；`run.sh` 接入。
- `gen-rules-tree.js` 给未接规则加标记。

### 检查
- 规则体检：保留 8、未接 50、保留缺读者 0；api-v2 15/15；adapter 21/21；security 2/2；build 7/7。

## v0.7.87 · 2026-11-14

### 新增
- `pta/docs/RULES-TRIAGE.md`：67 条规则逐条分诊，保留 8、标未接 50、删除 9，附执行方式。

### 调整
- `ROADMAP.md` 规则分诊项勾选，新增“按分诊表禁用/删除”待做项。

## v0.7.86 · 2026-11-14

### 修复
- 抓取加服务端硬顶：每站每天默认 20 次，不跟界面配置走；`PTA_DAILY_MAX` 可调，范围 1–100。
- 列表、详情、失败请求都计入当天次数；到顶返回 `DAILY_LIMIT`（429），详情提前停。
- `/api/crawl/status` 的 `count/dailyMax` 改为真实当日次数；`/api/crawl/plan` 补 `dailyMax`；`/api/crawl/run` 补 `daily`。

### 检查
- adapter 新增每日硬顶断言，21/21；api-v2 15/15；security 2/2；build 7/7。

## v0.7.85 · 2026-11-14

### 修复
- 抓取游标：一页到底后 `catIdx` 轮转到下一个分类，page 归零，最后一类回到第一类。
- “抓这一类”显式传 `rotate:false`，不会串到其它分类。
- 接口返回补 `nextCategoryId / rotated`。

### 检查
- adapter 新增 5 条游标断言，20/20；api-v2 15/15；security 2/2；build 7/7。

## v0.7.84 · 2026-11-14

### 修复
- 抓取写入禁转/限转/独占/DIY marks；限转按 `addedAt` 计算剩余天数。
- 送审前硬拦“禁转”和“未满 7 天限转”，原因写进 `byReason`；不再只打标。

### 检查
- api-v2 新增 3 条（禁转、近期限转、过期限转），15/15；adapter 19/19；security 2/2；build 7/7。

## v0.7.83 · 2026-11-14

### 新增
- `scripts/goal-autoresume.py`：检查当前会话 goal，仅在“达到轮次上限”暂停时自动发 `resume`。
- systemd timer `opencode-goal-resume.timer`，每 3 分钟一次；手动暂停/完成不动。

## v0.7.82 · 2026-11-14

### 新增
- `pta/docs/PROBLEMS.md`：按 P0/P1/P2 列出现存问题、位置、影响、修法。
- `pta/docs/ROADMAP.md`：问题 / 需求 / 未来 / 待做四张清单，含需作者拍板的三件事。

## v0.7.81 · 2026-11-14

### 新增
- `pta/docs/DELIVERY.md`：最终交付的七条验收标准、验收方式、M1–M4 里程碑。

### 调整
- `AGENTS.md` 把 2000 行从“切换线”降级为“结构气味”，新增「交付闸门」，以 DELIVERY 七条为准。

## v0.7.80 · 2026-11-14

### 新增
- `pta/scripts/audit-rules.js`：把 data.js 的 67 条规则逐条在 v2 服务端 grep，报告 0 命中/仅 1 次命中。
- `pta/docs/ARCHITECTURE-TARGET.md`：终稿运行时、目录、搬迁顺序与不做什么。

### 调整
- `AGENTS.md` 增加「阶段切换线」：单文件 2000 行、同文件改 3 次、契约对不上就停。
- `CHECKLIST.md` 增加「每轮自查四问」；`run.sh` 末尾跑规则体检（只报告，不拦）。

## v0.7.79 · 2026-11-14

### 调整
- `pta/docs/MIGRATION-PLAN.md` 补齐每页完成定义、验收清单、停止条件、自主边界与交付节奏。
- `.opencode/commands/migrate.md` 改为指向计划文件，不再重复规则。

## v0.7.78 · 2026-11-14

### 修复
- 日志页在登录前挂载，首次拉取 401 后不再重试；改为登录且页面可见时再拉，失败每 1.5 秒重试，成功后接 SSE。线上实测 54 行、筛选正常。

## v0.7.77 · 2026-11-14

### 调整
- 日志页拆进 `views/Logs.vue`：自己拉 `/api/logs`、订阅 `/api/logs/stream`、级别筛选、下载、清屏；legacy 的 `initLogs` 不再初始化和调用。

## v0.7.76 · 2026-11-14

### 修复
- 站点页静态占位 `#site-detail` 与抽屉渲染重复，导致页面上出现两个同 id 元素；占位改名 `#site-detail-home`，线上实测只剩一个。

## v0.7.75 · 2026-11-14

### 新增
- `pta/checks/build.js`：起临时 v2 后端，用 dist 验证登录与七个路由。

### 调整
- 线上改为服务 `pta/web/dist`；`deploy.sh` 部署前自动 `npm ci && npm run build`。
- `run.sh` 增加构建与 `build.js` 检查。
- 旧 `pta/web` 保留回退，不再修改。

## v0.7.74 · 2026-11-14

### 新增
- `pta/web-src`：Vite 7 + Vue 3 工程，8 个页面 SFC（dashboard/sites/crawl/queue/sources/logs/changelog/settings）。
- `npm run dev/build/preview` 脚本；构建输出 `pta/web/dist`（gitignore）。

### 调整
- 旧 `pta/web/index.html` 的页面结构机械搬进 SFC，样式与图片放 `web-src/public/assets`。
- 迁移期逻辑仍走 `src/legacy/app.js`，页面壳先保持静态；旧版 `pta/web` 保留回退。

## v0.7.73 · 2026-11-14

### 新增
- `pta/checks/api-v2.js`：15 条 v2 契约检查，覆盖 health、安全头、登录/会话/退出、401、dev、config、flow、词条、screen 条件、凭据与下载器不回显、404。

### 调整
- `run.sh` 改跑 `api-v2.js`；旧 `api.js` 标 legacy，不再进检查。
- 文档里的 api 数量改为 api-v2 15。

## v0.7.72 · 2026-11-14

### 调整
- v2 `app-fastify.js` 补静态安全响应头：`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Content-Security-Policy`，与旧后端一致并放行 Cloudflare 分析。

## v0.7.71 · 2026-11-14

### 新增
- v2 `/api/catalog/screen` 接入流程页的分辨率、体积、必须带中字条件，并补同片去重。
- `scripts/load-cookies.js` 改为写 SQLite `credentials` 表（AES-256-GCM 密文）。

### 调整
- `package.json` 声明 `fastify` / `@fastify/static`，`start` 指向 `app-fastify.js`，`engines` 改 Node >=22。
- unit 改用 `User=seedpod` + `/etc/seedpod.env`（0600）；`deploy.sh` 用 sudo 重启。
- `/opt/seedpod` 代码目录归还部署账号，已部署 0.7.71。

### 说明
- v2 还缺安全响应头；api 检查仍测旧后端；smoke 18/23。均已在 TASKS 列明。

## v0.7.70 · 2026-11-14

### 新增
- `pta/checks/browser.js`：跨平台浏览器启动，Linux 默认 Chromium 新 headless，Windows 可选 msedge。
- `pta/checks/run.sh`：Linux 主检查入口；`playwright` 加入 devDependencies。

### 调整
- `smoke.js` / `audit.js` 不再写死 msedge，也不再依赖 `TEMP` 路径；每次检查强制整页重载，消除上一轮弹窗残留。
- `scripts/import-cookies.js` 改用共享的浏览器加载器。
- 文档改为 Linux 优先：AGENTS、CHECKLIST、ARCHITECTURE 的 `run.cmd` / MSYS 写法更新；新增 D13。
- 演示账号与线上密码分离：`AUTH_DEMO` 改为 `demo-pass`，真实密码从仓库移除；新增 D14。

### 说明
- smoke 18/23，5 条断言与当前 demo UI 不同步，已列进 TASKS；本次未改业务逻辑。

## v0.7.69 · 2026-11-14

### 调整
- 写明前端 demo 定位：`pta/web` 是原型，不是终稿；前端定稿后按目标架构整体搬迁一次。
- `AGENTS.md`、`HANDOFF.md`、`TASKS.md` 同步这条；`docs/DECISIONS.md` 追加 D11。

## v0.7.68 · 2026-11-14

### 调整
- `TASKS.md` P0 追加两条搬迁遗留：api 检查仍起旧 `app.js`（45 条测的不是 v2）、`load-cookies.js` 仍写 `credentials.json`（v2 不读）。
- `HANDOFF.md` 更新当前版本。

## v0.7.67 · 2026-11-14

### 新增
- `HANDOFF.md` 增加「架构与交付约束」：后端固定 Node + Fastify + SQLite，前端固定 Vue 3 无构建，最终必须 Docker 部署，旧后端只读。
- `TASKS.md` 增加第七节「待修清单」：P0 三项、P1 四项、P2 三项，标出哪些需要 root。
- `docs/DECISIONS.md` 追加 D8/D9/D10：后端栈、前端栈、Docker 交付。

### 调整
- `AGENTS.md` 项目说明补「交付形态：Docker 部署」。
- 版本号 0.7.67，静态资源缓存号同步。

## v0.7.66 · 2026-11-13

### 调整
- `AGENTS.md` 对齐生产实际：后端从“零依赖单文件”改为 v2（Fastify + SQLite，`app-fastify.js` + `routes-*.js` + `db.js`），旧 `app.js` 标记为只读参考。
- 铁律新增第 7 条：服务端改动只进 v2，避免同一功能两套实现。
- 依赖约束改为：前端不引入构建工具，后端运行时依赖只有 Fastify + `@fastify/static`。
- 故障对照补充 v2 的 MODULE_NOT_FOUND 处理与 `node_modules` 检查；发版说明注明不传 node_modules。

## v0.7.65 · 2026-11-13

### 新增
- `pta/docs/PIPELINE-RULES.md`：流程页 9 组 70 行（67 个控件）全量清单、三个收敛方案、发布条件 20 条留/合并/删/高级建议表。
- `pta/docs/DESIGN.md`：设计变量、组件白名单、文案规则、三宽度验收。
- `pta/docs/REQUIREMENTS-TEMPLATE.md`：需求卡模板与填写示例。

### 调整
- `AGENTS.md` 增加协作协议、复杂度预算、设计约束三节；修正后端路径为 `pta/server/...`。
- `RULES-TREE.md` 按当前 `data.js` 重新生成，补上落后的发布条件 23 行。
- 版本号升到 0.7.65，静态资源缓存号同步。

### 说明
- 本次只改文档与规则树，不动页面结构与后端接口。

## v0.7.64 · 2026-11-13

### 调整
- 发布条件卡去掉外层灰框，改成两列「标签 + 控件」，小节标题只当分隔行；卡高 718→500px，仍然紧凑。
- 发布字段把制作组、音轨移到最后两行，其余标签在前。

## v0.7.63 · 2026-11-13

### 调整
- 发布条件、发布字段、下载条件三张卡里的下拉与文本行改成抓取卡的版式：左边 104px 标签列，右边一行芯片；下拉变单选芯片，文本仍是输入框靠左。
- 新增行类型 pick（单选芯片）与 inline（标签左置）标记，只影响这三张卡，其余卡片不动。
- 标题与副标题的「测试匹配」改成整行，输入框自适应宽度，测试按钮与结果不再被挤在同一列。

## v0.7.62 · 2026-11-13

### 调整
- 出正式的双机流程：Windows 与 VPS 共用 main，开工前 `bash scripts/sync-check.sh` 对本地 / GitHub / VPS 三方提交，一致才 ff 拉取。
- VPS 配好部署密钥，origin 改成 SSH，可直接 pull / push；仓库补回 deploy.sh（rsync 到 /opt/seedpod + 重启），部署完成推一条 Telegram。
- AGENTS.md 的发版说明从 base64 逐个文件上传改成 pull + deploy.sh。

## v0.7.61 · 2026-11-13

### 调整
- 「目标站」卡拆掉：图床、截图来源移到简介卡（紧跟简介图片），发布后校验放到简介卡末尾，目标站分类映射移到发布条件（多目标站之后）。
- 发布卡剩 5 组：发布条件(23)、标题与副标题(9)、简介(13)、发布字段(6)、下载条件(4)。
- data.js 由行级文本搬移改为整树重写，避免手动拼接错位。

## v0.7.60 · 2026-11-13

### 调整
- 「中文副标题来源」从简介卡移到「标题与副标题」，排在副标题语言之后；标题卡 9 行，简介卡 10 行。

## v0.7.59 · 2026-11-13

### 调整
- 简介卡把「简介来源顺序」换成「简介获取方式」多选芯片，占满一行：① 本地已抓数据 / ② 源站详情页 / ③ TMDB / ④ IMDB / ⑤ 豆瓣 / ⑥ 豆影 / ⑦ 电影词条名 / ⑧ 交叉匹配（TMDB+IMDB+豆瓣+豆影）。
- ①/② 跟着抓取卡「抓详情页」开关：开着用本地已抓数据，关掉读源站详情页。
- 行渲染支持 wide（整行）标记，芯片行不再挤在一列里。

## v0.7.58 · 2026-11-13

### 调整
- 发布条件去掉「发到哪」小节，发布到（目标站选择）与多目标站并成一行，卡高 468→437px。
- 「目标站状态」并入查重卡底部：目标站已有原盘、目标站只有 DIY 放到「有效期与失败」之后，发布卡不再有这一组。

## v0.7.57 · 2026-11-13

### 优化
- 流程卡整体收紧：行距 5→3px、控件高 34→28px、字号 12.5→12px、开关 34→30px、列间距 18→12px、卡内边距 9/14→7/12。
- 发布条件卡高度 556→468px，一屏能看到更多行；小节标题间距同步缩小。

## v0.7.56 · 2026-11-13

### 调整
- 「标题匹配」并入「标题与副标题」：种子标题、中文副标题模板、副标题语言之后接匹配范围、写错时、排除匹配、白名单匹配、测试匹配；标题匹配卡删掉，发布卡降到 7 组。
- 「发布条件」卡内加小节标题：发到哪、门槛、内容要求、重复与失败，19 行按块分开，行本身不变。
- 前端新增 section / chips 两种行类型的渲染与样式，为后续紧凑版留口子（本次只用到 section）。

## v0.7.55 · 2026-11-13

### 调整
- 「失败与兜底」「内容要求」「发布时机」三组并进「发布条件」，发布卡剩 8 组。
- 发布条件现在 19 行：发布到、多目标站、分辨率要求、体积范围、下载完成再发布、种子完整性校验、主站已有同片、站点标限制分发、不满足时、图片上传重试、发布失败重试、连续失败几次暂停该站、失败时推送通知、最大体积、地区版本、必须有简介、必须带中字、BDInfo、截图至少几张。
- 主站已有同片默认改为「直接跳过（标记目标站已有）」；站点标限制分发默认改为「标记禁转/限转，不发布」，仍可切只收录或直接丢弃。

## v0.7.54 · 2026-11-13

### 调整
- 发布卡最前面新增「发布条件」组：发布到、多目标站、分辨率要求、体积范围、下载完成再发布、种子完整性校验。
- 原「目标站」组只留图床、截图来源、目标站分类映射、发布后校验。
- 原「发布条件」组改名「内容要求」，只留最大体积、地区版本、必须有简介、必须带中字、BDInfo、截图至少几张。
- 原「发布时机」组只留「不满足时」。

## v0.7.53 · 2026-11-13

### 修复
- 流程规则不再丢字段名：服务端保存时保留每行的 t，发布卡/查重卡才能按名字对上号。
- 旧数据没有字段名时，只有组数完全一致才按位置回填；组数对不上就不猜，避免删组后错位串值。

## v0.7.52 · 2026-11-13

### 修复
- 发布卡删掉「自动发布」组后，旧的已存配置还会按组序号回填，导致后面的组错位串值；改成所有组拍平后按字段名回填，查重卡同样处理。

## v0.7.51 · 2026-11-13

### 删除
- 发布卡里的「自动发布」整组（总开关、发布模式、间隔、每日上限），发布只走待审核里人工点。

### 调整
- 「标题与副标题」只留三样：种子标题原样照搬、副标题模板、副标题语言固定中文。
- 「匹配范围」「写错时」挪进「标题匹配」组，它们本来就只影响标题匹配。

## v0.7.50 · 2026-11-13

### 重排
- 发布卡「标题与副标题」：种子标题移到左一，副标题语言移到左二（正下方），其余字段顺延；已存配置改按字段名回填，不会再错位。

## v0.7.49 · 2026-11-13

### 调整
- 发布卡「标题与副标题」的发布标题改为「种子标题」：文字“原生转载不修改”在左，应用按钮在右，点按钮才生效。

## v0.7.48 · 2026-11-13

### 调整
- 发布卡的「发布标题」由说明文字改成按钮「原样发布不修改」，和同组其他控件对齐。

## v0.7.47 · 2026-11-13

### 优化
- 查重卡与发布卡的分组面板收紧上下留白（每组 padding 9/14、组间距 8、字段行 5px），整页变矮近三成。

## v0.7.46 · 2026-11-13

### 删除
- 流程页抓取/查重/发布卡里每个字段下面的灰色说明小字，只留字段名。

### 调整
- 发布卡与查重卡列宽放宽到 300/280，字段上下留白加大，行不再挤在一起。

## v0.7.45 · 2026-11-13

### 调整
- 查重卡与发布卡统一成「标签在上、控件在下」的自适应多列布局，长标签不再被挤成竖排；查重卡从 9 行纵排压到 4 列。
- 本地演练卡没有内容时不再撑出一块空白。

## v0.7.44 · 2026-11-13

### 修复
- 查重卡不显示：资源缓存参数不一致，浏览器仍在用旧 data.js（旧查重 14 行含正则自定义行），新渲染读到已删除的状态直接抛错。现在 css/data/app 统一同一个版本参数。
- 发布卡 11 组被挤成竖排文字：发布卡内组改为整行、字段自适应列宽，不再挤在同一行。

## v0.7.43 · 2026-11-13

### 调整
- 抓取卡恢复呼吸感：预设一条一行、标签列 68px、芯片 28px 高；请求限制四项进浅底面板；底栏一行放实时说明与「抓详情页」开关。
### 修复
- 限制输入的上下限改为读服务端 /api/config 的 limits，不再前端写死；失焦时按上下限收敛。
- 底栏说明只讲真实参数，删掉按列表条数估算「本次大约几次」的假数字。

## v0.7.42 · 2026-11-13

### 调整
- 查重卡只留查重本身：本地词条、待审核队列、目标站搜索、判定强度、体积容差、查重有效期、词库有效期、请求失败。
- 发布前条件、发布时机、标题匹配、目标站状态四组挪进发布卡；排除/白名单/测试匹配随行迁移，保存时照旧写 flow.rx。
- 流程页保存每行带上标题，服务端按标题取条件，不再依赖行序；老数据没有标题时回落原来的行序。

## v0.7.41 · 2026-11-13

### 调整
- 抓取卡类型/媒介/分辨率/优惠的选项改为左对齐，紧跟在标签后面，不再贴右边缘。
- 删掉「每 60 秒最多发一次 · 45 分钟内最多 12 次请求」这行说明。

## v0.7.40 · 2026-11-13

### 优化
- 抓取卡去掉每行的说明小字与卡片描述，标签只留名词。
- 请求限制四项并成一行四列，输入框 88px；行距压到 3px，卡片再矮一截。

## v0.7.39 · 2026-11-13

### 优化
- 抓取卡紧凑化：预设每条一行、行距减半；请求限制四项改成两列排布，输入框缩短；抓详情页单独占一行。
- 新增 .crawl-card 作用域样式，只影响抓取卡，查重与发布保持原样。

## v0.7.38 · 2026-11-13

### 新增
- 抓详情页：开启后，列表入库前按「请求间隔 + 窗口次数」预算逐条取详情页，补全大小、分类、媒介、标签、副标题、infohash、简介、海报、原盘标记；最多 10 条，失败只记原因不中断。
- 详情解析器 `server/adapters/details.js`：纯函数，NexusPHP 表格与常见 div 都认，认不出留空；带夹具用例。

### 调整
- 抓详情页开关从「只存浏览器」改为存服务端（config.detail），换设备也生效；站点覆盖里的开关优先。
- `/api/crawl/run` 接受 detail、detailLimit，返回体带 detail 统计。

### 优化
- 每次详情请求都计入窗口预算与最小间隔，避免开关一开就超额。

## v0.4.1 · 2026-11-12

### 重排
- 流程页「抓取」卡片拆成「请求限制」加「搜索预设」；请求间隔、每站每天、全站每天、连续失败、运行模式、抓详情页都放回抓取，不再放设置页。
- 排除/白名单/测试匹配从「发布 › 标题与副标题」挪到「查重 › 筛选条件」。

### 删除
- 抓取卡里的「跳过规则」标签组（抓取只记事实，自动打标，跳不跳留到筛选）。
- 「请求限制」在设置页的那一份（同一件事只留一处）。
- 旧的「每轮最多翻页」「断点续抓」「并发」「请求审计」行（程序行为，不是用户参数）。

### 新增
- 页脚开发说明：版本、开发日期、前后端技术栈、页面数、接口数、站点/预设/词条/待审/下载器数、运行时长，全部来自 `/api/dev`。
- `/api/dev` 接口；版本号升到 0.4.1。
- 「连续失败」改成可配置（1–10 次），服务端按范围校验后落 config.json。
- 下载器探测补真实磁盘总量（statfs），qB 报的剩余比本机盘大时以本机盘为准；余量条重新有数据。

### 调整
- 站点覆盖：单独设置本站改成真开关；抓取间隔改为分钟数下拉；每天抓几次改成数字输入；关闭时下方整块置灰不可点。

### 优化
- 抓取卡底部小字实时显示「每 N 秒发一次请求 · 模式 · 本次大约几次请求」。
- 保存抓取卡时把节奏与上限一并写进服务端 `/api/config`。

## v0.4.0 · 2026-11-11

- 基础版本：站点 / 流程 / 待审核 / 数据清单 / 日志 / 设置，抓取演练、查重、发布卡片。

## v0.4.2 · 2026-11-12

### 修复
- 下载器测试对 qBittorrent 5.x 一律误判「不通」：5.x 登录成功回 204 且 cookie 名是 QBT_SID_<端口>，旧代码只认正文 "Ok." 和 SID=，改成认 cookie + 2xx 即成功。两台下载器现在都通过（v5.1.2 / v5.2.4），分类也能读出来。
- 下载器密码之前是明文存在 downloaders.json 里，现在改为 AES-256-GCM 密文（与站点 cookie 同一套密钥），启动时自动把旧明文迁移成密文；接口只回 hasPass，不回明文。
### 说明
- 容量进度条只在面板能确认同一块盘时才画；qB 只报剩余空间不报总量，远端下载器不编总量，只显示真实剩余。

## v0.4.3 · 2026-11-12

### 修复
- 下载器空间：之前拿面板本机磁盘的总量去补远端 qB 的总量，导致「共 314GB」和 qB 自己显示的对不上。现在只显示 qB 上报的真实剩余，总量不知道就不写，也不画假进度条。
- 站点登录状态：站点页的「登录」列接服务端保存的 cookie 自检结果。可用=自检通过，失效=自检失败，未自检=还没探过；不再一律显示「未登录」。筛选与总览计数同步改词。

## v0.4.4 · 2026-11-12

### 新增
- 站点页工具栏加「自检有 cookie 的站」：逐个对有 cookie 的站点跑一次会话自检（每个站一次 GET），结果直接写进登录列。
### 调整
- 登录列口径固定为：可用＝cookie 自检通过；失效＝cookie 自检失败；未自检＝还没探过。不再把「有 cookie 但没探过」显示成「未登录」。

## v0.4.6 · 2026-11-12

### 新增
- 向目标站查重（真请求）：拿词条标题去目标站搜一次，按旧脚本规则判定——只认原盘、分辨率档一致、体积差 ≤2.5GB 或 ≤5%；命中全是 DIY 记「仅DIY可发」。结果写回词条（dupe/dupeUrl/dupeAt/dupeTitle/dupeSizeGB/dupeTarget）。
- 数据清单工具栏加「选目标站」下拉（只列存过 cookie 的站）和「向目标站查重」按钮，每次默认 3 条，条间留 8–20 秒。
- 词条行上显示查重结论：可发 / 仅DIY可发 / 已有原盘 / 没查成，点标签回到当时的搜索页。
### 调整
- 「已有与归档」改名「词条数据」，加「查重有效期」（7/15/30/90 天）。

## v0.4.8 · 2026-11-12

### 新增
- 基础版 / 开发版切换：设置页「版本模式」，选开发版才出现「更新日志」页；选择存在浏览器里。
- 更新日志页：读仓库 CHANGELOG.md，按 删除 / 新增 / 优化 / 调整 / 重排 展示。
### 调整
- 移动端适配：窄屏顶部栏换行、右侧导航改底部横条、数据清单卡片化、弹窗 94vw。

## v0.4.9 · 2026-11-12

### 调整
- 前端引入 Vue 3（自托管 vue.global.prod.js，无构建），更新日志页改成 Vue 渲染，用 render 函数以符合 CSP，不跑运行时编译。
### 新增
- 基础版 / 开发版切换（设置 › 版本模式）：开发版才出现「更新日志」页。
- 更新日志页读仓库 CHANGELOG.md，按 删除 / 新增 / 优化 / 调整 / 重排 展示。

## v0.5.0 · 2026-11-12

### 调整
- 设置页整页改成 Vue 3 组件渲染（render 函数，单次挂载 + reactive 状态），旧的字符串拼接与事件委托全部删掉；版本模式、退出登录、清空缓存的行为不变。

## v0.5.1 · 2026-11-12

### 调整
- 「请求限制」卡片改成 Vue 组件，独立的保存按钮直接写 /api/config：请求间隔、每站每天、全站每天、连续失败、运行模式、抓详情页都在这里配一次；旧的 pace 逻辑与 data.js 里的重复分组删掉。

## v0.5.2 · 2026-11-12

### 调整
- 「搜索预设」卡片改成 Vue 组件，按组渲染类型/媒介/分辨率/优惠，选中条件直接写 /api/flow 的 fetch 组；流程页旧的四组拼接代码删掉，查重/发布保存时不再覆盖 fetch。

## v0.5.3 · 2026-11-12

### 新增
- 流程页加「自动查重」开关，默认关闭；关闭时不会主动向目标站发请求，只有数据清单里手动点「向目标站查重」才查。开关状态存服务端 config.json（autoDupe），重启后保持。

## v0.5.6 · 2026-11-13

### 调整
- 「查重」卡片改成 Vue 组件：筛选条件、关键词（排除/白名单/测试）、词条数据有效期都在一张卡里，保存写 /api/flow 的 dedupe 组与 rx；旧的查重渲染与事件托管删除，发布卡保存不再覆盖查重。

## v0.5.8 · 2026-11-13

### 调整
- 「发布」卡改成 Vue 渲染，自定义 html 行保留原样注入，按钮仍走事件委托；三张卡（抓取/查重/发布）全部 Vue 化，旧 sectionHtml/setRowsHtml 渲染路径随之退场。
- 卡片收紧：字段行距 8px、控件高 30px、抓取卡四组数值两列排布，整体密度回到迁移前。

## v0.6.0 · 2026-11-13

### 调整
- 总览页改成 Vue 渲染：统计、实时日志、系统状态、最近发布、待审核五块都是响应式组件，布局与卡片结构照旧；旧 renderDashboard/renderPending/renderPublished/renderHealth 只保留为同步触发器。
