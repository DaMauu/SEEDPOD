# API 契约（API）

状态：2026-11-24 初版。前端只按本文件写，不按后端源码猜字段。

## 通用

```text
认证：HttpOnly 会话 cookie；除 /api/health、/api/login 外都要登录
成功：{ "ok": true, "data": ... }
失败：{ "ok": false, "error": { "code": "...", "message": "..." } }
分页：{ "items": [], "total": 0, "offset": 0, "limit": 50 }
```

错误码由 `server/src/shared/errors.js` 统一注册，前端只展示 `message`，按 `code` 分支。

## 面板

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 探活，不需要登录 |
| POST | `/api/login` | `{user, pass}` 换会话 cookie |
| POST | `/api/logout` | 注销 |
| GET | `/api/session` | 当前登录状态 |
| GET | `/api/dev` | 版本、技术栈、计数 |
| GET | `/api/changelog` | 更新日志 |

## 站点与预设

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/presets` | 全局类型/媒介/分辨率/优惠/限制/站点模板 |
| GET | `/api/sites` | 站点列表 |
| POST | `/api/sites` | 添加站点 |
| DELETE | `/api/sites/:host` | 移除站点 |
| POST | `/api/sites/:host/restore` | 恢复移除的站点 |
| GET | `/api/site-def/:host` | 站点定义 |
| PUT | `/api/site-def/:host` | 保存站点定义 |
| GET | `/api/site-defs` | 全部站点定义摘要 |
| GET | `/api/site-config` | 站点配置 |
| PUT | `/api/site-config/:host` | 保存站点配置 |
| GET | `/api/credentials` | 凭据状态，只回 `hasCookie` |
| PUT | `/api/credentials/:host` | 保存 cookie 密文 |
| PUT | `/api/credentials/import` | 批量导入 cookie |

## 抓取

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/crawl/types/:host` | 该站已保存类型 |
| PUT | `/api/crawl/types/:host` | `{types: []}` 保存类型并重建分类 |
| GET | `/api/crawl/cats/:host` | 站点分类与选中状态 |
| PUT | `/api/crawl/cats/:host` | `{ids: []}` 保存分类 |
| GET | `/api/crawl/filters/:host` | 搜索筛选 |
| PUT | `/api/crawl/filters/:host` | `{selected: {medium, resolution, discount}}` |
| POST | `/api/crawl/filters/:host/detect` | 探测搜索页下拉 |
| GET | `/api/crawl/plan` | 只读抓取计划 |
| GET | `/api/crawl/status` | 抓取状态 |
| POST | `/api/crawl/run` | 跑一轮抓取 |

## 队列与词条

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/queue` | 队列列表与计数 |
| POST | `/api/queue` | 新增条目 |
| GET | `/api/queue/:id` | 单条详情 |
| POST | `/api/queue/:id/action` | `approve / reject / publish` |
| POST | `/api/queue/:id/prepare` | 整理发布资料 |
| POST | `/api/queue/:id/check` | 本地查重 |
| POST | `/api/queue/bulk` | 批量操作 |
| GET | `/api/catalog` | 词条库 |
| POST | `/api/catalog` | 新增词条 |
| POST | `/api/catalog/screen` | 批量初筛 |
| POST | `/api/catalog/check` | 本地查重 |

## 目标站与发布

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/targets` | 可用目标站 |
| POST | `/api/targets/:host/plan` | 发布计划 |
| POST | `/api/targets/:host/upload` | 真发布 |
| POST | `/api/targets/:host/verify` | 回查 |
| POST | `/api/targets/:host/detect-form` | 识别上传表单 |
| GET | `/api/publish/preview` | 发布预览 |
| POST | `/api/publish/preview` | 预览指定条目 |
| GET | `/api/queue/:id/publish-preview` | 发布前检查 |
| POST | `/api/publish/:id` | 发布 |

## 调度

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/scheduler` | 调度状态 |
| PATCH | `/api/scheduler` | 修改调度配置 |
| POST | `/api/scheduler/run` | 跑一轮 |

## 其他

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/config` | 系统与用户配置 |
| PATCH | `/api/config/user` | 改用户配置 |
| GET/PUT | `/api/flow` | 流程规则 |
| GET | `/api/downloaders` | 下载器列表 |
| POST | `/api/downloaders` | 新增下载器 |
| PUT | `/api/downloaders/:id` | 修改下载器 |
| POST | `/api/downloaders/:id/test` | 探测 |
| GET | `/api/logs` | 日志 |
| GET | `/api/logs/stream` | SSE |
| GET | `/api/events` | 事件 |
| GET | `/api/failures` | 失败队列 |
| POST | `/api/failures/:id/replay` | 重放 |
| GET | `/api/maps` | 上传映射总表 |
| PUT | `/api/maps/:host` | 保存映射 |
| POST | `/api/maps/:host/detect` | 识别上传表单 |
| GET | `/api/notify` | 通知配置 |
| POST | `/api/notify/test` | 测试通知 |
| POST | `/api/meta/fetch` | 拉外部元数据 |
| POST | `/api/media/probe` | MediaInfo |
| POST | `/api/media/shots` | 截图 |

## 兼容

- 旧接口不删前先在 `DECISIONS.md` 记录原因和替换项。
- 同一功能不保留两套接口；新接口上线时旧接口同版本移除。
