# 更新日志

## v0.7.252 · 2026-11-16

### 站点行去掉隐藏列占位
- 列表收窄后，站点行仍给「模式/上次」留了 130px；现在窄列表只用 5 列，站名不再被裁切。
- 响应式 32 项通过。

## v0.7.251 · 2026-11-16

### 站点列表收窄
- 站点列表宽度 360–560 → 320–460，详情区更宽。

## v0.7.250 · 2026-11-16

### 表头去掉「登录」
- 站点列表表头只留「架构 / 站点」，登录状态列内容保留。

## v0.7.249 · 2026-11-16

### 架构数字间距修正
- 架构数字（图例里的「NexusPHP 195」）不再两端拉开，改成从左紧凑排列，项间距 12。
- 固定叫法补上「架构数字」，回复顺序：统计条 → 架构条 → 架构段 → 架构数字 → 数字区。

## v0.7.248 · 2026-11-16

### 统计条紧凑化
- 架构条 400 → 320px，架构段更紧凑。
- 架构条与图例间距 16 → 22，数字区往左收，项间距 13 → 15。

## v0.7.247 · 2026-11-16

### 统计条再调
- 架构条 300 → 400px，架构段间距 1 → 0。
- 数字区间距 18 → 13。

## v0.7.246 · 2026-11-16

### 统计条间距回调
- 架构条加长到 300px，架构段间距 3 → 1。
- 数字区间距 30 → 18，统计条左右间距 34 → 20，内边距回到 9/16。
- 手机端架构条 200px、数字区两端分布。

## v0.7.245 · 2026-11-16

### 统计条间距放宽
- 统计条内边距 8/14 → 11/20，左右间距 24 → 34。
- 架构条加宽到 220px、段间距 2 → 3、高度 7 → 8；架构条与图例间距 14 → 20。
- 图例间距 2/10 → 4/16；数字区间距 22 → 30。
- 手机端同步放宽，数字区两端分布。

## v0.7.244 · 2026-11-16

### 统计条叫法写进文档
- DESIGN.md 新增四个叫法：统计条、架构条、架构段、数字区，附代码选择器和提需求示例。
- 之后对接统一用这四个词，避免「那个条」「这块」说不清。
- 全量检查通过。

## v0.7.243 · 2026-11-16

### 统计条居中 + 站点列表重排
- 统计条整体左右居中；右侧数字不再顶到最右边。
- 架构进度条分段改为方角，只有外轮廓是圆角。
- 站点列表去掉「预设」列；架构芯片移到站名左侧，在线状态小圆点移到站名右侧。
- 全量检查通过，审计 95。

## v0.7.242 · 2026-11-16

### 调度搬到流程页 + 统计卡左右布局
- 调度从设置页移到流程页顶部：开关、间隔、上次结果、立即跑一次；设置页不再有调度卡。
- 站点统计卡改成一条：左边架构分段条（固定 200px）+ 右侧图例，右边总站点数字；两端垂直居中。
- 移动端：架构条缩到 160px，图例和数字自动换行居中。
- smoke 26/26，全量检查通过。

## v0.7.241 · 2026-11-16

### 去掉重复的类型芯片
- 搜索预设里的「类型」和下面按站的「抓取分类」重复，删掉「类型」行。
- 搜索预设保留：媒介、分辨率、优惠。
- 全量检查通过，审计 95。

## v0.7.240 · 2026-11-16

### 抓取卡恢复类型/媒介/分辨率芯片
- 「搜索预设」恢复 4 行：类型（14 项）、媒介（14 项）、分辨率（7 项）、优惠（8 项）。
- 选项按旧版清单原样搬回；类型的具体分类 id 仍由「抓取分类」按站选择。
- 三行标记「未接」：站点搜索参数各不相同，等确认各站 medium/standard 参数后再接。
- 全量检查通过。

## v0.7.239 · 2026-11-16

### 站点页三处 UI 调整
- 统计卡去掉「自检进度 %」，恢复架构分段进度条 + 图例；右侧总站点四个数字保持不变。
- 站点列表列顺序改为 站点 / 预设 / 登录 / 架构。
- 站点详情去掉「上次自检…」一行；切换启用、抓一页、架构下拉、连接自检压成一行。
- 全量检查通过，审计 95。

## v0.7.238 · 2026-11-16

### 站点映射导入增强 + 备份覆盖
- 导入器支持 `manifest.json` 和「域名开头」的文件名，不再只靠页面里的绝对链接认站。
- 每个站额外保存 `raw`（分类 id → 站点原始标签），以后可以重新归类，不用重抓。
- 自动识别上传页时把分类/制作组选项写进 `site-maps.json` 的 `form` 字段，选项变化可对比。
- 备份/恢复包含 `site-maps.json`；备份里已有数据库（cookie 密文）、`.secret`、站点定义、搜索预设、站点状态。
- 全量检查通过。

## v0.7.237 · 2026-11-16

### 从保存的种子页导入分类映射
- 新增 `pta/scripts/import-sitecat.js`：扫目录里的 HTML，认站点、提取「分类名 → id」，写 `data/site-maps.json`。
- 首批导入 111 个页面：识别 30 个站、177 条分类映射；未归类的标签（漫画/有声书/媒介类）留报告。
- 抓取分类会合并总表里的分类，站点定义没写分类也能从总表列出来。
- 部署脚本排除 checks/fixtures/docs/scripts，运行目录不再带测试文件；文档里的「夹具」统一叫「固定样本」。
- 全量检查通过。

## v0.7.236 · 2026-11-15

### 分类芯片去重
- 同一个分类 id 只显示一次（剧集/电视剧、动漫/动画不再重复）。
- 抓取过滤也按 id 去重，避免同一分类抓两次。
- 全量检查通过。

## v0.7.235 · 2026-11-15

### 中文 catMap 也能列分类
- 站点定义用对象形式 `{"电影":"401"}` 时，抓取分类也能列出来（之前只认数组）。
- 抓取过滤同样支持对象 catMap。
- 全量检查通过。

## v0.7.234 · 2026-11-15

### 抓取分类选择回来了
- 抓取卡加「抓取分类」多选：按选中分类抓，全不选等于全抓；每个站分类 id 自己保存。
- 接口 GET/PUT /api/crawl/cats/:host，存在 data/site-search.local.json。
- crawlOnce 按选中 id 过滤分类；计划里的分类组数同步。
- 全量检查通过。

## v0.7.233 · 2026-11-15

### 站点映射总表 + 自动识别
- 新文件 `data/site-maps.json` 存所有站点的分类/制作组映射，不进仓库、升级不覆盖。
- 接口：GET /api/maps、PUT /api/maps/:host、POST /api/maps/:host/detect。
- 自动识别：读目标站上传页的下拉选项，按中文匹配电影/剧集/动漫/纪录片等，直接生成分类映射；制作组给出选项供填。
- 流程页发布卡加「站点映射」按钮：选站 → 自动识别 → 改表 → 保存。
- target 23/23、全量检查通过。

## v0.7.232 · 2026-11-15

### 流程页显示说明文字
- 每个分组标题下显示一句话说明，每条设置下显示提示，不用记术语。
- 分类映射支持中文键（0.7.231）：电影/剧集/纪录片等，movie/doc 自动转换。
- 全量检查通过。

## v0.7.231 · 2026-11-15

### 分类映射以中文为准
- `catMap` 键改成中文：电影→401、剧集→404、纪录片→402 这种；条目是 movie/doc 也能查到。
- 别名：电视剧→剧集、动画→动漫、纪录→纪录片、其它→其他、MV/音乐短片归音乐。
- 两个猫站私有定义已改中文键；target 22/22。
- 全量检查通过。

## v0.7.230 · 2026-11-15

### 终审：补齐后再决定发还是转人工
- 调度流程加终审：送审之后、发布之前，对 pending 条目跑一遍补齐，再检查缺什么。
- 检查项：简介（看条目真实 intro）、副标题、截图下限、BDInfo、目标站是否就绪、分类映射。
- 缺项 → 记 `review.missing`，条目留 pending 转人工；「不满足时」选直接跳过才标 skipped。
- 全齐且真发布开着 → 自动置 approved，下一轮发布。
- 新增开关「必须有副标题」（默认关）；scheduler 6/6，全量通过。

## v0.7.229 · 2026-11-15

### 修正重复的 ③
- 查重卡标题从「③ 查重」改回「② 查重」，页面上不再出现两个 ③。
- 顺序：① 抓取、② 查重、③ 初筛，发布卡内 ④–⑧。

## v0.7.228 · 2026-11-15

### 规则标题改成白话
- 界面显示用 `label`，内部规则名不变，服务端和已保存设置不受影响。
- 目标站搜索→发布前先搜目标站有没有；体积容差→大小差多少算同一部；已有原盘→已有完整蓝光镜像；只有 DIY→只有 DIY 原盘。
- 分辨率要求→最低分辨率；体积范围→最小体积；必须带中字→没中字就不收；排除匹配→命中这些词就不转；白名单→只转命中这些词的。
- 全量检查通过，审计 95。

## v0.7.227 · 2026-11-15

### 查重提前，初筛独立成卡
- 顺序改为 ① 抓取 → ② 查重 → ③ 初筛 → ④ 补齐 → ⑤ 终审 → ⑥ 发布 → ⑦ 发完 → ⑧ 失败通知。
- 初筛独立一张卡：分辨率、体积范围、最大体积、必须带中字、排除/白名单/测试匹配。
- 服务端读取流程规则时把 fetch 组也算进去（screen / target-service / routes-target），不会因为搬家失效。
- scheduler 夹具改用 fetch 组，验证搬组后规则仍生效。
- 全量检查通过，规则 33 条（28 已接），审计 95。

## v0.7.226 · 2026-11-15

### 查重恢复成独立一段
- 上一版把「目标站已有原盘 / 只有 DIY」挪进发布卡，查重看起来像没了；现在合并回「③ 查重」。
- 查重段包含：目标站搜索、体积容差、已有原盘怎么办、只有 DIY 怎么办。
- 流水线变 8 段：① 抓取 ② 初筛 ③ 查重 ④ 补齐 ⑤ 终审 ⑥ 发布 ⑦ 发完 ⑧ 失败通知。
- 全量检查通过，规则 33 条（28 已接），审计 95。

## v0.7.225 · 2026-11-15

### 流程页按 7 段重排
- 抓取卡：① 抓取（来源/优惠/频率/详情页）+ ② 初筛（正则）。
- 发布卡拆成 5 段：③ 补齐与准备、④ 终审与决策、⑤ 发布（站点要求）、⑥ 发完、⑦ 失败与通知。
- 补简介/简介来源/图床在 ③；简介/中字/BDInfo/截图门槛在 ④；分类映射、标签、匿名在 ⑤；校验/抓种/辅种在 ⑥。
- 全量检查通过，规则 33 条（28 已接），审计 95。

## v0.7.224 · 2026-11-15

### 发布卡重排成 4 段 + 预览看最终表单
- 发布卡从 6 组压到 4 组：发到哪 / 什么条件才发 / 发布时填什么 / 发完做什么。
- 新增「默认匿名」「自动勾选标签」两个开关，服务端已接；「中文副标题来源」按三档真正生效（源站优先 / 豆影优先 / 只用源站）。
- 排除、白名单、测试匹配挪到抓取卡的「转不转」，正则和发布分开。
- 待审核的预检里显示目标站会填的字段和自动动作（换 tracker/抓种/辅种），不用猜。
- 规则 33 条（28 已接、5 未接），审计 95；全量检查通过。

## v0.7.223 · 2026-11-15

### 发布动作全部可关
- 四个开关：上传前清洗 tracker、发布后抓权威种子、辅种跳过校验、qB 自动种子管理（默认关=true 不自动移动）。
- 开关直接控制上传/回查/辅种/qB 行为；计划里的 autoActions 跟着变。
- 关清洗时按源种直传，计划会明示风险；发布后不抓种子时 targetResults 里没有权威种子。
- target 21/21、publish 8/8、smoke 26/26、全量通过；规则 39 条（24 已接）。

## v0.7.222 · 2026-11-15

### 隐式行为收口：映射留空 + 两个开关 + 发布动作可见
- 制作组只认数字 id 或站点 `valueMaps.team` 映射；组名没映射就留空，预览里标「没映射，已留空」。
- 分类没映射时同样留空并提示，不再猜。
- 新增流程开关：`自动附加 MediaInfo`、`允许联网补简介`，默认开；关掉就不再追加/不再联网。
- 目标站计划多回 `autoActions`（换 tracker、抓权威种子、skip_checking 辅种）和 `anonymous`，面板预览可见。
- target 21/21、全量检查通过、规则 35 条（20 已接）。

## v0.7.221 · 2026-11-15

### 豆影无 key 网页抓取
- 新增豆影（DoubanInfo）网页接口：`POST api.php`，不需要 key，返回豆瓣/IMDb/TMDB 合并信息。
- 用返回数据拼副标题（中文名 / 前两个别名）和 BBCode 简介（海报、译名、片名、年代、产地、类别、语言、上映、评分、片长、导演、编剧、主演、简介、获奖）。
- 网页模式优先豆影，失败回退豆瓣搜索 + Wikipedia；实测 `2012` 拿 423 字简介、海报、IMDb/豆瓣评分。
- meta-ext 9/9、meta 11/11、target 20/20，全量检查通过。

## v0.7.220 · 2026-11-15

### 副标题只搬源副标题 + 无 key 网页取元数据
- 副标题不再自动拼 `· 1080p · 7.90 GB`：只用源副标题，其次中文名，都没有就留空。上一版那段拼接是 0.7.215 自己加的，没有开关。
- 新增无 key 网页模式：豆瓣搜索联想接口取条目/年份/海报/别名，Wikipedia 取剧情简介；`fetchMeta` 默认在没 TMDB key 时走 `web`。
- Wikipedia 搜索带上年份和「电影/电视剧」，并跳过「可以指」消歧义页；实测 `2012 2009` 能拿到《2012 (電影)》312 字简介。
- `providers` 增加 `douban`、`web`；TMDB 网页有 Cloudflare，仍只走 API。
- meta 11/11、meta-ext 7/7、target 20/20、adapter 23/23。

## v0.7.219 · 2026-11-15

### 截图不再设下限
- 「截图至少几张」默认改为 0：真发布不再要求最少截图数，简介里的截图原样全部转载；需要严格时可手动填回 3。
- 服务端没配这条规则时也按 0 处理，不再默认拦 3 张。
- target 20/20；夹具改为显式写入门槛再验证拦截。

## v0.7.218 · 2026-11-15

### 副标题与简介自动转载
- 副标题优先用源站副标题（含别名/版本说明），只有缺分辨率和体积时才补 `· 1080p · 7.90 GB`，重复不拼；上限 200 字。
- 详情页解析新增 `descrBb`：源简介转 BBCode，保留图片 `[img]` 与换行，清掉 HTML 和 CRLF；上限 20000 字。
- 简介里的截图全部转载，不抽样、不按张数截断（12 张用例通过）；源简介超过 20000 字才截。
- 送审建条目时把源 `subtitle / cn / intro / tags / year` 一起带进队列；之前只带标题/分辨率/体积，简介因此丢了。
- 源站详情页没有简介时，真抓取会按「匹配来源顺序」去公开影片库补：有 TMDB key 用 TMDB，没有就用 Wikipedia；只在 `realCrawl` 打开时联网。
- adapter 22/22、meta 11/11、target 20/20；新增用例覆盖简介转 BBCode、副标题优先与去重。

## v0.7.217 · 2026-11-15

