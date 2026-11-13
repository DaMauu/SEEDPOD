# 问题清单（2026-11-14，基于 0.7.81）

按优先级排，P0 是“会做错/会出事”，P1 是“功能没落地”，P2 是“工程收尾”。
每条都写位置和验收，避免再出现“页面有、后台没有”。

## 已修（0.7.73 之后，不用再列）

- v2 `screen` 接上分辨率/体积/中字/排除白名单/同片去重
- v2 补 `nosniff / X-Frame-Options / Referrer-Policy / CSP`
- unit 改 `User=seedpod` + `/etc/seedpod.env` 0600
- 部署权限、`deploy.sh` sudo 重启
- 线上切 Vite 构建，日志页拆进 SFC
- 站点详情重复 id
- package.json 声明 fastify/@fastify/static，start 指 v2
- 新增 api-v2（15 条）、build（7 路由）、audit-rules

## P0 · 正确性与安全

| # | 问题 | 位置 | 影响 | 修法 |
| --- | --- | --- | --- | --- |
| 1 | 禁转/限转不参与筛选 | `crawl.js:126` 写 `marks:{}`；`routes-misc.js` screen 不读 marks | 标了禁转的种子照样送审/发布，合规风险 | 抓取时按标题/标签写 marks；screen 先拦禁转/限转未满 7 天 |
| 2 | 分类不轮转 | `crawl.js:79-83,185` | `catIdx` 原样回存、page 一直加，等于顺一个分类往深翻 | 一页到底后 `catIdx=(catIdx+1)%catMap.length`，page 归零 |
| 3 | 每日上限退化成每小时 | `routes-write.js:146-166` | `maxPerWindow` 可到 1000、`windowMinutes` 可到 1，默认一天 480 次 | 服务端按站规再压一层，界面只能调低不能调高 |
| 4 | 发布只记账 | `routes-publish.js:54-84`；`qb.js` 只有探测/登录/分类 | real 模式只改状态写 published，没有 `add torrent` | 接 qB `torrents/add`，dryRun 只演练 |
| 5 | 30+ 空开关 | `data.js`；`audit-rules.js` 首跑 59/67 零命中 | 页面像能配，后台不读，用户白配 | 逐条分诊：保留/实现/删除/标未接并禁用 |
| 6 | 登录无限速/锁定 | `app-fastify.js:62-77` | 可暴力试密码 | 失败计数 + 锁定，登录限速 |
| 7 | 会话在内存、cookie 无 Secure | `app-fastify.js:20,77` | 重启全员掉线；明文 HTTP 可被截 | 会话落库；HTTPS 下加 Secure |
| 8 | 密钥与数据同目录 | `data/.secret`、`secretbox.js:24-36` | 拿到数据目录就等于拿到密钥 | 密钥移到环境变量或独立目录 |
| 9 | 总览统计写死 0 | `app-fastify.js` overview | 今日抓取、登录成败永远 0 | 从 logs/tasks 聚合真实值 |

## P1 · 功能落地

| # | 问题 | 位置 | 影响 | 修法 |
| --- | --- | --- | --- | --- |
| 10 | 没有调度器 | v2 只有任务动画和 SSE 心跳 | 抓取/送审/发布全靠人点 | 加定时器 + 暂停开关 + 失败记录 |
| 11 | 六个页面仍在 legacy | `MIGRATION-PLAN.md` | 改页面还在 5000 行文件里 | 按计划逐页拆 SFC |
| 12 | Docker 还是旧后端 | `Dockerfile:29` `CMD server/app.js`，无 `npm ci/build` | 镜像起的是 v1，且缺依赖 | 两阶段构建，CMD `app-fastify.js` |
| 13 | 多目标站/图床/截图来源/发布后校验未接 | `data.js` 文案已写“还没接” | 用户以为能用 | 先禁用或标未接，别当可用项 |
| 14 | 发布条件 30 条服务端不读 | 同 #5 | 页面 90% 是装饰 | 收敛到能兑现的少数几条 |

## P2 · 工程与收尾

| # | 问题 | 位置 | 影响 | 修法 |
| --- | --- | --- | --- | --- |
| 15 | smoke 仍 18/23、audit 未跑 | `pte/checks/smoke.js`、`audit.js` | 覆盖不到新构建 | 重写或迁到 dist 后重跑 |
| 16 | 规则体检只报告不拦 | `run.sh` 末尾 | 空开关可以继续进 | 分诊完成后加 `--fail` |
| 17 | 旧 `pta/web` 未归档 | `pta/web` | 容易改错目录 | 收尾移到 `archive/` |
| 18 | 面板密码未轮换 | git 历史、`/etc/seedpod.env` | 旧值已进历史 | 生成新值、通知作者、作废旧值 |
| 19 | `ocbot` sudo 全开 | `/etc/sudoers.d` | 等于 root | 收窄到 systemctl/必要命令 |
| 20 | 文档仍写“零依赖/假数据” | `ARCHITECTURE.md`、`PRIOR-ART.md`、`app-fastify.js` 头 | 误导下一个接手者 | 一次文档对齐 |

## 建议顺序

1. **M1**：#1 禁转、#2 分类轮转、#3 上限、#5 规则分诊
2. **M2**：#4 真发布、#10 调度
3. **M3**：#6–#9 安全、#12 Docker
4. **M4**：#11 SFC 收尾、#15–#20 工程收尾

需要作者拍板的只有三件：空开关保留哪些、真发布默认开还是关、调度频率。
