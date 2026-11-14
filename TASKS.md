# TASKS · SEEDPOD 面板

给自动循环（Ralph / 定时任务）看的任务清单与验收标准。

## 〇、先读这三份

- `docs/ARCHITECTURE.md` 分层、数据流、数据模型、风控为什么这么定
- `docs/API.md` 接口契约，字段以这里为准，不许临时加
- `docs/DECISIONS.md` 已经定下来的取舍，改主意要追加新条目
- `docs/PRIOR-ART.md` 借了 Jackett/Prowlarr Cardigann 的哪些结构与判定规矩，哪些不能抄

## 一、检查分三层（pta/checks）

0. `security.js`（2 条）：凭据加解密往返与密钥解析（TOTP 相关已随功能移除）。
	`adapter.js` 站点解析（5 条）：用夹具验 NexusPHP 的分类识别、列表解析、搜索 URL 拼装、登录表单解析，全程离线。
1. `smoke.js` 功能断言（23 条）：未登录弹登录页、错误密码有提示、登录后进面板、七个路由能开、分类映射能存、越界参数被拦、上传 3 张出 3 缩略图、批量查重跑完、归档与两个下载、下载器连接测试与干跑按钮在没后端时有提示、确认弹窗能开能关、无 JS 报错。
2. `audit.js` 交互审计：把每个页面所有可点的东西逐个点一遍（约 140 个交互点），没有反应就报 DEAD；同时查重复 id、指向不存在页面的链接。
3. `api.js` 后端契约（41 条）：起临时实例，验 health、双模式区间、越界 400、配置落盘、静态回退、站点清单结构、站点配置读写与秘密不落盘、搜索预设读写、待审核状态机与鉴权、下载器秘密不回显与本地假 qB 探测、干跑任务生命周期、并发 409、非干跑 501、登录与 401。
4. `run.cmd` 一键跑上面三套，全绿退出 0，有失败退出 1。

## 二、自动修的闭环（每轮照做，不许跳）

1. 先跑 `run.cmd`，把失败项原文记下来（哪条、报什么）。
2. 只改导致失败的最小范围；一次只修一条失败。
3. 改完立刻重跑；全绿才 `git commit`，红了不许提交。
4. 同一条失败修两轮还不好：`git checkout -- <改过的文件>` 回滚，把这条标 blocked，写清原因。
5. 改动超过 60 行或要动三个以上文件，先停下写方案，等人确认，别硬改。

## 三、规矩

1. 改之前先读文件；新功能优先新建文件，不改旧文件的结构。
2. 不动 `data/sites-data.local.js`、`pta/data/site-arch.local.csv`（真实站点数据，不入库）。
3. 一次提交只做一件事，提交信息写清改了什么、为什么。
4. 审美、业务取舍、要不要改需求这类判定不了的事，标 blocked 等人，不许自己猜。
5. 检查本身也会过时：需求变了先更新断言，再改代码，顺序不能反。
6. 不对真实 PT 站点发请求：不许自己找或复用 cookie 去登录，不做探测、不做压测。抓取相关一律先做干跑或本地夹具，真请求只在用户明确要求时一次性执行。

## 四、跑检查

```
pta\checks\run.cmd
```

没有 node 环境时：

```
set PTA_NODE=<node.exe 路径>
set PTA_PW=<playwright-core 目录>
pta\checks\run.cmd
```

## 五、任务