### 目标站标签映射
- 站点定义支持 `tagMap`（中文标签 → 上传复选框字段名）和 `tagValue`（默认 `yes`）；内置包生成器同步带这两个字段。
- 上传计划会自动勾选 `国语/国配/粤语/中字/繁简/英字/DIY` 等安全标签；`禁转/限转/官方/应求` 一律不自动勾。
- 条目没有 `tags` 时从标题推断（`国配/粤语/中字/简繁/DIY`），已经带标签的以条目为准。
- 计划输出多回 `tags` 与 `tagFields`，干跑就能看到会勾哪些标签。
- target 19/19；新增用例覆盖标签勾选、禁转/官方拦截、标题推断。

## v0.7.216 · 2026-11-15

### 真实种子跨站辅种跑通 + qB 控制补齐
- qB 新增 `removeTorrent`（可选 `deleteFiles`）、`resumeTorrent`、`stopTorrent`；启动/暂停按 qB v5 优先 `/start`、`/stop`，404 回退 `/resume`、`/pause`。
- `findTorrent` 回 `dlspeed/upspeed/numSeeds/eta/tracker/amountLeft/size`，排查下载进度不用另开接口。
- publish 检查加一项：start→resume、stop→pause 回退与 delete 带 `deleteFiles`，现在 8/8。
- 真实流程实测（猫主站 → 猫测试站）：7.90 GB MiniBD 源种 13 分钟下完；目标站发布回查通过；权威种子 infohash 与源种不同，`crossseed` 用 `skip_checking=true` + 源种 save path 加进 qB，目标 tracker 状态 working，目标站显示 1 个做种者。
- 实测后已删除目标站测试种、移除 qB 两个任务并删除数据、恢复 `realPublish=false`、删除测试队列条目。
- 已知未做：目标站标签（国语/中字等）仍未映射；图片链接已验证可显示。

## v0.7.215 · 2026-11-19

### 发布字段实测修复
- 修复目标站 `small_descr` 只取 `cn`、没拼分辨率和体积；站点副标题现在完整显示（如 `Sample 720 · 720p · 20 GB`）。
- 权威种子详情页可能有两个 download 链接，改为逐个尝试，只收 bencode 种子；目标站生成种子已能落盘。
- 实测猫测试站：标题、副标题、简介文字、匿名正常；测试条目无 imageLinks，简介无图；标签未映射。
- target 18/18、meta 11/11、torrent-clean 6/6、cli 17/17、publish 7/7、smoke 26/26、全量 run.sh 通过。

## v0.7.214 · 2026-11-19

### G12 改为权威种子辅种
- 删除 `target-prepare` 预生成副本入口；不再假设同 infohash 可多份。
- 上传前只把 tracker 清洗成目标站通用 announce，不保留源站 tracker；发布成功后默认抓详情页权威种子，存 0600。
- 新增 `crossseed <queueId> --host <target>`：源种下载完成后，把权威种子加进 qB，`skip_checking=true`，保存路径用源种 save path；不硬链接。
- qB `addTorrent` 支持 `skip_checking`，`findTorrent` 回 `savePath/contentPath`。
- target 18/18、torrent-clean 6/6、cli 17/17、publish 7/7、smoke 26/26、全量 run.sh 通过。

## v0.7.213 · 2026-11-19

### G12 每站独立 infohash 的目标种
- `torrent-clean` 新增 `setInfoField`：只允许改 `info.source` / `info.private`，会改变 infohash 但保留文件布局；`info.name/length/files/pieces` 直接拒绝。
- `target-prepare` 支持 `targetTransforms`：按站改 source/private，生成目标站对应的独立目标种；不再假设同 infohash 可以多份。
- 明确 qB 模型：同 infohash 不能多份；要独立条目必须目标种有独立 infohash，文件布局不同再配硬链接/软链接。
- torrent-clean 6/6、target 20/20、cli 17/17、publish 6/6、smoke 26/26、全量 run.sh 通过。

## v0.7.212 · 2026-11-19

### G12 多目标查重前置
- `target-prepare` 逐目标站查重：已有同标题/同 infohash 时标 `TARGET_EXISTS`，跳过目标种生成。
- 真实上传前再查一次；已有资源只记录 skip，不提交、不发布；`allOk` 把 skipped 视为不失败。
- target 19/19、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## v0.7.211 · 2026-11-19

### G12 提交前生成目标种
- 新增 `target-prepare <queueId> --targets h1,h2`：先取源种，按站生成目标种（只换 announce，info 不变），源种/目标种都存 `data/torrents/` 0600。
- 预生成阶段不发上传请求；qB 后续可直接用目标种/追加目标 tracker，不再等发布后下载。
- target 18/18、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## v0.7.210 · 2026-11-19

### G12 qB 多 tracker 与状态监控
- qB 适配新增 `addTrackers` / `trackerStatus`：同一个 infohash 只保留一个种子，给已下载种子追加多个目标 tracker，不重复 add 副本。
- `trackerStatus` 返回 status/msg/peers，`status=2` 视为 working；未注册/未联系可直接看到。
- mock qB 6/6 通过；预生成目标种已能提供目标 tracker/passkey。
- 下一步接状态机：下载完成 → 追加 tracker → 发布 → tracker working 即完成辅种。

## v0.7.209 · 2026-11-19

### G10 预生成目标种，跳过发布后下载
- 源种存 `data/torrents/source-<hash>.torrent`；清洗后的目标种存 `<host>-<hash>.torrent`，均 0600。
- 目标站上传前就生成权威目标种（源种 + 目标 announce/passkey，info 不变），qB 直接用这个辅种，不再默认下载发布后的种子。
- `--fetch-published` 仅用于异常校验：发布后抓目标站生成种子，对比 infohash；默认不请求。
- target 17/17、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## v0.7.208 · 2026-11-19

### G10 announce 候选检查
- `target-announce` / `announceCandidates`：收集缓存目标种、上传页 tracker 链接、usercp/个人页 passkey，区分 `passkey` 与 `generic`。
- 目标站上传优先用 `passkey` 候选；只有通用链接时也先清洗（不含源站 passkey），站点拒绝再要求 `--announce`。
- 接口/CLI 只回候选来源和类型，不回 announce/passkey 明文；发布成功后仍以目标站生成的种子为最终 tracker。
- target 17/17、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## v0.7.207 · 2026-11-19

### G10 禁止源种直传
- 目标站上传前强制清洗 announce：源种只用于下载，绝不把源站 passkey 传到目标站。
- 目标 announce 自动发现顺序：`data/torrents/` 缓存目标种 → usercp/个人页 passkey → 显式 `--announce`；都找不到就报 `NEED_TARGET_ANNOUNCE`，不提交。
- 源种和目标种都保留：源种用于 qB 下载，目标站生成种子用于后续辅种。
- target 16/16、torrent-clean 4/4、cli 17/17、smoke 26/26、全量 run.sh 通过。

## v0.7.206 · 2026-11-19

### G10 自动清洗种子
- 新增 `torrent-clean`：替换 `announce` / `announce-list`，保留 `info` 原始字节，infohash 不变，才能跨站辅种。
- `target-upload` 支持 `--announce url` 或 `--announce h1=url,h2=url`；目标站已有缓存种子时，自动复用其 announce 清洗源种。
- 清洗只发生在内存/提交前；announce/passkey 不写库、不打印。目标站生成种子仍按 0.7.205 抓取并存 0600。
- torrent-clean 4/4、target 16/16、cli 17/17、smoke 26/26、全量 run.sh 通过。

## v0.7.205 · 2026-11-19

### G10 目标站生成种子抓取
- 发布成功并回查命中后，解析详情页下载链接，抓目标站生成的 `.torrent`，校验 infohash 不变，存 `data/torrents/` 0600。
- `targetResults` / `targetUpload` 记录目标站种子 infohash、大小、是否同 infohash；失败只记 `targetTorrentError`，不拖累已成功的上传。
- 默认策略明确为“源种直传，站点自己替换 announce/passkey”；站点拒绝源种时的自动清洗 fallback 仍未做。
- target 15/15、cli 17/17、smoke 26/26、全量 run.sh 通过。

## v0.7.204 · 2026-11-19

### G10 多目标每站种子
- `target-upload` 支持 `--torrents host=文件,host2=文件2`；`targetTorrents` 可给每个目标站单独种子。
- 多目标提交时按目标站取对应种子，没配的站回退到公共 `--torrent` / 源站种子。
- 目标站夹具覆盖“同一 release 两个站使用不同种子哈希”；CLI 夹具同步覆盖。
- target 15/15、cli 17/17、smoke 26/26、全量 run.sh 通过。

## v0.7.203 · 2026-11-19

### 流程页发布闸门
- 流程页顶部新增“发布闸门”：真抓取 / 自动发布 / 图床实传三个开关，默认全关；开启自动发布需确认。
- 新增“准备下一批（不发布）”：只跑 prepare + preview，不提交目标站，结果导到待审核页人工检查。
- 探测发现写入 `pta/docs/PROBE.md`；具体站名/明细只写私有 `data/probe-notes.md` 与 `data/site-probe.json`。
- smoke 26/26、responsive 32 项、全量 run.sh 通过。

## v0.7.202 · 2026-11-19

### G13 批量只读探测
- 新增 `probe` CLI/API：对有 cookie 的目标站各 GET 一次上传页，解析字段、分类、文件字段；`--write` 写私有 `data/site-probe.json`。
- `detectUploadForm` 改为优先选带文件字段、字段最多的表单，避免把页面搜索框误当上传表单。
- 首批 10 个有 cookie 目标站：8 个表单可用，2 个 `NO_FORM`；修正一个站的文件字段 `file → torrentfile`。
- target 15/15、smoke 26/26、全量 run.sh 通过。

## v0.7.201 · 2026-11-19

### 删除本地演练，抓取计划并入抓取卡
- 整个删除“本地演练（不发请求）”卡片、假进度、`/api/tasks` 演练接口。
- 来源站选择 + 「看地址」并入「抓取」卡头部，计划结果在卡内展开、可收起。
- 全局「抓一页」移除，只保留站点详情里的「抓一页」，避免重复入口。
- 移动端站点页高度改自适应，页脚不再压进站点列表；详情头改上下排。
- smoke 26/26、responsive 32 项、全量 run.sh 通过。

## v0.7.200 · 2026-11-19

### 站点页两栏与统计卡
- 去掉统计卡里的“已适配 N 站 · 有分类 N 站 · 预设已确认 N”覆盖文案；进度条放左，总站点/启用/登录失效/还没自检放右，卡片压到约 38px。
- 站点列表改左右两栏：左侧站点列，右侧概览 + 设置，不再点手风琴；两栏占满卡片高度。
- 分页移到左列底部，外包边框，上一页/下一页改成纯文本链接；移动端上下堆叠，选中站点自动滚到详情。
- 窄列里站点名允许换行，不再省略裁切；移动端隐藏预设列，避免多余换行。
- smoke 26/26、responsive 32 项、全量 run.sh 通过。

## v0.7.199 · 2026-11-19

### G5/G13 三站真实上传、回查与删除
- 三个授权站各发 1 个中性名测试种：`Sample 2026 1080p` / `2160p` / `720p`，均回查命中。
- 三个站都按 `edit.php` 的“其他 / 测试”提交删除，`--check` 删除前 false、删除后 true。
- 三种删除表单差异已覆盖：`reason_type/reason_input`、`reasontype/reason[]`、以及“没有该ID的种子”回查。
- 测试队列已清空，`realPublish` 已关回 false；第 3 个站 cookie 由用户补入后验证通过。
- target 14/14、smoke 25/25、全量 run.sh 通过。

## v0.7.198 · 2026-11-18

### G5/G13 真实目标站上传与删除
- 新增 `target-delete` CLI/API：支持种子 id 或详情链接、dry-run、`--check`、`--real`；兼容 `reason_type/reason_input` 和 `reasontype/reason[]` 两种 NexusPHP 删除表单。
- 收紧上传成功判定：200 错误页里的导航详情链接不再当成功；无详情/成功提示时记录站点错误摘要并按失败落库。
- 两个授权测试站各发 1 个中性名测试种（`Sample 2026 1080p` / `2160p`），回查命中后按“其他 / 测试”删除，`--check` 确认已删；测试队列已清理。
- 第三个站缺 cookie，未提交。
- target 14/14、全量 run.sh 通过。

## v0.7.197 · 2026-11-18

### G10 目标站预检补全
- `/api/targets/:host/plan` 返回 `hasCookie` / `ready` / `warnings`：缺 cookie、缺上传地址、空字段、缺回查地址。
- 待审核“多目标预检”按 ready 显示绿/黄，并列出缺口；不再把没有 cookie 的站显示成绿色可提交。
- target 12/12、smoke 25/25、全量 run.sh 通过；真实提交仍缺目标站权限。

## v0.7.196 · 2026-11-18

### Web UI 细节收口
- 桌面导航改为纯图标右侧悬浮，移出内容卡片；1280 仍用底部导航；鼠标悬停无刷新切页。
- 站点页：总站点统计卡移到搜索框上一行并压缩；工具栏桌面单行紧凑；站点标题再次点击收回；详情改概览左、设置右。
- 发布区：去掉分组灰卡片和字段下横线；卡片标题/分组标题/小节标题/字段标签四级层级；标签与控件左右单行，移动端自动换行。
- 目标站未选择时显示“未选择目标站”，不再出现无意义的问号头像。
- 离开站点页自动收起详情，修复回来点同名站点反而关闭的问题。
- smoke 25/25、responsive 32 项、全量 run.sh 通过。

## v0.7.195 · 2026-11-18

### G10 多目标预检
- 待审核“上传准备”卡显示每个目标站的预检结果：引擎、字段数或未就绪原因。
- “准备上传”按当前勾选的多目标重新生成 prepared，不再沿用旧目标列表。
- smoke 24/24；全量 run.sh 通过。
- 真实 3 站提交/回查仍缺权限，G10 保持 blocked。

## v0.7.194 · 2026-11-18

### G13 覆盖面板
- 新增 `/api/coverage` 和站点页“站点包”弹窗里的“站点覆盖”卡：目标站、有 cookie、可发布、上传/回查、上传计划成功/失败计数。
- 站点包/覆盖入口从设置页移到站点页工具栏“站点包”；设置页不再显示站点工具。
- 面板只显示计数，不打印站名/网址；不联网、不提交。
- 生产：177 目标站 / 9 cookie-ready / 177 上传计划成功。
- api-v2 29/29、smoke 24/24、全量 run.sh 通过。

## v0.7.193 · 2026-11-18

### 去掉基础版/开发版切换
- 移除 `localStorage.pta.mode` 判断；更新日志页常驻底部导航，`#changelog` 不再被重定向。
- 设置页删除“版本模式”卡；基础版/开发版不再分叉，所有功能与更新日志始终可见。
- 更新 `AGENTS.md` 的旧规则；responsive 测试不再预置 `pta.mode`。
- smoke 23/23、responsive 32 项、全量 run.sh 通过。

## v0.7.192 · 2026-11-18

### G13 上传计划 dry-run
- `pta coverage --plan`：对本地可解析目标站逐个生成上传 payload，不联网、不提交。
- 生产结果：177 个目标站全部有上传/回查路径；177/177 上传计划成功，0 失败；9 个有 cookie 且 ready。
- 177 个计划成功只是 dry-run 证据，不等于真实提交；G13 真实提交/回查仍缺权限。
- CLI 17/17；全量 run.sh 通过。

## v0.7.191 · 2026-11-18

### 密钥状态与 qB 验证
- 显式 `PTA_SECRET` / `PTA_SECRET_FILE` 无效时不再偷偷生成 `data/.secret`，避免旧 cookie/密码被假 key 洗掉；`/api/dev` 返回密钥来源/可用状态。
- 设置页显示“凭据密钥”；下载器列表显示 `passReadable`，密码解不开时标“密码失效”；站点凭据显示“已保存但解不开，请重新导入”。
- 密钥不可用时，保存 qB 密码/cookie 返回 `CRYPTO_UNAVAILABLE`，不再假装保存成功。
- CLI 新增 `--env-file`；读生产数据时加载部署环境，避免用错 `PTA_SECRET_FILE`。
- qB 两台用服务端密钥验证在线：v5.1.2 / v5.2.4；之前 403 是未登录 + CLI 用错 key，不是 qB 故障。
- G5 仍缺真实目标站提交/回查；G13 保持 20%。

