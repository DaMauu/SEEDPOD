# 开发进度（PROGRESS）

最后更新：2026-11-15 13:40
当前 goal：**G10 多目标发布**
当前 goal 进度：**99%**（单目标真实全链路已通，多目标同发待验）
运行状态：**全部站点停用 · 调度关 · 真发布关 · 队列 0**
总进度：**11/15 完成；含进行中折算约 86%**

## 计算方式

- 当前 goal 进度：该 goal 的交付项完成比例，人工按验收项估算。
- 总进度：已完成 goal 计 1，进行中 goal 按当前百分比折算，未开始计 0；除以 G0–G14 共 15 个 goal。
- 百分比是估算，不是代码行数比例；验收通过才算完成。

## Goal 明细

| Goal | 名称 | 进度 | 说明 |
| --- | --- | --- | --- |
| G0 | 项目地基 | 100% | Node/Fastify/SQLite/Vue、站点包、检查、CLI、Docker |
| G1 | 响应式自动验收 | 100% | 8 页 × 4 宽度，32 项 |
| G2 | 可靠性债 | 100% | 空 catch 0、TODO 0、审计 87 |
| G3 | 拆 Sites.vue | 100% | Sites.vue 436 行；toolbar/stats/list/detail/modals |
| G4 | 40 条规则分诊 | 100% | 做 8、删 17、暂缓 15；规则 33/18/15，缺读者 0 |
| G5 | 真实环境验证 | 100% | 2 台 qB 在线；猫主站→猫测试站真实转载/发布/权威种子/skip_checking 辅种/tracker working/删除全通过；watch 未验 |
| G6 | 站点包例外 UI + Docker/备份 | 100% | 例外 UI、Docker compose、备份恢复演练 |
| G7 | 发布状态机 | 100% | submitted/injected 幂等、失败重试 |
| G8 | 原生单 release 上传 | 100% | prepared 字段接 target-upload |
| G9 | CLI-first 核心层 | 100% | 本地 CLI 12/12 |
| G10 | 多目标发布 | 99% | 单目标真实跨站全链路已通；多目标同发仍待验 |
| G11 | 上传准备 1:1 | 100% | MediaInfo/BDInfo、图床、链接替换、客户端注入演练、面板预览均已接 |
| G12 | 全自动流水线 | 40% | 补齐/终审/图片/标签/副标题/简介已接；多站自动流转待验 |
| G13 | 站点覆盖与验证 | 65% | 覆盖面板 + 批量探测 + 3 站真实证据；2 站 NO_FORM 待查 |
| G14 | Python sidecar | 0% | 可选，不阻塞 |

## 当前阻塞

- G10：多目标预检已补 cookie/字段/回查缺口，只缺 2–3 个有上传权限的目标站做真实提交。
- G5：2 台 qB 在线；真实种子跨站辅种已跑通（猫主站→猫测试站，skip_checking 辅种 + tracker working + 删除）；watch 目录外部客户端尚未验。
- G13：覆盖面板已接，177 个上传计划 dry-run 通过；3 个授权站真实上传/回查/删除通过，继续扩到 10 站。
- G12：依赖 G13，暂不可开。
- G14：可选，等明确 AI/OCR/pandas/Scrapy 需求。
- 没有可自动推进的 goal；需要用户给权限/环境或拍板后才能继续。

## 2026-11-15 副标题只搬源站 + 无 key 元数据（v0.7.220）

- 副标题不拼分辨率/体积，只用源副标题或中文名。
- 无 TMDB key 时走网页模式：豆瓣取海报/别名，Wikipedia 取简介；TMDB 网页有 Cloudflare，仅支持 API。
- meta 11/11、meta-ext 7/7、target 20/20、adapter 23/23。

## 2026-11-15 截图不设下限（v0.7.219）

- 截图门槛默认 0，不拦真发布；简介截图全部转载；需要时可手填。
- target 20/20。

## 2026-11-15 副标题与简介自动转载（v0.7.218）

- 副标题用源站副标题优先，缺 res/size 才补；标题解析与目标站同一套拼法。
- 详情页简介转 BBCode，截图全部保留不截断；送审时 subtitle/intro/tags/year 全带进队列。
- 详情页无简介时按「匹配来源顺序」走公开库（TMDB/Wikipedia），只在真抓取时联网。
- adapter 22/22、meta 11/11、target 20/20。

