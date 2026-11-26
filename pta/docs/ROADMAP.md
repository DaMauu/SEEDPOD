# 路线图：问题 / 需求 / 未来 / 待做

最后更新：2026-11-24（v0.7.672）。当前清单只看这一节；下面是 0.7.161 的历史路线图。

## 总开发清单（按功能，2026-11-24）

状态：`[x]` 已完成，`[ ]` 待做或未验证；带「阻塞」的需要 cookie、权限或拍板。

### 1. 面板（完成，待小修）

- [x] 七个页面 SFC：Dashboard / Sites / Crawl / Queue / Sources / Logs / Settings
- [x] 登录、路由、顶栏、Toast、Confirm、页脚在 `App.vue`
- [x] 桌面和手机共用一套 Vue 代码；360 / 390 / 768 / 1280 验收
- [x] UI 冻结检查进 `run.sh`
- [x] 站点详情按新 `sites.json` 显示（发布分类只读，识别后自动保存）

### 2. 抓取（代码完成，覆盖不足）

抓取“完成”按单站算，不按代码算。一个站要同时过：

- [ ] cookie 可读
- [ ] 搜索页 HTTP 200，不是登录页
- [ ] 列表解析出 >0 条
- [ ] 分类 ID 与站点绑定一致
- [ ] 详情至少 1 条能解析
- [ ] 入库后 site / cat / title 正确

当前：52PT 已在 0.7.674 做单页列表烟测（HTTP 200、11 个分类、解析 100 条），详情/入库未复测；BTSCHOOL / 猫测试站仍是 0.7.668 前历史证据；1 站有 cookie；297 站缺 cookie。

- [x] 识别：NexusPHP 分类链接/下拉框、Unit3D 复选框/Livewire、参数名
- [x] URL 拼装、分页、间隔、每日上限、详情、下载链接、限制标签
- [x] 批量识别脚本：串行、10 秒间隔、失败即停、冲突 ID 跳过
- [x] 历史真实抓取：52PT / BTSCHOOL 各 100 条、入库 5；猫测试站 37 条、入库 5
- [ ] 0.7.669 格式迁移后逐站抓取烟测
- [ ] 搜索分类覆盖：95 / 306 站；发布分类覆盖 109 / 306 站；上传表单覆盖 6 / 306 站
- [ ] 297 站补 cookie（阻塞：没有 cookie 无法识别）
- [ ] 7 站手工补分类（5 个搜索页无分类 + 2 个 Unit3D）
- [ ] Unit3D Livewire 真实站复测
- [x] DreadVault 搜索 4 类、上传 29 字段（2026-11-25 真页写入）
- [x] 52PT 新格式抓取回归：列表 100、详情 1/1、入库 100（临时库，2026-11-25）
- [x] 猫站 新格式抓取回归：列表 100、详情 1/1、入库 100（临时库，2026-11-25）
- [x] BTSCHOOL 新格式抓取回归：列表 100、详情 1/1、入库 100（临时库，2026-11-26）

### 3. 筛选 / 查重（基本完成）

- [x] 初筛：类型 / 媒介 / 分辨率 / 限制；规则体检 35/35
- [x] 查重：目标站搜索、标题匹配
- [x] 队列：待审 / 通过 / 拒绝 / 发布 / 失败
- [ ] 失败路径和边界压测（G12 当前 60%）

### 4. 发布（主链路完成，未完全验收）

- [x] 上传表单、分类映射、回查、辅种、失败重试
- [x] 定时发布，可停
- [ ] 多目标站真实发布扩到 10 站（阻塞：缺有上传权限的目标站）
- [ ] 发布失败恢复压测

### 支撑项（安全 / 数据 / 质量）

- [x] 站点凭据只存密文，接口只回 `hasCookie`
- [x] 面板账号密码只放环境变量，不入库
- [x] 登录限速 / 锁定、会话落库、cookie Secure
- [x] 密钥与数据分离；URL 守卫拦内网 / 重绑定
- [x] `sites.json` 块状格式 + 旧结构自动迁移
- [x] 备份 / 恢复脚本与演练；原子写 + `.bak` + 写入锁
- [x] 全量 `run.sh`：349 文件，质量审计 100
- [x] Docker + compose，数据卷 `/data`；deploy.sh + systemd + 健康检查
- [ ] 面板密码轮换（旧值进过 git 历史）
- [ ] 生产 sudo 收口（当前 ocbot sudo 全开）
- [ ] 文档收口：`pta/docs/INDEX.md` + 历史报告归档
- [ ] 发版后 24 小时观察清单

