# HANDOFF · SEEDPOD 面板

最后更新：2026-11-16 15:40（当前 v0.7.274 / 流程页收口）

## 2026-11-16 流程页收口（v0.7.274）

- 抓取卡去说明和横线；查重并排无色块；初筛单行；补齐行名/提示重写。

## 2026-11-16 筛选入计划（v0.7.273）

- 计划/抓取都带筛选参数；缺选项时提示。

## 2026-11-16 限制与筛选（v0.7.272）

- 请求限制并入调度条；媒介/分辨率/优惠改为读站点搜索页参数并写入抓取 URL。

## 2026-11-16 分类拆细（v0.7.271）

- Remux/原盘/压制分开；图片/样品/预告独立；23 个类型芯片；86 站/614 映射。

## 2026-11-16 全量落位（v0.7.270）

- 类型 19 个；未归类归其他；86 站/604 映射。

## 2026-11-16 未归类清单（v0.7.269）

- 别名三扩；86 站/554 映射；490 条未归类导出 data/sitecat-unmapped.csv。

## 2026-11-16 sitecat 二导（v0.7.268）

- 别名扩展；routes.json 合并进 site-maps（引擎/种子页/上传页/状态）。
- 86 站 / 549 映射 / 1213 原始标签 / 65 路由。

## 2026-11-16 sitecat 重导入（v0.7.267）

- 上传页 type 下拉也提取；200 文件 → 65 站，累计 86 站/538 映射/1213 原始标签。

## 2026-11-16 芯片 50px（v0.7.266）

- 芯片行左边距 50px。

## 2026-11-16 芯片再右移（v0.7.265）

- 芯片行左边距 10 → 24px。

## 2026-11-16 芯片右移（v0.7.264）

- 预设行芯片右移 10px。

## 2026-11-16 键盘隐藏（v0.7.263）

- 模型/变体按钮也去掉；空键盘时 remove_keyboard。

## 2026-11-16 bot 补丁（v0.7.262）

- patch-telegram-bot.sh + systemd ExecStartPre 自动重打；键盘只留一行两个。
- bot 升到 0.28.0。

## 2026-11-16 预设行行名（v0.7.261）

- 行名可换行完整显示；芯片 24px 紧凑。

## 2026-11-16 预设行（v0.7.260）

- 预设行左列加宽到 96px（手机 84px）。

## 2026-11-16 徽标与芯片（v0.7.259）

- 未接徽标同行；芯片行左对齐。

## 2026-11-16 叫法清单（v0.7.258）

- DESIGN.md 第八节更新为全站界面叫法清单。

## 2026-11-16 详情合并（v0.7.257）

- 四个页签合并成一页顺序展示；抓取参数与抓取卡对调；列表 13 条不滚动。
- Telegram 桥接补引用：回复时把被引用文本拼进提问（node_modules 补丁，升级会丢）。

## 2026-11-16 详情头（v0.7.256）

- 预设/启用与站名同行；去网址；去已收录条。

## 2026-11-16 概览区（v0.7.255）

- 三卡等高；新增抓取参数（预设来源/分类参数/抓取状态/词条）。

## 2026-11-16 列表宽度与分页（v0.7.254）

- 列表 280–400px，每页 14 条。

## 2026-11-16 去登录列（v0.7.253）

- 站点列表去登录列，4 列布局。

## 2026-11-16 站点行列（v0.7.252）

- 窄列表 5 列，去掉隐藏列占位，站名不裁切。

## 2026-11-16 列表宽度（v0.7.251）

- 站点列表 clamp(320,34%,460)。

## 2026-11-16 表头（v0.7.250）

- 表头去掉「登录」，列内容保留。

## 2026-11-16 架构数字（v0.7.249）

- 架构数字改左对齐紧凑，叫法固定为统计条/架构条/架构段/架构数字/数字区。

## 2026-11-16 统计条紧凑（v0.7.248）

- 架构条 320、图例间距 22、数字区左收间距 15。

## 2026-11-16 统计条再调（v0.7.247）

- 架构条 400px、段间距 0、数字区间距 13。

## 2026-11-16 统计条间距回调（v0.7.246）

- 架构条 300/段间距 1、数字区 18、外间距 20。

## 2026-11-16 统计条间距（v0.7.245）

- 架构条 220px、段间距 3、图例/数字区间距放宽，移动端同步。

## 2026-11-16 统一定义（v0.7.244）

- 统计条命名进 DESIGN.md：统计条 / 架构条 / 架构段 / 数字区。

## 2026-11-16 统计条与列表（v0.7.243）

- 统计条居中、分段方角；列表去预设列，架构到站名左、状态点到站名右。

## 2026-11-16 调度搬家与统计卡（v0.7.242）

- 调度条进流程页顶部；设置页删除调度卡；smoke 改断言。
- 统计卡：左架构条+图例、右数字，垂直居中；移动端自适应。

## 2026-11-16 去掉重复类型（v0.7.241）

- 搜索预设删掉「类型」行，分类统一由按站的「抓取分类」管。
- 保留媒介/分辨率/优惠。

## 2026-11-16 搜索预设芯片（v0.7.240）

- 抓取卡恢复类型/媒介/分辨率芯片（旧版选项清单）。
- 暂标未接：medium/standard 参数按站不同，待确认后再接。
- 全量通过。

## 2026-11-16 站点页 UI（v0.7.239）

- 统计卡恢复架构分段条+图例，右侧总站点数字不变。
- 列表列序：站点/预设/登录/架构；详情去掉上次自检行，四个控件一行。
- 全量通过，审计 95。

## 2026-11-16 映射导入增强（v0.7.238）

- 导入器认 manifest.json / 域名文件名；site-maps 存 raw 标签与上传页表单选项。
- backup/restore 增加 site-maps.json。
- 全量通过。

## 2026-11-16 从保存页面导入分类（v0.7.237）

- import-sitecat：111 页 → 30 站、177 条分类映射；写 data/site-maps.json（600，seedpod 属主）。
- 抓取分类合并总表；deploy 排除 checks/fixtures/docs/scripts；文档「夹具」→「固定样本」。
- 上传页分类不用手存，配好 cookie 后用「站点映射 → 自动识别」现读。

## 2026-11-15 分类芯片去重（v0.7.236）

- 同 id 只显示一次；抓取过滤按 id 去重。
- 全量通过。

## 2026-11-15 对象 catMap 分类（v0.7.235）

- 中文对象 catMap（电影→401）也能列抓取分类，抓取过滤同步支持。
- 全量通过。

## 2026-11-15 抓取分类选择（v0.7.234）

- 抓取卡分类多选；PUT /api/crawl/cats/:host 写 site-search.local.json；crawlOnce 按选中的 id 过滤。
- 全不选等于全抓。
- 全量通过。

## 2026-11-15 站点映射总表（v0.7.233）

- `data/site-maps.json` 一个文件存全部站点映射；target.resolve 合并 catMap 与 valueMaps.team。
- API：GET/PUT /api/maps[/:host]、POST /api/maps/:host/detect（读上传页下拉，中文匹配分类）。
- 流程页「站点映射」弹窗：选站、自动识别、改表、保存。
- target 23/23，全量通过。

## 2026-11-15 流程页说明文字（v0.7.232）

- 分组标题下显示 sum，设置项下显示 hint，降低术语门槛。
- 全量通过。

## 2026-11-15 中文分类映射（v0.7.231）

- catMap 以中文为键，movie/tv/doc 自动转中文再查；别名电视剧/动画/纪录/其它都认。
- 条目的 cat 直接写中文也可以。
- 两个猫站私有定义改成中文键；target 22/22，全量通过。

## 2026-11-15 终审状态机（v0.7.230）

- 调度：抓取 → 送审 → 终审 → 发布；终审跑 prepare 后检查简介/副标题/截图/BDInfo/目标站/分类映射。
- 缺项记 review.missing 并留 pending；「不满足时=直接跳过」才 skipped；齐了且真发布开才 approved。
- 新增「必须有副标题」开关（默认关）；scheduler 6/6。
- 全量通过，规则 34 条。

## 2026-11-15 编号修正（v0.7.229）

- 查重卡改回「② 查重」，避免两个 ③；发布卡内 ④–⑧。

## 2026-11-15 规则标题白话（v0.7.228）

- 规则加 `label` 只改界面显示，内部名与已存设置不变。
- 查重/初筛/发布的关键词换成白话，减少术语门槛。
- 全量通过，审计 95。

## 2026-11-15 查重提前、初筛独立（v0.7.227）

- 顺序：①抓取 ②查重 ③初筛 ④补齐 ⑤终审 ⑥发布 ⑦发完 ⑧失败通知。
- 初筛独立成卡：分辨率/体积/最大体积/必须中字/正则。
- 服务端 flowMap 读 fetch+dedupe+pub；scheduler 夹具验证 fetch 组生效。
- 全量通过；规则 33 条（28 已接），审计 95。

## 2026-11-15 查重恢复独立一段（v0.7.226）

- 查重合并回一张卡：目标站搜索、体积容差、已有原盘、只有 DIY。
- 流水线 8 段：①抓取 ②初筛 ③查重 ④补齐 ⑤终审 ⑥发布 ⑦发完 ⑧失败通知。
- 全量通过；规则 33 条（28 已接），审计 95。

## 2026-11-15 流程页七段（v0.7.225）

- 抓取卡 = ①抓取 + ②初筛；发布卡 = ③补齐 ④终审 ⑤站点要求 ⑥发完 ⑦失败通知。
- 门槛（简介/中字/BDInfo/截图）在 ④ 终审，补齐（副标题/简介/图床）在 ③。
- 全量通过；规则 33 条（28 已接），审计 95。

## 2026-11-15 发布卡四段重排（v0.7.224）

- 发布卡：发到哪 / 什么条件才发 / 发布时填什么 / 发完做什么，四组，每组 ≤8 行。
- 新开关：默认匿名、自动勾选标签；中文副标题来源三档接进 crawl。
- 正则三行（排除/白名单/测试）移到抓取卡「转不转」，保存跟着抓取走。
- 待审核预检显示目标站字段与 autoActions。
- 规则 33 条（28 已接），审计 95，全量通过。

## 2026-11-15 发布动作可关（v0.7.223）

- 新增「发布行为」分组：上传前清洗 tracker、发布后抓权威种子、辅种跳过校验、qB 自动种子管理。
- 四个开关都接到服务端：target-service（清洗/抓种）、core crossseed（skip_checking）、publish/qb（autoTMM）。
- 关清洗时按源种直传并在计划里标风险；autoActions 按开关实时变化。
- target 21/21、publish 8/8、smoke 26/26、全量通过；规则 39 条（24 已接）。

## 2026-11-15 隐式行为收口（v0.7.222）

- 制作组：只认数字 id 或 `valueMaps.team`；没映射留空并在预览标红。分类同理。
- 开关：`自动附加 MediaInfo`、`允许联网补简介`，默认开。
- 计划输出 `autoActions`（换 tracker / 抓权威种子 / skip_checking）和 `anonymous`。
- 两个猫站私有定义补了 catMap（movie 401 / tv 404 / anime 403 / show 405 / doc 402 / music 406 / sport 407 / other 412），只在数据目录。
- target 21/21、全量通过；规则 35 条（20 已接）。

## 2026-11-15 豆影无 key 抓取（v0.7.221）

- 豆影 `POST /api.php` 网页接口（无需 key）取豆瓣/IMDb/TMDB 合并 JSON。
- 拼副标题（中文名 / 别名）和 BBCode 简介（海报、译名、片名、年代、产地、类别、语言、上映、评分、片长、演职员、简介、获奖）。
- 网页模式优先豆影，失败回退豆瓣 + Wikipedia；实测 `2012`：423 字简介、海报、IMDb/豆瓣评分。
- meta-ext 9/9、meta 11/11、target 20/20，全量通过。

## 2026-11-15 副标题只搬源站 + 无 key 元数据（v0.7.220）

- 副标题去掉 `· res · size` 自动拼接（0.7.215 自己加的，没有开关）；只用源副标题，其次中文名，都没有留空。
- 无 key 网页模式：豆瓣 `subject_suggest` 取条目/年份/海报/别名，Wikipedia 取剧情简介；没 TMDB key 时默认走 `web`。
- Wikipedia 查询带年份和「电影/电视剧」，跳过「可以指」消歧义；实测 `2012` → 《2012 (電影)》312 字。
- TMDB 网页被 Cloudflare 拦，仍只支持 API；`providers` 增加 `douban`/`web`。
- meta 11/11、meta-ext 7/7、target 20/20、adapter 23/23。