| 状态 | 任务 | 完成标准 |
| --- | --- | --- |
| done | 请求层参数固定 + 越界拦截 | 设置页填 4 秒保存被拦；回归绿 |
| done | 分类映射（站点 / 目标站） | 弹窗能开、能自动猜、保存后显示已配 N 条 |
| done | 待审核上传截图 + 批量查重 + 驳回理由 | 上传 3 张出 3 缩略图；查重跑完；理由留在条目 |
| done | 数据清单归档 / 导出、日志下载 | 归档行置灰；两个下载文件名对 |
| done | 补上缺失的确认弹窗 ptaConfirm | 删除下载器、清缓存、改密码都会弹确认，审计无 JS 报错 |
| done | 前端登录页 | 未登录显示登录页，错误密码有提示，登录后可进面板 |
| done | 登录改由服务端校验 | POST /api/login 发 HttpOnly 会话 cookie，接口无会话返回 401 |
| done | 日志接服务端 SSE | 服务端事件（启动/登录/改配置）实时推送，SSE 断线自动补历史 |
| done | 容器化并在实机跑通 | 镜像构建成功、健康检查 healthy、配置改动重启后仍在 |
| done | 前端从 `/api/config` 读真实配置 | 设置页显示服务端值，保存时 PATCH 回服务端 |
| done | 面板密码与公网反代 | 未登录 401，登录 200，域名走 nginx 反代 |
| done | 线上部署与验证（2026-11-10） | 305 站、站点配置/预设/队列/下载器/干跑任务接口在线上全部可用，公网 200 |
| done | 站点清单改由 `/api/sites` 供数 | 前端优先读服务端清单，本地清单只在离线时兜底 |
| done | 站点配置服务端持久化 | 白名单字段落盘 `data/site-config.json`，密码/cookie/totp 拒收，前端读写同步 |
| done | 干跑任务队列 | `POST /api/tasks` 只接干跑，同站点并发 409，5 步推进可取消，不访问任何外部站点 |
| done | 日志与审计补齐 | `/api/logs` 支持 level/src/since 过滤，events.log 超过 2 MB 自动轮转，启动记一条数据概览 |
| done | 干跑执行器骨架（读配置生成计划） | 计划含页数/并发/分类组与 id 数/预估查询数，缺预设或缺站点会给警告 |
| done | 前端接任务队列 | 流程页顶部「流程自检（干跑）」提交任务并实时显示 5 步进度，明确标注不发真实请求 |
| done | 流程页搜索预设与判定规则生效 | 改动即时刷新摘要，保存写 `/api/flow`，换浏览器/换机器打开能还原 |
| done | 本地查重（不联网） | `/api/queue/:id/check` 比对队列与本地库，片名前 4 词做键，年份/分辨率不同不算重复 |
| done | 待审核台服务端状态机 | `POST /api/queue` 造条目，approve/reject/publish 各有校验，越级 409 |
| done | 站点搜索预设按站存 | `/api/sites/:host/search` 支持引擎/路径/参数名/分类 id，真实数据不入库 |
| done | cookie 导入与会话自检 | 浏览器读 cookie → 服务端加密存 → `session-test` 判定可用；实测 7 站全通 |
| done | 站点登录只留 cookie | 删除账号密码/2FA 与 login-test，登录设置页改成 cookie 输入 + 自检按钮 |
| done | 前端拆分第一步 | 规则表（抓取/查重/发布）搬到 `assets/data.js`，app.js 从 3349 行减到 3222 行，检查全绿 |
| done | NexusPHP 列表解析对齐真实页面 | 三页各 100 行，标题/分类/下载链接均 100/100；大小字段待按站补 |
| done | NexusPHP 适配器（解析层，不发请求） | `server/adapters/nexusphp.js` 纯函数：分类/列表/搜索 URL/登录表单，夹具 5 条断言 |
| done | 站点定义（site-defs） | `scripts/collect-site-defs.js` 把采集结果整理成每站一份定义，真实定义不入库 |
| done | 搜索预设采集（真实站点，逐步） | 已采 7 站 108 个分类 id，脚本逐站一次请求、间隔 4 秒，结果不入库 |
| done | 站点页显示预设状态 | 列表标「预设」，详情显示「搜索预设 已确认/未确认」，读 `/api/site-search` 汇总 |
| done | 待审核台前端接 `/api/queue` | 有后端时列表读服务端，「通过并发布」走 approve+publish，驳回必须填理由 |
| done | 下载器连通性探测（后端） | 只连自己填的地址，8 秒超时，401 时用账号密码登录一次再重试，失败给原因 |
| done | 下载器页前端接探测接口 | 弹窗里点测试：先临时建记录再探，显示 steps 与版本号，探完自动清理 |
| done | 下载器保存走服务端 | 新增走 POST、改走 PUT、删除走 DELETE，刷新页面从服务端还原，密码只写不读 |
| done | 发布级查重 | `server/match.js`：infohash 优先，其次标题归一/年份/分辨率/体积容差/发布组；命中带理由 |
| done | 流程页按三步重排 | 抓取（预设+抓取标记）→ 筛选（筛选条件+已有归档）→ 发布（目标站+标题副标题+简介+发布字段） |
| done | 抓取执行 | `/api/crawl/plan` 只拼 URL；`/api/crawl/run` 单次 GET 入词条库，6 秒间隔 + 单站每日 20 次 + 无 cookie/登录失效直接拒 |
| done | 抓取翻页与类目轮转 | 每次换下一个分类、页码续抓记在 crawl-state；`/api/crawl/status` 可查今日次数/当前分类/冷却 |
| done | 词条库面板 | 抓取页底部最新 30 条，状态徽标 + 禁转/独占/DIY/限转标记，可归档；站点设置页显示抓取进度 |
| done | 第二步筛选 | `/api/catalog/screen` 按分辨率/体积/中字/已有判重挑词条：入选进待审核并标 selected，其余标 skipped 并记原因 |
| done | 第三步草稿 | `/api/publish/preview` 组装标题/副标题/简介/标签（来源/媒介/编码/音轨/中字），缺项给提醒；待审核页「草稿预览」回填表单 |
| done | 去掉单独的词条库块（2026-11-11） | 抓取页不再重复列表；词条只在数据清单页看，检查全绿 |
| done | 数据清单接管筛选与标记 | 站点/类型/状态三筛选全来自真实数据；行内点禁转/独占/DIY/限转让标记，可单条归档或批量归档已跳过 |
| done | 数据清单类型列补中文名 | 老词条只有分类 id 时用站点定义反查中文；`/api/site-defs` 摘要带上 `cats` |
| done | 站点页默认启用 + 上次抓取 | 未显式停用的站按启用计；上次抓取显示 crawl-state 的时间，不再永远是「未抓取」 |
| done | 站点状态带不再换行错位 | 数字/进度条/覆盖说明各占一行，窄屏下不重叠 |
| done | 搜索预设页签恢复分类 id 与链接预览 | 服务端没给 url 时用预设分类 + 站点定义自己拼；预览去掉 `{q}` 占位，点开是真站分类页 |
| done | 抓取节奏改 30 秒 / 每轮 100 条 | `CRAWL_MIN_GAP_MS=30000`，一轮默认 100 条，面板可切 5/20/100 先小量试 |
| done | 数据清单可单条送审 / 批量送审 | `POST /api/catalog/screen` 支持 `ids`；行内「送审」、工具栏「按条件送审」都走它，页面回显入选/跳过原因 |
| done | 数据清单接站点详情页 | 标题可点，服务端存的是相对路径，前端按站点定义 base 补成完整 URL |
| done | 站点抽屉概览改真数据 | 今日次数/已收录/最近收录都读 `/api/site-def` 与 `/api/catalog?site=`，没有了就写没有 |
| done | 设置页去掉假项 | 删掉面板密码/2FA/通知/备份/API 令牌这些没后端的控件；用户名与版本读后端，退出登录走 `/api/logout` |
| done | 清掉死代码与假样本 | 删掉趋势图/待办/已发布样本和两个没人调用的渲染函数，页面没有任何编造的统计 |
| done | 数据清单分页 | 一次读 500 条、每页 100，页脚显示「第 x / y 页」与上下页；`/api/catalog` 带 `matched` 计数 |
| done | 抓取来源站可选 | 流程页右上角「选来源站」，抓一页与干跑自检都按它走，记住上次选择；没选就提示，不再默认第一个站 |
| done | 待审核「全部发布」 | `/api/queue/bulk` 支持 `publish`，只处理 approved，发布前过下载器/预设闸门，api 检查覆盖 |
| done | 列表页进就刷新 | 进数据清单/待审核时重新拉一次；总览每 30 秒刷新真实状态 |
| done | 站点抽屉显示 cookie 状态 | 启动时读一次 `/api/credentials`（只拿 hasCookie），概览里直接显示「已保存/未保存」 |
| done | 文案统一 | 界面上不再出现单独「词条库」说法，统一叫数据清单 / 词条 |
| done | 安全修复：真实站点清单不再公开 | 真实清单移到数据目录 `data/sites-data.local.js`，web 根不再引用；服务端对 `*.local.*` 一律 404；线上验证该路径 404、登录后 `/api/sites` 仍返回 305 站与标题 |
| done | cookie 保存后看得见 | 保存后显示「服务端已保存 + 更新时间」，自检结果保留在页签上，重开抽屉仍在；输入框改成「不回显，要换就整段覆盖」的占位提示 |
| done | 修两个点了没反应的按钮 | 登录页签「cookie 自检」和搜索预设「确认这个预设」之前没挂 data-act，被点击分发提前 return；现在都走 act 分派，smoke 补了断言 |
| done | 演练改名 | 界面与日志把「干跑」统一改成「演练 / 本地演练（不发请求）」，内部仍用 dryRun |
| done | 一轮条数与每天次数分开 | 流程页可选 5/10/20/100 条并记住；站点覆盖的「每天抓几次」补说明：不是条数，抽屉抓一页也用这个条数 |
| done | 标记依据可说清 | 「未满 7 天」显示剩余天数，标记筛选与标签都带 title 说明：标题关键词 / 站点发布时间，只打标不过滤 |
| done | 未满 7 天只打标记 | 抓取时读行里的 data-added/data-time，7 天内的打 limitedDays（带剩余天数），数据清单可看可筛可手动开关 |
| done | 站点抽屉可抓一页 | 抽屉里「抓一页」带二次确认，抓完自动刷新数据清单与总览 |
| done | 流程页「看地址」 | 只读本地配置，显示下一抓的 URL、分类、间隔与每日上限，不发任何请求 |
| done | 看地址可翻分类 | 计划框里加了上一类/下一类，直接调 /api/crawl/plan 的 catIdx 预览每个分类的 URL（仍不发真实请求） |
| done | 抓取标记改文字按钮 | 抓取标记里 7 个开关行改成 custom 单选文字按钮（跳过/保留、跳过/只打标、跳过/放行、标可发/不标），规则树同步重生成；缓存 19j |
| done | 加 CSP | 响应加 Content-Security-Policy（default-src self、img data/blob、frame-ancestors none 等），api 断言覆盖 |
| done | 基础安全响应头 | 所有响应加 nosniff、X-Frame-Options: DENY、Referrer-Policy: no-referrer；api 检查覆盖 |
| done | 批量设置落本地 | 客户端 store.set 的覆盖字段补 override/ovInterval/ovDaily/ovDetail/priority，批量设置和抽屉保存都会留在本地，没后端时也不丢 |
| done | 抓取接口挡非法 host | plan/run/status 统一校验 host（长度与字符集），挡住 ../、斜杠与空值，避免站点定义路径被穿越；api 补 8 次非法请求断言 |
| done | 使用说明 | pta/docs/USAGE.md 按现在的界面写了准备、抓取、查重、发布四段操作与常见问题 |
| done | 翻页回列表顶部 | 站点页翻页后滚回站点列表顶部，不再停在上一页的底部；缓存 19d |
| done | 站点列表分页 | 站点页每页 60 个、带上一页/下一页和页码，不再一次渲染 305 行；筛选后自动回第一页 |
| done | 清理死分支 | 流程页规则按钮的兜底提示已不可达（仅剩的两个按钮都有专门处理），删掉；缓存 19a |
| done | 抓这一类 | 计划框加按钮，直接按当前预览的分类抓一页（/api/crawl/run 支持 catIdx，带确认与 30 秒/每日上限）；api 用 mock 站验证请求带 cat=402 |
| done | 计划预览加说明 | 计划框里写明：这里只预览各分类地址，抓一页会按类目轮转，避免以为抓到就是预览这一类 |
| done | 修计划接口忽略 catIdx | /api/crawl/plan 原来没把 body.catIdx 传给 crawlPlan，翻分类看起来没反应；已透传，生产实测 401/402/404 出电影/电视剧/纪录片，api 补断言 |
| done | 截图随发布落库 | 上传时压到 1600px / jpeg，服务端按 {name,url} 存，单组 2.5MB 上限；读取兼容老字符串格式 |
| done | 待审核条目可选目标站 | 发布记录区分 `site`（目标站）与 `sourceSite`（来源站）；跳过动作改走服务端 `skipped` 状态 |
| done | 发布记账 | 发布成功把词条标 published、写 `published.json` 记录（含匿名/图床），`/api/published` 可查；首页已发布列表读它 |
| done | 词条库批量 | `/api/catalog/bulk` 按状态批量改；词条库面板有状态筛选与「归档已跳过」；数据清单页改成读词条库并支持归档 |
| done | 词条库 | `POST /api/catalog` 导入（按站内 id / infohash 去重）、`/status` 流转 new→selected→published/skipped/archived |
| done | 面板去假数据 | 系统状态、首页数字、节点页全部来自 `/api/stats/overview` 与下载器探测；没接下载器就显示空状态 |
| done | 下载器探测落盘 | 探测时顺带取磁盘余量（qB `sync/maindata`），结果存 `lastProbe`，系统状态与节点页复用 |
| done | 发布前前置校验 | 缺标题、缺该站搜索预设、没有下载器时 409 PUBLISH_BLOCKED 并列出缺什么 |
| done | 站点页「抓取测试」改名「连接自检（干跑）」 | 详情头部显示上次自检时间与结论，走干跑任务，不访问真实站点 |

