---
description: 按计划把 legacy 页面逻辑拆进 Vue SFC
---
按 `pta/docs/MIGRATION-PLAN.md` 继续前端逻辑搬迁：一次只拆一页，从计划里第一个未完成项开始。

规则：
- 只改 `pta/web-src`，不碰旧 `pta/web`
- 每页拆完跑 `npm run build`、`node pta/checks/build.js`；全绿才提交
- 不改后端接口、不改 data.js 规则字段
- 遇到需要产品决策或会改变交互的问题，停下写进 `TASKS.md` 并说明
- 提交信息用中文，版本号递增，CHANGELOG 记一条