## v0.7.190 · 2026-11-18

### G13 离线覆盖审计
- 新增 `pta coverage [--list]`：只读统计目标站定义、cookie、上传路径、回查路径和就绪数，不联网、不打印站名（除非显式 `--list`）。
- 生产数据：306 清单站里 177 个能解析出引擎/地址；9 个有 cookie 且可发布；177 个有上传/回查路径（引擎默认）。
- G13 仍 blocked 在真实提交/回查：9 个 ready 只是本地定义就绪，不是真实成功证据。
- CLI 17/17；全量 run.sh 通过。

## v0.7.189 · 2026-11-18

### G5 下载器只读探测
- CLI 新增 `pta clients [--test]`：本地/HTTP 都能列下载器；`--test` 只读探测 qB/watch，不打印 URL、密码或 IP。
- 生产 2 台 qB 探测结果：version 返回 403，login 不被接受；只试一次，不重试，避免触发 qB 风控。
- 这不是代码能绕过的：需要检查 qB WebUI 的 IP 白名单、账号密码、防暴力/封禁状态。
- 真实目标站提交/回查仍缺有上传权限的站点；G5 保持 blocked。
- clients 16/16、crawl 默认干跑、全量 run.sh 通过。

## v0.7.188 · 2026-11-18

### 移除 rTorrent/Deluge 下载器兼容
- 产品范围决定：不再为 PTA 开发 rTorrent/Deluge 下载器兼容；下载器只保留 qBittorrent + watch 目录。
- 删除 `pta/server/clients/rtorrent.js`、`deluge.js` 和 `clients-ext` 夹具；移除 run.sh 的 clients-ext。
- 下载器 API 只接受 `qb` / `watch`，旧类型返回 `UNSUPPORTED_DOWNLOADER`；发布/注入遇到旧类型明确报错，不再落到 qB。
- 面板下载器类型只有 qBittorrent / watch；旧记录显示“已弃用”，编辑时改成 qB 或 watch。
- clients 7/7、smoke 23/23、全量 run.sh 通过。

## v0.7.187 · 2026-11-18

### G4 规则分诊执行
- 按建议接上 8 条服务端读者：目标站搜索、体积容差、必须有简介、BDInfo、图片上传重试、简介图片、年份一致、主演数量。
- 从 `rules.js` 删除 17 条重复/过期规则；15 条继续 `todo:true` 禁用。
- 新增 `flow-config.js`（流程规则读取）和 `dupe-classify.js`（目标站判重，支持体积容差）。
- 规则体检：总数 33、保留 18、未接 15、保留缺读者 0。
- 夹具：dupe-classify 4/4、flow-config 3/3、target 12/12、meta-ext 6/6、api-v2 28/28、smoke 23/23。
- G4 完成；剩余 G5/G10/G12/G13 等真实权限/环境，G14 可选。

## v0.7.186 · 2026-11-18

### G4 规则分诊建议表
- 新增 `pta/docs/RULES-TRIAGE-G4.md`：40 条未接规则逐条对当前服务端能力，给出做/删/暂缓建议。
- 建议：做 8 条、删 17 条、暂缓 15 条；每条写了缺口、接法和代价。
- 未改 `rules.js`，未把建议当已接；等你回复“按建议”或列不同意的编号。
- 规则体检仍是总数 50、保留 10、未接 40、保留缺读者 0。

## v0.7.185 · 2026-11-18

### G6 站点包例外 + Docker/备份
- 新增 `site-pack-admin` + `/api/site-pack` + `/api/site-pack/exception`；设置页站点包卡显示覆盖率/待确认，确认后只写私有 `data/site-defs`（0600），不改密文包。
- 例外确认后回读覆盖率和异常数；支持按分类/站点/ID 筛选，非法站点/用途拒绝。
- 新增 `pta/scripts/backup.sh` / `restore.sh`：SQLite `VACUUM INTO` 一致性快照，处理 WAL/SHM，恢复时清旧 WAL；夹具 4/4。
- Docker 构建、`docker compose up`、重启持久化、备份恢复演练通过（0.7.185，health 正常，恢复后队列条目仍在）；记录写 `pta/docs/DOCKER.md`。
- site-pack 9/9、api-v2 26/26、smoke 23/23、backup 4/4、全量 `run.sh` 通过。
- 剩余 goal 均等真实站点/下载器权限或用户拍板；没有可自动推进的 goal。

## v0.7.184 · 2026-11-18

### G3 拆 Sites.vue
- `Sites.vue` 从 1508 行降到 436 行（目标 600 行以内），API 不变。
- 拆出 `SitesToolbar.vue`（搜索/筛选/批量/自检/添加）、`SitesStats.vue`（统计条）、`SitesList.vue`（列表/分页/详情插槽）、`SiteDetail.vue`（详情/表单/分类映射）、`SitesModals.vue`（批量与添加弹窗）。
- 详情组件独立加载站点定义/预设/词条，父组件只负责列表、筛选、批量与刷新；打开同一站点会强制重载详情。
- smoke 22/22、responsive 32 项通过；站点添加、上传配置、分类映射、搜索筛选均保持原行为。

## v0.7.183 · 2026-11-18

### G11 客户端注入演练
- `publisher.injectPlan` 统一 qB / watch / rTorrent / Deluge 的注入计划：`wouldAdd` / `wouldWrite`、保存路径、分类、hash、幂等、重试状态。
- 新增 `POST /api/queue/:id/inject`；默认演练，真注入复用 `publishItem` 的取种/加种/回查链路。
- CLI 新增 `pta inject <queueId> [--downloader id] [--savepath path] [--category cat] [--real]`。
- 面板新增“注入演练”和上传准备卡片（标题/副标题/媒体/图床/简介预览）。
- 夹具：clients 6/6（watch 计划、已注入幂等、qB 计划、失败重试）、CLI 15/15、smoke 22/22。
- G11 收口；下一步 G3 拆 Sites.vue。

## v0.7.182 · 2026-11-18

### G11 图床转存与链接替换
- 新增 `pta/server/imagehost.js`：默认演练；真上传逐张重试、失败隔离；Pixhost/Imgbox 未验证只演练，不冒充成功。
- `release.prepare` 把 `imageLinks` 追加为 `[img]` 并清掉 data URL；`prepared.imageLinks` 可直接预览。
- 新增 `POST /api/queue/:id/images`；真上传受 `realImages` 开关或 `PTA_ALLOW_REAL` 限制。
- CLI 新增 `pta images <queueId> [--host 站内|Pixhost|Imgbox|本地图床] [--real] [--retries 2]`。
- 面板截图区新增“图床演练 / 上传截图”和摘要显示。
- 新增 `pta/checks/imagehost.js` 7/7；api-v2 25/25、CLI 14/14、smoke 21/21。
- 待做：客户端注入干跑；验证 Pixhost/Imgbox 的实际响应字段。

## v0.7.181 · 2026-11-18

### G11 上传准备：MediaInfo/BDInfo
- 新增 `pta/server/mediainfo.js`：识别 BDInfo/MediaInfo，输出分辨率、编码、HDR、位深、帧率、音轨、字幕、体积、时长和摘要。
- `release.prepare` 接受 `mediaInfo`/`bdinfo`，生成 `[quote]` 媒体块拼进简介；`prepared.media` 返回结构化摘要，目标站上传继续复用 `description`。
- 新增 `POST /api/meta/mediainfo`；队列动作可保存 `mediaInfo`/`bdinfo`。
- CLI `prepare` 支持 `--mediainfo <file>` / `--bdinfo <file>`。
- 待审核媒体区新增文本框、解析、准备上传和摘要显示；smoke 覆盖面板解析/准备。
- 新增 `pta/checks/mediainfo.js` 5/5，接入 `run.sh`；api-v2 24/24、CLI 13/13、smoke 21/21、responsive 32 项。
- 待做：图床转存/链接替换、客户端注入干跑。

## v0.7.180 · 2026-11-18

### Telegram 通知合并与置顶
- 部署后只发一条消息：`工作中：<goal> · <百分比>` + 总进度，不再单独发“已部署 + 提交哈希”。
- 去掉提交哈希等技术内容，只留下 goal、百分比、总进度、更新时间和版本号。
- 进度消息发送后自动置顶；新消息会先取消上一条置顶，再置顶最新一条。
- 置顶状态记在 `~/.cache/seedpod/tg-pin`；置顶失败不影响消息发送。

## v0.7.179 · 2026-11-18

### Telegram 开发进度
- 新增 `scripts/notify-progress.sh`：读取 `PROGRESS.md`，发当前 goal、百分比、总进度。
- `deploy.sh` 部署后自动发一条最新进度；不再只有“已部署”。
- `GOAL-RUNNER.md` 增加规则：每轮更新 PROGRESS.md；单独发进度用 notify-progress.sh。
- 已实测发送成功（message_id 2446）。

## v0.7.178 · 2026-11-18

### 开发进度跟踪
- 新增 `pta/docs/PROGRESS.md`：G0–G14 当前百分比、总进度、阻塞和更新规则。
- `GOAL-RUNNER.md` 固定每轮开头输出“正在开发：Gx · 百分比 · 总进度”。
- 当前：G10 85%，总进度约 49%。

## v0.7.177 · 2026-11-18

### G10 按站结果与重试
- 待审核详情显示每个目标站的提交状态、错误和回查结果。
- 失败目标站提供单独「重试」按钮，只重试该站，不影响其他目标站。
- 重试复用 `/api/queue/:id/targets/upload` 和 target-service 的按站幂等。
- smoke 21/21、构建通过；G10 仍待真实多站提交。

## v0.7.176 · 2026-11-18

### G10 面板多目标
- 待审核详情的“多目标”改为站点芯片多选，保留主目标站下拉兼容旧数据。
- 提交按钮在选中多个目标站时调用 `/api/queue/:id/targets/upload`，逐站提交/干跑。
- `/api/queue/:id/action` 支持保存 `targets`，主目标站自动取第一个。
- target 夹具新增多目标 API 干跑断言；target 11/11、smoke 21/21、responsive 32 项。
- 待做：按站重试 UI、真实多站提交。

## v0.7.175 · 2026-11-18

### 目标站回查修正
- 回查改为解析搜索结果行，不再把搜索框回显的标题当成命中；`rows` 和 `mode` 随结果返回。
- 搜索页 0 行时明确返回未找到；新增回归用例“搜索框回显不算命中”。
- 提交返回 200 但没拿到详情页/成功提示时标记 `uncertain`，不再宣称“已提交”。
- `target-service` 在回查未找到时返回 `VERIFY_FAILED`，写 `failed + nextRetryAt`，不再把未确认的上传标成 submitted。
- target 检查 11/11；全量 run.sh、smoke、responsive、审计 87 通过。

## v0.7.174 · 2026-11-18

### G10 多目标发布（第一切片）
- `prepare` 支持 `--targets h1,h2`，为每站生成独立 payload，存入 `prepared.targets`。
- `preview` 返回 `targets` 列表；单站 payload 继续保留。
- `target-upload` 支持 `--targets h1,h2`，逐站干跑；单站失败只标该站，不阻断其他站。
- 新增 `/api/queue/:id/targets/upload`；target-service 按目标站记录 `targetResults`，单站幂等。
- CLI 夹具：2 个有定义站 + 1 个缺定义站，2 成功/1 失败；target 10/10、CLI 12/12。
- 待做：面板多选目标站、真实多站提交、按站重试 UI。

## v0.7.173 · 2026-11-17

### G0 + G10–G14 目标与执行协议
- GOALS 补 G0 地基；新增 G10 多目标发布、G11 上传准备 1:1、G12 全自动流水线、G13 站点覆盖、G14 可选 Python sidecar。
- 当前 active 切到 G10；G3/G6 作为后续/并行，G4/G5 等拍板/环境。
- 新增 `pta/docs/GOAL-RUNNER.md`：一次性总提示词，按 GOALS 连续执行，不再每轮要指令。
- 明确技术边界：Vue + Node 固定，不引入 Redis/队列/worker/Postgres；不复制 UA/upbrr 代码/声明；真实站需授权。

### 检查
- smoke 21/21、responsive 32 项、CLI 12/12、全量检查、质量审计 87。

## v0.7.172 · 2026-11-17

### G8 原生单 release 上传
- `prepare` 的标题/副标题/简介/目标字段作为上传计划传给 `target-upload`，避免上传时重新拼原始字段。
- `target.submit` 支持 prepared plan override；`target-service` 在 prepared 目标站一致时直接使用该计划。
- `preview` 返回完整 `payload`：标题、副标题、简介、目标 URL/字段、截图数、种子摘要。
- 默认干跑；提交成功写 submitted，注入成功写 injected；失败写 failed + lastError + nextRetryAt。
- CLI 本地 target-upload 断言 prepared 字段与实际上传字段一致；CLI 12/12。
- 全量 `run.sh`、smoke 21/21、responsive 32 项、审计 87 通过。

## v0.7.171 · 2026-11-17

### G9 CLI-first 核心层
- 新增 `pta/core/index.js`：CLI 本地模式直接读 SQLite，不要求先起 HTTP。
- 新增 `pta/server/target-service.js`：目标站提交/幂等/阶段逻辑由 Fastify 路由和 CLI core 共用。
- CLI 本地覆盖 status/queue/crawl/screen/prepare/preview/advance/run/publish/targets/target-upload/verify；`PTA_BASE` / `--http` 保留远程模式。
- 本地 CLI 夹具 12/12；新增本地 target-upload 干跑断言。
- 面板 smoke 21/21、responsive 32 项、全量检查、质量审计 87 通过。

## v0.7.170 · 2026-11-17

### G7 发布状态机
- queue 阶段扩展：`draft / prepared / previewed / submitted / injected / failed`。
- 新增 `pta/server/stage.js`：attempts、lastError、nextRetryAt、evidence、history、failedFrom 统一落库。
- `target-upload` 成功写 submitted，失败写 failed；重复提交 409 `ALREADY_SUBMITTED`。
- `publish` 成功写 injected，失败写 failed；重复注入返回 skipped，不重复 qB add。
- 待审核详情显示阶段/尝试/错误/重试时间，失败提供重试按钮。
- 新增 stage 检查 5/5；target 10/10、publish 5/5 均加幂等断言。
- 全量 `run.sh`、smoke 21/21、responsive 32 项、CLI 9/9 通过；审计 87。

## v0.7.169 · 2026-11-17

### G2 完成：可靠性债收口
- 公共 UI 函数继续收口；`initials` 合并为 `utils/ui.js` 的 `initialsOf(text)`。
- 剩余 Promise `.catch(() => null)`、通知失败 catch 全部补上 `reportError` / `console.warn`；显式空 catch 清零。
- `fmtBytes` 收口到 `utils/format.js`；`loadSites` 按页面数据需求保留两份并写明原因；`tone` / `openAdd` 语义不同不合并。
- 修复质量审计把自身 `TODO|FIXME|XXX` 正则计入 TODO 的自计数问题。
- 质量审计：**87（优质）**，代码 91、复用率 85、质量 100；空 catch 0、TODO 0、console.log 0。
- 全量 `run.sh`、smoke 21/21、responsive 32 项、CLI 9/9 通过。

## v0.7.168 · 2026-11-17

