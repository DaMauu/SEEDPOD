# 流水线扩展（PIPELINE）

自动流程固定五个阶段：

1. crawl（抓取）
2. screen（送审/初筛）
3. review（终审：补齐后检查）
4. publish（发布）
5. crossseed（辅种）

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
