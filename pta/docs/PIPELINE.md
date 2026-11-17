# 流水线扩展（PIPELINE）

自动流程固定六个阶段：

1. crawl（抓取）
2. screen（本地初筛）
3. dedupe（目标站查重：命中就跳过，避免补齐请求）
4. review（补齐 + 终审检查）
5. publish（发布：源种先进 qB 下到 100%，再传目标站，最后注入）
6. crossseed（辅种：抓目标站权威种子，skip_checking 加进 qB）

转载完整链路：抓取 → 初筛 → 查重 → 补齐/终审 → **源种下完** → 传目标站 → 辅目标权威种 → 通知。

## 目标站请求节流

- 同一目标站的所有请求（查重、详情、上传、回查、权威种、删除）共用 7 秒间隔。
- 查重每轮最多 10 条；每条每站 1 次搜索，命中才多 1 次详情。
- **单队列串行**：所有目标站请求共用一个队列，一次只发一个。
  - 搜索/详情：30 秒一个（参考 cross-seed 的 `delay` 默认值，最小 30 秒）
  - 上传/回查/权威种/删除：10 秒一个
  - 都带 ±20% 抖动；单目标、多目标一样串行，站多只会排队更久
  - 查重每条每站 1 次搜索，命中才多 1 次详情；都按搜索间隔排队
- 不设请求次数上限；`dedupe.requests` 显示本轮实际查重请求数。
- 终审仍会卡「查重未完成」：没排到查重的条目不会先发布。
- 环境变量：`SEARCH_WAIT_SEC`（默认 30 秒）、`UPLOAD_WAIT_SEC`（默认 10 秒）、
  `WAIT_RANDOM_PERCENT`（默认 20）。旧的 `PTA_REQ_*` 仍兼容。
- 参考项目：cross-seed（30 秒搜索间隔、400 次/天、摊开积压）、Scrapy AutoThrottle（按延迟自适应）、
  Prowlarr/autobrr qui（429 冷却）。
- 已查过且可发的条目按 `dupeResults` 缓存，下一轮不重复请求。

## 故障注入

- `pta/checks/fault-injection.js`：本地 mock 覆盖图床上传 429/500/断连/半成功/超时；失败队列死信、nextRetry、重放。
- `SEEDPOD_FAIL_STEP` 只在 `NODE_ENV=test` 生效，用来验证单阶段失败后后续阶段继续。
- 不碰真实站；故障用例全部本地。

## 多步写库事务

- `pta/server/db.js` 的 `tx(db, fn)` 是同步事务封装：`BEGIN IMMEDIATE` → 回调 → `COMMIT`；抛错 `ROLLBACK`。
- 事务只包数据库写，不在事务里 await HTTP、文件下载、图床上传；网络操作先完成再开事务。
- 已接：`screen`（queue 插入 + catalog 标 selected）、`publish`（queue + published + catalog 标 published）。
- 事务失败整体回滚，不留下“队列有、词条没改”的半状态。

## 失败队列保留策略

- 视图级保留，不删队列数据：默认最近 30 天、最多 1000 条。
- API：`GET /api/failures?days=30&maxItems=1000`；`days=0` 看全部，命令行 `--days` / `--max`。
- 有未来重试时间（`nextRetryAt`）的条目即使更旧也保留；没有时间戳的旧数据不隐藏。
- 重放成功后按条件重新计算，自动移出死信；队列原始行保留。

## 失败队列

- `GET /api/failures?limit=50&offset=0&dead=1`：列出阶段失败、目标站失败、待重试；`dead=1` 只看死信。
- `POST /api/failures/:id/replay`：把条目恢复 pending，清 nextRetry/error，保留 targetResults；已 submitted/injected 或已有权威种子的返回 `ALREADY_SUBMITTED`。
- CLI：`node pta/scripts/failures.js [--dead] [--replay q_0001]`。
- 死信判定：重试次数 >= `retryMax`，或最后失败超过 24 小时且没有下次重试。
- 查重/补齐失败会写 `dedupeAttempts/NextRetryAt/LastError`、`metaAttempts/NextRetryAt/LastError`。

## 错误码与失败统计

- `pta/server/errors.js` 是错误码注册表：code、stage、level、中文说明、retryable；旧码走 `LEGACY` 映射。
- `GET /api/errors?limit=N` 返回失败总数、按 code/阶段统计和最近条目。
- CLI：`node pta/scripts/error-stats.js --limit 200`，直接读 SQLite，不启 HTTP。
- 统计来源：scheduler `lastResult.errors`、queue 的 `stageLastError`、`targetResults` 的失败/待重试项。

## 调度失败隔离