### G2 第一批：公共 UI 函数与错误可见性
- 新增 `pta/web-src/src/utils/ui.js`：`toast / confirmBox / loggedIn / viewVisible` 统一收口，页面内重复定义减少。
- 新增 `pta/web-src/src/utils/errors.js`：显式 `catch (e) {}` 改为 `reportError` / `console.warn`；启动 `console.log` 改为 `console.info`。
- 质量审计总体从 83 升到 **85**；重复函数名从 11 降到 7。
- 全量 `run.sh`、smoke 21/21、responsive 32 项通过。

## v0.7.167 · 2026-11-17

### 测试站真实验证
- 在用户授权的测试站完成一次受控真实抓取：limit 5，返回 38 行，新增 5 条词条；未对生产库写入。
- 本地查重运行正常；单 release 准备/预览通过。
- 真实目标站提交一次：HTTP 200，回查找到种子，未重试。
- 测试站因此会留下一条测试种子，需要用户在站内自行删除；面板不做站点删除。
- 生产 `realCrawl` / `realPublish` 仍保持默认关闭；验证使用临时数据副本 + 临时 `PTA_ALLOW_REAL=1`。

### 检查
- smoke 21/21、responsive 32 项、全量检查、质量审计 83。

## v0.7.166 · 2026-11-17

### 单 release 准备与阶段推进
- 新增 `pta/server/release.js` 和 `routes-release.js`：`prepare` / `preview` / `advance` / `run`，只做本地准备，不发外部请求。
- queue 条目增加 `stage`：`draft / prepared / previewed / submitted / injected / failed`；准备结果存 `prepared`（标题、副标题、简介、目标字段、截图数、种子摘要）。
- CLI 新增 `prepare <id>`、`preview <id>`、`advance <id>`、`run --stage prepared|previewed`；默认本地，提交仍走 `target-upload` / `publish`。
- 测试站补了私有 NexusPHP 上传骨架（只在部署 `data/site-defs/`，不入库），已用其做本地准备/预览，未发提交请求。
- CLI 夹具 9/9；新增 prepare/preview/advance/run 断言。

### 检查
- smoke 21/21、responsive 32 项、全量检查、质量审计 83。

## v0.7.165 · 2026-11-17

### CLI-first 与 G9
- 新增 `pta/docs/CLI.md`：说明现有 `pta/cli.js` 的位置、认证、命令和当前限制。
- 新增 G9：抽 `pta/core/` 服务层，CLI 与面板共用；抓取、查重、发布、验证全部命令行可驱动，面板只做视图。
- 目标命令：crawl / screen / queue / prepare / preview / publish / target-upload / verify / advance / run。
- 默认干跑，`--real` 才真发；`--json` 可脚本化；不重复业务逻辑。
- 明确 G8 原生上传排在 G9 后，不接 UA/upbrr CLI。

### 检查
- smoke 21/21、responsive 32 项、全量检查、质量审计 83。

## v0.7.164 · 2026-11-17

### G7 / G8 目标
- 新增 G7 发布工作流状态机：阶段落 SQLite、幂等、可恢复、可重试，仍保持单进程 + SQLite。
- 新增 G8 原生单 release 上传准备与站点提交：不接 UA/upbrr、不调用它们 CLI；自己实现元数据/媒体/规则/查重/预览/提交/注入。
- 明确不引入 Redis、消息队列、独立 worker、Postgres；真实提交依赖 G5 的站点权限和 daemon。
- `UPSTREAM.md` 追加 UA/upbrr 条件规则定义方式的研究记录。

### 检查
- smoke 21/21、responsive 32 项、全量检查、质量审计 83。

## v0.7.163 · 2026-11-17

### 响应式自动检查
- 新增 `pta/checks/responsive-layout.js`：临时后端 + 真实 dist + 登录，逐页检查 360 / 390 / 768 / 1280。
- 覆盖 8 页：横向滚动、按钮文字溢出、队列列表/详情同宽、站点名裁切、数据清单操作区、日志工具条、设置按钮、更新日志、Crawl 未接徽标和目标站弹窗、下载器行。
- 接入 `pta/checks/run.sh`，失败即阻断；当前 32 项通过。
- 使用 305 站、长标题、空队列/有数据队列、日志、下载器做夹具。

## v0.7.162 · 2026-11-17

### 响应式布局计划
- 新增 `pta/docs/RESPONSIVE.md`：一套 Vue 代码、断点 600/900/1320、360/390/768/1280（新增页面加 1440）验收；列表整页滚、筛选两列网格、卡片同宽、按钮不压缩、长标题换行。
- `ROADMAP.md` 增加 M12 响应式里程碑；`CHECKLIST.md` 每轮 UI 改动增加四宽度验收；`AGENTS.md` 明确不做独立移动站/两套前端；`DESIGN.md` 接入规范引用。
- 下一步 R2：把横向滚动和按钮溢出检查接进 `run.sh`。

## v0.7.161 · 2026-11-17

### 外框规则最终收口
- 全局剩的 `.view[data-view="queue" / "sources" / "logs" / "crawl"]` 全部迁入对应 SFC，用单选择器 `:global(.view[data-view=...])`；全局已无 `data-view` 选择器。
- Crawl 抽屉头/标题/描述/正文覆盖迁入 `Crawl.vue`：Crawl 自己的抽屉用 `.drawers .drawer-*`，Nodes 子组件用 `.drawers :deep(.drawer-*)`。
- `.view[data-view="sources"]` 的 900px 取消居中规则也迁入 `Sources.vue` scoped。
- 05/08 里 Queue 专属的 `.shots` / `.shot*` 迁入 `Queue.vue`；`05-queue-sources-logs.css` 改名为 `05-shared-picker-drawer.css`，只留共用多选行、规则行和抽屉头。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、质量审计总体 83（平衡）、规则体检 0 缺读者；1280 / 768 / 390 视觉通过。

## v0.7.160 · 2026-11-17

### 页面 scoped 彻底收口
- 把 04 里剩余的 Crawl 目标站弹窗规则迁入 `Crawl.vue` scoped，Nodes 的 `.nodes-*` / `.node-row` / `.nr-*` / `.nd-cats*` / `.modal-two` 迁入 `Nodes.vue` scoped；04 改名为 `04-shared-forms-drawers.css`，只留共享表单/抽屉/外框规则。
- 06 里带 `.view[data-view="crawl"] .drawer[data-name="下载器"]` 前缀的 Nodes 规则也迁入 `Nodes.vue`，下载器容量列和行布局保持原样。
- Nodes 390：下载器行改成名称/状态第一行、容量/设置第二行；下载器弹窗 `.modal-two` 单列，避免表单挤在一起。
- Crawl 目标站弹窗 390：目标站名称/域名两行、状态标签靠右，不再把站名挤成「Demo / A」。
- Crawl 登录后自动补载站点与流程配置；登录前 401 不再导致来源站/目标站列表为空。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、质量审计总体 83（平衡）、规则体检 0 缺读者；1280 / 768 / 390 视觉通过。

## v0.7.159 · 2026-11-17

### 小屏收口
- Sites：≤600px 取消列表内部滚动，站点列表随整页展开；305 站时不再只露出 4 条，长站点名换行完整显示。
- Sources：≤600px 筛选栏改两列网格，搜索框和目标站占整行，操作按钮两列排列、导出 JSON 独占一行；数据行操作区继续换行，无横向滑动。
- Queue：≤900px 列表和详情统一全宽，空态「没有匹配的条目」与「选一条看发布预览」上下对齐。
- Crawl：条件字段标签列改 `fit-content(220px)`，≤900px 改为标签在上、控件在下；「未接」徽标固定在文字右侧，不再单独掉行。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、质量审计总体 83（平衡）、规则体检 0 缺读者；360 / 390 / 768 / 1280 视觉复测通过。

## v0.7.158 · 2026-11-17

### 页面 scoped 迁移（最后一页）
- Changelog：`.changelog-wrap` / `.changelog-body` 及标题、列表、段落、窄屏规则迁入 `Changelog.vue` 的 `<style scoped>`；全局已无 changelog 选择器。
- 补回删 legacy 时丢失的更新日志加载：页面内 `fetch('/api/changelog')`，按 `# / ## / ### / 列表 / 段落` 渲染，不再依赖全局脚本。
- 首次挂载未登录遇到 401 后，登录或切到更新日志页会自动重试，不用刷新。
- 390 无横向溢出；长日志按页面滚动查看。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、质量审计总体 83（平衡）、规则体检 0 缺读者；1280 / 768 / 390 视觉通过。

## v0.7.157 · 2026-11-17

### 小屏溢出修复
- Sites：360 / 375 / 390 下长站点名改为自动换行，完整显示；窄屏继续隐藏「抓取 / 上次抓取」两列。
- Sources：390 数据清单行改用 `minmax(0, 1fr) auto`，行内项 `min-width: 0`；送审/归档等操作区允许换行，不再撑出横向滑动；`#dl-body` 禁止横向溢出。
- Queue：390 卡片单列并加 `min-width: 0`，卡片与网格左右对齐。
- 日志「清屏」和设置「发送测试」按钮的压缩问题已在 0.7.155 修复；若仍异常，先确认页面版本并硬刷新。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、质量审计总体 83（平衡）、规则体检 0 缺读者；360 / 375 / 390 / 768 视觉复测通过。

## v0.7.156 · 2026-11-17

### 页面 scoped 迁移
- Settings：55 条页面规则迁入 `Settings.vue` 的 `<style scoped>`，包括 `#set-panel`、`.set-panel`、`.set-stack`、`.set-card*`、`.set-h2`、`.set-save` 及窄屏字段覆盖。
- 删除空模块 `10-settings-responsive.css` 和入口 import；全局已无 Settings 页面选择器。
- `set-field` / `set-fields` / `fixed-val` 基础规则继续全局，给 Crawl / Sites 共用；`#set-panel` 前缀保留在 scoped 内，维持原有特异性。
- 390：设置卡头部标题独占一行，保存/发送测试按钮右对齐且不压缩。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、质量审计总体 83（平衡）、规则体检 0 缺读者；1280 / 768 / 390 视觉通过。

## v0.7.155 · 2026-11-17

### 窄屏与登录后加载修复
- Sources：遇到 401 后 `loadBusy` 现在会在 `finally` 复位；直接打开 `#sources`、登录后自动加载数据，不用刷新。
- Sites：390 下站点名称不再被压成「De…」；窄屏隐藏「抓取 / 上次抓取」两列，保留名称、架构、登录、预设。305 站分页复测正常。
- Crawl：390 发布卡字段改单列，成对字段纵向排列，修复分辨率/体积/开关等控件和文字互挤。
- Queue：390 标题与来源信息分行，简介、截图、媒体卡改单列，不再出现标题竖排和 155px 窄卡。
- Logs：390 工具条分两行，下载 log 与清屏按钮横排且不压缩文字；日志消息保持整行。
- Settings：通知卡头部按钮不再被压缩，「发送测试」不再竖排换行。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、质量审计总体 83（平衡）、规则体检 0 缺读者；1280 / 768 / 390 视觉通过。

## v0.7.154 · 2026-11-17

### 页面 scoped 迁移
- Logs：30 条规则迁入 `Logs.vue` 的 `<style scoped>`；05 基础日志样式、06 黑绿终端主题、07 高度规则、09 窄屏工具条全部移走；全局已无 `log-*` 选择器。
- 删除 `Dashboard.vue` scoped 里不生效的 `.view[data-view="logs"] .log-panel` 跨页选择器。
- 390：日志行改为两行布局，时间/级别/来源一行，消息独占下一行；消息不再被挤成 68px。
- `seg-tabs` / `btn` / `sites-empty` / `spacer` 等共享规则继续全局。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、质量审计总体 83（平衡）、规则体检 0 缺读者；1280 / 768 / 390 视觉通过，INFO/WARN/ERROR 筛选计数正确。

## v0.7.153 · 2026-11-17

### 页面 scoped 迁移
- Sources：28 条整规则 + 1 处选择器拆分 + 5 条 `.view[data-view="sources"] …` 外层布局规则 + `#dl-body` 迁入 `Sources.vue` 的 `<style scoped>`；全局已无 `dl-*`、`cat-site`、`mark-*`、`t-link`、`ta-r`、`#dl-*` 页面选择器。
- Crawl 的 `dl-dry*` 规则不动；`sd-*`、`btn`、`chip`、`badge`、`sites-empty`、`spacer` 等共享基础规则继续全局。
- 删除模板中不存在的 `.dl-body` 死规则。
- 修复 390：数据清单内容高于视口时不再垂直居中压到顶栏；筛选条、行、分页可正常滚动查看。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、质量审计总体 83（平衡）、规则体检 0 缺读者；1280 / 768 / 390 视觉通过。

## v0.7.152 · 2026-11-17

### 页面 scoped 迁移
- Queue：41 条整规则 + 34 条 `.view[data-view="queue"] …` 外层布局规则迁入 `Queue.vue` 的 `<style scoped>`；全局已无 queue 选择器。
- `sd-card` / `sd-note` / `sd-url` / `seg-tabs` / `badge` / `chip` 基础规则继续全局；`.view[data-view=queue]` 纯外层高度保留 global。
- 1280 / 768 / 390 队列列表、详情、发布信息、简介/截图卡正常，无横向滚动。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、质量审计总体 83（平衡）、规则体检 0 缺读者。

## v0.7.151 · 2026-11-17

### 页面 scoped 迁移
- Crawl：103 条整规则 + 1 处选择器拆分迁入 `Crawl.vue` 的 `<style scoped>`，约 8.1KB；`crawl-*`、`flow-*`、`preset-*`、`limits-*`、`dedupe-card`、`target/tpl/rx`、`.drawers` 不再留在全局。
- 子组件（Nodes 抽屉、RuleControl 控件）用 `:deep()` 保留页面 scoped 下的样式；`set-field`/`drawer`/`cat-chip`/`switch` 基础规则仍全局。
- `10-crawl-final.css` 只剩 Settings 响应式规则，改名 `10-settings-responsive.css`；`.set-field.todo` 迁入 Crawl。
- 修复窄屏 `.drawer-head` 不换行导致标题竖排：≤900px 标题独占一行、操作区换行；Crawl 空演练 body 的 `[hidden]` 不再被 `.drawer.open` 覆盖。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、质量审计总体 83（平衡）、规则体检 0 缺读者。

## v0.7.150 · 2026-11-17

### 质量审计
- 新增 `pta/scripts/audit-quality.js`：代码 / 功能 / 编写 / 逻辑 / 简洁度 / 复用率 / 质量七维评分，评级为优质 / 平衡 / 勉强 / 差。
- 支持全库、单文件、单功能、单项目；`--json`、`--fail`、`--strict`、`--update-baseline`。
- 接入 `pta/checks/run.sh`，全库用 `pta/quality-baseline.json` 防回退；新增 `pta/docs/QUALITY.md`。
- 当前基线：代码 78 / 功能 86 / 编写 100 / 逻辑 76 / 简洁 80 / 复用 70 / 质量 99，总体 83（平衡）。
- AGENTS / CHECKLIST / DECISIONS / DELIVERY / HANDOFF 已写入永久规则。

### 检查
- `run.sh` 全绿（含质量审计）；smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、规则体检 0 缺读者。

## v0.7.149 · 2026-11-16

### 页面 scoped 迁移
- Sites：277 条整规则 + 3 处选择器拆分迁入 `Sites.vue` 的 `<style scoped>`，约 23.9KB；`pill2`、`ava.lg`、`modal-scroll` 补迁。
- 共享 `sd-note` / `sd-url` / `sd-card` / `sd-cookie-bar` / `sd-cookie-res` / `set-field` 留在全局；Queue/Nodes 不受影响。
- `03-sites.css` 只剩 shared 组件，改名 `03-shared-components.css`；`07-sites-detail.css` 只剩全局背景/布局，改名 `07-global-effects.css`。
- 修复 Vue scoped 的 `:global(.view…) 后代` 被编译丢后代、`[hidden]` 被吞导致站点页 `display:none` 的问题：后代规则改为页面内 scoped，仅最外层 `.view` 保留单选择器 global。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、规则体检 0 缺读者。