## 当前优先级（2026-11-24）

### P0 · 现在能推进

- [ ] 生成站点覆盖报告：每站 cookie / `search.type` / `publish.type` / `enabled`，输出本地 JSON，不打印站名。
- [ ] 文档收口：加 `pta/docs/INDEX.md`，分“现行 / 历史 / 自动生成”；历史报告移 `pta/docs/history/`。
- [ ] 批量识别补真实 Unit3D 站：等有 cookie 的 U3D 站，跑 `--run --write` 验证 `wire:model.live="categoryIds"` 识别。

### P1 · 需要数据或权限

- [ ] 补 cookie：297 站没有 cookie；补一批，跑一批批量识别。
- [ ] 手工补分类：5 个搜索页无可用分类 + 2 个 Unit3D 站。
- [ ] 真实抓取回归：52PT / BTSCHOOL 各抓 1 页，确认新 `sites.json` 下 URL 和分类仍对。

### P2 · 需要拍板

- [ ] 面板按新结构显示/编辑：`/api/site-def` 现在仍回旧 `cats/catMap`；改成 `meta/search/publish/settings` 会动 `SiteDetail.vue` 和接口，需明确是否解冻 UI。
- [ ] 调度/发布主流程：G12 仍 60%，缺有上传权限的目标站和真实 cookie。

---

## 历史路线图（基于 0.7.161）

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
| P1 | ✅ 旧 web 已删除 | `pta/web` 只放 dist；旧 demo 已删除 |
| P1 | ✅ Docker 已两阶段 | CMD `app-fastify.js`，构建阶段 `npm run build` |
| P1 | 多目标站/图床/截图来源未接 | 页面像能用，实际没接 |
| P2 | ✅ smoke-live 21/21 | 旧 smoke/audit 已删 |
| P2 | 规则体检只报告不拦 | 空开关能继续进 |
| P2 | ✅ 旧 `pta/web` 已删除 | 0.7.128 删除 |
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

不做：多用户、多机、K8s、独立移动站/两套前端、换框架/数据库/前端 UI 库。响应式一套代码是长期要求，见 `pta/docs/RESPONSIVE.md`。

## 四、待做（按里程碑）

### M1 · 规则与正确性

- [x] 抓取写入禁转/限转 marks，送审先拦
- [x] `catIdx` 到底后轮转，page 归零
- [x] 每日上限服务端硬顶，界面只能调低
- [x] 67 条规则逐条分诊：保留 8 / 标未接 50 / 删除 9（见 `pta/docs/history/RULES-TRIAGE.md`）
- [x] 按分诊表改 `src/data/rules.js` + 界面禁用/删除
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
- [x] 八个页面完成页面级 scoped（0.7.148–0.7.158）
- [x] 全局 `.view[data-view=...]` 页面选择器清零（0.7.161）
- [x] smoke 重写为 smoke-live（dist + 临时后端，15/15）
- [x] 旧 `pta/web` 已删除（0.7.128）
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
| M5 | 元数据/命名/分类/简介 ✅ | 0.7.112 本地解析 + 0.7.124 外部元数据（无 key Wikipedia、有 key TMDB）；meta 11/11、meta-ext 5/5 | TMDB key（用户提供） |
| M6 | MediaInfo/截图/图床/种子 ✅ | 0.7.113 模块 + 0.7.114 API + 0.7.116 队列页入口（media 7/7、media-api 6/6） | ffmpeg（已有）、mediainfo（可选） |
| M7 | 客户端抽象 ✅ | qB + watch（0.7.188 移除 rTorrent/Deluge；clients 7/7，本地 mock） | 本地 mock |
| M8 | 站点提交适配 ✅ | 0.7.111 三引擎骨架 + 0.7.122 面板添加站点/上传定义；mock target 6/6 | 真实站配置存 data/，不进仓库 |
| M9 | CLI + Docker ✅ | 0.7.117：`pta` CLI 支持 status/queue/crawl/screen/publish/targets/target-upload/verify，默认干跑；cli 7/7；Docker 两阶段已有 | 现有后端 |
| M10 | 通知/重试 ✅ | 0.7.118 Telegram 通知 + 0.7.119 failed 重试（notify 7/7、clients 5/5） | M8 |

工具现状：`ffmpeg/ffprobe` 已有；`mediainfo`、`mkbrr` 未装（可不装，用 ffprobe + 自写 bencode）。

