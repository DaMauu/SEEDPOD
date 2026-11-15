# CLI 与 CLI-first（CLI）

状态：2026-11-17，v0.7.171。CLI 默认直接读本地 SQLite（不要求先起后端）；设置 `PTA_BASE` 或加 `--http` 才走 HTTP。核心命令已复用 `pta/core/` 与 server 模块。

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

默认直接读本地数据，不需要起后端：

```bash
PTA_DATA=/opt/seedpod/data node pta/cli.js status
```

也可以设置 `PTA_DATA` 环境变量，或让 CLI 使用默认 `data/`。

要走 HTTP（旧方式/远程调用）时：

```bash
export PTA_BASE='http://127.0.0.1:8080'
export PTA_USER='面板用户名'
export PTA_PASS='面板密码'
node pta/cli.js status
```

或者加 `--http`，同样需要 `PTA_BASE` 和登录环境变量。

## 本地 CLI 读生产数据

如果面板由 systemd/Docker 用独立密钥文件启动，CLI 必须带同一份环境，否则会按 `data/.secret` 规则找 key，可能生成错误的本地 key：

```bash
sudo env PTA_DATA=<数据目录> node pta/cli.js clients --test --env-file <部署 env 文件>
```

`--env-file` 只补未设置的变量，不覆盖当前 shell 已导出的值；不会打印密钥、密码或 URL。

## 二、现在能做什么

| 命令 | 作用 | 默认 |
| --- | --- | --- |
| `status` | 版本、数据库、队列、调度状态 | 只读 |
| `queue` | 查队列条目 | 只读 |
| `crawl --site <host>` | 抓一个源站 | 干跑，`--real` 才真抓 |
| `screen` | 查重/筛选词条 | 本地 |
| `publish <queueId>` | 发布到下载器 | 干跑，`--real` 才真发 |
| `targets` | 列目标站定义与就绪状态 | 只读 |
| `target-upload <queueId> --host <target> [--targets h1,h2] [--torrents h1=file,h2=file] [--announce h1=url,h2=url] [--fetch-published]` | 提交到目标站；`--torrents` 每站种子，`--announce` 清洗 announce，`--fetch-published` 额外校验发布后种子 | 干跑，`--real` 才真发 |
| `target-delete <id|detailsUrl> --host <target>` | 删除目标站种子，原因默认“其他/测试” | 干跑，`--check` 只查状态，`--real` 才真删 |
| `crossseed <queueId> --host <target> [--downloader id]` | 发布成功后把权威种子加进 qB，跳过校验；要求源种已下载完成 | 干跑，`--real` 才加 |
| `target-announce --host <target>` | 列目标站 announce 候选来源/类型，不回明文 | 只读 |
| `verify <queueId> --host <target>` | 发布后回查 | 只读 |
| `prepare <queueId>` | 生成单 release 的标题/副标题/简介/目标字段，落库到 queue | 本地，不发外部请求 |
| `preview <queueId>` | 返回完整准备结果，阶段推进到 previewed | 本地，不发外部请求 |
| `advance <queueId>` | draft → prepared → previewed 自动推进；后续提示用 target-upload/publish | 本地 |
| `run --stage prepared\|previewed` | 批量准备/预览可处理队列 | 本地 |
| `clients [--test]` | 列下载器；`--test` 只读探测 qB/watch 连通性 | 只读 |
| `coverage [--list] [--plan]` | 离线统计目标站定义/cookie/上传/回查就绪数；`--plan` 逐站生成上传 payload | 只读，不联网 |
| `probe [--all] [--limit 20] [--hosts h1,h2] [--write]` | 对有 cookie 的目标站各 GET 一次上传页，解析字段/分类/缺失项；`--write` 写 `data/site-probe.json` | 只读，不提交 |

输出：

```bash
node pta/cli.js status --json
node pta/cli.js queue --status pending --limit 20
node pta/cli.js clients --test
node pta/cli.js coverage --json --plan
```

## 三、现状

- 默认本地模式：CLI 直接打开 SQLite 和 `data/`，不要求 HTTP。
- HTTP 模式仍保留：`PTA_BASE` 或 `--http`；适合远程/面板联调。
- `prepare` / `preview` / `advance` / `run` 已实现；`advance` 到 previewed 后提示用 `target-upload` / `publish` 提交/注入。
- `target-upload` 的提交逻辑由 `pta/server/target-service.js` 提供，HTTP 路由和 CLI core 共用。
- `realCrawl` / `realPublish` 仍默认关；本地 CLI 也受同一门禁。
- 还没有独立 `inject` 命令；也没有完全把 crawl/dupe 路由收成 core thin adapter。

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
pta clients [--test]
pta coverage [--list]
pta crawl --site <host> --limit 100 [--real]
pta screen --limit 50 [--host <host>]
pta queue --stage <stage> [--json]
pta prepare <queueId>              # 准备单 release：元数据/媒体/简介
pta preview <queueId>              # 输出最终 payload
pta publish <queueId> [--real]     # 提交/注入
pta target-upload <id> --targets h1,h2 --torrents h1=a.torrent,h2=b.torrent --real
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

### 多目标（0.7.174）

```bash
pta prepare <queueId> --targets h1,h2
pta preview <queueId>
pta target-upload <queueId> --targets h1,h2 --torrent ./test.torrent
```

逐站干跑；单站失败只标该站，不阻断其他站。真正的多站提交和面板多选还在 G10 进行中。

### prepared 上传（0.7.172）

- `prepare` 的标题/副标题/简介/目标字段会作为上传计划传给 `target-upload`
- `preview` 输出完整 `payload`（含目标 URL/字段、截图数、种子摘要）
- `target-upload` 默认干跑；`--real` 才提交

### 阶段与幂等（0.7.170）

- queue 的 `stage`：`draft / prepared / previewed / submitted / injected / failed`
- `stageAttempts` / `stageLastError` / `stageNextRetryAt` / `stageEvidence` / `stageHistory`
- `advance` 只推进本地一步；`target-upload` / `publish` 会写 submitted / injected
- 重复提交/注入会被 409 或 skipped 拦住

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
