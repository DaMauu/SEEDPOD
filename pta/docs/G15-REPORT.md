# G15 最终报告 · 架构减重与失败路径

- 版本：0.7.436
- 轮次：38 轮（0–37），50 轮上限内完成
- 范围：A1–A5 五个大文件拆分 + B0–B7 失败路径/规则/配置

## 1. 五个大文件行数

| 文件 | 拆前 | 拆后 | 目标 | 结果 |
| --- | --- | --- | --- | --- |
| `pta/web-src/src/views/Crawl.vue` | 1128 | **173** | ≤500 | 达标 |
| `pta/server/target.js` | 977 | **371** | ≤450 | 达标 |
| `pta/server/target-service.js` | 590 | **302** | ≤400 | 达标 |
| `pta/server/imagehost.js` | 612 | **382** | ≤400 | 达标 |
| `pta/server/scheduler.js` | 496（B1 后 559） | **162** | ≤350 | 达标（阶段全部模块化） |

新增模块（共约 1350 行）：

- UI：`components/FlowGates.vue`、`SchedulerBar.vue`、`TargetPickerModal.vue`、`CrawlCard.vue`、`ScreenDedupeCard.vue`、`PublishCard.vue`、`SiteMapModal.vue`、`views/Crawl.css`、`utils/api.js`
- target：`target-html.js`、`target-discovery.js`、`target-plan.js`、`target-submit.js`
- target-service：`target-upload.js`、`target-rules.js`
- imagehost：`imagehost-source.js`、`imagehost-config.js`
- scheduler：`scheduler-crawl.js`、`scheduler-screen.js`、`scheduler-dedupe.js`、`scheduler-review.js`、`scheduler-publish.js`、`scheduler-retry.js`、`scheduler-state.js`
- UI 状态：`composables/useCrawlPlan.js`、`useCrawlScheduler.js`（调度/限制/闸门）、`useCrawlFlow.js`（流程规则/保存）、`useCrawlSites.js`（站点选择）、`useCrawlFetchFilters.js`（类型/筛选/准备）、`useRuleOrSpecial.js`（规则渲染）
- 规则/配置：`rule-registry.js`、`config-schema.js`

旧导出和 require 路径保持不变；每轮全量检查通过后才提交。

## 2. UI 切片证据

每拆一块都跑 `node pta/scripts/ui-snapshot.js`：

- 固定临时 DB/时间/数据，1280x900 与 390x844
- 整页 + `.crawl-card` / `.screen-card` / `.pub-card` / 下载器卡 / 目标站弹窗
- 通过标准：RMSE ≤0.002 + DOM 文本/按钮/输入/开关/尺寸完全一致
- 通过后才 `ui-freeze.js --update`

依次通过的切片：FlowGates、SchedulerBar、TargetPickerModal、CrawlCard、ScreenDedupeCard、PublishCard、页面样式外置、SiteMapModal。最终 UI 冻结基线对应 0.7.411。

## 3. 失败路径（B1–B5）

- **B1 阶段隔离**：crawl/screen/dedupe/review/publish/crossseed/retry 各自 try/catch；失败写 `steps.errors`（phase/code/message），接口回 `partial=true`，后续阶段继续；DB/SQLITE 类错误中止本轮。`SEEDPOD_FAIL_STEP` 仅 `NODE_ENV=test` 读取。
- **B2 错误码**：`errors.js` 注册表（code/stage/level/retryable + 旧码映射）；`GET /api/errors`、`error-stats` CLI 按 code/stage 统计。
- **B3 失败队列**：`GET /api/failures`（分页/死信）、`POST /api/failures/:id/replay`；字段含 id/stage/code/message/attempts/nextRetryAt/lastAttemptAt/host；重放恢复 pending、保留 targetResults，已 submitted/injected 或已有权威种子拒绝重放。查重/补齐失败也写 attempts/nextRetryAt。
- **B4 事务**：`tx(db, fn)`；screen 的 queue+catalog、publish 的 queue+published+catalog 收口；事务内不做网络请求。
- **B5 故障注入**：429、500、断连、半成功响应、超时全部本地 mock；验证错误码、nextRetryAt、死信和重放。

## 4. 规则与配置（B6–B7）

- **B6**：`rule-registry.js` 登记 18 条规则的 key/类型/默认值/读者；`flow-config` 读取统一 normalize；旧 key 走 `ALIASES`；检查覆盖「服务端调用的 key 都在注册表」「与 UI rules.js 对齐」「旧配置可读」。
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

## 7. 未完成 / 后续

1. `Crawl.vue` 只剩 `ensure`、`patchUser/putFlow`、`specialOf/toggleFetchChip/clampLimit/testRx` 等小工具和装配代码（173 行）；计划、调度/限制/闸门、流程规则、站点、类型/筛选/准备、规则渲染均已抽 composable。
2. 失败队列只有 API/CLI，没有日志页/队列页面板；容量是「按 updated_at 取最近 1000 条」的视图级限制，不做破坏性清理。
3. B6 的 UI `rules.js` 仍是 UI 侧定义源，靠检查对齐，尚未由注册表生成。
4. 历史提交 0.7.419 合并了第 21–23 轮；从第 27 轮起已恢复一轮一提交。