## v0.7.148 · 2026-11-16

### 页面 scoped 迁移
- Dashboard：118 条页面规则迁入 `Dashboard.vue` 的 `<style scoped>`，约 9KB；`bento-*`、`stat-*`、`status-*`、`hstat`、`health-row`、`panel-head`、`list-item`、`#dash-*` 不再留在全局。
- `02-dashboard.css` 只剩 shell/layout 规则，改名 `02-shell-layout.css`；孤立的 Dashboard 注释清掉。
- `:global(.view[data-view="dashboard"])` 只用于外层布局，页面内部规则保持 scoped。
- 375 / 768 / 1280 / 1440 实测，Dashboard 与 Sites 无回归；全量检查全绿。

### 检查
- smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、规则体检 0 缺读者。

## v0.7.147 · 2026-11-16

### 语义去重
- CSS 语义清理：删除 41 条被后续同选择器/同媒体上下文完全覆盖的规则，合并 7 组相邻同选择器，删除 6 条规则内重复声明。
- `src/styles/*.css` 102,284 → 99,364 字节（-2,920）；规则 1,195 → 1,147。
- 只做“完全覆盖/相邻合并”，不跨规则移动声明，避免改变级联。
- 375 / 390 / 1280 / 1440 实测，导航和七页正常，0 JS 报错。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10。

## v0.7.146 · 2026-11-16

### 重构
- `src/styles/v2.css` 按原级联顺序拆成 12 个模块：`00-base.css` … `11-dock.css`，`index.css` 统一入口，`main.js` 导入。
- 拆分前后 CSS 字节完全一致（102,284 bytes）；构建仍输出单个哈希 CSS。
- 历史文档移入 `pta/docs/history/`：`MIGRATION-PLAN.md`、`PIPELINE-RULES.md`、`RULES-TRIAGE.md`、`PROBLEMS.md`，附 `README.md`；当前文档只留活跃项。
- AGENTS / DESIGN / DECISIONS / ROADMAP 的路径与引用同步。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10。

## v0.7.145 · 2026-11-16

### 迁移
- 站点基础清单从 v1 `sites-data.local.js` 迁入 SQLite `sites` 表：305 站，3 个已有配置保留。
- `/api/sites` 只读 SQLite；`base:true` 站点禁止删除；smoke 增加回归断言。
- 旧 `sites-data.local.js` 及 8 个 v1 JSON 移入 `data/_v1-backup-20261116`（0600），v2 不再读；`library.json` / `site-search.local.json` / `site-status.json` 仍是 v2 数据。
- 新增 `pta/scripts/migrate-sites-js.js`。
- 迁移操作中误删 1 个基础站配置与 1 条凭据，已从迁移前数据库副本恢复（站点 305、凭据 8）。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、规则体检 0 缺读者。

## v0.7.144 · 2026-11-16

### 清理
- 删除 v1 规划/任务残留：`PLAN.md`、`TASKS.md`、`.opencode/commands/migrate.md`。
- 删除 `screen.js` 旧流程数据兼容层；生产 flow 已是新格式。
- 删除最后 5 条 `.map-row` 死 CSS；选择器审计剩 5 条均为 live/混合保留。
- `AGENTS.md` 数据目录/故障表/设计约束对齐 v2；`DECISIONS.md` 增加历史说明；ROADMAP/DELIVERY/PROBLEMS/PIPELINE-RULES/RULES-TRIAGE/DESIGN/CONTRIBUTING 路径更新。
- `deploy.sh` 去掉 v1 `sites-data` 排除项。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、api-v2 23/23、site-pack 5/5、target 10/10、规则体检 0 缺读者。

## v0.7.143 · 2026-11-16

### v2 样式迁移
- `public/assets/app.css` → `src/styles/v2.css`，由 `main.js` 导入，Vite 打包为哈希 CSS。
- 字体 → `src/assets/fonts/`，logo → `src/assets/whale.png`，都由 Vite 哈希；`public/` 只留 favicon/icon。
- 删除手工 `<link rel="stylesheet" href="/assets/app.css">` 和 CSS 指纹插件。
- `DESIGN.md`、`AGENTS.md` 路径同步；新增决策 D17。
- 构建产物：`static/index-<hash>.css`、哈希字体、哈希 whale；旧 `/assets/app.css` 不再被引用。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、site-pack 5/5、target 10/10。

## v0.7.142 · 2026-11-16

### 修复
- 导航恢复 SVG 图标：总览 / 站点 / 流程 / 待审核 / 数据清单 / 日志 / 更新日志 / 设置。
- 手机底栏改为悬浮条：左右 12px、底部 10px + iPhone 安全区，18px 圆角、阴影，不再贴底全宽。
- 基础版 7 项，开发版 8 项；图标 + 文字都在，375 / 390 / 1440 实测无横向滚动。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、site-pack 5/5、target 10/10。

## v0.7.141 · 2026-11-16

### 修复
- 构建期给 `app.css` 加内容指纹（`?v=<hash>`），绕过 Cloudflare / Safari 对 `/assets/app.css` 的 4 小时缓存。
- 手机底栏项 `min-height: 40px`，标签 10.5px，紫色胶囊不再被压扁。
- 375 / 390 / 1280 / 1440 实测，导航标签全部可见，无横向滚动。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21。

## v0.7.140 · 2026-11-16

### 修复
- 手机底部导航：旧图标轨 CSS 把 `.dock-label` 设为绝对定位、`opacity:0`、`visibility:hidden`，而 `App.vue` 只有文字标签，导致导航只剩空胶囊。
- 标签改为始终可见；手机端底栏去掉 `max-width`，全宽显示，并加 `viewport-fit=cover` + `env(safe-area-inset-bottom)`，适配 iPhone XS 的底部安全区。
- 1280 恢复底部文字胶囊，1440 恢复右侧文字导航；375 / 390 / 1280 / 1440 无横向滚动。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21。

## v0.7.139 · 2026-11-16

### 站点包接入
- 第一版 `pta/pack/site-pack.enc` 已生成：308 站，约 217KB；明文 host 泄漏扫描 0。
- `target.js` / `crawl.js` 接入内置包回退：私有 `data/` 优先，缺密钥自动回退，不阻塞启动。
- `/api/dev` 返回 `pack` 状态（是否解密、站点数、包版本）；设置页展示待补。
- 生成器补充 `catList`，抓取分类轮转可以直接用包内分类。
- `site-pack` 检查 5/5；全量 ALL CHECKS PASSED。

## v0.7.138 · 2026-11-16

### 站点包基础设施
- 新增 `pta/server/site-pack.js`：AES-256-GCM 解密、校验、缓存；缺 `PTA_SITE_PACK_KEY` 回退 `NO_KEY`，不阻塞启动。
- 新增 `pta/scripts/build-site-pack.js`：离线生成、分类自动匹配、`--dry` 覆盖率、例外私有报告；密文写 `pta/pack/site-pack.enc`。
- 新增 `pta/checks/site-pack.js`：roundtrip、缺密钥、错误密钥、篡改、密文无明文 host、生成器 dry-run；5/5，已进 `run.sh`。
- 现有 308 站 dry-run：1409 个分类自动匹配 913（64.8%）；真实密文包待部署密钥后生成。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、api-v2 23/23、form 5/5、site-pack 5/5、target 10/10。

## v0.7.137 · 2026-11-16

### 计划
- 站点包与自动化方案定稿：站点包随程序发布，仓库只放 AES-256-GCM 密文，密钥只放部署环境变量 `PTA_SITE_PACK_KEY`；用户不单独下载、不导入。
- 私有 `data/site-defs` / `data/site-pack.json` 优先覆盖内置包；缺密钥回退并提示，不崩溃。
- 新增 `pta/docs/SITE-PACK.md`；AGENTS 铁律 2/8 更新；DECISIONS D16；ROADMAP M11。
- 本次只写计划，不改运行代码。

## v0.7.136 · 2026-11-16

### 修复
- 按 NexusPHP 开源实现校正默认上传映射：表单页 `/upload.php`，提交页 `/takeupload.php`；字段 `small_descr`、`type`、`uplver=yes`。
- 站点定义 `catMap` 数组按 `purpose` 自动转成目标站分类对象，发布时 `type` 能填 401/402 等，不再把 `movie` 当分类 ID。
- 站点检查新增 NexusPHP 默认字段/分类数组用例；target 10/10。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、api-v2 23/23、form 5/5、target 10/10。

## v0.7.135 · 2026-11-16

### 修复
- 上传表单识别拆成“提交路径”和“识别页路径”：NexusPHP 的 `/takeupload.php` 是 POST 提交地址，GET 表单页通常是另一个地址。
- 站点定义 `uploadMap` 新增 `formPath`；识别用 `formPath`（留空回退 `path`），提交仍用 `path`。
- 目标站夹具覆盖两者不同的情况：识别 `/upload-form`，提交 `/takeupload.php`。

### 检查
- 全量 ALL CHECKS PASSED；smoke 21/21、api-v2 23/23、form 5/5、target 9/9。

## v0.7.134 · 2026-11-16

### 功能
- 上传配置新增“上传表单”字段表：上传路径、文件字段、目标字段/值模板，支持增删改，保存写回 site-def 的 `uploadMap`。
- “从目标站识别”：确认后对目标站上传页发一次只读 GET，解析字段填入表格；同站 60 秒冷却，失败保留手工编辑。
- 解析器 `pta/server/form.js` + 本地夹具 `pta/fixtures/upload-form.html`；新增 form 检查 5/5。

### 检查
- api-v2 23/23、form 5/5、target 9/9、smoke 21/21；全量 ALL CHECKS PASSED。

## v0.7.133 · 2026-11-16

### 功能
- 站点抽屉 → 设置 → 上传配置新增分类映射表格：
  - `catMap` 数组：站点分类（名称 + ID）→ 库内分类（电影 / 剧集 / 纪录片等），保存时重建 `cats`。
  - `catMap` 对象：库内分类 → 目标站分类 ID，保持对象结构。
  - 支持增、删、改；保存写回 `/api/site-def/:host`，站点定义其他字段不丢。
- 窄屏站点详情设置区改为单列，分类表在 390 下可用。

### 检查
- api-v2 22/22（新增数组/对象映射回读）；smoke 21/21（新增对象映射保存、数组改用途、删行）；target 8/8；全量 ALL CHECKS PASSED。

## v0.7.132 · 2026-11-16

### 对账
- 50 条未接规则逐条对账：转正 2 条（发布后校验、截图至少几张），删除 8 条重复/无读者行，剩余 40 条继续禁用。
- 服务端：真发布前按“截图至少几张”拦（默认 3，干跑不拦）；“发布后校验”关掉时只提交不回查，手动回查仍可用。
- `rules.js` 58 → 50 条非分组规则；`RULES-TREE.md` 重新生成；新增 `RULES-RECONCILIATION.md`。
- target 检查 6 → 8（新增截图门槛、回查开关）。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 8/8、meta 11/11、meta-ext 5/5、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.131 · 2026-11-16

### 清理
- 选择器级 CSS 清理：按源码类名 + 线上 DOM + 动态类白名单删除 453 条无引用规则，恢复 2 条归档样式，净减 451 条。
- `app.css` 137,605 → 103,703 字节（-33,902）；保留分类映射 `.cm-*` / `.map-row` 样式给下一项复用。
- 修复窄屏设置页长说明溢出：`#set-panel` 的 220px 控件宽度在 ≤1000px 改为 100%，长文本换行。

### 验证
- 三宽度 1280 / 768 / 390：七页无横向滚动、0 JS 报错；总览、站点、流程、设置截图核对。
- 选择器审计剩 14 条候选，其中 12 条为分类映射/混合选择器保留项。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、meta-ext 5/5、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.130 · 2026-11-16

### 清理
- 删除旧 demo 中确认无引用的 CSS 规则：旧流程手风琴 `.rule-*` / `#rule-body`、旧移动菜单 `.menu*` / `#menu*`，共 168 条。
- `app.css` 152.4KB → 137.6KB（-14.8KB）；build 和 smoke 21/21 正常。

### 检查
- `run.sh` 全绿；线上待验证。

## v0.7.129 · 2026-11-16

### 清理
- 修正 `app-fastify.js` 里“v1 已归档”的过期注释（实际已删除）。
- `TASKS.md` 的 `run.cmd` 旧入口统一改为 `run.sh`。

## v0.7.128 · 2026-11-16

### 清理
- 删除 `pta/archive`（旧 web demo + v1 后端）；删除 `pta/checks/api.js`、`pta/checks/run.cmd`。
- `routes-missing.js` 改名 `routes-extra.js`；删除零引用的一次性 scripts（clean/collect/discover/merge/migrate/reshape/verify）。
- v1 文档：`DECISIONS.md`、`PRIOR-ART.md`、两个 example 迁到 `pta/docs/`；v1 的 API/ARCHITECTURE/DEPLOY/PIPELINE 删除。
- `README` 用的 `docs/i18n`、banner 保留；`scripts/bluray` 是独立项目，保留。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、meta-ext 5/5、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.127 · 2026-11-16

### 重构
- 删除 `src/legacy`：登录、hash 路由、顶栏、Toast/Confirm、页脚全部搬进 `App.vue`。
- 规则数据移到 `src/data/rules.js`；`gen-rules-tree`/`audit-rules` 路径同步。
- 登录页去掉没有实际作用的“记住登录”开关；会话由服务器 cookie 控制。
- 路由切换后补一次合成事件，保证页面组件在 DOM 可见后拉数据。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、meta-ext 5/5、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.126 · 2026-11-16

### 清理
- legacy `app.js` 从 5321 行降到 1314 行：删掉 8 个已不在启动列表的页面函数和死流程 helper；启动只剩 chrome/nav/menu/router。
- 删掉 App.vue 里四个已死的旧弹窗（site/bulk/target/node/rule）；确认弹窗保留。
- 旧 v1 后端移到 `pta/archive/server-v1.js`；删除 `smoke-legacy.js` / `audit-legacy.js`；`run.cmd` 退休为提示入口。
- 全量检查保持全绿。

## v0.7.125 · 2026-11-16

### 自检修复
- 恢复 `pta/checks/run.sh` 可执行位（644 → 755），避免直接 `./pta/checks/run.sh` 失败。

## v0.7.124 · 2026-11-16

### 新增
- 外部元数据两种来源：无 key 用 Wikipedia 公共接口；有 key 用 TMDB（`TMDB_API_KEY`，不进仓库）。
- `GET /api/meta/providers`、`POST /api/meta/fetch`；待审核页加“查资料”，查到后填副标题/简介。
- `pta/checks/meta-ext.js`：本地 mock Wikipedia/TMDB，5/5。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、meta-ext 5/5、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.123 · 2026-11-16

### 自检修复
- 全量检查、线上七路由、服务日志、JS 语法均正常；Docker 镜像重建后 health/登录/session 通过。
- 发现 smoke 没覆盖新加的“添加站点 / 上传配置”，补上；smoke-live 21/21。

### 检查
- `run.sh` 全绿：smoke-live 21/21、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。
- Docker：`docker build` 成功；临时容器 health 200、登录 200、session 200。

## v0.7.122 · 2026-11-15

### 新增
- 面板内添加/移除站点：`POST/DELETE /api/sites`；`GET /api/sites` 合并 base 清单和面板添加的站点。
- 上传定义编辑：`PUT /api/site-def/:host`，存 `data/site-defs/<host>.json`（0600）；站点页加“添加站点”弹窗和“上传配置”页签。
- api-v2 增加站点配置契约，21/21。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 21/21、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.121 · 2026-11-15