## 五点五、需要用户决定的一件事

- `scripts/PTScripts/*.user.js` 内含真实站点域名，仓库公开；是否脱敏/移出仓库没定，先不动。

## 五点六、站点全量适配现状（2026-11-10）

清单 307 站，全部有站点定义与搜索预设；其中真实采样确认 144 站（22 站是 JS 空壳页，引擎按页面特征认的），其余 201 站按清单架构推断
（定义 `source.kind=arch`，面板上标「按清单架构推断」，可与已确认的区分）。

采不到的 221 站按原因分文件（都在 `pta/data/`，已被 gitignore，不入库）：

| 文件 | 站数 | 含义 | 怎么补 |
| --- | --- | --- | --- |
| blocked-login-wall.txt | 8 | 浏览器里没登录，页面只有登录框 | 人工登录后 `node scripts/collect-now.js` |
| blocked-net-error.txt | 42 | DNS/连接被拒 | 挂代理后同样命令 |
| blocked-cloudflare.txt | 12 | Cloudflare 挑战页 | 人工过一下挑战再补采 |
| blocked-http-404.txt | 57 | 路径 404 或站点改版 | 跑 discover-paths.js 自动找入口 |
| blocked-error-panel.txt | 16 | 拿到的是错误页 | 补采一次即可 |
| blocked-no-sample.txt | 42 | 之前失败过、还没补采 | 直接补采 |
| blocked-degraded.txt | 8 | 引擎认出来了但一行都解析不出（降级页） | 等下一轮补采 |
| blocked-thin.txt | 16 | JS 渲染的空壳页 | 需要等渲染或换入口 |
| blocked-unknown.txt | 6 | 有页面认不出引擎 | 看页面结构再补适配器 |

