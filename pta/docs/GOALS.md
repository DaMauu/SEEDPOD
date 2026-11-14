# 执行目标（GOALS）

本文件是当前阶段的 goal 清单。一个时间只推进一个 active goal；完成一个再开下一个。goal 不是需求池，必须有明确验收和证据。

## 命名约定

- **G** = Goal，执行目标（G0–G14），带验收、状态、版本。日常只说 G。
- **P** = Priority，优先级（P0 必须 / P1 应该 / P2 可以），只用来排序，不是任务编号。
- **M** = Milestone，路线图阶段（M1–M14+），写在 `ROADMAP.md`，一个 M 可以包含多个 G。
- 聊天里默认只说 **G**；需要强调轻重缓急时写“G10，P0”；M 只用于路线图，不再和 G 混用。

## 状态总表

| Goal | 内容 | 状态 | 依赖 | 验收命令 / 证据 |
| --- | --- | --- | --- | --- |
| G0 | 项目地基：Node/Fastify/SQLite/Vue、站点包、检查、CLI、Docker | ✅ 基线 | 无 | `run.sh` 全绿、线上可用 |
| G1 | 响应式自动验收进 `run.sh` | ✅ 完成（0.7.163） | 无 | `responsive-layout.js` 32 项通过 |
| G2 | 可靠性债：公共函数、空 catch、TODO/console | ✅ 完成（0.7.169） | 无 | 空 catch 0、审计 87 |
| G3 | 拆 `Sites.vue` | 🟢 open | G2 完成后 | smoke 21/21、responsive 32 项 |
| G4 | 40 条未接规则分诊 | 🟢 open · 等拍板 | 用户逐条决定 | `audit-rules.js` 0 缺读者 |
| G5 | 真实目标站发布 + 真实 rTorrent/Deluge | 🟡 部分完成 · 等真实 daemon | 用户提供真实 daemon | 真实发布/回查记录 |
| G6 | 站点包例外 UI + Docker/备份复验 | 🟢 open | G2/G3 后 | 例外确认可用、备份恢复演练 |
| G7 | 发布工作流状态机：阶段落库、幂等、恢复 | ✅ 完成（0.7.170） | G2 | submitted/injected 幂等断言通过 |
| G8 | 原生单 release 上传准备与站点提交 | ✅ 完成（0.7.172） | G7、G9、G4、G5 | prepared payload 已接 target-upload |
| G9 | CLI-first 核心层：抓取/查重/发布都可命令行 | ✅ 完成（0.7.171） | G7 | 本地 CLI 12/12，不启 HTTP |
| G10 | 多目标发布框架 | 🟡 进行中：CLI/API 多目标干跑已落地；面板多选/真实多站待做 | G8、G9 | 一条 release 多站 dry run/提交/回查 |
| G11 | 上传准备 1:1：元数据/命名/简介/截图/BDInfo/图床 | 🟢 open | G8 | 对齐 UA/upbrr 的准备能力 |
| G12 | 全自动流水线：抓取→查重→准备→多站发布 | 🟢 open | G10、G11、G13 | 一条命令推进，失败可恢复 |
| G13 | 站点覆盖与验证：3→10→100 站 | 🟢 open | G5、G10 | 每站真实提交/回查证据 |
| G14 | 可选 Python sidecar：AI/OCR/pandas/Scrapy | ⚪ 可选 | 有具体需求再开 | 离线 JSON 任务，不换主后端 |

## G0 · 项目地基（已完成）

Node + Fastify + SQLite + Vue 3/Vite、站点包、检查、CLI、Docker 已作为基线存在；后续 goal 不重选技术栈、不引入 Redis/消息队列/独立 worker/Postgres。

## G1 · 响应式自动验收（已完成）

**目标**：八个页面在 360 / 390 / 768 / 1280 下自动检查横向滚动、按钮文字溢出、卡片/列表对齐、徽标换行。

**交付**：

- `pta/checks/responsive-layout.js`
- 接入 `pta/checks/run.sh`
- 夹具：305 站、长标题、空/有数据队列、日志、下载器、目标站
- 当前 32 项通过

**证据**：`响应式布局 · 4 宽度 × 8 页 / 32 项通过`。

## G2 · 可靠性债（下一个）

