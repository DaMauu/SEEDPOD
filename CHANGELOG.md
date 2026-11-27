# 更新日志

## v0.7.725 · 2026-11-28

### 全站识别体检工具
- 新增只读体检脚本：每站最多请求搜索页 1 次 + 上传页 1 次，不重试、不写站点配置。
- 结果按站保存 JSON 和原始 HTML，另生成 `summary.json`、`summary.md`、`notes.md`。
- 统计搜索分类、未识别标签、上传表单、分类控件、复选/单选组、发布重复/差异。
- 默认串行、间隔 10 秒；遇到 429/403/503 停止该站，连续限流停止整批。
- 全量 `run.sh` 通过。

## v0.7.724 · 2026-11-28

### 上传分类支持复选/单选/多选组
- 同名 checkbox/radio 合并成一个选项组，不再只保留第一个值。
- 上传页分类控件同时识别 `type`、`category`、`categories[0][]`、`category_ids[]` 等下拉/复选/单选。
- 多个分类字段的选项会合并去重；题材/标签字段不混进内容分类。
- 复选框默认值只在 `checked` 时写入，不把第一个选项误当默认。
- 补表单夹具和分类字段选择检查；全量 `run.sh` 通过。

## v0.7.723 · 2026-11-27

### 上传字段可手动编辑
- 识别预览的上传表单增加“编辑字段”：可改字段名、模板、文件字段，也可增删字段。
- 保存前校验字段名为空、重复、非法字符、模板过长；有问题不上传这段。
- 保存写回 `publish.upload`，发布计划和目标站提交都用编辑后的字段。
- 搜索/发布识别正常时，上传字段有问题仍可只保存可用段，不写坏字段。
- 全量 `run.sh` 通过。

## v0.7.722 · 2026-11-27

### 音频编码不再被当成视频编码
- 上传表单解析时先判断音轨/音频，再判断视频编码；`audiocodec_sel` 不再被写成 `{codec}`。
- 蟹黄堡真实上传页复测：30 个字段，只有 `audiocodec_sel[4]`、`audiocodec_sel[6]` 从 `{codec}` 修正为 `{audio}`。
- 补表单夹具：`audiocodec_sel` → `{audio}`，`codec_sel` → `{codec}`，`audiobook` 不误判。
- 全量 `run.sh` 通过。

## v0.7.721 · 2026-11-27

### 搜索分类支持 WebUI 手动映射
- 识别预览里，搜索未识别分类和冲突 ID 可直接选库内类型，保存写 `search.detect.map/skip`。
- 手动选择后预览立即更新；冲突 ID 可选“不写”或“跳过旧数据”，不再只能改代码。
- 保存时先写覆盖规则，再用同一套规则应用识别结果，下次识别立即生效。
- 已通过映射/跳过的分类不再挂在“未识别”里。
- 全量 `run.sh` 通过。

## v0.7.720 · 2026-11-27

### 电影多 ID 显示与繁体标签
- 搜索分类保存站点原文标签（如「401 电影 - 中国大陆」），不再只显示一串 ID。
- 同一类型有多个站点子分类时显示数量角标，鼠标悬停提示“搜索时会一起带上”；这不是重复 ID。
- 繁体标签归一：`免費`、`半價`、`兩倍`、`禁轉`、`限轉`、`紀錄片`、`動畫`、`劇集` 等不再进未识别。
- 上传页发布分类同样支持繁体标签匹配，且仍然一个 option 只落一个库内类型。
- 全量 `run.sh` 通过。

## v0.7.719 · 2026-11-27

### 搜索识别排除子菜单与标签
- 只把纯分类入口当搜索分类；`processing`、`tag_id`、`special.php` 等子菜单/标签/最近搜索链接跳过。
- 蟹黄堡真实页复测：10 类、冲突 0、未识别 0（之前会把地区/题材标签当分类）。
- 上传页无表单直接提示“账号没有上传权限或站点未开放上传”；搜索正常时可只保存可用段。
- 全量 `run.sh` 通过。

## v0.7.718 · 2026-11-27

### 搜索识别参数名不再算未识别
- 忽略 `cat401`、`medium1`、`standard1` 这类表单参数名，不再把它们当成“未识别标签”。
- 参数名只是页面控件的 name/value，不是人类可读分类；重复复选框不会再刷出 33 个假未识别。
- 52PT 真实页复测：搜索 11 类、冲突 0、未识别 0（之前是 11 个分类 + 33 个假标签）。
- 上传页 200 但无表单仍是账号上传权限/站点关闭上传，不影响搜索分类结果。
- 全量 `run.sh` 通过。

## v0.7.717 · 2026-11-27

### 识别明细三列卡片与每站别名
- 识别表盘内部改成三列圆角矩形卡片：搜索分类 / 发布分类 / 上传表单左右并排。
- 搜索分类 ID 和发布分类 ID 严格分开，不再把两套数字当同一命名空间。
- 一个上传页 option 只落一个库内类型；组合标签按更具体类型优先，不复制到多个类型。
- 发布明细里未匹配/组合标签可直接选类型；保存时写 `publish.detect.labels`，下次识别优先用它。
- 保留保存前校验、冲突/未匹配提示；窄屏自动上下排列。
- 全量 `run.sh` 通过。

## v0.7.716 · 2026-11-27

### 识别保存前校验
- 三合一识别增加保存门槛：搜索分类 >0、发布分类 >0 且不是题材字段、上传字段 >0 且有文件字段/提交路径。
- 缺项直接列在识别表盘里，保存按钮禁用；冲突 ID、未识别标签只提示不阻断。
- 发布分类匹配精确名优先，同一 ID 命中多个类型时不写；冲突和未匹配标签列在识别明细。
- 失败段会标明搜索/上传，避免以为整次识别成功。
- 全量 `run.sh` 通过。

## v0.7.715 · 2026-11-27

### 搜索/发布/上传识别三合一
- 三个识别表盘合并成一个“识别”表盘；点开一次预览搜索分类、发布分类、上传表单三段。
- “识别全部”只读搜索页 + 上传页各一次，上传页同时产出发布分类和上传字段，不再重复请求。
- 预览后点“保存识别结果”：分别写 `search.type`、`publish.catMap`、`publish.upload/form`；哪段失败只影响哪段。
- 旧三个识别接口保留，页面不再各放一套按钮；删掉旧表盘识别函数。
- 顺带修复发布分类自动保存字段名不匹配，以及未识别标签可展开分组查看。
- 全量 `run.sh` 通过。

## v0.7.714 · 2026-11-27

### 站点覆盖表盘
- 站点覆盖做成第七个表盘，和登录/站点/Cookie/搜索/发布/上传排成一排。
- 表盘显示 ON/OFF；点开调单独设置、抓取间隔、抓详情页、优先级。
- 去掉重复的“分类映射 已配 N 条”摘要。
- 全量 `run.sh` 通过。

## v0.7.713 · 2026-11-27

### 上传识别保存下拉选项
- “识别上传表单”把识别到的下拉选项和默认值存进 `publish.form`，供发布计划补必填下拉。
- `compactForm` 增加 `resolution_id`，Unit3D 分辨率等字段不再被过滤。
- 仍只保存站点差异，不覆盖发布分类。
- 全量 `run.sh` 通过。

## v0.7.712 · 2026-11-27

### 上传识别不覆盖发布分类
- “识别上传表单”只提交 `uploadMap`，不再带 `catMap/cats`，避免把发布分类映射覆盖成搜索分类。
- 检查补：只保存上传映射时，发布分类必须保持不变。
- 全量 `run.sh` 通过。

## v0.7.711 · 2026-11-27

### 站点详情表盘一排
- 登录、站点地址、Cookie、搜索、发布、上传六个表盘排成一行。
- 登录状态、站点域名、Cookie 条数、搜索/发布分类数、上传字段数都进表盘。
- 操作按钮收进展开明细；表盘只显示状态，点开再编辑或识别。
- 窄屏表盘横向滚动，不撑破页面。
- 全量 `run.sh` 通过。

## v0.7.710 · 2026-11-27

### Cookie 三件事
- Cookie 改成表盘：大数字显示 cookie 条数，点开编辑；保存时自动清洗 Cookie / Set-Cookie / cURL，只留 `name=value`，裸值直接拒绝。
- 站点页加“导入”弹窗：支持 JSON / 每行 `host<Tab>cookie`，一次最多 200 条，按 host 批量写密文。
- 自检、抓取、搜索识别、目标站查重拿到响应 `Set-Cookie` 时顺手合并，不额外发请求；会话可续期。
- 全量 `run.sh` 通过。

## v0.7.709 · 2026-11-27

### 搜索分类表盘与移除下一步
- 搜索分类改成和发布分类/上传表单一样的表盘：大数字 + 识别按钮，点开看分类和识别明细。
- 移除站点详情“下一步”按钮及 `nextSteps`/`goStep` 代码；不做自动跳转。
- 全量 `run.sh` 通过。

## v0.7.708 · 2026-11-27

### 站点详情下一步
- 登录卡下面加“下一步”四项：登录 / 搜索 / 发布 / 上传，按就绪度显示绿黄红。
- 点登录：缺 cookie 滚动到输入框；有 cookie 未自检直接跑一次自检；失败提示重导。
- 点搜索/发布/上传：滚动到对应区块，不自动发请求。
- 全量 `run.sh` 通过。

## v0.7.707 · 2026-11-26

### 面板账号可在 WebUI 修改
- 新增 `data/auth.json`：用户名 + scrypt 密码哈希（随机盐，0600），不再依赖 systemd 环境变量。
- `PTA_USER` / `PTA_PASS` 只用于首次初始化；文件存在后以面板设置为准。
- 设置页可改用户名/密码；改密码会清掉所有会话并强制重登，改用户名保留当前会话。
- 旧密码校验失败按 IP 限速；账号文件纳入备份/恢复。
- 全量 `run.sh` 通过。

## v0.7.706 · 2026-11-26

### 发布预检补充
- 发布前检查补“发布方式”：真发布 / 演练不会提交；徽标对应显示“可提交”或“可演练”。
- 补“字段 N 个”，能看出计划实际会填多少字段。
- 原有目标站、分类、制作组、媒介、查重、infohash、种子、Tracker、缺项保持不变。
- 全量 `run.sh` 通过。

## v0.7.705 · 2026-11-26

### 表盘尺寸
- 发布分类/上传表单表盘从整行半圆缩到 148×148（手机 132×132），更像小表盘，不再占满整行。
- 交互不变：点表盘展开明细，识别按钮仍在下方。
- 全量 `run.sh` 通过。

## v0.7.704 · 2026-11-26

### 站点详情表盘与预览清理
- 去掉“搜索链接预览”的界面和后端 `previewUrls`，不再展示单分类示例 URL。
- 发布分类和上传表单改成两个“表盘”小卡：大数字 + 名称 + 识别按钮，点表盘展开明细。
- 发布分类仍只读，上传表单仍只显示状态；数据口径不变。
- 全量 `run.sh` 通过。

## v0.7.703 · 2026-11-26

### 清理旧采集脚本
- 删除 v1 采样/分析/生成 `site-defs` 的 5 个脚本：`sample-sites.js`、`analyze-samples.js`、`collect-site-defs.js`、`ingest-manual.js`、`coverage.js`。
- 当前 `package.json`、文档和检查都不引用；v2 也不再读 `site-defs`。
- 全量 `run.sh` 通过。

## v0.7.702 · 2026-11-26

### 清理无用示例
- 删除 `pta/server/data/site-arch.csv`：306 行占位站，当前代码不读，容易误认成真实站点清单。
- 真实旧清单只在本机 `pta/data/site-arch.local.csv`，已被 gitignore。
- 全量 `run.sh` 通过。

## v0.7.701 · 2026-11-26

### 批量导入 cookie 脚本修复
- `scripts/load-cookies.js` 改用 v2 模块，一次把多个 host 写进 `data/cookies.json`。
- 支持 `{host: cookie}` 和 `[{host, cookie}]` 两种输入，最多 200 条。
- 补命令行导入检查；全量 `run.sh` 通过。

## v0.7.700 · 2026-11-26

### 就绪度筛选
- 站点页新增“全部就绪”筛选：缺登录、缺搜索、缺发布、缺上传、可抓取、可发布。
- 纯本地数据，不发请求；和现有搜索、架构、状态、预设、抓取筛选叠加。
- 全量 `run.sh` 通过。

## v0.7.699 · 2026-11-26

### 就绪度刷新降频
- 站点页可见时就绪度刷新从 2 分钟改为 5 分钟；页面隐藏/离开仍不发请求。
- 对目标站仍是 0 请求；cookie 有效性仍需手动“自检”。
- 全量 `run.sh` 通过。

## v0.7.698 · 2026-11-26

### 就绪度实时刷新
- 删除右侧登录绿点，避免和“登录”就绪标重复。
- 站点页可见时每 2 分钟刷新一次 `/api/sites/readiness`；页面隐藏或离开站点页不发请求。
- 登录状态最多信 2 小时，超过自动降为“待复检”，不再拿旧记录冒充当前有效。
- 实时刷新只读本地文件，不自动请求目标站；真实验证仍点“自检”。
- 全量 `run.sh` 通过。

## v0.7.697 · 2026-11-26

### 就绪度视觉
- 四个小标从彩色方框改成“圆点 + 文字”（登录 / 搜索 / 发布 / 上传），只给圆点着色。
- 文字保持灰色，减少列表噪声；状态不变，仍是绿=就绪、黄=待验证、红=缺项。
- 全量 `run.sh` 通过。

## v0.7.696 · 2026-11-26

### 站点就绪度
- 站点列表每行显示“登 / 搜 / 发 / 传”四个小标：绿=就绪、黄=待验证、红=缺项。
- 登录：有 cookie 但没最近自检为待验证；cookie 解不开或自检失败为红。
- 搜索/发布看分类数；上传区分“站点字段”和“引擎默认字段”。
- 数据由 `/api/site-defs` 本地计算，不发请求；检查补接口字段和列表渲染。

## v0.7.695 · 2026-11-25

### 上传页路径与识别结果
- 修正表单 `action` 相对路径解析：`takeupload.php` 统一成 `/takeupload.php`，避免发布拼错地址。
- 猫站识别并保存 27 个上传字段；52PT 上传页正常返回但没有表单，按账号无上传权限处理。
- 无表单提示改为“页面正常但没有表单，账号可能没有上传权限；引擎默认仍可用”。
- 全量 `run.sh` 通过。

## v0.7.694 · 2026-11-25

### 上传表单引擎默认与路径匹配
- 站点定义接口返回引擎默认上传字段数；站点详情显示“引擎默认 N 个字段”，不再误报“未配置”。
- NP / U3D / GZ 默认上传页 404/405 时，按引擎候选路径再试，最多 3 条、串行。
- 识别失败提示明确“引擎默认仍可用；先确认上传权限”，不再要求手工配字段。
- 检查补候选路径、默认字段数和页面状态。

## v0.7.693 · 2026-11-25

### 站点详情清理
- 删除已经没有入口的旧保存函数和状态：站点定义保存、上传映射保存、识别覆盖保存。
- 页面行为不变：发布分类和上传表单仍只保留识别入口，识别后自动保存。
- 全量 `run.sh` 通过。

## v0.7.692 · 2026-11-25

### 搜索 URL 单选参数修复
- 同一参数多选时不再重复拼接；多选 `spstate` 视为不筛，单选仍保留。
- 52PT 抓取从 3 条恢复到 100 条；猫站 100 条；两边详情各 1/1、入库各 100（临时库）。
- 全量 `run.sh` 通过。

## v0.7.691 · 2026-11-25

### 分类归一修复
- 有声书（Audiobook / Audio Book）优先归“有声书”，不再被“音乐”规则先匹配。
- Soundtrack / 原声归“音乐”，上传分类识别能覆盖原声类别。
- DreadVault 搜索分类修正为 movie/tv/ebook/audiobook；发布映射补 audiobook=5，保留 music=4。
- 全量 `run.sh` 通过。

## v0.7.690 · 2026-11-25

### 识别与缓存修复
- 修复 `sites.json` 读坏或无权限后缓存 preset 回退的问题：修好文件后下一次请求会重读，不再一直读旧快照。
- 上传表单模板不再把 IGDB/TMDB/TVDB/MAL 外部 ID 当分类，`*_exists_on_*` 存在标记不复用 ID 模板；IMDb 字段仍映射 `{imdb}`。
- DreadVault 真实识别并保存：搜索 4 类、上传 29 字段；3 次只读请求，写入生产 `data`。
- 全量 `run.sh` 通过。

## v0.7.689 · 2026-11-25

### 发布分类只读展示
- “发布分类”改成和“分类 id”一样的只读列表；去掉输入框、下拉框、加一条、保存映射。
- 保留“识别目标站分类”，识别成功后自动写 `publish.catMap` 并刷新列表。
- 站点定义接口新增 `publishCatMap`，只读展示读真实发布映射，不再和搜索分类混用。
- 全量 `run.sh` 通过。

## v0.7.688 · 2026-11-25

### 上传表单失败提示与发布分类自动保存
- 上传表单识别失败不再提示“可以继续手工编辑字段表”，前端已移除字段表；改为提示检查上传权限或路径。
- “识别目标站分类”成功后自动保存映射，不需要再点“保存映射”；题材字段只提示不写。
- 全量 `run.sh` 通过。

## v0.7.687 · 2026-11-25

### 站点详情精简
- 顶部只留“登录”和“抓取”；“试抓一页”进抓取卡，去掉抓取参数和最近收录。
- “搜索分类”合并分类 id、识别搜索预设、预览/明细；去掉独立识别卡和识别覆盖卡。
- “发布分类”保留映射，新增“识别目标站分类”；上传表单只留状态和“识别上传表单”。
- 上传表单参数和站点定义 JSON 从前端移除，仍存 `sites.json` / pack；识别后自动保存。
- 全量 `run.sh` 通过。

## v0.7.686 · 2026-11-25

### 题材字段不自动映射
- 上传分类识别先判断字段是否题材/类型标签（动作/惊悚/恐怖/喜剧/剧情…）；是则返回 `fieldKind=genre`，不自动写 `publish.catMap`。
- 站点映射弹窗提示“题材字段，请手工选择或跳过”。
- DarkLand 这类站不再把题材误当内容分类。
- 检查补题材/内容字段判定；全量 `run.sh` 通过。

## v0.7.685 · 2026-11-25

### 识别明细
- 预览时展开每个大分类 → 站点 ID + 原始标签，以及未识别标签、冲突 ID。
- 确认前能直接看出哪条分类不对，不用先保存再看结果。
- 全量 `run.sh` 通过。

## v0.7.684 · 2026-11-25

### 识别预览差异
- 预览不只报数量，还会显示会新增/移除哪些大分类（中文名）。
- `/detect?preview=1` 和 `/apply` 返回分类 diff；保存前能看到要移除的旧分类。
- 检查补 `diffCats` 回归。
- 全量 `run.sh` 通过。

## v0.7.683 · 2026-11-25

### 跨引擎识别回归
- 新增 `recognize-matrix` 检查：NexusPHP、Unit3D 复选框、Unit3D Livewire、Gazelle 四个夹具同时验架构判定和分类/维度结果。
- 夹具补齐真实结构：`catNNN=1` + `img alt`、`categories[0][]`、`wire:model.live="categoryIds"`、`filter_cat/media/codec/audioformat`。
- 全量 `run.sh` 通过。

## v0.7.682 · 2026-11-25

### 站点识别覆盖
- `search.detect` 支持 `engine`、`skip`、`map`：强制架构、跳过分类 ID、把标签/ID 固定到大分类。
- 站点页加“识别覆盖 JSON”输入和保存；识别/批量都会先应用覆盖。
- 覆盖的 skip/map 会清理已保存的旧分类，不只清检测结果。
- API 检查补覆盖保存、map、skip。
- 全量 `run.sh` 通过。

## v0.7.681 · 2026-11-25

### 识别报告与架构判定
- 识别返回 `engine` / 置信度 / 未识别标签；未知架构只在置信度 ≥ 0.6 时写回。
- 预览显示架构、冲突数、未识别标签数；确认后才保存。
- 未识别标签进报告，方便后续补关键词或做站点 override。
- API 检查补：架构写回、冲突 ID、应用识别结果。
- 全量 `run.sh` 通过。

## v0.7.680 · 2026-11-24

### 识别预览与关键词优先级
- 站点页“识别搜索预设”改为先预览再确认；确认后用 `/apply` 保存，不再二次请求站点。
- 预览显示分类数、冲突未写和置信度；冲突 ID 跳过。
- 复合媒介先按强关键词判：Blu-ray Remux/4K UHD Remux 归 Remux，Blu-ray DIY 归 Blu-ray，2K原盘中字归原盘。
- 新增 API 检查：应用识别结果、冲突 ID 报告。
- 全量 `run.sh` 通过。

## v0.7.679 · 2026-11-24

### 52PT 408 归音乐
- 组合链接 `?cat406=1&cat408=1` 不再当成单个分类；支持 `&amp;` 编码。
- 408 按复选框 `HQ Audio/无损音乐` 归音乐，406 按 `Music Videos` 归 MV。
- 52PT 类型改为 `music:408`、`mv:406`，不再有 `concert:408`；预览不再显示演唱会。
- 全量 `run.sh` 通过。

## v0.7.678 · 2026-11-24

### 识别合并统一
- 站点页“识别搜索预设”和批量脚本共用 `detect-merge`，不再两套合并逻辑。
- 同一站点 ID 被识别成多个大分类时跳过不写；页面显示“冲突未写”。
- 52PT 已清理为 11 类 / 11 个 ID，408 不再同时进 concert 和 music。
- 全量 `run.sh` 通过。

## v0.7.677 · 2026-11-24

### 上传分类映射对齐新大分类
- `matchCats` 只认 18 个内容类型中文名；移除原盘/Remux/压制/学习/样品/预告。
- 上传分类只写 `publish.catMap`，不碰 `search.type`；搜索预设识别只写 `search.type`。
- 站点映射保存提示改为“已保存到站点分类映射”。
- 全量 `run.sh` 通过。

## v0.7.676 · 2026-11-24

### 分类口径收口
- TVRip 归 HDTV，LaserDisc 归 Other，SD 归 480p。
- DTSMA 归 DTS-HD，PCM 归 LPCM；音频全局选项去掉重复项。
- 样品/预告归 Other，不再作为内容类型。
- 制作组保持站点自定义；容器/语言/字幕不进六项。
- 全量 `run.sh` 通过。

## v0.7.675 · 2026-11-24

### 内容类型与媒介拆开
- 内容类型只留 18 个：电影/剧集/综艺/动漫/纪录片/音乐/演唱会/音乐短片/体育/游戏/软件/电子书/有声书/短剧/舞台/成人/图片/其他。
- 媒介只留 10 个：Blu-ray/Remux/Encode/WEB-DL/WEBRip/HDTV/DVD/HDDVD/VHS/其他。
- 原盘(Full Disc)、UHD 原盘、3D 原盘统一归到 Blu-ray 大分类；站点只有 Blu-ray 时也用它。
- 旧内容类型 `full_disc/remux/encode/sample/trailer` 归到 `other`；旧媒介归到 `bluray` 组。
- 全量 `run.sh` 通过。

## v0.7.674 · 2026-11-24

### 站点预设识别修正
- NexusPHP 分类复选框（`cat401=1`）按旁边 `<img alt="Movies/电影">` 识别；52PT 从 2 类补到 11 类。
- `TV Shows/综艺` 归综艺，音乐 MV 归 MV，戏曲/曲艺归舞台演出。
- 抓取卡按“类型/媒介/编码/音频编码/分辨率/制作组”排序；编码、音频、制作组接入搜索 URL 和保存。
- UI 把“原盘 / UHD 原盘 / 3D 原盘”合并成一个“Blu-ray”大分类，覆盖站点 full_disc / bluray / uhd / 3d 子项。
- Gazelle 搜索表单 `media` / `codec` / `audioformat` / `resolution` 能识别；新增 MPEG1/AV1、EAC3/DTS-HD MA/PCM/Opus/MP2/MP1/无音频、LaserDisc 选项。
- 制作组按站点选项保存，不再被全局 key 过滤掉；原盘向下匹配到站点唯一 Blu-ray 的情况有 URL 测试。
- 仪表盘“cookie 可用”只统计仍有 cookie 的站；保存/删除/导入 cookie 会清旧自检状态，避免清空后还显示可用。
- `/api/*` 响应加 `Cache-Control: no-store`；首页统计 10 秒刷新并在窗口聚焦时刷新。
- 预设确认状态改为“有分类 ID 即已确认”，清掉 `site-search.local.json` 旧提示。
- 修复上传表单识别失败提示重复。