### 新增
- 下载器直连 rTorrent（XML-RPC）与 Deluge（Web JSON-RPC）：探测、加种、按 infohash 回查；`kind` 支持 qb/watch/rtorrent/deluge。
- 发布链路按 `kind` 分派；rTorrent/Deluge 添加后回查并写 `qb.client/state/progress/verified`。
- 下载器设置 UI 支持四种类型；`clients-ext` 夹具用本地 mock XML-RPC/JSON-RPC，4/4。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 5/5、clients-ext 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.120 · 2026-11-15

### 调整
- 硬约束：产品代码/脚本不写死主机路径。`deploy.sh` 用 `DEPLOY_DIR`（可放未入库 `.deploy.env`）；`sync-check.sh` 用 `SSH_HOST/VPS_DIR`；`load-cookies.js` 不再自动读 `/etc/seedpod.secret`；`notify-tg.sh` 不再默认 `/etc`；`goal-autoresume.py` 用 `OPENCODE_TG_ENV_FILE/OPENCODE_GOAL_OFF_FILE`。
- `AGENTS.md` 删除“部署脚本例外”，改为“主机路径只放未入库 `.deploy.env` 或环境变量”；`docs/DEPLOY.md` 示例路径改 `<部署目录>` 并改 v2 入口。
- `.deploy.env` 进 gitignore/dockerignore。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 5/5、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.119 · 2026-11-15

### 新增
- 调度器重试 `failed` 队列条目：`retryMax`（默认 2）、`retryBackoffMin`（默认 15）可配；失败写 `retries/lastRetryAt/nextRetryAt/retryMsg`，成功后转 published。
- 重试失败会计入调度通知文本；`clients` 夹具加“调度重试 failed 条目”，5/5。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 5/5、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.118 · 2026-11-15

### 新增
- Telegram 通知：环境变量优先，面板可保存 token（AES-GCM）/Chat ID；调度失败、发布失败、目标站提交失败推送；设置页可发送测试。
- `GET/PUT /api/notify`、`POST /api/notify/test`；token 只写不读，接口只回是否配置/来源/chat。
- Docker compose 支持 `TELEGRAM_BOT_TOKEN` / `TELEGRAM_ALLOWED_USER_ID`；`.env` 已 gitignore。
- `pta/checks/notify.js`：本地 mock Bot API，7/7（发送/跳过/面板加密兜底/未配置）。

### 调整
- `AGENTS.md` 增加“环境与产品边界”：本机权限/路径问题改本机，不把主机路径写进产品代码。
- `scripts/load-cookies.js` 不再自动读 `/etc/seedpod.secret`；找不到密钥退出 2，不自动新建。
- `scripts/notify-tg.sh` 不再默认 `/etc` 环境文件；`deploy.sh` 用 `TELEGRAM_ENV_FILE` 显式指定。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 4/4、cli 7/7、notify 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.117 · 2026-11-15

### 新增
- `pta/cli.js` + `package.json` 的 `bin.pta`：`status / queue / crawl / screen / publish / targets / target-upload / verify`，默认干跑，`--real` 才真抓/真发；凭据只从环境读，不打印。
- `pta/checks/cli.js`：临时后端 + 真实 CLI 子进程，7/7（状态、抓取干跑、送审、队列、发布干跑、目标站列表、缺参退出码）。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 4/4、cli 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.116 · 2026-11-15

### 新增
- 待审核页加“媒体”卡：填 `PTA_MEDIA_ROOT` 下的文件路径，可探测、生成 3 张截图（直接写入队列）、生成种子；生成的种子 base64 会随“提交目标站”一起发送，省一次源站下载。
- smoke 增加媒体卡渲染断言，smoke-live 20/20。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 4/4、build 7/7、规则体检 0 缺读者。

## v0.7.115 · 2026-11-15

### 新增
- 下载器加 `kind`（qb/watch）；watch 目录客户端写入 `.torrent`（0600，原子 rename），探测可写与余量。
- 发布链路支持 watch：写目录后标记 `client:'watch'`/`state:'watch'`/`verified:true`；qB 路径行为不变。
- 下载器设置 UI 支持类型切换；`GET /api/downloaders` 回 `kind/watchPath`。
- `pta/checks/clients.js`：watch 模块 + 下载器 API + 发布到 watch，4/4。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、clients 4/4、build 7/7、规则体检 0 缺读者。

## v0.7.114 · 2026-11-15

### 新增
- `pta/server/routes-media.js`：`GET /api/media/config`、`POST /api/media/probe|shots|torrent`；路径限制在 `PTA_MEDIA_ROOT`（默认 `data/media`），拒绝越界；截图返回 data URL，种子落 `data/torrents`。
- `pta/checks/media-api.js`：合成视频 + 临时后端，6/6（路径越界、探测、截图、种子、坏 announce）。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、media-api 6/6、build 7/7、规则体检 0 缺读者。

## v0.7.113 · 2026-11-15

### 新增
- `pta/server/media.js`：ffprobe 媒体信息、ffmpeg 截图（HDR tonemap + 失败回退）、clean-room bencode 生成单文件 `.torrent`。
- `pta/checks/media.js`：ffmpeg 合成 2 秒视频，覆盖探测/截图/bencode/种子解析/坏输入，7/7。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、media 7/7、build 7/7、规则体检 0 缺读者。

## v0.7.112 · 2026-11-15

### 新增
- `pta/server/meta.js`：标题解析（片名/年份/季集/分辨率/来源/编码/音轨/HDR/制作组/分类）与 `buildNames` 规范名/副标题/简介。
- `GET /api/meta/parse?title=...`；`/api/publish/preview` 返回 `parsed`/`releaseTitle`，副标题与简介用解析结果补全。
- `pta/checks/meta.js`：11 条夹具（电影/剧集/动漫/音乐/修复版/年份歧义），11/11。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、meta 11/11、build 7/7、规则体检 0 缺读者。

## v0.7.111 · 2026-11-15

### 新增
- `pta/server/target.js` + `routes-target.js`：NexusPHP/UNIT3D/Gazelle 的提交路径与字段骨架，`data/site-pack.json` 私有包覆盖；`GET /api/targets`、`plan/upload/verify`。
- 真提交受 `realPublish` 门禁；成功后把 `targetUpload/targetVerify` 写回队列；待审核页加“提交目标站”。
- `pta/checks/target.js`：本地 mock 上传页夹具，覆盖私有包、干跑、门禁、NexusPHP 真提交、UNIT3D/Gazelle 干跑、回查，6/6。
- `pta/docs/site-pack.example.json` 与 ADAPTERS/UPSTREAM 记录。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、target 6/6、build 7/7、规则体检 0 缺读者。

## v0.7.110 · 2026-11-15

### 调整
- 旧前端 demo 归档到 `pta/archive/web-demo`；`pta/web` 只保留 Vite 构建产物 `dist` 和说明，不再改旧 `index.html/assets`。
- `gen-rules-tree.js` 改读 `pta/web-src/src/legacy/data.js`；`routes-data.js` 只从 `data/sites-data.local.js` 读私有站点清单；`deploy.sh` 排除 `archive/`；dev compose 挂载改到 `pta/server` 与 `pta/web/dist`。
- AGENTS/HANDOFF/DESIGN/PIPELINE-RULES/ARCHITECTURE-TARGET 等文档对齐 Vite + SFC，删除 `?v=` 与旧 demo 目录说明。

### 检查
- `npm run build` 通过；`run.sh` 全绿；smoke-live 20/20。

## v0.7.109 · 2026-11-15

### 调整
- 下载器抽屉拆进 `views/Nodes.vue`：卡片列表、在线/版本/余量、增删改、连接测试、qB 分类只读；legacy `initNodes` 不再初始化。
- 只保留服务端真有的字段（名称/地址/账号/密码/免密）；同时下载数、限速、分享率、保种天数、分类选择这些还没服务端读者的项不放进 UI，等 M5–M7 接 qB 策略时再加。
- 在线冒烟增加“下载器抽屉”，smoke-live 20/20。

### 检查
- `run.sh` 全绿：smoke-live 20/20、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.108 · 2026-11-15

### 调整
- 流程页的规则卡与演练拆进 `views/Crawl.vue`：抓取（搜索预设 + 请求限制 + 抓详情页）、查重（自动查重 + 按条件筛选）、发布（规则组、目标站、正则测试）；演练/看地址/抓一页都接真实接口。legacy `initCrawlSettings` 不再初始化。
- 新增 `components/RuleControl.vue`：统一渲染开关、单选、下拉、数字、文本、按钮、chips 与固定值。
- 下载器抽屉仍由 legacy `initNodes` 接管，下一提交单独拆。
- `run.sh` 全绿；smoke-live 19/19（含 8 个流程组、4 个限制输入、50 个未接徽章、`#rx-deny` 可用）。

## v0.7.107 · 2026-11-15

### 调整
- 站点页拆进 `views/Sites.vue`：站点列表、架构/登录/预设/抓取筛选、分页、统计条、详情抽屉（概览/登录/搜索预设/站点覆盖）、cookie 保存与自检、单站抓取、批量设置、恢复默认；legacy `initSites` 不再初始化。
- 面板暂不支持新增/移除站点（站点清单来自私有包），按钮标未接并禁用；搜索预设只读，确认入口未接。
- 在线冒烟补站点清单夹具与“站点列表、筛选与抽屉”断言，smoke-live 19/19。

### 检查
- `run.sh` 全绿：smoke-live 19/19、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.106 · 2026-11-15

### 调整
- 数据清单页拆进 `views/Sources.vue`：搜索、站点/类型/状态/标记筛选、分页、送审、归档/恢复、本地查重、目标站查重、批量归档、导出 JSON；legacy `initSources` 不再初始化。
- `/api/site-defs` 增回 `cats` 分类映射，旧词条可按站点定义显示中文类型。
- `/api/catalog/bulk` 支持 `host` 与 `includeDup`，让“归档已跳过/已有”真正包含标了已有的新词条。
- 在线冒烟增加“数据清单渲染、筛选与标记”，smoke-live 19/19。

### 检查
- `run.sh` 全绿：smoke-live 19/19、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.105 · 2026-11-15

### 调整
- 待审核页拆进 `views/Queue.vue`：筛选/搜索/分页、详情表单、目标站、截图上传与删除、草稿预览、驳回/跳过/发布、批量查重/批准/发布；legacy `initQueue` 不再初始化。
- 在线冒烟增加“待审核列表与详情”，smoke-live 18/18。

### 检查
- `run.sh` 全绿：smoke-live 18/18、adapter 21/21、security 3/3、api-v2 20/20、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.104 · 2026-11-15

### 接口
- `GET /api/queue` 支持 `status=a,b`、`offset`、`q`，返回 `matched/limit/offset`。
- `POST /api/queue/bulk` 支持 `fromStatus` 和 `publish`（走 publisher，真发布关闭时逐条记失败）。
- `POST /api/queue/:id/check` 补队列/已发布/词条库比对，返回 `duplicate`。
- `POST /api/queue/:id/action` 合并标题/副标题/简介/目标站/图床/匿名；`publish` 统一走 `/api/publish` 的 qB 链路。

### 检查
- api-v2 20/20；smoke-live 17/17；adapter 21/21；security 3/3；publish 4/4；scheduler 5/5；detect 5/5；build 7/7；规则体检 0 缺读者。

## v0.7.103 · 2026-11-15

### 说明
- 队列页 SFC 暂缓：现有 `/api/queue` 筛选/分页、批量 `fromStatus`、单条查重、发布表单字段与发布语义都对不上，硬搬会丢功能。
- 缺口与验收写进 `TASKS.md` 第八节；补完接口再搬队列页。

## v0.7.102 · 2026-11-15

### 调整
- 总览页拆进 `views/Dashboard.vue`：统计、实时日志、系统状态、最近发布、待审核；legacy 的 `initDashboardVue` 不再初始化。
- 在线冒烟增加“总览数据块渲染”，smoke-live 17/17。

### 检查
- `run.sh` 全绿：smoke-live 17/17、adapter 21/21、security 3/3、api-v2 16/16、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.101 · 2026-11-15

### 调整
- 设置页拆进 `views/Settings.vue`：版本模式、面板账号、调度、系统四张卡；legacy 的 `initSettings` 不再初始化。
- 在线冒烟增加“设置页调度开关可用”，smoke-live 16/16。

### 检查
- `run.sh` 全绿：smoke-live 16/16、adapter 21/21、security 3/3、api-v2 16/16、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.100 · 2026-11-15

### 调整
- 新增 `pta/checks/smoke-live.js`：临时 v2 后端 + dist，15 条在线断言（登录/七路由/站点抽屉/规则卡/调度卡/空状态/无报错）。
- 旧 `smoke.js` / `audit.js` 改名 `smoke-legacy.js` / `audit-legacy.js`，退出主检查；`run.sh` 改为 build → smoke-live → 其余检查。
- `run.cmd` 保留为 Windows legacy 备用，指向 legacy 文件。

### 检查
- `bash pta/checks/run.sh` 全绿：smoke-live 15/15、adapter 21/21、security 3/3、api-v2 16/16、publish 4/4、scheduler 5/5、detect 5/5、build 7/7、规则体检 0 缺读者。

## v0.7.99 · 2026-11-15

### 新增
- Docker 两阶段构建：构建阶段 `npm ci` + `npm run build`，运行阶段只带 `dist`、server 和生产依赖；`CMD` 指向 `pta/server/app-fastify.js`。
- `pta/docs/DOCKER.md`：build/run/compose、数据卷、密钥与 Secure 说明。
- `.dockerignore` 收敛构建上下文；compose 去掉 v2 不认的 `PTA_TOKEN`，默认只绑 `127.0.0.1`。

### 验证
- `docker build` 成功；临时容器 health 200（0.7.98）、登录 200、会话 200、静态资源与 changelog 200。

## v0.7.98 · 2026-11-14

### 新增
- `pta/server/detect.js`：按页面特征识别 NexusPHP / UNIT3D / Gazelle，特征不足回退 generic，不猜。
- `pta/checks/detect.js`：5 条离线夹具（三引擎 + 不足 + 仅 URL 提示）。
- `pta/docs/ADAPTERS.md`：引擎/站点实例/私有站点包三层结构，识别与上传表单映射流程。

### 检查
- detect 5/5；api-v2 16/16；adapter 21/21；security 3/3；publish 4/4；scheduler 5/5；build 7/7。

## v0.7.97 · 2026-11-14

### 安全
- 加密密钥支持 `PTA_SECRET_FILE`；线上 key 移到 `/etc/seedpod.secret`（0600 seedpod），`data/.secret` 已移除。
- `scripts/load-cookies.js` 在未显式设置时默认读 `/etc/seedpod.secret`，避免手工脚本生成新 key。
- security 检查新增“密钥从独立文件读取”，3/3。

## v0.7.96 · 2026-11-14

### 调整
- 站点适配方向改为开箱即用：内置 NexusPHP/UNIT3D/Gazelle 引擎 + 自动识别上传表单；真实站配置放 `data/` 私有包，不推给用户维护，也不入 git。
- 同步更新 `UPSTREAM.md`、`ROADMAP.md`、`DELIVERY.md`、`AGENTS.md`。

## v0.7.95 · 2026-11-14

### 安全
- 登录失败限速：同一 IP+用户名 5 次失败锁 10 分钟，返回 429；前端显示服务端提示。
- 会话落 SQLite `sessions` 表，重启服务不再全员掉线；过期会话自动清理。
- cookie 支持 `Secure`：`PTA_COOKIE_SECURE=1` 或 `X-Forwarded-Proto: https` 时加。

### 检查
- api-v2 增加连续失败限速断言，16/16；publish 4/4；scheduler 5/5；adapter 21/21；security 2/2；build 7/7。