## 2026-11-15 截图不设下限（v0.7.219）

- 「截图至少几张」默认 0；真发布不再要求最少张数，简介里的截图原样全部转载；要严格可手填 3。
- 服务端缺规则时也按 0，不再默认拦 3 张；target 20/20（夹具显式写门槛再验拦截）。

## 2026-11-15 副标题与简介自动转载（v0.7.218）

- 副标题：源站副标题优先，缺 `res/size` 才补；`meta.buildNames` 与目标站 `small_descr` 同一套逻辑，去重、200 字上限。
- 简介：详情页 `kdescr` 转 BBCode（`descrBb`），截图全部保留（不抽样、不按张数截断，上限 20000 字）；送审时 `screen.js` 把 `subtitle/cn/intro/tags/year` 一起写进队列（原来只带标题/分辨率/体积，简介丢失）。
- 公开库兜底：详情页没简介且 `realCrawl=true` 时按「匹配来源顺序」调用 `meta-ext`（有 TMDB key 用 TMDB，否则 Wikipedia），结果拼成 `[quote]简介[/quote] + 海报`。
- 实测源详情页：副标题完整、标签 `中字`、简介 1000 字 + 15 张图转 BBCode 正常。
- adapter 22/22、meta 11/11、target 20/20。

## 2026-11-15 目标站标签映射（v0.7.217）

- 站点定义新增 `tagMap`/`tagValue`，上传计划按来源标签自动勾 `guoyu/yueyu/zhongzi/ensub/diy` 这类复选框（值 `yes`）。
- 安全边界：`禁转/限转/官方/应求` 不自动勾；没配 `tagMap` 的站不勾任何标签。
- 标签来源：`item.tags` 优先，缺失时用标题推断（`国配/粤语/中字/简繁/DIY`）。
- 计划输出新增 `tags`、`tagFields`；target 检查 19/19。
- 两个猫站私有定义已加 `tagMap`；内置包生成器 `build-site-pack.js` 会带上这两个字段（本次未重新生成 `site-pack.enc`）。
- 还没做真实上传复核：标签在目标站页面的展示要等下一次真实发布验证。

## 2026-11-15 真实 BDInfo 种子跨站辅种跑通（v0.7.216）

- 源种：猫主站 `2012 2009 BluRay 1080p x264 DD5.1 ISO-CMCT`，7.90 GB，BDInfo 0.5.6，41 做种；qB `dl_002` 实测约 10–15 MB/s，13 分钟下完。
- 目标站：猫测试站发布成功（id 2713），回查命中；标题、副标题（`2012/2012世界末日 · 1080p · 7.90 GB`）、简介 3 张外链图、匿名均正常。
- 权威种子 infohash `5a4749…` 与源种 `ba20db…` 不同（目标站会重写 seed 信息），`crossseed` 用 `skip_checking=true` + `/downloads` 加进 qB，目标 tracker 状态 2（working），详情页显示 1 个做种者。
- 收口：目标站测试种已删除（详情页留删除记录）；qB 两个任务已移除并删数据；`realPublish=false`；测试队列条目已删除。
- qB：新增 `removeTorrent`，`resumeTorrent`/`stopTorrent` 做 `/start`→`/resume`、`/stop`→`/pause` 回退；`findTorrent` 回速度/连接数/ETA/tracker；publish 检查 8/8。
- 已知未做：目标站标签（国语/中字等）未映射；图片已验证可显示。

## 2026-11-19 发布字段实测修复（v0.7.215）

- 修复目标站副标题只用 cn、不拼 res/size；站点实测显示完整副标题。
- 权威种子下载链接逐个尝试，只收 bencode；目标站生成种子已落盘。
- 实测：标题/副标题/简介文字/匿名正常；图片 links 0、标签未映射；源种不在 qB，crossseed 未真跑。
- target 18/18、meta 11/11、torrent-clean 6/6、cli 17/17、publish 7/7、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 改为权威种子辅种（v0.7.214）

- 放弃预生成副本，`target-prepare` 入口删除；上传只清洗成目标站通用 announce。
- 发布成功后默认抓详情页权威种子，存 `data/torrents/` 0600；副本/同 hash 多份不再使用。
- 新增 `crossseed`：源种下载完成后，权威种子加 qB，`skip_checking=true`，save path 复用源种；不硬链接。
- qB addTorrent 支持 skip_checking，findTorrent 回 savePath/contentPath。
- target 18/18、torrent-clean 6/6、cli 17/17、publish 7/7、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 每站独立 infohash 的目标种（v0.7.213）

- `torrent-clean` 支持改 `info.source`/`info.private`：改变 infohash、保留文件布局；`info.name` 等布局字段禁止改。
- `target-prepare` 支持 `targetTransforms`，按站生成独立目标种；qB 才能作为独立条目添加。
- 同 infohash 不允许挂多 tracker 当多份用；布局不同需硬链接/软链接。
- torrent-clean 6/6、target 20/20、cli 17/17、publish 6/6、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 多目标查重前置（v0.7.212）

- `target-prepare` 和真实上传前都先查目标站；已有资源标 `TARGET_EXISTS`，不生成副本、不发布。
- 跳过按目标站记录，`allOk` 不把 skipped 当失败；一个站已有不拖累其他站。
- target 19/19、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 提交前生成目标种（v0.7.211）

- `target-prepare`：提交前按站生成目标种，源种/目标种双缓存 0600，不发上传请求。
- 目标种只换 announce/announce-list，info 不变；qB 后续直接用目标 tracker 辅种。
- target 18/18、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过；下一步接下载完成/发布状态机。

## 2026-11-19 qB 多 tracker 与状态监控（v0.7.210）

- qB 适配新增 `addTrackers` / `trackerStatus`；同 infohash 不重复 add，只给现有种子追加目标 tracker。
- tracker status=2 视为 working；未注册/未联系可读 msg/status。
- mock qB 6/6、全量 run.sh 通过；下一步接下载完成→追加 tracker→发布→working 状态机。

## 2026-11-19 预生成目标种（v0.7.209）

- 源种与目标种都缓存到 `data/torrents/` 0600；目标种在提交前生成（info 不变，只换 announce）。
- qB 直接使用预生成目标种辅种；发布后默认不再下载目标站种子，少一次请求。
- `--fetch-published` 仅异常校验用，对比发布后种子的 infohash。
- target 17/17、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 announce 候选检查（v0.7.208）

- 新增 `target-announce`：列缓存目标种、上传页 tracker、usercp/passkey 候选，区分 passkey/generic；只回类型不回明文。
- 上传优先 passkey，只有 generic 时也先清洗（无源站 passkey），失败再要求 `--announce`。
- 发布成功后的目标站生成种子仍是最终 tracker 来源。
- target 17/17、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 禁止源种直传（v0.7.207）

- 目标站上传强制清洗 announce；源种只用于下载，不再直传目标站，避免泄漏源站 passkey。
- 目标 announce 自动发现：缓存目标种 → usercp/个人页 passkey → `--announce`；找不到就不提交。
- 源种和目标种都保留；target 16/16、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 自动清洗种子（v0.7.206）

- `torrent-clean` 替换 announce/announce-list，保留 info 原始字节，infohash 不变；非法 announce/解析失败直接拒绝。
- 目标站有缓存种子时自动复用其 announce；也可 `--announce h1=url,h2=url` 显式指定。
- 清洗在提交前内存完成，passkey 不写库、不打印；目标站生成种子仍存 `data/torrents/` 0600。
- torrent-clean 4/4、target 16/16、cli 17/17、smoke 26/26、全量 run.sh 通过；真实多站仍等 cookie/授权。

## 2026-11-19 目标站生成种子抓取（v0.7.205）

- 源种直传成功后，从详情页解析下载链接，抓目标站生成的 `.torrent`，校验 infohash 不变，存 `data/torrents/`（0600）。
- `targetResults` / `targetUpload` 记录目标站种子 infohash/大小/同 infohash；抓取失败只记错误，不影响已成功的上传。
- 站点拒绝源种时的自动清洗 fallback 仍未做；需要时先用 `--torrents` 手工给清洗种。
- target 15/15、cli 17/17、smoke 26/26、全量 run.sh 通过。

## 2026-11-19 多目标每站种子（v0.7.204）

- `target-upload --torrents host=文件,host2=文件2` 支持每个目标站独立种子；未配置的站回退公共种子。
- HTTP 接口接受 `targetTorrents` 对象/数组；target-service 按站替换 `torrentBase64`。
- target 15/15、cli 17/17、smoke 26/26、全量 run.sh 通过；真实多站提交仍待 cookie/授权。

## 2026-11-19 全部站点停用（运行时）

- 306/306 站点已设为 `enabled=false`；调度关；`realCrawl/realPublish/realImages` 全为 false；队列 0。
- 停用前启用清单保存在私有 `data/enabled-sites-before-disable.json`（0600），恢复时按清单逐个打开。
- 10 个 cookie 保留，未删除；探测暂停，发现记录在 `pta/docs/PROBE.md` 和私有 `data/probe-notes.md`。
- 目的：等 cookie 补齐和人工检查期间，不会自动抓取或发布。

## 2026-11-19 流程页发布闸门（v0.7.203）

- 流程页顶部加发布闸门：真抓取 / 自动发布 / 图床实传默认关；开启自动发布需确认。
- 新增“准备下一批（不发布）”：prepare + preview 只落本地，结果去待审核页人工检查。
- 探测发现记录：`pta/docs/PROBE.md`（通用），私有明细 `data/probe-notes.md` / `data/site-probe.json`。
- smoke 26/26、responsive 32 项、全量 run.sh 通过。

## 2026-11-19 批量只读探测（v0.7.202）

- 新增 `pta probe`：按 cookie 目标站逐个只读 GET 上传页，输出字段/分类/文件字段/缺失关键字段；报告写私有 `data/site-probe.json`。
- 修正表单识别：优先选带文件字段、字段最多的表单，避免把搜索框当上传表单。
- 首批 10 个有 cookie 目标站：8 个表单可用，2 个 `NO_FORM`；修正一个站文件字段 `file → torrentfile`。
- target 15/15、smoke 26/26、全量 run.sh 通过；删除测试暂停。

## 2026-11-19 删除本地演练（v0.7.201）

- 删除“本地演练”整卡、假进度和 `/api/tasks` 演练接口；它只是固定 5 步定时器，不验证配置。
- 「抓取」卡头部合并来源站 + 看地址，计划在卡内展开；全局「抓一页」移除，只留站点详情的「抓一页」。
- smoke 26/26、responsive 32 项、全量 run.sh 通过。

## 2026-11-19 站点页两栏与统计卡（v0.7.200）

- 统计卡去掉“已适配…”覆盖文案；进度条在左，总站点/启用/登录失效/还没自检在右，高度约 38px。
- 站点列与详情改左右两栏，左列表右概览+设置，占满卡片，不再手风琴。
- 分页移到左列底部并加边框，上一页/下一页改纯文本；移动端上下堆叠，选中站点自动滚到详情。
- 窄列站点名换行，移动端隐藏预设列；smoke 26/26、responsive 32 项、全量 run.sh 通过。

## 2026-11-19 三站真实上传、回查与删除（v0.7.199）

- 第 3 个授权站 cookie 补入后可解密，目标站预检 ready；三个站各发 1 个中性名测试种。
- `Sample 2026 1080p` / `2160p` / `720p` 均上传 302、回查命中；按“其他 / 测试”删除，`--check` 从 false 变 true。
- 覆盖三种删除表单差异：`reason_type/reason_input`、`reasontype/reason[]`、详情页“没有该ID的种子”。
- 测试队列已清空，realPublish 已关回 false。
- target 14/14、smoke 25/25、全量 run.sh 通过。

## 2026-11-19 目标站真实上传与删除（v0.7.198）

- 两个授权测试站各发 1 个中性名测试种：`Sample 2026 1080p` / `Sample 2026 2160p`；回查命中后按“其他 / 测试”删除，`--check` 已确认。
- 新增 `target-delete` CLI/API，兼容 `reason_type/reason_input` 与 `reasontype/reason[]` 两种删除表单。
- 修复上传 200 误报：错误页导航里的详情链接不再当成功；uncertain 记录站点错误摘要并按失败落库。
- 第三个站缺 cookie，未提交；测试队列已清空，realPublish 已关回 false。
- target 14/14、全量 run.sh 通过。