### 面板 cookie 回显
- 单站详情回显已保存 cookie；凭据列表仍只回 `hasCookie`。
- `GET /api/credentials/:host` 需登录、`Cache-Control: no-store`、不写日志。
- 保存后不再清空输入框，cookie 立即显示。

## v0.7.673 · 2026-11-24

### 面板 cookie 保存回归
- `smoke-live` 增加面板保存/清除 cookie 的检查：填写 → 保存设置 → `/api/credentials` 回 `hasCookie` → 清除。
- 站点列表绿点改为“有 cookie 且自检通过”才绿；清空 cookie 后不再显示旧状态的绿色。
- 没有 cookie 时隐藏“连接自检”“自检”两个按钮；“删除 Cookie”保持禁用。
- 27/27 通过；0.7.673 发版。

## v0.7.672 · 2026-11-24

### Unit3D Livewire 搜索预设
- 识别 `wire:model.live="categoryIds"` 复选框；这类 input 没有 `name`，之前会被跳过。
- 标签支持在复选框前、后、或把 input 包在 `<label>` 里三种结构。
- 新增 Livewire 夹具；真实 Unit3D 页面已确认是这套结构，按探测规则未再复测。

## v0.7.671 · 2026-11-24

### 搜索预设识别补 Unit3D
- 支持 Unit3D 的 `categories[0][]` 复选框分类，标签从 `<label for>` 取，不再只认下拉框。
- `TV Shows` 归到剧集，不再误归综艺。
- 新增 Unit3D 夹具检查；2 个真实 Unit3D 站页面没有可解析的分类字段，仍需手工映射。

## v0.7.670 · 2026-11-24

### 批量搜索预设识别
- 新增 `pta/server/scripts/detect-search-presets.js`：有 cookie 的站每站 1 次 GET 搜索页，串行、间隔默认 10 秒，403/429/503/登录跳转立即停。
- 默认只数站和出报告，必须加 `--run` 才发真实请求；`--write` 只写高置信度结果，`--force` 才覆盖手工值。
- 同一个站点 ID 被识别成多个大分类时跳过不写，避免把电影塞进有声书；报告里标 `ambiguous`。
- 已在生产跑完 9 个有 cookie 的站：4 个写入分类/参数，5 个搜索页没有可用分类；全量检查通过。

## v0.7.669 · 2026-11-24

### 站点 JSON 块状格式
- `sites.json` / `sites.preset.json` 改成每站 `meta / search / publish / settings` 四块；`meta` 一行、`search` 四行、`publish` 四行、`settings` 一行。
- `search` 五维直接放 `type / medium / resolution / discount / restriction`；媒介选项写成 `bluray = medium1 = 1`，其他维度写成 `standard = 1`。
- 搜索分类 `search.type` 与上传分类 `publish.type` 分开；`limits / downloadLink / refreshCron` 收进 `search`。
- 所有写入统一走 `formatSitesDoc`；新增 `sites-format` 检查，排版被改回普通缩进会失败。
- 旧结构读取时自动迁移，写回新结构并留 `.bak`；生产 `sites.json` 部署后第一次读取自动迁移。
- `sites.preset.json` 重新生成，306 站语义校验 0 差异，1610 条搜索 URL 对照 0 差异。
- 全量 `run.sh` 通过，质量审计总体 100。

## v0.7.668 · 2026-11-23

### 搜索预设识别与大分类向下匹配
- 新增搜索页识别：分类 ID、媒介、编码、音频、分辨率、制作组，按选项保存参数名（如 `medium1`、`medium12`）。
- 新增 `POST /api/crawl/preset/:host/detect`，一次 GET 后合并写回站点预设；站点详情增加“识别搜索预设”按钮。
- `full_disc` 向下展开到 Blu-ray / Blu-rayUHD / 3D 原盘；预览和抓取共用同一份 URL 拼装。
- NexusPHP 支持 `cat401=1` 分类模式；`incldead=0` 明确为“包括断种”。
- 抓取类型优先按流程页勾选过滤，不再抓站点绑定的全部类型。
- 52PT、BTSCHOOL、猫测试站已按真实搜索页参数修正。
- 全量 `run.sh` 通过，质量审计总体 100。

## v0.7.667 · 2026-11-23

### 后端目录收尾
- sidecar Python 脚本进 `server/src/infra/sidecar`。
- 调度扩展点进 `server/src/features/scheduler/steps`。
- `server/` 根下只剩 `src`、`pack`、`scripts`、`checks`、`fixtures`、`data`。
- 全量 `run.sh` 通过。

## v0.7.666 · 2026-11-23

### 后端收口完成：入口 / 路由 / core
- 入口迁到 `server/src/main.js`，CLI 迁到 `server/src/cli.js`。
- 剩余 routes 全部进 `server/src/http`。
- `clients`、`core` 进 `server/src`；`server/` 根下不再有 JS 文件。
- systemd、Docker、package.json、检查统一新入口；全量 `run.sh` 通过。

## v0.7.665 · 2026-11-23

### 后端收口：scheduler / downloaders / media / notify
- 调度各阶段进 `features/scheduler`。
- qB 与下载器策略进 `features/downloaders`。
- 媒体、MediaInfo、图床、元数据进 `features/media`。
- 通知进 `features/notifications`；sidecar、表单解析进 `infra`。
- 删除无引用 `categories.js`；全量 `run.sh` 通过。

## v0.7.664 · 2026-11-23

### 后端收口：publish / target
- 发布、release、目标站计划/提交/回查/辅种进 `features/publish`。
- 请求队列、URL 守卫、安全 HTTP 进 `infra`。
- 目标/发布/映射路由进 `src/http`；规则读取路径同步。
- 全量 `run.sh` 通过。

## v0.7.663 · 2026-11-23

### 后端收口：queue / catalog / logs / settings
- 队列批量、阶段、词条批量、同步进 `features/queue` 与 `features/catalog`。
- 失败队列、错误统计、日志、日期、配置 schema、流程规则进对应模块。
- 规则注册表进 `features/settings`，调度扩展点进 `features/scheduler`。
- 全量 `run.sh` 通过。

## v0.7.662 · 2026-11-23

### 后端收口：crawl / screen / adapters
- `crawl`、`cursor`、分类归一进 `server/src/features/crawl`。
- `screen`、`match`、`marks`、查重规则进 `server/src/features/screen`。
- 引擎适配器进 `server/src/infra/adapters`。
- 路由 `routes-crawl` 进 `server/src/http`。
- 规则审计改为递归扫后端目录；全量 `run.sh` 通过。

## v0.7.661 · 2026-11-23

### 后端功能收口开始
- 新增 `server/src/infra`：db、env、json-file、upload-lock、secretbox。
- 新增 `server/src/features/sites`：站点仓库、隐藏站、凭据、映射。
- 新增 `server/src/features/presets`：全局预设。
- 其余模块的 require、检查、脚本路径同步更新；行为未改。
- 全量 `run.sh` 通过，质量审计总体 100。

## v0.7.660 · 2026-11-23

### 部署路径修正
- `deploy.sh` 的预设权限修正改为 `pta/server/pack`，不再找旧 `pta/pack`。
- `deploy-docker` 检查加一条，防止部署脚本回退旧路径。

## v0.7.659 · 2026-11-23

### 结构收口：server / web / docs
- 仓库 `pta/` 下只剩 `server`、`web`、`docs` 三块。
- 前端源码与构建配置统一进 `pta/web`；构建产物仍为 `pta/web/dist`。
- 模板、夹具、检查、脚本、CLI、sidecar、开发数据收进 `pta/server`。
- 检查拆成 `pta/server/checks` 与 `pta/web/checks`；入口统一为 `pta/server/checks/run.sh`。
- 质量基线与 UI 基线分别收进 `server/checks/baselines`、`web/checks/baselines`。
- 更新 AGENTS、CHECKLIST、Dockerfile、部署与所有脚本路径；行为未改。
- 全量 `run.sh` 通过，质量审计总体 100。

## v0.7.658 · 2026-11-24

### 结构重排第一步
- 新增 `pta/docs/ARCHITECTURE.md` 与 `API.md`，定稿三块结构和后端边界。
- 前端源码从 `pta/web-src` 迁到 `pta/web`，构建输出仍为 `pta/web/dist`。
- 构建、Docker、检查、脚本里的前端路径同步更新。
- 行为未改；前端构建与主要检查通过。

## v0.7.657 · 2026-11-24

### 站点字段模板与保存不丢字段
- 全局预设增加 `site` 站点字段模板：`search.path/params`、`limits`、`downloadLink`、`refreshCron`、发布字段、settings 默认值。
- 首次启动把 `pack/presets.preset.json` 复制成 `data/presets.json`，之后用户改的是 data 这份；前端通过 `/api/presets` 读运行时预设。
- 站点保存保留未知字段；`limits` / `downloadLink` / `refreshCron` 和自定义字段不会再被覆盖或删除。
- `limits` 接上抓取限制（窗口/次数/列表与详情间隔）；`downloadLink` 在列表页没给下载链接时按 `{ID}` 模板补。
- 生产 306 站已补字段；全量 `run.sh` 通过，质量审计总体 100。

## v0.7.656 · 2026-11-24

### 部署修正
- `deploy.sh` 发版后把 `pta/pack/*.json` 改成 644，服务用户能读全局预设。
- 生产已重启验证：`movie -> 电影`，23 个类型可读。

## v0.7.655 · 2026-11-24

### 全局预设与站点 key 绑定
- 新增 `pta/pack/presets.preset.json`：类型、媒介、分辨率、优惠、限制、发布字段只定义一份。
- 站点 JSON 只保存全局 key 和站点 ID，例如 `movie -> 401`；删除 `search.types`、`publish.catLabels`。
- 旧 `filters.map` / `selectedLabels` / `selectedValues` 自动归一为 `values` / `selected`，长选项名不再进站点 JSON。
- 抓取、发布、映射、初筛、站点详情统一按 key 查全局预设补中文；前端选项来自同一份预设。
- `build-site-json.js` 改为从运行时 `sites.json` 生成仓库预设；新增迁移与预设检查。
- 生产 306 站已迁移，`sites.json` 从 1.6MB 降到约 560KB；全部默认停用。
- 全量 `run.sh` 通过，质量审计总体 100。

## v0.7.654 · 2026-11-23

### 收尾规则与数据
- `AGENTS.md` 凭据规则改为 `data/cookies.json`；旧 `credentials` 表只作迁移/测试镜像。
- 生产 `/data` 旧 `site-defs`、`site-search`、`site-maps`、`site-pack` 全部删除；`sites`/`credentials` 表数据清空。
- 只剩 `sites.json`、`site-urls.json`、`cookies.json`、`seedpod.db`（加运行缓存/日志）。
- 全量 run.sh 通过。

## v0.7.653 · 2026-11-23

### 删除旧站点包流程
- 删除 `site-pack.enc`、`PTA_SITE_PACK_KEY`、`site-pack.js/admin/routes`、构建脚本、UI 站点包面板、site-pack 检查与文档。
- 生产 `/data` 已删除 `site-defs/`、`site-search.local.json`、`site-maps.json`、`site-pack.json`；`sites`/`credentials` 表数据清空。
- 运行时只剩 `sites.json`、`site-urls.json`、`cookies.json`、`seedpod.db`。
- health 计数改读站点 JSON / cookie 文件；全量 run.sh 通过。

## v0.7.652 · 2026-11-23

### 完成站点 JSON 读取切换
- `routes-crawl`、`routes-probe`、`routes-misc`、`target-submit`、`scheduler-state`、`scheduler-review` 全部改读 `site-store`。
- 站点分类/类型/筛选写 `sites.json`，不再写 `site-search.local.json`；映射写 `sites.json`，不再写 `site-maps.json`。
- health 计数改用 `sites.json` / `cookies.json`；`sites`/`credentials` 表不再参与运行时。
- 生产 `--check` 0 差异；全量 run.sh 通过。

## v0.7.651 · 2026-11-23

### 面板与初筛切到站点 JSON
- `/api/sites`、`/api/site-config`、`/api/site-def`、`/api/site-defs`、`/api/maps` 改为读 `site-store`；隐藏站从列表过滤。
- 送审、统计、目标站列表改读 `site-store`；移除站点改为写入 `settings.hidden`，可恢复，凭据删除。
- target 列表缓存/一次读取，避免 306 站逐条解析；`catMode/catSlot/tagMap/uploadMap` 保留。
- 夹具：api-v2 56/56、smoke 28/28、target 41/41、crawl-detail 6/6、screen 6/6、responsive 32/32、全量 run.sh 通过。
- 旧 `site-defs` / `sites` 表仍保留，供剩余读取路径和回滚；下一步继续切剩余路径后删除。

## v0.7.650 · 2026-11-23

### 抓取与目标站切到站点 JSON
- crawl 从 `site-store.legacyDef` 读搜索/类型/设置；目标站从 `site-store.targetDef` 读上传/分类/映射。
- 面板改站点配置、站点定义、类型、映射时双写 `sites.json` / `site-urls.json`，旧库/旧文件暂时保留兼容。
- target 列表改为一次读取 + 缓存，避免 306 站逐个解析导致页面卡顿；隐藏站不列。
- 夹具：crawl-detail 6/6、target 41/41、site-store 6/6、cli 18/18、responsive 32/32、api-v2 57/57、frontend 49/49。
- 全量 run.sh 通过。

## v0.7.649 · 2026-11-23

### 站点 JSON 字段补齐
- `sites.preset.json` / 运行时 `sites.json` 补 `search.catMode`、`search.catSlot`、`publish.tagMap`、`publish.tagValue`；5 个用 `uploadMap` 的站保留上传映射。
- `build-site-json --check` 增加 catMode/catSlot/uploadMap 校验，生产 0 差异。
- `site-store` 旧数据迁移合并 `site-pack.json`，`legacyDef`/`targetDef` 带全字段；夹具 6/6。
- 抓取/目标站读取切换因夹具未全量更新，暂时撤回；旧逻辑保持可运行。
- 全量 run.sh 通过。

## v0.7.648 · 2026-11-23

### site-store 迁移适配
- site-store 增加 `legacyDef` / `targetDef`：把新 JSON 转成抓取/发布旧形状，作为切换前的适配层。
- 首次缺少 `sites.json` 时从旧 sites/site-defs/site-search/site-maps 一次性迁移；之后不再读旧文件。
- site-store 夹具 6/6：新增旧数据迁移、legacyDef/targetDef。
- 抓取读取切换暂时撤回，保持线上旧逻辑可用；下一步按模块切换并补夹具。
- 全量 run.sh 通过。

## v0.7.647 · 2026-11-23

### 生成运行时站点 JSON
- 修复 `build-site-json.js --runtime` 文件名前缀 bug（生成 `sites.json`，不是 `.json`）。
- 生产已生成 `/data/sites.json` 和 `/data/site-urls.json`：306 站、306 网址、5 隐藏，全部 `enabled:false`。
- 运行时读取仍走旧逻辑，下一步切换。
- 全量 run.sh 通过。

## v0.7.646 · 2026-11-23

### site-store 运行时读写
- 新增 `pta/server/site-store.js`：运行时只读 `data/sites.json` + `data/site-urls.json`；首次从 `pta/pack/*.preset.json` 复制。
- 写入原子写 + SQLite `sites` 锁 + `.bak`；支持 get/list/add/save/remove/setHidden，网址 Base64 解码。
- 新增 site-store 夹具 5/5：首次复制、网址解码、保存/备份、隐藏/删除、锁冲突、非法 host。
- 运行时读取切换仍待下一步；旧文件未删。
- 全量 run.sh 通过。

## v0.7.645 · 2026-11-23

### 站点 JSON 迁移校验
- `build-site-json.js` 新增 `--check`：逐站对比 base/upload/verify、搜索分类/类型、enabled；有差异写 `site-json-mismatches.json` 并退出 1。
- `--disable-all`：迁移时把所有站默认设为停用。
- 生产只读校验：306 站、306 网址、92 搜索分类、109 发布映射、5 隐藏，差异 0。
- 全量 run.sh 通过。

## v0.7.644 · 2026-11-22

### 站点 JSON 预设
- 生成 `pta/pack/sites.preset.json`、`site-urls.preset.json`、`cookies.example.json`：306 个站，网址 Base64，cookie 模板全空。
- 新增 `pta/scripts/build-site-json.js`：从现有 DB/site-defs/site-search/site-maps 生成预设，支持 --dry / --runtime。
- 新增 `site-json-preset` 检查 4/4：host 一致、无 settings/明文网址、Base64 可解、cookie 全空。
- Docker 镜像复制 `pta/pack`；运行时读取切换仍待下一步。
- 全量 run.sh 通过。

## v0.7.643 · 2026-11-22

### 总 Cookie 文件
- 新增 `data/cookies.json`：一 host 一条，AES-256-GCM 密文，0600，原子写并留 `.bak`；SQLite credentials 只作迁移回退。
- 抓取、发布、目标站、会话自检、图床 SSO、批量导入统一走 cookie-store；面板保存/删除 cookie 直接写文件。
- 旧 credentials 启动时自动迁移；备份/恢复包含 `cookies.json`。
- 新增 `pta/docs/COOKIE-FILE.md`：面板操作、接口、CLI 导入、备份恢复、故障处理。
- cookie-file 4/4、api-v2 57/57、frontend-regress 49/49、backup 13/13；全量 run.sh 通过。

## v0.7.642 · 2026-11-22

### 站点 Cookie 可单独删除
- 站点详情新增「删除 Cookie」：只清该站凭据，站点配置、分类映射、抓取设置都保留；删除后按钮自动禁用。
- 后端保存空 cookie 时写回 null，并记「删除凭据」日志；接口仍只回 hasCookie。
- frontend-regress 49/49、api-v2 57/57（新增空 cookie 删除）。
- 全量 run.sh 通过。

## v0.7.641 · 2026-11-22

### 审计一百一十轮 · 发布/回查锁
- 回查、补源标题、辅种与图片上传都复用队列条目的提交锁；提交进行中返回 409，避免回查结果被覆盖。
- 图片上传期间锁住条目，上传完再保存 imageLinks/prepare，减少并发丢更新。
- target-lock 夹具 6/6：新增“提交锁占用时回查/补标题 409”。
- 全量 run.sh 通过。

## v0.7.640 · 2026-11-22

### 审计一百零九轮 · 送审与词条状态
- `/api/catalog/screen` 查重命中跳过时，队列状态和来源词条放在同一事务，避免一边 skipped 一边 selected。
- 删除未使用的 JSON 词条库 `pta/server/catalog.js`；SQLite 是唯一事实源，避免两套状态实现。
- release-sync 夹具保持 4/4；全量 run.sh 通过。

## v0.7.639 · 2026-11-22

### 审计一百零八轮 · release 事务与状态同步
- release 的 prepare/preview/advance 改为同一事务内读改写，避免并发覆盖 stage/evidence。
- 队列单条改状态、删除条目时，队列写与 catalog-sync 放在同一事务；任一步失败一起回滚。
- 新增 release-sync 夹具 4/4：阶段顺序、failed 等待、catalog 状态映射、队列+词条事务回滚。
- 全量 run.sh 通过。

## v0.7.638 · 2026-11-22

### 审计一百零七轮 · 图源与简介外联
- 图源页面域名解析到内网时拒绝，不发请求；夹具 imagehost 28/28。
- 简介回填只调元数据接口，不抓源简介里的远程图片；夹具 meta-ext 11/11。
- 全量 run.sh 通过。

## v0.7.637 · 2026-11-22

### 站点类型补全 · 离线 + 探测
- 新增 `pta/scripts/site-types.js`：先从本地分类数据补主类型；再用已存 cookie 逐站探测分类页，默认单站 1 个请求、串行、间隔 ≥10 秒，429/403/503 立即停。
- 默认只预览；`--write` 才写 `site-search.local.json`，写前留 `.bak`；只改 `types`，不动 `cats`。
- 新增 site-types 夹具 6/6：离线补、无分类不硬猜、select 解析、1 请求、无 cookie 不发请求、403 停止、回填不动 cats。
- 全量 run.sh 通过。

## v0.7.636 · 2026-11-25

### 永久规则更新 · 站点预设目录
- 用户选择 A：站点显示名、中英文名、分类标签/ID、禁转/限转/HR 可以明文；网址、host、cookie、密码、passkey、上传 token 仍只存密文。
- 添加站点收敛为只能从预设选择，网址由服务端解密后内部使用，前端不出现网址。
- `AGENTS.md` 第 2 条、`GOAL-RUNNER.md`、`DECISIONS.md` 已同步。
- 全量 run.sh 通过。

## v0.7.635 · 2026-11-25

### 审计一百零五轮 · 提交/回查外联
- target-submit 的提交与回查都加 DNS 重绑定防护；解析到内网不发 cookie。
- 提交/回查跳到外部域名时返回 `UPLOAD_REDIRECTED` / `VERIFY_REDIRECTED`，不再把外部地址当详情页；同站 302 仍正常。
- 新增 target-submit 夹具 5/5：正常本站 302、外部提交跳转、外部回查跳转、内网解析拦截、cookie 只发目标站。
- 全量 run.sh 通过。

## v0.7.634 · 2026-11-25

### 审计一百零四轮 · 批量上传
- target-service 的 uploadMany 对单站异常做隔离：一个目标抛错记 `UPLOAD_EXCEPTION`，不再拖垮整批，锁仍会释放。
- 新增 target-upload-many 夹具 3/3：并发第二单返回 409、部分失败继续并落库、单站异常不中断。
- 全量 run.sh 通过。

## v0.7.633 · 2026-11-25

### 审计一百零三轮 · 上传 announce
- target-upload 对手工传入的 `cleanAnnounce` / 每站 announce 做同站校验；不是目标站或子域直接 `BAD_ANNOUNCE`，不再写进种子。
- 夹具 target 41/41：旧用例里跨站 announce 改为本站地址，并新增外部 announce 拒绝、本站 announce 放行。
- 全量 run.sh 通过。

## v0.7.632 · 2026-11-25

### 永久规则更新 · 真实站点探测
- `AGENTS.md` 第 1 条改为引用《真实站点探测规则（2026-11-25 起）》：允许计划内只读探测，单站单次 ≤5 个请求、串行 ≥10 秒、失败即停 1 小时。
- 同步更新 `pta/docs/GOAL-RUNNER.md`，并在 `pta/docs/DECISIONS.md` 记 D21。
- 不变：不自己找 cookie、不复用别人的 cookie、写操作逐次确认、禁止压测/批量扫描/自动定时探测。
- 全量 run.sh 通过。

## v0.7.631 · 2026-11-23

### 审计一百零一轮 · announce 发现
- target-discovery 的 index/usercp/上传页请求统一加 DNS 重绑定防护，解析到内网不发请求。
- 上传页里的 announce 候选只保留目标站及子域，外部链接不再进候选，避免 passkey 外泄。
- 缓存种子里的 announce 也按目标站域名过滤。
- 夹具 target-discovery 4/4（新增外链候选过滤、内网解析拦截）。
- 全量 run.sh 通过。

## v0.7.630 · 2026-11-23

### 审计一百轮 · 图床外联
- 自定义图床 endpoint、Chevereto `/json`、登录/SSO 基地址都加 DNS 重绑定防护。
- 图床上传遇到 3xx 一律停止，不再默认跟随跳转，避免图片和会话 cookie 被带到别的主机。
- 夹具 imagehost 27/27：新增自定义图床 302 不跟随、域名解析到内网拒绝。
- 全量 run.sh 通过。

