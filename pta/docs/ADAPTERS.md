# 站点适配与识别（ADAPTERS）

核心原则：**引擎是代码，站点是数据。识别靠页面特征，不靠站名。**

用户添加站点时只需要：网址 + cookie。剩下的由探测和确认完成，不需要写适配。

## 一、三层结构

1. **引擎适配器（代码）**：NexusPHP / UNIT3D / Gazelle / Generic。
   - 负责该家族站点的列表解析、搜索 URL、详情页、上传表单提交。
   - 代码里不出现任何真实站名或域名。
2. **站点实例（数据）**：`data/site-defs/<host>.json`。
   - `{ host, base, engine, confidence, catMap, uploadMap, detectedAt }`
   - 用户添加/探测后生成，0600，不入 git。
3. **私有站点包（可选）**：`data/site-pack.json`。
   - 预置多个站点实例，随部署安装/更新，面板可导入导出。
   - 不入 git、不进回复；没有包也能用自动识别。

## 二、识别流程

1. 用户填网址 + cookie，点“识别”。
2. 只发 **1 次** GET（首页或登录页），遵守站点间隔；不抓列表、不登录探测。
3. 按签名打分，返回：引擎、置信度、命中的特征。
4. 置信度足够 → 直接建实例；不够 → 让用户在 NexusPHP / UNIT3D / Gazelle / 其它 里选，**不猜**。
5. 保存实例；以后可“重新识别”。

## 三、引擎签名（示例）

| 引擎 | 页面特征（满足多条即可） |
| --- | --- |
| NexusPHP | `takelogin.php`、`torrents.php`、`details.php?id=`、`download.php?id=`、`cat=` 筛选、种子表格结构 |
| UNIT3D | `/torrents` 路由、`/api/v1`、Livewire、`/download/`、upload 路由、`unit3d` 字样 |
| Gazelle | `torrents.php?id=`、`ajax.php?action=`、`torrents.php?torrentid=`、`gazelle` 字样 |
| Generic | 有上传表单但特征不足；只做手动字段映射，不自动提交 |

签名是“行为特征”，不是站名；同一引擎的站点共用一套适配。

## 四、上传表单映射

1. 抓一次上传页，解析 `label / name / options`。
2. 映射到内部字段：标题、副标题、分类、类型、来源、分辨率、编码、音轨、字幕、简介、截图、匿名。
3. 面板显示映射结果，用户确认或改一次；存进 `uploadMap`。
4. 站点改版导致映射失败 → 停下让用户重试，不猜、不硬提交。

## 五、私有站点包

- 路径：`data/site-pack.json`（0600，gitignore）；示例见 `pta/docs/site-pack.example.json`。
- 结构：

```json
{ "version": 1, "sites": { "target.example": {
  "engine": "nexusphp",
  "base": "https://target.example",
  "upload": { "path": "/takeupload.php", "fileField": "file",
    "fields": { "name": "{title}", "descr": "{description}", "type": "{catId}" } },
  "verify": { "path": "/torrents.php?search={title}" },
  "catMap": { "movie": "401" }
} } }
```

- 字段占位：`{title}`、`{subtitle}`、`{description}`、`{catId}`、`{source}`、`{codec}`、`{resolution}`、`{team}`、`{anonymous}`、`{year}`、`{imdb}`、`{shots}`。
- 没有 `upload` 时用引擎默认骨架；真实站字段以私有包为准，不猜。
- API：`GET /api/targets` 列可用站；`POST /api/targets/:host/plan` 只读映射；`POST /api/targets/:host/upload`（`dryRun` 默认 true，真提交要 `realPublish=true`，可带 `torrentBase64`）；`POST /api/targets/:host/verify` 回查。
- 包里可以有真实站，但**永远不进仓库、不进回复**。

## 六、验收

- 三个引擎夹具：识别结果与置信度正确。
- 低置信度：必须走手动选择，不自动保存。
- mock 上传页：字段映射正确，缺字段有提示。
- 全程不向真实站发请求；真实站只在用户明确点“识别/抓取”时发一次。
- 已完成（0.7.111）：NexusPHP mock 真提交/回查、UNIT3D/Gazelle 干跑映射，`target` 6/6。

## 七、和 UA/upbrr 的差异

- 它们按站点写适配；我们按引擎写适配 + 自动表单映射 + 私有包。
- 用户不需要维护代码；站点变化时重新识别/确认映射即可。
- 仓库保持无真实站名，许可与合规风险最低。
