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

## 5. 参考

- Jackett 定义格式（登录方法、test 选择器、caps、search 块）：<https://github.com/Jackett/Jackett/wiki/Definition-format>
- Prowlarr 的 Cardigann 定义仓库与 schema：<https://github.com/Prowlarr/Indexers>
- Prowlarr Cardigann 定义的 C# 结构（字段清单参考）：<https://github.com/Prowlarr/Prowlarr/blob/develop/src/NzbDrone.Core/Indexers/Definitions/Cardigann/CardigannDefinition.cs>
- PT-Plugin-Plus：站点配置 + 搜索参数 + cookie 判活的前端实现，可看它的站点数据组织方式（仅参考结构，不拷数据）