## v0.7.629 · 2026-11-23

### 审计九十九轮 · 通知外联
- 通知 webhook 改为 AES-GCM 密文存储；旧明文配置读取兼容，下次保存自动迁移；接口只回是否配置。
- Telegram API 与 webhook 都改为 302 不跟随，跳转直接失败，避免把请求带到别的主机。
- 两者都加 DNS 重绑定防护；错误信息不回显完整 webhook/token。
- 夹具 notify 20/20；api-v2 56/56（新增 webhook 密文存储与不回明文）。
- 全量 run.sh 通过。

## v0.7.628 · 2026-11-23

### 审计九十八轮 · 图床外联
- 移除图床内置的真实站点默认地址与 SSO 主机；未配置 `IMAGE_HOST_URL` / `IMAGE_HOST_SSO_HOST` 时明确报错，不再默认联系任何站。
- `isOurImageHost` 改为按当前配置的图床地址判断，不再硬编码站点域名；回环/localhost 不当作自家图床。
- 文档里的真实站名与地址改成占位符。
- 夹具 imagehost 25/25：新增“默认地址不内置真实站点”。
- 全量 run.sh 通过。

## v0.7.627 · 2026-11-23

### 审计九十七轮 · 备份/恢复
- 备份快照写入 tar 前先做 SQLite `integrity_check`，并校验压缩包可读，坏快照直接失败。
- 恢复先校验备份库完整性再覆盖；坏库不会动现有数据。
- 恢复拒绝带符号链接的备份，避免解到数据目录外；缺 `.secret` 时明确警告。
- 夹具 backup 13/13：新增坏库不覆盖、符号链接拒绝、缺密钥警告；backup-concurrency 1/1、backup-interrupt 1/1。
- 全量 run.sh 通过。

## v0.7.626 · 2026-11-23

### 审计九十六轮 · 基础站点可移除
- 基础站点移除改为软删除：写入 `site-config-meta.hidden` 并删除凭据，不再返回 BASE_SITE；重新添加同域名或点「恢复」即可回到列表。
- 调度抓取、初筛、抓取入口、总览统计全部跳过已移除站点；隐藏期间不会再向该站发请求。
- 站点页新增「已移除 N」入口，可逐个恢复；恢复后需重新导入 cookie。
- 检查：api-v2 55/55、scheduler-crawl 3/3、crawl-detail 6/6、screen-type 6/6。
- 全量 run.sh 通过。

## v0.7.625 · 2026-11-23

### 审计九十五轮
- 目标站页面操作统一 DNS 重绑定防护：详情、种子、删除编辑页、删除提交、删除回查、上传页探测全部先复检。
- 新增 target-pages-dns 夹具 7/7：解析到内网时拒绝且不发请求，公网与字面回环地址不受影响。
- 全量 run.sh 通过。

## v0.7.624 · 2026-11-23

### 审计九十四轮
- 抓取列表/详情接入 DNS 重绑定防护；详情地址不是来源站时不再带 cookie 请求，跨站详情记失败原因。
- 查重搜索与筛选探测接入 DNS 防护。
- 外部元数据接口（Wikipedia/TMDB/豆瓣/豆影）改为不跟随 302，跳转直接报错，避免 key 与请求头被带走。
- 夹具：crawl-detail 5/5（新增跨站详情、列表解析内网拦截）、meta-ext 10/10（新增 302 不跟随）。
- 全量 run.sh 通过。

## v0.7.623 · 2026-11-23

### 审计九十三轮
- 统一 DNS 重绑定防护：`url-guard.assertNoRebind`；公网域名解析到内网拒绝，字面内网地址按显式配置放行，解析失败按不可判定放行。
- 接入真发布取种（逐跳复检）与来源种下载；来源种 302 明确报错，避免 cookie 外泄。
- 新增 url-guard 夹具 9/9：解析矩阵、重定向复检、来源种拦截与正常跳转。
- 全量 run.sh 通过。

## v0.7.622 · 2026-11-23

### 审计九十二轮
- 同一队列条目真发布加跨进程锁（`upload_locks` 的 `pub:` 键），并发的第二个返回 `PUBLISH_IN_PROGRESS`；演练不占锁。新增 publish-lock 3/3。
- 全量 run.sh 通过。

## v0.7.621 · 2026-11-23

### 审计九十一轮
- 站点页基础清单站点不再显示灰色“移除站点”死按钮，改为明确提示“基础站点不可移除”；面板添加的站点仍可移除。
- 全量 run.sh 通过。

## v0.7.620 · 2026-11-23

### 审计九十轮
- /api/downloaders/:id/cats 路由级夹具：会话过期自动重登、403/404/超时都返回明确错误；downloader-probe 9/9。
- 全量 run.sh 通过。

## v0.7.619 · 2026-11-23

### 审计八十九轮
- /api/downloaders/:id/test 支持 timeoutMs，已存配置会重新登录并写 lastProbe；超时快速失败。
- 已存下载器测试超时后前端按钮恢复、可重试；frontend-regress 48/48，downloader-probe 7/7。
- 全量 run.sh 通过。

## v0.7.618 · 2026-11-23

### 审计八十八轮
- qB 探测支持调用方 AbortSignal 取消：取消后快速返回失败且不会继续登录；qb-recovery 7/7。
- 全量 run.sh 通过。

## v0.7.617 · 2026-11-23

### 审计八十七轮
- qB 探测支持调用方超时/取消信号，路由可传 `timeoutMs`；超时探测和并发探测都有路由级夹具。
- 下载器探测超时后前端按钮恢复、可重试；新增浏览器夹具。
- 全量 run.sh 通过。

## v0.7.616 · 2026-11-23

### 审计八十六轮
- qB 探测超时可配置，超时明确失败；qb-recovery 6/6。
- watch 并发写入使用唯一临时文件，失败/并发都不留残余；clients 9/9。
- 全量 run.sh 通过。

## v0.7.615 · 2026-11-22

### 审计八十五轮
- watch 写入失败会清掉临时文件，修复后可重试；clients 8/8。
- qB 并发探测各自登录不串会话；qb-recovery 5/5。
- 全量 run.sh 通过。

## v0.7.614 · 2026-11-22

### 审计八十四轮
- qB 会话续期：过期自动重登、模拟服务重启后新实例重新登录；watch 只读目录明确失败；新增 qb-recovery 4/4。
- 全量 run.sh 通过。

## v0.7.613 · 2026-11-22

### 审计八十三轮
- 通知冷却按配置共享：同一 webhook 的多个实例不会重复请求；notify 16/16。
- request-queue 写库失败后 CHAIN 恢复串行；request-queue 11/11。
- 全量 run.sh 通过。

## v0.7.612 · 2026-11-22

### 审计八十二轮
- 通知冷却可配置，到期后重发成功并清掉冷却；notify 15/15。
- request-queue 搜索/写入交替保持 FIFO 公平；request-queue 11/11。
- 全量 run.sh 通过。

## v0.7.611 · 2026-11-22

### 审计八十一轮
- 通知双通道失败后进入 60 秒冷却，冷却期不重复打外部接口；notify 14/14。
- request-queue 多实例并发 wait 仍串行；request-queue 10/10。
- 全量 run.sh 通过。

## v0.7.610 · 2026-11-22

### 审计八十轮
- 通知 webhook 默认重试一次并等待退避；notify 13/13。
- 请求队列暂停期间 nextAt 不推进，重启后过期 nextAt 立即执行；request-queue 9/9。
- 全量 run.sh 通过。

## v0.7.609 · 2026-11-22

### 审计七十九轮
- 调度重试边界：retryMax=0 全部不重试、退避封顶 1440 分钟、成功注入后辅种抛错不影响结果；scheduler-retry-backoff 7/7。
- 全量 run.sh 通过。

## v0.7.608 · 2026-11-22

### 审计七十八轮
- 调度重试退避：retryMax、nextRetryAt 未到期跳过，成功后清重试标记，失败写 retries/nextRetryAt/retryMsg；新增 scheduler-retry-backoff 4/4。
- 全量 run.sh 通过。

## v0.7.607 · 2026-11-22

### 审计七十七轮
- 调度器（scheduler）60 秒 tick：暂停/未到间隔不运行，到点运行一轮；start 幂等，stop 清定时器。新增 scheduler-timer 4/4。
- 全量 run.sh 通过。

## v0.7.606 · 2026-11-22

### 审计七十六轮
- Queue 下载进度轮询在会话过期时停止，重登后自动恢复；frontend-regress 46/46。
- App 60 秒会话探测只探会话，不拉队列/下载器等受保护数据。
- 全量 run.sh 通过。

## v0.7.605 · 2026-11-22

### 审计七十五轮
- 顶栏会话过期后暂停，重登后恢复；Settings 的版本/通知请求在隐藏时都不发，重进会刷新。
- frontend-regress 44/44，全量 run.sh 通过。

## v0.7.604 · 2026-11-22

### 审计七十四轮
- 未登录/会话过期时顶栏不请求受保护接口（队列/下载器），登录后恢复。
- Settings 隐藏时不轮询，离开后重置，重新进入会刷新；frontend-regress 44/44。
- 全量 run.sh 通过。

## v0.7.603 · 2026-11-22

### 审计七十三轮
- 非 Sites/Queue 页面的 hashchange 不会触发对应列表请求；Nodes 只在 crawl 可见时刷新下载器。
- frontend-regress 43/43，全量 run.sh 通过。

## v0.7.602 · 2026-11-22

### 审计七十二轮
- 切页后统计轮询不叠加失控，回总览继续刷新；Dashboard 夹具覆盖。
- Nodes 增加登录/可见性门禁：登出后不再定时请求下载器，也不在其他页面 hashchange 时刷新；frontend-regress 42/42。
- 全量 run.sh 通过。

## v0.7.601 · 2026-11-22

### 审计七十一轮
- 会话过期时 Dashboard 轮询暂停，重登后恢复；frontend-regress 39/39。
- 登出后 Sites/Queue 定时器不再发请求，重登后 Queue 恢复；frontend-regress 40/40。
- 全量 run.sh 通过。

## v0.7.600 · 2026-11-22

### 审计七十轮
- 401 重登后 Sources 搜索/站点/状态筛选和第二页位置保持；frontend-regress 38/38。
- 会话过期时 Logs SSE 停止重连，重登后恢复；未登录不会开 SSE。
- 全量 run.sh 通过。

## v0.7.599 · 2026-11-22

### 审计六十九轮
- Sources 的 mark 过滤下拉不再暴露 dupe/已有原盘字段；frontend-regress 36/36。
- 401 重登后搜索词、第二页位置、选中态和详情都保持。
- 全量 run.sh 通过。

## v0.7.598 · 2026-11-22

### 审计六十八轮
- Sources 删除后不再显示旧 dupe 结论；frontend-regress 35/35。
- 401 重登后待确认/失败页签、选中态和详情都能恢复，并可继续删除。
- 全量 run.sh 通过。

## v0.7.597 · 2026-11-22

### 审计六十七轮
- 删除后旧 dupe 标题不再被 catalog 搜索命中；api-v2 54/54。
- 401 重登后列表选中态和详情自动恢复，无需手动重点；frontend-regress 32/32。
- 全量 run.sh 通过。

## v0.7.596 · 2026-11-22

### 审计六十六轮
- 删除 skipped 队列后 catalog `byStatus.new +1`、`selected -1` 立即生效；api-v2 54/54。
- 401 重新登录后可再次删除成功并刷新列表；frontend-regress 32/32。
- 全量 run.sh 通过。

## v0.7.595 · 2026-11-22

### 审计六十五轮
- 删除队列后同时清词条的旧跳过/查重结论（dupe/dupeTarget/dupeAt 等），避免 Sources 残留“已有原盘”；api-v2 54/54。
- 删除 404 后按钮恢复；401 会提示并弹回登录；frontend-regress 32/32。
- 修 SiteDetail 保存后父级刷新晚到导致 URL 表单回退的竞态。
- 全量 run.sh 通过。

## v0.7.594 · 2026-11-22

### 审计六十四轮
- 删除 skipped 队列后来源词条回写 `new`，catalogReset 标记可见；api-v2 54/54。
- 删除 500 后按钮恢复可用，可继续触发 409 和成功删除；frontend-regress 31/31。
- 全量 run.sh 通过。

## v0.7.593 · 2026-11-22

### 审计六十三轮
- 目标站仅 `skipped` 的条目允许删除并清源种缓存；api-v2 53/53。
- 多条 `cleanupErrors` 提示数量与首条错误码；frontend-regress 31/31。
- 全量 run.sh 通过。

## v0.7.592 · 2026-11-22

### 审计六十二轮
- 删除按钮按状态给确认文案（失败/已驳回），已提交/已注入目标禁用并提示原因。
- `cleanupErrors` 显示首个错误码（如 EACCES）；frontend-regress 30/30。
- UI 基线与截图已更新；全量 run.sh 通过。

## v0.7.591 · 2026-11-22

### 审计六十一轮
- 部分提交条目 replay 只复位失败目标，已提交目标保留；删除仍返回 `TARGET_SUBMITTED`；api-v2 52/52。
- 队列详情加删除按钮：提交门禁错误可见，`cleanupErrors` 提示“缓存清理失败 N 个”；frontend-regress 29/29。
- 全量 run.sh 通过。

## v0.7.590 · 2026-11-22

### 审计六十轮
- 删除队列条目时，targetResults 已提交/已注入或已有权威种子的目标站一律 409 `TARGET_SUBMITTED`，条目和源种缓存都不动。
- 源种缓存 unlink 失败时返回 `cleanupErrors`，不再静默；api-v2 51/51。
- 全量 run.sh 通过。

## v0.7.589 · 2026-11-22

### 审计五十九轮
- 删除队列条目时清掉 `data/torrents/source-<hash>.torrent` 源种缓存，返回 `cleanedFiles`；已发布条目仍拒绝删除。
- replay/改状态都会清 `heldAlertNextAt`；api-v2 49/49、failure-replay 3/3、failure-held 4/4、scheduler-running 5/5。
- 全量 run.sh 通过。

## v0.7.588 · 2026-11-22

### 审计五十八轮
- 通知发送失败进入 15 分钟冷却（heldAlertNextAt），冷却期内不再重复告警；scheduler-running 5/5。
- held 删除后队列 approved 计数和统计 total 立即减一，失败队列同步消失；api-v2 49/49。
- 完成/replay/改状态都会清 heldAlertNextAt。
- 全量 run.sh 通过。

## v0.7.587 · 2026-11-22

### 审计五十七轮
- 单条/批量改队列状态时清掉 held 观测字段，跳过/驳回后不再挂在失败队列；failure-held 4/4、api-v2 48/48。
- 通知发送失败不写 heldAlertAt，下一次调度会重试；已有 scheduler-running 覆盖。
- 全量 run.sh 通过。

## v0.7.586 · 2026-11-22

### 审计五十六轮
- held 告警只在通知真正发出后写 `heldAlertAt`；发送失败/关闭都不标记，下次仍会尝试。
- 修正调度通知拼接用 const 又自增导致通知被静默跳过的问题。
- held 失败队列分页/搜索后的选中高亮与详情保持一致；frontend-regress 28/28。
- 全量 run.sh 通过。

## v0.7.585 · 2026-11-22

### 审计五十五轮
- held 在失败队列不判死信、不受 30 天保留隐藏，dead 筛选只留真实死信，held 与失败可一起分页；新增 failure-held 3/3。
- 通知关闭时调度仍写日志/lastResult，只跳过外部发送；scheduler-running 5/5。
- 全量 run.sh 通过。

## v0.7.584 · 2026-11-22

### 审计五十四轮
- 通知关闭（events=off）时不再写 heldAlertAt，打开通知后仍能首次告警；scheduler-running 4/4。
- held 条目 replay 清 held/heldAlertAt，回到 pending 并进入下一轮终审；replay-scheduler 3/3、failure-replay 3/3。
- 全量 run.sh 通过。

## v0.7.583 · 2026-11-22

### 审计五十三轮
- held 告警去重：同一 held 条目每天最多告警一次，`heldAlertAt` 持久化，完成/replay 清掉。
- 失败队列把 held 显示为“源种 / 源种未下完”，不再露原始码；frontend-regress 27/27。
- scheduler-running 4/4，全量 run.sh 通过。

## v0.7.582 · 2026-11-22

### 审计五十二轮
- held 条目持久化 `heldSince/heldAt/heldReason`，出现在 `/api/failures`（kind=source），超过 24h 计入 `heldOld` 并进调度告警；完成或 replay 时清掉。
- 调度状态重启后仍能读回 lastRunAt/lastResult；scheduler-running 4/4，failure-replay 3/3。
- 全量 run.sh 通过。

## v0.7.581 · 2026-11-22

### 审计五十一轮
- 调度失败落库失败不再把 runNow 打崩：catch 里的 save 加保护，running 仍在 finally 释放；新增 scheduler-running 3/3。
- 并发第二次被拒、首轮结束/异常后可再跑。
- held 写入调度结果并持久化到 status，源种完成后下一轮继续。
- 全量 run.sh 通过。

## v0.7.580 · 2026-11-22

### 审计五十轮
- 调度发布并发：6 条并发跑，每个 id 只检查源种/上传/发布一次，并发数按配置；新增 scheduler-publish-concurrency 2/2。
- held 条目每轮重新检查源种，完成后下一轮继续上传发布。
- 全量 run.sh 通过。

## v0.7.579 · 2026-11-22

### 审计四十九轮
- 调度发布恢复路径：目标站重新 prepare 为 ready 后，下一轮自动继续源种/上传/发布；scheduler-publish-gate 3/3。
- 调度发布错误上限验证：5 条失败只保留 3 条错误。
- 全量 run.sh 通过。

## v0.7.578 · 2026-11-22

### 审计四十八轮
- 目标站就绪检查抽成 `release-gates`，发布、调度、批量发布共用；调度发布未就绪时记 `TARGET_NOT_READY`，不碰源种/目标站。新增 scheduler-publish-gate 2/2。
- 批量发布未就绪在上传前拦下；queue-bulk-publish 5/5。
- 批量发布被跳过时详情同步显示目标站错误；frontend-regress 26/26。
- 全量 run.sh 通过。

## v0.7.577 · 2026-11-22

### 审计四十七轮
- 批量发布后当前详情同步为已发布；frontend-regress 25/25。
- 重新准备把目标站标为 ready 后 `TARGET_NOT_READY` 清零并继续到下载器门禁；publish-review-gate 8/8。
- 全量 run.sh 通过。

## v0.7.576 · 2026-11-22

### 审计四十六轮
- 批量批准后当前详情同步刷新为已通过；frontend-regress 24/24。
- 发布前检查目标站计划：review 通过但 `prepared.targets` 缺目标/ready=false 返回 `TARGET_NOT_READY`；publish-review-gate 8/8。
- 全量 run.sh 通过。

## v0.7.575 · 2026-11-22

### 审计四十五轮
- realPublish 关闭时发布门禁优先返回 `REAL_PUBLISH_DISABLED`，不暴露 review 细节；publish-review-gate 6/6。
- 批量发布混合结果提示：已发布/跳过数量 + 首条错误，按钮用 finally 复位；frontend-regress 23/23。
- 全量 run.sh 通过。

## v0.7.574 · 2026-11-22

### 审计四十四轮
- 发布门禁对 review 矛盾数据更严：`ok=false` 或 `missing` 非空任一成立就拦，旧数据没有 review 仍放行；publish-review-gate 5/5。
- 批量发布部分成功：成功项保留，失败最多 3 条错误；queue-bulk-publish 4/4。
- 全量 run.sh 通过。

## v0.7.573 · 2026-11-22

### 审计四十三轮
- 补全终审缺失项后重新终审会清掉旧 `review.missing` 并放行；review-branches 4/4。
- 批量发布把 `REVIEW_HOLD` 计入 errors、不标记成功；queue-bulk-publish 3/3。
- 全量 run.sh 通过。

## v0.7.572 · 2026-11-22

### 审计四十二轮
- 真发布补 `REVIEW_HOLD` 门禁：终审 `review.ok=false` 且有 missing 时直接拒绝，状态/阶段不变；dry-run 仍可看计划。新增 publish-review-gate 2/2。
- 新增 review-branches 3/3：缺项转人工、齐全+realPublish 开自动批准、关则保持 pending。
- 全量 run.sh 通过。

## v0.7.571 · 2026-11-22

### 审计四十一轮
- 拆分 frontend-regress：Dashboard/Sources 组移到 `pta/checks/frontend-regress/sources.js`，主文件 806 → 528 行，质量审计不再提示。
- 新增 replay-scheduler 2/2：失败重放后的 pending 条目能被下一轮终审接续，未选终审时跳过。
- 全量 run.sh 通过。

## v0.7.570 · 2026-11-22

### 审计四十轮
- 重放后重新上传成功：targetResults 重建 `attempts:0` 和最新 `verify`，回查快照不丢；成功结果覆盖失败字段。
- 失败队列重放后详情自动刷新为待确认；新增浏览器夹具，frontend-regress 22/22。
- 全量 run.sh 通过。

## v0.7.569 · 2026-11-22

### 审计三十九轮
- 回查失败重试成功：advance 清零 stageAttempts，history 追加 draft/prepared，末条与 stage 一致；api-v2 47/47。
- 失败队列 replay：只回 draft/prepared/previewed，阶段/attempts/history 归零；失败目标清掉旧 verify 和 byHost，其他目标保持；新增 failure-replay 3/3。
- 全量 run.sh 通过。

## v0.7.568 · 2026-11-22

### 审计三十八轮
- `targetResults.verify` 与 `targetVerifyByHost` 同步：手动回查、回查失败、目标站已存在都写同一快照。
- 回查失败重试：到点 advance 回 prepared 并清错误/重试时间，未到点返回 wait 且保持 failed；api-v2 47/47。
- target 40/40，frontend-regress 21/21。
- 全量 run.sh 通过。

## v0.7.567 · 2026-11-22

### 审计三十七轮
- 回查失败写 `targetVerifyByHost[host].found=false`，手动回查同步旧字段；失败不会覆盖其他目标站结果。
- 前端多目标回查只读当前 host；缺 host 且多目标时不再借用 `targetVerify` 旧结果。
- target 40/40，frontend-regress 21/21。
- 全量 run.sh 通过。

## v0.7.566 · 2026-11-22

### 审计三十六轮
- stage 定期一致性：published 必须 injected、injected 必须 published、failed 状态与 stage 一致、旧数据补 injected 且不可回退、history 末条校验；stage 9/9。
- 辅种成功/失败都不改 `targetVerify` / `targetVerifyByHost`，回查状态保持；crossseed 4/4。
- 全量 run.sh 通过。

## v0.7.565 · 2026-11-22

### 审计三十五轮
- 辅种加种失败也写回 `crossseed` 错误/retryAt/attempts，调度不再每轮立刻重试；成功写回 targetHash，阶段保持 injected。
- 新增 crossseed 4/4：成功回写、同 hash 跳过、加种失败、源种不在 qB 重试累加。
- 全量 run.sh 通过。

## v0.7.564 · 2026-11-22

### 审计三十四轮
- 删除词条不清已发布历史、不影响发布统计，失败队列项保留且阶段不变；api-v2 46/46。
- 新增 scheduler-crossseed 3/3：只对已发布且有 publishedTorrent 的目标站辅种，已成功/未发布/未到重试时间都跳过，失败只记录不中断。
- 全量 run.sh 通过。

## v0.7.563 · 2026-11-22

### 审计三十三轮
- 队列状态同步回来源词条：驳回/跳过→skipped（带理由），重新送审/批准→selected，删除队列→new。
- 已发布条目加锁：retry/reject/skip 返回 `PUBLISHED_LOCKED`，删除同样拒绝；批量状态计入 `locked`。新增 queue-bulk 3/3。
- api-v2 46/46，覆盖 catalog 同步与已发布回滚边界。
- 全量 run.sh 通过。

## v0.7.562 · 2026-11-22