**目标**：把失败会静默吞掉、重复实现的页面工具函数收口，不改变业务行为。

**范围**：

- 抽公共函数：`toast`、`confirmBox`、`visible`、`loggedIn`、`initials` 等；`load` / `ensure` 保留页面内，避免过度抽象。
- 空 `catch`：至少记录上下文或 toast，不允许静默吞；审计当前列出 46 个。
- 清理 5 处 TODO/FIXME 和 1 处 `console.log`。
- 目标：重复函数名从 11 个降到 0（对上述公共函数而言）。

**不做**：不改页面布局、不改接口、不碰真实站。

**完成（0.7.169）**：

- 新增 `utils/ui.js`：`toast / confirmBox / loggedIn / viewVisible / initialsOf` 收口；`initials` 两处不同语义合并为 `initialsOf(text)`。
- 新增 `utils/errors.js`：显式空 catch 清零，Promise 的 `.catch(() => null)` / 通知失败也补了 `reportError` / warn。
- `fmtBytes` 收口到 `utils/format.js`；`loadSites` 保留两份：Crawl 需要 siteStatus/siteCfg，Queue 只要站点列表，已在代码注释写明；`tone` / `openAdd` 语义不同，不硬合并。
- `console.log` / TODO 自计数清零；质量审计 **87（优质）**，代码 91、复用率 85、质量 100。
- 全量 `run.sh`、smoke 21/21、responsive 32 项、CLI 9/9 通过。

**保留的重复函数**：`load` / `ensure` 是页面生命周期，`loadSites` 是不同数据需求；`tone` / `openAdd` 在不同页面含义不同，强行共用会引入条件分支。

**验收**：

- `bash pta/checks/run.sh` 全绿
- `responsive-layout.js` 32 项仍通过
- 质量审计「代码 / 逻辑 / 复用」不下降，总体不低于 83
- 空 catch 清零或有明确上报

## G3 · 拆 Sites.vue

**目标**：把 `Sites.vue`（1181 行，不含样式）拆成列表、详情、表单等组件，降低单文件复杂度。

**范围**：

- 先画组件边界：列表/筛选、站点详情、添加编辑表单、分类映射弹窗。
- 样式继续留在对应组件 `<style scoped>`。
- 不改 API、不改站点数据格式。

**验收**：

- `Sites.vue` 主文件降到 600 行以内
- smoke 21/21、responsive 32 项通过
- 站点列表、详情、表单、分类映射手工点一遍

## G4 · 40 条未接规则分诊

**目标**：把 50 条规则里的 40 条未接逐条定性，停止继续挂“未接”。

**范围**：

- 输出新表：每条规则标「做 / 删 / 永久禁用」，写理由和影响页面。
- 删除的从 `src/data/rules.js` 和服务端读取点同步删；永久禁用的保留说明。
- 只做分诊和同步，不在这个 goal 里实现多目标站/图床等大功能。

**依赖**：需要用户逐条拍板；我可以先出建议表。

**验收**：

- `node pta/scripts/audit-rules.js --fail` 0 缺读者
- 页面不再出现没有说明的“未接”
- 规则总数、保留数、删除数写进 HANDOFF

## G5 · 真实环境验证

**目标**：验证真实目标站发布和真实 rTorrent/Deluge 适配器。

**依赖**：

- 有上传权限的目标站 + 用户授权
- 真实 rTorrent / Deluge 地址和账号（只放部署环境，不进仓库）
- 真发布保持默认关，验证通过后再讨论开启

**验收**：

- 目标站：识别上传表单、提交、回查标题/分类/截图
- rTorrent/Deluge：连接、列种、添加、校验
- 全程不记录 cookie/密码/IP 到仓库或回复

## G6 · 站点包例外 UI + Docker/备份复验

**目标**：把站点包自动化的“例外”做成可操作界面，并完成交付前 Docker/备份复验。

**范围**：

- 站点包状态：覆盖站点数、分类覆盖率、缺字段/低置信度例外
- 例外确认：确认一次后写入私有 `data/` 覆盖，不回写密文包
- Docker：一键起、数据卷 `/data`、重启持久化
- 备份恢复：备份 `seedpod.db` + 私有站点配置，恢复后健康检查通过

**验收**：

