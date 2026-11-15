# 对标上游：Upload-Assistant / upbrr

目标：做第三个可用的 PT 上传/转载工具，但**不是复制品**。学行为、学分层、学工程标准，不抄代码、品牌、内置 key 和站点配置。

## 一、许可边界（先看这个）

| 项目 | 许可 | 能做什么 | 不能做什么 |
| --- | --- | --- | --- |
| Upload-Assistant | UAPL v1.0（非 OSI） | 读文档、观察行为、写自己的实现 | 复制代码/配置/品牌/内置 key；做暗示官方衍生 |
| upbrr | GPL-2.0-or-later | 读文档/行为；如复制代码则整个项目需按 GPL 兼容并保留声明 | 直接搬代码却不遵守 GPL；搬品牌/站点配置 |
| SEEDPOD | GPL-3.0（根 LICENSE） | 独立实现，保持 GPL-3.0 | 把 UAPL 代码并进来 |

结论：**clean-room**。只记录“它怎么表现”，代码自己写；任何参考都写进本文件。

## 二、能力矩阵

| 能力 | UA | upbrr | SEEDPOD 现在 | 目标 |
| --- | --- | --- | --- | --- |
| 元数据/命名/分类 | 有 | 有 | 部分（标题照搬、分类映射） | M5 |
| 查重 | 有 | 有 | 有（本地/目标站部分） | M5 补全 |
| 截图/HDR/图床 | 有 | 有 | 无 | M6 |
| 种子创建/复用/fast resume | 有 | 有 | 只取源种 | M6 |
| 下载器 | qB/rTorrent/Deluge/watch/qui | qB | qB 添加+回查 | M7 |
| 站点提交 | 多站 | 多站 | 无 | M8 |
| 发布后校验 | 有 | 有 | qB 侧有 | M10 |
| CLI | 有 | 有 | 无 | M9 |
| Web UI | 有 | 有 | 有 | 保持 |
| Docker | 有 | 有 | 雏形未完成 | M9 |

## 三、可借鉴的行为与分层

- **上传流水线分层**：准备物料 → 校验 → 加客户端 → 提交站点 → 回查。我们按这个顺序拆模块。
- **元数据来源顺序**：先本地/源站，再外部库；失败回退，不猜。
- **截图管线**：生成、压缩、上传、失败重试；HDR 单独处理。
- **种子**：能复用就不重建；创建时去掉无用顶层目录。
- **客户端**：统一接口，qB 只是第一个；fast resume 比重新校验快。
- **站点适配**：配置与代码分离；用户自己提供适配，不内置真实站配置。
- **质量闸门**：提交前逐项校验，dry-run 默认，真操作显式打开。

## 四、禁止

- 复制上游源码、配置、模板、站点清单、品牌、内置 key。
- 在仓库/提交/回复里出现真实站名、域名、凭据。
- 把“页面有开关”当成“功能已实现”。

## 五、每次都要查、每次都要记

任何涉及**上传、元数据、截图、种子、客户端、站点适配**的改动，动手前：

1. 读本文件与上游文档/行为（UA wiki、upbrr docs、对应仓库）。
2. 在本文件末尾追加一条研究记录，格式：
   ```md
   ## YYYY-MM-DD · <主题>
   - 来源：<URL 或仓库/文件>
   - 观察到的行为：<三句话>
   - 许可/可用性：<能不能借鉴代码>
   - 我们的决定：<借鉴行为 / 自己实现 / 不做>
   ```
3. 能不用上游代码就不用；必须用时先过许可，保留声明。
4. 功能落地后补一条“我们怎么实现”的差异说明。

## 六、对标里程碑

- **M5** 元数据/命名/分类/查重补全
- **M6** MediaInfo/BDInfo、截图、图床、种子创建/复用
- **M7** 客户端抽象：qB 完成，补 rTorrent/Deluge/watch
- **M8** 站点提交适配框架（用户提供配置，不内置真实站）
- **M9** CLI + Docker 两阶段 + Web UI 对齐
- **M10** 发布后校验、通知、失败重试