- `scheduler.runNow` 的 crawl/screen/dedupe/review/publish/crossseed/retry 各自 try/catch。
- 单阶段异常写 `steps.errors`（phase/code/message），`steps` 对应阶段带 `error/errorCode`。
- 后续阶段继续跑；接口返回 `partial=true`，通知带首个 phase/code。
- DB/SQLITE/约束类错误视为不可恢复，记录后中止本轮。
- `SEEDPOD_FAIL_STEP` 只在 `NODE_ENV=test` 读取；生产不启用 failpoint。

## 抓取限制芯片

- 抓取卡「限制」行的禁转 / 限转 / HR / 独占 / DIY 都是**选中即排除**，在入库前过滤。
- 标记来源：标题文字、列表/详情页 tag 徽章的可见文字、图标 `title`/`alt`/`class`（如 `hitandrun`）。
- **URL 参数名不当标记**：有的 NexusPHP 站把 `tag_exclusive=yes` 显示成“禁转”，字段名里的 exclusive 不能算“独占”；只认页面上看到的字。
- 详情页只看种子自己的 `details-tag` / `torrents-tag` 和 h1 里的 `[禁转]` 这类括号标记，全站筛选表单的标签不算。
- `HR` 只认独立标记（`[HR]`、`H&R`、`hit and run`、`hitandrun`），不把 `HR-HDTV` 这种小组名当成 H&R。
- 整页都带 HR 图标不等于全站 HR：有的站第一页全是官方种，官方种全带 HR；翻到下一页的三方转载种可能没有。始终按行判断，别按页面比例推断站点政策。
- 站点只在详情页深处标注、而本轮又没抓到详情时，列表阶段看不到这个标记；要提高覆盖就打开详情抓取。
- 批量核对保存下来的种子页：

```bash
node pta/scripts/audit-sitecat.js --dir /path/to/sitecat/done
```

默认只输出汇总（文件数、可解析页、带限制标签的行数、各类型计数），不打印站名/网址。

## 豆影取数据

- 自动流程在 `pta/server/meta-fill.js`：从条目标题/简介/详情链接里找 `tt123` 或豆瓣 `subject/123`，没有 ID 才用片名+年份。
- 请求的是豆影网页自己用的无 Key 接口：`POST https://doubaninfo.com/api.php`，表单 `url=<ID或片名>`；精确 ID 常直接回 BBCode，片名搜索可能回候选 JSON。
- 简介用返回的 BBCode 原文覆盖“电影简介段”，保留源简介里的 hide/技术 quote 和截图；副标题用拆出的导演/主演拼贴。
- 手动核对不进 UI：

```bash
node pta/scripts/fetch-douying.js tt7736104
node pta/scripts/fetch-douying.js --title "鬼网" --year 2017
node pta/scripts/fetch-douying.js tt7736104 --raw
```

- 保存下来的 DoubanInfo 网页只是空壳，搜索结果由页面脚本请求 `api.php` 后动态渲染，HTML 里看不到结果；要自动化只能请求这个接口。

## 简介图片转存

- 解析 `[img]` 和 `[img=300x300]`，保留尺寸属性。
- 图片页（ibb/imgur/imgbox/postimages/pixhost/sm.ms 等）自动解析 `og:image` 拿原图直链。
- 缩略图（imgbox/imgur/pixhost 等）优先从 `[url=图床页面]` 或缩略图规则还原原图，不转缩略图。
- 猫站图床黑名单（imgur/imgbb/smms/路过/流浪/Audiences/picgd/Z4A/Ubits/Gifyu）最终简介里不保留；能下载就转存猫站图床，失败则删图。
- `[url=图床页面][img]…[/img][/url]` 的链接和图片一起替换成新图床地址。

## 新功能怎么进自动流程

不用你记细节，只要一句话：**「这个功能要进自动流程，放在 X 之后」**。剩下由代码处理。

两种落法：

- **挂在已有阶段**：功能属于某一阶段（如发布后通知 → publish 之后）
- **新增独立阶段**：功能自己成一步（需要在 `pta/server/pipeline.js` 的 PHASES 里加名字）

## 代码约定

- 钩子文件放 `pta/server/steps/*.js`，服务启动自动加载
- 例：

```js
const pipeline = require('../pipeline');

pipeline.on('publish', '发布后通知', async (ctx, state) => {
  // state.steps 里有本轮各阶段结果
  return { ok: true };
});
```

- 钩子失败只记录到 `steps.hooksXxx`，不拖垮整轮
- 阶段顺序、回调参数不要改；改契约要先写进本文件

## 命名

- 阶段名只用英文小写：crawl/screen/review/publish/crossseed
- 钩子名用中文短语，和流程页文案一致
