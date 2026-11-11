# PLAN · SEEDPOD 开发计划与进度明细

最后更新：2026-11-11 17:40（部署 19f）
本文件是「计划清单 + 进度明细」，每轮开发后更新；TASKS.md 记已完成项，HANDOFF.md 记交接状态。

## 文件放置硬规定（长期有效）

pta 的开发文件只能放在 main/pta 下，不许跳出 pta 落到仓库根。

- 进 pta/ 的：`pta/server`、`pta/web`、`pta/checks`、`pta/fixtures`、`pta/data`（采样产物）、`pta/docs`（面板规则树等）、`pta/scripts`（面板专用脚本），以及以后新增的 pta 代码/文档/脚本。
- 留仓库根的：README、LICENSE、AGENTS.md、.github、项目级 scripts/docs/styles、package.json、Docker 与 compose、HANDOFF.md、TASKS.md、PLAN.md。
- 两条方向都守：pta 文件不许出 pta；非 pta 文件也不许塞进 pta。

## 仓库结构（2026-11-11 起）

```
pta/
  server/    零依赖后端（app.js、adapters、secretbox、catalog、match）
  web/       无构建前端（index.html、assets/app.js|app.css|data.js）
  checks/    smoke / audit / adapter / api / security
  fixtures/  离线解析测试夹具
  data/      采样产物（非运行时数据）
  docs/      面板专用文档（RULES-TREE.md）
  scripts/   面板专用脚本（gen-rules-tree.js）
```

操作说明见 pta/docs/USAGE.md；运行时数据不在仓库里：本地默认 `<repo>/data`，测试机 `/opt/seedpod/data`。

## 一、当前进度总览

| 层 | 内容 | 状态 |
| --- | --- | --- |
| 后端 | 零依赖 Node 单文件服务（会话、配置、站点、凭据、抓取、词条、队列、发布、日志、SSE、静态托管） | 可用 |
| 站点适配 | NexusPHP / UNIT3D / Gazelle / 兜底 四个解析器 + site-def + 搜索预设 | 可用，分类名与发布时间仍在补 |
| 三步流水线 | 抓取 → 数据清单（筛选/标记/送审/归档）→ 待审核（发布记账） | 可用，真实发布未接（按铁律不做自动发帖） |
| 前端 | 7 页 + 登录页，无构建，全部交互可点 | 可用 |
| 检查 | smoke 23 / audit 0 问题 / adapter 18 / security 2 / api 38 | 全绿 |
| 部署 | systemd `seedpod`，公网经 Cloudflare 到 nginx 反代，数据 `/opt/seedpod/data` | 运行中 |

## 二、后端接口清单（已实现）

- 会话与账号：`POST /api/login`、`POST /api/logout`、`GET /api/session`（cookie 与 Basic 都认）
- 健康与统计：`GET /api/health`、`GET /api/stats/overview`
- 配置：`GET/PATCH /api/config`、`GET /api/config/user`、`GET/PUT /api/flow`
- 站点：`GET /api/sites`（清单来自数据目录 `sites-data.local.js`）、`GET/PUT/DELETE /api/site-config/:host`
- 站点定义与预设：`GET /api/site-defs`、`GET /api/site-def/:host`、`GET/PUT/DELETE /api/sites/:host/search`、`GET /api/site-search`
- 凭据：`GET /api/credentials`、`PUT/DELETE /api/credentials/:host`、`POST /api/credentials/import`、`POST /api/sites/:host/session-test`
- 抓取：`POST /api/crawl/plan`（只拼 URL）、`POST /api/crawl/run`（单次 GET，30 秒间隔/单站每日 20 次/并发锁）、`GET /api/crawl/status`
- 词条：`GET/POST /api/catalog`、`POST /api/catalog/:id/status`、`POST /api/catalog/:id/marks`、`POST /api/catalog/bulk`、`POST /api/catalog/screen`（支持 `host` 与 `ids`）、`DELETE /api/catalog/:id`
- 待审核：`GET/POST /api/queue`、`GET/DELETE /api/queue/:id`、`POST /api/queue/:id/action`（approve/reject/publish/skip）、`POST /api/queue/bulk`、`POST /api/queue/:id/check`
- 草稿与记账：`GET /api/publish/preview`、`GET /api/published`
- 本地库与下载器：`/api/library`、`/api/downloaders`（探测只连用户自己填的地址）
- 任务与日志：`POST/GET /api/tasks`（只接演练 dryRun）、`GET /api/logs`、`GET /api/logs/stream`

## 三、三步流水线明细

### 第一步 抓取
- [x] 按搜索预设类目轮转、页码续抓，进度记在 `data/crawl-state.json`
- [x] 单次 GET，同站间隔 30 秒、单站每日 20 次、同站并发锁；没 cookie 直接 NO_COOKIE
- [x] 流程页可选来源站，没选不发请求；「看地址」只读本地配置显示下一抓 URL
- [x] 站点抽屉也能直接抓一页（带二次确认，条数用流程页选的 5/10/20/100）
- [x] 抓取标记：禁转/独占/DIY/限转 按标题关键词；未满 7 天按行里的发布时间（data-added/data-time/time datetime），只打标不过滤
- [ ] 分类名补齐：老词条只有分类 id，重抓一次会带 catName
- [ ] 详情页解析（种子大小、原盘判定）未接，目前只用列表页字段