## 七、差异定位（第三个工具靠什么站住）

- 面板优先：抓取、查重、队列、规则、审核在同一条流水线里
- 本地优先：SQLite、单进程、无外部服务
- 开箱即用：内置引擎适配（NexusPHP/UNIT3D/Gazelle）+ 自动表单识别；站点数据放 `data/` 私有包，用户不需要写代码
- 透明：每个开关都有服务端读者；没有就标未接并禁用
- 可恢复：dry-run、回滚、失败记录

## 八、研究记录

## 2026-11-14 · UA / upbrr 总览

- 来源：github.com/Audionut/Upload-Assistant、github.com/autobrr/upbrr、upbrr.com/docs
- 观察到的行为：UA 是 Python CLI + Web UI + Docker，覆盖 MediaInfo/BDInfo、截图、元数据、种子、客户端、站点提交；upbrr 是 Go + Web UI + CLI，定位“guided upload preparation”，支持从 UA 迁移配置。
- 许可/可用性：UA 为 UAPL（非 OSI，限制衍生/品牌/key）；upbrr 为 GPL-2.0-or-later。
- 我们的决定：clean-room 重写；先学流水线分层与校验顺序，不复制代码/配置/站名。

## 2026-11-15 · M8 目标站提交与回查

- 来源：NexusPHP `takeupload.php`、UNIT3D `/torrents/create`、Gazelle `/upload.php` 的公开表单结构；UA/upbrr 只读流水线分层与校验顺序，未取代码。
- 观察到的行为：三家引擎都是 multipart 表单；字段名和必填项因站而异；提交成功后返回详情页或跳转；回查通常用标题或 infohash 搜一次。
- 许可/可用性：不复制上游代码、表单配置或站名；字段映射由用户私有包提供。
- 我们的决定：引擎只给默认路径和字段骨架，`data/site-pack.json` 的 `upload` 覆盖；先干跑出字段，真提交受 `realPublish` 约束；用本地 mock 上传页做固定样本，不碰真实站。
- 我们怎么实现：`pta/server/target.js` 纯映射 + `routes-target.js` API；`pta/checks/target.js` 覆盖 NexusPHP 真提交与 UNIT3D/Gazelle 干跑（6/6）。

## 2026-11-15 · M5 标题解析与命名

- 来源：公开的 scene release 命名惯例与三家引擎的标题字段；未读 UA/upbrr 代码。
- 观察到的行为：标题里同时带片名、年份、季集、分辨率、来源、编码、音轨、HDR、制作组；年份也可能出现在片名里（Blade Runner 2049）。
- 许可/可用性：命名规则是事实性惯例，不复制代码；外部元数据（TMDB/豆瓣）需要用户 key。
- 我们的决定：先做确定性本地解析 + 生成规范名/副标题/简介；`/api/meta/parse` 暴露；TMDB/豆瓣等外部元数据以后单独接，不在这里猜。

## 2026-11-15 · M6 媒体探测/截图/种子

- 来源：ffprobe/ffmpeg 公开文档、bencode 规范；未复制 UA/upbrr 代码。
- 观察到的行为：ffprobe JSON 给流信息；截图按百分比取帧；HDR 需要 tonemap；种子是 bencoded 字典，infohash 是 info 字典的 SHA1。
- 许可/可用性：ffmpeg/ffprobe 是系统工具；bencode 是公开格式，自己实现。
- 我们的决定：纯本地模块，先做单文件种子；截图先落文件，API 层再按需转 data URL；不联网。

## 2026-11-15 · M7 客户端抽象（watch）