- 例外列表可筛选、可确认、可保存
- `docker compose up` 后 `/api/health` 正常
- 备份恢复演练记录写进 `pta/docs/USAGE.md` 或 `DOCKER.md`

## G7 · 发布工作流状态机

**目标**：把“抓取 → 元数据 → 站点规则 → 查重证据 → 媒体/简介 → 预览 → 提交 → 客户端注入”落成 SQLite 里的阶段状态，失败可从中间恢复，不重复提交。

**范围**：

- 队列条目增加阶段：`source / metadata / rules / dupe / media / preview / submitted / injected`。
- 每阶段状态：`pending / running / done / blocked / failed`，记录 `attempts`、`lastError`、`nextRetryAt`、`evidence`。
- 每阶段幂等；`advance(id)` 一次只推进一步；dry run 和人工确认点。
- 调度器改成推进可执行阶段，不再一口气抓→审→发。
- UI 显示当前阶段、下一步、失败原因和重试按钮。

**完成（0.7.170）**：

- queue 阶段扩展为 `draft / prepared / previewed / submitted / injected / failed`。
- 每阶段落 SQLite：`stageAttempts`、`stageLastError`、`stageNextRetryAt`、`stageEvidence`、`stageHistory`、`stageFailedFrom`。
- `advance` 一次只推进本地一步；`target-upload` 成功写 `submitted`，`publish` 成功写 `injected`，重复提交/注入被 409 或 skipped 拦住。
- 待审核详情显示阶段、尝试次数、错误、下次重试时间；失败有「重试」按钮。
- `stage.js` 5/5、target 10/10、publish 5/5、responsive 32 项、全量通过。

**明确不做**：不引入 Redis / 消息队列 / 独立 worker / Postgres；不做 UA/upbrr 交接；`advance` 不隐式真发，提交/注入仍用明确命令。

## G9 · CLI-first 核心层

**目标**：抓取、查重、数据、发布、验证都用 CLI 驱动；面板只是调用同一套核心服务的视图。不再把业务逻辑写死在页面路由里。

**范围**：

- 抽出 `pta/core/`（或同等服务层）：crawl / screen / queue / prepare / publish / target / inject。
- CLI 直接调用 core，不要求先起 HTTP；Fastify 路由改成薄适配层。
- 命令契约见 `pta/docs/CLI.md`：`crawl`、`screen`、`queue`、`prepare`、`preview`、`publish`、`target-upload`、`verify`、`advance`、`run`。
- 默认干跑，`--real` 才真抓/真发；`--json` 给脚本用；失败用非 0 退出码。
- 不打印 cookie/密码/passkey/IP；不复制 UA/upbrr 代码。

**完成（0.7.171）**：

- 新增 `pta/core/index.js`：本地上下文 + status/queue/crawl/screen/prepare/preview/advance/run/publish/targets/target-upload/verify。
- 新增 `pta/server/target-service.js`：HTTP 路由与 CLI core 共用提交/幂等/阶段逻辑。
- CLI 默认本地模式，不要求 HTTP；`PTA_BASE` / `--http` 保留远程模式。
- 本地 CLI 夹具 12/12：status、queue、prepare、preview、advance、run、publish 干跑、target-upload 干跑。
- 面板 smoke/responsive 不回退；`run.sh` 全绿。
- 备注：crawl/dupe 的 Fastify 路由还未全部收成 core thin adapter，后续可继续。

## G8 · 原生单 release 上传准备与站点提交

**目标**：SEEDPOD 自己做单个 release 的上传准备和站点提交，不接 UA/upbrr，也不调用它们的 CLI；只借鉴工作流思想，clean-room 实现。

**范围**：

1. 准备：本地文件/队列条目 → ffprobe、可选 MediaInfo/BDInfo、截图、命名、简介。
2. 规则：站点包/私有站点定义提供搜索、分类、上传字段、必填项、警告和资格判断。
3. 查重：目标站搜索、已有原盘/DIY、体积容差、失败处理；结果作为证据，不自动越过人工确认。
4. 预览：提交前生成完整 payload，dry run 可看字段和最终标题/简介/截图。
5. 提交：multipart 上传、匿名/modq、失败重试、提交后回查标题/分类/截图。
6. 注入：拿到 tracker 注册种子后再注入 qB / rTorrent / Deluge / watch；重复操作必须幂等。
7. UI：每个阶段可审查、可回退、可重试，错误说清楚“怎么办”。

