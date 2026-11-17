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

## 抓取限制芯片

- 抓取卡「限制」行的禁转 / 限转 / HR / 独占 / DIY 都是**选中即排除**，在入库前过滤。
- 标记来源：标题文字、列表行徽章（`title`/`alt`/`class` 如 `hitandrun`）、以及本次已抓详情页的 Tags。
- `HR` 只认独立标记（`[HR]`、`H&R`、`hit and run`、`hitandrun`），不把 `HR-HDTV` 这种小组名当成 H&R。
- 站点只在详情页深处标注、而本轮又没抓到详情时，列表阶段看不到这个标记；要提高覆盖就打开详情抓取。

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