### 审计三十二轮
- 驳回后可重新送审：`retry` 清掉 reason/rejectedAt、阶段回 draft、状态回 pending；批准也清旧理由。
- 队列详情对 rejected 显示“重新送审”而不是“驳回”。
- 驳回项不进入 `/api/failures` 和统计 failures；api-v2 45/45，frontend-regress 20/20。
- 全量 run.sh 通过。

## v0.7.561 · 2026-11-22

### 审计三十一轮
- 批量发布抽成 `queue-bulk-publish`：部分成功不回滚成功项，失败最多 3 条；已提交/已注入目标站不重复上传。新增夹具 2/2。
- 驳回状态口径：只进“全部”列表，已通过/待确认不出现；列表计数与统计总览 `rejected` 一致，驳回必须写理由。api-v2 44/44。
- 全量 run.sh 通过。

## v0.7.560 · 2026-11-22

### 审计三十轮
- 拆分 api-v2 检查：站点/站点包/统计/触发/退出移到 `pta/checks/api-v2/site-ops.js`，主文件 815 → 550 行，质量审计不再提示。
- 队列批量 approve/reject/skip 改为整批事务，中途失败全回滚；重复 id 去重。新增 queue-bulk 2/2。
- 新增批量发布全部失败夹具：错误最多 3 条、条目状态不变；api-v2 43/43。
- 全量 run.sh 通过。

## v0.7.559 · 2026-11-22

### 审计二十九轮
- 删除词条时在事务里摘掉队列条目的 `catalogId` 并写 `catalogDeletedAt`，队列条目保留；api-v2 42/42。
- Sources 行内标记/状态/送审加逐行互斥，连点只发一次请求；失败不改本地状态、错误可见，恢复后可重试。
- frontend-regress 19/19。
- 全量 run.sh 通过。

## v0.7.558 · 2026-11-22

### 审计二十八轮
- 词条单条状态/标记改为事务内读改写，两个进程并发更新都保留；新增 catalog-item 2/2。
- Sources 导出验证跨页导出全部筛选结果；归档后列表清空时分页回到 1/1 并显示空状态；frontend-regress 17/17。
- 全量 run.sh 通过。

## v0.7.557 · 2026-11-22

### 审计二十七轮
- 词条批量状态改为整批事务，任一条失败全部回滚；新增 catalog-bulk 2/2。
- 站点包锁补超时/残留锁路径：15 秒残留锁可清理、等待超时返回 SITE_PACK_BUSY、校验失败也释放锁；site-pack-concurrency 仍 1/1。
- Sources 批量送审/归档失败后按钮恢复、错误提示可见；frontend-regress 16/16。
- 全量 run.sh 通过。

## v0.7.556 · 2026-11-22

### 审计二十六轮
- Sources 翻页/筛选组合：切站点/类型/搜索回第一页；状态切换立即隐藏旧状态数据，服务端回包后再显示。
- 站点包例外确认加跨进程锁（mkdir 原子锁 + 15 秒残留清理），并发确认不同分类不丢更新；新增 site-pack-concurrency 1/1。
- frontend-regress 15/15，site-pack 11/11。
- 全量 run.sh 通过。

## v0.7.555 · 2026-11-22

### 审计二十五轮
- Dashboard“今日/近 14 天”改按服务器本地时区算，东八区凌晨不再落到前一天；新增 day-boundary 3/3。
- Sources 列表请求改为序号保护，快速切筛选只保留最后一次响应，不再被旧数据覆盖；浏览器夹具覆盖。
- 站点包例外确认对 id 去重并限 500，坏 host/未知分类继续拒绝；site-pack 11/11。
- 全量 run.sh 通过。

## v0.7.554 · 2026-11-22

### 审计二十四轮
- target-pages 会话失效：详情页 200 登录页/302 跳转/删除后回查跳登录都返回 `LOGIN_REQUIRED`，不再当空详情或“未删除”；新增 target-pages-session 4/4。
- 图床配置：自定义头剔除 Host/Cookie/Content-Length 等传输头，端点只接受 http/https，data URL 限 8MB；imagehost 24/24。
- 前端日志：SSE 连续失败 3 次主动探会话，离开日志页停止重连；frontend-regress 12/12。
- 全量 run.sh 通过。

## v0.7.553 · 2026-11-22

### 审计二十三轮
- site-pack 增旧 key 解密、mtime 缓存刷新夹具，10/10。
- request-queue 增状态落库/新实例继续、写库失败恢复，7/7。
- 全量 run.sh 通过。

## v0.7.552 · 2026-11-21

### 审计二十二轮
- 新增 qb-session 夹具：4.x SID、5.x QBT_SID、401 重登录、分类读取，4/4。
- 新增 target-discovery 夹具：usercp/上传页 announce 合并、cookie 只发目标站、无 cookie 报错，3/3。
- 全量 run.sh 通过。

## v0.7.551 · 2026-11-21

### 审计二十一轮
- 图床并发转存单飞（同一张只上传一次），imagehost 23/23。
- 通知 Telegram 关闭后自动切 webhook，notify 12/12。
- 备份恢复失败安全（不可写/磁盘上限），backup 10/10。
- CSS 断点基线 --baseline 更新/校验流程，css-baseline-update 1/1。
- 全量 run.sh 通过。

## v0.7.550 · 2026-11-21

### 审计二十轮
- 图床会话过期后清会话、重新登录再传；imagehost 22/22。
- 通知双通道失败返回错误；notify 11/11。
- 备份输出不可写/磁盘上限失败时源库不受影响；backup 8/8。
- 新增 CSS 断点维护性基线：同上下文重复 0，跨断点变体 45 锁定。
- 全量 run.sh 通过。

## v0.7.549 · 2026-11-21

### 审计十九轮
- 图床 SSO 失败后再试、并发单飞；远程大图超限拒绝；imagehost 21/21。
- 通知 webhook 重试上限/失败结果；notify 10/10。
- 备份大文件恢复、进程中断后源库完好可重备；backup 6/6、backup-interrupt 1/1。
- 全量 run.sh 通过。

## v0.7.548 · 2026-11-21

### 审计十八轮
- webhook 失败按次数重试；notify 9/9。
- 图床 SSO 并发单飞（只登录一次），imagehost 21/21。
- 写入中备份/恢复一致性夹具，backup-concurrency 1/1。
- 全量 run.sh 通过。

## v0.7.547 · 2026-11-21

### 审计十七轮
- Telegram 失败时回退 webhook；notify 8/8。
- SQLite 连接设置 busy_timeout/timeout，新增 4 进程并发写 100 次夹具，db-concurrency 1/1。
- 全量 run.sh 通过。

## v0.7.546 · 2026-11-21

### 审计十六轮
- backup 增 FORCE=1 覆盖恢复夹具，5/5。
- 新增 deploy-docker 夹具：shell 语法、Dockerfile 多阶段/数据卷/健康检查、compose 配置、entrypoint 降权、deploy 排除与探活，6/6。
- 全量 run.sh 通过。

## v0.7.545 · 2026-11-21

### 审计十五轮
- frontend-regress 增 SiteDetail 保存回填、Sources 外链协议安全、Queue 返回刷新详情；共 11/11。
- 全量 run.sh 通过。

## v0.7.544 · 2026-11-21

### 审计十四轮
- ui-visual 增 7 页 × 4 宽度截图基线（28 张，ImageMagick 像素对比，2% 抗锯齿容差）。
- frontend-regress 增 Sources 登录重载、SiteDetail 加载失败不覆盖、Nodes 改地址测试表单配置；8/8。
- 全量 run.sh 通过。

## v0.7.543 · 2026-11-21

### 审计十三轮
- 新增 7 页 × 360/390/768/1280 computed-style 基线，28 个快照；接入 run.sh。
- 队列目标站切换、下载轮询串条目、列表竞态的浏览器夹具保持通过。
- 全量 run.sh 通过。

## v0.7.542 · 2026-11-21

### 审计十二轮
- frontend-regress 增队列夹具：目标站切换后上传到新站、下载轮询不串条目、列表慢响应不覆盖新页签。
- 连同 Escape、设置页登录、dock 断点 computed-style，共 5/5。
- 全量 run.sh 通过。

## v0.7.541 · 2026-11-21

### 审计十一轮
- 新增 frontend-regress 浏览器夹具：Escape 不误关详情、直达设置页登录加载、800/1200px dock 断点 computed-style 对比，2/2。
- 全量 run.sh 通过。

## v0.7.540 · 2026-11-21

### 审计十轮
- 新增 `/api/downloaders/probe` 路由级夹具：默认拒私网、白名单放行、黑名单优先，3/3。
- responsive 32/32、smoke 28/28 通过，CSS 断点只保留视觉回归验证。
- 全量 run.sh 通过。

## v0.7.539 · 2026-11-21

### 审计九轮
- 质量审计 CSS 重复改为同上下文口径：同上下文重复 0，跨 @media 45 个只记断点变体，不再当债务；总体 100。
- 返回待审核时刷新当前详情；批量设置全失败不丢选择；退出登录检查响应；悬停切页保留（smoke 覆盖）。
- 全量 run.sh 通过。

## v0.7.538 · 2026-11-21

### 审计八轮
- qB 探测地址加白/黑名单与开发开关：默认拒内网，`PTA_DOWNLOADER_ALLOW` 可放行，黑名单优先；新增 downloader-policy 3/3。
- 删除一条被 901px 图标轨覆盖的重复 `dock-label` 规则。
- 全量 run.sh 通过。

## v0.7.537 · 2026-11-21

### 审计七轮
- 前端 Escape 不再在输入框/文本域里误关站点面板。
- 全量 run.sh 通过。

## v0.7.536 · 2026-11-21

### 审计六轮
- 图床/源图固定 IP 连接，关闭连接复用，补 DNS 重绑定防护。
- 抓取过滤探测、站点会话自检不再跟随跳转，避免 cookie 外泄。
- 目标站集合/多目标完成判定修正；上传锁落 SQLite。
- 全量 run.sh 通过。

## v0.7.535 · 2026-11-21

### 审计五轮
- 图床/源图请求改为 DNS 固定 IP 连接，补一条不可被解析后换 IP 绕过的路径。
- 上传锁落 SQLite `upload_locks` 表，单实例和未来多进程都能互斥；新增 upload-lock 3/3。
- targetHosts 始终包含主目标站；多目标「已有」计为完成。
- 全量 run.sh 通过。

## v0.7.534 · 2026-11-21

### 审计收尾
- 目标站集合始终包含主目标站，避免 targetSite 被 targets 列表漏掉。
- 多目标中「目标站已有」计为已完成，不再卡在未提交阶段。
- 全量 run.sh 通过。

## v0.7.533 · 2026-11-21

### 审计四轮
- 前端 401 统一失效、Settings/Sources 登录后重载、Queue 目标站/下载轮询/列表竞态、失败页搜索分页、日志页隐藏关闭 SSE。
- 主站重试补 confirmHosts；skipped 阶段可读；页面标题恢复。
- 图床直链先 DNS 校验再下载；日志/分类/映射请求 loading 用 finally 复位。
- 全量 run.sh 通过。

## v0.7.532 · 2026-11-21

### 审计三轮
- 上传 queue 锁改为不可由请求伪造的 symbol 跳过；多目标/路由/调度共用。
- 图床直链、页面、重定向都做 DNS 内网拦截。
- 前端补 loading finally、下载器分类竞态、日志页离开关闭 SSE、失败页搜索重置、节点测试用表单配置。
- 目标站详情/删除/探测/回查默认不跟随跨域跳转。

## v0.7.531 · 2026-11-21

### 全盘审计第二轮
- 同 queue 上传加进程级互斥，多目标/路由/调度共用，避免跨目标写覆盖。
- 图床/源图 URL 增加 DNS 解析后的内网拦截，重定向后复查。
- 目标站详情/删除/探测/回查默认不跟随跨域跳转，避免 cookie 外泄。
- 前端：watch 目录根限制、站点包/覆盖/映射 loading 复位、下载器测试用表单配置、Dashboard 发布统计、目标站切换同步、列表竞态、站点定义加载失败保护。

## v0.7.530 · 2026-11-21

### 全盘安全/流程修复
- 站点 `base` 必须绑定本站域名；私有定义/会话自检/过滤探测不能把 cookie 带到外部。
- 源种下载、详情回退、手工回查都做同站校验和跳转校验。
- 目标站删除和上传共用测试站/主站确认门禁；watch 目录限制在允许根。
- 登录不再回显会话 token；畸形 cookie 不抛错；登录失败表加上限。
- 状态变更接口校验 Origin；全局 500 不回内部信息；分页负数不再等于不限量。
- JSON 配置原子写；媒体种子分块哈希；远端种子/图片/详情加大小上限。
- 换 qB 地址清旧密码；图床 SSO 首跳和回调校验域名。
- 前端：401 统一弹登录、目标站切换同步、下载轮询防串条目、站点定义加载失败不覆盖、来源站切换保存、列表竞态保护、Dashboard 发布统计修正。

## v0.7.529 · 2026-11-21

### 调度逻辑修复
- 调度发布误用空闭包 `deps`，自动发布会直接 `SOURCE_CHECK_FAILED`；改用 `o.deps`。
- 多目标发布一个站失败后继续尝试其余目标，全部尝试后才决定是否注入。
- `autoDupe` 开关接上调度查重；显式指定 dedupe 步骤仍可强制。
- 辅种早退（NO_QB/NO_SOURCE_HASH/坏种）落失败状态；同 infohash 记成功不再重试。
- 新增 scheduler-publish 1/1；scheduler-dedupe 3/3。

## v0.7.528 · 2026-11-21

### 修复
- 整理发布资料时顺手清理历史简介技术块的重复空行并写回，避免每次都要手动改。

## v0.7.527 · 2026-11-21

### 修复媒体信息回填
- 源站简介里的 BDInfo/MediaInfo BBCode 原样保留，不再重新套 `【BDInfo】[quote]` 和额外空行。
- HTML 转 BBCode 时 `<br>` 后紧跟 `</div>`/`</p>` 不再产生双换行；历史技术块在整理时折叠空行，正文段落保留。
- 回归：mediainfo 9/9。

## v0.7.526 · 2026-11-21

### 50 轮逻辑审计
- 修复 qB 下载器 v2 密文密码读不出的回归（此前新保存密码会当明文登录失败）。
- 调度查重失败不再标记已通过；手动送审同样处理。
- 调度抓取修正 waiting 漏算和失败站同时算成功。
- 重试成功清残留重试标记；action=retry 清 failed 阶段；坏数据补 id；多目标 host 去重。
- 新增 scheduler-crawl 2/2、scheduler-dedupe 2/2；api-v2 40/40、security 5/5。
- 50 轮报告：`pta/docs/LOGIC-AUDIT-50.md`；7 个风险项已登记。

## v0.7.525 · 2026-11-21

### 逻辑修复
- 类型变更后，之前因「类型不符/类型未知」跳过的词条回到待审，避免改类型也永远不重审。
- 修改标题、目标站或目标列表时清空旧查重缓存，避免用过期结果跳过查重。
- 数字分类没映射时在初筛直接拦下（`类型未知`），不再放行绕过类型闸门。
- 回归：screen-type 5/5、api-v2 39/39、crawl-detail 3/3、failures 5/5、target 38/38。

## v0.7.524 · 2026-11-21

### CSS 去重（第二轮）
- 合并剩余同选择器 + 同 @media 上下文的重复规则；同上下文重复 26 组 → 0。
- 质量审计重复选择器 64 → 45；同上下文 0，剩余均为不同断点下的必要覆盖。
- 删除两段未被引用的 `bg-heartbeat` keyframes（实际动画用 `bg-breathe`）。
- 验证：responsive 32 项、build、UI 基线、全量 run.sh 通过；截图对比无布局变化。

## v0.7.523 · 2026-11-21

### CSS 去重
- 合并 44 条重复规则、删除 123 行冗余声明；质量审计重复选择器 82 → 64。
- 只合并同一选择器、同一媒体查询下可证明不改变级联的声明；跨断点变体保留。
- 修正 flex/padding/border 简写与长写不能互相覆盖的合并判断，避免误删布局属性。
- 验证：responsive 32 项通过，build 通过，UI 冻结基线已更新，全量 run.sh 通过。

## v0.7.522 · 2026-11-21

### 质量
- `stageTime` 收敛到 `utils/format.js`，消除 Audit 的重复函数名提示。

## v0.7.521 · 2026-11-21

### 部署
- `deploy.sh` 同步 `pta/scripts/`，密钥轮换和状态审计脚本在部署目录可直接运行。

## v0.7.520 · 2026-11-20

### 收尾审计 P2：状态校验、密钥轮换、前端 API、回归落点
- 密钥：密文升级为 `v2:<keyId>`，支持 `PTA_SECRET_PREVIOUS` / `.secret.previous` 多版本解密；新增 `pta/scripts/rotate-secret.js`（默认预览，`--apply` 写库前备份）。
- 站点包：支持 `PTA_SITE_PACK_KEY_PREVIOUS`。
- 状态：`stage.ensure` 按 status 推断旧数据阶段；新增 `stage.validate`、`scripts/audit-state.js` 和 `state-consistency` 检查。
- 跨站同片：明确“先到先得”，跳过词条记 `dupeOf` / `skipReason` / `skippedAt`；新增 `docs/DEDUPE.md`。
- 前端：新增 `utils/api.js` 的 `apiJson/errorText`，Queue 统一走 API 客户端，错误码集中映射成中文。
- 组件：拆出 `QueuePreflight.vue`，`Queue.vue` 从 808 行降到 760 行。
- 日志：新增 `server/log.js`，抓取/初筛的可忽略异常不再完全静默。
- 契约：`api-v2` 增加队列/词条/下载器/错误形状断言；新增 `mock-shape` 校验表单夹具与 mock 字段一致。
- 回归落点：新增 `publish-id-capture` 静态回归和 `docs/AUDIT-REGRESSIONS.md`，12 个审计样例逐条对应检查文件。

## v0.7.519 · 2026-11-20

### 修复审计 P2：回查隔离、默认值、错误码、饥饿
- 目标站回查按 host 保存到 `targetVerifyByHost`，多目标不再互相覆盖；旧字段保留兼容。
- 配置默认值收敛到 `config-schema.DEFAULTS`，路由/抓取/查重统一读取；补 API 断言防漂移。
- 补注册抓取/上传相关错误码，失败统计不再归 UNKNOWN。
- 初筛按新入库优先（created_at DESC, rowid DESC），前 500 条全跳过时新条目仍能送审。
- 站点定义 `catMode` 只接受 single/multi/bracket/indexed，未知值直接 400。
- 多目标上传失败逐个发通知，带 id/host/code。
- 新增回归：多目标回查隔离、并发上传锁、类型变化清全量游标、catMode 校验。

## v0.7.518 · 2026-11-20

### 修复审计 P0/P1：类型闸门、发布安全、状态机、并发
- 抓取：没有保存 types 直接拒绝（NO_CATEGORY_TYPES）；类型变化清 fullDoneAt，下次全量；catName 抓取时映射成可读标签；catMap 合并 site-maps。
- 初筛：按 catId→label→typeOf 增加类型闸门；host 条件下推到 SQL；queue id 从 MAX 生成。
- 发布：源种下载地址只允许同站/子域；announce 优先 passkey；关闭清洗时若源种含 passkey 直接拒绝；手动/调度上传加同 queue+host 内存锁。
- 状态机：submitted/injected 不允许回退；prepare 对已提交返回 409；failed 保留错误/attempts；prepare 不再增加 retry attempts。
- 前端：发布/整理/操作/重试捕获条目 id，切条目不会作用到新条目。
- 目标站分类：数字源分类不再直通目标站 catId。
- 新增 `prepare-guard` 2/2、`screen-type` 2/2；`target` 36/36、`crawl-detail` 3/3、`smoke` 28/28。
- 行为变化：旧站点必须先按站保存「类型」，否则抓取会停下。

## v0.7.517 · 2026-11-20

### 分类政策：类型按站保存，抓取硬过滤
- 新增 `pta/docs/CATEGORY-POLICY.md`，列清类型归一顺序、按站保存和抓取规则。
- 类型归一合并到 `category-policy.js`，流程页和抓取共用；MV 排在音乐前，有声书排在电子书前。
- 保存类型时为该站写入 `types` + `cats`，一个类型收下所有命中分类；没匹配到会提示。
- 抓取时只要该站有 `types`，就只抓对应分类；一个都没匹配到直接报 `NO_CATEGORY_MATCH`，不再静默全抓。
- 没选来源站就保存类型会提示“先选来源站”，不再假装保存。
- 新增 `category-policy` 检查 4/4。
- 历史已经抓错的词条不会自动删除。

## v0.7.516 · 2026-11-20

### 自动重试用完移到发布前检查
- 失败词条不再显示「重试用完」徽标，只在发布前检查里显示「自动重试用完，需要重新排队」或下次重试时间。
- 失败词条的重新排队按钮缩到 20px 高；行和分页去掉圆角，悬停不再出现圆角底色。
- 发布前检查新增「失败与重试」一行，带尝试次数和下次重试时间。
- `smoke` 28/28。

## v0.7.515 · 2026-11-20

### 发布前检查改键值对齐
- 标签固定 76px 右对齐，内容左对齐到同一列，不再一列宽一列窄。
- 种子、Tracker、infohash 等长内容统一从内容列换行。
- 手机端标签缩到 68px，仍然同一列对齐。
- `smoke` 28/28。

## v0.7.514 · 2026-11-20

### 失败区去掉表头，分页铺满左卡片
- 删除「N 条 · 用完 N / 只看用完 / 刷新」整行，失败列表直接从词条开始。
- 失败分页条改成和左卡片同宽（`width:100%` + 10px 内边距），固定在卡片底部。
- 页码压成「1/1 页 · 4 条」，和上一页/下一页同一行。
- `smoke` 28/28、`responsive-layout` 32/32。

## v0.7.513 · 2026-11-20

### 失败表头/分页对齐，强制单行
- 失败表头和分页的左右内边距改成和失败词条一致，不再左右错位。
- 表头改成三列网格：计数 / 只看用完 / 刷新，强制一行。
- 失败分页和普通队列分页都改成三列网格，页码文字缩短为「1 / 1 页 · 4 条」，强制一行。
- `smoke` 28/28。

## v0.7.512 · 2026-11-20

### 待审左栏抄站点页宽度，失败分页压成一行
- 待审左侧列表宽度改成和站点页一致：`clamp(280px, 30%, 400px)`。
- 失败表头「共 N 条 · 用完 M + 只看用完 + 刷新」强制一行，按钮缩小。
- 失败分页和普通队列分页都改成单行：页码文字缩短，和上一页/下一页同一行。
- 重新排队按钮略放大到 24px 高，仍然紧凑。
- `smoke` 28/28、`responsive-layout` 32/32。

## v0.7.511 · 2026-11-20

### 失败列表只留一个分页，表头压成一行
- 失败标签隐藏普通队列分页，只保留底部分页。
- 失败词条去掉卡片边框，和普通待审列表同一风格。
- 表头「共 N 条 · 重试用完 M」和「只看重试用完」「刷新」强制一行，按钮缩小，不换行。
- `smoke` 28/28。

## v0.7.510 · 2026-11-20

### 待审发布信息再收拢，失败列表加分页
- 发布信息外层去掉卡片边框，直接贴在详情里。
- 目标站/标题/副标题/图床/简介统一为「标签 + 控件 + 右侧按钮位」三列；控件从右往左缩短，给右侧按钮留出固定空间。
- 去掉「源站简介里没识别到 MediaInfo/BDInfo」的提示；没有媒体信息就不显示。
- 失败列表底部固定「上一页 / 下一页」分页，样式照站点页；重新排队按钮改小。
- `smoke` 28/28、`responsive-layout` 32/32。

## v0.7.509 · 2026-11-20

### 待审详情排版收拢
- 「简介」移进「发布信息」里，放在图床下面；不再单独一张卡。
- 「匿名发布」移到发布信息标题右侧同一行。
- 目标站/标题/副标题/图床/简介/最终预览统一宽度：左边标签固定，右边控件对齐到同一条右边界。
- 简介和最终简介预览改成全宽；最终预览去掉背景框，直接显示文本。
- 发布前检查改成两列键值网格，种子和 Tracker 单独一行，缺项统一放在底部。
- 底部发布操作去掉上边框，整体更紧凑。
- 失败列表改紧凑卡片：标题一行、状态/错误一行，重新排队按钮放右侧。
- `smoke` 28/28、`responsive-layout` 32/32。

