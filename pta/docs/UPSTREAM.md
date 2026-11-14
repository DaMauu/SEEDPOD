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
- 我们的决定：引擎只给默认路径和字段骨架，`data/site-pack.json` 的 `upload` 覆盖；先干跑出字段，真提交受 `realPublish` 约束；用本地 mock 上传页做夹具，不碰真实站。
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
- 决定：`meta-ext.js` 两个 provider，失败回退本地标题解析；mock 夹具测试，不拿真实数据写死。

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