补采入口：`node scripts/collect-now.js --dry` 先看会打哪些站，去掉 `--dry` 真跑；
`--cookies` 会顺手把 cookie 导出到 `pta/data/cookies.tmp.json`（0600，不入库）。
命令内部的采样仍是每站一次 GET、站间 4-6 秒，清单里的站会清掉 12 小时冷却标记。

路径猜错的站不用人工存档：`node scripts/discover-paths.js` 会读首页导航自己找种子页
（每站最多 2 次 GET，失败记 no-nav，12 小时内不重试），找到的路径会被采样器优先使用。
当前有 111 站属于这一类可自动尝试。

## 六、已知隐患

- `app.js` 约 2400 行，状态、假数据、渲染、交互混在一起。
- `app.css` 约 2200 行，末尾叠了多层「后写覆盖先写」的补丁。
- 这两件事要单独做一次搬家式重构，不加功能，检查必须保持全绿。

## 七、待修清单（2026-11-14，v2 搬迁收尾）

一次一个提交；标了 root 的等作者提供权限后做。

### P0

- [x] **筛选条件接进 v2**（不用 root）
  已做：`routes-misc.js` 的 screen 接口读取 flow 的 `分辨率要求 / 体积范围 / 最大体积 / 必须带中字`，加上排除/白名单与同片去重；临时库实测 5 条词条 → 1 条进队列、4 条按分辨率/中字/体积/重复跳过。