## 七、M11 · 站点包与自动化（2026-11-16 定）

目标：默认自动化，用户只处理例外。站点怎么搜、分类怎么对、上传字段怎么填，提前存进站点包；运行时直接用。

- 站点包随程序发布：仓库/镜像带 `pta/pack/site-pack.enc`，用户不下载、不导入。
- 仓库只放 AES-256-GCM 密文；密钥只放部署环境变量 `PTA_SITE_PACK_KEY`，安装时配置一次。
- 私有 `data/site-defs` / `data/site-pack.json` 优先覆盖内置包；缺密钥回退私有定义并提示。
- 包内容：host/base/引擎、搜索路径/参数、分类表、上传表单、回查路径；不含 cookie/密码/账号/IP。
- 自动化路径：预计算分类和字段；高置信度直接用；低置信度/页面改版才进例外队列，确认一次后存档。
- 生成器离线跑，不抓真实站；`--dry` 先出覆盖率与例外数，不打印站名/网址。
- 验收：`site-pack` 检查进 `run.sh`（roundtrip、篡改失败、缺密钥回退、私有覆盖、密文无明文 host）。

详细设计见 `pta/docs/SITE-PACK.md`；密钥决策见 `pta/docs/DECISIONS.md` D16。

状态（2026-11-18）：加载器、生成器、检查、第一版密文包、target/crawl 接入、`/api/dev` 状态、站点页站点包/覆盖入口已完成；分类规则 80%+ 仍待做。

## 八、M12 · 响应式布局（2026-11-17 定）

目标：一套 Vue 代码同时服务桌面和手机；允许组件级换布局，不做独立移动站或两套前端。

- 统一断点：≤600 手机、601–900 平板、901–1319 桌面窄屏、≥1320 宽屏。
- 验收宽度：360 / 390 / 768 / 1280；新增页面加 1440。
- 页面专属规则进 SFC scoped；页面外层 `.view` 用 `:global`；子组件用 `:deep`。
- 小屏规则：列表整页滚、筛选两列网格、卡片同宽、按钮不压缩、徽标贴右、长标题换行。
- 自动化：把横向滚动/按钮溢出检查接进 `run.sh`，用空数据、长标题、305 站做固定样本。

状态（2026-11-17）：八页 scoped、页面外框清零、360/390 小屏修复完成；R2 自动检查已接入 `run.sh`（`responsive-layout.js`，8 页 × 4 宽度）。规范见 `pta/docs/RESPONSIVE.md`。

## 九、M13 · 原生上传工作流（G7/G8，2026-11-17 定）

目标：SEEDPOD 自己完成单 release 的上传准备和站点提交，不接 UA/upbrr，也不调用它们的 CLI。

- G7 发布状态机：`source → metadata → rules → dupe → media → preview → submitted → injected`，阶段落 SQLite，幂等、可恢复、可重试。
- G8 原生上传：ffprobe/可选 BDInfo、截图、命名/简介、站点包规则、查重证据、预览、multipart 提交、回查、客户端注入。
- 仍然单进程 + SQLite；不引入 Redis / 消息队列 / 独立 worker / Postgres。
- 真实提交依赖 G5 的站点权限和真实 daemon；之前用本地 mock 固定样本。
- 验收：mock 全链路 + 一次授权真实发布；不重复提交；不复制 UA/upbrr 代码/配置/品牌。

详细 goal 卡见 `pta/docs/GOALS.md`。

## 十、M14 · CLI-first（G9，2026-11-17 定）

目标：抓取、查重、数据、发布、验证都能用 CLI 驱动，面板只做视图。

- 抽 `pta/core/` 服务层；CLI 和 Fastify 路由共用。
- 命令覆盖 crawl / screen / queue / prepare / preview / publish / target-upload / verify / advance / run。
- 默认干跑，`--real` 才真发；`--json` 可脚本化；失败非 0 退出。
- 不要求先起 HTTP；CLI 直接读 SQLite 和 data/。
- 验收：临时库只用 CLI 跑通 mock 全链路；面板 smoke/responsive 不回退。

状态（0.7.188）：`prepare / preview / advance / run` 已落地；在授权测试站完成真实抓取、查重、准备、提交和回查（测试种子需用户自行删除）；真实目标站/qB watch 和 core 抽取仍待做。命令契约见 `pta/docs/CLI.md`。

执行协议：`pta/docs/GOAL-RUNNER.md`；当前 goal 队列见 `pta/docs/GOALS.md`（G10 多目标发布）。