## 2026-11-18 G10 目标站预检补全（v0.7.197）

- `target.plan` 增加 `hasCookie`、`ready`、`warnings`，覆盖缺 cookie、缺上传地址、空字段、缺回查地址。
- 待审核“多目标预检”按 ready 显示绿/黄，并列出缺口原因；无 cookie 不再显示为可提交。
- target 12/12、smoke 25/25、全量 run.sh 通过；真实提交仍缺目标站权限。

## 2026-11-18 Web UI 细节收口（v0.7.196）

- 桌面导航纯图标贴卡片右侧悬浮，1320–1920 实测离卡片 22–53px，不遮挡；悬停无刷新切页。
- 站点页统计卡上移压缩、工具栏桌面单行；详情改概览左/设置右，站点标题可再次点击收回；离开站点页自动收起详情。
- 发布区去掉分组灰卡片与字段横线，建立卡片→分组→小节→字段四级层级；标签/控件左右单行，移动端自动换行。
- 目标站未选择时显示“未选择目标站”，去掉问号头像。
- smoke 25/25、responsive 32 项、全量 run.sh 通过。

## 2026-11-18 G10 多目标预检（v0.7.195）

- 上传准备卡显示每个目标站的引擎/字段数/未就绪原因。
- 准备上传按当前勾选的目标站重算，避免预检与提交目标不一致。
- smoke 24/24，全量 run.sh 通过；真实 3 站仍缺权限。

## 2026-11-18 G13 覆盖面板（v0.7.194）

- 新增 `/api/coverage` 与站点页“站点包”弹窗里的“站点覆盖”卡，显示 177 目标站、9 cookie-ready、177 上传计划成功。
- 面板只给计数，不打印站名/网址；不联网、不提交。
- api-v2 29/29、smoke 24/24、全量 run.sh 通过。

## 2026-11-18 去掉基础版/开发版切换（v0.7.193）

- App 不再读 `pta.mode`；更新日志页常驻，`#changelog` 不再重定向。
- 设置页删除“版本模式”卡；所有功能与更新日志始终可见。
- responsive 测试不再预置 `pta.mode`；smoke 23/23、responsive 32 项。
- AGENTS 旧规则同步：不再提供基础版/开发版切换。

## 2026-11-18 G13 上传计划 dry-run（v0.7.192）

- `pta coverage --plan` 对 177 个可解析目标站生成上传 payload，0 失败。
- 生产：177 定义 / 177 上传+回查路径 / 9 cookie-ready；计划成功不等于真实提交。
- G13 真实提交/回查仍缺目标站权限；G5 qB 已验证在线。
- CLI 17/17，全量 run.sh 通过。

## 2026-11-18 密钥状态与 qB 验证（v0.7.191）

- 之前 CLI 读生产数据没带 `PTA_SECRET_FILE`，在 `data/.secret` 生成了错误 key；已隔离为 `.secret.wrong-20261115-1145`，服务端仍用独立密钥文件。
- 显式密钥无效时不再生成 `data/.secret`；保存密码/cookie 在密钥不可用时返回 `CRYPTO_UNAVAILABLE`。
- 设置页显示凭据密钥来源/是否可用；下载器显示密码是否可解；站点 cookie 显示是否可解。
- `PTA_DATA=/opt/seedpod/data node pta/cli.js clients --test --env-file /etc/seedpod.env`：两台 qB 都 online（v5.1.2 / v5.2.4）。
- G5 75%：qB 已验证；真实目标站提交/回查仍缺权限。G13 20%。

## 2026-11-18 G13 离线覆盖审计（v0.7.190）

- 新增 `pta coverage [--list]`；只读本地定义/凭据，不联网。
- 生产：177 个可解析目标站、9 个有 cookie 且 ready、177 个有上传/回查路径；306 清单里其余缺 base/engine 或定义。
- 9 个 ready 不是真实提交证据；G13 仍等真实目标站权限。
- CLI 17/17，全量 run.sh 通过。

## 2026-11-18 G5 qB 探测（v0.7.189）

- CLI 新增 `pta clients [--test]`，只读列/探测下载器，不输出 URL、密码、IP。
- 生产 2 台 qB：version 403、login 不接受；只试一次，未重试，避免风控。
- 需要用户检查 qB WebUI 的 IP 白名单、账号密码、防暴力/封禁状态。
- 真实目标站提交/回查仍缺权限；G5 保持 blocked。

## 2026-11-18 移除 rTorrent/Deluge 兼容（v0.7.188）

- 用户决定不再为 PTA 开发 rTorrent/Deluge 下载器兼容；产品只保留 qBittorrent + watch。
- 删除 rtorrent.js / deluge.js / clients-ext；routes-qb、publish 只接受 qb/watch，旧类型返回 UNSUPPORTED_DOWNLOADER。
- 面板类型选项只剩 qB / watch；旧记录显示“已弃用”，编辑时改成 qB 或 watch。
- clients 7/7、smoke 23/23、全量 run.sh 通过。
- G5 改为“真实目标站 + 真实 qB/watch 环境”，仍等真实站点权限。

## 2026-11-18 G4 规则分诊执行（v0.7.187）

- 8 条接读者：目标站搜索（/api/dupe/check）、体积容差（dupe-classify）、必须有简介（screen）、BDInfo（target-service 真发布门槛）、图片上传重试（routes-publish/core）、简介图片（release）、年份一致/主演数量（meta-ext）。
- 17 条从 rules.js 删除；15 条继续禁用（优惠、原盘/DIY、下载完成、地区版本、不满足时、连续失败、副标题来源、截图来源、相似度、来源顺序、字幕类型、做种数、免费/优惠、单站并发）。
- 新增 `flow-config.js` / `dupe-classify.js`；规则体检 33 总 / 18 保留 / 15 未接 / 缺读者 0。
- dupe-classify 4/4、flow-config 3/3、target 12/12、meta-ext 6/6、api-v2 28/28、smoke 23/23。
- G4 完成；剩余全部等真实权限/环境或 G14 需求。

## 2026-11-18 G4 规则分诊建议表（v0.7.186）

- 40 条未接规则逐条对当前服务端能力，输出 `pta/docs/RULES-TRIAGE-G4.md`。
- 建议做 8、删 17、暂缓 15；每条有缺口、接法、代价。
- 未改 `rules.js`；等用户回复“按建议”或列不同意的编号后再落。
- G4 仍进行中：建议表已出，等拍板。

## 2026-11-18 G6 站点包例外 + Docker/备份（v0.7.185）

- 站点包例外：原设置页显示覆盖率/待确认；0.7.194 移到站点页“站点包”弹窗；确认写私有 `data/site-defs`，不回写密文包。
- 备份/恢复：`pta/scripts/backup.sh`（VACUUM INTO 快照，处理 WAL）与 `restore.sh`（清旧 WAL、默认拒绝覆盖）；夹具 4/4。
- Docker 复验：build、compose up、重启持久化、备份后恢复到新卷再起，health 正常且队列条目保留。
- site-pack 9/9、api-v2 26/26、smoke 23/23、backup 4/4、全量 run.sh 通过。
- 剩余 G4/G5/G10/G12/G13 等真实权限/环境/拍板；G14 可选。

## 2026-11-18 G3 拆 Sites.vue（v0.7.184）

- `Sites.vue` 1508 → 436 行；拆出 toolbar / stats / list / detail / modals 五个组件。
- 详情自己加载 site-def、预设、词条；父组件保留筛选、分页、批量、添加和刷新。
- 打开同一站点用 nonce 强制重载详情，避免旧上传字段残留。
- smoke 22/22、responsive 32 项；API 未改。
- 下一步 G6：站点包例外 UI + Docker/备份复验。

## 2026-11-18 G11 客户端注入演练（v0.7.183）

- `injectPlan` 覆盖 qB/watch/rtorrent/deluge，返回 wouldAdd/wouldWrite、savePath、hash、幂等、重试。
- `/api/queue/:id/inject` + CLI `inject` + 面板“注入演练/上传准备”卡片。
- 真注入复用 publishItem；已 injected 直接 skipped；failed+stageFailedFrom=injected 标 retry。
- clients 6/6、CLI 15/15、smoke 22/22；G11 验收项全部有夹具。
- 下一步 G3 拆 Sites.vue；G13/G12 继续等真实站点权限。

## 2026-11-18 G11 图床转存（v0.7.182）

- 新增 `imagehost.js`：演练/真上传、逐张重试、失败隔离；Pixhost/Imgbox 未验证只演练。
- `release.prepare` 把 `imageLinks` 追加为 `[img]` 并清掉 data URL；目标站继续读 `description`。
- `POST /api/queue/:id/images` + CLI `images` + 面板“图床演练/上传截图”；真上传要 `realImages` 或 `PTA_ALLOW_REAL`。
- imagehost 7/7、api-v2 25/25、CLI 14/14、smoke 21/21。
- 下一步：客户端注入干跑；之后验证 Pixhost/Imgbox 实际接口。

## 2026-11-18 G11 MediaInfo/BDInfo 上传准备（v0.7.181）

- 新增 `mediainfo.js`：BDInfo/MediaInfo 纯文本解析，输出视频/音轨/字幕/体积/时长摘要。
- `release.prepare` 可接收媒体文本，生成 `[quote]` 块拼进简介；`prepared.media` 带摘要，目标站仍读 `description`。
- `/api/meta/mediainfo` + 队列动作保存 + CLI `--mediainfo/--bdinfo` + 面板解析/准备按钮。
- mediainfo 5/5、api-v2 24/24、CLI 13/13、smoke 21/21、responsive 32 项。
- 下一步：图床转存/链接替换，再做客户端注入干跑。

## 2026-11-18 Telegram 合并通知并置顶（v0.7.180）

- 部署后只发一条“工作中 + 百分比 + 总进度”，不再发提交哈希。
- 发送后自动置顶；新进度替换旧置顶。
- 置顶状态文件：`~/.cache/seedpod/tg-pin`；失败只记录，不影响通知。

## 2026-11-18 Telegram 进度（v0.7.179）

- 新增 notify-progress.sh；deploy.sh 自动发当前进度到作者 Telegram。
- 已实测 bot 发送成功；之后每次部署都会收到进度消息。

## 2026-11-18 进度跟踪（v0.7.178）

- 新增 PROGRESS.md：当前 G10 85%，总进度约 49%。
- 每轮开发消息开头固定显示进度；GOAL-RUNNER 已写入规则。

## 2026-11-18 G10 按站重试（v0.7.177）

- 面板显示每个目标站的 stage/error/verify；失败可单站重试。
- 多目标干跑/失败隔离已有夹具；真实多站提交仍待权限。

## 2026-11-18 G10 面板多目标（v0.7.176）

- 多目标芯片多选 + 多目标提交接口已接面板；主目标站下拉保留兼容。
- 多目标 API 干跑夹具通过；target 11/11、smoke/responsive 通过。
- 待做：按站重试 UI、真实多站提交。

## 2026-11-18 回查修正（v0.7.175）

- 测试站实际搜索 0 行，确认之前“回查找到”是搜索框回显导致的假阳性。
- 回查改为解析结果行；提交无详情/成功提示标 uncertain；未确认上传写 failed + nextRetryAt。
- 新增搜索框回显回归用例；target 11/11。
- G10 仍进行中：面板多选、真实多站待做。

## 2026-11-18 G10 多目标第一切片（v0.7.174）

- prepare --targets / preview targets / target-upload --targets 已落地。
- 逐站干跑，单站失败不阻断；targetResults 按站记录。
- 待做：面板多选、真实多站提交、按站重试 UI。

## 2026-11-18 Goal 扩展（v0.7.173）

- GOALS 补 G0；新增 G10 多目标发布、G11 上传准备 1:1、G12 全自动流水线、G13 站点覆盖、G14 可选 Python sidecar。
- active 切到 G10；G3/G6 后续/并行，G4/G5 等拍板/环境。
- 新增 `GOAL-RUNNER.md` 总提示词：连续执行、每 goal 验收、失败两轮即停、blocked 才找用户。

## 2026-11-18 G8 原生上传（v0.7.172）

