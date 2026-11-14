# 路线图：问题 / 需求 / 未来 / 待做

基于 0.7.81 的代码走查与线上实测。问题明细见 `PROBLEMS.md`，验收标准见 `DELIVERY.md`。

## 一、问题（现在存在的）

| 级别 | 问题 | 一句话 |
| --- | --- | --- |
| P0 | 禁转/限转不参与筛选 | 抓取写空 marks，送审不看，合规风险 |
| P0 | ✅ 分类不轮转 | 0.7.85 已修：到底轮转、末类回第一类 |
| P0 | ✅ 每日上限退化成每小时 | 0.7.86 已修：服务端硬顶 20/站/天 |
| P0 | 发布只记账 | 没有 qB `add torrent` |
| P0 | 30+ 空开关 | 首跑 59/67 规则在 v2 零命中 |
| P0 | 登录无限速/锁定 | 可暴力试密码 |
| P0 | 会话在内存、cookie 无 Secure | 重启掉线，HTTP 可截 |
| P0 | 密钥与数据同目录 | 拿到数据目录等于拿到密钥 |
| P1 | 没有调度器 | 抓取/送审/发布全靠人点 |
| P1 | ✅ 旧 web 已归档 | `pta/web` 只放 dist；旧 demo 在 `pta/archive/web-demo` |
| P1 | ✅ Docker 已两阶段 | CMD `app-fastify.js`，构建阶段 `npm run build` |
| P1 | 多目标站/图床/截图来源未接 | 页面像能用，实际没接 |
| P2 | ✅ smoke-live 20/20 | 旧 smoke/audit 已标 legacy |
| P2 | 规则体检只报告不拦 | 空开关能继续进 |
| P2 | ✅ 旧 `pta/web` 已归档 | 0.7.110 移到 `pta/archive/web-demo` |
| P2 | 面板密码未轮换 | 旧值已进 git 历史 |
| P2 | `ocbot` sudo 全开 | 等于 root |
| P2 | 文档还写“零依赖/假数据” | 误导接手者 |

## 二、需求（已确认）

1. **产品**：个人 PT 转载/交叉做种面板，单机、单用户。
2. **后端**：Node.js 22 + Fastify 5 + SQLite，入口 `app-fastify.js`。
3. **前端**：Vue 3 + Vite + SFC，线上服务 `pta/web/dist`。
4. **交付**：Docker 一键部署，数据卷 `/data`，备份/恢复有文档。
5. **主流程**：导入 cookie → 抓取 → 查重 → 送审 → 队列 → 真发布 → 校验。
6. **规则**：页面每个开关服务端必须有读者；没有就删、禁用或标“未接”。
7. **安全**：站点凭据只存密文，接口只回 `hasCookie`；面板登录独立，登录限速/锁定/会话落库/密钥分离。
8. **开发**：Linux 为准，不碰真实站，检查全绿才提交，一页一提交。

## 三、未来（落地之后）

- 调度自动化：定时抓取/送审/发布，可暂停恢复，失败有通知与记录
- 真发布 + 发布后校验：qB `add torrent`，目标站核对标题/分类/截图
- 多目标站、图床、截图来源：先做成能兑现的少数几个
- 规则三档预设：简洁/标准/严格，减少 60 多条单独开关
- 任务历史与可观测性：每次抓取/发布一条记录，能查到失败原因
- 适配更多站点引擎：NexusPHP / UNIT3D / Gazelle 之外的通用适配

不做：多用户、多机、K8s、移动端、换框架/数据库/前端 UI 库。

## 四、待做（按里程碑）

### M1 · 规则与正确性

- [x] 抓取写入禁转/限转 marks，送审先拦
- [x] `catIdx` 到底后轮转，page 归零
- [x] 每日上限服务端硬顶，界面只能调低
- [x] 67 条规则逐条分诊：保留 8 / 标未接 50 / 删除 9（见 RULES-TRIAGE.md）
- [x] 按分诊表改 data.js + 界面禁用/删除
- [x] 分诊后 `audit-rules.js --fail` 进闸门

### M2 · 发布与调度

- [x] qB `add torrent` 真发布，dryRun 只演练
- [x] 发布后校验 qB（infohash/state/verified）
- [ ] 目标站提交与发布后校验（表单适配，下一步）
- [x] 调度器 + 暂停/恢复 + 失败记录

### M3 · 安全与部署

- [x] 登录限速与失败锁定
- [x] 会话落库
- [x] cookie Secure（env 或 X-Forwarded-Proto 触发）
- [x] 密钥与数据分离（`PTA_SECRET_FILE`）
- [x] Docker 两阶段构建 + compose 验证

### M4 · 收尾

- [x] 七个页面全部拆进 SFC（0.7.101–0.7.109）
- [x] smoke 重写为 smoke-live（dist + 临时后端，15/15）
- [x] 旧 `pta/web` 归档（0.7.110，`pta/archive/web-demo`）
- [ ] 面板密码轮换
- [ ] `ocbot` sudo 收窄
- [ ] 文档对齐（零依赖/假数据/旧后端注释）

## 五、需要作者拍板

1. **空开关保留哪些**：建议保留 8–10 条能立刻兑现的，其余删除或标未接。
2. **真发布默认开还是关**：建议默认关，验证通过后再开。
3. **调度频率**：建议 30–60 分钟一轮，单站每日上限由服务端硬顶。

行数不是验收标准；验收看 `DELIVERY.md` 七条。

## 六、对标 UA/upbrr（V2，七条交付之后）

目标不是“再做一个面板”，而是能替代 Upload-Assistant / upbrr 的第三个工具：面板 + 流水线 + CLI + Docker，clean-room 实现。

| 里程碑 | 内容 | 验收 | 依赖 |
| --- | --- | --- | --- |
| M5 | 元数据/命名/分类/简介 ✅ | 0.7.112：`parseRelease`/`buildNames` + `/api/meta/parse` + preview 接入；meta 11/11；TMDB/豆瓣仍待 key | TMDB key（用户提供） |
| M6 | MediaInfo/截图/图床/种子 ✅ | 0.7.113 模块 + 0.7.114 API + 0.7.116 队列页入口（media 7/7、media-api 6/6） | ffmpeg（已有）、mediainfo（可选） |
| M7 | 客户端抽象 ✅ | qB + watch + rTorrent + Deluge（0.7.121，clients 5/5、clients-ext 4/4，本地 mock） | 本地 mock |
| M8 | 站点提交适配 ✅ | 0.7.111：三引擎路径/字段骨架 + `data/site-pack.json` 覆盖；mock 上传/回查 target 6/6；队列页有“提交目标站” | 真实站名不入库 |
| M9 | CLI + Docker ✅ | 0.7.117：`pta` CLI 支持 status/queue/crawl/screen/publish/targets/target-upload/verify，默认干跑；cli 7/7；Docker 两阶段已有 | 现有后端 |
| M10 | 通知/重试 ✅ | 0.7.118 Telegram 通知 + 0.7.119 failed 重试（notify 7/7、clients 5/5） | M8 |

工具现状：`ffmpeg/ffprobe` 已有；`mediainfo`、`mkbrr` 未装（可不装，用 ffprobe + 自写 bencode）。真实站配置一律不入库。