## v0.7.508 · 2026-11-20

### 查资料会拼副标题，不再只填中文名
- 查资料请求带上队列条目 id；服务端用资料源的导演/主演，加上条目的原盘/地区/音轨字幕信息拼副标题。
- 前端优先使用拼好的副标题，例如「斩神之凡尘神域 | 导演:曾元俊 | 主演:马正阳/夏觅尘/王潇倩」。
- 如果拼出来的比现有副标题短，会保留现有更完整的内容，不覆盖。
- 查资料提示改成「已更新 副标题 / 简介」。
- `smoke` 28/28。

## v0.7.507 · 2026-11-20

### 待审页彻底去掉截图卡
- 删除截图表单、手动上传、图床演练和截图数量提示。
- 源站简介里的图片自动随简介保留，发布时按图床规则转存；不需要人工插手。
- `smoke` 28/28。

## v0.7.506 · 2026-11-20

### 失败与重试从日志页移到待审「失败」标签
- 实时日志只保留事件流水，不再放失败队列。
- 待审页左侧「失败」标签显示所有卡住的条目：阶段、错误、尝试次数、下次重试、是否自动重试用完。
- 每条可直接「重新排队」，清掉错误和次数后放回待处理；不会重复上传已提交条目。
- 日志页保留「失败与重试 → 待审」跳转。
- `smoke` 28/28。

## v0.7.505 · 2026-11-20

### 截图默认用源站的，手动补图收进折叠
- 截图卡只显示「源站简介里有 N 张截图，发布时会随简介保留」。
- 手动上传/图床演练收进「手动补图」折叠，只有源站没有截图或你主动要补时才用。
- 源站截图不重复上传，也不要求再点图床演练。
- `smoke` 27/27。

## v0.7.504 · 2026-11-20

### toast 不再挡发布按钮，查资料结果更明确
- 全局 toast 从底部移到顶部，不再盖住「发布到目标站」。
- 查资料不再弹 toast，只在副标题下方显示内联结果。
- 结果和现有内容一样时，会写出查到的中文名和简介字数，例如「查到了 中文名『…』、简介 123 字；没有改动」。
- `smoke` 27/27。

## v0.7.503 · 2026-11-20

### 修查资料串条目；MediaInfo 改为源站自动识别
- 查资料加条目 id/请求序号校验；切到别的条目后，旧响应不会再填到当前条目。
- 队列详情加请求序号，避免多个刷新并发时旧数据覆盖新状态。
- 源站简介 BBCode 里的 `[quote]` / `[hide]` / `[code]` 自动识别 MediaInfo/BDInfo，发布计划和发布前检查直接使用。
- 只有“时长: …”这类残缺字段会被替换；完整字段不覆盖。
- 待审页删除整个高级区：不再有 MediaInfo 输入框、解析按钮、本地视频读取/截图、临时种子、下载器预检。
- 截图继续用源站简介里的图；`整理发布资料` 自动整理标题/简介/源站媒体信息。
- `mediainfo` 8/8、`target` 33/33、`smoke` 27/27。

## v0.7.502 · 2026-11-19

### 修查资料提示“查到了但没有中文名或简介”
- 接口实际返回 `data.data.title/overview`，前端原来读的是 `data.title/overview`，所以永远拿不到内容。
- 现在同时兼容嵌套和扁平结构，并兼容 name/intro/summary 字段。
- smoke 的假响应改成真实嵌套结构，避免再测偏。
- `smoke` 26/26。

## v0.7.501 · 2026-11-19

### 查资料补超时、自动保存和结果提示
- 查资料会先解析干净片名和年份，避免把分辨率/制作组带进搜索词。
- 查到后自动保存中文名和简介，副标题下显示「已更新 中文名/简介 · 来源 · 已保存」。
- 如果查到的和现有内容一样，会明确提示「没有改动」，不再看起来像没反应。
- 增加 20 秒超时和「查询中…」状态，避免请求卡住后按钮一直没反应。
- 后端把每次资料查询的来源、结果和耗时写进 `资料` 日志。
- `smoke` 26/26。

## v0.7.500 · 2026-11-19

### 待审页去掉本地查重，改成显示目标站查重状态
- 删除列表的「批量查重」和详情里的「本地查重」；待审页不再提供手动查重按钮。
- 查重定义统一为目标站是否已有这个种子；本地标题比对不放在待审流程里。
- 「发布前检查」新增目标站查重状态：发布时自动查 / 已通过 / 已有同种会跳过 / 上次查重失败。
- 状态只读队列里已有结果，不在待审页发目标站请求。
- `target` 32/32、`smoke` 26/26。

## v0.7.499 · 2026-11-19

### 本地查重可点，查资料有结果
- 发布信息里的「查重」改成「本地查重」，旁边加「查一次」，只比队列/已发布/词条库，不请求目标站。
- 「查资料」查询时先去掉分辨率/制作组、带上解析出的年份，减少搜错片。
- 查资料完成后在副标题下方显示「已填入中文名/简介 · 来源」或失败原因，不再只靠 toast。
- `smoke` 26/26。

## v0.7.498 · 2026-11-19

### 按钮挪到对应输入框右边
- 「回填源标题」放标题框右边；「查资料」放副标题框右边。
- 「解析 MediaInfo」放 MediaInfo 标题行右边；「生成临时种子」放 Tracker 输入框右边。
- 「整理发布资料」放简介标题行右边，整理结果和最终简介预览都在简介卡里。
- 底部只留「下载种子 / 发布到目标站 / 驳回 / 跳过」，不再混入字段操作。
- `smoke` 26/26。

## v0.7.497 · 2026-11-19

### 去掉重复的「上传准备」和「草稿预览」
- 删除详情里的「上传准备」大卡；它只是最终发布内容的预览，和标题/简介/高级区重复。
- 「草稿预览」和它的发布标签块一起移除；这个接口本来就没返回标签，实际只改表单不保存。
- 「回填源标题」改名「用源种名」：只回填标题，因为源种里只有文件名；副标题和简介来自源站页面。
- 「整理发布资料」只在简介框下方留一个「最终简介预览」折叠；发布前会重新整理一次，确保用当前标题/简介/MediaInfo。
- 改了标题/简介会把旧 prepared 快照作废，避免发布时被旧值覆盖。
- `api-v2` 36/36、`smoke` 26/26。

## v0.7.496 · 2026-11-19

### 高级区再简化，整理资料真正保存
- 高级区默认只显示 MediaInfo/BDInfo 文本框、「解析 MediaInfo」「整理发布资料」。
- 文件路径/截图、临时种子/下载器预检各自收进二级折叠，默认不展开。
- MediaInfo 解析兼容 BOM、BBCode 包裹、中文分段名、全角冒号和中文 BDInfo 标签；认不出时直接提示从哪里开始粘贴。
- 「整理发布资料」先保存当前标题/副标题/简介/目标站，再生成发布预览，并显示「已整理」或失败原因。
- 「发布到目标站」前也会先保存表单，避免改了标题/简介但服务端还用旧值。
- 下载器预检移到高级排错区；旧「演练」消息不再占主区域。
- `mediainfo` 7/7、`api-v2` 36/36、`smoke` 26/26、`target` 32/32。

## v0.7.495 · 2026-11-19

### 待审页发布前检查
- 详情里新增紧凑的「发布前检查」：目标站、分类、制作组、媒介、种子名、infohash、tracker 处理方式。
- 分类和制作组优先显示站点选项的中文标签，不再只给数字 id。
- 点「下载种子」时缓存源种到私有 `data/torrents/`；预览用它实际跑一遍清洗，显示「清洗后不变」。
- 预览只读计划和本地文件，不请求目标站、不上传、不返回 announce 明文。
- 高级区改名「媒体信息与临时种子（日常可忽略）」，按钮改成「读取视频信息 / 从视频截图 / 生成临时种子 / 解析 MediaInfo / 整理发布资料」。
- 注入检查不再重复「演练」：只显示一条「注入检查 · qB：会通过 qB 加种」。
- 目标站不足两个时隐藏「多目标」区；多站时改叫「同时发布到」。
- 新增 `target` 预览/标签回归，32/32。

## v0.7.494 · 2026-11-19

### 研究记录
- 追加 auto_feed 点击目标站到上传页填表的链路研究，只记思路，不复制代码、品牌或站点配置。
- 结论：其种子处理会重建 info 导致 infohash 变化；我们的清洗继续保留 info 原始字节，发布后拉权威种辅种。

## v0.7.493 · 2026-11-19

### 待审页改成“下载 → 发布”两步
- 主操作拆成「下载种子」和「发布到目标站」：下载只把源种加进 qB，发布必须等 qB 100% 才可点。
- 下载后每 8 秒查一次 qB 进度；只查已记录的 infohash，不再反复请求源站。
- 手动发布成功后自动拉目标站权威种回填辅种，`skip_checking` 不重新校验。
- 「下载种子」不再要求 `realPublish`；真正提交目标站仍受 `realPublish`、测试站模式和确认弹窗限制。
- 媒体路径 / tracker / 生成种子收进「高级」，日常只留资料、截图和两个主按钮。
- 修 smoke：详情检查先展开高级区；`target` 29/29、`target-lock` 5/5、`publish` 9/9、smoke 26/26。

## v0.7.492 · 2026-11-19

### 目标站分类自动映射
- 送审时把源分类名/推断分类带进队列（电影/剧集/动漫/综艺/纪录/音乐/体育等）。
- 目标站映射按“中文标签 → 通用类型 → 目标站选项”逐级匹配；支持大小写/空格/中英文和包含匹配。
- 老队列没有分类字段的，准备上传时按标题自动推断，再匹配目标站 catMap。
- 只有确实匹配不到时才提示“分类没映射”；重跑「准备上传」即可刷新旧预检。
- `target` 检查 29/29。

## v0.7.491 · 2026-11-19

### 全量/增量切换写日志，不加按钮
- 全量跑完写：`全量完成，下一轮转增量`。
- 增量遇到 0 新增写：`增量无新增，下一轮从第 1 页再查`。
- 切换仍由每站 `fullDoneAt` 自动判断，没有手动开关或按钮。

## v0.7.490 · 2026-11-19

### 改分类预设不再强制全量
- 去掉搜索条件变化清 `fullDoneAt` 的逻辑；改分类/媒介/分辨率/优惠后仍按增量走（第 1 页起，0 新增停）。
- 新增 `crawl-detail` 断言：改分类预设后 `fullDoneAt` 保留。
- 全量只发生在站点第一次抓取或手动清状态。

## v0.7.489 · 2026-11-19

### 测试站模式：只允许发测试站
- 新增 `testOnly` 配置，默认 true；生产已开启。
- 目标站列表只显示测试站；主站即使手动输入域名确认也会被 `403 TEST_ONLY` 拦住。
- 关闭 `testOnly` 后才回到“主站需输入域名确认”的模式；调度自动发主站仍需 `allowMainTarget=true`。
- 主站 cookie 未更换、未删除，仍可作为只读来源站使用；`target-lock` 检查扩到 5/5。

## v0.7.488 · 2026-11-19

### 真实提交三道硬闸
- 标题命中 sample/test/probe/fixture 的条目，真实提交直接 403 `TEST_ITEM_BLOCKED`。
- 主站真实提交必须输入目标域名确认；测试站和 127.0.0.1 不受影响。调度自动发布到主站默认被拦（`allowMainTarget` 默认 false）。
- 配置开关 `realPublish/realCrawl/realImages` 和 `targetHost` 变更写日志，能查到什么时候开过。
- 新增 `target-lock` 检查 4/4；`target` 29/29。

## v0.7.487 · 2026-11-19

### 目标站真实提交二次确认与审计日志
- 「提交目标站」不再一点就发：先弹确认，明确写出条目标题和全部目标站域名。
- 每次真实提交写日志：开始记录 host/queue id，完成记录是否回查、详情地址；失败也能在日志页看到。
- 这是对“测试种子被提交”的止血和取证补丁；生产 realPublish/realCrawl/realImages 与调度已关闭。

## v0.7.486 · 2026-11-19

### 从 qB 取路径不再卡 infohash；旧预检告警清洗
- 没有 infohash 时先按标题在 qB 找；找不到就取源种解析 hash；qB 里没有会自动加入，并返回当前进度，下完再点一次。
- 队列详情对旧 `prepared` 快照做显示清洗：`必填字段 …`、`type/source_sel/team_sel` 不再出现，换成“已自动填 N 个字段”；分类/制作组告警改成人话，不用重新准备也能看清。

## v0.7.485 · 2026-11-19

### 媒体按钮不再“点了没反应”，预检告警改人话
- 媒体卡新增「从 qB 取路径」：按队列条目的 infohash 查 qB `content_path`；目录会自动找最大的视频文件；不在 `PTA_MEDIA_ROOT` 下会明确报错。
- 没填文件路径时，「探测 / 生成截图 / 生成种子」按钮直接禁用并给提示，不再只弹一个 1.8 秒 toast。
- 多目标预检只显示需要处理的告警（分类没映射、制作组没映射、目标站没有 cookie 等）；自动填的字段只显示“已自动填 N 个字段”，不再出现 `type/source_sel/team_sel` 这种内部字段名。
- `target` 检查 29/29。

## v0.7.484 · 2026-11-19

### 待审翻页改成站点页同款，页脚居中
- 待审页翻页改成站点页的胶囊样式：上一页 / 第 X / Y 页 · 共 N 条 / 下一页，禁用态淡化。
- 页脚信息水平居中，手机换行后每行也居中。

## v0.7.483 · 2026-11-19

### 待审页固定窗口，页脚贴底
- 待审页桌面端改成固定高度双栏：左侧列表、右侧详情各自内部滚动，不再把整页拉到几千像素。
- 每页从 100 条改为 50 条；208 条时列表内部滚动，页码 1/5。
- 页脚改为贴页面底部，短页面不再悬空在中间。
- 底部导航 1100–1319 改成右侧竖排，901–1099 上移 96px，避免挡住页脚。
- dashboard/sites/crawl/queue/sources/logs/settings/changelog × 1280/390 逐页核对。

## v0.7.482 · 2026-11-19

### 页脚不再被底部导航压住
- 901–1319px 宽度下，悬浮导航上移到页脚上方 96px，不再挡住版本/技术栈/站点统计。
- 逐页检查 dashboard、sites、crawl、queue、sources、logs、settings、changelog，1280 和 390 下页脚都完整可读，无横向滚动。
- 只改导航定位，不改页面内容和页脚文案。

## v0.7.481 · 2026-11-19

### 失败队列改成「失败与重试」
- 面板标题改为「失败与重试」，加一句说明：卡住的条目；自动重试用完的可以手动重新排队。
- 阶段和错误码改成中文：补资料、目标站、查重、资料服务连不上、登录失效、源种没下完等；原始码保留在悬停提示里。
- 「死信」改为「自动重试用完」，「重放」改为「重新排队」，时间格式化成 MM-DD HH:mm。
- 空状态改为「没有卡住的条目」；修了失败面板一直显示“读取中”的响应式 bug。
- 手机端改成两行布局，按钮不再被挤出屏幕。

## v0.7.480 · 2026-11-19

### 查重逻辑收敛，送审查全部目标站
- 新增 `dedupe-item.js`，调度查重和送审查重共用同一套状态写回、错误和重试逻辑。
- 送审查重从“只查默认目标站”改为查该条目的全部目标站；命中任一不可发就跳过，命中可发则保留并记 `dupeReview`。
- 送审单次仍最多处理 20 条，剩余留在队列由调度查重；提示会写明剩余条数。
- `dedupe-errors` 检查扩到 7/7（多目标、全跳过、失败留痕）。

## v0.7.479 · 2026-11-18

### 修查重错误语义与手动提交闸门
- 目标站不可达、cookie 失效、验证失败不再当成“没有重复”：`checkDupe` 返回错误码，调度/送审/上传前统一按失败重试。
- 失败队列重放清空 `dupePassedAt` / `dupeResults`，重放后会重新查重。
- 手动和 CLI 真提交目标站前必须过 `ensureSource`：源种没下完返回 409 `SOURCE_NOT_READY`。
- 初筛「没中字就不收」不再依赖详情字段，详情关闭时也生效。
- 抓取条件（分类/媒介/分辨率/优惠）变化时清 `fullDoneAt`，下一轮重新全量。
- 详情失败加 15 分钟起步的退避，避免失败条目每轮占满详情预算。
- 删除 `scheduler-dedupe` 死变量；新增 `dedupe-errors` 4/4。

## v0.7.478 · 2026-11-18

### 初筛解耦、送审时查目标站、日志页修复
- 初筛只读 ② 初筛卡（`fetch[1]`），不再借用发布卡的「必须有简介」；缺简介留给终审检查/回填。
- 按条件送审：本地初筛后，对选中的前 20 条逐条查目标站；命中已有的标 `skipped` 并写 `dupeResults`，剩余留给调度查重。
- 送审确认与结果提示写清本地查重、目标站查重和剩余条数；未设目标站会明确提示。
- 日志页页脚不再压住日志面板；SSE 字段改成 `t/lvl/tag`，断线 3 秒重连。
- api-v2 35/35、全量检查通过。

## v0.7.477 · 2026-11-18

### 抓取页数不再固定 50 页
- 抓取阶段翻到该预设实际返回 0 条为止，不再在第 50 页截断。
- 站点把超出页码夹到最后一页时，按“同一页内容重复”停止，避免死循环。
- 1000 页只是防死循环的绝对上限，不是产品限制。
- 全量完成后仍写 `fullDoneAt`；增量遇到 0 新增停止。

## v0.7.476 · 2026-11-18

### 一轮抓到底：首次全量，之后增量
- 抓取阶段每个站一轮内连续翻页，不再一轮只抓 1 页；停止条件是 0 条、第 50 页、窗口或失败。
- 站点第一次抓取走全量；完成（0 条或 50 页）后写 `fullDoneAt`。
- 之后自动转增量：每轮从第 1 页开始，遇到“0 新增”就停，游标回第 1 页。
- 每站每轮只在第一页补详情，后续页 `detail=false`，避免一轮里重复详情。
- 调度日志增加页数；新增 `crawl-loop` 检查 3/3。

## v0.7.475 · 2026-11-18

### 详情补抓改成 backlog，不再丢后面几十条
- 详情候选先过媒介/分辨率/限制，过滤掉的不再浪费请求。
- 当前页最多占一半预算，其余从 catalog 里最久缺详情的条目补；每条最终都能轮到。
- 详情里新发现的限制命中会归档，不再进初筛。
- 新增 `crawl-detail` 检查：3 条分 3 轮补全，第 4 轮不重复抓；全量检查通过。

## v0.7.474 · 2026-11-18

### 调度条文案与控件对齐
- 「抓取周期」改为数字输入（30–1440 分钟），不再是下拉；说明它是“多久重新开一轮”，不是请求间隔。
- 「列表 / 详情」改为「源列表 / 源详情」。
- 「窗口 / 窗口最多」改为「限流 · 最近 N 分钟 · 最多 M 次」，一眼能读成一句话。
- 「失败暂停」改为「失败停站」。
- 所有数字控件统一 64px，按 4 位数字宽度对齐。

## v0.7.473 · 2026-11-18

### 多分类合并搜索、去掉每日上限、拆分列表/详情间隔
- 抓取改成按当前选中的分类合并成一个搜索（`catMode: indexed`），不再按分类轮转；翻到 0 条或第 50 页后，下一轮从第 1 页重开。
- 删掉每日 20 次的硬顶及相关代码/字段；保留窗口上限和连续失败停站。站点覆盖里的「每天抓几次」一并移除。
- 列表页和详情页间隔拆开：列表默认 10 秒（6–60），详情默认 600 秒（8–600）；源站窗口仍合并计数。
- 调度条改为「列表 / 详情 / 窗口 / 窗口最多 / 失败暂停」五项，并修复进入页面时未加载真实限额的问题。
- 适配器新增 `catMode: indexed`，把 `categories[0]` 依次展开成 `categories[0..n]`。

## v0.7.472 · 2026-11-18

### 重放重置与调度/抓取日志
- 失败队列重放现在会清空 `stageAttempts`、`metaAttempts`、`dedupeAttempts` 及对应时间戳/错误码，重放后不再立刻判死信。
- 调度写日志：开始一轮、完成汇总（抓取站数/新增/失败/等待、初筛、终审 ready/hold）、阶段失败码。
- 抓取写日志：每站每页的成功结果（页号、条数、新增、详情进度）和失败码；不写 cookie/URL。
- 失败队列重放写日志。
- 补 failures 5/5、api-v2 35/35 回归。

## v0.7.471 · 2026-11-18

### 撤掉抓取总设置
- 移除流程页抓取卡的「抓取总设置」块（进度、增量抓取开关、抓一页）。
- 同步移除 `incrementalCrawl` 配置、crawl 游标分支、状态接口的 `catCount` 和对应检查。
- 保留 `/api/crawl/status` 补 `limits` 引用的修复，抓取计划的今日情况仍能显示。

## v0.7.470 · 2026-11-18

### 抓取总设置：增量抓取开关
- 流程页 ① 抓取卡新增「抓取总设置」：进度、增量抓取开关、抓一页。
- 增量抓取关（默认）：每轮从第 1 页开始，适合只追最新页。
- 增量抓取开：站点第一次抓取仍从第 1 页开始；之后接着上次页码和分类继续。
- 手动「抓一页」和自动跑共用同一套模式，站点页的「试抓一页」不受影响。
- 修复 `/api/crawl/status` 缺 `limits` 引用导致的 500，抓取计划的今日情况现在能正常读取。

## v0.7.469 · 2026-11-18

### 流程页加自动抓取总开关
- 新增「自动抓取」总开关（即调度开关）：真抓取没开时只提示，不会偷偷打开；关闭只停自动跑，不动真抓取。
- 「准备下一批」换成「跑一轮」：抓取 → 初筛 → 查重 → 终审，不含发布；toast 报抓取站数、新增条数、终审 ready/hold。
- 调度条去掉重复的「自动跑」「立即跑一次」，只留间隔、窗口、失败暂停；状态行显示上次和下一轮时间。
- 站点详情把「抓一页」从概览头部移到抓取参数区，改名「试抓一页」，标注为验证配置用。
- crawl 阶段补 `added` / `rows` 汇总，供页面提示使用；smoke 检查同步更新。

## v0.7.468 · 2026-11-18

### 修复站点包面板空白
- `SitePackPanel.vue` / `SiteCoveragePanel.vue` 的按钮和 `onMounted` 调用了不存在的 `load`，组件 setup 直接报错，弹窗只剩标题。
- 改为调用实际的 `loadPack` / `loadCoverage`；站点包和站点覆盖现在能正常渲染。
- 只改前端函数名，不动接口和数据。

## v0.7.467 · 2026-11-18

### Skills 质量升级
- `review`：审查前先复述意图；输出分阻塞/重要/建议/疑问/做得好/结论；有作者解释先认可。
- `security`：报告按 ID/级别/位置/影响/触发条件/修法/CWE 组织；先确认授权范围。
- `ui`：补 Vue 3 规则（script setup、computed 优先、props 不改、composable 清理），明确不要求 TS/Nuxt/Pinia。
- 只改 `.opencode/skills`，不动业务代码。

## v0.7.466 · 2026-11-18

### 引入 OpenCode 项目 skills
- `.opencode/skills/` 新增 10 个：review、build、debug、refactor、test、ui、site、db、security、ship。
- 默认按 description 自动匹配，也可用 `@review` 等显式加载；AGENTS.md 加速查一行。
- 不改运行时代码；版本号同步，质量审计通过。

## v0.7.465 · 2026-11-18