- prepared payload 已接 target-upload；preview 返回完整 payload。
- 提交/注入成功写 submitted/injected，失败写 failed + lastError + nextRetryAt。
- CLI 12/12；全量、smoke、responsive、审计 87 通过。
- G8 完成；下一步 active 切到 G3 拆 Sites.vue。

## 2026-11-17 G9 CLI-first（v0.7.171）

- CLI 默认本地模式：直接读 SQLite/data，不要求 HTTP；`PTA_BASE`/`--http` 仍可远程。
- 新增 `pta/core/index.js` 与 `target-service.js`；target-upload 路由和 CLI 共用。
- 本地 CLI 12/12；面板 smoke/responsive 不回退。
- G9 完成；下一步 active 切到 G8 原生上传。

## 2026-11-17 G7 发布状态机（v0.7.170）

- stage 扩展 submitted/injected/failed；attempts/lastError/nextRetryAt/evidence/history 落 SQLite。
- target-upload/publish 成功推进阶段，失败标 failed；重复提交/注入被拦住。
- 待审核详情显示阶段和重试按钮。
- G7 完成；下一步 active 切到 G9 CLI-first core。

## 2026-11-17 G2 完成（v0.7.169）

- 空 catch 0、TODO 0、console.log 0；审计 87（代码 91、复用率 85、质量 100）。
- `initials` / `fmtBytes` 收口；`loadSites` 两份按数据需求保留并注释；`tone` / `openAdd` 语义不同不合并。
- 下一步 active 切到 **G7 发布状态机**，之后 G9、G8。

## 2026-11-17 G2 第一批（v0.7.168）

- 公共 UI 函数收口到 `utils/ui.js`；显式空 catch 改为 `reportError`/warn。
- 质量审计 83 → 85，重复函数名 11 → 7；空 catch 仍剩 9 个（promise `.catch(() => null)` 等）。
- G2 标记进行中；G3–G9 已全部 open，按依赖推进。

## 2026-11-17 测试站真实验证（v0.7.167）

- 真实抓取：测试站 limit 5，38 行、新增 5 条；临时数据副本，未写生产库。
- 本地查重、prepare/preview 通过。
- 真实提交：HTTP 200，回查找到种子，一次成功，未重试。
- 生产 realCrawl/realPublish 仍关闭；测试站会留下一条测试种子，需用户自行删除。
- 真实 rTorrent/Deluge 仍未验证；G8 原生 submit 仍待做。

## 2026-11-17 单 release 准备（v0.7.166）

- 新增 release API 与 CLI：prepare / preview / advance / run；queue 增加 stage。
- 只做本地准备/预览，提交仍走 target-upload / publish；测试站已用私有 NexusPHP 骨架验证准备链，未提交。
- CLI 夹具 9/9；下一步 G7 阶段机、G9 core 抽取、G8 原生提交。

## 2026-11-17 CLI-first（v0.7.165）

- 现有 `pta/cli.js` 是 HTTP 薄客户端，覆盖 status/queue/crawl/screen/publish/targets/target-upload/verify；默认干跑。
- 新增 `pta/docs/CLI.md` 和 G9：抽 `pta/core/` 服务层，CLI 直接驱动，面板只做视图。
- 目标命令补齐 prepare / preview / advance / run；`--json`、非 0 退出码、幂等。
- 顺序：G2 → G7 状态机 → G9 CLI-first → G8 原生上传。

## 2026-11-17 G7 / G8 目标（v0.7.164）

- G7：发布状态机，阶段 source/metadata/rules/dupe/media/preview/submitted/injected，落 SQLite，幂等可恢复。
- G8：SEEDPOD 原生单 release 上传准备与站点提交，不接 UA/upbrr、不调用它们 CLI。
- 技术栈不变：Node + Fastify + SQLite 单进程；不引入 Redis/消息队列/独立 worker/Postgres。
- 顺序：G2 可靠性债 → G7 状态机 → G8 原生上传（真实提交依赖 G5）。
- `UPSTREAM.md` 已记录 UA/upbrr 的条件规则定义方式，供 G4/G8 参考。

## 2026-11-17 响应式自动检查（v0.7.163）

- 新增 `pta/checks/responsive-layout.js`：8 页 × 360/390/768/1280，当前 32 项通过。
- 检查横向滚动、按钮文字、队列列表/详情同宽、站点名裁切、数据清单操作区、日志工具条、设置按钮、更新日志、Crawl 未接徽标/目标站弹窗、下载器行。
- 已接入 `run.sh`，失败阻断提交；夹具含 305 站、长标题、空/有数据队列。
- 规范 R2 完成；下一步 G2 可靠性债（公共函数 + 空 catch）。

## 2026-11-17 响应式布局计划（v0.7.162）

- 新增 `pta/docs/RESPONSIVE.md`：一套 Vue 代码，不做独立移动站；断点 600/900/1320。
- 验收固定 360 / 390 / 768 / 1280，新增页面加 1440；UI 改动必须查横向滚动、按钮文字、卡片对齐。
- 已接入 ROADMAP M12、CHECKLIST、AGENTS、DESIGN；下一步 R2 自动检查。
- 本轮只改文档和版本，无运行时行为变化。

## 2026-11-17 外框规则收口（v0.7.161）

- 全局 `.view[data-view=...]` 清零，全部进页面 SFC 的 `:global`。
- Crawl 抽屉头覆盖进 `Crawl.vue`，Nodes 子组件用 `:deep`。
- Queue 截图样式进 `Queue.vue`；05 改名 `05-shared-picker-drawer.css`。
- smoke 21/21，全量全绿，质量审计 83 未回退。

## 2026-11-17 Nodes / 目标站弹窗收口（v0.7.160）

- 04 改名 `04-shared-forms-drawers.css`，只剩共享表单/抽屉/外框规则。
- Nodes 52 条规则迁入 `Nodes.vue` scoped；Crawl 目标站弹窗 17 条规则迁入 `Crawl.vue` scoped。
- Nodes 390 两行卡片、下载器弹窗单列；目标站弹窗名称/域名两行。
- Crawl 登录后自动补载站点，来源站/目标站不再为空。
- smoke 21/21，全量全绿，质量审计 83 未回退。

## 2026-11-17 小屏收口（v0.7.159）

- Sites 小屏列表整页展开，长站点名换行完整显示；305 站不再只露 4 条。
- Sources 筛选栏两列网格，按钮两列/导出独占一行；数据行无横向滑动。
- Queue 列表与详情统一全宽，空态上下对齐。
- Crawl 未接徽标贴文字右侧；条件字段 ≤900px 标签在上、控件在下。
- 360/390/768/1280 复测，smoke 21/21，全量全绿，质量审计 83 未回退。

## 2026-11-17 Changelog scoped（v0.7.158）

- Changelog 规则迁入 `<style scoped>`；补回页面内 `/api/changelog` 加载与 Markdown 渲染。
- 401 后登录/切页自动重试；1280/768/390 无横向溢出。
- 八页页面级 scoped 迁移完成：Dashboard / Sites / Crawl / Queue / Sources / Logs / Settings / Changelog。

## 2026-11-17 小屏溢出修复（v0.7.157）

- Sites 长站点名 360–390 自动换行完整显示。
- Sources 390 行网格 `minmax(0,1fr)`、操作区换行，`#dl-body` 无横向溢出。
- Queue 390 卡片单列并 `min-width:0`，与网格对齐。
- 360/375/390/768 复测，smoke 21/21，全量全绿，质量审计 83 未回退。

## 2026-11-17 Settings scoped（v0.7.156）

- Settings 55 条规则迁入 `<style scoped>`；删除空模块 `10-settings-responsive.css` 和入口 import。
- `set-field` / `set-fields` / `fixed-val` 基础规则留全局；`#set-panel` 前缀保留，避免特异性下降。
- 390 卡头标题独占一行、按钮右对齐；三宽度视觉通过，smoke 21/21，全量全绿。

## 2026-11-17 窄屏与登录后加载修复（v0.7.155）

- Sources 401 后复位 `loadBusy`，直接开 `#sources` 登录后自动加载。
- Sites 390 名称完整；Crawl 发布卡单列；Queue 标题/卡片单列；Logs 工具条横排；Settings 测试按钮不压缩。
- 1280 / 768 / 390 视觉通过，smoke 21/21，全量全绿，质量审计 83 未回退。

## 2026-11-17 Logs scoped（v0.7.154）

- Logs 30 条规则迁入 `<style scoped>`；全局无 `log-*` 选择器。
- 390 日志行两行布局，消息独占一行；黑绿终端主题保留在页面内。
- 三宽度视觉通过，筛选 INFO/WARN/ERROR 计数正确；smoke 21/21，全量全绿，质量审计 83 未回退。

## 2026-11-17 Sources scoped（v0.7.153）

- Sources 28 + 5 条规则和 `#dl-body` 迁入 `<style scoped>`；全局无 sources 页面选择器。
- `dl-dry*` 留在 Crawl；`sd-*` / `btn` / `chip` / `badge` 等共享规则留全局。
- 390 修复外层垂直居中导致筛选条压顶栏；三宽度视觉通过，smoke 21/21，全量全绿。
- 质量审计总体 83 未回退。

## 2026-11-17 Queue scoped（v0.7.152）

- Queue 41 + 34 条规则迁入 `<style scoped>`；全局无 queue 选择器。
- 共享 `sd-card/sd-note/sd-url/seg-tabs` 基础规则保留；三宽度列表/详情正常。
- 质量审计 83 未回退，全量检查全绿。

## 2026-11-17 Crawl scoped（v0.7.151）

- Crawl 103 条规则迁入 `<style scoped>`；子组件用 `:deep()`，shared 基础规则留全局。
- 修窄屏抽屉头换行与空演练 body 隐藏；390 / 768 / 1280 视觉通过。
- 质量审计总体 83 未回退，全量检查全绿。

## 质量审计（固定，v0.7.150）

命令：

```bash
node pta/scripts/audit-quality.js --project pta       # 全库
node pta/scripts/audit-quality.js --file <path>       # 单文件
node pta/scripts/audit-quality.js --feature <name>    # 单功能
node pta/scripts/audit-quality.js --project bluray    # 单项目
node pta/scripts/audit-quality.js --project pta --fail
```

当前基线（`pta/quality-baseline.json`）：代码 78 / 功能 86 / 编写 100 / 逻辑 76 / 简洁 80 / 复用 70 / 质量 99，总体 83（平衡）。全库基线回退 ≥2 分即失败；单文件/功能出现「差」即失败。规则写在 `AGENTS.md`、`CHECKLIST.md`、`DECISIONS.md` D22、`DELIVERY.md` 和 `pta/docs/QUALITY.md`。

## 2026-11-17 Sites scoped（v0.7.149）

- Sites 277 条规则迁入 `<style scoped>`；shared `sd-*`/`set-field` 留全局。
- 页面模块改名/拆分；修复 `:global` 后代编译丢失导致的站点页 display:none。
- smoke 21/21，全量检查全绿。

## 2026-11-17 Dashboard scoped（v0.7.148）

- Dashboard 118 条页面规则迁入 `<style scoped>`；`bento/stat/status/hstat/panel-head/list-item/#dash-*` 从全局移走。
- `02-dashboard.css` → `02-shell-layout.css`；外层 `.view[data-view=dashboard]` 用 `:global`。
- 三宽度 + Sites 回归通过，全量检查全绿。

## 2026-11-16 CSS 语义去重（v0.7.147）

- 删除 41 条完全覆盖规则、合并 7 组相邻同选择器、删除 6 条重复声明。
- CSS 102,284 → 99,364 字节，规则 1,195 → 1,147；不改级联顺序。
- 三宽度与七页实测通过，全量检查全绿。

## 2026-11-16 v2 样式拆分（v0.7.146）

- `v2.css` 按原级联顺序拆成 12 个模块，`index.css` 入口；拆分前后字节完全一致。
- 历史文档移到 `pta/docs/history/`；当前文档只留活跃项。
- 全量检查全绿。

## 2026-11-16 站点清单迁 SQLite（v0.7.145）

- 305 个基础站从 v1 `sites-data.local.js` 迁入 `sites` 表；`/api/sites` 只读 SQLite，`base:true` 禁止删除。
- 旧 `sites-data.local.js` 和 8 个 v1 JSON 移到 `data/_v1-backup-20261116`（0600）；v2 不再读。
- 迁移中误删 1 个基础站配置和 1 条凭据，已从迁移前数据库副本恢复；站点 305、凭据 8。
- 新增 `migrate-sites-js.js` 和 base-delete 冒烟断言；全量检查全绿。

