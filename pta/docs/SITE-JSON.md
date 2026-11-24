# 站点 JSON（SITE-JSON）

状态：2026-11-24，`sites.json` / `sites.preset.json` 已改成每站四块的块状格式。站点只保存“全局 key → 站点 ID/值”，中文名、媒介、分辨率、优惠、限制只在全局预设写一份。

## 文件

```text
pta/server/pack/presets.preset.json     入库：全局预设模板（首次启动复制）
pta/server/pack/sites.preset.json       入库：站点定义（只含 key + ID）
pta/server/pack/site-urls.preset.json   入库：网址，Base64
pta/server/pack/cookies.example.json    入库：host → 空 cookie 模板

/data/presets.json               本地：全局类型/搜索维度/发布字段（用户可改）
/data/sites.json                 本地：站点定义 + settings
/data/site-urls.json             本地：网址，Base64
/data/cookies.json               本地：cookie，AES-GCM 密文
```

- `data/presets.json` 是运行时唯一的全局预设；首次启动从 `pta/server/pack/presets.preset.json` 复制，之后用户改的是 data 这份。
- 站点 JSON 不写中文类型；页面选项通过 `GET /api/presets` 读运行时全局预设。
- `sites.preset.json` / `site-urls.preset.json` 可以进 GitHub。
- `cookies.example.json` 只能有空值；真实 cookie 永远不进仓库。
- `site-urls` 是 Base64，不是加密；能解码看到网址。
- 本地三个文件不进仓库、不进镜像。

## 块状格式

每个站固定四块，顺序固定：

```text
meta      一行
search    四行
publish   四行
settings  一行
```

- 站与站之间空一行。
- `meta`、`settings` 短，各占一行。
- `search` / `publish` 只拆到四行，不把每个字段拆开。
- 空对象、空字符串保留，不删字段。
- 最后一个站不留尾逗号。
- 预设文件不写 `settings`；`settings` 只在运行时 `data/sites.json` 出现。

完整示例：

```json
{
  "version": 1,
  "sites": {

    "site-a.example": {
      "meta": { "name": "Site A", "nameZh": "", "engine": "nexusphp", "urlRef": "site-urls.json#site-a.example" },
      "search": {
        "path": "/torrents.php", "params": { "search": "{q}", "cat": "{cats}" }, "catMode": "key", "catSlot": "1",
        "type": { "movie": ["401"] }, "medium": { "bluray": ["bluray = medium1 = 1", "uhd_full_disc = medium12 = 1"] },
        "resolution": { "1080p": "standard = 1" }, "discount": { "free": "spstate = 2" }, "restriction": {},
        "selected": { "medium": ["bluray"], "discount": ["free"] }, "limits": {}, "downloadLink": "", "refreshCron": ""
      },
      "publish": {
        "upload": { "path": "/takeupload.php", "formPath": "/upload.php", "fileField": "torrent", "fields": {} }, "verify": { "path": "/torrents.php?search={title}" },
        "type": { "movie": "402", "tv": "403" }, "medium": { "bluray": "1" },
        "resolution": {}, "discount": {}, "restriction": {},
        "tagMap": {}, "tagValue": "yes", "form": null, "valueMaps": {}
      },
      "settings": { "enabled": false, "interval": null, "priority": "normal", "note": "", "hidden": false }
    }
  }
}
```

读法：

```text
meta.name             站点显示名
search.type.movie     搜索页电影分类 ID = 401
search.medium.bluray  Blu-ray = 原盘/Blu-ray(medium1=1) + Blu-rayUHD(medium12=1)
search.selected       流程页勾了 Blu-ray 和免费
publish.type.movie    上传页电影分类 ID = 402
settings.enabled      本机是否启用
```

## 大分类

内容类型只留 18 个：`movie / tv / variety / anime / documentary / music / concert / mv / sports / game / software / ebook / audiobook / short / stage / adult / image / other`。

媒介只留 10 个：`bluray / remux / encode / webdl / webrip / hdtv / dvd / hddvd / vhs / other`。`full_disc`、`uhd_full_disc`、`3d_full_disc` 是 `bluray` 组里的站点子项，不再作为独立大分类显示。

旧站点里的内容类型 `full_disc / remux / encode / sample / trailer` 会自动归到 `other`；旧媒介 `full_disc / uhd_full_disc / 3d_full_disc` 会归到 `bluray` 组。

## 字段

### meta

