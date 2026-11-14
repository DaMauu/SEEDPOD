# 站点包与自动化（开发计划）

状态：需求已定，待实现（2026-11-16）。
目标：默认自动化。站点怎么搜、分类怎么对、上传字段怎么填，提前存进站点包；运行时直接用，只有例外才让用户处理。

## 1. 站点包是什么

一个数据文件，不是安装包、不是插件。里面是每个站的“说明书”：

- 站点 host、base、引擎
- 搜索页路径、参数、分类模式
- 分类表：站点分类 ID + 标签 + 库内用途
- 上传表单：提交路径、识别页路径、文件字段、字段模板
- 回查路径

不包含：cookie、账号、密码、API key、服务器 IP、用户队列数据。

当前仓库只有代码；真实站点定义在生产 `data/site-defs/`，308 个站、1409 个分类。站点包就是把这些定义规范化、自动匹配、加密后随程序发布。

## 2. 分发方式（已定）

- 站点包**跟程序一起发**：仓库/发布镜像里带 `pta/pack/site-pack.enc`。
- 用户安装面板或 Docker 镜像后，启动时自动解密；**不需要用户下载、导入、选择**。
- 用户自己的 `data/site-defs/` 和 `data/site-pack.json` 优先，升级不覆盖。
- 站点包更新跟程序版本走；以后要“只更新包不升级程序”，再加发布页附件和自动检查。

## 3. 加密与密钥（已定）

- 算法：AES-256-GCM（复用 `pta/server/secretbox.js` 的 `v1:` 格式）。
- 密钥：部署环境变量 `PTA_SITE_PACK_KEY`，32 字节，支持 64 位 hex 或 base64。
- 密钥**不进仓库、不进提交、不写进回复**；仓库只放密文。
- 安装时配置一次：
  - systemd：`Environment=PTA_SITE_PACK_KEY=...`
  - Docker：`environment: PTA_SITE_PACK_KEY: ...`
- 缺密钥：不崩溃。记录明确日志，回退到私有 `data/` 站点定义；面板设置页显示“站点包未解密：缺 PTA_SITE_PACK_KEY”。
- 密钥轮换：用旧密钥解密 → 新密钥重新加密 → 提交新密文；旧版本无法解新包。
- 站点包不授权任何站点访问；cookie 和上传权限仍然独立。

## 4. 运行时加载优先级

从高到低：

1. `data/site-pack.json`（用户私有覆盖）
2. `data/site-defs/<host>.json`（用户私有单站定义）
3. `pta/pack/site-pack.enc` 解密后的内置包
4. 引擎默认值（NexusPHP / UNIT3D / Gazelle）

合并规则：按 host 合并；私有字段覆盖内置字段；`catMap`、`upload.fields` 这类对象做浅合并，私有优先；不允许内置包覆盖用户 cookie 或凭据。

## 5. 生成流程（离线）

脚本：`pta/scripts/build-site-pack.js`（待写）。

输入：

- `data/site-defs/*.json`（现有 308 个站）
- `data/site-pack.json`（如果有）
- `PTA_SITE_PACK_KEY`

步骤：

1. 读取并规范化：只保留运行需要的字段，剔除 `login`、`note`、`source`、`list` 等非运行字段。
2. 分类自动匹配：站点分类标签 → 库内用途（movie/tv/doc/music/anime/sport/game/book/software/adult/other）。关键词表 + 规则 + 已有 purpose；低置信度保留 `other`，输出例外清单。
3. 上传字段：优先站点自己的 `uploadMap`；没有就用引擎默认值（NexusPHP：`/upload.php` + `/takeupload.php`，`small_descr`、`type`、`uplver`）。
4. 生成明文包到临时文件（仅本机，0600），校验没有 `cookie/password/secret/token` 字段。
5. 用 `PTA_SITE_PACK_KEY` 加密，写 `pta/pack/site-pack.enc`；明文临时文件删除。
6. 输出报告：站点数、分类数、自动匹配率、例外数、包版本；**不打印站名/网址**。

参数：

- `--dry`：只算覆盖率和例外，不写文件。
- `--report <file>`：把例外清单写到私有文件（0600，不入库）。
- 生成脚本不联网，不抓真实站。

## 6. 运行时模块

新增 `pta/server/site-pack.js`（待写）：

- `load()`：读 `pta/pack/site-pack.enc`，缺密钥/解密失败时返回 `{ ok:false, reason }`，不抛到启动失败。
- `status()`：包版本、站点数、更新时间、是否解密成功；给 `/api/dev` 和设置页用。
- `resolve(host)`：按优先级合并私有定义和内置包。
- 缓存解密结果；文件 mtime 变化才重读。

改造：

- `pta/server/target.js`：当前直接读 `data/site-pack.json` 和 `data/site-defs`；改为走 `site-pack.resolve`。
- `pta/server/crawl.js`：搜索参数和 `catMap` 改为走 `site-pack.resolve`。
- `pta/server/routes-data.js` 的 `/api/site-defs`：仍读私有定义；可附带“内置包里有/没有”状态。

## 7. 自动化与例外

默认自动：

- 搜索路径、参数、分类映射、上传字段、回查路径都从站点包取。
- 分类自动匹配高置信度的直接使用；不要求用户逐行确认。
- 上传字段按引擎默认 + 站点覆盖自动填。

需要用户：

- 凭据/cookie（必须用户导入）。
- 低置信度分类（同一标签多义、无关键词命中）。
- 站点页面改版导致字段对不上（识别后确认一次，写回私有覆盖或新包）。
- 真发布开关（默认关）。

例外处理一次后存档，下次不再问。

## 8. 验收

新增 `pta/checks/site-pack.js`：

- 加密/解密 roundtrip。
- 篡改密文 → 解密失败，不崩溃。
- 缺 `PTA_SITE_PACK_KEY` → 回退私有定义，状态为未解密。
- 私有 `data/site-defs` 覆盖内置包。
- 生成的 `.enc` 里不出现明文 host/base。
- 分类自动匹配报告包含覆盖率与例外数。

接入 `pta/checks/run.sh`，全绿才算完成。

## 9. 里程碑

### M11 · 站点包与自动化

- [ ] 定 schema，写 `site-pack.js` 加载器
- [ ] 写 `build-site-pack.js` 生成器（`--dry` 先出覆盖率）
- [ ] 生成第一版 `pta/pack/site-pack.enc`（需部署环境有 `PTA_SITE_PACK_KEY`）
- [ ] `target.js` / `crawl.js` 接入包加载优先级
- [ ] 设置页/`dev` 显示包状态；缺密钥有提示
- [ ] `site-pack` 检查进 `run.sh`
- [ ] 分类自动匹配规则补到 80%+；UI 只显示例外
- [ ] 52pt 等已知站用包内映射，不再要求用户选分类

## 10. 不做

- 不让用户单独下载/导入站点包（默认随程序发）。
- 不把 cookie、密码、账号、IP 放进包。
- 不做后台轮询真实站；识别仍然只在用户点击时发一次只读 GET。
- 不承诺通用语义识别；站点差异靠包和例外处理。