## 2026-11-16 v1 残留清理（v0.7.144）

- 删除 `PLAN.md`、`TASKS.md`、`.opencode/commands/migrate.md`。
- 删除 `screen.js` 旧 flow 兼容层和最后 5 条 `.map-row` 死 CSS。
- AGENTS/DECISIONS/ROADMAP/DELIVERY/PROBLEMS/PIPELINE-RULES/RULES-TRIAGE/DESIGN/CONTRIBUTING 路径与状态对齐 v2。
- `deploy.sh` 去掉 v1 sites-data 排除项；全量检查全绿。

## 2026-11-16 v2 样式迁移（v0.7.143）

- `app.css` → `src/styles/v2.css`；字体/logo → `src/assets/`；Vite 打包哈希。
- `public/` 只留 favicon/icon；删除手工 CSS link 和指纹插件。
- 旧 `/assets/app.css` 不再被页面引用；页面级 scoped 拆分仍待逐页做。

## 2026-11-16 导航图标与悬浮条（v0.7.142）

- 恢复 8 个 SVG 图标；基础版 7 项、开发版 8 项。
- 手机底栏改为悬浮条：左右 12px、底部 10px + 安全区、18px 圆角、阴影。
- 375 / 390 / 1440 实测，图标 + 文字可见，无横向滚动。
- 全量检查全绿。

## 2026-11-16 导航缓存修复（v0.7.141）

- 构建期给 `app.css` 加内容指纹，URL 随内容变化，绕过 Cloudflare/Safari 4 小时缓存。
- 手机底栏项高度 40px、标签 10.5px，避免紫色胶囊被压扁。
- 375 / 390 / 1280 / 1440 实测通过。

## 2026-11-16 导航修复（v0.7.140）

- 旧图标轨 CSS 隐藏了 `.dock-label`，新 App.vue 只有文字，手机底栏只剩空胶囊。
- 标签改为始终可见；手机底栏全宽；`viewport-fit=cover` + `env(safe-area-inset-bottom)` 适配 iPhone XS。
- 375 / 390 / 1280 / 1440 实测，无横向滚动。

## 2026-11-16 站点包接入（v0.7.139）

- 第一版密文包：308 站，217,240 字节；明文 host 扫描 0。
- `target.js` / `crawl.js` 已接内置包回退；私有 `data/` 优先；缺密钥回退。
- `/api/dev` 增加 `pack` 状态；设置页展示待补。
- `site-pack` 检查 5/5，全量全绿。

## 2026-11-16 站点包基础设施（v0.7.138）

- `site-pack.js` 加载器、`build-site-pack.js` 生成器、`site-pack.js` 检查已落地；检查 5/5。
- dry-run：308 站、1409 分类、自动匹配 913（64.8%）；真实包待 `PTA_SITE_PACK_KEY`。
- 尚未接入 target/crawl；下一步生成第一版密文包并接运行时。

## 2026-11-16 站点包方案（v0.7.137）

- 已定：站点包跟程序发布；仓库只放 `pta/pack/site-pack.enc` 密文；密钥只放部署环境变量 `PTA_SITE_PACK_KEY`。
- 用户零操作；私有 `data/site-defs` / `data/site-pack.json` 优先覆盖；缺密钥回退并提示。
- 详细设计 `pta/docs/SITE-PACK.md`；下一步按 M11 写加载器、生成器、`site-pack` 检查。
- 本次只写计划，不改运行代码。

## 2026-11-16 NexusPHP 默认映射校正（v0.7.136）

- 表单页 `/upload.php`、提交页 `/takeupload.php`；字段 `small_descr`、`type`、`uplver=yes`。
- 分类数组按 purpose 自动转成发布分类对象；target 10/10。
- 来源与 clean-room 记录追加到 `pta/docs/UPSTREAM.md`。

## 2026-11-16 识别页路径拆分（v0.7.135）

- `uploadMap` 新增 `formPath`；识别页和提交页分开，避免拿 POST 地址当表单页。
- 识别接口返回 `formPath`；本地夹具覆盖 `/upload-form` 与 `/takeupload.php` 不同的情况。
- 全量检查全绿。

## 2026-11-16 上传表单映射（v0.7.134）

- 上传配置新增上传表单字段表，保存写回 `uploadMap`；路径、文件字段、字段/模板都能改。
- “从目标站识别”手动单次 GET，解析上传页字段；60 秒冷却，失败保留手工编辑。
- 解析器与本地夹具：`pta/server/form.js`、`pta/fixtures/upload-form.html`；form 5/5、target 9/9、api-v2 23/23、smoke 21/21。

## 2026-11-16 分类映射 UI（v0.7.133）

- 上传配置新增分类映射表格：数组模式“站点分类 → 库内分类”，对象模式“库内分类 → 目标站分类 ID”。
- 支持增删改；保存写回 site-def，重建 cats，其他字段保留。
- api-v2 22/22、smoke 21/21、target 8/8，全量全绿。

## 2026-11-16 规则对账（v0.7.132）

- 未接规则 50 → 40；转正“发布后校验”“截图至少几张”，删除 8 条重复/无读者行。
- 目标站真发布增加截图门槛；回查开关接到流程页。
- target 检查 8/8；规则体检 0 缺读者；新增 `pta/docs/RULES-RECONCILIATION.md`。

## 2026-11-16 CSS 选择器清理（v0.7.131）

- 按源码类名 + 本地 DOM + 动态类白名单删除 453 条无引用规则，恢复 `.dl-row.is-archived` 2 条；净减 451 条。
- `app.css` 137,605 → 103,703 字节；保留 `.cm-*` / `.map-row` 给分类映射 UI。
- 窄屏设置页长说明改为换行，390 下不再溢出卡片。
- 三宽度七页验收通过，0 JS 报错；全量检查全绿。

## 2026-11-16 旧资产清理（v0.7.128）

- 删除 `pta/archive`（web demo + v1 后端）、`pta/checks/api.js`、`run.cmd`。
- `routes-missing.js` → `routes-extra.js`。
- DECISIONS/PRIOR-ART/example 迁到 `pta/docs`；v1 API/ARCHITECTURE/DEPLOY/PIPELINE 删除。
- 删除零引用 scripts；保留 README i18n/banner 和独立 scripts/bluray。

## 2026-11-16 Vue App Shell（v0.7.127）

- 登录、hash 路由、顶栏状态、Toast/Confirm、页脚搬进 `App.vue`；`src/legacy` 删除。
- 规则数据移到 `src/data/rules.js`。
- smoke 21/21；七路由和登录行为不变。

## 2026-11-16 legacy 清理（v0.7.126）

- `src/legacy/app.js` 5321 → 1314 行；只剩 chrome/nav/menu/router/runtime/auth/devfoot。
- 删除 8 个旧页面函数和死流程 helper；App.vue 四个旧弹窗删除。
- v1 后端归档到 `pta/archive/server-v1.js`；退休测试删除；`run.cmd` 只提示用 WSL/Git Bash。
- 全量检查全绿。

## 2026-11-16 外部元数据（v0.7.124）

- 无 key：Wikipedia 搜索 + 摘要；有 key：TMDB 搜索 + 详情 + 导演/演员。
- `/api/meta/fetch` 自动选 provider；待审核页“查资料”填入副标题/简介。
- key 只从 `TMDB_API_KEY` 环境变量读；不进仓库。
- `meta-ext` mock 5/5。

## 2026-11-16 自检修复（v0.7.123）

- 静态：无 TODO/FIXME，服务端 JS 全量 `node --check` 通过；服务日志无 error/exception。
- 线上：七路由正常、0 JS 报错；添加站点弹窗、上传配置页签可用。
- 修复：smoke 增“面板添加站点与上传配置”，21/21。
- Docker 重建：health 200、登录 200、session 200。

## 2026-11-16 面板站点与上传定义（v0.7.122）

- 站点页可添加/移除面板站点；`GET /api/sites` 合并 base 清单与 `sites` 表。
- “上传配置”页签直接编辑站点定义 JSON，保存到 `data/site-defs/<host>.json`（0600）；不再要求手改文件。
- api-v2 加站点配置契约，21/21。
- 下一步：元数据两种来源（无 key Wikipedia/Wikidata、有 key TMDB）。

## 2026-11-15 M7：rTorrent + Deluge（v0.7.121）

- `clients/rtorrent.js` XML-RPC、`clients/deluge.js` Web JSON-RPC；探测/加种/回查。
- 下载器 `kind` 扩到 qb/watch/rtorrent/deluge；发布按 kind 分派；设置 UI 可选。
- `clients-ext` 用本地 mock 服务，4/4；真实 daemon 未测。
- 下一步：元数据两种来源（无 key Wikipedia/Wikidata、有 key TMDB），以及面板内站点/上传映射配置。

## 2026-11-15 环境与产品边界（v0.7.120）

- 硬约束：产品代码/脚本不写死主机路径；主机路径只放未入库 `.deploy.env` 或环境变量。
- `deploy.sh` 要 `DEPLOY_DIR`；`sync-check.sh` 要 `SSH_HOST/VPS_DIR`；`load-cookies` 找不到密钥退出 2；`notify-tg` 不默认 `/etc`；`goal-autoresume` 用 `OPENCODE_TG_ENV_FILE`。
- 本机 systemd 的 goal timer 显式传 `OPENCODE_TG_ENV_FILE`，代码不迁就本机。
- 检查：`run.sh` 全绿；线上 0.7.120。

## 2026-11-15 M10：失败重试（v0.7.119）

- 调度器对 `failed` 队列条目重试，默认最多 2 次、退避 15 分钟；`retryMax/retryBackoffMin` 可配。
- 失败写 `retries/lastRetryAt/nextRetryAt/retryMsg`；成功转 published；重试失败计入 TG 通知。
- `clients` 夹具加调度重试用例，5/5。
- M9/M10 完成，六项与 M8–M10 全部收口。

## 2026-11-15 M10：Telegram 通知（v0.7.118）

- 通知两条路：Docker env 优先，面板保存加密 token/chat 兜底；不依赖 `/etc/opencode-telegram-bot.env`。
- 事件：调度失败、发布失败、目标站提交失败；设置页有“发送测试”。
- “环境与产品边界”写进 AGENTS：本机权限/路径改本机，产品代码不写死主机路径。
- 下一步：失败重试。

## 2026-11-15 M9：pta CLI（v0.7.117）

- `pta/cli.js`：登录后调 v2 API，支持 status/queue/crawl/screen/publish/targets/target-upload/verify；默认干跑，`--real` 才真发。
- `package.json` 加 `bin.pta` 与 `npm run cli`；凭据只从 `PTA_USER/PTA_PASS` 或 `PTA_COOKIE` 读，不打印。
- `pta/checks/cli.js`：临时后端 + 子进程，7/7。
- 下一步：M10 通知（通用 webhook/Telegram 可选）与失败重试。

## 2026-11-15 M6 UI：队列页媒体入口（v0.7.116）

- 待审核详情加“媒体”卡：路径、Tracker、探测、生成截图（直接写队列）、生成种子。
- 生成的种子 base64 会随“提交目标站”发送，目标站提交不再强依赖源站重新下载。
- smoke 增加媒体卡断言；六项（sources/sites/crawl/归档/M8/M5–M7）全部收口。

## 2026-11-15 M7：watch 目录客户端（v0.7.115）

- `pta/server/clients/watch.js`：绝对路径校验、目录可写/余量探测、`.torrent` 0600 原子写入。
- 下载器加 `kind=qb|watch`；`routes-qb` 增删改/探测/测试分支；`GET /api/downloaders` 回 `kind/watchPath`。
- `publish.js` 支持 watch：写目录后 `client=watch`、`state=watch`、`verified=true`；qB 路径不变。
- `Nodes.vue` 支持类型切换；`clients` 4/4。

## 2026-11-15 M6 API：媒体探测/截图/种子（v0.7.114）

- `routes-media.js`：`GET /api/media/config`、`POST /api/media/probe|shots|torrent`；路径限制在 `PTA_MEDIA_ROOT`，拒绝越界。
- 截图返回 data URL，可直接喂 `/api/queue/:id/shots`；种子落 `data/torrents` 并回 base64，可喂目标站上传。
- `media-api` 6/6；下一步队列页入口 + M7 多客户端。