- [x] **package.json 补依赖**（不用 root）
  已做：声明 `fastify` / `@fastify/static`，`start` 指向 `app-fastify.js`，`engines` 改 Node >=22，lock 已提交。
- [x] **unit 安全**（root）
  已做：密码移到 `/etc/seedpod.env`（0600 root:root），unit 用 `EnvironmentFile`，服务改 `seedpod` 用户；重启后 health 正常、登录 200。

- [x] **api 检查切到 v2**（不用 root）
  已做：新增 `api-v2.js`（15 条，覆盖 health、安全头、登录/会话/退出、401、dev、config、flow、词条、screen 条件、凭据/下载器不回显、404），`run.sh` 已改跑它；旧 `api.js` 标 legacy，不再进检查。
- [x] **v2 补安全响应头**（不用 root）
  已做：`app-fastify.js` 的 `onSend` 加 `nosniff / X-Frame-Options / Referrer-Policy / CSP`，CSP 与旧后端一致并放行 Cloudflare 分析；临时实例 `curl -I` 已验证。
- [x] **cookie 导入改走 SQLite**（不用 root）
  已做：`load-cookies.js` 改为加密后 upsert `credentials` 表；临时库实测写入 1 条、解密值一致，不再写 JSON。

### P1

- [x] **部署权限与版本对齐**（root）
  已做：`/opt/seedpod/pta` 与 `package.json` 改归 `ocbot`，`deploy.sh` 用 `sudo -n systemctl restart seedpod`；已部署到 0.7.70。
