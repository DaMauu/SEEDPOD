# 站点 JSON（SITE-JSON）

状态：2026-11-22，预设文件已生成；运行时读取切换待下一步。当前运行时仍读 SQLite `sites` + `data/site-defs`，预设文件作为迁移源和分发物。

## 文件

```text
pta/pack/sites.preset.json       入库：站点定义（站名、search、publish）
pta/pack/site-urls.preset.json   入库：网址，Base64
pta/pack/cookies.example.json    入库：host → 空 cookie 模板

/data/sites.json                 本地：站点定义 + settings
/data/site-urls.json             本地：网址，Base64
/data/cookies.json               本地：cookie，AES-GCM 密文
```

- `sites.preset.json` / `site-urls.preset.json` 可以进 GitHub。
- `cookies.example.json` 只能有空值；真实 cookie 永远不进仓库。
- `site-urls` 是 Base64，不是加密；能解码看到网址。
- 本地三个文件不进仓库、不进镜像。

## 结构

`sites.preset.json`：

```json
{
  "version": 1,
  "sites": {
    "site-a.example": {
      "name": "Site A",
      "nameZh": "站点甲",
      "engine": "nexusphp",
      "urlRef": "site-urls.json#site-a.example",
      "search": {
        "path": "/torrents.php",
        "params": {},
        "cats": { "电影": ["401", "402"] },
        "types": ["电影"]
      },
      "publish": {
        "upload": { "path": "/takeupload.php", "formPath": "/upload.php", "fileField": "file", "fields": {} },
        "verify": { "path": "/torrents.php?search={title}" },
        "catMap": { "movie": "999" },
        "catLabels": { "电影": "999" }
      },
      "localEdited": false
    }
  }
}
```

运行时 `sites.json` 多一个 `settings`：

```json
"settings": {
  "enabled": true,
  "interval": 6,
  "priority": "normal",
  "note": "",
  "hidden": false
}
```

不写的字段用默认值。

`site-urls.preset.json`：

```json
{
  "version": 1,
  "sites": {
    "site-a.example": {
      "base": "b64:aHR0cHM6Ly9zaXRlLWEuZXhhbXBsZQ==",
      "upload": "b64:L3Rha2V1cGxvYWQucGhw",
      "verify": "b64:L3RvcnJlbnRzLnBocD9zZWFyY2g9e3RpdGxlfQ=="
    }
  }
}
```

`cookies.example.json`：

```json
{
  "version": 1,
  "cookies": {
    "site-a.example": { "cookie": "" }
  }
}
```

## 生成 / 更新

```bash
cd /opt/seedpod-git
sudo -u seedpod env PTA_DATA=/opt/seedpod/data \
  node pta/scripts/build-site-json.js --data /opt/seedpod/data --out pta/pack
```

只读源数据（SQLite `sites`、`site-defs`、`site-search`、`site-maps`），不联网、不打印站名/网址/cookie。

- 默认生成 `sites.preset.json`、`site-urls.preset.json`、`cookies.example.json`。
- `--runtime` 才写数据目录的 `sites.json` / `site-urls.json`，并带 `settings`。
- `--dry` 只输出数量。

## 首次启动（待接）

```text
/data/sites.json 不存在      → 从 sites.preset.json 复制
/data/site-urls.json 不存在  → 从 site-urls.preset.json 复制
/data/cookies.json 不存在    → 从 cookies.example.json 复制（全空）
```

之后面板读写 `/data` 的三个文件，镜像里的 preset 只读。

## 升级合并（待接）

1. 备份 `/data/sites.json`、`/data/site-urls.json`、`/data/cookies.json`。
2. 按 host 合并：
   - 新站：加入。
   - `localEdited: false`：定义字段可用 preset 更新。
   - `localEdited: true`：保留用户值，只提示。
3. `settings` 永远以本地为准，preset 不覆盖。
4. cookie 不合并，继续用本地 `cookies.json`。

## 检查

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