### 维护：CSS 重复规则试点合并
- `Crawl.css` 合并 `.rx-test .input`、`.drawers`、`.crawl-card .lbl` 三组同名规则，保持最终级联值。
- 1280/390 快照一致、全部页面构建检查通过；CSS 重复 85→82。
- 剩余重复多为响应式/后置覆盖，合并到 <20 才能提升简洁度，暂不继续。

## v0.7.464 · 2026-11-18

### 维护：消除重复函数名（完成）
- `load`/`ensure` 按页面改名（loadPack/loadSources/ensureQueue 等），补齐 hashchange 引用。
- 重复函数名 2→0；复用率 100 SSS，总体 99 SSS；全部页面构建检查通过。

## v0.7.463 · 2026-11-18

### 维护：消除重复函数名（第一批）
- `pct`→`percentOf`/`progressPct`、`tone`→`statusTone`/`loadTone`、`save`/`closeSheet`/`openAdd` 按领域改名。
- 重复函数名 7→2（只剩 load/ensure）；复用率 75→100 SSS，总体 97→99 SSS；Sites/Nodes 构建检查通过。

## v0.7.462 · 2026-11-18

### 质量评级改为 D → SSS
- 质量审计 7 档：D < 60、C 60–69、B 70–79、A 80–87、S 88–92、SS 93–96、SSS ≥97。
- `--fail` 只拦 D；`--strict` 拦 C/D；基线里的评级文字同步重算，分数不动。
- `QUALITY.md`、`AGENTS.md`、`GOALS.md` 的「差」表述同步为「D」。

## v0.7.461 · 2026-11-18

### G14：Python sidecar（mediainfo）
- 新增 `pta/server/sidecar.js`：任务白名单、stdin/stdout JSON、超时/大小限制，不监听端口、不共享数据库。
- 新增 `pta/sidecar/mediainfo.py`：stdlib 解析 MediaInfo/BDInfo 文本；`pta/scripts/sidecar.js` 提供 CLI。
- 新增 `sidecar` 检查 4/4 并进 run.sh；文档 `docs/SIDECAR.md`；G14 标记完成。
- 站点格式化共享后更新 UI 冻结基线；全量通过。

## v0.7.460 · 2026-11-18

### 维护：站点格式化共享
- `SiteDetail`/`SitesList` 的架构标签、时间格式、登录状态、模式文案抽到 `utils/siteFormat.js`。
- 重复函数名从 14 降到 7；Sites 页构建检查通过；质量审计 97/优质。

## v0.7.459 · 2026-11-18

### 维护：清理空 catch
- 26 个文件的空 catch 补上「忽略：失败不影响主流程」注释；行为不变。
- 质量审计的「空 catch」发现清零。

## v0.7.458 · 2026-11-18

### 维护：拆 target 检查（完成）
- 分类/私有包/探针检查组 → `checks/target-checks-catalog.js`；上传/计划/门禁/提交组 → `checks/target-checks-upload.js`。
- `checks/target.js` 947→141 行；target 29/29，检查项不变。

## v0.7.457 · 2026-11-18

### 维护：拆 target 检查（第 2 步）
- 删除/回收站/回查检查组移到 `checks/target-checks-verify.js`。
- `checks/target.js` 784→662 行；target 29/29。

## v0.7.456 · 2026-11-18

### 维护：拆 target 检查夹具（第 1 步）
- 种子构造器、infoHash、本地 mock 目标站移到 `checks/target-mock.js`。
- `checks/target.js` 947→784 行；target 29/29，检查项与行为不变。

## v0.7.455 · 2026-11-18

### G13 收尾：NO_FORM 归因
- 2 个 NO_FORM 站确认不是 cookie/JS/解析器问题：一个是账号等级不足，一个是仅候选流程。
- 结论写入私有 `data/probe-notes.md`；G13 标记完成（8 直接上传 + 2 候选流程 + 3 站真实）。
- 不做候选区提交适配，避免为两个站引入新的发布流程。

## v0.7.454 · 2026-11-18

### G12 第 2 切片：重启续跑验收
- 新增 `resume` 检查：两次独立 CLI 进程模拟重启，验证已发布条目不被重复提交、失败条目继续重试、队列条目不增不丢。
- G12 本地验收完成：CLI 全链路、重启续跑、失败重试、不重复提交；多站真实提交待权限。
- resume 1/1、cli 18/18、全量通过。

## v0.7.453 · 2026-11-18

### G12 第 1 切片：CLI 全链路
- 新增 `pta run --all`：一条命令跑抓取→初筛→查重→终审→发布→辅种→重试，本地/HTTP 都可用。
- 默认干跑，`--real` 才真抓/真发；部分失败 `partial=true` 且退出码 1，输出各阶段汇总。
- 修复 `scheduler-retry` 辅种跳过分支引用 `steps` 的问题；CLI 检查 18/18，全量通过。

## v0.7.452 · 2026-11-18

### G15 收尾与 G12 恢复
- G15 最终全量回归通过（质量 94/优质）；G12 状态从「暂停」改为「待继续」。
- 下一阶段：G12 全自动流水线。

## v0.7.451 · 2026-11-18

### G15 第 48 轮：调度限制即时夹取
- 调度条四个数字输入改为输入时即时夹取（8–600 / 1–1440 / 1–1000 / 1–10），min/max 与夹取共用一张范围表。
- 删除 Crawl.vue 中未使用的 `clampLimit`/`limitRanges`/`limitItems`；Crawl.vue 150→135 行。
- 快照一致，输入 9999→600、1→8，保存提示正常。

## v0.7.450 · 2026-11-18

### G15 验收例外确认
- 0.7.419 / 0.7.445 的历史合并提交标记为「已接受的流程例外」，不再列为未闭合项。
- G15 报告、GOALS、PROGRESS 同步措辞；功能与检查结果不变。

## v0.7.449 · 2026-11-18

### G15 第 47 轮：拆 imagehost 上传引擎
- Chevereto SSO/账号登录、网页上传、通用上传和批量 `process` 移到 `server/imagehost-upload.js`。
- imagehost.js 382→135 行；`process`/`replaceDescription`/`mirrorDescription` 导出不变，黑名单/缩略图/持久缓存不动。
- 补回 `siteCookie` 缺失的 `openDB` 引用（SSO 会话读取恢复正常）。
- imagehost 20/20、media 7/7、全量通过。

## v0.7.448 · 2026-11-18

### G15 第 46 轮：拆 target-service-common
- 源标题回填、权威种抓取、查重策略移到 `server/target-service-common.js`。
- target-service.js 302→212 行；target 29/29、publish 9/9、全量通过。

## v0.7.447 · 2026-11-18

### G15 第 45 轮：拆 target-pages
- 删除、详情信息/种子、上传页探测和种子元数据移到 `server/target-pages.js`。
- target.js 371→174 行；原导出不变；target 29/29、全量通过。

## v0.7.446 · 2026-11-18

### G15 检查隔离修复
- imagehost 检查使用独立临时 DATA，镜像缓存不再写入仓库 `data/seedpod.db`。
- 修复全量运行时缓存串扰导致的 5 个图床检查假失败。

## v0.7.445 · 2026-11-18

### G15 第 44 轮：规则共享源（B6 收口）
- 新增 `pta/web-src/shared/rule-registry.json`：18 条规则的 key/类型/默认值/读者 + 旧 key 映射，作为 UI 与服务端唯一来源。
- `server/rule-registry.js` 与 `data/rules.js` 都读共享 JSON；UI 只保留标签/选项，默认值由共享源覆盖。
- rules-registry 检查扩展为共享源/类型/默认值一致性（5/5）；audit-rules 与 gen-rules-tree 适配 ESM 导入。
- 快照组件 AE 对比前去掉 4px 边框，双构建前后对比通过。

## v0.7.444 · 2026-11-18

### G15 第 43 轮：确认像素闸门容差
- 用户确认接受 2% fuzz 闸门：组件 AE=0、整页 ≤100，附 RMSE ≤0.002 与 DOM 完全一致。
- 原始 AE=0 记录为本机 Chromium 不可达，不作为验收条件。

## v0.7.443 · 2026-11-18

### G15 第 42 轮：同进程双构建快照与 AE 实验
- 新增 `scripts/ui-snapshot-dual.js`：两个后端 + 两个 dist + 同一个 Chromium，原始 AE 对比。
- 实验：相同 dist 下 1280/full AE=34979、390/full AE=5459，确认 Chromium 抗锯齿噪声；裸 AE=0 不可达。
- 当前闸门保留 2% fuzz（组件 0、整页 ≤100），等待用户确认容差。
- 修复双构建工具退出时残留临时后端的问题。

## v0.7.442 · 2026-11-18

### G15 报告更新
- `G15-REPORT.md` 更新到第 41 轮：Crawl.vue 150 行、失败队列面板、启动/API composable。
- 未完成项收敛为：UI rules 未由注册表生成、0.7.419 历史合并提交。

## v0.7.441 · 2026-11-18

### G15 第 41 轮：Crawl 启动/API composable
- `patchUser`/`putFlow` 移到 `utils/api.js`；页面启动与 hashchange 补齐逻辑移到 `composables/useCrawlBoot.js`。
- Crawl.vue 173→150 行；1280/390 快照一致，切页回来仍能加载目标站与发布分组。

## v0.7.440 · 2026-11-18

### G15 第 40 轮：日志页失败队列面板
- 日志页新增只读失败队列小面板：id/阶段/错误码/重试次数/nextRetryAt/死信标记 + 单条重放。
- 默认最近 30 天/最多 1000 条，可在面板切换「只看死信」；不动流程页。
- 实测面板显示、重放成功、重放后移出列表；Crawl 页快照像素不变。

## v0.7.439 · 2026-11-18

### G15 报告更新
- `G15-REPORT.md` 更新到第 39 轮：保留策略与 AE 闸门已落地，剩余项重新收敛。

## v0.7.438 · 2026-11-18

### G15 第 39 轮：AE 像素闸门
- UI 对比新增 `compare -metric AE -fuzz 2%`：组件截图必须 0，整页 ≤100（滚动条/字体抗锯齿）。
- 截图注入固定 text-rendering 和隐藏滚动条；RMSE ≤0.002 与 DOM 完全一致仍然保留。
- 文档 `UI-SNAPSHOT.md` 记录闸门与噪声原因。

## v0.7.437 · 2026-11-18

### G15 第 38 轮：失败队列保留策略
- 视图级保留，不删队列数据：默认最近 30 天、最多 1000 条；有未来重试的条目保留。
- `/api/failures` 支持 `days`/`maxItems`，CLI 支持 `--days`/`--max`；返回 `retention`。
- failures 检查 4/4，API 34/34。

## v0.7.436 · 2026-11-18

### G15 报告更新
- `G15-REPORT.md` 更新到第 37 轮：Crawl.vue 173 行，六个 composable 已接。
- 未完成项收敛为：失败队列无页面板/保留策略、AE 严格对比、历史合并提交。

## v0.7.435 · 2026-11-18

### G15 第 37 轮：规则控件 composable
- `RuleOrSpecial` 渲染函数抽到 `composables/useRuleOrSpecial.js`。
- Crawl.vue 204→173 行；1280/390 快照一致，UI 基线已更新；规则测试按钮实测通过。

## v0.7.434 · 2026-11-18

### G15 第 36 轮：类型/筛选与准备 composable
- 类型/筛选保存、`prepareNext` 抽到 `composables/useCrawlFetchFilters.js`。
- Crawl.vue 257→204 行；1280/390 快照一致，UI 基线已更新；准备按钮实测通过。

## v0.7.433 · 2026-11-18

### G15 报告更新
- `G15-REPORT.md` 更新到第 35 轮：Crawl.vue 257 行，四个 composable 已接。
- 未完成项收敛为：类型/筛选/prepareNext/RuleOrSpecial 仍在页面内。

## v0.7.432 · 2026-11-18

### G15 第 35 轮：站点选择 composable
- 站点列表、来源站、目标站过滤与选择抽到 `composables/useCrawlSites.js`。
- Crawl.vue 299→257 行；1280/390 快照一致，UI 基线已更新；站点选择/目标站弹窗实测通过。

## v0.7.431 · 2026-11-18

### G15 第 34 轮：流程规则 composable
- 流程规则加载/保存、旧下拉值迁移、详情开关抽到 `composables/useCrawlFlow.js`。
- Crawl.vue 398→299 行；1280/390 快照一致，UI 基线已更新；保存交互实测通过。

## v0.7.430 · 2026-11-18

### G15 第 33 轮：调度/限制/闸门 composable
- 调度条、请求限制、发布闸门的状态与请求逻辑抽到 `composables/useCrawlScheduler.js`。
- Crawl.vue 474→398 行；1280/390 快照一致，UI 基线已更新；调度开关实测可开可关。

## v0.7.429 · 2026-11-18

### G15 报告更新
- `G15-REPORT.md` 更新到第 32 轮：scheduler.js 162 行、阶段全部模块化、useCrawlPlan、flow/scheduler 迁移。
- 未完成项收敛为：其余页面状态未抽 composable、失败队列无页面板、UI rules 未由注册表生成。

## v0.7.428 · 2026-11-18

### G15 第 32 轮：flow/scheduler 配置迁移
- `config-schema.js` 增加 `migrateFlow` / `migrateScheduler` / `ensureAll`；启动时三份 JSON 一起升级。
- `PUT /api/flow` 写回带 `schemaVersion`；旧配置值不丢、未来版本不降级。
- config-migration 7/7；备份恢复 4/4。

## v0.7.427 · 2026-11-18

### G15 第 31 轮：Crawl 计划 composable
- 抓取计划状态与请求抽到 `composables/useCrawlPlan.js`，页面只负责组装。
- Crawl.vue 497→474 行；1280/390 快照一致，UI 基线已更新；看地址交互实测通过。

## v0.7.426 · 2026-11-18

### G15 第 30 轮：拆 scheduler-review
- 终审阶段（补齐/查缺/ready-hold 判定）移到 `server/scheduler-review.js`。
- crawl/screen/dedupe/review/publish/crossseed/retry 全部成模块；scheduler.js 265→162 行；scheduler 6/6。

## v0.7.425 · 2026-11-18

### G15 第 29 轮：拆 scheduler-dedupe
- 查重阶段（逐目标站检查、dupeResults、失败重试字段）移到 `server/scheduler-dedupe.js`。
- scheduler.js 317→265 行；scheduler 6/6、failpoint 1/1。

## v0.7.424 · 2026-11-18

### G15 第 28 轮：拆 scheduler-screen
- 初筛阶段与 screen hooks 移到 `server/scheduler-screen.js`。
- scheduler.js 318→317 行；scheduler 6/6。

## v0.7.423 · 2026-11-18

### G15 第 27 轮：拆 scheduler-crawl
- 抓取阶段（站点轮转/间隔/失败计数）移到 `server/scheduler-crawl.js`。
- runNow 继续负责 failpoint、阶段 catch、hooks 和汇总；scheduler.js 350→318 行，scheduler 6/6。

## v0.7.422 · 2026-11-18

### G15 收尾
- 新增 `pta/docs/G15-REPORT.md`：5 个文件行数、失败队列/故障注入证据、未完成项。
- rules-registry 增加「注册表 key 与 UI rules.js 对齐」检查（5/5）。
- 最终全量检查通过，质量审计 94/优质。

## v0.7.421 · 2026-11-18

### G15 第 25 轮：meta 配置迁移（B7）
- 新增 `server/config-schema.js`：schemaVersion、v0→v1 迁移、启动自动升级、写回前迁移。
- 旧布尔值/大小写归一，未知字段保留；未来版本不降级。
- 新增 `config-migration` 检查 5/5；备份恢复 4/4。

## v0.7.420 · 2026-11-18

### G15 第 24 轮：规则注册表（B6）
- 新增 `server/rule-registry.js`：18 条规则的 key/类型/默认值/读者集中登记，带旧 key 映射。
- `flow-config` 读取时统一 normalize；旧 flow 配置不清库也能读。
- 新增 `rules-registry` 检查 4/4，并进 `pta/checks/run.sh`。

## v0.7.419 · 2026-11-18

### G15 第 21–23 轮：拆 scheduler（A5 达标）
- 发布阶段移到 `server/scheduler-publish.js`；辅种/失败重试移到 `server/scheduler-retry.js`；状态与站点失败计数移到 `server/scheduler-state.js`。
- runNow 保留阶段级 try/catch、failpoint 和结果汇总；scheduler.js 559→350 行（目标 ≤350 达成）。
- 5 个大文件行数目标全部达成；scheduler 6/6、failpoint 1/1。

## v0.7.418 · 2026-11-18

### G15 第 20 轮：拆 imagehost-config（A4 达标）
- provider 归一化、环境变量读取和上传端点移到 `server/imagehost-config.js`。
- imagehost.js 448→382 行（目标 ≤400 达成），imagehost 检查 20/20。

## v0.7.417 · 2026-11-18

### G15 第 19 轮：拆 imagehost-source
- 图源解析、缩略图还原、简介替换和镜像缓存移到 `server/imagehost-source.js`。
- 黑名单与持久缓存语义不变；imagehost.js 612→448 行，imagehost 检查 20/20。

## v0.7.416 · 2026-11-18

### G15 第 18 轮：拆 target-upload（A3 达标）
- 单站上传编排移到 `server/target-upload.js`，查重开关语义抽到 `server/target-rules.js`。
- 原导出不变；target-service.js 590→302 行（目标 ≤400 达成），target 29/29、publish 9/9。

## v0.7.415 · 2026-11-18

### G15 第 17 轮：拆 target-submit（A2 达标）
- 取种、提交、发布后回查移到 `server/target-submit.js`。
- 原导出不变；target.js 569→371 行（目标 ≤450 达成），target 检查 29/29。

## v0.7.414 · 2026-11-18

### G15 第 16 轮：拆 target-plan
- 标签、模板变量和上传计划移到 `server/target-plan.js`，通过工厂注入 resolve/ctx/one。
- 原导出不变；target.js 742→569 行，target 检查 29/29。

## v0.7.413 · 2026-11-18

### G15 第 15 轮：拆 target-discovery
- announce/passkey 发现、缓存种子候选和上传页扫描移到 `server/target-discovery.js`。
- 原导出不变；target.js 854→742 行，target 检查 29/29。

## v0.7.412 · 2026-11-18

### G15 第 14 轮：拆 target-html
- `target.js` 的 HTML/文本解析、模板字段、删除表单和下载链接解析移到 `server/target-html.js`。
- 原导出与 require 路径不变；target.js 977→854 行，target 检查 29/29。

## v0.7.411 · 2026-11-18

### G15 第 13 轮：拆 SiteMapModal（A1 达标）
- 站点映射弹窗拆成 `components/SiteMapModal.vue`，状态与接口调用随组件迁移。
- `getJson` 抽到 `utils/api.js`，Crawl 与服务端请求共用。
- Crawl.vue 579→497 行（目标 ≤500 达成）；1280/390 快照 RMSE/DOM/尺寸一致，UI 基线已更新。

## v0.7.410 · 2026-11-18

### G15 第 12 轮：页面样式外置
- Crawl 页 scoped 样式移到 `views/Crawl.css`，通过 `<style scoped src>` 引入。
- Crawl.vue 735→579 行；1280/390 快照 RMSE/DOM/尺寸一致，UI 基线已更新。

## v0.7.409 · 2026-11-18

### G15 第 11 轮：拆 PublishCard
- 发布卡从 Crawl.vue 拆到 `components/PublishCard.vue`，props/emits 保持原有行为。
- 发布卡与 flow-group 样式随组件迁移，保持原有级联顺序。
- Crawl.vue 942→735 行；1280/390 快照 RMSE/DOM/尺寸一致，UI 基线已更新。

## v0.7.408 · 2026-11-18

### G15 第 10 轮：拆 ScreenDedupeCard
- 初筛与查重卡从 Crawl.vue 拆到 `components/ScreenDedupeCard.vue`，props/emits 保持原有行为。
- 子组件内补齐原计算样式（字段/标签/开关/芯片/测试行），保持像素级一致。
- Crawl.vue 976→942 行；1280/390 快照 RMSE/DOM/尺寸一致，UI 基线已更新。

## v0.7.407 · 2026-11-18

### G15 第 9 轮：拆 CrawlCard
- 抓取卡从 Crawl.vue 拆到 `components/CrawlCard.vue`，props/emits 保持原有行为。
- 抓取计划相关样式随组件迁移；Crawl.vue 1036→976 行。
- 1280/390 快照 RMSE/DOM/尺寸一致，UI 基线已更新。

## v0.7.406 · 2026-11-18

### G15 第 8 轮：拆 TargetPickerModal
- 目标站选择弹窗从 Crawl.vue 拆到 `components/TargetPickerModal.vue`，props/emits 保持原有行为。
- 补回被误删的 `#crawl-panel { display: contents }`，修复调度条/卡片 12–24px 垂直偏移。
- Crawl.vue 1079→1036 行；1280/390 快照 RMSE/DOM/尺寸一致，UI 基线已更新。

## v0.7.405 · 2026-11-18

### G15 第 7 轮：拆 SchedulerBar
- 调度条拆到 `components/SchedulerBar.vue`，props/emits 保持行为不变。
- Crawl.vue 1106→1079 行；快照工具补目标站加载等待；1280/390 快照一致。

## v0.7.404 · 2026-11-18

### G15 第 6 轮：拆 FlowGates
- 发布闸门从 Crawl.vue 拆到 `components/FlowGates.vue`，props/emits 保持原有行为。
- Crawl.vue 1130→1106 行；1280/390 快照 RMSE/DOM/尺寸一致，UI 基线已更新。

## v0.7.403 · 2026-11-18

### G15 第 5 轮：故障注入
- 新增 `fault-injection` 检查：429、500、断连、半成功响应、超时全部本地 mock。
- 验证失败队列死信、nextRetryAt 保留、单条重放；6/6 通过。

## v0.7.402 · 2026-11-18

### G15 第 4 轮：多步写库事务
- 新增 `tx(db, fn)` 同步事务封装，抛错整体回滚。
- `screen` 建队列 + 词条标 selected 收进事务；`publish` 写队列 + published + 词条标 published 收进事务。
- `transactions` 检查 2/2；备份恢复 4/4。

## v0.7.401 · 2026-11-18

### G15 第 3 轮：失败队列与重放
- 新增 `/api/failures`（分页/死信）和 `/api/failures/:id/replay`，已提交条目拒绝重放。
- 新增 `pta/scripts/failures.js`；失败队列覆盖阶段失败、目标站失败、查重/补齐重试。
- 重放清 nextRetry/error、重置 retries，保留 targetResults；failures 检查 3/3、API 34/34。

## v0.7.400 · 2026-11-18

### G15 第 2 轮：错误码与失败统计
- 新增 `pta/server/errors.js`：统一 code/stage/level/retryable，旧字符串码映射。
- 新增 `/api/errors` 与 `pta/scripts/error-stats.js`，按 code/stage 统计 scheduler、queue、targetResults 失败。
- 调度 `phaseError` 统一走注册表；新增 `errors` 检查 2/2、API 检查 33/33。

## v0.7.399 · 2026-11-18

### G15 第 1 轮：调度阶段级失败隔离
- crawl/screen/dedupe/review/publish/crossseed/retry 各自 try/catch；单阶段失败不再拖死整轮。
- `steps.errors` 记录 phase/code/message；接口返回 `partial`；通知带首个 phase/code。
- DB/SQLITE/约束类错误仍中止本轮，不拿坏状态继续。
- 新增 `SEEDPOD_FAIL_STEP`（仅 `NODE_ENV=test`）+ `failpoint` 检查 1/1。

## v0.7.398 · 2026-11-18

### G15 第 0 轮：UI 快照与数据护栏
- 新增 `pta/scripts/ui-snapshot.js`：固定临时数据，1280/390 截整页、卡片、目标站弹窗，RMSE + DOM 文本/尺寸对比。
- 新增 `pta/docs/UI-SNAPSHOT.md`；快照只写 /tmp。
- 修复 390 宽度下调度条横向溢出。
- 备份恢复演练：`integrity ok`，catalog 579 / sites 306 / downloaders 2。

## v0.7.397 · 2026-11-17

