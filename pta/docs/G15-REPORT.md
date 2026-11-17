# G15 最终报告 · 架构减重与失败路径

- 版本：0.7.451
- 轮次：49 轮（0–48），50 轮上限内完成
- 范围：A1–A5 五个大文件拆分 + B0–B7 失败路径/规则/配置

## 1. 五个大文件行数

| 文件 | 拆前 | 拆后 | 目标 | 结果 |
| --- | --- | --- | --- | --- |
| `pta/web-src/src/views/Crawl.vue` | 1128 | **135** | ≤500 | 达标 |
| `pta/server/target.js` | 977 | **174** | ≤450 | 达标（页面/删除/元数据再拆出） |
| `pta/server/target-service.js` | 590 | **212** | ≤400 | 达标（公共段再拆出） |
| `pta/server/imagehost.js` | 612 | **135** | ≤400 | 达标（上传引擎再拆出） |
| `pta/server/scheduler.js` | 496（B1 后 559） | **162** | ≤350 | 达标（阶段全部模块化） |

新增模块（共约 1350 行）：

- UI：`components/FlowGates.vue`、`SchedulerBar.vue`、`TargetPickerModal.vue`、`CrawlCard.vue`、`ScreenDedupeCard.vue`、`PublishCard.vue`、`SiteMapModal.vue`、`views/Crawl.css`、`utils/api.js`
- target：`target-html.js`、`target-discovery.js`、`target-plan.js`、`target-submit.js`、`target-pages.js`（删除/详情/上传页探测/种子元数据）
- target-service：`target-upload.js`、`target-service-common.js`、`target-rules.js`
- imagehost：`imagehost-source.js`、`imagehost-config.js`、`imagehost-upload.js`（Chevereto 登录/网页上传/通用上传/process）
- scheduler：`scheduler-crawl.js`、`scheduler-screen.js`、`scheduler-dedupe.js`、`scheduler-review.js`、`scheduler-publish.js`、`scheduler-retry.js`、`scheduler-state.js`
- UI 状态：`composables/useCrawlPlan.js`、`useCrawlScheduler.js`（调度/限制/闸门）、`useCrawlFlow.js`（流程规则/保存）、`useCrawlSites.js`（站点选择）、`useCrawlFetchFilters.js`（类型/筛选/准备）、`useRuleOrSpecial.js`（规则渲染）
- 规则/配置：`rule-registry.js`、`config-schema.js`

旧导出和 require 路径保持不变；每轮全量检查通过后才提交。

## 2. UI 切片证据

每拆一块都跑 `node pta/scripts/ui-snapshot.js`：

- 固定临时 DB/时间/数据，1280x900 与 390x844
- 整页 + `.crawl-card` / `.screen-card` / `.pub-card` / 下载器卡 / 目标站弹窗
- 通过标准：RMSE ≤0.002 + `compare -metric AE -fuzz 2%`（组件 0、整页 ≤100）+ DOM 文本/按钮/输入/开关/尺寸完全一致
- 通过后才 `ui-freeze.js --update`

依次通过的切片：FlowGates、SchedulerBar、TargetPickerModal、CrawlCard、ScreenDedupeCard、PublishCard、页面样式外置、SiteMapModal。最终 UI 冻结基线对应 0.7.411。

## 3. 失败路径（B1–B5）

- **B1 阶段隔离**：crawl/screen/dedupe/review/publish/crossseed/retry 各自 try/catch；失败写 `steps.errors`（phase/code/message），接口回 `partial=true`，后续阶段继续；DB/SQLITE 类错误中止本轮。`SEEDPOD_FAIL_STEP` 仅 `NODE_ENV=test` 读取。
- **B2 错误码**：`errors.js` 注册表（code/stage/level/retryable + 旧码映射）；`GET /api/errors`、`error-stats` CLI 按 code/stage 统计。
- **B3 失败队列**：`GET /api/failures`（分页/死信）、`POST /api/failures/:id/replay`；字段含 id/stage/code/message/attempts/nextRetryAt/lastAttemptAt/host；重放恢复 pending、保留 targetResults，已 submitted/injected 或已有权威种子拒绝重放。查重/补齐失败也写 attempts/nextRetryAt。
- **B4 事务**：`tx(db, fn)`；screen 的 queue+catalog、publish 的 queue+published+catalog 收口；事务内不做网络请求。
- **B5 故障注入**：429、500、断连、半成功响应、超时全部本地 mock；验证错误码、nextRetryAt、死信和重放。

## 4. 规则与配置（B6–B7）

- **B6**：`pta/web-src/shared/rule-registry.json` 是唯一规则源（18 条 key/类型/默认值/读者 + 旧 key 映射）；服务端 `rule-registry.js` 与 UI `rules.js` 都读它，UI 只保留标签/选项；检查覆盖共享源、key/类型/默认值一致性、旧配置可读。
- **B7**：`config-schema.js` 带 `schemaVersion`、v0→v1 迁移、启动自动升级、写回前迁移；布尔/大小写归一，未知字段保留，未来版本不降级。改动前跑备份恢复演练（4/4，`integrity ok`）。

## 5. 最终回归

`bash pta/checks/run.sh`：ALL CHECKS PASSED。关键段：

- smoke 26/26、responsive 32 项、adapter 26/26、api 34/34
- target 29/29、publish 9/9、scheduler 6/6、failpoint 1/1
- failures 3/3、fault-injection 6/6、transactions 2/2
- imagehost 20/20、backup 4/4
- rules-registry 5/5、config-migration 5/5
- 质量审计：总体 **94 / 优质**（要求 ≥87）
- 规则体检：35 条全部有读者

## 6. 补完（第 27–32 轮）

- A5：crawl/screen/dedupe/review 全部抽成阶段模块；`runNow` 只保留编排、failpoint、阶段 catch 和结果汇总；scheduler.js 350→162 行。
- A1：新增 `composables/useCrawlPlan.js`，抓取计划状态与请求离开页面；Crawl.vue 497→474 行，快照一致。
- B7：`meta.flow` / `meta.scheduler` 加 schemaVersion 与启动升级；`PUT /api/flow` 写回带版本；config-migration 7/7。

## 7. 失败队列保留、页面板与 AE 闸门

- 保留策略：默认最近 30 天、最多 1000 条；`/api/failures?days=&maxItems=`、CLI `--days/--max`；有未来重试的条目保留；只过滤视图，不删队列数据。
- 日志页面板：失败队列只读列表（id/阶段/错误码/重试次数/nextRetryAt/死信）+ 单条重放，不动流程页。
- AE 闸门：组件截图先去掉 4px 边框，`AE=0`（fuzz 2%）；整页 `AE≤100`；同进程双构建实验确认裸 AE 不可达；用户已确认接受该闸门（附 RMSE + DOM），原始 AE=0 不作为验收条件。

## 8. 后续可选

1. `Crawl.vue` 只剩 `specialOf/toggleFetchChip/testRx` 等纯 UI 工具和装配代码（135 行）；调度条数字输入已在输入时即时夹取（`SchedulerBar.vue`）。

## 9. 已接受的例外（2026-11-19 用户确认）

- 0.7.419 合并了第 21–23 轮、0.7.445 合并了 B6 与工具修复，违反「一轮一提交」。
- 两条均已推送；不改写历史、不 force push，作为**已接受的流程例外**收尾，不再列为未闭合项。
- 功能、接口、错误码、规则 key 和检查结果不受影响。