- 来源：qB API 公开文档、rTorrent/Deluge/Transmission 的 watch 目录约定；未复制上游代码。
- 观察到的行为：watch 客户端只需把 `.torrent` 原子写入监视目录；状态由外部客户端接管，面板拿不到 qB 那样的进度。
- 许可/可用性：目录约定是事实性接口，自己实现。
- 我们的决定：下载器加 `kind=qb|watch`；watch 写 0600 文件并标记 `verified=true/state=watch`，不假装能回查外部客户端状态。

## 2026-11-16 · 外部元数据（Wikipedia / TMDB）

- 来源：Wikipedia API、TMDB API 公开文档；UA/upbrr 只作流程参考，未取代码/配置/key。
- 观察：无 key 可用 Wikipedia 搜索+摘要；有 key 用 TMDB 搜索+详情+credits，能拿导演/演员/海报。
- 许可/可用性：公共 API；TMDB key 用户自己提供，不进仓库。
- 决定：`meta-ext.js` 两个 provider，失败回退本地标题解析；mock 固定样本测试，不拿真实数据写死。

## 2026-11-16 · 上传页路径与字段（clean-room）

- 来源：NexusPHP 开源实现（`upload.php` / `takeupload.php`）、UNIT3D 路由、Gazelle 上传页；只记录路径和字段结构，不复制代码、模板、语言包。
- 观察：
  - NexusPHP：GET 表单页是 `upload.php`，POST 提交是 `takeupload.php`；文件字段 `file`；必填 `descr`、`type`、`name`；副标题 `small_descr`；匿名是 `uplver=yes`（不匿名就不带这个字段）。
  - UNIT3D：表单和提交都在 `/torrents/create`，文件字段通常 `torrent`。
  - Gazelle：`/upload.php`，文件字段通常 `file_input`。
- 我们的决定：`formPath` 和 `path` 分开；NexusPHP 默认 `formPath=/upload.php`、`path=/takeupload.php`；`uplver` 用 `{anonymousYes}`，不匿名时值为空、字段不提交；站点定义的分类数组按 `purpose` 自动转成发布分类对象。识别仍只在用户点击时发一次只读 GET。

## 2026-11-17 · UA / upbrr 的“条件规则”怎么定义

- 来源：Upload-Assistant `data/example-config.py`（UAPL v1.0）、upbrr 官方文档 Configuration / Workflow / Trackers（GPL-2.0-or-later）；只读文档与示例配置，未复制代码、配置或品牌。
- UA：配置是一个 Python dict，`DEFAULT` 放全局选项，`TRACKERS` 放每站覆盖；条件主要是固定配置键和 CLI 参数，例如 `screens`、`min_successful_image_uploads`、`cutoff_screens`、`img_host_1..6`、`default_trackers`、`tracker_pass_checks`、`skip_auto_torrent`、`get_bluray_info`、`bluray_score`、`check_for_rules`、`skip_if_rehash`、`inject_delay`、`cross_seeding`。站点特有的校验和上传流程写在 tracker 类/代码里，不是用户可编辑的通用规则表达式。
- upbrr：运行时配置存 SQLite，YAML/JSON 只是导入导出格式；Settings 分 main / image hosting / metadata / screenshot / description / client / arr / torrent / post upload / logging / trackers。工作流分成 source → metadata → tracker 规则与资格 → 查重证据 → 媒体/简介 → 预览 → 提交 → 客户端注入；每个 tracker 的规则、问题、警告、staff token 由 tracker 集成定义，用户主要回答 tracker questions 或确认警告。
- 结论：两边都没有和 SEEDPOD 当前 40 条一一对应的“通用条件表”。UA 是“配置键 + per-tracker 代码”，upbrr 是“设置项 + tracker-owned rules + 工作流门禁”。SEEDPOD 的 40 条是面板层的 UI 抽象，分诊时应分三类：上游有直接对应、应交给 tracker/站点包自动处理、SEEDPOD 自己特有的产品规则。

## 2026-11-18 · G11 MediaInfo / BDInfo 解析