## v0.7.94 · 2026-11-14

### 新增
- `pta/server/scheduler.js`：定时抓取 → 送审 → 发布；默认关，间隔 30–1440 分钟（默认 60），可暂停，失败写 `lastError/lastResult`。
- `GET/PATCH /api/scheduler`、`POST /api/scheduler/run`；设置页增加「调度」卡（开关、间隔、立即跑一次、上次结果）。
- `pta/checks/scheduler.js`：开关、间隔校验、送审复用、发布失败记录，5 条断言。

### 调整
- 送审与发布核心抽成 `pta/server/screen.js` / `pta/server/publish.js`，路由和调度器共用，避免两份实现。
- `run.sh` 增加 scheduler 检查；AGENTS 检查清单同步。

### 检查
- scheduler 5/5；publish 4/4；api-v2 15/15；adapter 21/21；security 2/2；build 7/7；规则体检 0 缺读者。

## v0.7.93 · 2026-11-14

### 新增
- `pta/docs/UPSTREAM.md`：UA/upbrr 许可边界、能力矩阵、clean-room 规则、M5–M10 对标路线、研究记录模板。
- `ROADMAP.md` / `DELIVERY.md` 增加 V2 对标 UA/upbrr 的里程碑。

### 调整
- 每轮自查从四问改为五问，新增“对标 UA/upbrr 的哪一块、查过并记录了吗”。
- `package.json` 许可改为 GPL-3.0-or-later，与根 LICENSE 一致。

## v0.7.92 · 2026-11-14

### 新增
- qB 发布后校验：解析 `.torrent` 的 `info.name` 与 infohash，回查 `torrents/info`，把 `hash/state/progress/verified` 记到队列条目。
- `publish.js` 增加第 4 条断言：mock qB 能查到种子并记录状态。

### 修复
- `parseTorrent` 加越界保护，修掉畸形 bencode 导致的死循环。

### 检查
- publish 4/4；api-v2 15/15；adapter 21/21；security 2/2；build 7/7；规则体检 0 缺读者。

## v0.7.91 · 2026-11-14

### 新增
- qB `torrents/add`：`qb.addTorrent` 用 multipart 把种子加进 qB，cookie 失效自动重登。
- 发布接口 `POST /api/publish/:id` 真模式：取来源站 cookie → 下载种子 → 加 qB → 状态 published 并记录 `qb`；dryRun 仍不发请求。
- `pta/checks/publish.js`：本地 mock qB + mock 种子源，3 条端到端断言。

### 说明
- 真发布仍默认关闭（`realPublish`）；目标站表单提交与发布后校验未开始。

## v0.7.90 · 2026-11-14

### 修复
- 规则分诊在真实 Vue 卡片生效：抓取/查重/发布卡的未接行加「未接」徽章并禁用；之前只改了旧 `rule-item` 渲染，页面看不到。
- 保存时未接行保持默认值，不会被界面改写。

### 检查
- build 7/7、api-v2 15/15、adapter 21/21、security 2/2、规则体检保留 8/未接 50/缺读者 0。

## v0.7.89 · 2026-11-14

### 修复
- `/api/dev` 的前后端栈改为从 package.json 读真实版本：`Vue 3.5.45 + Vite 7.3.8 + SFC（构建）` / `Node 22.23.4 + Fastify 5.12.8 + SQLite`，不再写“无构建”。
- `app-fastify.js` 头部“生产仍跑旧服务”的过期注释改掉。

## v0.7.88 · 2026-11-14

### 调整
- 按 `RULES-TRIAGE.md` 落地：`data.js` 50 条加 `todo:true`，9 条固定/装饰规则删除，规则总数 67 → 58。
- 规则行渲染「未接」徽章并禁用控件；保存与摘要跳过 todo 行。
- `audit-rules.js` 区分保留/未接，`--fail` 只拦“保留规则 0 命中”；`run.sh` 接入。
- `gen-rules-tree.js` 给未接规则加标记。

### 检查
- 规则体检：保留 8、未接 50、保留缺读者 0；api-v2 15/15；adapter 21/21；security 2/2；build 7/7。

## v0.7.87 · 2026-11-14

### 新增
- `pta/docs/RULES-TRIAGE.md`：67 条规则逐条分诊，保留 8、标未接 50、删除 9，附执行方式。

### 调整
- `ROADMAP.md` 规则分诊项勾选，新增“按分诊表禁用/删除”待做项。

## v0.7.86 · 2026-11-14

### 修复
- 抓取加服务端硬顶：每站每天默认 20 次，不跟界面配置走；`PTA_DAILY_MAX` 可调，范围 1–100。
- 列表、详情、失败请求都计入当天次数；到顶返回 `DAILY_LIMIT`（429），详情提前停。
- `/api/crawl/status` 的 `count/dailyMax` 改为真实当日次数；`/api/crawl/plan` 补 `dailyMax`；`/api/crawl/run` 补 `daily`。

### 检查
- adapter 新增每日硬顶断言，21/21；api-v2 15/15；security 2/2；build 7/7。

## v0.7.85 · 2026-11-14

### 修复
- 抓取游标：一页到底后 `catIdx` 轮转到下一个分类，page 归零，最后一类回到第一类。
- “抓这一类”显式传 `rotate:false`，不会串到其它分类。
- 接口返回补 `nextCategoryId / rotated`。

### 检查
- adapter 新增 5 条游标断言，20/20；api-v2 15/15；security 2/2；build 7/7。

## v0.7.84 · 2026-11-14

### 修复
- 抓取写入禁转/限转/独占/DIY marks；限转按 `addedAt` 计算剩余天数。
- 送审前硬拦“禁转”和“未满 7 天限转”，原因写进 `byReason`；不再只打标。

### 检查
- api-v2 新增 3 条（禁转、近期限转、过期限转），15/15；adapter 19/19；security 2/2；build 7/7。

## v0.7.83 · 2026-11-14

### 新增
- `scripts/goal-autoresume.py`：检查当前会话 goal，仅在“达到轮次上限”暂停时自动发 `resume`。
- systemd timer `opencode-goal-resume.timer`，每 3 分钟一次；手动暂停/完成不动。

## v0.7.82 · 2026-11-14

### 新增
- `pta/docs/PROBLEMS.md`：按 P0/P1/P2 列出现存问题、位置、影响、修法。
- `pta/docs/ROADMAP.md`：问题 / 需求 / 未来 / 待做四张清单，含需作者拍板的三件事。

## v0.7.81 · 2026-11-14

### 新增
- `pta/docs/DELIVERY.md`：最终交付的七条验收标准、验收方式、M1–M4 里程碑。

### 调整
- `AGENTS.md` 把 2000 行从“切换线”降级为“结构气味”，新增「交付闸门」，以 DELIVERY 七条为准。

## v0.7.80 · 2026-11-14

### 新增
- `pta/scripts/audit-rules.js`：把 data.js 的 67 条规则逐条在 v2 服务端 grep，报告 0 命中/仅 1 次命中。
- `pta/docs/ARCHITECTURE-TARGET.md`：终稿运行时、目录、搬迁顺序与不做什么。

### 调整
- `AGENTS.md` 增加「阶段切换线」：单文件 2000 行、同文件改 3 次、契约对不上就停。
- `CHECKLIST.md` 增加「每轮自查四问」；`run.sh` 末尾跑规则体检（只报告，不拦）。

## v0.7.79 · 2026-11-14

### 调整
- `pta/docs/MIGRATION-PLAN.md` 补齐每页完成定义、验收清单、停止条件、自主边界与交付节奏。
- `.opencode/commands/migrate.md` 改为指向计划文件，不再重复规则。

## v0.7.78 · 2026-11-14

### 修复
- 日志页在登录前挂载，首次拉取 401 后不再重试；改为登录且页面可见时再拉，失败每 1.5 秒重试，成功后接 SSE。线上实测 54 行、筛选正常。

## v0.7.77 · 2026-11-14

### 调整
- 日志页拆进 `views/Logs.vue`：自己拉 `/api/logs`、订阅 `/api/logs/stream`、级别筛选、下载、清屏；legacy 的 `initLogs` 不再初始化和调用。

## v0.7.76 · 2026-11-14

### 修复
- 站点页静态占位 `#site-detail` 与抽屉渲染重复，导致页面上出现两个同 id 元素；占位改名 `#site-detail-home`，线上实测只剩一个。

## v0.7.75 · 2026-11-14

### 新增
- `pta/checks/build.js`：起临时 v2 后端，用 dist 验证登录与七个路由。

### 调整
- 线上改为服务 `pta/web/dist`；`deploy.sh` 部署前自动 `npm ci && npm run build`。
- `run.sh` 增加构建与 `build.js` 检查。
- 旧 `pta/web` 保留回退，不再修改。

## v0.7.74 · 2026-11-14

### 新增
- `pta/web-src`：Vite 7 + Vue 3 工程，8 个页面 SFC（dashboard/sites/crawl/queue/sources/logs/changelog/settings）。
- `npm run dev/build/preview` 脚本；构建输出 `pta/web/dist`（gitignore）。

### 调整
- 旧 `pta/web/index.html` 的页面结构机械搬进 SFC，样式与图片放 `web-src/public/assets`。
- 迁移期逻辑仍走 `src/legacy/app.js`，页面壳先保持静态；旧版 `pta/web` 保留回退。

## v0.7.73 · 2026-11-14

### 新增
- `pta/checks/api-v2.js`：15 条 v2 契约检查，覆盖 health、安全头、登录/会话/退出、401、dev、config、flow、词条、screen 条件、凭据与下载器不回显、404。

### 调整
- `run.sh` 改跑 `api-v2.js`；旧 `api.js` 标 legacy，不再进检查。
- 文档里的 api 数量改为 api-v2 15。

## v0.7.72 · 2026-11-14

### 调整
- v2 `app-fastify.js` 补静态安全响应头：`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Content-Security-Policy`，与旧后端一致并放行 Cloudflare 分析。

## v0.7.71 · 2026-11-14

### 新增
- v2 `/api/catalog/screen` 接入流程页的分辨率、体积、必须带中字条件，并补同片去重。
- `scripts/load-cookies.js` 改为写 SQLite `credentials` 表（AES-256-GCM 密文）。

### 调整
- `package.json` 声明 `fastify` / `@fastify/static`，`start` 指向 `app-fastify.js`，`engines` 改 Node >=22。
- unit 改用 `User=seedpod` + `/etc/seedpod.env`（0600）；`deploy.sh` 用 sudo 重启。
- `/opt/seedpod` 代码目录归还部署账号，已部署 0.7.71。

### 说明
- v2 还缺安全响应头；api 检查仍测旧后端；smoke 18/23。均已在 TASKS 列明。

## v0.7.70 · 2026-11-14

### 新增
- `pta/checks/browser.js`：跨平台浏览器启动，Linux 默认 Chromium 新 headless，Windows 可选 msedge。
- `pta/checks/run.sh`：Linux 主检查入口；`playwright` 加入 devDependencies。

### 调整
- `smoke.js` / `audit.js` 不再写死 msedge，也不再依赖 `TEMP` 路径；每次检查强制整页重载，消除上一轮弹窗残留。
- `scripts/import-cookies.js` 改用共享的浏览器加载器。
- 文档改为 Linux 优先：AGENTS、CHECKLIST、ARCHITECTURE 的 `run.cmd` / MSYS 写法更新；新增 D13。
- 演示账号与线上密码分离：`AUTH_DEMO` 改为 `demo-pass`，真实密码从仓库移除；新增 D14。

### 说明
- smoke 18/23，5 条断言与当前 demo UI 不同步，已列进 TASKS；本次未改业务逻辑。

## v0.7.69 · 2026-11-14

### 调整
- 写明前端 demo 定位：`pta/web` 是原型，不是终稿；前端定稿后按目标架构整体搬迁一次。
- `AGENTS.md`、`HANDOFF.md`、`TASKS.md` 同步这条；`docs/DECISIONS.md` 追加 D11。

## v0.7.68 · 2026-11-14

### 调整
- `TASKS.md` P0 追加两条搬迁遗留：api 检查仍起旧 `app.js`（45 条测的不是 v2）、`load-cookies.js` 仍写 `credentials.json`（v2 不读）。
- `HANDOFF.md` 更新当前版本。

## v0.7.67 · 2026-11-14

### 新增
- `HANDOFF.md` 增加「架构与交付约束」：后端固定 Node + Fastify + SQLite，前端固定 Vue 3 无构建，最终必须 Docker 部署，旧后端只读。
- `TASKS.md` 增加第七节「待修清单」：P0 三项、P1 四项、P2 三项，标出哪些需要 root。
- `docs/DECISIONS.md` 追加 D8/D9/D10：后端栈、前端栈、Docker 交付。

### 调整
- `AGENTS.md` 项目说明补「交付形态：Docker 部署」。
- 版本号 0.7.67，静态资源缓存号同步。

## v0.7.66 · 2026-11-13

### 调整
- `AGENTS.md` 对齐生产实际：后端从“零依赖单文件”改为 v2（Fastify + SQLite，`app-fastify.js` + `routes-*.js` + `db.js`），旧 `app.js` 标记为只读参考。
- 铁律新增第 7 条：服务端改动只进 v2，避免同一功能两套实现。
- 依赖约束改为：前端不引入构建工具，后端运行时依赖只有 Fastify + `@fastify/static`。
- 故障对照补充 v2 的 MODULE_NOT_FOUND 处理与 `node_modules` 检查；发版说明注明不传 node_modules。

## v0.7.65 · 2026-11-13

### 新增
- `pta/docs/PIPELINE-RULES.md`：流程页 9 组 70 行（67 个控件）全量清单、三个收敛方案、发布条件 20 条留/合并/删/高级建议表。
- `pta/docs/DESIGN.md`：设计变量、组件白名单、文案规则、三宽度验收。
- `pta/docs/REQUIREMENTS-TEMPLATE.md`：需求卡模板与填写示例。

### 调整
- `AGENTS.md` 增加协作协议、复杂度预算、设计约束三节；修正后端路径为 `pta/server/...`。
- `RULES-TREE.md` 按当前 `data.js` 重新生成，补上落后的发布条件 23 行。
- 版本号升到 0.7.65，静态资源缓存号同步。

### 说明
- 本次只改文档与规则树，不动页面结构与后端接口。

## v0.7.64 · 2026-11-13

### 调整
- 发布条件卡去掉外层灰框，改成两列「标签 + 控件」，小节标题只当分隔行；卡高 718→500px，仍然紧凑。
- 发布字段把制作组、音轨移到最后两行，其余标签在前。

## v0.7.63 · 2026-11-13

### 调整
- 发布条件、发布字段、下载条件三张卡里的下拉与文本行改成抓取卡的版式：左边 104px 标签列，右边一行芯片；下拉变单选芯片，文本仍是输入框靠左。
- 新增行类型 pick（单选芯片）与 inline（标签左置）标记，只影响这三张卡，其余卡片不动。
- 标题与副标题的「测试匹配」改成整行，输入框自适应宽度，测试按钮与结果不再被挤在同一列。

## v0.7.62 · 2026-11-13

### 调整
- 出正式的双机流程：Windows 与 VPS 共用 main，开工前 `bash scripts/sync-check.sh` 对本地 / GitHub / VPS 三方提交，一致才 ff 拉取。
- VPS 配好部署密钥，origin 改成 SSH，可直接 pull / push；仓库补回 deploy.sh（rsync 到 /opt/seedpod + 重启），部署完成推一条 Telegram。
- AGENTS.md 的发版说明从 base64 逐个文件上传改成 pull + deploy.sh。

## v0.7.61 · 2026-11-13