```text
name       显示名
nameZh     中文名，可空
engine     nexusphp / unit3d / gazelle / ?
urlRef     site-urls.json#<host>
localEdited 本地改过才写 true；默认不写
```

### search

```text
path         搜索页路径，例如 /torrents.php
params       固定查询参数，例如 { "search": "{q}", "cat": "{cats}" }
catMode      分类参数写法：single / multi / bracket / indexed / key
catSlot      固定参数名，可空
type         抓取分类：大分类 key → 站点分类 ID 数组
medium       媒介选项：大分类 key → 站点子项数组
resolution   分辨率选项：大分类 key → 参数名/值
discount     优惠选项：大分类 key → 参数名/值
restriction  限制选项：大分类 key → 参数名/值
codec/audio/team  可选，存在才写
detect       可选：识别覆盖（engine 强制架构；skip 跳过的分类 ID；map 标签/ID → 大分类 key）
selected     已勾选的大分类 key；只影响 URL 拼装
labels       可选，站点原始选项文字
limits       站点自己的抓取限制
downloadLink 列表页没给下载链接时的模板，{ID} 会替换
refreshCron  预留的刷新表达式，原样保存
```

`search.type` 是**抓取分类**，`publish.type` 是**上传分类**，两者分开，不放进同一个数组。

选项字符串规则：

```text
medium:       "bluray = medium1 = 1"        子项 = 参数名 = 值
其他维度:     "standard = 1"                 参数名 = 值
```

- `medium` 的 `bluray`、`uhd_full_disc` 是站点子项，`medium1`、`medium12` 是该子项的参数名。
- 一个维度有多个参数时写成数组：
  ```json
  "medium": { "bluray": ["bluray = medium1 = 1", "uhd_full_disc = medium12 = 1"] }
  ```
- UI 的“Blu-ray”大分类 = 原盘(Full Disc) / UHD 原盘 / 3D 原盘 / Blu-ray；站点只有 Blu-ray 时就用它，有 Blu-rayUHD/3D 时一并带上。
- Gazelle 的 `media` / `codec` / `audioformat` / `resolution` 下拉会映射到媒介/编码/音频/分辨率；`media=BluRay` 归到 Blu-ray 组。
- NexusPHP 的 `incldead=0` 是“包括断种”，`1=活种`，`2=断种`；默认带 `incldead=0`，避免漏断种资源。
- `catMode: "key"` 表示 NexusPHP 的 `cat401=1`、`cat402=1` 写法；`single` 是 `cat=401`，`bracket` 是 `cat[]=401`。
- `POST /api/crawl/preset/:host/detect`：读一次搜索页，识别分类 ID、媒介/编码/音频/分辨率/制作组和参数名，合并写回站点预设。
- 批量识别：`node pta/server/scripts/detect-search-presets.js --data <数据目录> --run [--write] [--limit 5]`；默认只数站，`--run` 才请求，每站 1 次、间隔 10 秒，失败即停；同一 ID 识别成多个大分类时跳过不写。

### publish

```text
upload       上传地址、表单地址、文件字段、固定字段
verify       回查地址
type         上传分类：大分类 key → 站点分类 ID
medium/resolution/discount/restriction  上传维度，存在才写
codec/audio/team  可选
tagMap       标签 → 上传字段
tagValue     标签字段值，默认 yes
form         上传表单选项缓存
valueMaps    值映射；team 单独一层
baseValueMaps 站点包自带的值映射
```

发布维度用大分类 key，不用站点小 key：

```json
"medium": { "bluray": "1" }
```

有多个子项时：

```json
"medium": { "bluray": ["bluray = 1", "uhd_full_disc = 12"] }
```

### settings

只在本机 `data/sites.json` 出现；预设文件不写，首次启动默认停用。

```text
enabled   启停
interval  抓取间隔，可空
priority  优先级
note      备注
hidden    是否从面板移除
```

`settings` 允许出现抓取覆盖项（`override`、`ovInterval`、`ovDetail`、`mode`、`queueMode`、`window`、`pages`、`concurrency`、`dupeCheck`），保存时原样保留。

### extra

站点里出现的未知顶层字段放 `extra`，保存和生成预设都不会删：

```json
"extra": { "customField": { "keep": true } }
```

## 格式化

所有写入 `sites.json` / `sites.preset.json` 的地方都走同一个出口：

```text
pta/server/src/features/sites/format.js
```