## 2026-11-15 M6：媒体探测/截图/种子模块（v0.7.113）

- `pta/server/media.js`：`probe`（ffprobe）、`shots`（ffmpeg，HDR tonemap + 回退）、`makeTorrent`（自写 bencode，单文件）。
- `pta/checks/media.js`：合成 2 秒视频，7/7；不联网。
- 下一步：M6 API（受 `PTA_MEDIA_ROOT` 限制）与队列页入口；M7 多客户端。

## 2026-11-15 M5：标题解析与命名（v0.7.112）

- `pta/server/meta.js`：纯文本解析片名、年份、季集、分辨率、来源、编码、音轨、HDR、制作组、分类；生成规范名/副标题/简介。
- `GET /api/meta/parse?title=...`；`/api/publish/preview` 增加 `parsed`/`releaseTitle`。
- `pta/checks/meta.js`：11 条夹具，11/11；不联网，不猜外部元数据。

## 2026-11-15 M8：目标站提交与回查（v0.7.111）

- `pta/server/target.js` + `routes-target.js`：三引擎路径/字段骨架，`data/site-pack.json` 的 `upload` 覆盖；干跑默认，真提交要 `realPublish=true`。
- API：`GET /api/targets`、`POST /api/targets/:host/plan|upload|verify`；队列页加“提交目标站”，成功后写回 `targetUpload/targetVerify`。
- `pta/checks/target.js`：本地 mock 上传页，6/6；不碰真实站。真实站字段由用户私有包确认。
- 检查：`run.sh` 全绿。

## 2026-11-15 M4 收口：七页 SFC + 旧 web 归档（v0.7.110）

- 七个页面全部拆进 `pta/web-src/src/views`，legacy `app.js` 不再初始化页面（只剩 chrome/nav/menu/siteModal/router/auth/devFoot）。
- 旧 demo 的 HTML/assets 移到 `pta/archive/web-demo`；`pta/web` 只保留构建产物 `dist` 和说明，不再改。
- `deploy.sh` 排除 `archive/`；`gen-rules-tree.js` 改读 `pta/web-src/src/legacy/data.js`；`routes-data.js` 只从 `data/sites-data.local.js` 读私有站点清单。
- 检查：smoke-live 20/20，`run.sh` 全绿；线上 0.7.110。

## 2026-11-14 检查环境迁到 Linux（v0.7.70）

- 新增 `pta/checks/browser.js`：Linux 默认用自带 Chromium 新 headless（支持下载），Windows 可用 `PTA_CHANNEL=msedge`；`playwright` 进 devDependencies，首次跑 `npm ci && npx playwright install chromium`。
- 新增 `pta/checks/run.sh`，作为主检查入口；`run.cmd` 保留但只作 Windows 备用。文档里的 MSYS / Windows-only 写法已改。
- `scripts/import-cookies.js` 不再用 `%TEMP%` 找 playwright。
- 安全检查：`AUTH_DEMO` 改为 `demo-pass`，真实面板密码已从仓库与检查脚本移除；旧值仍在 git 历史，需轮换（见 TASKS）。
- smoke 目前 18/23：5 条与当前 demo UI 不同步，已列进 TASKS，待前端搬迁时重写。
- 线上仍是 0.7.64，部署未执行。

## 2026-11-14 unit 降权与 v2 功能补齐（v0.7.71）

- `seedpod.service` 改为 `User=seedpod` + `EnvironmentFile=/etc/seedpod.env`（0600），密码不再写在 unit；重启后 health 正常、登录 200。
- `/opt/seedpod/data` 归 `seedpod`；`/opt/seedpod/pta`、`package.json` 归 `ocbot`，`deploy.sh` 用 `sudo -n systemctl restart seedpod`，已部署 0.7.70/0.7.71。
- v2 `/api/catalog/screen` 接上分辨率、体积、中字、排除/白名单与同片去重；临时库实测 1 选 4 跳。
- `scripts/load-cookies.js` 改为写 SQLite `credentials` 表，加密后 upsert，不再写 JSON。
- `package.json` 声明 fastify/@fastify/static，`start` 指向 `app-fastify.js`，Node >=22。
- 待做：v2 安全响应头、api-v2 契约检查、smoke 5 条遗留、Docker、前端搬迁。

## 2026-11-14 Vite + SFC 第一阶段（v0.7.74）

- 新增 `pta/web-src`：Vite 7 + Vue 3，8 个页面组件（dashboard/sites/crawl/queue/sources/logs/changelog/settings）已从 `index.html` 机械拆分，样式与图片走 `public/assets`。
- `npm run build` 输出 `pta/web/dist`（已 gitignore）；`npm run dev` 起 5173 并代理 `/api`。
- 逻辑暂时仍由 `src/legacy/app.js` 驱动，页面 SFC 目前是静态壳；已用临时 v2 后端实测七个路由可切换、登录正常。
- `pta/web` 旧版保留作回退，迁移期改前端只改 `web-src`；线上暂未切到 dist。
- 下一步：逐页把 legacy 逻辑换成 Vue（先 dashboard/logs，再 sites/queue，最后 crawl/sources/settings）。

## 2026-11-14 线上切到 Vite 构建（v0.7.75）

- `app-fastify.js` 优先服务 `pta/web/dist`（存在 index.html 时），没有才回退 `pta/web`。
- `deploy.sh` 部署前跑 `npm ci && npm run build`；`run.sh` 增加 `build.js`（临时 v2 后端 + 七路由检查）。
- 线上 0.7.75 已切到 dist；旧 `pta/web` 保留回退，不再改。
- 页面 SFC 仍是静态壳，逻辑在 `src/legacy/app.js`；后续修页面直接改 `web-src`。

## 架构与交付约束（长期有效，改之前先看）

- **后端固定**：Node.js 20+ + Fastify 5 + SQLite（`node:sqlite`）。生产入口 `pta/server/app-fastify.js`，路由在 `pta/server/routes-*.js`，数据层 `pta/server/db.js`。
- **前端固定**：Vue 3 + Vite + SFC，源码 `pta/web-src`，构建输出 `pta/web/dist`；旧 demo 在 `pta/archive/web-demo`，不再使用。
- **旧后端**：`pta/server/app.js` 只读参考，不再接需求；服务端改动只进 v2。
- **数据**：`data/seedpod.db` 是唯一事实源；`data/*.json` 是搬迁前的旧数据，只归档不写入。
- **接口**：`/api/*` 路径保持稳定；字段变更先改 `docs/API.md`，再改代码。
- **交付形态**：功能完成后必须能用 Docker 部署（两阶段 `Dockerfile` + `docker-compose.yml`，数据卷挂 `/data`）；生产入口 `app-fastify.js`。
- **换栈要走决策**：换框架、换数据库、引入构建工具（React / Next / Prisma / MySQL 等）先写进 `docs/DECISIONS.md`，不许顺手换。
- **阶段说明**：七个页面已全部 SFC；legacy `app.js` 只保留登录/路由/顶栏/共享工具；旧 demo 已归档到 `pta/archive/web-demo`。

## 每次开工先做（写在最前，别忘了）

1. `bash scripts/sync-check.sh`：对本地 / GitHub / VPS 三方提交；一致才自动 ff 拉取，不一致就停下问作者。
2. 读本文件「现在是什么状态」。
3. 改完：commit → push（Windows 推要带 `-c http.proxy=http://127.0.0.1:4399 -c https.proxy=http://127.0.0.1:4399`）→ `ssh pta 'cd /opt/seedpod-git && git pull --ff-only && bash deploy.sh'`。
4. 收尾再跑一次 sync-check，更新本文件。

完整清单见 [CHECKLIST.md](CHECKLIST.md)；铁律与发版规则见 [AGENTS.md](AGENTS.md)。

## 2026-11-13 AGENTS 对齐 v2（v0.7.66）

- 生产后端确认是 `pta/server/app-fastify.js`（Fastify + SQLite，数据 `data/seedpod.db`），systemd 于 11-13 00:45 切换；旧 `pta/server/app.js` 不再运行，只作参考。
- `AGENTS.md` 改掉“零依赖单文件”的旧描述，新增铁律第 7 条“服务端只改 v2”，故障对照补 fastify 与 node_modules，发版说明注明不传 node_modules。
- 待修：v2 的 `/api/catalog/screen` 只认 rx.deny/allow，0.7.42 的分辨率/体积/地区/简介/中字条件没搬过来（功能缺口）。
- 待修：`package.json` 没声明 fastify 依赖，`start` 仍指向旧 `app.js`；部署机靠手工 node_modules。
- 风险：`seedpod.service` 无 `User=`（root 运行），且面板密码直接写在 644 的 unit 文件里。

## 2026-11-13 协作规范与流程页收敛（v0.7.65）

- 新增 `pta/docs/PIPELINE-RULES.md`：流程页 3 类目 / 9 组 / 70 行（67 个控件）全量清单、三个收敛方案、发布条件 20 条建议表；等作者确认后先出线框再改代码。
- 新增 `pta/docs/DESIGN.md`：颜色/字号/间距变量、组件白名单、文案规则、1280/768/390 三宽度验收、流程页每组 8 行上限。
- 新增 `pta/docs/REQUIREMENTS-TEMPLATE.md`：需求卡模板（背景 / 目标 / 不做 / 规则变更 / 涉及位置 / 验收 / 风险）。
- `AGENTS.md` 增加「协作协议」「复杂度预算」「设计约束」三节；修正后端路径为 `pta/server/...`。
- `RULES-TREE.md` 重新生成，跟上 v0.7.64 的发布条件（23 行）。
- 本次未改页面与接口，只落规范和清单。
- 检查：adapter 19/19、security 2/2、api 45/45 全绿；smoke 与 audit 在 VPS 上跑不了（脚本写死 `channel: msedge`，Linux 没有 Edge），本次未改前端逻辑，等 Windows 侧复跑。

## 2026-11-13 发布卡并组（v0.7.55）

- 「失败与兜底」「内容要求」「发布时机」三组并进「发布条件」，三张卡删掉；发布卡从 11 组降到 8 组。
- 发布条件 19 行，顺序：前 6 项（发布到/多目标站/分辨率/体积/下载完成/完整性）、主站已有同片、站点标限制分发、不满足时、图片上传重试、发布失败重试、连续失败几次暂停该站、失败时推送通知、最大体积、地区版本、必须有简介、必须带中字、BDInfo、截图至少几张。
- 主站已有同片默认值改成「直接跳过（标记目标站已有）」；站点标限制分发默认值改成「标记禁转/限转，不发布」，原两个选项保留为可选。
- 本地 8099 实测：10 组、19 行按 4 列排（4/4/4/4/3）、无横向溢出。

先读 [AGENTS.md](AGENTS.md)；成熟工具的定义格式与可借鉴点见 [docs/PRIOR-ART.md](docs/PRIOR-ART.md)：铁律、必须一起发的文件、发版命令、故障对照都在那里，聊天被压缩后以它为准。

## 2026-11-13 发布卡重排（v0.7.54）

- 最前面新增「发布条件」组：发布到、多目标站、分辨率要求、体积范围、下载完成再发布、种子完整性校验（从目标站/旧发布条件/发布时机移过来，字段名不变，旧配置按名回填不受影响）。
- 「目标站」只剩图床、截图来源、目标站分类映射、发布后校验；旧的「发布条件」改名「内容要求」，只剩最大体积、地区版本、必须有简介、必须带中字、BDInfo、截图至少几张；「发布时机」只剩「不满足时」。
- 发布卡由 10 组变 11 组，本地 8099 实测：组顺序正确、6 行两列无溢出、查重卡不受影响。

## 2026-11-13 抓取卡再收紧（v0.7.40）

- 去掉每行说明小字与卡片描述，标签只留名词；请求限制四项一行四列，输入框 88px。
- 抓取卡高度 524 → 439 → 269，页面首屏能同时看到查重卡。

## 2026-11-13 抓取卡紧凑化（v0.7.39）

- 抓取卡预设每条一行、行距减半，请求限制四项改两列，输入框 110px，抓详情页独占一行；卡片高度约 524 → 439。
- 样式走 .crawl-card 作用域，查重与发布卡不受影响。

## 2026-11-13 详情页抓取（v0.7.38）