- 来源：MediaInfo 文本格式与 BDInfo 公开字段（Disc Title / Disc Size / Playlist / Video / Audio / Subtitle）；UA/upbrr 只作能力对照，未复制代码/配置。
- 观察：MediaInfo 是分段 `Key : Value`，BDInfo 是逐行 `Label: value`；音频/字幕可能有多条，不能只抓第一条。
- 决定：`mediainfo.js` 先识别格式再解析；摘要只取分辨率/编码/HDR/音轨/字幕/体积；原文默认包 `[quote]` 进简介；无法识别返回空 kind，不猜。
- 待做：截图转存图床并替换简介链接；客户端注入 dry run。

## 2026-11-18 · G11 图床转存与链接替换

- 来源：Pixhost/Imgbox 公开上传页与通用 multipart 图床接口；只做能力对照，未复制代码/配置。
- 观察：匿名图床返回值不统一（JSON / 纯文本 / HTML），不能假定单一字段；Pixhost/Imgbox 的实际上传响应尚未验证。
- 决定：`imagehost.js` 默认演练；真上传只开放已验证的 custom/local（`PTA_IMAGE_HOST_URL` / `PTA_IMAGE_HOST_FIELD` / `PTA_IMAGE_HOST_TOKEN`），逐张重试、失败隔离；简介只替换 data URL 并追加 `[img]` 链接。
- 待做：验证 Pixhost/Imgbox 实际响应字段；客户端注入 dry run。

## 2026-11-18 · G11 客户端注入 dry-run

- 来源：qBittorrent WebUI API、watch 目录约定；只做本地/模拟验证，不连真实下载器。
- 观察：qB 加种是 multipart `/api/v2/torrents/add`；watch 是原子写 `.torrent`；dry-run 只需给出 wouldAdd/wouldWrite、保存路径、hash、幂等和重试状态。
- 决定：`publisher.injectPlan` 统一 qB/watch/rtorrent/deluge 计划；真注入复用 `publishItem`；已 injected 直接 skipped；failed+stageFailedFrom=injected 标记 retry。
- 待做：真实 rTorrent/Deluge 环境仍由 G5 验证。

## 2026-11-18 · 产品范围：移除 rTorrent/Deluge

- 用户决定不再为 PTA 开发 rTorrent/Deluge 下载器兼容，产品只保留 qBittorrent + watch 目录。
- 移除 rtorrent.js / deluge.js / clients-ext 固定样本；下载器 API 旧类型返回 UNSUPPORTED_DOWNLOADER。
- 历史 M7 记录保留，但当前验收不再要求 rTorrent/Deluge；G5 改为真实目标站 + qB/watch。

## 2026-11-19 · 源种直传与目标站种子抓取

- 观察：部分 NexusPHP 站允许直接上传源站 `.torrent`，发布时由站点替换 announce/passkey；发布成功后的详情页提供目标站生成的种子下载链接。用户提到的 autofeed 一键转发也是这个行为，但代码/品牌不复制。
- 决定：默认“源种直传”；提交并回查成功后，解析详情页下载链接，抓取目标站生成的 `.torrent`，校验 infohash 不变，保存到 `data/torrents/`（0600），供后续 qB/watch 注入或跨站辅种。
- 未做：站点拒绝源种时的自动清洗 fallback。先把目标站种子抓回来；需要清洗时用 `--torrents` 手工给清洗种，或后续做 announce 替换器。
- 安全：目标种子含 passkey，只落私有 data，不进仓库、不打印；下载链接只允许同站域名，避免 cookie 外泄。

## 2026-11-19 · 自动清洗种子

- 目标：站点不自动替换源种 announce/passkey 时，提交前把 announce 换成目标站地址，保留 info 原始字节，infohash 不变，便于 qB 跨站辅种。
- 决定：新增 `torrent-clean` 纯函数；`target-upload --announce` 显式指定，或复用 `data/torrents/` 里已有目标站种子的 announce 自动清洗。announce/passkey 只在内存/临时文件，不写库、不打印。
- 未做：站点第一次上传、没有任何目标站种子可复用时的 passkey 自动发现；当前先源种直传，失败再人工给 `--announce`。

