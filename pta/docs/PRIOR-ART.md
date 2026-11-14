# 先例与借鉴（Prior art）

成熟 PT 工具已经把「站点登录、cookie 判定、分类映射、搜索拼参」这些坑踩过一遍。我们不抄代码，抄它们的**数据结构和判定规矩**，
再用自己的零依赖实现落地。下面记清楚借了什么、怎么落到本项目的字段上、哪些不能碰。

## 1. Jackett / Prowlarr 的 Cardigann 定义

来源：[Jackett Definition format](https://github.com/Jackett/Jackett/wiki/Definition-format)、[Prowlarr/Indexers](https://github.com/Prowlarr/Indexers)。

它的定义是一个 YAML，关键结构：

- `links` / `legacylinks`：站点可用域名与旧域名，按序回退
- `requestDelay`：请求间隔（秒），对付「请求太密临时封」
- `caps.categorymappings`：`{id, cat, desc, default}` —— 站点分类 id → Newznab 大类 → 分类名
- `settings`：要用户填的字段（username/password/pin/cookie…）
- `login.method`：`post` | `get` | `form` | `cookie`
  - `form`：先 GET 登录页，抽出表单再 POST，能带 CSRF/隐藏字段/验证码
  - `cookie`：直接用用户提供的 cookie
  - `login.error`：登录失败页的选择器
  - `login.test`：**登录后请求哪个页面、页面里出现哪个链接算真的登录成功**（例如 `path: browse.php`, `selector: a#logout`）
- `search.paths` / `search.inputs` / `search.rows.selector` / `search.fields`：
  搜索路径、参数模板、行选择器、每行里取 `category/title/details/download/size` 的选择器

## 2. 我们落成了什么

站点定义（`pta/data/site-defs/<host>.json`）现在有对应字段：

| Cardigann | 我们的字段 | 说明 |
| --- | --- | --- |
| `links` | `base` | 目前每站一个域名 |
| `requestDelay` | `limits.requestDelay`（秒）/ `rate.minGapMs` | 采样器按它加间隔 |
| `caps.categorymappings` | `caps.categorymappings`（`{id, desc, purpose}`）与 `catMap` | `purpose` 是我们自己的用途分类 |
| `login.method` | `login.method` | 我们只开放 `cookie`（站点登录用 cookie，不存账号密码） |
| `login.test.path/selector` | `login.test.path/selector` | 会话自检用；`selector` 会被翻成正则去做「页面里有没有这个链接」 |
| `search.paths/inputs` | `searchPath` + `params` + `catMode` | 拼 URL 时用 |
| `search.rows.selector` | `list.anchor` | 列表行定位 |
| `search.fields.size` | `list.sizeStrategy` | 大小字段的取法（行窗口/`td_size`/缺失） |

会话自检因此变成两步：先用通用标记判（有退出链接、有用户详情链接、没有登录表单），
再用定义里的 `login.test.selector` 兜底——有些站只有会员区入口，通用规则认不出来。

## 3. 还能继续借的

- **登录方式枚举**：现在只做 cookie；将来要支持隐藏字段登录，照 Cardigann 的 `form` + `selectorinputs`（从 JS 里抓 CSRF）抄结构即可，不用改数据模型。
- **分类映射**：Cardigann 把分类映射到 Newznab 大类；我们保留 `purpose`，但可以把 `desc` 原样留着，将来导入别人的定义时直接映射到 purpose。
- **限速与退避**：`requestDelay` + 失败退避（我们已有 12 小时冷却、每站每日上限），可再补「同一站连续失败 N 次后停一天」。
- **匹配逻辑**（跨站找同一个种子）：references 是 cross-seed / qBittorrent 的做法——按文件名规整、分辨率、大小容差、infohash 优先；我们的队列查重目前只做标题+年份+分辨率，后面接详情页时再补大小与 infohash。

## 4. 不能做的

- **不复制 GPL/AGPL 代码**：Jackett、Prowlarr、autobrr 等多是 GPL 系，整段拷贝会把本项目也拖进同协议；只借字段名与判定顺序，代码自己写。
- **不内置私有站定义与会话数据**：别人仓库里的定义文件可能含站点域名与私有站 cookie 说明；我们的真实站清单、凭据、样本一律只在本机/测试机，不入库。
- **不绕过站点限制**：不自动破验证码、不轮换 UA 去压测、不共享 cookie；每站请求仍按「一次性、可解释、有配额」执行。

## 6. Vertex（栗山未来的追剧刷流工具）

仓库：<https://github.com/vertex-app/vertex>，**MIT 许可**，可以合法借鉴甚至改写代码，条件是保留版权声明并注明来源；
我们目前是「借结构与约定、代码自己写」，没有整段拷贝。

它的项目逻辑值得逐条学：

- `app/common/Site.js`：站点基类。每个站点实例持有 cookie、priority、rssUrl、maxRetryCount、刷新 cron；
  `_getDocument(url)` 统一发请求（带 cookie）→ 缓存 300 秒 → JSDOM 解析；
  `_downloadTorrent(url)` 下载 .torrent → bencode 解码 → **算 infohash / 体积 / 文件名** → 存到 torrents/；
  `search()` 调站点自己的 `searchTorrent`；`pushTorrentById()` 下载失败重试 3 次（间隔 2 秒）、推送失败重试 5 次；
  `refreshInfo()` 每小时抓账号数据写进 sqlite。
- `app/libs/site/*.js`：每站一个小模块，导出 `{name, url, id, downloadLink}` 与 `getInfo()/searchTorrent(keyword)`。
  搜索结果的字段约定是重点：`{site, id, title, subtitle, category, link, seeders, leechers, snatches, size(字节), time, tags}`。
  行数据优先用站点给的 `data-*` 属性（`data-torrent-id`、`data-title`、`data-size-bytes`、`data-seeders`、`data-added-ts`），
  拿不到才退回文本解析。
- `app/libs/util.js`：`requestPromise` 统一 UA、按域名白名单走代理、`trustAllCerts`、120 秒超时；
  用 `trk_jschal_js` / `jschl-answer` / `cloudflare-static` 这些特征判断「5 秒盾」，命中就换 Puppeteer 带 cookie 再抓一次；
  还有 `calSize/formatSize` 体积换算、CookieCloud 解密同步 cookie、文件名→TMDB 匹配、集数解析。
- `data/site/*.json`：每站一份配置（cookie、优先级、rss、重试次数、cron）。

我们照抄/对齐的部分：

| Vertex 做法 | 我们的落点 |
| --- | --- |
| 行数据优先 `data-*` | `server/adapters/nexusphp.js` 的 `parseDataRows`，真机上 audiences.me 从 0 行变 96 行 |
| 行字段含字节体积 | 所有解析器现在都带 `sizeBytes`（`server/adapters/size.js` 统一换算） |
| 下载链接模板 `download.php?id={ID}` | 站点定义新增 `downloadLink`（按引擎生成，`{ID}` 占位） |
| 重试上限 5 次 | 站点定义 `limits.maxRetryCount`（默认 5） |
| 定时刷新账号信息 | 站点定义 `refreshCron`（默认 `0 */4 * * *`），由脚本/定时任务执行 |
| .torrent → infohash | 新写 `server/adapters/torrent.js`：bencode 解码 + `SHA1(bencode(info))`，交叉做种先比 hash |
| 5 秒盾特征 | 采样器的 cloudflare 判定补 `jschl-answer` 等标记 |

故意不一样的地方（我们更克制）：

- 不引 jsdom / redis / puppeteer / better-sqlite3：本项目坚持零依赖，解析用正则+窗口，缓存用文件，遇到盾就记 `cloudflare` 下次再说。
- 不落明文 cookie：我们用 AES-256-GCM 存密文（`server/secretbox.js`），接口只回 `hasCookie`。
- 不抓账号数据（做种量、等级）：当前目标只需要「能搜索 + 能下载链接」，账号统计以后单独做。
- 不内置 CookieCloud 服务：它的解密逻辑值得借（key = MD5(uuid-passwd) 前 16 位，AES 解密 `get/<uuid>` 的 encrypted 字段），
  但需要用户自己部署服务，属于可选功能。
- 不在进程内跑 cron：定时由 systemd timer 或脚本驱动，进程只管请求。

## 7. 参考

- Vertex（MIT）：<https://github.com/vertex-app/vertex>，站点基类 `app/common/Site.js`、每站适配 `app/libs/site/`、请求与工具 `app/libs/util.js`
- Vertex 文档站：<https://wiki.vertex-app.top/>

- Jackett 定义格式（登录方法、test 选择器、caps、search 块）：<https://github.com/Jackett/Jackett/wiki/Definition-format>
- Prowlarr 的 Cardigann 定义仓库与 schema：<https://github.com/Prowlarr/Indexers>
- Prowlarr Cardigann 定义的 C# 结构（字段清单参考）：<https://github.com/Prowlarr/Prowlarr/blob/develop/src/NzbDrone.Core/Indexers/Definitions/Cardigann/CardigannDefinition.cs>
- PT-Plugin-Plus：站点配置 + 搜索参数 + cookie 判活的前端实现，可看它的站点数据组织方式（仅参考结构，不拷数据）
