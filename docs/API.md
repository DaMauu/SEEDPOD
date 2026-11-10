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

## GET /api/queue?tab=pending（规划，未实现）

```
{ "ok": true, "data": [ { "id": 101, "title": "...", "cn": "...", "year": 2020, "res": "1080p",
  "size": "22.10 GB", "state": "pending", "check": "none", "detail": { "intro": "...", "shots": 3 } } ] }
```

## POST /api/queue/:id/action（规划，未实现）

请求 `{ "action": "approve" | "reject" | "skip", "reason": "..." }`，返回该条新状态。
驳回必须写 reason，空理由返回 400。

## GET /api/logs?limit=200（SSE 用 /api/logs/stream）

```
{ "ok": true, "data": [ { "ts": "...", "level": "info", "src": "crawl", "msg": "..." } ] }
```

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
| DRY_RUN_ONLY | 真抓取未接入，只接受干跑 |
| UNAUTHORIZED | 令牌缺失或过期 |
| NOT_FOUND | 资源不存在 |
| BUSY | 同站点已有任务在跑 |
| SITE_FAILED | 站点返回 4xx/5xx，已按策略重试 |
| RATE_LIMITED | 触发熔断，附带 retryAfter 秒 |
| INTERNAL | 未预期错误，附带 traceId |