- [ ] **旧 app.js 退休**（不用 root）
  现象：12 万字节仍在仓库，文件头还写着“生产仍跑旧服务”。
  验收：移到 `pta/server/legacy/` 或删除，`git grep app.js` 只剩文档引用；检查全绿。
- [x] **检查脚本跨平台**（不用 root）
  已做：新增 `browser.js`（Linux 默认 Chromium 新 headless，Windows 可 `PTA_CHANNEL=msedge`）、`run.sh`、playwright 进 devDependencies；下载用例在 Linux 已通过。
  剩余：smoke 23 条里 5 条与当前 demo UI 不同步（`#site-detail` 重复、设置页 runMode 已移除、`.rule-item` 结构变了、上传缩略图选择器、下载器连接测试），先记为下一条。
- [ ] **smoke 5 条遗留断言重写**（不用 root）
  清单：站点展开（重复 id）、请求间隔越界（设置页已无 runMode）、流程页拉取卡（`.rule-item` 不存在）、待审核缩略图（选择器/上传路径）、下载器连接测试。
  验收：`run.sh` 五段全绿，或明确标 skip 并写原因；不要为了让检查变色而删断言。
- [ ] **轮换面板密码**（root）
  现象：真实 `PTA_PASS` 曾写进 `pta/web/assets/app.js` 与检查脚本，git 历史里仍能查到。
  验收：systemd 改新密码（或迁到 `/etc/seedpod.env` 0600），面板用新密码能登录；旧值作废。
