# 目标架构（终稿）

这份文件回答四个问题：跑在哪、用什么栈、代码放哪、按什么顺序搬。
和 `pta/docs/DECISIONS.md` 的 D8–D17、`pta/docs/MIGRATION-PLAN.md` 一起看。

## 运行时

- Node.js 22+，单进程；Fastify 5 + `node:sqlite`，数据在 `data/seedpod.db`
- 前端 Vue 3 + Vite，构建产物 `pta/web/dist`，由 Fastify 静态服务
- 部署：Docker 多阶段（构建阶段 `npm ci && npm run build`，运行阶段只带 dist、server、生产依赖），数据卷挂 `/data`
- 单机、单用户量级；不引 Redis、消息队列、K8s

## 目录

```
pta/
  server/           v2 后端：app-fastify.js + routes-*.js + db.js + crawl.js
  web-src/          前端源码：Vite + Vue 3 SFC
    src/views/      七个页面
    src/components/ 共享组件
    src/data/       规则数据（rules.js）
  web/dist/         构建产物（gitignore，部署时生成）
  checks/           adapter / security / api-v2 / build / smoke-live / site-pack / form
  docs/             计划、规范、决策
```

`pta/web` 只放 Vite 构建产物 `dist`；源码在 `pta/web-src`，旧 demo 已删除。

## 搬迁顺序

1. 前端页面逻辑：已完成逐页搬进 SFC；共享壳在 `App.vue`，`src/legacy` 已删除
2. 规则兑现：把 `pta/web-src/src/data/rules.js` 里服务端没读的开关逐条处理——实现 / 删除 / 移到「高级」并标未接
3. 抓取正确性：分类轮转、每日上限、禁转/限转参与筛选
4. 发布链路：qB `add torrent` 真发布，dryRun 只作演练
5. 调度：定时抓取/送审/发布，带开关与暂停
6. 安全：登录限速、失败锁定、会话落库、cookie Secure、密钥与数据分离
7. Docker 多阶段与一键部署

## 不做什么

- 不换框架、不换数据库、不引前端 UI 库
- 不在 demo 上继续加功能
- 不为“看起来完整”加空开关；加一条必须先回答谁读、何时读、不设会怎样

## 当前阶段

- 已完成：v2 后端、Vite 构建上线、日志页拆分、安全头、unit 降权
- 进行中：其余六页 SFC、死开关清理
- 未开始：抓取顺序、真发布、调度、Docker