### 调整
- 「目标站」卡拆掉：图床、截图来源移到简介卡（紧跟简介图片），发布后校验放到简介卡末尾，目标站分类映射移到发布条件（多目标站之后）。
- 发布卡剩 5 组：发布条件(23)、标题与副标题(9)、简介(13)、发布字段(6)、下载条件(4)。
- data.js 由行级文本搬移改为整树重写，避免手动拼接错位。

## v0.7.60 · 2026-11-13

### 调整
- 「中文副标题来源」从简介卡移到「标题与副标题」，排在副标题语言之后；标题卡 9 行，简介卡 10 行。

## v0.7.59 · 2026-11-13

### 调整
- 简介卡把「简介来源顺序」换成「简介获取方式」多选芯片，占满一行：① 本地已抓数据 / ② 源站详情页 / ③ TMDB / ④ IMDB / ⑤ 豆瓣 / ⑥ 豆影 / ⑦ 电影词条名 / ⑧ 交叉匹配（TMDB+IMDB+豆瓣+豆影）。
- ①/② 跟着抓取卡「抓详情页」开关：开着用本地已抓数据，关掉读源站详情页。
- 行渲染支持 wide（整行）标记，芯片行不再挤在一列里。

## v0.7.58 · 2026-11-13

### 调整
- 发布条件去掉「发到哪」小节，发布到（目标站选择）与多目标站并成一行，卡高 468→437px。
- 「目标站状态」并入查重卡底部：目标站已有原盘、目标站只有 DIY 放到「有效期与失败」之后，发布卡不再有这一组。

## v0.7.57 · 2026-11-13

### 优化
- 流程卡整体收紧：行距 5→3px、控件高 34→28px、字号 12.5→12px、开关 34→30px、列间距 18→12px、卡内边距 9/14→7/12。
- 发布条件卡高度 556→468px，一屏能看到更多行；小节标题间距同步缩小。

## v0.7.56 · 2026-11-13

### 调整
- 「标题匹配」并入「标题与副标题」：种子标题、中文副标题模板、副标题语言之后接匹配范围、写错时、排除匹配、白名单匹配、测试匹配；标题匹配卡删掉，发布卡降到 7 组。
- 「发布条件」卡内加小节标题：发到哪、门槛、内容要求、重复与失败，19 行按块分开，行本身不变。
- 前端新增 section / chips 两种行类型的渲染与样式，为后续紧凑版留口子（本次只用到 section）。

## v0.7.55 · 2026-11-13

### 调整
- 「失败与兜底」「内容要求」「发布时机」三组并进「发布条件」，发布卡剩 8 组。
- 发布条件现在 19 行：发布到、多目标站、分辨率要求、体积范围、下载完成再发布、种子完整性校验、主站已有同片、站点标限制分发、不满足时、图片上传重试、发布失败重试、连续失败几次暂停该站、失败时推送通知、最大体积、地区版本、必须有简介、必须带中字、BDInfo、截图至少几张。
- 主站已有同片默认改为「直接跳过（标记目标站已有）」；站点标限制分发默认改为「标记禁转/限转，不发布」，仍可切只收录或直接丢弃。

## v0.7.54 · 2026-11-13

### 调整
- 发布卡最前面新增「发布条件」组：发布到、多目标站、分辨率要求、体积范围、下载完成再发布、种子完整性校验。
- 原「目标站」组只留图床、截图来源、目标站分类映射、发布后校验。
- 原「发布条件」组改名「内容要求」，只留最大体积、地区版本、必须有简介、必须带中字、BDInfo、截图至少几张。
- 原「发布时机」组只留「不满足时」。

## v0.7.53 · 2026-11-13

### 修复
- 流程规则不再丢字段名：服务端保存时保留每行的 t，发布卡/查重卡才能按名字对上号。
- 旧数据没有字段名时，只有组数完全一致才按位置回填；组数对不上就不猜，避免删组后错位串值。

## v0.7.52 · 2026-11-13

### 修复
- 发布卡删掉「自动发布」组后，旧的已存配置还会按组序号回填，导致后面的组错位串值；改成所有组拍平后按字段名回填，查重卡同样处理。

## v0.7.51 · 2026-11-13

### 删除
- 发布卡里的「自动发布」整组（总开关、发布模式、间隔、每日上限），发布只走待审核里人工点。

### 调整
- 「标题与副标题」只留三样：种子标题原样照搬、副标题模板、副标题语言固定中文。
- 「匹配范围」「写错时」挪进「标题匹配」组，它们本来就只影响标题匹配。

## v0.7.50 · 2026-11-13

### 重排
- 发布卡「标题与副标题」：种子标题移到左一，副标题语言移到左二（正下方），其余字段顺延；已存配置改按字段名回填，不会再错位。

## v0.7.49 · 2026-11-13

### 调整
- 发布卡「标题与副标题」的发布标题改为「种子标题」：文字“原生转载不修改”在左，应用按钮在右，点按钮才生效。

## v0.7.48 · 2026-11-13

### 调整
- 发布卡的「发布标题」由说明文字改成按钮「原样发布不修改」，和同组其他控件对齐。

## v0.7.47 · 2026-11-13

### 优化
- 查重卡与发布卡的分组面板收紧上下留白（每组 padding 9/14、组间距 8、字段行 5px），整页变矮近三成。

## v0.7.46 · 2026-11-13

### 删除
- 流程页抓取/查重/发布卡里每个字段下面的灰色说明小字，只留字段名。

### 调整
- 发布卡与查重卡列宽放宽到 300/280，字段上下留白加大，行不再挤在一起。

## v0.7.45 · 2026-11-13

### 调整
- 查重卡与发布卡统一成「标签在上、控件在下」的自适应多列布局，长标签不再被挤成竖排；查重卡从 9 行纵排压到 4 列。
- 本地演练卡没有内容时不再撑出一块空白。

## v0.7.44 · 2026-11-13

### 修复
- 查重卡不显示：资源缓存参数不一致，浏览器仍在用旧 data.js（旧查重 14 行含正则自定义行），新渲染读到已删除的状态直接抛错。现在 css/data/app 统一同一个版本参数。
- 发布卡 11 组被挤成竖排文字：发布卡内组改为整行、字段自适应列宽，不再挤在同一行。

## v0.7.43 · 2026-11-13

### 调整
- 抓取卡恢复呼吸感：预设一条一行、标签列 68px、芯片 28px 高；请求限制四项进浅底面板；底栏一行放实时说明与「抓详情页」开关。
### 修复
- 限制输入的上下限改为读服务端 /api/config 的 limits，不再前端写死；失焦时按上下限收敛。
- 底栏说明只讲真实参数，删掉按列表条数估算「本次大约几次」的假数字。

## v0.7.42 · 2026-11-13

### 调整
- 查重卡只留查重本身：本地词条、待审核队列、目标站搜索、判定强度、体积容差、查重有效期、词库有效期、请求失败。
- 发布前条件、发布时机、标题匹配、目标站状态四组挪进发布卡；排除/白名单/测试匹配随行迁移，保存时照旧写 flow.rx。
- 流程页保存每行带上标题，服务端按标题取条件，不再依赖行序；老数据没有标题时回落原来的行序。

## v0.7.41 · 2026-11-13

### 调整
- 抓取卡类型/媒介/分辨率/优惠的选项改为左对齐，紧跟在标签后面，不再贴右边缘。
- 删掉「每 60 秒最多发一次 · 45 分钟内最多 12 次请求」这行说明。

## v0.7.40 · 2026-11-13

### 优化
- 抓取卡去掉每行的说明小字与卡片描述，标签只留名词。
- 请求限制四项并成一行四列，输入框 88px；行距压到 3px，卡片再矮一截。

## v0.7.39 · 2026-11-13

### 优化
- 抓取卡紧凑化：预设每条一行、行距减半；请求限制四项改成两列排布，输入框缩短；抓详情页单独占一行。
- 新增 .crawl-card 作用域样式，只影响抓取卡，查重与发布保持原样。

## v0.7.38 · 2026-11-13

### 新增
- 抓详情页：开启后，列表入库前按「请求间隔 + 窗口次数」预算逐条取详情页，补全大小、分类、媒介、标签、副标题、infohash、简介、海报、原盘标记；最多 10 条，失败只记原因不中断。
- 详情解析器 `server/adapters/details.js`：纯函数，NexusPHP 表格与常见 div 都认，认不出留空；带夹具用例。

### 调整
- 抓详情页开关从「只存浏览器」改为存服务端（config.detail），换设备也生效；站点覆盖里的开关优先。
- `/api/crawl/run` 接受 detail、detailLimit，返回体带 detail 统计。

### 优化
- 每次详情请求都计入窗口预算与最小间隔，避免开关一开就超额。

## v0.4.1 · 2026-11-12

### 重排
- 流程页「抓取」卡片拆成「请求限制」加「搜索预设」；请求间隔、每站每天、全站每天、连续失败、运行模式、抓详情页都放回抓取，不再放设置页。
- 排除/白名单/测试匹配从「发布 › 标题与副标题」挪到「查重 › 筛选条件」。

### 删除
- 抓取卡里的「跳过规则」标签组（抓取只记事实，自动打标，跳不跳留到筛选）。
- 「请求限制」在设置页的那一份（同一件事只留一处）。
- 旧的「每轮最多翻页」「断点续抓」「并发」「请求审计」行（程序行为，不是用户参数）。

### 新增
- 页脚开发说明：版本、开发日期、前后端技术栈、页面数、接口数、站点/预设/词条/待审/下载器数、运行时长，全部来自 `/api/dev`。
- `/api/dev` 接口；版本号升到 0.4.1。
- 「连续失败」改成可配置（1–10 次），服务端按范围校验后落 config.json。
- 下载器探测补真实磁盘总量（statfs），qB 报的剩余比本机盘大时以本机盘为准；余量条重新有数据。

### 调整
- 站点覆盖：单独设置本站改成真开关；抓取间隔改为分钟数下拉；每天抓几次改成数字输入；关闭时下方整块置灰不可点。

### 优化
- 抓取卡底部小字实时显示「每 N 秒发一次请求 · 模式 · 本次大约几次请求」。
- 保存抓取卡时把节奏与上限一并写进服务端 `/api/config`。

## v0.4.0 · 2026-11-11

- 基础版本：站点 / 流程 / 待审核 / 数据清单 / 日志 / 设置，抓取演练、查重、发布卡片。

## v0.4.2 · 2026-11-12

### 修复
- 下载器测试对 qBittorrent 5.x 一律误判「不通」：5.x 登录成功回 204 且 cookie 名是 QBT_SID_<端口>，旧代码只认正文 "Ok." 和 SID=，改成认 cookie + 2xx 即成功。两台下载器现在都通过（v5.1.2 / v5.2.4），分类也能读出来。
- 下载器密码之前是明文存在 downloaders.json 里，现在改为 AES-256-GCM 密文（与站点 cookie 同一套密钥），启动时自动把旧明文迁移成密文；接口只回 hasPass，不回明文。
### 说明
- 容量进度条只在面板能确认同一块盘时才画；qB 只报剩余空间不报总量，远端下载器不编总量，只显示真实剩余。

## v0.4.3 · 2026-11-12

### 修复
- 下载器空间：之前拿面板本机磁盘的总量去补远端 qB 的总量，导致「共 314GB」和 qB 自己显示的对不上。现在只显示 qB 上报的真实剩余，总量不知道就不写，也不画假进度条。
- 站点登录状态：站点页的「登录」列接服务端保存的 cookie 自检结果。可用=自检通过，失效=自检失败，未自检=还没探过；不再一律显示「未登录」。筛选与总览计数同步改词。

## v0.4.4 · 2026-11-12

### 新增
- 站点页工具栏加「自检有 cookie 的站」：逐个对有 cookie 的站点跑一次会话自检（每个站一次 GET），结果直接写进登录列。
### 调整
- 登录列口径固定为：可用＝cookie 自检通过；失效＝cookie 自检失败；未自检＝还没探过。不再把「有 cookie 但没探过」显示成「未登录」。

## v0.4.6 · 2026-11-12

### 新增
- 向目标站查重（真请求）：拿词条标题去目标站搜一次，按旧脚本规则判定——只认原盘、分辨率档一致、体积差 ≤2.5GB 或 ≤5%；命中全是 DIY 记「仅DIY可发」。结果写回词条（dupe/dupeUrl/dupeAt/dupeTitle/dupeSizeGB/dupeTarget）。
- 数据清单工具栏加「选目标站」下拉（只列存过 cookie 的站）和「向目标站查重」按钮，每次默认 3 条，条间留 8–20 秒。
- 词条行上显示查重结论：可发 / 仅DIY可发 / 已有原盘 / 没查成，点标签回到当时的搜索页。
### 调整
- 「已有与归档」改名「词条数据」，加「查重有效期」（7/15/30/90 天）。

## v0.4.8 · 2026-11-12

### 新增
- 基础版 / 开发版切换：设置页「版本模式」，选开发版才出现「更新日志」页；选择存在浏览器里。
- 更新日志页：读仓库 CHANGELOG.md，按 删除 / 新增 / 优化 / 调整 / 重排 展示。
### 调整
- 移动端适配：窄屏顶部栏换行、右侧导航改底部横条、数据清单卡片化、弹窗 94vw。

## v0.4.9 · 2026-11-12

### 调整
- 前端引入 Vue 3（自托管 vue.global.prod.js，无构建），更新日志页改成 Vue 渲染，用 render 函数以符合 CSP，不跑运行时编译。
### 新增
- 基础版 / 开发版切换（设置 › 版本模式）：开发版才出现「更新日志」页。
- 更新日志页读仓库 CHANGELOG.md，按 删除 / 新增 / 优化 / 调整 / 重排 展示。

## v0.5.0 · 2026-11-12

### 调整
- 设置页整页改成 Vue 3 组件渲染（render 函数，单次挂载 + reactive 状态），旧的字符串拼接与事件委托全部删掉；版本模式、退出登录、清空缓存的行为不变。

## v0.5.1 · 2026-11-12

### 调整
- 「请求限制」卡片改成 Vue 组件，独立的保存按钮直接写 /api/config：请求间隔、每站每天、全站每天、连续失败、运行模式、抓详情页都在这里配一次；旧的 pace 逻辑与 data.js 里的重复分组删掉。

## v0.5.2 · 2026-11-12

### 调整
- 「搜索预设」卡片改成 Vue 组件，按组渲染类型/媒介/分辨率/优惠，选中条件直接写 /api/flow 的 fetch 组；流程页旧的四组拼接代码删掉，查重/发布保存时不再覆盖 fetch。

## v0.5.3 · 2026-11-12

### 新增
- 流程页加「自动查重」开关，默认关闭；关闭时不会主动向目标站发请求，只有数据清单里手动点「向目标站查重」才查。开关状态存服务端 config.json（autoDupe），重启后保持。

## v0.5.6 · 2026-11-13

### 调整
- 「查重」卡片改成 Vue 组件：筛选条件、关键词（排除/白名单/测试）、词条数据有效期都在一张卡里，保存写 /api/flow 的 dedupe 组与 rx；旧的查重渲染与事件托管删除，发布卡保存不再覆盖查重。

## v0.5.8 · 2026-11-13

### 调整
- 「发布」卡改成 Vue 渲染，自定义 html 行保留原样注入，按钮仍走事件委托；三张卡（抓取/查重/发布）全部 Vue 化，旧 sectionHtml/setRowsHtml 渲染路径随之退场。
- 卡片收紧：字段行距 8px、控件高 30px、抓取卡四组数值两列排布，整体密度回到迁移前。

## v0.6.0 · 2026-11-13

### 调整
- 总览页改成 Vue 渲染：统计、实时日志、系统状态、最近发布、待审核五块都是响应式组件，布局与卡片结构照旧；旧 renderDashboard/renderPending/renderPublished/renderHealth 只保留为同步触发器。
