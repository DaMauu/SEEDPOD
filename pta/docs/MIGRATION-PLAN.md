# 前端逻辑搬迁计划（legacy → SFC）

目标：把 `pta/web-src/src/legacy/app.js` 里的页面逻辑逐步搬进对应 SFC，直到 `legacy` 只剩路由、登录、共享工具。
线上始终服务 `pta/web/dist`，每页拆完都能单独上线。

## 顺序与验收

| 顺序 | 页面 | 文件 | 验收 |
| --- | --- | --- | --- |
| 1 | 日志 ✅ | `views/Logs.vue` | 已拆：拉取、SSE、筛选、下载、清屏 |
| 2 | 总览 | `views/Dashboard.vue` | 统计、最近发布、待审核、实时日志，接口 `/api/stats/overview` |
| 3 | 设置 | `views/Settings.vue` | 版本模式、面板账号只读、系统信息，接口 `/api/config`、`/api/dev` |
| 4 | 待审核 | `views/Queue.vue` | 列表、详情、草稿/通过/驳回、截图，接口 `/api/queue*` |
| 5 | 数据清单 | `views/Sources.vue` | 列表、筛选、归档、导出、分页，接口 `/api/catalog*` |
| 6 | 站点 | `views/Sites.vue` | 列表、筛选、抽屉、批量设置、自检，接口 `/api/sites*` |
| 7 | 流程 | `views/Crawl.vue` | 规则卡、请求限制、演练、下载器，接口 `/api/flow`、`/api/crawl*`、`/api/downloaders*` |

## 每页步骤

1. 读 legacy 里对应的 `initXxx()` 与 `renderXxx()`，列出用到的接口与 DOM 契约
2. 在 SFC 里用 `ref/reactive/onMounted` 重写，模板换成 `v-if/v-for`
3. 从 `boot()` 里删掉这页的 init 调用；共享工具暂留 legacy
4. `npm run build` → `node pta/checks/build.js` → 手动点该页
5. 提交：`0.7.xx 拆 <页面> 到 SFC`
6. `bash deploy.sh`，线上探活

## 守卫

- 接口路径与字段不变；需要改先写 `docs/API.md`
- 不引 Pinia、UI 库、CSS 框架
- 样式沿用 `web-src/public/assets/app.css`，新样式 scoped
- 每页拆完，`legacy/app.js` 行数必须下降；不新增 legacy 逻辑
- 遇到不确定的交互，停，写 TASKS，不猜
