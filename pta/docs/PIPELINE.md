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
- **平滑限速**（没有日额度，也不允许窗口内突发）：
  - 每站：1 次/分钟（±20% 抖动），每小时最多 30 次
  - 全局：1 次/20 秒，每小时最多 60 次，多目标共用
  - 一次搜索算 1 次，命中后读详情再算 1 次
- 触发上限：查重阶段停，`dedupe.rateLimited=true` 并给 `retryAfterMs`；
  终审把没查过的条目记为「查重未完成」，发布前复核也会拒绝。
- 目标站上传、回查、权威种等所有请求：15 秒间隔（±20% 抖动），每站 200 次/天兜底。
- 环境变量：`PTA_DEDUPE_SITE_GAP_MS`、`PTA_DEDUPE_GLOBAL_GAP_MS`、
  `PTA_DEDUPE_SITE_HOUR_MAX`、`PTA_DEDUPE_GLOBAL_HOUR_MAX`、`PTA_DEDUPE_JITTER`、
  `PTA_TARGET_GAP_MS`、`PTA_TARGET_DAILY_MAX`。
- 已查过且可发的条目按 `dupeResults` 缓存，下一轮不重复请求。

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