### 流程页最终效果冻结
- 把初筛与查重两列、发布五列、下载器紧凑行、站名文字链接写进 smoke-live 固定断言。
- UI 基线已保存当前 Crawl/Nodes 文件；后续任何流程页 UI 改动都会先被冻结检查拦住。

## v0.7.396 · 2026-11-17

### 移除下载器卡多余横线
- 去掉下载器标题下方那条分隔线。

## v0.7.395 · 2026-11-17

### 下载器行紧凑
- 下载器行改成 5 列紧凑网格，名字/地址单行省略，容量条限宽。
- 修复长 URL 名字压到 host/容量列的重叠。

## v0.7.394 · 2026-11-17

### 发布站名链接生效
- 站名下划线和“更改”文字按钮用 `:deep` 覆盖子组件样式，去掉按钮外框。

## v0.7.393 · 2026-11-17

### 初筛行紧凑与目标站超链接
- 初筛芯片行去掉上下大留白，芯片高度压到 26px，行距收紧。
- 发布站控件改成文字：站点名带下划线像链接，旁边“更改”是文字按钮；不再有头像/外框/更换方块。

## v0.7.392 · 2026-11-17

### 初筛查重列内靠左
- 初筛的芯片/输入框和查重的开关都紧跟行名左对齐，不再被拉到列最右边。

## v0.7.391 · 2026-11-17

### 初筛查重两列生效
- 修正合并卡被全局 drawer/set-field 样式覆盖的问题，桌面强制两列、窄屏单列。

## v0.7.390 · 2026-11-17

### 初筛与查重合并成一张卡
- ② 初筛和 ③ 查重合并成“② 初筛与查重”，左列初筛、右列查重，字段纵向排列。
- 一个保存按钮同时保存初筛正则、查重开关和自动查重。
- 800px 以下自动改成单列。

## v0.7.389 · 2026-11-17

### 流程页布局冻结
- 查重卡单行 8/20 间距、发布卡五列、目标站无外框，全部写进 UI 基线和 smoke-live 断言。
- 以后改坏发布卡列数、分组数或查重卡间距，检查会直接失败；要改先确认再更新基线。

## v0.7.388 · 2026-11-17

### 更换按钮作用域
- 目标站“更换”按钮用 `:deep` 覆盖子组件样式，五列里保持单行。

## v0.7.387 · 2026-11-17

### 五列里的更换按钮
- 目标站“更换”按钮固定 48px 宽、强制单行，不再在窄列里竖排。

## v0.7.386 · 2026-11-17

### 发布卡五列生效
- 修正发布卡内容区被全局 drawer 样式覆盖的问题，强制五列网格。

## v0.7.385 · 2026-11-17

### 发布卡改成五列
- ④–⑧ 五个分组改成五列并排，每组标题在上、控件纵向排列。
- 1200px 以下自动降为三列，800px 两列，600px 一列。

## v0.7.384 · 2026-11-17

### 失败与通知同一行
- 发布卡“图片上传重试”和“连续失败几次暂停该站”缩到同一行。

## v0.7.383 · 2026-11-17

### 去掉查重卡的手动筛选按钮
- 删除“按条件筛选”：它只是手动跑一次初筛进队列，调度每轮本来就会自动跑，容易让人误以为查重要手点。
- 初筛仍由调度自动执行；手动需要时用“准备下一批”。

## v0.7.382 · 2026-11-17

### 发布卡改成设置表
- 每个分组改成“左侧组名 + 右侧一行控件”，行间细线分隔，不再每组标题占一整行。
- 内容区最大宽度 1000px 居中，避免一行控件横跨整张卡显得空。

## v0.7.381 · 2026-11-17

### 发布目标站按钮
- 手机端“更换”按钮保持单行，不再拆成两个字上下排。

## v0.7.380 · 2026-11-17

### 发布卡手机间距
- 手机端并排行不再强制逐条竖排，开关按内容自动横排换行；输入框和源资源标题仍占整行。

## v0.7.379 · 2026-11-17

### 发布卡间距对齐查重卡
- 并排行改成左对齐，间距用查重卡的 `8px 20px`，不再被 `space-between` 拉散。
- 目标站控件单独按内容宽度占位，避免和后面开关重叠。

## v0.7.378 · 2026-11-17

### 发布目标站控件轻量化
- 发布卡的“发布到哪个站”去掉外框，改成行内的站点名 + 更换按钮，和同排开关更统一。

## v0.7.377 · 2026-11-17

### 发布卡标签不竖排
- 发布卡并排行里的“发布到哪个站”“图片上传重试”等标签强制单行，不再一字一行。
- 输入框与目标站名片保持在同一行，窄屏仍自动换行。

## v0.7.376 · 2026-11-17

### 发布卡 ⑤–⑧ 并成一行
- 终审、发布、发完、失败与通知的开关/输入框按组并成一行；窄屏自动换行。
- “发布到哪个站”嵌进同一行，保留站点名片和更换按钮。
- 发布字段不再要求左右两列网格，烟测改为“同一行 flex + 至少 5 项”。

## v0.7.375 · 2026-11-17

### 发布卡去掉重复的源资源标题按钮
- 发布卡只保留“标题”开关：开=抓取到的种子词条标题原样回填；关=标题不齐转待审。
- “源资源标题”按钮只是跳去待审核手动回填源种 .torrent 名，和标题开关语义重叠，从发布卡移除；待审核页的“回填源标题”保留。

## v0.7.374 · 2026-11-17

### 豆影命令行核对
- 新增 `pta/scripts/fetch-douying.js`，可按 IMDb/豆瓣 ID 或片名直接取豆影数据，`--raw` 输出原 BBCode。
- 文档记录：豆影网页结果由 `api.php` 动态返回，保存的 HTML 只有空壳。

## v0.7.373 · 2026-11-17

### 发布卡开关并排
- 发布卡“补齐与准备”“终审与决策”“发完”的开关按组并排，不再一条一行。
- 源资源标题按钮挪到开关组末尾。

## v0.7.372 · 2026-11-17

### 发布卡与终审开关
- 发布卡新增“标题”开关：开=种子词条标题原样回填；关=标题不齐转待审。
- “副标题”开关：开=豆影数据拼贴 `影片名 | 地区+原盘 | 导演 | 主演 | [音频] [字幕]`；原盘才加地区，主演优先中文且取 3 个；关=转待审。
- “简介”开关：开=始终从豆影拉简介，覆盖源简介里的电影简介段，保留 hide/quote 技术块和全部截图；关=不联网。
- “简介图片存图床”改为开关：开=全部转存图床；关=保留源图不转存。
- 删除“简介主演数量”；简介按豆影返回原样回填。
- 终审改为开关：简介/副标题/BDInfo 不齐、截图未全部保留、年份晚超过 2 年都转待审；删除“不满足时”，固定不跳过。
- 豆影 `/api.php` 直接返回 BBCode 文本时也能解析；简介与副标题共用一次请求。

## v0.7.371 · 2026-11-17

### 查重卡内容上下居中
- 查重卡内容区改为纵向居中，左右/上下留白对称。

## v0.7.370 · 2026-11-17

### 查重卡并成一行
- “原盘判定关键词”的行名和输入框挪到“跳过禁转/限转处理”后面，桌面整行显示。
- 手机端输入行自动换到下一行，仍保持行名和输入框同一行。

## v0.7.369 · 2026-11-17

### 查重容差固定
- 手动查重的体积容差固定 2%，不再读取旧配置里已隐藏的“体积容差”值。
- 生产流程里的旧查重行清掉，按新开关默认值重建；原盘关键词保留。

## v0.7.368 · 2026-11-17

### 查重卡手机标签
- 手机端开关按两列排列，标签完整换行显示，不再截成“自动…”“跳过…”。
- 输入行继续保行名和输入框同一行。

## v0.7.367 · 2026-11-17

### 查重卡行向修正
- 开关行和输入行强制横排，不再被全局 `.set-field` 的竖排样式覆盖。
- 桌面和手机都保持“行名 + 控件”同一行，手机输入框自动收缩。

## v0.7.366 · 2026-11-17

### 查重卡手机端排版
- 原盘判定关键词在窄屏也保持“行名 + 输入框”同一行，输入框自动收缩，不再上下堆叠。

## v0.7.365 · 2026-11-17

### 查重卡收敛成开关
- 去掉“查重范围”分组；目标站始终搜索，体积容差默认 2%，不再给关闭查重的入口。
- “目标站已有完整蓝光镜像”改成“跳过已有原盘”开关；重复一律跳过，不再提供“标重复后仍收”。
- “目标站只有 DIY 原盘”改成“检测有DIY原盘仍可发”开关；“禁转/限转处理”改成“跳过禁转/限转处理”开关。
- 开关控件排一行，输入框和行名排一行；旧下拉值自动迁移成开关，服务端也兼容旧值。
- 新增 `dupe-policy` 检查 5 项；目标站上传、调度终审、手动查重都按新逻辑。

## v0.7.364 · 2026-11-17

### 初筛正则合并成一条
- 删除“只转命中这些词的”白名单行，只保留“命中这些词就不转”一条排除正则。
- 命中正则直接拒绝，不再进待审；旧配置里的 `rx.allow` 保存时自动清掉，服务端不再读取。
- 测试匹配只测这一条正则；初筛手风琴从 7 行减到 6 行。

## v0.7.363 · 2026-11-17

### 限制识别语义补充
- 整页都带 HR 图标不等于全站 HR：有的站第一页全是官方种，官方种全带 HR；下一页三方转载种可能没有。
- 过滤仍按每一行判断，不按页面比例推断站点政策。

## v0.7.362 · 2026-11-17

### 限制标签覆盖审计
- 批量扫 133 个保存的种子页：78 个能解析、28 个文件共 694 行带限制标签（禁转 293 / DIY 183 / HR 280 / 独占 108 / 限转 52）。
- 修三类误判：站内 `tag_exclusive` 字段名不再算“独占”；面板审计徽章“跳过: 禁转/独占”不计入站点标签；“全网独占”这类宣传语不再当标签。
- 彩色 span、`tag tag-dz` class 徽章、`hitandrun` 图标都纳入识别；通用兜底适配器也返回 `tags`。
- 新增 `pta/scripts/audit-sitecat.js` 和 `marks` 检查 11 项。

## v0.7.361 · 2026-11-17

### 限制标签按页面可见文字识别
- 不再扫 URL 参数：`tag_exclusive=yes` 这类站内字段名不等于“独占”，只认徽章上显示的字。
- NexusPHP 列表按整行 `<tr>` 取 `torrents-tag`；详情页取 `details-tag` 和 h1 里的 `[禁转]`，排除全站筛选标签。
- 实测列表 100 行：35 条禁转、1 条 DIY、0 条误判独占；详情标签与列表一致。
- `marks` 检查 9/9、适配器 26/26 通过。

## v0.7.360 · 2026-11-17

### 限制芯片逐项识别
- 禁转 / 限转 / HR / 独占 / DIY 统一从标题、列表行徽章（title/alt/class）和已抓详情 Tags 取标记。
- HR 只认 `[HR]`、`H&R`、`hit and run`、`hitandrun`，不再把 `HR-HDTV` 误判成 H&R。
- 新增 `marks` 检查 6 项；适配器夹具补行内标签，NexusPHP/UNIT3D/Gazelle 都解析 `tags`。
- 限制说明改为“认标题、列表徽章和已抓详情标签”，并记录覆盖边界：只在详情页标注且本轮没抓详情的条目看不到。

## v0.7.359 · 2026-11-17

### 图片缓存计数
- 镜像缓存命中计入 `skipped`，`total = uploaded + failed + skipped`，不再出现 4 张图对不上账。
- 实测新图真上传：2 张新图上传成功并回读 200；黑名单图从简介移除，`[img=300x200]` 尺寸标签保留。

## v0.7.358 · 2026-11-17

### 回收站重复识别与页脚计数
- 目标站同 infohash 被删进回收站时，回查识别 `deleted`，标 `TARGET_EXISTS` 跳过，不再拿旧种子辅种。
- UNIT3D 目标站 BDInfo/MediaInfo 字段名扩展：bdinfo / bd_info / disc_info / video_info / media_info / mi_info，站点包模板里带 `{bdinfo}`/`{mediainfo}` 也认。
- 开发页脚恢复页面数与接口数：页面固定 7，接口按实际注册的 `/api/` 路由统计。

## v0.7.357 · 2026-11-17

### 抓取卡新增“限制”芯片
- 优惠行下面新增限制行：禁转、限转、HR、独占、DIY。
- 选中即排除，在抓取入库前过滤；HR 只认标题/标签里标注的。
- 手机端队列详情改整页滚动，顶部查重卡不再被内部滚动卡住。

## v0.7.356 · 2026-11-17

### 详情接口补齐 BDInfo/MediaInfo
- fetchDetailsInfo 返回 bdinfo/mediainfo，终审才能把 Unit3D 独立面板带到目标站。
- Unit3D 下载路由兼容 /torrents/download/ID 与 /torrents/ID/download，404 时回详情页找真实链接。
- 实测 DarkLand 详情：BBCode 243 字、3 图、BDInfo 725 字；源种 0 做种者，无法下载发布。

## v0.7.355 · 2026-11-17

### 图片转存缓存
- 源图 URL → 图床 URL 持久化到 meta，同一张图跨条目只传一次。
- 避免 Chevereto 重复上传报错导致简介图片丢失；已转存过的直接复用。
- 全链路实测：发布/权威种/辅种成功，tracker working。

## v0.7.354 · 2026-11-17

### Unit3D 原始 BBCode 与独立 BDInfo/MediaInfo
- 直接解 Unit3D 复制按钮里的 `atob` 原始 BBCode，不再拿渲染 HTML 反推。
- 解析 `torrent-mediainfo-dump` / `torrent-bdinfo-dump` / `x-ref` 独立面板。
- 目标站有专用字段就填并去掉简介重复块；没有就补 `[hide=mediainfo]` / `[hide=bdinfo]`。
- `[comparison]` 里的裸图片 URL 也纳入转存，不只 `[img]`。
- 实测 u3d_detail_en.html：BBCode 7247 字、86 张图、MediaInfo 17057 字、BDInfo 0。

## v0.7.353 · 2026-11-17

### BDInfo/MediaInfo 专用字段
- 源详情里的 BDInfo/MediaInfo 单独字段会解析进条目；Unit3D 的 div/pre 也支持。
- 目标站有 bdinfo/bd_info/disc info/video info/media info 字段时自动填，并从简介里去掉重复的 `[hide=bdinfo]`/`[hide=mediainfo]`。
- 字段名不只认 bdinfo：bd_info、bd-info、disc info、video info、media_info 都认。
- `[hide=mediainfo]`/`[hide=bdinfo]` 改成小写还原，和源站一致。

## v0.7.352 · 2026-11-17

### 还原 hide=MediaInfo/BDInfo
- NexusPHP 的 codetop + hide/codemain 还原成 `[hide=MediaInfo]` / `[hide=BDInfo]`，不再降级成 `[code]`。
- 源简介里的 MediaInfo/BDInfo 隐藏块原样进目标站简介，不再被拍平或重复追加。
- adapter 夹具 25/25；实测猫站详情：hideMedia=true、code=0、quote=1、5 张图。

## v0.7.351 · 2026-11-17

### 修 MediaInfo 重复与上传详情取错
- 源简介已含 MediaInfo/General Information/BDInfo 时不再自动追加 MediaInfo。
- 上传响应优先取带 `uploaded=1` 的详情链接，避免抓到侧栏其它种子。
- 图片转存后如果描述已变，强制重建上传计划，避免用旧简介发出去。
- target 夹具 25/25。

## v0.7.350 · 2026-11-17

### 选择主站列出全部已添加站点
- 目标站弹窗不再按 cookie/启用/自检过滤，列出站点列表里的全部站。
- 有启用/自检的站排在前面；发布时再校验 cookie 和上传配置。
- 默认目标站以配置为准，旧的 localStorage 不再覆盖。

## v0.7.349 · 2026-11-17

### 修复选择主站弹窗为空
- 目标站列表改用 `/api/targets`（有 cookie、上传配置完整的站），不再依赖“站点启用 + 自检通过”。
- 默认目标站即使处于停用状态也保留；清掉失效的本地 targetHost。
- 先加载站点再读配置，避免旧 localStorage 把默认目标站顶掉。

## v0.7.348 · 2026-11-17

### 图片只换地址，标签原样保留
- 不再专门解析/重建 `[img=300x300]`；只提取图片 URL，换成原图地址。
- `[img=...]`、`[url=...]`、`[center]` 等 BBCode 标签保持原样。
- 图床页面/缩略图解析原图的逻辑不变，黑名单过滤不变。

## v0.7.347 · 2026-11-17

### 图床页面与缩略图适配
- 支持 `[img=300x300]`，回填时保留尺寸。
- 图床页面自动解析 `og:image` 拿原图直链；ibb/imgur/imgbox/postimages/pixhost/sm.ms 等页面都走这套。
- 缩略图优先从 `[url=图床页面]` 或缩略图规则还原原图，不转缩略图。
- 猫站图床黑名单最终简介里不保留：能转存猫站图床就换，失败删图。
- `[url=图床页面][img]…[/img][/url]` 的链接和图片一起替换。
- 实测 `https://ibb.co/6Jsd6P6c` → 原图 `https://i.ibb.co/dJKhn2ns/...png`；imagehost 19/19。

## v0.7.346 · 2026-11-17

### 单张图片也不限大小
- 移除单张 8MB 上限，图床能收多大就传多大。
- 只保留空文件、内网地址检查；失败仍保留外链。
- imagehost 夹具补 9MB 图片转存，15/15。

## v0.7.345 · 2026-11-17

### 简介图片不限张数
- 取消最多 8 张、总量 40MB 的限制，BBCode 里有多少张就转多少张。
- 保留单张 8MB 上限和内外网地址检查；失败仍保留外链。
- imagehost 夹具补 10 张全转用例，14/14。

## v0.7.344 · 2026-11-17

### 简介 BBCode 完整提取
- 修 kdescr 被第一个 </div> 截断：改成平衡 div 提取，mediaInfo/引用/图片不再丢。
- HTML 转 BBCode 保留 [quote]、[code]、[img] 结构；简介上限提到 60000 字。
- 初筛/终审把 descrBb 同步到 intro，待审核页简介框显示完整 BBCode。
- 实测猫站详情：454 字 → 2920 字，含 quote/code/mediaInfo/2 张图。

## v0.7.343 · 2026-11-17

### 发布阶段补禁转拦截
- 源种标题/标记含禁转、限转未满 7 天时，目标站上传前直接拒绝（RESTRICTED_SOURCE）。
- 防止手工条目绕过初筛/终审把禁转种发出去；target 夹具 25/25。

## v0.7.342 · 2026-11-17

### 图床支持 Chevereto 网页登录
- `IMAGE_HOST_PROVIDER=chevereto` + `IMAGE_HOST_URL=https://s3.pterclub.net`。
- 优先用猫站 cookie 走 `/connect/goauth` SSO，不需要 API key；会话缓存，失效自动重登。
- 没有猫站 cookie 时可用 `IMAGE_HOST_USER` / `IMAGE_HOST_PASS` 走网页登录。
- 上传走 `/json` 的 `action=upload` + `source`，兼容原 API key 模式。
- 实测：SSO 登录成功、320x240 测试图上传成功；imagehost 夹具 13/13。

## v0.7.341 · 2026-11-17

### 环境变量全面去项目前缀
- 面板：`PANEL_USER` / `PANEL_PASS` / `PANEL_PORT`；数据 `DATA_DIR` / `WEB_DIR`。
- 密钥：`SECRET` / `SECRET_FILE` / `SITE_PACK_KEY` / `SITE_PACK_FILE`。
- 图床：`IMAGE_HOST_URL` / `FIELD` / `TOKEN` / `HEADERS`；媒体 `MEDIA_ROOT`。
- 外部触发 `HOOK_TOKEN`；开关 `ALLOW_REAL` / `COOKIE_SECURE`。
- 元数据：`WIKI_API` / `TMDB_API` / `DOUBAN_API` / `DOUYING_API` / `META_CACHE` / `META_MIN_GAP`。
- CLI：`PANEL_URL` / `PANEL_COOKIE` / `ENV_FILE`；Docker/文档同步。
- 旧 `PTA_*` 全部保留兜底，现有部署不用改；新增 env-names 夹具。

## v0.7.340 · 2026-11-17

### 参数改直白名字
- 请求节奏改用不带项目名的名字：`SEARCH_WAIT_SEC`、`UPLOAD_WAIT_SEC`、`WAIT_RANDOM_PERCENT`。
- 抓取日限改用 `CRAWL_DAILY_MAX`。
- 旧 `PTA_REQ_*` / `PTA_DAILY_MAX` 保留兼容，现有部署不用改。

## v0.7.339 · 2026-11-17

### 请求间隔按 cross-seed 基线
- 搜索/详情 30 秒一个，上传/回查/权威种/删除 10 秒一个，单队列串行。
- 参考 cross-seed 的 `delay`（默认 30 秒，最小 30 秒）；不再用 8 秒。
- 不加次数上限；多目标只会排队更久。

## v0.7.338 · 2026-11-17

### 去掉查重每轮 10 条的限制
- 查重按调度批次走，不再额外卡 10 条；请求仍由单队列串行 + 8 秒间隔控制。

## v0.7.337 · 2026-11-17

### 目标站请求改成单队列串行
- 所有目标站共用一个请求队列，一次只发一个，默认间隔 8 秒（±20% 抖动）。
- 不设次数上限；单目标、多目标都串行，站多只是排队更久。
- 查重、详情、上传、回查、权威种、删除全部走同一队列。
- 新增 request-queue 夹具，3/3。

## v0.7.336 · 2026-11-17

### 查重改成平滑限速，不再窗口内突发
- 每站 1 次/分钟（±20% 抖动），每小时最多 30 次；全局 1 次/20 秒，每小时最多 60 次。
- 不再允许“10 次/10 分钟”这种 1 分钟内连打 10 次的形态。
- 目标站所有请求间隔从 7 秒拉到 15 秒（±20% 抖动）。
- 参考：通用爬虫 10 次/分钟、PT 工具 1–5 秒间隔；搜索取更慢的人类节奏。

## v0.7.335 · 2026-11-17

### 查重改为时间窗限速
- 不再用日额度：每站 10 分钟内最多 10 次、最小间隔 6 秒；全局 10 分钟最多 30 次。
- 多目标按站各算窗口，同时受全局窗口约束，请求不会翻倍打爆。
- 触发时 `dedupe.rateLimited=true` 并给 `retryAfterMs`；终审卡「查重未完成」，发布前复核拒绝。
- 参考通用爬虫 10 次/分钟、PT 工具 1–5 秒间隔，取更保守的 10 次/10 分钟。
- 新增 dedupe-rate 夹具，3/3。

## v0.7.334 · 2026-11-17

### 查重全局预算
- 所有目标站共用每天 200 次查重额度，每轮最多 12 次；多目标按站累加。
- 额度用完查重停止，终审记「查重未完成」，发布前复核也会拒绝，不会绕过查重。
- 每站 200 次/天兜底保留；`PTA_DEDUPE_DAILY_MAX` / `PTA_DEDUPE_ROUND_MAX` 可调。
- 新增 dedupe-budget 夹具，3/3。

## v0.7.333 · 2026-11-17

### 目标站请求节流
- 同一目标站所有请求共用 7 秒间隔：查重、详情、上传、回查、权威种、删除。
- 查重每轮最多 10 条；每条每站 1 次搜索，命中才多 1 次详情。
- 每站每天默认 200 次上限；`PTA_TARGET_GAP_MS` / `PTA_TARGET_DAILY_MAX` 可调。
- 权威种子下载拆成“详情一次间隔、种子一次间隔”。

## v0.7.332 · 2026-11-17

### 术语修正：没有“辅种模式”
- 转载流程就是：源种下完 → 传目标站 → 抓目标权威种辅种。
- 代码注释、检查名、HANDOFF、PIPELINE 统一改成“转载流程”，不再叫“辅种模式”。

## v0.7.331 · 2026-11-17