- 新增 `pta/server/adapters/details.js`：纯函数解析详情页（rowhead 表格优先，dt/dd 与全文正则兜底），取大小/字节数/分类/媒介/标签/副标题/infohash/发布者/简介/海报/原盘标记/页面标题；认不出留空不猜。
- `crawl.js`：列表入库前按开关抓详情，最多 10 条；每条都计入窗口次数与最小间隔，预算 = 窗口上限 − 已用 − 列表那一次；返回体带 detail {want,tried,ok,failed,stopped}，失败只写 detailNote 不中断。
- 开关存服务端 `config.detail`（默认 false），站点覆盖 ovDetail 优先；`/api/crawl/run` 支持 detail、detailLimit；前端开关点击即 PATCH 并 toast。
- 夹具 `pta/fixtures/nexusphp-details.html` + adapter 检查 19 项全绿；真抓取仍默认关，本次未向任何真实站发请求。
- 部署 v0.7.38 到 /opt/seedpod，health 正常；实测开关 false→true 落库、复原 false，页面无 JS 报错。
- 待做：详情页解析只按 NexusPHP 版式验证过夹具，真实站点版式差异要等开关打开后再抽样确认。

## 2026-11-11 下午第二波（18n → 18z）

- 归档可恢复：数据清单归档行显示「恢复」，批量归档加二次确认
- 请求体上限 1MB → 8MB：带 3 张截图的发布请求不再被断开挂起，超限正常回 400
- 发布表单回显：队列映射补 intro/anonymous/imageHost，目标站不在站点清单也保留原值，简介优先用已存正文
- 发布动作保存 targetSite，批量发布支持默认目标站；没选目标站仍会被拦并计入跳过
- 待审核列表不再返回截图（只回数量），打开条目再取详情；一次读 500 条并提示上限
- 草稿标签预览 + 缺项常驻显示（标签下方列出缺什么）
- 看地址可翻分类（上一类/下一类），并可直接「抓这一类」；期间修了 /api/crawl/plan 与 /api/crawl/run 忽略 catIdx 的 bug
- 发布卡片四行标明还没接（多目标站/图床/截图来源/发布后校验）
- 站点页分页：每页 60 个站，带页码与上下页；分页容器之前漏进 DOM，已补上；翻页会滚回列表顶部
- 新增 pta/docs/USAGE.md：按界面写了准备、抓取、查重、发布四段操作与常见问题
- 抓取接口统一校验 host（长度/字符集），挡住 ../ 与斜杠，防站点定义路径穿越；api 补断言
- 批量设置验证可用；本地 store 补 override/ovInterval/ovDaily/ovDetail/priority 五个字段
- 所有响应加 nosniff / X-Frame-Options / Referrer-Policy / CSP（放行 Cloudflare 分析脚本），公网验证页面正常，剩登录前 /api/session 的预期 401
- 检查：smoke 23 / audit 0 问题 / adapter 18 / security 2 / api 43 全绿

## 2026-11-11 下午的改动

- 仓库结构收敛：pta 自己的代码只在 `pta/`（server/web/checks/fixtures/data/docs/scripts），仓库根保留 README/LICENSE/AGENTS/.github/项目级 scripts/docs/styles/package.json/Docker/HANDOFF/TASKS/PLAN；这条已写进 PLAN.md 与 AGENTS.md
- 第二步「筛选」改名「查重」：数据清单加「查重」按钮，调 `/api/catalog/check` 跟队列/本地库/已送审已发布比对，重复的标「已有」并记 dupNote（悬浮可见），只打标不改状态；标记筛选加「已有（重复）」
- 归档按钮改成「归档已跳过/已有」：把跳过项与标了已有的新词条一起归档，includeDup 不碰已送审/已发布
- 站点覆盖真正生效：白名单补 override/ovInterval/ovDaily/ovDetail/priority，打开「单独设置本站」后间隔与每天次数按站点走，仍被全局 30 秒与每天 20 次压住
- 流程页规则里的开关全部换成可点击文字按钮（开/关）；发布卡片删掉发布顺序/只在时段内发布/免审直接发的分类，自动发布总开关前移，人工点通过改文字按钮
- 排除/白名单正则存进流程配置（rx）并真正参与送审筛选，语法错退回纯文本
- 站点抽屉：基本信息并进登录、备注去掉、站点地址进登录页签、架构缩成小选择放抓取按钮右边、启用开关挨着抓取按钮
- 规则树文档 pta/docs/RULES-TREE.md（node pta/scripts/gen-rules-tree.js 生成）
- 修抽屉文字开关丢值：芯片带原 data-switch 键，分类 chips 选择器排除开关芯片
- 待审核「生成草稿」后在简介下面显示去重后的发布标签
- 检查：smoke 23 / audit 0 问题 / adapter 18 / security 2 / api 39 全绿
- 公网回归（18n）：七个路由逐个打开无 JS 报错；数据清单 100 行、查重按钮、归档按钮、标记筛选 8 项都在
- 修请求体上限：1MB 会把带 3 张截图的发布请求 destroy 掉导致挂起，现在 8MB 上限且超限回 400，api 有回归用例

## 2026-11-11 上午的改动（按用户反馈）

- 去掉流程页单独的「词条库」块：词条只在数据清单页看，筛选/标记/送审/归档都在那一页
- 数据清单：站点/类型/状态/标记四个筛选，全部来自真实数据；行内可送审、归档、点标题开站点详情页；分页每页 100（一次读 2000）
- 抓取：流程页先选「来源站」，没选不抓；「看地址」只读本地配置显示下一抓 URL；站点抽屉也能直接抓一页（带确认）
- 抓取标记补「未满 7 天」：读行里的 data-added / data-time / time datetime，7 天内的打 limitedDays，只打标不过滤
- 待审核：目标站单独选（发布记录区分 site 目标站与 sourceSite 来源站）；跳过走服务端 skipped；加了「全部发布」
- 设置页去掉所有没后端的假项（面板密码/2FA/通知/备份/API 令牌），用户名与版本读后端，退出登录走 /api/logout
- 安全修复：真实站点清单从 web 根挪到数据目录，服务端对 *.local.* 一律 404，公网该路径已验证 404；登录后 /api/sites 仍带 305 站与标题
- 检查：smoke 22 / audit 0 / adapter 18 / security 2 / api 37 全绿

- cookie 保存后能看到结果：页签显示「服务端已保存 + 更新时间」，自检结果保留；修了两个没挂 data-act 导致点了没反应的按钮（cookie 自检、确认预设）
- 「干跑」统一改名「演练」，内部仍用 dryRun；一轮抓多少条可选 5/10/20/100 并记住，站点覆盖的「每天抓几次」注明不是条数
- 「未满 7 天」显示剩余天数，标记筛选带说明：标题关键词 / 站点发布时间，只打标不过滤

## 现在是什么状态

前端 7 个页面 + 登录页，全部交互可点（无死按钮，`pta/checks/audit.js` 守着）。
后端是本机 Node 零依赖服务，已实现：会话登录、配置读写、站点清单、事件日志、SSE、静态托管、
站点定义与搜索预设、cookie 导入与登录自检、下载器配置与探测（含磁盘余量）、
**三步流水线**：抓取（单次 GET + 分类轮转 + 页码续抓 + 30 秒/每日 20 次/并发锁）→ 词条库（去重、状态流转、批量归档，统一在数据清单页看）
→ 筛选（按面板条件 + 本地库/队列/已送审词条判重）→ 待审核 → 发布草稿（标题/副标题/简介/标签/分类建议）→ 发布记账。
面板上的数字全部来自后端真实数据（`/api/stats/overview`、下载器 `lastProbe`、crawl-state），没有假数据。

线上：源码直跑在测试机 `/opt/seedpod`，systemd 服务 `seedpod`，nginx 反代 + Cloudflare，入口是 pta 开头的那个域名。
开机自启已配；改完代码 `systemctl restart seedpod` 生效。

测试机上 `/opt/seedpod` **不是 git 仓库**，发版是复制文件（发前先备份到 `/opt/seedpod/backup-时间戳/`）：

22 端口时通时断，用 tar 走 ssh 最省事（发完核对 md5）：

```
tar czf - package.json pta/server pta/web pta/checks | ssh pta "cd /opt/seedpod && tar xzf - && systemctl restart seedpod && systemctl is-active seedpod"
md5sum pta/server/app.js pta/web/index.html pta/web/assets/app.js pta/web/assets/app.css
ssh pta 'md5sum /opt/seedpod/pta/server/app.js /opt/seedpod/pta/web/index.html /opt/seedpod/pta/web/assets/app.js /opt/seedpod/pta/web/assets/app.css'
```

不要覆盖 `/opt/seedpod/data/`（凭据、词条、队列、日志、真实站点清单都在里面）。换 js 一定要同步改 `pta/web/index.html` 里的 `?v=`，Cloudflare 会缓存。

发版要带上的文件（少一个就起不来或页面白屏）：

- `pta/server/app.js` 与 `pta/server/adapters/nexusphp.js`（少了 adapter 会 MODULE_NOT_FOUND 起不来）
- `pta/web/index.html`、`pta/web/assets/app.js`、`pta/web/assets/app.css`、`pta/web/assets/data.js`
- `data/site-defs/<host>.json`（站点定义，按需）

部署到新机器时记得把真实站点清单放进数据目录 `data/sites-data.local.js`（web 根不需要它，服务端也不对外提供）；
其它别覆盖：`pta/data/site-arch.local.csv` 与 `data/` 下任何文件。
Cloudflare 会缓存不带版本号的 js，换版本一定同步改 `index.html` 里的 `?v=`。

## 后端接口（已实现）

| 接口 | 说明 |
| --- | --- |
| GET /api/health | 探活，不需要登录 |
| POST /api/login | 账号密码换 HttpOnly 会话 cookie（12h） |
| GET /api/session | 当前是否已登录 |
| POST /api/logout | 注销 |
| GET /api/config | 系统硬底线 + 用户配置 + 双模式区间 |
| PATCH /api/config/user | 改速率，越界 400 |
| GET /api/sites | 305 个站点（host/url/arch）与架构统计 |
| GET /api/site-config | 服务端保存的站点配置（白名单字段） |
| PUT /api/site-config/:host | 合并写站点配置，密码/cookie/totp 拒收 |
| DELETE /api/site-config/:host | 删掉站点配置并恢复默认 |
| GET /api/credentials | 站点凭据状态（只回 hasCookie） |
| PUT /api/credentials/:host | 加密保存 cookie |
| DELETE /api/credentials/:host | 删除凭据 |
| POST /api/sites/:host/session-test | 只用 cookie 做一次会话自检（不碰密码与 2FA） |
| GET /api/flow | 抓取/查重/发布三套规则的服务端存档 |
| PUT /api/flow | 合并保存流程规则（形状有校验） |
| GET /api/site-search | 所有站点预设的汇总（列表页标已确认/未确认用） |
| GET /api/sites/:host/search | 该站的搜索预设（引擎/路径/参数名/分类 id） |
| PUT /api/sites/:host/search | 合并写搜索预设，字段有校验 |
| DELETE /api/sites/:host/search | 删搜索预设 |
| GET /api/downloaders | 已配置的下载器（密码只回 hasPass） |
| POST /api/downloaders | 新增下载器，地址必须是 http/https |
| PUT /api/downloaders/:id | 按字段改下载器 |
| DELETE /api/downloaders/:id | 删除下载器 |
| POST /api/downloaders/:id/test | 只连它自己填的地址做一次连通性探测 |
| GET /api/library | 本地片库（查重用，最多 2000 条） |
| POST /api/library | 新增本地库条目 |
| DELETE /api/library/:id | 删除本地库条目 |
| POST /api/queue/:id/check | 本地查重（队列 + 本地库，不联网），回写 check/checkCls |
| GET /api/queue | 待审核条目与各状态计数 |
| POST /api/queue | 新增待审核条目（title 必填） |
| GET /api/queue/:id | 单条详情 |
| POST /api/queue/:id/action | approve / reject / publish，带状态机校验与发布前置校验（缺标题/预设/下载器时 409 PUBLISH_BLOCKED） |
| DELETE /api/queue/:id | 删除条目 |
| POST /api/tasks | 提交演练任务（只接 dryRun，不访问外部站点）；带 plan：页数/并发/分类组/预估查询数/警告 |
| GET /api/tasks | 最近 50 条任务，`?state=active` 只看在跑的 |
| GET /api/tasks/:id | 单条任务与步骤进度 |
| POST /api/tasks/:id/cancel | 取消排队/运行中的任务 |
| GET /api/logs | 最近事件，支持 level/src/since/limit 过滤 |
| GET /api/logs/stream | SSE，断线按 id 补历史 |