## 2026-11-15 目标站标签映射（v0.7.217）

- 站点包支持 `tagMap`/`tagValue`；上传计划自动勾国语/粤语/中字/英字/DIY，`禁转/官方/应求` 不自动勾。
- 条目无 `tags` 时从标题推断；计划输出 `tags`/`tagFields`，干跑可见。
- target 19/19；真实目标站展示待下次发布复核。

## 2026-11-15 真实种子跨站辅种跑通（v0.7.216）

- 真实源种 `2012 2009 BluRay 1080p x264 DD5.1 ISO-CMCT`（7.90 GB，BDInfo，41 做种）13 分钟下完。
- 猫测试站发布 + 回查通过；权威种子 `5a4749…` 与源种 `ba20db…` 不同，`crossseed` 以 `skip_checking=true` 复用 `/downloads` 加入 qB，tracker 状态 working，详情页 1 个做种者。
- 收口干净：目标站测试种已删、qB 任务与 8 GB 数据已删、`realPublish=false`、测试队列条目已删。
- qB 新增 `removeTorrent`、`resumeTorrent`/`stopTorrent` 回退；publish 检查 8/8。
- 剩余：目标站标签映射未做。

## 2026-11-19 发布字段实测修复（v0.7.215）

- 修复副标题拼装；权威种子下载链接逐个尝试；站点实测标题/副标题/简介/匿名正常。
- 图片/标签仍缺；crossseed 需源种在 qB 完成后再真跑。
- target 18/18、meta 11/11、全量 run.sh 通过。

## 2026-11-19 改为权威种子辅种（v0.7.214）

- 放弃预生成副本；上传只清洗通用 tracker，发布后抓权威种子。
- `crossseed` 用 qB skip_checking + 源种 save path 加权威种子；不硬链接。
- target 18/18、torrent-clean 6/6、cli 17/17、publish 7/7、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 每站独立 infohash（v0.7.213）

- 支持改 info.source/private 生成独立目标种；info.name 等布局字段禁止改。
- qB 独立条目靠不同 infohash；同 infohash 不挂多 tracker 当多份。
- torrent-clean 6/6、target 20/20、全量 run.sh 通过；下一步做每站 source 规则和 hardlink/link。

## 2026-11-19 多目标查重前置（v0.7.212）

- 逐目标站查重，已有则 `TARGET_EXISTS` 跳过生成/发布；按站记录，失败隔离。
- target 19/19、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。
- qB 副本模型待确认：同 infohash 只能一个种子；三份独立副本需改 info/复制数据。

## 2026-11-19 提交前生成目标种（v0.7.211）

- `target-prepare` 提交前生成各站目标种，源种/目标种双缓存 0600；不发上传。
- qB 可直接用目标 tracker 辅种；下一步做下载完成→追加 tracker→发布状态机。
- target 18/18、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 qB 多 tracker（v0.7.210）

- 同一 infohash 追加多个目标 tracker，不重复 add 副本；tracker 状态可查 working/未注册。
- mock qB 6/6、全量 run.sh 通过；下一步做下载完成监控和自动发布状态机。

## 2026-11-19 预生成目标种（v0.7.209）

- 源种/目标种双缓存 0600；目标种提交前生成，info 不变，只换 announce。
- 默认跳过发布后下载目标站种子；`--fetch-published` 仅校验。
- target 17/17、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 announce 候选检查（v0.7.208）

- 候选顺序：缓存目标种 → 上传页 passkey → usercp/passkey → 上传页 generic；只回类型不回明文。
- 上传优先 passkey；只有 generic 也先清洗，失败再 `--announce`；发布后以目标站生成种子为准。
- target 17/17、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 禁止源种直传（v0.7.207）

- 目标站上传强制清洗 announce；源种只用于下载，不直传，避免源站 passkey 泄漏。
- announce 自动发现：缓存目标种 → usercp/个人页 → 显式 `--announce`；找不到就停。
- 源种/目标种都保留；target 16/16、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 自动清洗种子（v0.7.206）

