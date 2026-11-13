---
description: 按计划把 legacy 页面逻辑拆进 Vue SFC
---
按 `pta/docs/MIGRATION-PLAN.md` 继续前端逻辑搬迁，一次只拆一页。

- 完成定义、每页验收清单、停止条件、自主边界，全部以该文件为准。
- 每页流程：读 legacy 的 `initXxx()` → 在对应 SFC 里重写 → 从 `boot()` 移除调用 → `npm run build` → `node pta/checks/build.js` → 线上点该页 → 提交 → `bash deploy.sh` → 勾选计划。
- 命中任何停止条件就写进 `TASKS.md` 并停下，不猜、不改接口。
- 只改 `pta/web-src` 与文档/版本文件；不碰 `pta/web`、`pta/server`、`data/`、真实站点。
- 一页一提交，版本号递增，提交信息用中文。