## 2026-11-19 · 禁止源种直传

- 源站 passkey 不应出现在目标站。目标上传前必须清洗 announce；找不到目标 announce 就失败，不回退源种。
- announce 自动发现顺序：已有目标站种子缓存 → usercp/个人页 passkey → 显式 `--announce`。
- 源种用于 qB 下载，目标站生成种子用于辅种；两类种子都保留在私有 `data/torrents/`。

## 2026-11-19 · announce 候选与目标站 tracker

- 观察：上传页可能给通用 tracker，也可能给带 passkey 的个人 tracker；不同站点不一样。发布成功后详情页下载的目标站种子才是最终权威。
- 决定：CLI 先收集候选（缓存目标种、上传页 tracker、usercp/passkey、显式 `--announce`），优先 passkey，generic 仅作兜底；接口只回来源/类型，不回明文。发布后抓目标站生成种子并用其 tracker 辅种。

## 2026-11-19 · 预生成目标种

- 观察：多数 NexusPHP 发布后的种子只是把 announce 换成目标站 passkey，info 不变；发布后再下载一次是多余请求。
- 决定：提交前直接生成目标种（源种 info + 目标 announce），源种和目标种都缓存 0600；qB 直接用目标种辅种。发布后默认不下载目标站种子，`--fetch-published` 仅做异常校验。

## 2026-11-19 · qB 多 tracker 与辅种

- 观察：qB 以 infohash 为种子唯一键，同 hash 再 add 副本不会成为第二个种子；跨站辅种应给现有种子追加目标 tracker。
- 决定：新增 qB `addTrackers`/`trackerStatus`；目标 tracker 来自预生成目标种，发布前可能返回未注册，发布后轮询 status=2 视为 working。

## 2026-11-19 · 提交前生成目标种

- 目标种在提交前生成：源种 info 不变，只换目标 announce/announce-list；源种和目标种都缓存 0600。
- 这样 qB 可以在下载完成后直接追加目标 tracker 辅种，不需要等发布后下载目标站生成种子。

## 2026-11-19 · 多目标查重与副本 tracker

- 多目标发布前逐站查重；已有同标题/同 infohash 的目标站标 `TARGET_EXISTS`，不生成副本、不发布。
- 副本 `.torrent` 内只保留目标站 announce，源站 tracker 必须替换掉；但 qB 以 infohash 为唯一键，同 infohash 不能作为多个独立种子。
- 若要求 qB 里 3 个独立条目、每条只带一个目标 tracker，必须改 `info`（如 name）导致 infohash 变化，并准备对应数据/重命名；否则只能一个种子挂多个目标 tracker（且移除源 tracker）。

## 2026-11-19 · 每站独立 infohash 与辅种模型

- 参考 cross-seed / ptool / xseed 资料：qB 以 infohash 唯一；同 hash 多 tracker 会造成统计串站/封号风险，不能当多份辅种。
- 私有站上传常改 `info.source`（部分还改 private/name）；`info` 变则 hash 变，qB 才能作为独立条目。
- 决定：只改 `info.source`/`info.private` 生成独立目标种，保留文件布局；`info.name` 改路径，需 hardlink/reflink 才能跳过校验，暂不自动改。
- 每站 source 值需从该站已有种子 diff 学习或配置；下一步做规则表和 link 目录。

## 2026-11-19 · 最终辅种方案：权威种子

- 放弃预生成副本；上传只清洗目标站通用 announce，发布成功后抓详情页权威种子。
- 权威种子加 qB 时 `skip_checking=true`，save path 复用源种；文件结构一致，不用硬链接。
- 同 infohash 的站不能加第二份，直接报错；不伪造、不串 tracker。