**依赖**：

- G7 的阶段状态机先落地。
- G9 的 CLI/core 分层先落地。
- G4 规则分诊决定哪些条件保留。
- G5 提供真实目标站权限和真实 daemon 才能做最终验收；之前用本地 mock 夹具。

**完成（0.7.172）**：

- `prepare` 生成的标题/副标题/简介/目标字段已作为上传计划传给 `target-upload`，不再用原始 item 重新拼。
- `preview` 返回完整 `payload`（标题、副标题、简介、目标字段、截图数、种子摘要）。
- 默认干跑；成功写 `submitted`，`publish` 成功写 `injected`；失败写 `failed` + `lastError` + `nextRetryAt`。
- 本地 CLI 12/12，target-upload 断言校验了 prepared 字段与实际上传字段一致。
- 测试站真实提交/回查已通过；真实 daemon 仍待 G5。

## G10 · 多目标发布框架（当前 active）

**目标**：一条 release 可以选多个目标站，逐站预览、干跑、提交、回查，失败互不拖累。

**范围**：

- 一条 queue/release 的 `targets: []`，每站独立字段、分类、匿名、modq。
- 逐站 dry run 和完整 payload 预览；单站提交/回查复用 G8 的 target-service。
- 任一站失败只标该站失败，不影响其他站；重试按站。
- 面板和 CLI 都能选择多个目标站。

**进展（0.7.174）**：

- `prepare --targets h1,h2` 生成每站独立 payload；`preview` 返回 `targets`。
- `target-upload --targets h1,h2` 逐站干跑；单站失败只标该站，不阻断其他站。
- 单站提交/回查仍复用 target-service；阶段/证据按目标站记录 `targetResults`。
- CLI 夹具：2 个有定义站 + 1 个缺定义站，2 成功/1 失败。
- 回查已改为解析结果行；测试站实际 0 行，不再假阳性（0.7.175）。
- 面板已支持多目标芯片多选，提交按钮走多目标接口（0.7.176）。
- 面板显示按站结果，失败目标站可单独重试（0.7.177）。
- 待做：真实多站提交（需要目标站权限）。

**验收**：

- 一条 release 对 3 个目标站 dry run，payload 各自正确。
- 1 个测试站真实提交/回查成功，其他站失败不阻断。
- 重复提交/重复注入被拦住；阶段/证据落库。

## G11 · 上传准备 1:1

**目标**：补齐 UA/upbrr 级别的单 release 准备能力。

**范围**：元数据、命名、简介、截图、BDInfo、图床、客户端注入；每项有 dry run；clean-room，不复制 UA/upbrr 代码/配置/品牌。

**验收**：一条 release 生成完整标题/副标题/简介/截图/图床链接；客户端注入干跑通过；面板可预览。

## G12 · 全自动流水线

**目标**：抓取 → 查重 → 准备 → 多站提交 → 回查 → 注入，一条命令/一次调度推进。

**依赖**：G10、G11、G13。

**验收**：CLI `run` 全链路；重启可续跑；失败可重试；不重复提交。

## G13 · 站点覆盖与验证

**目标**：从测试站、3 个站、10 个站逐步扩到更多站；每站都有上传定义和真实提交/回查证据。

**范围**：站点包上传字段、权限、分类、失败原因；不追求一次性铺 100 站。

**验收**：3 站全链路通过 → 10 站 dry run 通过 → 目标站真实提交记录。

## G14 · 可选 Python sidecar

**目标**：只在 AI/OCR/pandas/Scrapy 等 Python 明显更合适的离线任务上使用；Node 通过 CLI + JSON 调用，不做第二后端、不共享数据库、不监听端口。

**验收**：一个离线任务（如 OCR/图像分析）跑通；Node 主流程和 `run.sh` 不受影响。

## 推进规则

1. 一次只开一个 active goal；G2、G7、G8、G9 已完成，当前 **G10**；之后 G11、G13、G12。
2. 每个 goal 完成：升版本 → `run.sh` → 部署 → 更新 CHANGELOG/HANDOFF/本文件。
3. 需要用户拍板或环境的 goal 标 blocked，不占用 active 位。
4. 质量审计不得低于基线 83；单文件/单功能出现「差」先修。
