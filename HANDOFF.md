# HANDOFF · SEEDPOD 面板

最后更新：2026-11-10

## 现在是什么状态

前端 7 个页面 + 登录页，全部交互可点（142 个交互点无死按钮）。
后端是本机 Node 零依赖服务，已实现：会话登录、配置读写、站点清单、事件日志、SSE、静态托管。

线上：源码直跑在测试机 `/opt/seedpod`，systemd 服务 `seedpod`，nginx 反代 + Cloudflare，入口是 pta 开头的那个域名。
开机自启已配；改完代码 `systemctl restart seedpod` 生效。

测试机上 `/opt/seedpod` **不是 git 仓库**，发版是复制文件（发前先备份到 `/opt/seedpod/backup-时间戳/`）：

```
scp server/app.js            pta:/opt/seedpod/server/app.js
scp pta/web/index.html       pta:/opt/seedpod/pta/web/index.html
scp pta/web/assets/app.js    pta:/opt/seedpod/pta/web/assets/app.js
scp pta/web/assets/app.css   pta:/opt/seedpod/pta/web/assets/app.css
ssh pta 'systemctl restart seedpod && systemctl is-active seedpod'
```

不要覆盖 `pta/web/assets/sites-data.local.js`、`pta/data/site-arch.local.csv`、`data/` 下任何文件。
Cloudflare 会缓存不带版本号的 js，换版本一定同步改 `index.html` 里的 `?v=`。

## 后端接口（已实现）

| 接口 | 说明 |
| --- | --- |
| GET /api/health | 探活，不需要登录 |
| POST /api/login | 账号密码换 HttpOnly 会话 cookie（12h） |
| GET /api/session | 当前是否已登录 |
| POST /api/logout | 注销 |
| GET /api/config | 系统硬底线 + 用户配置 + 双模式区间 |
| PATCH /api/config/user | 改速率，越界 400 |
| GET /api/sites | 305 个站点（host/url/arch）与架构统计 |
| GET /api/site-config | 服务端保存的站点配置（白名单字段） |
| PUT /api/site-config/:host | 合并写站点配置，密码/cookie/totp 拒收 |
| DELETE /api/site-config/:host | 删掉站点配置并恢复默认 |
| GET /api/site-search | 所有站点预设的汇总（列表页标已确认/未确认用） |
| GET /api/sites/:host/search | 该站的搜索预设（引擎/路径/参数名/分类 id） |
| PUT /api/sites/:host/search | 合并写搜索预设，字段有校验 |
| DELETE /api/sites/:host/search | 删搜索预设 |
| GET /api/downloaders | 已配置的下载器（密码只回 hasPass） |
| POST /api/downloaders | 新增下载器，地址必须是 http/https |
| PUT /api/downloaders/:id | 按字段改下载器 |
| DELETE /api/downloaders/:id | 删除下载器 |
| POST /api/downloaders/:id/test | 只连它自己填的地址做一次连通性探测 |
| GET /api/queue | 待审核条目与各状态计数 |
| POST /api/queue | 新增待审核条目（title 必填） |
| GET /api/queue/:id | 单条详情 |
| POST /api/queue/:id/action | approve / reject / publish，带状态机校验 |
| DELETE /api/queue/:id | 删除条目 |
| POST /api/tasks | 提交干跑任务（只接 dryRun，不访问外部站点） |
| GET /api/tasks | 最近 50 条任务，`?state=active` 只看在跑的 |
| GET /api/tasks/:id | 单条任务与步骤进度 |
| POST /api/tasks/:id/cancel | 取消排队/运行中的任务 |
| GET /api/logs | 最近事件 |
| GET /api/logs/stream | SSE，断线按 id 补历史 |

事件会写进 `data/events.log`：服务启动、登录成功/失败、退出、改配置、改站点配置、改搜索预设、待审核条目增删与状态变更、干跑任务新建与完成、任务取消。

数据文件（都在 `data/` 下，0600）：`config.json` 面板配置、`site-config.json` 站点配置（密码类字段不落盘）、
`queue.json` 待审核条目、`downloaders.json` 下载器（密码只写不读）、`site-search.local.json` 搜索预设（在 `pta/data/`，不入库）。

## 站点搜索预设为什么单独存

同一个分类 id 在不同站点对应的类型不一样，搜索参数名也各不相同（nexusphp 用 search/cat，unit3d 用 name/categories[]，gazelle 用 searchstr/filter_cat）。
写死一套会导致「想搜电影却点到别的类型」，所以按站存一份：引擎、搜索路径、参数名、每个用途对应的分类 id。
真实预设只在本机与测试机，仓库里只有 `docs/site-search.example.json` 示例。

## 线上验证（最近一次）

改了四个文件后重启，实测：登录通过、`/api/sites` 305 条（NP 83 / UNIT3D 46）、`/api/site-search` 0 条（还没采）、
`/api/queue` 0 条、`/api/downloaders` 0 条、干跑任务能提交并按 5 步跑完、公网入口 200。
带 `?v=` 的新前端已经生效，不带版本号的 app.js 仍是 Cloudflare 旧缓存。

## 检查

```
pta\checks\run.cmd
```

- smoke.js 21 条：登录、七页渲染、分类映射、越界拦截、上传/查重、导出下载、确认弹窗、无 JS 错
- audit.js：逐个点所有可点元素，报死按钮
- api.js 16 条：健康、配置区间、落盘、站点清单结构、站点配置读写、干跑任务生命周期、登录与 401

改完必须全绿再提交。

## 下一步

1. 流程页顶部「流程自检（干跑）」已接 `/api/tasks`，其余页面按需接入
2. 站点页显示该站的搜索预设状态（读 `/api/sites/:host/search`），没有预设的给「去确认」入口
3. 站点页「抓取测试」改名「连接自检（干跑）」，界面标明未接真站

真抓取、真实站点登录一律不做：按用户要求不碰真实站点，不许自己找 cookie，也不做探测或压测。

## 注意

- 真实站点清单只在本机与测试机：`pta/web/assets/sites-data.local.js`、`pta/data/site-arch.local.csv`，都已被 gitignore，不要提交
- 面板账号密码不入库，只配在测试机 systemd 环境变量里
- Cloudflare 会缓存 js/css，静态资源已加 no-cache 与版本号；换版本记得改 `?v=` 参数
