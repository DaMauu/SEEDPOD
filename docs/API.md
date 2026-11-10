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
  "user": { "interval": 30, "dailySite": 100, "dailyAll": 800 },
  "limits": { "interval": [8, 120], "dailySite": [1, 300], "dailyAll": [50, 2000] }
} }
```

## PATCH /api/config/user

请求 `{ "interval": 3 }` → 400 `{ "code": "OUT_OF_RANGE", "message": "interval 必须在 8–120 之间" }`。

## GET /api/sites

```
{ "ok": true, "data": [
  { "host": "example.org", "name": "示例站", "arch": "NexusPHP", "enabled": true,
    "login": "ok", "ratio": 2.31, "lastRun": "2026-11-10T12:40:00+08:00",
    "cats": ["Movies", "TV"], "mapped": 2 }
] }
```

## PATCH /api/sites/:host

可改字段：enabled、interval、dailyCap、note、loginMethod、username。密码字段只写不读，回包永远不带明文。

## POST /api/sites/:host/test-login

```
{ "ok": true, "data": { "pass": true, "steps": [ { "step": "login", "status": 200, "ms": 812 } ] } }
```

## GET /api/queue?tab=pending

```
{ "ok": true, "data": [ { "id": 101, "title": "...", "cn": "...", "year": 2020, "res": "1080p",
  "size": "22.10 GB", "state": "pending", "check": "none", "detail": { "intro": "...", "shots": 3 } } ] }
```

## POST /api/queue/:id/action

请求 `{ "action": "approve" | "reject" | "skip", "reason": "..." }`，返回该条新状态。
驳回必须写 reason，空理由返回 400。

## GET /api/logs?limit=200（SSE 用 /api/logs/stream）

```
{ "ok": true, "data": [ { "ts": "...", "level": "info", "src": "crawl", "msg": "..." } ] }
```

`/api/logs/stream` 返回 `text/event-stream`，每行 `data: {...}`，断线由前端 3 秒重连。

## POST /api/tasks

请求 `{ "type": "crawl" | "check" | "publish", "siteHost": "...", "dryRun": false }`。
同一站点同时只允许一个任务，重复提交返回 409 `{ "code": "BUSY" }`。

## GET /api/tasks/:id

```
{ "ok": true, "data": { "id": "t_01", "type": "crawl", "state": "running", "progress": 42,
  "startedAt": "...", "steps": [ { "name": "list", "state": "done" } ] } }
```

## 错误码

| code | 含义 |
| --- | --- |
| BAD_REQUEST | 参数缺失或类型错 |
| OUT_OF_RANGE | 数值越界，见 limits |
| UNAUTHORIZED | 令牌缺失或过期 |
| NOT_FOUND | 资源不存在 |
| BUSY | 同站点已有任务在跑 |
| SITE_FAILED | 站点返回 4xx/5xx，已按策略重试 |
| RATE_LIMITED | 触发熔断，附带 retryAfter 秒 |
| INTERNAL | 未预期错误，附带 traceId |
