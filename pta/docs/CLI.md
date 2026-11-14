# CLI 与 CLI-first（CLI）

状态：2026-11-17，v0.7.166。CLI 仍是 HTTP 客户端（后端必须先启动），但已支持 `prepare / preview / advance / run`；后续 G9 再把业务抽到 core，面板只做视图。

## 一、CLI 在哪

```text
pta/cli.js
```

两种跑法：

```bash
npm run cli -- status
# 或
node pta/cli.js status
```

当前 CLI 通过 `PTA_BASE` 访问运行中的后端，默认：

```text
http://127.0.0.1:8080
```

登录用环境变量，不写进命令、不写进仓库：

```bash
export PTA_USER='面板用户名'
export PTA_PASS='面板密码'
node pta/cli.js status
```

也可以直接给会话 cookie：

```bash
export PTA_COOKIE='pta_sid=...'
```

## 二、现在能做什么

| 命令 | 作用 | 默认 |
| --- | --- | --- |
| `status` | 版本、数据库、队列、调度状态 | 只读 |
| `queue` | 查队列条目 | 只读 |
| `crawl --site <host>` | 抓一个源站 | 干跑，`--real` 才真抓 |
| `screen` | 查重/筛选词条 | 本地 |
| `publish <queueId>` | 发布到下载器 | 干跑，`--real` 才真发 |
| `targets` | 列目标站定义与就绪状态 | 只读 |
| `target-upload <queueId> --host <target>` | 提交到目标站 | 干跑，`--real` 才真发 |
| `verify <queueId> --host <target>` | 发布后回查 | 只读 |
| `prepare <queueId>` | 生成单 release 的标题/副标题/简介/目标字段，落库到 queue | 本地，不发外部请求 |
| `preview <queueId>` | 返回完整准备结果，阶段推进到 previewed | 本地，不发外部请求 |
| `advance <queueId>` | draft → prepared → previewed 自动推进；后续提示用 target-upload/publish | 本地 |
| `run --stage prepared\|previewed` | 批量准备/预览可处理队列 | 本地 |

输出：

```bash
node pta/cli.js status --json
node pta/cli.js queue --status pending --limit 20
```

## 三、现在的限制

- CLI 只是 HTTP 客户端：必须先起 `node pta/server/app-fastify.js` 或 systemd 服务。
- `prepare` / `preview` / `advance` / `run` 已实现，但只做本地准备和预览；`advance` 到 previewed 后会提示用 `target-upload` / `publish` 做提交和注入。
- 还没有独立的 `inject` 命令。
- 抓取/发布仍受服务端 `realCrawl` / `realPublish` 开关约束。
- 业务逻辑还在 Fastify 路由里，CLI 不能脱离 HTTP 跑。

## 四、G9：CLI-first 核心层

目标：抓取、查重、数据、发布、验证全部可用 CLI 驱动；面板只是调用同一套核心服务的视图。

```text
pta/core/           纯业务服务：crawl / screen / queue / prepare / publish / target / inject
   ↑        ↑
CLI        Fastify 路由（面板）
   ↑
SQLite + data/
```

### 命令契约（目标）

```bash
pta status
pta crawl --site <host> --limit 100 [--real]
pta screen --limit 50 [--host <host>]
pta queue --stage <stage> [--json]
pta prepare <queueId>              # 准备单 release：元数据/媒体/简介
pta preview <queueId>              # 输出最终 payload
pta publish <queueId> [--real]     # 提交/注入
pta target-upload <id> --host <h> [--real]
pta verify <id> --host <h>
pta advance <id>                   # G7：推进一个阶段
pta run --stage <stage>            # 批量推进可执行阶段
```

规则：

- 默认干跑；`--real` 才真抓/真发。
- `--json` 输出机器可读结果；失败用非 0 退出码。
- 不打印 cookie、密码、passkey、IP。
- 每个命令幂等；G7 的阶段状态落 SQLite。
- 面板和 CLI 不复制业务逻辑，只做输入/输出适配。

### 已实现（0.7.166）

- `POST /api/queue/:id/prepare`、`GET /api/queue/:id/preview`、`POST /api/queue/:id/advance`、`POST /api/release/run`
- queue 条目新增 `stage`：`draft / prepared / previewed / submitted / injected / failed`
- 默认不提交、不注入；提交继续走现有 `target-upload` / `publish`

### 验收

- 在临时数据库上只用 CLI 跑通：crawl → screen → prepare → preview → publish（mock）。
- 不启动浏览器、不点页面。
- 面板调用同一核心服务后，现有 smoke 21/21、responsive 32 项仍通过。
- 重启后可续跑，不重复提交。

## 五、为什么不是“两套代码”

面板和 CLI 都只是入口：

```text
CLI  ─┐
      ├─→ core services → SQLite / 站点 / 下载器
面板 ─┘
```

以后要加 HTTP API、Telegram、定时任务，也都调 core，不再把逻辑写进页面或路由。
