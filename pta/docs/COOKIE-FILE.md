# Cookie 文件（COOKIE-FILE）

状态：2026-11-22 起，站点 cookie 统一放 `data/cookies.json`；SQLite `credentials` 表只作旧数据迁移回退。

## 文件

```text
data/cookies.json     0600，AES-256-GCM 密文
data/cookies.json.bak 上一次写入前的备份
```

格式：

```json
{
  "version": 1,
  "keyId": "ab12cd34",
  "cookies": {
    "site-a.example": {
      "cookie": "v2:...",
      "updatedAt": "2026-11-22T19:00:00.000Z"
    }
  }
}
```

- 文件里没有明文 cookie；`v2:` 是 `secretbox` 的密文格式。
- 密钥来自 `PTA_SECRET_FILE` / `PTA_SECRET` / `data/.secret`，与文件分离。
- `keyId` 只用于排查密钥是否换过，不是密钥本身。

## 面板操作

1. 打开「站点」→ 点站点 → 在「Cookie」输入框粘贴整段 `name=value; name2=value2`。
2. 点「保存设置」：先存站点配置，再把 cookie 加密写入 `cookies.json`。
3. 保存成功后自动做一次会话自检；失败不影响 cookie 已保存。
4. 想换 cookie：重新粘贴整段覆盖。
5. 想删除：点「删除 Cookie」，只清这个站的凭据，站点配置、分类映射和其他设置保留。
6. 页面不会回显已保存的 cookie；只显示「已保存 / 已保存但解不开 / 未保存」。

## 接口

所有接口都要先登录面板。

### 读取状态

```http
GET /api/credentials
```

返回：

```json
[
  { "host": "site-a.example", "hasCookie": true, "readable": true, "updatedAt": "..." }
]
```

不会返回 cookie 明文。

### 保存 / 覆盖

```http
PUT /api/credentials/:host
Content-Type: application/json

{ "cookie": "name=value; name2=value2" }
```

### 删除

```http
PUT /api/credentials/:host
Content-Type: application/json

{ "cookie": "" }
```

空字符串表示删除，不是“保持不变”。

### 批量导入

```http
PUT /api/credentials/import
Content-Type: application/json

{ "items": [
  { "host": "site-a.example", "cookie": "name=value" },
  { "host": "site-b.example", "cookie": "name=value" }
] }
```

最多 200 条；非法 host、空 cookie、超长 cookie 会跳过。

## 命令行导入

1. 准备明文 JSON（只用于导入，不长期保留）：

```json
{
  "site-a.example": "name=value; name2=value2",
  "site-b.example": "name=value"
}
```

2. 导入：

```bash
cd /opt/seedpod-git
sudo -u seedpod env PTA_DATA=/opt/seedpod/data \
  PTA_SECRET_FILE=<密钥文件> \
  node scripts/load-cookies.js /opt/seedpod/data/cookies.tmp.json
```

3. 删除临时文件：

```bash
sudo -u seedpod rm -f /opt/seedpod/data/cookies.tmp.json
```

脚本会把明文加密后写进 `cookies.json`，不会打印 cookie。

## 旧数据迁移

服务启动时，如果 `data/cookies.json` 不存在，会自动把 SQLite `credentials` 表里的密文搬到文件；文件已存在则不覆盖。

旧 `credentials` 表暂时保留作回退，不再作为读写事实源。确认稳定后可单独清理。

## 备份与恢复

`pta/scripts/backup.sh` 和 `restore.sh` 已包含：

```text
cookies.json
```

备份包里是密文；恢复后仍需同一个 `PTA_SECRET_FILE` / `data/.secret` 才能解密。

## 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `COOKIE_UNREADABLE` | 换了密钥，旧密文解不开 | 用当前密钥重新导入该站 cookie |
| `COOKIE_BUSY` | 另一个请求正在写 cookie | 等几秒重试 |
| 文件里没有某站 | 从未保存，或刚被删除 | 在站点页重新粘贴保存 |
| 备份恢复后都解不开 | 密钥文件没一起恢复 | 恢复原来的 `PTA_SECRET_FILE` 或 `.secret` |
| 写入后出现 `.bak` | 正常，覆盖前自动备份 | 需要回退时手工改名 |

## 边界

- `cookies.json` 不进仓库、不进 Docker 镜像，只放数据卷。
- 不打印 cookie；日志只记 host 和「保存/删除」。
- 面板接口只回 `hasCookie` / `readable`，不回明文。
