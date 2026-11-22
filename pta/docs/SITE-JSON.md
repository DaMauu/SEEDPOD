# 站点 JSON（SITE-JSON）

状态：2026-11-24，运行时已切到 JSON。站点只保存“全局 key → 站点 ID/值”，中文名、媒介、分辨率、优惠、限制只在全局预设写一份。

## 文件

```text
pta/pack/presets.preset.json     入库：全局类型/搜索维度/发布字段
pta/pack/sites.preset.json       入库：站点定义（只含 key + ID）
pta/pack/site-urls.preset.json   入库：网址，Base64
pta/pack/cookies.example.json    入库：host → 空 cookie 模板

/data/sites.json                 本地：站点定义 + settings
/data/site-urls.json             本地：网址，Base64
/data/cookies.json               本地：cookie，AES-GCM 密文
```

- `presets.preset.json` 是唯一的中文类型/选项来源；站点 JSON 不写中文类型。
- `sites.preset.json` / `site-urls.preset.json` 可以进 GitHub。
- `cookies.example.json` 只能有空值；真实 cookie 永远不进仓库。
- `site-urls` 是 Base64，不是加密；能解码看到网址。
- 本地三个文件不进仓库、不进镜像。

## 全局预设

`pta/pack/presets.preset.json`：

```json
{
  "version": 1,
  "types": {
    "movie": "电影",
    "tv": "剧集",
    "documentary": "纪录片",
    "sports": "体育",
    "ebook": "电子书"
  },
  "search": {
    "medium": { "full_disc": "原盘(Full Disc)", "remux": "Remux" },
    "resolution": { "1080p": "1080p", "2160p": "2160p" },
    "discount": { "normal": "普通", "free": "免费", "2x": "2x" },
    "restriction": { "no_repost": "禁转", "hr": "HR" }
  },
  "publish": {
    "fields": { "title": "标题", "descr": "简介", "catId": "分类" }
  }
}
```

完整清单在文件里，顺序就是界面选项顺序。

## 站点 JSON

`sites.preset.json` / `data/sites.json` 里的每个站只写 key 和 ID：

```json
{
  "version": 1,
  "sites": {
    "site-a.example": {
      "name": "Site A",
      "engine": "nexusphp",
      "urlRef": "site-urls.json#site-a.example",
      "search": {
        "path": "/torrents.php",
        "params": { "search": "{q}", "cat": "{cats}" },
        "catMode": "single",
        "catSlot": "1",
        "cats": { "movie": ["401"], "tv": ["402", "403"] },
        "filters": {
          "values": { "discount": { "normal": "1", "free": "2" } },
          "selected": { "discount": ["normal", "free"] }
        }
      },
      "publish": {
        "catMap": { "movie": "402", "tv": "403" }
      },
      "settings": { "enabled": false }
    }
  }
}
```

对应关系：

```text
全局“电影” → key movie → 搜索分类 401；发布分类 402
```

规则：

- `search.cats`：抓取分类绑定；一个 key 可以对应多个站点分类 ID。
- `publish.catMap`：发布分类绑定；一个 key 只对应一个 ID。
- `search.filters.values`：全局选项 key → 站点搜索参数值。
- `search.filters.selected`：勾选的全局选项 key；没有站点值的选项只做本地标题过滤。
- 不再保存 `search.types`、`publish.catLabels`；中文名由 `presets.preset.json` 查表补。
- `settings` 只在本机 `data/sites.json` 出现；预设文件不写，首次启动默认停用。

JSON 写一行不影响识别，空白只是格式：

```json
"cats": { "movie": ["401"], "tv": ["402", "403"] }
"catMap": { "movie": "402", "tv": "403" }
```

## 迁移旧结构

旧 `sites.json` 里的中文 key、`types`、`catLabels`、`filters.map` 会被自动归一：

```bash
sudo -u seedpod node pta/scripts/migrate-site-presets.js --data /opt/seedpod/data
sudo -u seedpod node pta/scripts/migrate-site-presets.js --data /opt/seedpod/data --write
```

- `电影` → `movie`，`doc` → `documentary`，`sport` → `sports`，`book` → `ebook`。
- `普通（下载量全计量…）` 这类长选项名只保留 `normal: "1"`，中文名从全局预设取。
- 只改 `sites.json`，不改 cookie 和网址。

## 生成 / 更新

运行时 `data/sites.json` 是唯一事实源；仓库预设从它生成：

```bash
sudo -u seedpod node pta/scripts/build-site-json.js --data /opt/seedpod/data --out /tmp/pta-pack
cp /tmp/pta-pack/sites.preset.json /tmp/pta-pack/site-urls.preset.json \
   /tmp/pta-pack/cookies.example.json pta/pack/
chmod 600 pta/pack/*.json
```

- 默认生成 `sites.preset.json`、`site-urls.preset.json`、`cookies.example.json`，预设不带 `settings`。
- `--runtime` 只规范化运行时文件。
- `--check` 校验仓库预设与运行时一致。
- `--dry` 只输出数量。
- 不打印站名/网址/cookie，不联网。

改全局预设后同步前端：

```bash
node pta/scripts/gen-presets.js
```

## 首次启动

```text
/data/sites.json 不存在      → 从 sites.preset.json 复制
/data/site-urls.json 不存在  → 从 site-urls.preset.json 复制
/data/cookies.json 不存在    → 从 cookies.example.json 复制（全空）
```

之后面板只读写 `/data` 的三个文件；镜像里的 preset 只读。

## 升级合并（待接）

1. 备份 `/data/sites.json`、`/data/site-urls.json`、`/data/cookies.json`。
2. 按 host 合并：
   - 新站：加入，默认停用。
   - `localEdited: false`：定义字段可用 preset 更新。
   - `localEdited: true`：保留用户值，只提示。
3. `settings` 永远以本地为准，preset 不覆盖。
4. cookie 不合并，继续用本地 `cookies.json`。

## 检查

`pta/checks/presets.js`：

- 全局类型清单、搜索维度齐全；
- 中文名/旧 key/英文别名归一；
- 站点只存 key，读时补中文，写时归一；
- 旧 `filters.map`/`selectedLabels` 归一成 `values`/`selected`；
- 仓库预设没有中文类型 key、没有 `types`。

`pta/checks/site-json-preset.js`：

- 三个预设文件 host 一致；
- `sites.preset` 没有 `settings`、没有明文网址；
- 网址段全部 `b64:` 且能解出 http(s)；
- cookie 模板全部为空。

## 安全边界

- Base64 只能遮挡，不是加密。
- 真实 cookie 只进 `data/cookies.json`，AES-GCM 密文，0600。
- 不打印 cookie；日志只记 host 和保存/删除动作。
- 备份包含三个本地文件；恢复后仍需原密钥解 cookie。