事件会写进 `data/events.log`：服务启动、登录成功/失败、退出、改配置、改站点配置、改搜索预设、待审核条目增删与状态变更、演练任务新建与完成、任务取消。

数据文件（都在 `data/` 下，0600）：`config.json` 面板配置、`site-config.json` 站点配置（密码类字段不落盘）、
`queue.json` 待审核条目、`downloaders.json` 下载器（密码只写不读）、`site-search.local.json` 搜索预设（在 `pta/data/`，不入库）。

## 搜索预设怎么来的（可复现）

用本机 Chrome 的登录态读每个站的种子页（`/torrents.php` 或 `/torrents`），从页面里解析三类写法：
分类链接（`?cat=401`、`cat406=1`）、下拉框 option、图标 `img[title]`；再按标签关键词归到用途（movie/tv/doc/anime/music/book/game/other），
顺带记下该页真实存在的搜索参数名（`search` / `search_area` / `search_mode`，UNIT3D 是 `name` + `categories[]`，Gazelle 是 `searchstr` + `filter_cat[]`）。

Chrome 必须以 `--remote-debugging-port=9222` 启动，脚本用 CDP 连过去，每站新开标签、只发一次 GET、读完即关，站与站之间停 4 秒。
采集结果写 `pta/data/site-search.local.json`，再复制到 `/opt/seedpod/data/` 并重启服务。

截至 2026-11-10：已采 7 站 / 108 个分类 id，其余站点还没采。

## 站点搜索预设为什么单独存

同一个分类 id 在不同站点对应的类型不一样，搜索参数名也各不相同（nexusphp 用 search/cat，unit3d 用 name/categories[]，gazelle 用 searchstr/filter_cat）。
写死一套会导致「想搜电影却点到别的类型」，所以按站存一份：引擎、搜索路径、参数名、每个用途对应的分类 id。
真实预设只在本机与测试机，仓库里只有 `docs/site-search.example.json` 示例。

## 线上验证（最近一次）

改了四个文件后重启，实测：登录通过、`/api/sites` 305 条（NP 83 / UNIT3D 46）、`/api/site-search` 0 条（还没采）、
`/api/queue` 0 条、`/api/downloaders` 0 条、干跑任务能提交并按 5 步跑完、公网入口 200。
带 `?v=` 的新前端已经生效，不带版本号的 app.js 仍是 Cloudflare 旧缓存。

## 站点适配（新）

- `pta/server/adapters/nexusphp.js`：纯解析层，`detect / parseCategories / parseList / buildSearchUrl / parseLoginForm`，不发任何请求
- `pta/fixtures/nexusphp-browse.html`：脱敏夹具，`pta/checks/adapter.js` 5 条断言守着它
- `pta/data/site-defs/<host>.json`：每站一份定义（登录、搜索参数、分类、限速），由 `scripts/collect-site-defs.js` 从采集结果生成，不入库
- 示例结构见 `docs/site-def.example.json`

真实页面回放（本机保存的、脱敏前不落库）：三页各 100 行，标题/分类/下载链接都是 100/100，
大小字段还没对齐——这几个站的大小不在行内文本里（有被用户脚本改写或放在别的列），要按站单独取。

适配器的坑记一下：NexusPHP 的行内嵌了 `<table>`，按 `<tr>` 切行会把一行切成几段；
现在改成「按 details.php 链接定位 + 前后窗口取字段」，并且必须排除 `userdetails.php`（它包含 `details.php` 子串）。

## 站点凭据（只有 cookie）

站点登录改成只用 cookie：面板里粘贴或由脚本导入，服务端 AES-256-GCM 加密存 `data/credentials.json`，
接口只回 `hasCookie`，`POST /api/sites/:host/session-test` 用 cookie 访问首页判活。账号密码与 2FA 已移除；
面板自己的登录（`PTA_USER`/`PTA_PASS`）没有动。

## 旧记录：凭据与登录自检

`server/totp.js` 已删除，相关接口与测试一并移除，这一节只留作历史。

- `pta/server/secretbox.js`：AES-256-GCM 加解密，密钥 `PTA_SECRET` → `data/.secret`（0600）
- `data/credentials.json`：只存密文；接口与日志都不出现明文
- 登录页采样用无痕上下文（否则已登录会跳走）：7 站里 6 站拿到表单，其中 2 站有 2FA 字段

## cookie 导入流程（推荐路径）

```
node scripts/import-cookies.js                 # 本机 Chrome（9222）读各站 cookie → pta/data/cookies.tmp.json（0600）
base64 -w0 pta/data/cookies.tmp.json | ssh pta "base64 -d > /tmp/cookies.json && chmod 600 /tmp/cookies.json"
ssh pta 'cd /opt/seedpod && PTA_DATA=/opt/seedpod/data node scripts/load-cookies.js /tmp/cookies.json; rm -f /tmp/cookies.json'
```

服务端用 `data/.secret` 加密后写 `data/credentials.json`；接口只回 `hasCookie`。
2026-11-10 实测：导入 7 站，服务端用这些 cookie 访问首页全部判定为可用（服务端 IP 与浏览器不同也没被拦）。

## 批量采样（脚本）

`node scripts/sample-sites.js [数量] [偏移]`：连本机 Chrome 的调试端口（9222），逐站打开种子页、等渲染后取 `page.content()`，
gzip 存到 `pta/data/samples/<host>.html.gz`，状态写 `_state.json`。

- 每站只发一次 GET，读完关标签，站间随机 4–6 秒
- 已有样本自动跳过，可以按偏移分批续跑
- 样本与状态都在 `pta/data/` 下，不入库

2026-11-10 首批 12 站：10 个存下（1 个页面过小、1 个证书链无效直接跳过），离线分析 8/10 可解析（分类与列表都出来了），
另外 2 个不是 NexusPHP 结构、需要单独看；大小字段普遍还取不到，按站的表格列差异较大。

## 站点适配现状（2026-11-10 全量采样后）

清单 307 个站，**每站都有站点定义与搜索预设**：

- 真实采样确认引擎：144 站（其中 22 站是 JS 空壳页，按页面资源特征认出引擎、分类待补）
- 按清单架构推断：164 站（定义里 source.kind=arch，预设 source=arch，面板上标「按清单架构推断」）
- 没拿到的原因是登录墙、连不上、Cloudflare、路径 404、停放域名，分类清单见 pta/data/blocked-*.txt（不入库）

当前原始样本 113 份在 `pta/data/samples/`（不入库）。流水线一条命令：

```
node scripts/pipeline.js           # 分析 + 生成定义/预设 + 校验 + 覆盖率
node scripts/pipeline.js --sample  # 先补采样（每站一次 GET，站间 4-6 秒）
```

产物：`pta/data/{analysis.json,site-defs/,site-search.local.json,coverage.json}`；
详细流程与失败分类见 `docs/PIPELINE.md`。

## 抓取（第一步）怎么跑

`POST /api/crawl/plan {host}` 只拼 URL 不发请求（可先看要抓哪个地址）；
`POST /api/crawl/run {host}` 真发一次 GET，按站点定义的搜索参数取第一页，
解析后进词条库（`server/catalog.js`），命中的禁转/独占/DIY/限转只打标记。
服务端硬约束：同站两次抓取至少隔 30 秒（不足返回 429 TOO_SOON），同一站同时只允许一次（并发第二个返回 409 BUSY），
单站每天最多 20 次，一轮默认抓 100 条（面板可切 5/20/100 先小量试），没 cookie 返回 409 NO_COOKIE，cookie 失效返回 409 LOGIN_REQUIRED，串行、不重试轰炸。
抓取按预设分类轮转（每次换下一个分类，抓完一圈回到第一个），页码续抓记在 `crawl-state.json`，
`GET /api/crawl/status?host=` 能看今日次数、当前分类、页码与冷却剩余；`/api/site-def/:host` 里也带这份进度。
面板「抓取」页右上角先选「来源站」，再点「抓一页」；没选来源站不会瞎抓（以前会默认抓清单第一个站）。词条不再单独开一块面板：抓回来的东西统一在「数据清单」页看，
那页是唯一的词条列表，按站点/类型/状态筛，行内点禁转/独占/DIY/限转打标记，可单条送审、单条归档、批量「按条件送审」和「归档已跳过」，
标题点开是该站详情页（相对路径按站点定义 base 补全）。站点抽屉的概览也用真数据：今日次数/已收录/最近 6 条都来自服务端。
第二步「筛选送审」：`/api/catalog/screen` 挑出可发的送待审核，其余标 skipped 并记原因。
第三步「草稿预览」：`/api/publish/preview?id=` 组装标题/副标题/简介/标签并给缺项提醒。

## 判定同一条种子（不要重复转载）
`server/match.js`：先比 infohash（相同即同一条，不同即不是），再比归一后的标题、年份、分辨率、
体积（差 8% 以上判不同版本，2% 内加分）、发布组。
`POST /api/queue/:id/check` 用的就是它，返回的每条命中都带理由。

## 检查

```
pta\checks\run.cmd
```

线上面板真机验证（要本机 Chrome 开着调试端口，只访问面板自己的域名）：

```
PTA_UI_URL=https://面板域名 PTA_UI_USER=xxx PTA_UI_PASS=xxx node scripts/verify-live-ui.js
```

10 条断言：能登录、站点清单渲染、覆盖统计条、预设列显示引擎与组数、详情能开、
设置能切到搜索预设页签、页签里显示引擎与来源、显示分类 id、能确认预设、登录页签有 cookie 自检按钮。
2026-11-10 实测 10/10 通过（确认预设那步会真写一次服务端预设）。

- smoke.js 22 条：登录、七页渲染、分类映射、越界拦截、上传/查重、导出下载、确认弹窗、无 JS 错
- audit.js：逐个点所有可点元素，报死按钮（目前 0 问题）
- adapter.js 18 条：四种引擎（NexusPHP / UNIT3D / Gazelle / 兜底）的分类、列表、搜索 URL、登录态判定
- api.js 37 条：健康、配置区间、落盘、站点清单、凭据读写与批量导入、预设读写、定义摘要、抓取节奏与并发锁、词条库 CRUD/标记/批量、筛选、发布记账、干跑任务、日志轮转、登录与 401

改完必须全绿再提交。

## 收尾核对（2026-11-10 第 13 轮）

- `pta\checks\run.cmd` 一次跑完：ALL CHECKS PASSED（smoke 21 + audit 0 问题 + api 26）
- 工作区干净，本地分支与 origin/main 一致（8437e58）
- 线上服务 active，公网入口 200，七个新接口未登录均返回 401（存在且受保护）
- 仓库里没有服务器 IP；真实清单与预设文件都被 gitignore

已知待你决定的一件事：`scripts/PTScripts/*.user.js` 里带真实站点域名（他自己写的油猴脚本，早于本项目的提交），
仓库是公开的，要不要脱敏或移出仓库由你定，我没动。

## 下一步

1. 词条已经能在数据清单页筛 / 单条送审 / 按条件送审 / 发布记账；下一步优先把真实性抓取跑通：选来源站、抓一页，抓回的分类名会自动带上
2. 详情页解析（种子大小、原盘判定）还没接，目前只用列表页字段
3. 站点定义采样补齐：连不上的站需要代理或换网络再跑一次 --sample；登录墙的站要先在浏览器里登录
4. 用户自己存了 cookie 的站，可以逐站抓一页；一轮默认 100 条、间隔 30 秒，失败按错误码说人话

真抓取、真实站点登录一律不做：按用户要求不碰真实站点，不许自己找 cookie，也不做探测或压测。
采样是用户授权的、每站一次 GET 的一次性配额，不要反复重跑。

## 注意

- 真实站点清单只在本机与测试机的数据目录：`data/sites-data.local.js`、`pta/data/site-arch.local.csv`，都已被 gitignore，不要提交；服务端对 `*.local.*` 一律 404，页面也不再引用它
- 面板账号密码不入库，只配在测试机 systemd 环境变量里
- Cloudflare 会缓存 js/css，静态资源已加 no-cache 与版本号；换版本记得改 `?v=` 参数
