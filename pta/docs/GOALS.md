# 执行目标（GOALS）

本文件是当前阶段的 goal 清单。一个时间只推进一个 active goal；完成一个再开下一个。goal 不是需求池，必须有明确验收和证据。

## 状态总表

| Goal | 内容 | 状态 | 依赖 | 验收命令 / 证据 |
| --- | --- | --- | --- | --- |
| G1 | 响应式自动验收进 `run.sh` | ✅ 完成（0.7.163） | 无 | `responsive-layout.js` 32 项通过 |
| G2 | 可靠性债：公共函数、空 catch、TODO/console | 🔵 下一个 | 无 | `run.sh` 全绿 + 质量审计不回退 |
| G3 | 拆 `Sites.vue` | ⏳ 排队 | G2 完成后 | smoke 21/21、responsive 32 项 |
| G4 | 40 条未接规则分诊 | ⛔ 待用户拍板 | 用户逐条决定 | `audit-rules.js` 0 缺读者 |
| G5 | 真实目标站发布 + 真实 rTorrent/Deluge | ⛔ 待环境/授权 | 用户提供站点权限和 daemon | 真实发布/回查记录 |
| G6 | 站点包例外 UI + Docker/备份复验 | ⏳ 排队 | G2/G3 后 | 例外确认可用、备份恢复演练 |
| G7 | 发布工作流状态机：阶段落库、幂等、恢复 | ⏳ 排队（G2 后） | G2 | 重启可续跑、不重复提交 |
| G8 | 原生单 release 上传准备与站点提交 | ⏳ 排队（G9 后；真实提交依赖 G5） | G7、G9、G4、G5 | mock 全链路 + 一次授权真实发布 |
| G9 | CLI-first 核心层：抓取/查重/发布都可命令行 | 🟡 进行中：prepare/preview/advance/run 已落地，core 抽取待做 | G7 | 不启浏览器跑通全链路 |

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

**明确不做**：不引入 Redis / 消息队列 / 独立 worker / Postgres；不做 UA/upbrr 交接。

**验收**：

- 进程重启后未完成条目能从当前阶段继续，不重复提交。
- 失败阶段可重试，`nextRetryAt` 生效。
- 发布/注入有幂等保护。
- smoke 21/21、responsive 32 项、质量审计不回退。

## G9 · CLI-first 核心层

**目标**：抓取、查重、数据、发布、验证都用 CLI 驱动；面板只是调用同一套核心服务的视图。不再把业务逻辑写死在页面路由里。

**范围**：

- 抽出 `pta/core/`（或同等服务层）：crawl / screen / queue / prepare / publish / target / inject。
- CLI 直接调用 core，不要求先起 HTTP；Fastify 路由改成薄适配层。
- 命令契约见 `pta/docs/CLI.md`：`crawl`、`screen`、`queue`、`prepare`、`preview`、`publish`、`target-upload`、`verify`、`advance`、`run`。
- 默认干跑，`--real` 才真抓/真发；`--json` 给脚本用；失败用非 0 退出码。
- 不打印 cookie/密码/passkey/IP；不复制 UA/upbrr 代码。

**进展（0.7.166）**：`prepare / preview / advance / run` 已接入 CLI 和 HTTP API；queue 增加 `stage`。仅本地准备/预览，提交仍走 `target-upload/publish`。

**验收**：

- 临时数据库上只用 CLI 跑通 crawl → screen → prepare → preview → publish（mock）。
- 不启动浏览器、不点页面。
- 面板复用同一 core，smoke 21/21、responsive 32 项仍通过。
- 重启可续跑，不重复提交。

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

**验收**：

- mock 目标站全链路通过：准备 → 预览 → 提交 → 回查 → 注入。
- 一次用户授权的真实目标站发布成功，且不重复提交。
- 全程 cookie/密码/IP 不进仓库、不进日志、不进回复。
- 不新增 UA/upbrr 代码、配置、品牌或私有站点数据。

## 推进规则

1. 一次只开一个 active goal；当前是 **G2**，下一个 **G7**，再 **G9**，再 **G8**。
2. 每个 goal 完成：升版本 → `run.sh` → 部署 → 更新 CHANGELOG/HANDOFF/本文件。
3. 需要用户拍板或环境的 goal 标 blocked，不占用 active 位。
4. 质量审计不得低于基线 83；单文件/单功能出现「差」先修。