- 替换 announce/announce-list，保留 info，infohash 不变；显式 `--announce` 或复用缓存目标站 announce。
- 清洗只在提交前内存完成；passkey 不写库、不打印。
- torrent-clean 4/4、target 16/16、cli 17/17、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 目标站生成种子抓取（v0.7.205）

- 源种直传 + 回查成功后，抓目标站详情页的 `.torrent`，校验 infohash 不变，存私有 `data/torrents/`。
- 目录记录目标站种子 infohash/大小/同 infohash；失败不影响上传结果。
- 自动清洗 fallback 未做；真实多站提交仍等 cookie/授权。

## 2026-11-19 多目标每站种子（v0.7.204）

- `--torrents host=文件` 支持每个目标站独立种子；未配置回退公共种子。
- target 15/15、cli 17/17、smoke 26/26、全量 run.sh 通过。
- 全部站点仍停用；真实多站提交等 cookie/授权。

## 2026-11-19 全部站点停用（运行时）

- 306/306 站点停用；调度关；`realCrawl/realPublish/realImages` false；队列 0；10 个 cookie 保留。
- 停用前清单在私有 `data/enabled-sites-before-disable.json`。
- 探测暂停；发现记录在 `pta/docs/PROBE.md` 与私有 `data/probe-notes.md`。

## 2026-11-19 流程页发布闸门（v0.7.203）

- 发布闸门默认全关；自动发布开启需确认。
- “准备下一批（不发布）”只跑 prepare+preview，不提交目标站。
- 探测发现写入 `pta/docs/PROBE.md`，私有明细在 `data/`。
- smoke 26/26、responsive 32 项、全量 run.sh 通过；goal 状态不变。

## 2026-11-19 批量只读探测（v0.7.202）

- `pta probe` 已接：有 cookie 的目标站逐个只读 GET 上传页，报告字段/分类/文件字段/缺失项。
- 首批 10 站：8 个表单可用，2 个 NO_FORM；修正 1 个文件字段差异。
- target 15/15、smoke 26/26、全量 run.sh 通过；删除测试暂停。

## 2026-11-19 删除本地演练（v0.7.201）

- 删除假演练整卡和 `/api/tasks`；抓取计划并入「抓取」卡，保留看地址。
- 全局抓一页移除，只保留站点详情的抓一页。
- smoke 26/26、responsive 32 项、全量 run.sh 通过；goal 状态不变。

## 2026-11-19 站点页两栏与统计卡（v0.7.200）

- 统计卡去掉覆盖文案，进度条左、数字右；站点列与详情左右分栏并占满卡片；分页收进左列底部、改纯文本。
- 移动端上下堆叠，站点名换行，选中站点自动滚到详情。
- smoke 26/26、responsive 32 项、全量 run.sh 通过；goal 状态不变。

## 2026-11-19 三站真实上传、回查与删除（v0.7.199）

- 3 个授权站各发 1 个中性名测试种，均上传 302、回查命中、删除确认。
- 删除表单三种差异已验证；测试队列清空，realPublish 关闭。
- 下一步是 G10 多目标一条 release 跨站提交，以及 G13 扩到 10 站。

## 2026-11-19 目标站真实上传与删除（v0.7.198）

- 两个授权测试站各发 1 个中性名测试种，回查命中后按“其他 / 测试”删除，`--check` 确认已删。
- `target-delete` 支持两种 NexusPHP 删除表单；上传 200 错误页不再误报成功。
- 第 3 个站缺 cookie；多目标一条 release 跨站提交仍待验。

## 2026-11-18 G10 目标站预检补全（v0.7.197）

- 目标站 plan 返回 hasCookie/ready/warnings；多目标预检按真实可提交状态显示绿/黄，并列出缺口。
- 仍缺真实目标站权限；本轮不改变 blocked 结论。

## 2026-11-18 UI 收口（v0.7.196）

- 桌面导航纯图标右侧悬浮、悬停无刷新切页；站点页统计/工具栏/详情重排；发布区去卡片/横线并改单行左右布局。
- 本轮是 UI 收口，不改变 goal 状态；G5/G10/G13 仍缺真实目标站权限。

## 更新规则

每个开发回合结束前更新本文件；聊天消息开头同步一行：

```text
🛠 正在开发：G10 多目标发布 · 99% · 总进度约 86%
```