它只负责排版，不改字段。面板保存、抓取填分类、识别预设、生成 pack、迁移旧数据，最后都调用 `formatSitesDoc`。

不要在编辑器里用 Prettier 格式化这两个文件；会被格式检查拦住。手工改完跑一次：

```bash
node pta/server/scripts/build-site-json.js --data <数据目录> --out <输出目录>
```

## 迁移旧结构

旧 `sites.json` 里的 `name/engine/urlRef`、`search.cats`、`search.filters`、`publish.catMap`、顶层 `limits/downloadLink/refreshCron` 会被自动迁移：

```text
name/nameZh/engine/urlRef  → meta
search.cats                → search.type
filters.values/params      → search.medium/resolution/discount/restriction
filters.selected           → search.selected
publish.catMap             → publish.type
limits/downloadLink/refreshCron → search.limits/downloadLink/refreshCron
```

- 读取时兼容旧结构；第一次写入时改回新结构，并留 `.bak`。
- 生产 `data/sites.json` 部署后第一次读取会自动迁移，不需要手工改文件。
- 中文 key、`types`、`catLabels`、`filters.map` 会自动归一。
- 旧的一次性迁移脚本仍保留，但检测到新结构会直接退出：
  ```bash
  node pta/server/scripts/migrate-site-presets.js --data <数据目录> --write
  ```

## 生成 / 更新

运行时 `data/sites.json` 是唯一事实源；仓库预设从它生成：

```bash
node pta/server/scripts/build-site-json.js --data /opt/seedpod/data --out /tmp/pta-pack
cp /tmp/pta-pack/sites.preset.json pta/server/pack/sites.preset.json
chmod 644 pta/server/pack/sites.preset.json
```

- 默认生成 `sites.preset.json`、`site-urls.preset.json`、`cookies.example.json`，预设不带 `settings`。
- 输出 `sites.preset.json` 也是块状格式。
- `--runtime` 只规范化运行时文件。
- `--check` 校验仓库预设与运行时一致。
- `--dry` 只输出数量。
- 不打印站名/网址/cookie，不联网。

改 `pta/server/pack/presets.preset.json` 模板后同步前端默认值；运行时以 `data/presets.json` 为准：

```bash
node pta/server/scripts/gen-presets.js
```

`presets.preset.json` 的 `site` 段是站点字段模板（内部结构），保存时会转成块状格式，不是站点文件示例。

## 首次启动

```text
/data/presets.json 不存在    → 从 presets.preset.json 复制
/data/sites.json 不存在      → 从 sites.preset.json 复制
/data/site-urls.json 不存在  → 从 site-urls.preset.json 复制
/data/cookies.json 不存在    → 从 cookies.example.json 复制（全空）
```

之后面板只读写 `/data` 的四个文件；镜像里的 preset 只读。用户新增类型直接改 `data/presets.json`，重启后界面和抓取都按新表走。

## 升级合并（待接）

1. 备份 `/data/sites.json`、`/data/site-urls.json`、`/data/cookies.json`。
2. 按 host 合并：
   - 新站：加入，默认停用。
   - `localEdited: false`：定义字段可用 preset 更新。
   - `localEdited: true`：保留用户值，只提示。
3. `settings` 永远以本地为准，preset 不覆盖。
4. cookie 不合并，继续用本地 `cookies.json`。

## 检查

`pta/server/checks/sites-format.js`：

- `sites.preset.json` 和运行时 `sites.json` 必须是块状格式；
- 每个站必须有 `meta/search/publish`，运行时还要有 `settings`；
- `search` / `publish` 五维必须存在；
- 出现旧字段 `name/cats/filters/catMap` 直接失败；
- 排版被改回普通缩进也失败。

`pta/server/checks/presets.js`：

- 全局类型清单、搜索维度齐全；
- 中文名/旧 key/英文别名归一；
- 站点只存 key，读时补中文，写时归一；
- 旧 `filters.map`/`selectedLabels` 归一成 `values`/`selected`；
- 仓库预设没有中文类型 key、没有 `types`。

`pta/server/checks/site-json-preset.js`：

- 三个预设文件 host 一致；
- `sites.preset` 没有 `settings`、没有明文网址；
- 网址段全部 `b64:` 且能解出 http(s)；
- cookie 模板全部为空。

## 安全边界

- Base64 只能遮挡，不是加密。
- 真实 cookie 只进 `data/cookies.json`，AES-GCM 密文，0600。