### 查重关闭时如实显示
- 流程页关着「目标站搜索」时，查重阶段返回 disabled=true，不再伪装成“查过且通过”。

## v0.7.330 · 2026-11-16

### 转载流程：源种下完才发布
- 发布阶段先调 ensureSource：源种加进 qB 并检查进度。
- 源种没到 100% 就 held，不传目标站、不注入，下一轮再看；不会先发后补。
- 源种下载/添加失败单独计数，不计站点熔断。
- publish 夹具补“源种进度 0 拦住发布”，9/9。

## v0.7.329 · 2026-11-16

### 辅种落库与续种
- crossseed 不再依赖未挂载的 ctx.targetService，失败/成功都自己写回队列。
- 目标种加进 qB 后显式 resume，避免被队列上限停在 stopped 状态导致 tracker 不工作。
- 修完可以用真实 135/151MB 源种验证「源数据完整 + 目标种进度 1 + tracker working」。

## v0.7.328 · 2026-11-16

### qB 重加不再判失败
- 发布时 qB 回 Fails.（同 hash 已存在）会先回查，存在就当成功，避免重复注入被判失败。
- 辅种同样处理：目标种已在 qB 里就直接进入进度/tracker 校验。
- publish 夹具改成“添加前列表为空”，覆盖重复添加场景，8/8。

## v0.7.327 · 2026-11-16

### 上传回查容忍索引延迟 + 分类去空格
- 提交后回查改成「详情页 → 搜索」最多 3 次、每次间隔 3 秒；索引慢不再直接判失败。
- 回查失败但已有详情地址的，重试时先回查确认，确认存在就不重复上传。
- 分类标签去汉字间空格再匹配（「电 影」「综 艺」「其 它」），BDMV/DVDISO 归原盘。
- qb 模块补 listTorrents，便于状态排查。

## v0.7.326 · 2026-11-16

### 源站 BBCode 图片转存图床
- 上传前扫描简介里的 [img]http(s)://…[/img]，逐张下载后转存图床并替换链接。
- 最多 8 张、单张 8MB、总量 40MB；内网/跳转内网地址拒绝；失败保留外链不阻断发布。
- 已转存过的地址记在 imageMirror.map，重试不重复下载上传。
- 图床未配置或 realImages 关闭时保持外链；imagehost 夹具补 3 项（10/10）。

## v0.7.325 · 2026-11-16

### 地区优先读源站简介字段
- 从 BBCode 的「制 片 / 产 地 / 语 言」字段判地区，韩国片不再默认大陆。
- 欧洲国家归「欧美」，中文区/日韩/印度各自对应；夹具补三条用例。

## v0.7.324 · 2026-11-16

### 初筛把源站详情地址带进队列
- 队列条目补 detailsUrl；终审缺 BBCode 时才有地址回源站详情页取。
- 之前队列里没有详情地址，回源取简介永远不会触发。

## v0.7.323 · 2026-11-16

### 简介优先用源站详情页 BBCode
- 队列条目单独保存 descrBb（源站详情页 BBCode 原文），发布字段优先用它，不再拿电影站简介顶替。
- 终审发现缺源站 BBCode 时回源站详情页取，每轮最多 2 条、间隔 6 秒；源站没有才联网补电影简介。
- 抓详情页默认打开；详情请求间隔改为 6–10 秒，不再被列表页的 60 秒间隔拖死。
- meta 检查补“源站 BBCode 不被电影简介覆盖”用例。

## v0.7.322 · 2026-11-16

### 辅种失败会记录并自动重试
- 辅种失败不再静默：源种没进 qB、源数据没下完、tracker 没起来都写进 targetResults.crossseed（含 attempts / retryAt）。
- 调度新增辅种重试阶段：已发布条目按 retryAt 重试，每轮最多 10 个目标，成功自动清错误。
- 仍然坚持源数据完整才加目标种，不用 skip_checking 把缺文件的种标成完成。

## v0.7.321 · 2026-11-16

### 权威种子补抓
- 目标站已发布但权威种子保存失败时，发布阶段单独补抓一次再辅种，不重复上传。
- 已提交且回查成功的站不再重复上传。
- 修 /opt/seedpod/data/torrents 权限（root 0700 → seedpod 0700），服务能写权威种子。

## v0.7.320 · 2026-11-16

### 修发布取种 guard 的同类作用域错误
- fetchSourceTorrent 里判断来源站停用也用了不存在的 jparse，真发布直接 UPLOAD_EXCEPTION。
- 统一改成局部 JSON.parse；target.js 已无 jparse 引用。

## v0.7.319 · 2026-11-16

### 修目标站列表 500
- 上一版多目标过滤引用了 target 作用域里没有的 jparse，线上 /api/targets 直接 500。
- 改成局部 JSON.parse，并补一条“有站点记录时也要列出”的检查，23 项全过。

## v0.7.318 · 2026-11-16

### 多目标不再列停用站
- /api/targets 只返回启用中的站；默认目标站（targetHost）例外，用户明确选过就保留。
- 待审核页的多目标芯片不再出现一堆早已停用的站。

## v0.7.317 · 2026-11-16

### 发布阶段补上目标站上传
- 调度发布前先调用目标站上传，已传过的站跳过；上传成功后才注入下载器。
- 上传失败计入连续失败熔断，不会继续注入造成“只做种没发种”。
- 修了一个真实流程缺口：以前调度发布只往 qB 加种，目标站其实没传。

## v0.7.316 · 2026-11-16

### 停用站不再参与流水线
- 初筛遇到来源站已停用的词条直接标跳过（原因「来源站已停用」）。
- 发布取种前再查一次来源站状态，停用站不发请求。
- 抓取到的下载地址统一补成绝对地址，修 TORRENT_FETCH_FAILED「下载地址必须是 http/https」。

## v0.7.315 · 2026-11-16

### 目标站写法差异修正
- 地区选项兼容站点写法：Mainland→大陆、Western→欧美、HK/TW 等。
- 媒介选项兼容 BD Discs / UHD Discs / DVD Discs，1080p Blu-ray 不再被填成 UHD。
- 流程页关掉「目标站搜索」时，查重阶段直接跳过，不再请求目标站。
- target-defaults 夹具补站点写法用例，6 项全过。

## v0.7.314 · 2026-11-16

### 调度批量参数
- /api/scheduler/run 支持 batchLimit / screenLimit / publishLimit，默认值保持原样。
- 便于小批量真实验证，不会一次刷出几百条待审。

## v0.7.313 · 2026-11-16

### P2：统计总览 + 外部触发
- /api/stats/overview 换成真数据：发布总数/近 7/30 天、按站发布量、近 14 天曲线、失败原因前 8、站点启用/暂停/自检、今日抓取次数。
- 新增 POST /api/hooks/run：配 PTA_HOOK_TOKEN 后可用 token 触发调度，支持 steps 指定步骤；不配就关闭。
- api-v2 补统计字段和 token 鉴权两组检查，31 项全过。

## v0.7.312 · 2026-11-16

### 终审前自动补简介
- 简介补齐逻辑抽成 meta-fill，抓取和终审共用一套规则（realCrawl、允许联网、来源顺序）。
- 终审发现缺简介且规则要求时自动联网补，每轮最多 5 条，补到就落库再重算缺失项。

## v0.7.311 · 2026-11-16

### 调度可分步跑
- /api/scheduler/run 支持 body.steps 指定只跑抓取/初筛/查重/终审/发布，没选的步骤标记跳过。
- 方便单测、排障和断点重放，不用整轮全跑。

## v0.7.310 · 2026-11-16

### P1 可靠性一批
- 抓取站点轮转：优先级高的先跑，同优先级按上次抓取时间从早到晚；间隔没到的跳过，最多 10 站。
- 抓取/查重失败计入连续失败熔断；限速类错误（太频繁/窗口满/日限）不算失败。
- 发布并发可配（默认 1，最多 5），每轮仍最多 5 条。
- 查重结果按站缓存：本轮已查过且可发的，下一轮不再重复请求。
- 外部元数据加 6 小时缓存和同域名 800ms 礼貌间隔。

## v0.7.309 · 2026-11-16

### P0-5 必填默认值按源信息映射
- 详情页新增地区/语言解析，抓取时写入词条；初筛入队一并带过去。
- 地区下拉按源地区/语言对选项：美国→英美、粤语→香港、国语→大陆，不再永远取第一项。
- 媒介下拉按标题对选项：1080p Bluray→Blu-ray、2160p UHD→UltraHD、Remux→Remux。
- 认不出才退回站点默认值；新增 target-defaults 夹具 5 项。

## v0.7.308 · 2026-11-16

### 默认发布目标持久化
- 流程页选的目标站写进配置（targetHost），初筛入队时自动带 targetSite。
- 不再依赖浏览器 localStorage，换设备/换浏览器后新条目仍有目标站。
- 清理测试队列（120 条），词条状态回滚 new；api-v2 夹具补详情字段。

## v0.7.307 · 2026-11-16

### 初筛中字判定修正
- 「必须带中字」优先看详情解析出的 tags/副标题/简介；没有详情时不误杀，交给后续详情判断。
- 媒介预设仍只用于抓取筛选，不再作为初筛硬门槛（否则 330 条全被“原盘”刷掉）。

## v0.7.306 · 2026-11-16

### P0 四项一起修
- 查重匹配改用 match.compare：归一化标题、年份/分辨率/体积容差，不再只靠字符串包含。
- 上传计划校验下拉值：不在站点选项里的按标签纠正，纠不了留空并提示。
- 终审前自动回填源种标题（缓存源种优先，失败 1 小时内不重试）。
- 辅种后校验：进度 1 且有 tracker working 才算成功；否则下一轮重试。

## v0.7.305 · 2026-11-16

### 调度批量修复
- 修调度抓取站点过滤：以前读 data 里没有 host，导致永远 0 个站。
- checkDupe 真正导出给调度器。
- 查重按多目标逐站判断，跳过站点单独记录；发布时按站跳过，不再整条误跳。
- 重试发布成功后也自动辅种。

## v0.7.304 · 2026-11-16

### 查重阶段独立，排在初筛后
- 调度顺序改为 抓取 → 初筛 → **查重** → 补齐 → 终审 → 发布 → 辅种。
- 新增独立 checkDupe：命中即跳过，不再进入补齐/详情；通过后标记 dupePassedAt，发布时不再重复查。
- pipeline 增加 dedupe 阶段；scheduler 6/6、全量通过。

## v0.7.303 · 2026-11-16

### 文档补流程日志
- PROGRESS 补 v0.7.299–302 记录并更新日期。

## v0.7.302 · 2026-11-16

### 文档同步流程顺序
- DESIGN/PIPELINE/PROGRESS 统一为 ① 抓取 → ② 初筛 → ③ 查重。

## v0.7.301 · 2026-11-16

### 查重判定读目标详情页
- 命中后额外读一次目标详情页，把副标题/简介/标签/媒介并入判定文本（总长截 4000）。
- DIY 关键词扩：diy/DIY原盘/自译/自制字幕/修改菜单；禁转/限转同样从详情里找。
- 只有命中才多这一次请求，未命中不请求。

## v0.7.300 · 2026-11-16

### 初筛前移 + 查重介质判定
- 流程顺序改为 ① 抓取 → ② 初筛（本地）→ ③ 查重（目标站）；先本地排除，少发查重请求。
- 查重新增：原盘判定关键词（默认 原盘|Full Disc|BDMV|ISO）、禁转/限转处理（跳过/标复核/不检查）。
- 只有原盘命中才算「已有原盘」；Remux、DIY 分开处理。

## v0.7.299 · 2026-11-16

### 流水线钩子注册表
- 新增 server/pipeline.js：五个阶段（crawl/screen/review/publish/crossseed）+ 启动自动加载 server/steps/*.js。
- 调度每阶段后执行已注册钩子；钩子报错只记录，不影响整轮。
- 文档 pta/docs/PIPELINE.md：新功能只需说“进自动流程、放在哪一步”。

## v0.7.298 · 2026-11-16

### 流水线串联到辅种
- 新增 server/crossseed.js：发布成功后自动把权威种子加进 qB（skip_checking + 复用 save path）。
- 调度器发布成功后逐目标辅种；失败不影响发布结果，下一轮会重试。
- 备份恢复演练通过（含 site-maps）；本机无 Docker，镜像构建未验。
- G12 40%→60%，G13 65%→70%。

## v0.7.297 · 2026-11-16

### WebUI 再次冻结
- 以当前待审核页脚版本更新 UI 基线，30 个文件锁定。

## v0.7.296 · 2026-11-16

### 待审核多目标只列可发站
- 多目标芯片改用 /api/targets 里有 cookie 的站，不再把 306 个站全铺出来。

## v0.7.295 · 2026-11-16

### 待审核页脚修复
- 多目标芯片从截图卡里移出，改放详情页脚。
- 详情中间内容滚动、页脚固定底部；芯片多少都不挤占页脚位置。

## v0.7.294 · 2026-11-16

### 必填字段默认值
- 导入器保存每个站上传页的下拉选项与默认值（第一个非零项）。
- 发布计划里，已声明但没映射的必填字段（type/source_sel/team_sel/standard_sel/codec_sel/audiocodec_sel）自动填默认值，并在 warnings 标注。
- 测试站默认：type=401、source_sel=1、team_sel=1。

## v0.7.293 · 2026-11-16

### 双目标端到端验证完成
- 一条 release 双目标：主站命中已有资源按规则跳过；测试站发布成功、抓权威种子、skip_checking 辅种、tracker working、详情页 1 个做种者。
- 收口：目标站测试种删除、qB 任务与数据清理、realPublish 关闭、队列清空。
- G10 多目标发布标记完成；当前 goal 切到 G12（40%）。

## v0.7.292 · 2026-11-16

### 待审核：多目标芯片移入页脚
- 多目标芯片从发布信息卡移到详情页脚，页脚用 margin-top:auto 固定在底部；芯片多少都不影响位置。

## v0.7.291 · 2026-11-16

### 修回查 detailsUrl 变量
- matchedUrl 声明补齐，回查不再报错。

## v0.7.290 · 2026-11-16

### 上传详情地址兜底
- 上传返回 200 但没 Location 时，从页面里抓 details.php?id= 作为详情地址。
- 回查结果带 detailsUrl。
- 实测发现：部分站 team_sel 实际是「地区」，必填；缺地区会上传失败（你必须选择地区）。后续按站表单语义处理。

## v0.7.289 · 2026-11-16

### 查重策略与失败暂停
- 目标站已有原盘/只有 DIY 两条规则接进真发布前置检查：允许时标 dupeReview 继续提交，不允许才跳过。
- 调度器按站累计连续失败；达到「连续失败几次暂停该站」把站点停用并记原因。
- 规则体检缺读者 0，全量检查通过。

## v0.7.288 · 2026-11-16

### 从保存的上传页提取制作组映射
- 导入器解析 team/group 下拉，得到 331 条制作组映射；全程不联网。
- 总数：87 站 / 614 分类 / 331 制作组。

## v0.7.287 · 2026-11-16

### WebUI 冻结
- 新增 ui-freeze 检查：styles/components/views/App.vue 共 30 个文件做哈希基线。
- 只要界面文件变了、基线没更新，run.sh 直接失败。
- 改 UI 的唯一入口：node pta/scripts/ui-freeze.js --update。
- AGENTS 写明：除非用户明确要求，不改界面。

## v0.7.286 · 2026-11-16

### 媒介/分辨率/优惠去掉未接
- 三行芯片可点可保存；站点支持则拼 URL，不支持则抓后本地过滤。

## v0.7.285 · 2026-11-16

### 字体：数字 Consolas，汉字雅黑
- 全局字体顺序改为 Consolas → Microsoft YaHei → Inter，数字等宽、汉字雅黑。
- 初筛行名 112px、控件右移 86px（上一版未发）。
- 媒介/分辨率在站点无搜索参数时，抓完按标题本地过滤；优惠继续走 spstate。
- 补「源资源标题」规则读者，规则体检恢复 0 缺读者。

## v0.7.284 · 2026-11-16

### 初筛行名加宽、控件右移
- 行名列 96 → 112px，不再裁切。
- 控件右移 62 → 86px。

## v0.7.283 · 2026-11-16

### 源资源标题回填
- ④ 补齐与准备新增「源资源标题」按钮，跳待审核页回填。
- 待审核「上传准备」旁新增「回填源标题」：读源种 name，写回条目标题并记 sourceTitle。
- 发布 name 继续用条目标题，即源种原名，不做改写。

## v0.7.282 · 2026-11-16

### 初筛行名不换行
- 行名单行显示，超长省略。

## v0.7.281 · 2026-11-16

### 初筛行更紧凑
- 行高 padding 7 → 3，标签/控件垂直居中。
- 控件右移 50 → 62px。

## v0.7.280 · 2026-11-16

### 初筛去标题与横线
- 移除「初筛条件」标题及其下横线。

## v0.7.279 · 2026-11-16

### 流程页移除说明行
- 去掉分组说明、设置提示、初筛说明、发布闸门说明，只留标题和控件。

## v0.7.278 · 2026-11-16

### 初筛控件统一右移对齐
- 开关/多选芯片/单选芯片/输入框/下拉统一右移 50px，起点一致。

## v0.7.277 · 2026-11-16

### 初筛卡标题与说明分层
- 增加「初筛条件」标题 + 说明行，深色 13px / 灰色 11px。
- 行名改深色 500 字重，和灰色提示区分。

## v0.7.276 · 2026-11-16

### 初筛对齐抓取卡尺寸
- 初筛行改成 96px 行名 + 芯片，芯片 24px 高、左移 50px，与抓取卡一致。

## v0.7.275 · 2026-11-16

### 初筛行真正同行
- 初筛卡补上 display:grid，行名 112px + 芯片右列，同一行显示。

## v0.7.274 · 2026-11-16

### 流程页三处收口
- 抓取卡去掉请求频率说明文字和上方横线。
- 查重卡两组并排、去掉色块背景。
- 初筛卡行名与芯片同一行、芯片不换行。
- 补齐与准备的行名/提示重写：副标题从哪来、简介从哪补、简介图片怎么处理、简介末尾附加 MediaInfo、缺简介时联网补、简介主演数量。

## v0.7.273 · 2026-11-16

### 筛选参数进计划 + 缺失提示
- 抓取计划和实际抓取都带 medium/standard/spstate。
- 保存筛选时，站点没有对应选项会提示「本站搜索页没有这些选项」。

## v0.7.272 · 2026-11-16

### 请求限制并入调度条 + 媒介/分辨率/优惠接上
- 调度条加入请求间隔、窗口分钟、窗口上限、失败暂停；抓取卡底部限制框删除。
- 新增 /api/crawl/filters：从站点搜索页读 medium/standard/spstate 选项，按中文标签映射；保存后抓取 URL 自动带参数。
- 保存抓取规则时同步保存媒介/分辨率/优惠选择。

## v0.7.271 · 2026-11-16

### 分类再拆细：Remux/图片/样品/预告
- 原盘、Remux、压制分开，不再合并；图片、样品、预告各自成类。
- 类型芯片 23 个；86 站 614 条映射。

## v0.7.270 · 2026-11-16

### 分类全部落位 + 新类型芯片
- 新类型：成人、原盘、压制、短剧、舞台演出；类型芯片 19 个。
- 别名大幅扩充（体育联赛、音乐子类、软件/游戏平台、TV 频道、质量类）。
- 未命中一律归「其他」，不再留空；86 站共 604 条分类映射。

## v0.7.269 · 2026-11-16

### 分类别名再扩 + 未归类清单
- 影片/影 片→电影、Drama→剧集、Doc→纪录片、Trailer/Sample→其他。
- 86 站 / 554 条映射；未归类 490 条导出到 data/sitecat-unmapped.csv（host,id,label）。

## v0.7.268 · 2026-11-16

### sitecat 二次导入与路由合并
- 别名扩到音乐子类（EP/Album/Single/Remix/OST/Mixtape/Demo/HQ Audio/音轨）、OVA/Manga、教学。
- 导入器合并 routes.json：每站存引擎、种子页/上传页地址、可访问状态。
- 86 站 / 549 条分类映射 / 1213 条原始标签 / 65 条路由信息。

## v0.7.267 · 2026-11-16

### sitecat 重导入（含上传页）
- 导入器支持上传页的 type/category 下拉；manifest 提供站点名，200 个文件全部识别。
- 合计 86 个站、538 条分类映射、1213 条原始标签（含未归类，便于以后重映射）。

## v0.7.266 · 2026-11-16

### 预设行芯片左移 50px
- 多选芯片行左边距 24 → 50px。

## v0.7.265 · 2026-11-16

### 预设行芯片再右移
- 多选芯片行右边距 10 → 24px。

## v0.7.264 · 2026-11-16

### 预设行芯片右移
- 多选芯片行右移 10px，和行名拉开一点距离。

## v0.7.263 · 2026-11-16

### Telegram 键盘全部隐藏
- 去掉模型（opencode-go）和变体（max）按钮；没有排队/目标按钮时不再显示回复键盘。
- 补丁脚本同步更新，bot 启动前自动重打。

## v0.7.262 · 2026-11-16

### Telegram bot 本地补丁自动化
- 新增 scripts/patch-telegram-bot.sh：引用回复 + 回复键盘只留一行两个按钮。
- systemd drop-in（opencode-tg.service.d/patch.conf）在每次启动前自动重打，bot 升级后重启即生效。
- 键盘去掉 agent 与上下文消耗按钮，只留模型/变体一行。

## v0.7.261 · 2026-11-16

### 预设行行名完整显示、芯片紧凑
- 预设行左列 96 → 116px，行名允许换行，不再省略。
- 预设行芯片 28/12px → 24/8px，行距 4px，右列更紧凑。
- 手机端左列 96px，行名正常换行。
- 响应式 32 项通过。

## v0.7.260 · 2026-11-16

### 预设行左列加宽
- 搜索预设行左列 68 → 96px（手机 64 → 84px），行名不再被挤没。
- 响应式 32 项通过。

## v0.7.259 · 2026-11-16

### 未接徽标与芯片对齐
- 「未接」徽标固定在标签右侧同一行，不再被挤到下一行；标签过长省略。
- 右侧芯片行统一左对齐（媒介/分辨率/优惠、初筛、发布字段）。
- 响应式 32 项通过。

## v0.7.258 · 2026-11-16

### 界面叫法清单更新
- DESIGN.md 第八节扩成完整清单：流程页 8 段、搜索预设/抓取分类、站点页统计条到保存条、待审核预检。
- 统计条相关回复顺序固定：统计条 → 架构条 → 架构段 → 架构数字 → 数字区。

## v0.7.257 · 2026-11-16

### 详情设置合并成一页 + 每页 13 条
- 去掉登录/搜索预设/上传配置/站点覆盖四个页签，内容按「概览 → 搜索预设 → 上传配置 → 站点覆盖」顺序往下排。
- 概览区抓取参数卡和抓取卡对调（抓取参数在前）。
- 站点列表每页 13 条，列表内部不再滚动。
- smoke 26/26、全量检查通过。

## v0.7.256 · 2026-11-16

### 详情头收紧
- 搜索预设和启用状态固定在站名右侧同一行，站名过长省略。
- 去掉站名下的站点网址。
- 去掉概览区「已收录 / 今日 / 上次 / 下次」那一排。
- 响应式 32 项通过。

## v0.7.255 · 2026-11-16

### 概览区：登录/抓取等高 + 新增抓取参数卡
- 概览区三块卡片等高，抓取卡顶部对齐登录卡，底部不变。
- 新增「抓取参数」：预设来源、分类参数、抓取状态、词条；引擎保留在登录卡里。
- 响应式 32 项通过。

## v0.7.254 · 2026-11-16

### 站点列表再收窄、每页 14 条
- 站点列表 320–460 → 280–400px。
- 每页 11 → 14 条，列表卡高度填得更满。
- 响应式 32 项通过。

## v0.7.253 · 2026-11-16

### 站点列表去掉登录列
- 表头和站点行都去掉登录状态列；在线小圆点保留在站名右侧。
- 列表网格从 5 列变 4 列，站名空间更大。
- 响应式 32 项通过。

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