### 第二步 筛选
- [x] 数据清单就是词条列表：站点/类型/状态/标记四个筛选、分页每页 100（一次读 2000）
- [x] 行内可手动开关五个标记、单条送审、单条归档；标题可点开原站详情页
- [x] 工具栏「按条件送审」按当前站点筛，二次确认后调 `/api/catalog/screen`
- [x] 筛选规则取自流程页「筛选」卡片（分辨率/体积/中字/已有判重）
- [x] 批量「归档已跳过」；送审后同步刷新待审核计数与总览
- [ ] 跨站同一部片的「已有」提示目前只在筛选时判定，列表里没有显式「撞了哪条」

### 第三步 发布
- [x] 待审核页：目标站单独选（默认流程页目标站）、标题/副标题/简介/图床/匿名
- [x] 截图上传：浏览器先压到 1600px jpeg，服务端按 `{name,url}` 存，单组 2.5MB 上限
- [x] 草稿预览：`/api/publish/preview` 拼标签与分类建议；通过并发布、全部批准、全部发布
- [x] 发布记账：队列置 published、词条标 published、`published.json` 记目标站与来源站
- [ ] 真正的站点发帖不做（按铁律不自动操作真实站点），只把草稿与记账做完整

## 四、前端页面状态

| 页面 | 状态 | 备注 |
| --- | --- | --- |
| 总览 | 真数据 | 今日抓取/登录正常/下载器/磁盘余量来自后端，30 秒自刷 |
| 站点 | 真数据 | 305 站、架构/预设/登录/上次抓取；抽屉含概览/基本信息/登录/搜索预设/站点覆盖 |
| 流程 | 真数据 | 三步卡片 + 本地演练 + 来源站 + 看地址 + 目标站 |
| 待审核 | 真数据 | 列表/详情/草稿/批准/驳回/跳过/批量 |
| 数据清单 | 真数据 | 筛选/标记/送审/归档/分页/导出 |
| 日志 | 真数据 | SSE 实时，level/src 过滤，下载/清屏 |
| 设置 | 真数据 | 抓取节奏写服务端；面板账号只读（环境变量）；退出登录 |

## 五、安全与硬约束执行情况

- [x] 真实站点清单从 web 根移到数据目录，服务端对 `*.local.*` 与点开头路径一律 404；公网已验证 404
- [x] 凭据 AES-256-GCM 加密，接口只回 `hasCookie`/`updatedAt`，不回明文
- [x] 面板账号密码只在测试机 systemd 环境变量，不进代码与日志
- [x] 真实 PT 站点只做一次性采样，不做并发/压测/UA 轮换，不自行找 cookie
- [ ] 采样补齐（登录墙站点要用户自己在浏览器登录后给 cookie）

## 五之二、2026-11-11 下午已完成

- 第二步「筛选」改名「查重」：数据清单加「查重」按钮，调 `/api/catalog/check` 跟待审核/本地库/已送审已发布比对，重复的标「已有」并记下撞到哪条（dupNote），只打标不改状态
- 排除/白名单正则存进流程配置并真正参与筛选（命中排除规则或白名单未命中就跳过）
- 发布卡片精简：去掉发布顺序/只在时段内发布/免审直接发的分类；自动发布总开关移到发布模式前；人工点通过改成文字按钮单选
- 流程页规则里的开关统一改成可点击文字按钮（开/关），不再画独立开关
- 站点抽屉：基本信息并进登录、备注去掉、站点地址进登录、架构缩成小选择放抓取按钮右边、启用开关挨着抓取按钮
- 仓库结构收敛：pta 自己的代码只在 pta/，非 pta 文件退回仓库根

## 五之三、站点页分页（19c）

站点页每页 60 个站，底部显示页码与上一页/下一页，筛选后回第一页；305 个站分成 6 页渲染。

## 六、下一批任务（按顺序做）

1. [done] cookie 保存反馈：保存后显示「已保存 + 更新时间 + 自检结果」，重开页签仍能看到
2. [done] 站点覆盖里「每天抓几次」与「一轮多少条」分开：流程页 5/10/20/100 并记住，抽屉抓一页也用它
3. [done] 标记判断依据在界面可见（剩余天数 + title 说明）
4. [done] 数据清单显示「已有」判定来源（dupNote，悬浮可见），并可一键把跳过项与已有项归档
5. [partial] 分类名补齐：抓取会把 catName 写进词条、类型列也会用它兜底；旧数据要重新抓一次才带上
6. [todo] 待审核列表分页与搜索体验（条数多时）
7. [done] 站点覆盖已接：间隔/每天次数按站点生效（全局上限压住）；抓详情页与优先级先存配置并由界面写明
8. [blocked] 详情页解析（大小/原盘判定）：要真实站点详情页样本，等采样配额
9. [done] 发布动作保存目标站，批量发布支持默认目标站
10. [done] 请求体上限从 1MB 提到 8MB，带截图的发布请求不再挂起
11. [done] 发布表单回显已存值（简介/匿名/图床/目标站）

## 八、当前已知缺口

- 详情页解析（种子大小/原盘判定）没有做：需要真实站点详情页样本，等用户给采样配额，不自行去抓
- 分类名补齐只完成一半：新抓的会带 catName，旧的 125 条要重抓才带
- 图床/截图来源/多目标站/发布后校验四项只存配置，界面已标明还没接
- 自动发布（定时/间隔）没有调度器，发布仍靠人工点「通过并发布」记账
- 待审核一次最多 500 条，够用但没有分页

## 七、每轮固定动作

1. 只改最小范围，改完 `pta\checks` 全绿再提交
2. commit/push 后部署测试机（代码 tar 到 `/opt/seedpod`，数据放 `/opt/seedpod/data`，然后 `systemctl restart seedpod`）
3. 更新本文件、TASKS.md、HANDOFF.md
4. 公网验证：页面 200、`*.local.*` 404、接口未登录 401