- [ ] **Docker 对齐 v2**（不用 root）
  现象：Dockerfile 的 `CMD` 还是 `server/app.js`，构建没装 fastify。
  验收：`docker compose up` 后 `/api/health` 回 `db: "sqlite"`，数据卷 `/data` 持久化。

- [x] **前端整体搬迁（结构 + 上线）**（不用 root）
  已做：Vite 7 + Vue 3 工程、8 个页面 SFC、构建检查 7 路由、线上切到 `pta/web/dist`、deploy 自动构建。
- [ ] **页面逻辑拆进 SFC**（不用 root，可选，逐步做）
  现状：页面是 SFC 壳，逻辑仍在 `src/legacy/app.js`。后续修哪页就把那页逻辑搬进对应 SFC/组件，不再新写 legacy。
- [ ] **Docker 两阶段构建**（不用 root）
  构建阶段跑 `npm ci && npm run build`，运行阶段只带 dist + server + 生产依赖。

### P2

- [ ] **旧 JSON 归档**（不用 root）
  现象：`data/` 里 JSON 与 SQLite 两份数据，`credentials.json` 是 11 号的旧文件。
  验收：旧文件移到 `data/legacy/`，确认 v2 不再读写；文档写明 SQLite 是唯一事实源。
- [ ] **旧文档对齐**（不用 root）
  现象：`docs/ARCHITECTURE.md` 写“纯静态页面，假数据”；`DECISIONS.md` / `PRIOR-ART.md` 写“零依赖”。
  验收：全文搜“零依赖 / 假数据 / app.js”，只剩历史决策条目。
- [ ] **卸载 OpenCode V1**（root）
  现象：`opencode.service` 还在 4096 跑，占用约 2.6GB。
  验收：4096 关闭，V2 与 Telegram 机器人正常。

## 八、M4 队列页 SFC 前置（已解决，2026-11-15）

0.7.104 已补齐下列接口，队列页可以搬 SFC。

| 缺口 | 位置 | 现状 | 需要 |
| --- | --- | --- | --- |
| 列表筛选/分页 | `app-fastify.js:160` | 只认单值 `status`，忽略 `offset` / `q` | 支持 `status=a,b`、`offset`、`q` |
| 批量动作 | `routes-extra.js:10` | 只认 `ids`，忽略 `fromStatus`；只支持 approve/reject/skip | 支持 `fromStatus`，或前端先取 ids；发布另走 `/api/publish` |
| 单条查重 | 无 | 旧界面调用 `/api/queue/:id/check`，v2 没这个接口 | 新增，返回 `{duplicate, note}` |
| 发布表单字段 | `routes-write.js:96` | `action` 只改 status/reason，忽略 title/subtitle/intro/targetSite/shots | 合并表单字段或单独保存接口 |
| 发布语义 | `routes-write.js:107` | `action=publish` 只记账，不走 qB | 队列“发布”统一走 `/api/publish/:id`，把 409 提示出来 |

验收：上述接口补齐并有 api-v2 用例后，再把 queue 页搬 SFC；搬完 smoke-live 增加列表/详情/驳回/发布断言。

## 九、目标站提交与校验（M8，已完成 0.7.111）

- 内置 NexusPHP/UNIT3D/Gazelle 的路径/字段骨架，`data/site-pack.json` 的 `upload` 覆盖。
- API：`GET /api/targets`、`POST /api/targets/:host/plan|upload|verify`；真提交受 `realPublish` 门禁。
- `pta/checks/target.js` 本地 mock：私有包、NexusPHP 真提交、UNIT3D/Gazelle 干跑、门禁、回查，6/6。
- 待审核页加“提交目标站”，成功后把 `targetUpload/targetVerify` 写回队列。
- 真实站不测；用户的私有包自行确认字段。

## 十、M4 归档（已完成，0.7.110）

- 旧 demo 的 HTML/assets 移到 `pta/archive/web-demo`；`pta/web` 只留构建产物 `dist` 和说明。
- `gen-rules-tree.js` 改读 `pta/web-src/src/legacy/data.js`；`deploy.sh` 排除 `archive/`。
