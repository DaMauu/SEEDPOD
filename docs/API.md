# SEEDPOD 接口契约

先定契约，再写实现。前端按这里的字段写，后端按这里的字段返回，谁都不许临时加字段。

## 通用约定

- 基础路径 `/api`，全部 JSON，时间一律 ISO 8601 带时区。
- 成功：`{ "ok": true, "data": ... }`；失败：`{ "ok": false, "error": { "code": "...", "message": "..." } }`。
- 鉴权：`Authorization: Bearer <token>`，只允许局域网来源。
- 参数越界不静默钳制，直接 400，并在 message 里说明允许区间。

## GET /api/health

```
{ "ok": true, "data": { "version": "0.4.0", "uptime": 8123, "db": "ok", "loginFail": 3, "nodesOnline": 2, "nodesTotal": 3 } }
```

## GET /api/config

返回三层配置，前端只允许 PATCH 用户层。

```
{ "ok": true, "data": {
  "sys": { "concurrency": 1, "minInterval": 8, "retry": 3, "backoff": 30, "breaker": 15, "audit": true },
  "user": { "runMode": "test", "interval": 60, "dailySite": 20, "dailyAll": 100 },
  "limits": {
    "test": { "interval": [30, 120], "dailySite": [1, 300], "dailyAll": [50, 2000] },
    "prod": { "interval": [8, 120], "dailySite": [1, 300], "dailyAll": [50, 2000] }
  }
} }
```

## PATCH /api/config/user

请求 `{ "interval": 3 }` → 400 `{ "code": "OUT_OF_RANGE", "message": "interval 必须在 8–120 之间" }`。

## GET /api/sites

```
{ "ok": true, "data": {
  "counts": { "total": 305, "np": 83, "unit3d": 46, "gz": 29, "other": 31, "unknown": 116 },
  "sites": [ { "host": "example.org", "url": "https://example.org", "arch": "NP" } ]
} }
```

`arch` 取值：NP / UNIT3D / GZ / OTHER / ?（未确认）。清单来自 `pta/web/assets/sites-data.local.js`，缺失则为空数组。

## GET /api/site-search

所有站点搜索预设的汇总，用于列表页标「已确认 / 未确认」：

```
{ "ok": true, "data": {
  "example.org": { "engine": "nexusphp", "source": "probe", "updatedAt": "...", "groups": 4, "ids": 9 } } }
```

`groups` 是配置了几个用途，`ids` 是分类 id 总数；没配过的站点不会出现在结果里。

## GET /api/sites/:host/search

返回该站点的搜索预设（没配过就是 `null`）：

```
{ "ok": true, "data": { "host": "example.org", "engines": ["nexusphp", "unit3d", "gazelle", "custom"],
  "preset": {
    "engine": "nexusphp", "searchPath": "/torrents.php", "browsePath": "/torrents.php",
    "params": { "search": "{q}", "cat": "{cats}" },
    "cats": { "movie": ["401"], "tv": ["402"] },
    "source": "probe", "updatedAt": "..." } } }
```

`{q}` 是搜索词占位，`{cats}` 是分类 id 占位；`cats` 下面的键是用途（movie/tv/doc/music…），值是该站对应的分类 id。
字段说明与示例见 `docs/site-search.example.json`，真实预设落在 `pta/data/site-search.local.json`（不入库）。

## PUT /api/sites/:host/search

按字段合并写预设。`engine` 只能取 nexusphp / unit3d / gazelle / custom，`searchPath`、`browsePath`、`note` 是不超过 300 字的字符串，
`params` 是字符串键值（最多 30 个），`cats` 是 用途 -> id 数组（最多 20 个用途、每个 50 个 id），`source` 只能 manual 或 probe。
非法取值 400 `BAD_REQUEST`。成功回 `{ "host": "...", "preset": {...} }`。

## DELETE /api/sites/:host/search

删掉该站点预设，同时写一条事件日志。

## GET /api/site-config

```
{ "ok": true, "data": { "sites": { "example.org": { "interval": 45, "pages": 3 } },
  "hidden": [], "fields": ["enabled", "url", "..."] } }
```

只返回服务端已保存的字段，未保存的站点不出现在 `sites` 里。

## PUT /api/site-config/:host

请求体是字段子集，按白名单合并（不认识的字段忽略）：

| 字段 | 约束 |
| --- | --- |
| interval | 整数 1–1440 分钟 |
| pages | 整数 1–20 |
| concurrency | 整数 1–8 |
| everyMin | 整数 5–1440 |
| jitter | 整数 0–120 |
| cats | 字符串数组，最多 32 项 |
| 其它白名单字段 | 布尔/数字/字符串，字符串不超过 500 字 |

`password`、`cookie`、`totp` 一律不落盘，回包 `data.dropped` 里列出被丢弃的字段名。
成功回 `{ "host": "...", "config": {...}, "changed": ["interval"], "dropped": ["password"] }`；
数值越界 400 `OUT_OF_RANGE`，域名不合法 400 `BAD_HOST`。

## DELETE /api/site-config/:host

删掉该站点的服务端配置并恢复默认，同时把它从 `hidden` 里移除。

## PATCH /api/sites/:host（规划，未实现）

可改字段：enabled、interval、dailyCap、note、loginMethod、username。密码字段只写不读，回包永远不带明文。

## POST /api/sites/:host/test-login（规划，未实现）

```
{ "ok": true, "data": { "pass": true, "steps": [ { "step": "login", "status": 200, "ms": 812 } ] } }
```

