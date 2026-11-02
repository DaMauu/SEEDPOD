# 架构设计

面向维护者的实现说明：模块边界、数据流、关键算法与扩展点。

---

## 一、总体形态

单文件 userscript，无构建步骤。运行时是 `(() => { ... })()` 的 IIFE，内部按“库”分区，靠注释块与命名前缀区分：

```
sites      站点识别、URL 拼装、详情页解析
audit      列表页审核、过滤规则、行内工具条
batch      翻页抓取、断点、进度汇报
dupe       查重：关键词回退、体积校验、结果判定
library    词库：分片存储、TTL、导入导出
bdinfo     BDInfo 解析与表格重建
subtitle   副标题排版（片名/版本/导演/主演/语言/字幕）
publish    转种：填单、塞种、标题守卫
shots      截图收集、候选探测、尺寸复核
imgbed     图床：SSO 登录、二进制上传、映射缓存
```

设计约束：**任何模块不得直接依赖页面 DOM 之外的全局状态**；跨模块数据通过明确参数传递，避免隐式耦合（历史 bug 多源于此）。

---

## 二、数据模型

### 条目（item）

```js
{
  torrentId, mainTitle, releaseName, movieTitle, movieYear,
  imdbId, sizeGB, is4K, downloadUrl,
  cnTitle, regionBracket, chkBox, row
}
```

`row` 是列表页 DOM 引用，仅用于渲染工具条与高亮；持久化时序列化会剔除它。

### 断点（`pt_batch_checkpoint`）

```js
{
  v: 1,
  siteAHost, siteBHost, listKey,
  savedAt,
  phase: "crawl" | "check",
  nextPage,           // 下次从第几页继续
  crawlDone,          // 是否真抓到最后一页
  checkedIds: [],     // 已查过的种子 id
  items: []           // 序列化后的名单
}
```

断点有效性只校验站点对与保存时间（默认 12 小时）；页面 URL 变化不再作废，避免重新登录后从第 1 页重来。

### 词库（`pt_imdb_library_00..31`）

32 分片，键为 `host::cacheKey`，值为

```js
{
  torrentId, titleYearKey, imdbId, movieTitle, movieYear, cnTitle,
  lastCheck, lastResult: { hasUntouchedDupe, hasTouchedDupe, verifyUrl, ... }
}
```

命中且未过期 → 直接出结论，不请求目标站。

---

## 三、主流程状态机

```
idle
 └─(拉取数据)→ audit ─→ crawl ─→ check ─→ done
                  ↑        │        │
                  │        ├─(暂停)→ paused（保留断点）
                  │        └─(登录态失效)→ aborted（保留断点）
                  └────────(断点继续)────────┘
```

`phase` 与 `nextPage`、`checkedIds` 一起决定断点恢复位置：
- `crawlDone=false` → 先续翻页；
- `crawlDone=true` → 只补查未完成的条目。

---

## 四、关键算法

### 1. 审核过滤

先按页面结构取行，再逐行判断：
- 排除：`x264/x265/HEVC/WEB/HDTV/Remux/Encode`、非蓝光介质、`DIY/禁转/限转`
- 保留：蓝光原盘，记录 IMDb、体积、4K 属性

### 2. 查重关键词回退

```
IMDb → 西部片名 → AKA 原名 → 完整片名（截到年份）
```

命中后二次校验：`4K 属性一致 && |Δsize| / size ≤ 1%`。
设计动机：目标站存在同名不同版，早期仅凭“是原盘”就判重复，导致大量误报。

### 3. 截图候选探测

对每张图生成候选集合：

```
原始地址
去缩略后缀（.th/.md/.sm/_thumb/-400x225）
去尺寸参数（?w=…）
thumbs/ → images/
show 页 → images 直链（pixhost 等）
图片站查看页 → og:image（imgbox/ibb/imgur）
```

逐个用 `Image` 探测宽度，取最大者；达到 1200px 提前结束。
宽度全部测不到时，**优先选不带缩略后缀的候选**，绝不退回缩略图。
上传走二进制（先下载字节再 multipart），上传后再比一次尺寸，被压缩则回退原链。

### 4. 限速与熔断

- 每站独立令牌桶，查重默认 4 秒/次，每 10 次强制休息 30 秒。
- 命中 429 → 退避 60 秒后重试一次。
- 响应体识别登录页 / `finalUrl` 含 login / 403 → 抛 `AUTH_LOST`，外层中止本轮并保留断点。

### 5. 填单注入

- 用 `DataTransfer` 构造 `File` 注入 `<input type="file">`，触发 `change`。
- 文本框统一 `value + dispatchEvt("input"/"change")`，防止框架监听丢失。
- 标题只写一次，并挂 `keydown/paste` 监听；检测到人工输入立即停止覆盖。

---

## 五、站点适配

新增站点需要提供：

1. `@match` 规则（用户脚本头）。
2. 站点条目：`{ name, url, type, aliases }`（`type` ∈ `np | unit3d | gz | f3nix`）。
3. `siteUrl()` 里的详情 / 下载 / 检索地址拼法（漏了会生成别的架构的地址）。
4. 详情页解析：标题、BDInfo、截图容器、下载链接（`fetchFullSourceDetails` 的网页穿透分支要放进适用条件）。
5. 列表页行选择器与审核字段提取（`AUDIT_HANDLERS`）。
6. 跨页拉取：`multiPage` 白名单 + 翻页循环里的行解析分支，两处必须同时补，否则只审当前页还不报错。

选择器一律“先精确后兜底”多级回退，站点改版时只改该站点条目。

---

## 六、错误处理原则

| 场景 | 处理 |
|---|---|
| 单条查重失败 | 记为 error，不写入“已查”，下次重试 |
| 目标站限流 | 熔断并保留断点，日志明确提示等待 |
| 图床未登录 | 保留原图链接，不中断流程 |
| 图床重复上传 | 视为已存在，保留原链，不报错刷屏 |
| BDInfo 不完整 | 提示并允许手工粘贴/编辑 |
| 站点改版 | 解析失败只影响该条，不中断整批 |

---

## 七、性能与体量

- 单文件约 6300 行 / 300 KB，无外部依赖。
- 词库 1300+ 条时，徽标恢复为纯本地计算，约数十毫秒。
- 翻页抓取 100 页约 4–6 分钟（含限速），瓶颈是站点而非脚本。

---

## 八、扩展清单

- [ ] 词库加规则版本位（`ruleV`），规则升级后自动失效旧结论
- [ ] 图床压缩检测改为按内容哈希比对，避免重复上传
- [ ] 前端渲染站点支持按 IMDb 精确检索
- [ ] 增加发布前自动截图对比（人工核对更快）
