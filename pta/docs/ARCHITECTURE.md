# 项目架构（ARCHITECTURE）

状态：2026-11-24 定稿。改结构前先改本文件，并加一条 `DECISIONS.md`。

当前进度：`features/sites`、`features/presets`、`features/crawl`、`features/screen`、`features/queue`、`features/catalog`、`features/logs`、`features/settings`、`infra` 已收口；其余功能仍在 `server/` 根下，按功能继续搬。

## 三块

```text
pta/
├── server/   后端：唯一运行进程
├── web/      前端：构建成静态文件
└── docs/     文档：不参与运行
```

三块之外不新增顶层目录。

## 目录

```text
pta/server/
├── src/
│   ├── main.js                 入口：装配、注册路由、启动调度
│   ├── features/               一个功能一个目录
│   │   ├── auth/               面板登录、会话
│   │   ├── sites/              站点定义、启停、cookie 引用
│   │   ├── presets/            全局类型/选项/字段模板
│   │   ├── crawl/              列表抓取、翻页、入库
│   │   ├── screen/             初筛
│   │   ├── dedupe/             本地/跨站查重
│   │   ├── queue/              待审条目、状态流转
│   │   ├── publish/            目标计划、提交、回查、辅种
│   │   ├── scheduler/          定时触发
│   │   ├── catalog/            词条库
│   │   ├── downloaders/        qB 配置与探测
│   │   ├── media/              截图、MediaInfo、图床
│   │   ├── notifications/      Telegram / webhook
│   │   ├── settings/           全局配置
│   │   └── logs/               事件与 SSE
│   ├── infra/                  跨功能技术能力
│   │   ├── db.js
│   │   ├── config.js
│   │   ├── log.js
│   │   ├── json-file.js
│   │   ├── upload-lock.js
│   │   ├── secretbox.js
│   │   ├── repositories/
│   │   ├── adapters/           站点引擎
│   │   ├── clients/            下载器
│   │   └── sidecar/
│   └── shared/                 跨功能契约
│       ├── errors.js
│       └── result.js
├── migrations/                 唯一认识旧格式的地方
├── pack/                       分发的模板
├── fixtures/                   后端测试夹具
├── checks/                     后端与跨项目检查
├── scripts/                    构建/迁移/备份
├── cli.js
└── data/                       本地开发数据，gitignore
```

```text
pta/web/
├── src/
│   ├── App.vue
│   ├── main.js
│   ├── api/                    每个后端功能一个文件
│   ├── pages/                  七个页面
│   ├── features/               页面内业务组件
│   ├── components/             纯展示组件
│   ├── styles/
│   └── utils/                  只放格式化
├── shared/                     rule-registry.json
├── public/
├── checks/                     UI 检查与截图基线
├── vite.config.js
└── dist/                       构建产物
```

```text
pta/docs/
├── ARCHITECTURE.md
├── API.md
├── SITE-JSON.md
├── DECISIONS.md
├── DELIVERY.md
├── QUALITY.md
└── history/
```

## 依赖方向

```text
web ──HTTP──→ server
server/src/features ──→ server/src/infra
server/src/features ──→ server/src/shared
server/src/infra ──→ server/src/shared
docs → 不依赖代码
```

禁止：

- `web` import `server` 源码。
- `features/x` import 其他 feature 的 `repository.js` 或 `routes.js`。
- `features/*` 直接用 `fs`、`node:sqlite`、`fetch`。
- `routes.js` 里做字段归一化或业务判断。
- `shared/` 当杂物间。

## 数据归属

| 数据 | 唯一写入者 |
| --- | --- |
| `data/sites.json` | `features/sites/repository.js` |
| `data/site-urls.json` | `features/sites/repository.js` |
| `data/presets.json` | `features/presets/repository.js` |
| `data/cookies.json` | `features/sites/credentials.js` |
| `seedpod.db` 队列表 | `features/queue/repository.js` |
| `seedpod.db` 词条表 | `features/catalog/repository.js` |
| `seedpod.db` 发布表 | `features/publish/repository.js` |
| `seedpod.db` 日志表 | `features/logs/repository.js` |
| `pack/*.json` | 构建脚本 |

数据库可以共用一个文件，但每张表只有一个功能写。

## 变更规则

新增字段：

```text
features/<name>/model.js
migrations/
docs/SITE-JSON.md
往返测试
```

新增接口：

```text
features/<name>/routes.js
docs/API.md
契约测试
```

新增目录：

```text
先写 DECISIONS.md
再加到 checks/architecture.js 白名单
```

## 验收

`run.sh` 必须包含：

```text
architecture.js   依赖方向、IO 边界、目录白名单
schema.js         字段往返、保存不丢字段
api-contract.js   路由与 API.md 一致
```

六条硬约束：

1. `features/*` 无 `fs` / `node:sqlite` / `fetch`。
2. `routes.js` 无文件、SQL、归一化。
3. 只有 `infra/repositories` 写数据文件。
4. 旧格式只在 `migrations/`。
5. 保存站点后未知字段仍在。
6. `web` 不读业务 JSON。