## GET /api/downloaders

```
{ "ok": true, "data": [ { "id": "dl_001", "name": "本机", "url": "http://127.0.0.1:8080",
  "user": "admin", "hasPass": true, "disableAuth": false } ] }
```

密码只写不读：列表与详情永远只回 `hasPass`。数据落在 `data/downloaders.json`（0600）。

## POST /api/downloaders

`url` 必填，必须是 http/https；`name` 最多 60 字；可选 `user`、`pass`、`disableAuth`。地址不合法 400 `BAD_URL`。

## PUT /api/downloaders/:id

按字段合并修改，规则同上。`pass` 传空字符串表示清掉已存密码。

## DELETE /api/downloaders/:id

删掉下载器并写事件日志。

## POST /api/downloaders/:id/test

只连这个下载器自己填的地址，8 秒超时，最多两次请求（先取版本，遇到 401/403 再用账号密码登录一次后重取）。

```
{ "ok": true, "data": { "pass": true, "version": "v5.0.3",
  "steps": [ { "step": "version", "status": 200, "ms": 42 } ] } }
```

连不上时 `pass: false`，`steps[0]` 带 `error`（超时会写「连接超时」）。

## GET /api/queue

`?status=pending|approved|rejected|published` 可过滤，`?limit=` 最多 500。

```
{ "ok": true, "data": {
  "counts": { "total": 3, "pending": 1, "approved": 1, "rejected": 0, "published": 1 },
  "items": [ { "id": "q_0001", "title": "...", "cn": "...", "res": "1080p", "size": "22.10 GB",
    "site": "example.org", "status": "pending", "createdAt": "..." } ] } }
```

条目落在 `data/queue.json`（0600），最多保留 500 条。

## POST /api/queue

新增条目，`title` 必填（不超过 300 字），可选 `cn/year/res/size/imdb/site/check/checkCls/note/shots`。
新条目状态一律是 `pending`。抓取执行器没接之前，这就是造数据的入口。

## GET /api/queue/:id

单条详情，不存在 404。

## POST /api/queue/:id/action

请求 `{ "action": "approve" | "reject" | "publish", "reason": "..." }`，返回该条新数据。

状态机：`pending → approved / rejected`，`approved → published / rejected`，`rejected`、`published` 是终态。
越级（例如 pending 直接 publish）返回 409 `BAD_STATE`，附带当前状态与允许的目标；驳回必须写 reason，空理由 400。

## DELETE /api/queue/:id

删掉条目并写事件日志。

## GET /api/logs

参数：`limit`（默认 100，最多 500）、`level`（info/warn/error 精确匹配）、`src`（子串匹配）、`since`（只返回 id 大于它的）。

```
{ "ok": true,
  "data": [ { "id": 12, "ts": "...", "level": "info", "src": "任务", "msg": "..." } ],
  "meta": { "total": 40, "filtered": 3, "level": "warn", "src": "", "logMax": 2097152 } }
```

事件写在 `data/events.log`，超过 `PTA_LOG_MAX`（默认 2 MB）就轮转成 `events.log.1`，只保留上一份并写一条「日志轮转」事件。

`/api/logs/stream` 返回 `text/event-stream`，每行 `data: {...}`，断线由前端 3 秒重连。

## POST /api/tasks

请求 `{ "type": "crawl" | "check" | "publish", "siteHost": "example.org", "dryRun": true }`。

只支持干跑：`dryRun` 省略或为 `true` 都按干跑执行，显式 `false` 返回 501 `DRY_RUN_ONLY`。
干跑会在服务端按 5 个步骤（准备 / 读取配置 / 分析待处理清单 / 查重 / 汇总）推进，**不访问任何外部站点**。
同一站点同时只允许一个任务，重复提交返回 409 `{ "code": "BUSY", "id": "t_0001" }`。
任务表在内存里，最多保留最近 50 条，进程重启即清空。

## GET /api/tasks

返回最近 50 条，倒序。`?state=active` 只返回排队与运行中的任务。

## GET /api/tasks/:id

```
{ "ok": true, "data": { "id": "t_0001", "type": "crawl", "siteHost": "example.org", "dryRun": true,
  "state": "done", "progress": 100, "steps": [ { "name": "准备", "state": "done" } ],
  "createdAt": "...", "startedAt": "...", "finishedAt": "...",
  "result": { "dryRun": true, "steps": 5, "note": "干跑：没有访问任何站点" } } }
```

`state` 取值：queued / running / done / canceled / failed。任务不存在返回 404。

## POST /api/tasks/:id/cancel

把排队或运行中的任务置为 `canceled`；已结束的任务原样返回。

## 错误码

| code | 含义 |
| --- | --- |
| BAD_REQUEST | 参数缺失或类型错 |
| OUT_OF_RANGE | 数值越界，见 limits |
| BAD_HOST | 站点域名不合法 |
| BAD_URL | 下载器地址不是 http/https |
| DRY_RUN_ONLY | 真抓取未接入，只接受干跑 |
| UNAUTHORIZED | 令牌缺失或过期 |
| NOT_FOUND | 资源不存在 |
| BUSY | 同站点已有任务在跑 |
| BAD_STATE | 待审核条目当前状态不允许这个操作 |
| SITE_FAILED | 站点返回 4xx/5xx，已按策略重试 |
| RATE_LIMITED | 触发熔断，附带 retryAfter 秒 |
| INTERNAL | 未预期错误，附带 traceId |
