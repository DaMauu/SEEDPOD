# 站点适配流水线

目标：给清单里 300 多个 PT 站点各生成一份「站点定义」（引擎、搜索参数、分类 id 映射），
面板据此拼搜索 URL、判断登录态、做干跑计划。

约束（铁律）：每个站点只发一次 GET；站与站之间 4–6 秒；失败过的站 12 小时内不重打；
不自己找 cookie 去登录，采样只用本机 Chrome 已登录的会话；样本与产物都不入库。

## 一条命令

```
node scripts/pipeline.js            # 只分析已有样本（不联网）
node scripts/pipeline.js --sample   # 先补采样再分析
node scripts/pipeline.js --sample 20  # 只补 20 个站
```

## 三个阶段

1. 采样 `scripts/sample-sites.js`
   - 连本机 Chrome 的调试端口（`--remote-debugging-port=9222`），用现有登录态
   - 按站点架构猜首页路径：NexusPHP `/torrents.php`、UNIT3D `/torrents`、Gazelle `/torrents.php`
   - 主路径失败才试一次备用路径；证书链有问题的站用 CDP 单独放行
   - 等正文出现再取 HTML；Cloudflare 挑战页多等一轮，仍不行就记 `cloudflare` 不存样本
   - 每站一份 `pta/data/samples/<host>.html.gz`，状态写 `pta/data/samples/_state.json`

2. 离线分析 `scripts/analyze-samples.js`
   - 只读样本，发 0 个请求；识别引擎、抽分类、抽列表、反推搜索参数
   - 引擎识别顺序：UNIT3D → Gazelle → NexusPHP → 兜底 custom
   - 产物 `pta/data/analysis.json`；没有样本但有旧结果的条目会保留

3. 生成定义 `scripts/collect-site-defs.js`
   - `pta/data/site-defs/<host>.json`：引擎、搜索路径、参数模板、分类（用途 → id）、catMap、限速
   - `pta/data/site-search.local.json`：面板读的搜索预设；只覆盖 `source=auto` 的条目，人工确认过的不动

另外两个只读脚本：`scripts/validate-defs.js`（定义自检）、`scripts/coverage.js`（覆盖率报告）。

## 引擎识别标志

| 引擎 | 认什么 |
| --- | --- |
| UNIT3D | 有 `/torrents/<id>/download`，或有 `categories[0]=` 且带 `name=` 搜索框，或 `/torrents/<id>` 链接 ≥ 20 |
| Gazelle | `torrents.php?...action=download`，或 `filter_cat[` 配 `searchstr` |
| NexusPHP | `takelogin.php` / `Powered by NexusPHP`，或页面里 `details.php?id=` ≥ 5 |
| custom | 详情链接 ≥ 15（`details.php?id=`、`/torrent/123`、`viewtopic.php?t=` 等），或论坛式 tracker 的 3 条以上 |

## 失败分类（都写进 state 的 note）

`cloudflare`（挑战页）、`net-error`（Chrome 网络错误页）、`http-404`（路径猜错或站点 404）、
`error-panel`（页面被脚本顶掉）、`login-wall`（要登录才有列表）、`too-small`（内容过小）。

这些站不生成样本；`net-error` / `http-404` / `cloudflare` / `error-panel` 在 12 小时内不再重试。

## 发到测试机

定义与预设属于运行数据，放 `/opt/seedpod/data`（不是仓库里的 `pta/data`）：

```
tar czf - -C pta/data site-defs site-search.local.json | \
  ssh pta "tar xzf - -C /opt/seedpod/data && systemctl restart seedpod"
```

面板上「站点 → 搜索预设」页签能看到每站的引擎、来源（auto/手动）、分类 id；
`GET /api/site-defs` 是摘要，`GET /api/site-def/:host` 是单站完整定义。
