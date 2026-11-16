# 流水线扩展

把新功能的钩子放这个目录（`*.js`），服务启动时自动加载并注册；调度每轮按阶段执行。

```js
const pipeline = require('../pipeline');

pipeline.on('publish', '发布后通知', async (ctx, state) => {
  // state.steps 是本轮各阶段结果
  return { ok: true };
});
```

阶段顺序：crawl → screen → review → publish → crossseed。
钩子抛错只记录在 `steps.hooksXxx`，不影响整轮。
