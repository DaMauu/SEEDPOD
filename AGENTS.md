# AGENTS.md · SEEDPOD 面板（项目铁律）

这个文件是压缩后仍然有效的事实源。改代码前先读它，改完再更新 HANDOFF.md。
聊天记录会被压缩，这里的规则不会；两条冲突时以本文件 + HANDOFF.md 为准。

## 项目是什么

个人 PT 转载/交叉做种面板：无构建静态 SPA + 零依赖 Node 后端。

- 前端 `pta/web/index.html` + `pta/web/assets/{app.js,app.css,data.js}`，hash 路由 `#dashboard #sites #crawl #queue #sources #logs #settings`
- 后端单文件 `pta/server/app.js`（只依赖 http/fs/path/crypto/vm/fetch）+ `pta/server/adapters/nexusphp.js` + `pta/server/secretbox.js`
- 线上跑在测试机 `/opt/seedpod`，systemd 服务 `seedpod`，监听 8080，数据在 `/opt/seedpod/data`
- 公网入口是一个 pta 开头的域名，经 Cloudflare → nginx 反代到 8080

## 铁律（违反即为错误，不要协商）

1. 不碰真实 PT 站点：不自己找 cookie、不复用 cookie 去登录、不对真实站点做探测/压测/反复请求。抓取一律先干跑或本地夹具。
2. 真实站点清单、站名、凭据、服务器 IP 都不入仓库、不进提交、不写进回复。示例一律用占位符（`example.org`、`docs/*.example.json`）。
3. 面板账号密码不入库：只配在测试机 systemd 环境变量 `PTA_USER` / `PTA_PASS`。
4. 站点凭据只存密文：`data/credentials.json` + AES-256-GCM，接口只回 `hasCookie`。
5. 提交前必须 `pta\checks\run.cmd` 全绿（adapter / smoke / audit / security / api）。没绿不提交；连续两轮修不绿就回滚并停手。
6. 站点登录只有 cookie，不要重新引入账号密码或 2FA；面板自己的登录（`PTA_USER`/`PTA_PASS`）是另一回事，别混。

## 发版（测试机 `/opt/seedpod` 不是 git 仓库）

必须一起发的文件，少一个就起不来或白屏：

```
pta/server/app.js
pta/server/adapters/nexusphp.js
pta/server/secretbox.js
pta/web/index.html
pta/web/assets/app.js
pta/web/assets/app.css
pta/web/assets/data.js
```

发版走 base64 过 ssh（scp 在 22 端口抖动时经常整条失败），发完比 md5 再重启：

```
for f in pta/server/app.js pta/server/adapters/nexusphp.js pta/server/secretbox.js \
         pta/web/index.html pta/web/assets/app.js pta/web/assets/app.css pta/web/assets/data.js; do
  base64 -w0 "$f" | ssh pta "base64 -d > /opt/seedpod/$f"
done
md5sum pta/server/app.js pta/web/assets/app.js
ssh pta 'md5sum /opt/seedpod/pta/server/app.js /opt/seedpod/pta/web/assets/app.js'
ssh pta 'systemctl restart seedpod && systemctl is-active seedpod'
```

改前端静态资源必须同步升 `pta/web/index.html` 里的 `?v=`（当前 `?v=20261110q`），否则 Cloudflare 继续发旧 js。
不要覆盖 `pta/web/assets/sites-data.local.js`、`pta/data/*.local.*`、`data/` 下任何文件。

## 常见故障对照

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 服务起不来，MODULE_NOT_FOUND | 只发了 app.js | 补发 adapters/nexusphp.js、secretbox.js |
| 页面白屏 / 按钮无反应 | 少了 data.js 或 ?v= 没升 | 补发 data.js、升版本号 |
| 线上行为像旧版 | Cloudflare 缓存 | 升 `?v=` 并硬刷新 |
| ssh 超时 | 22 端口时通时断 | 重试 base64 方式，别改端口 |
| 登录进不去 | 前端旧缓存 | 升 `?v=`；服务端 `POST /api/login` 本地应回 200 |

## 数据与不入库的东西

数据目录 `data/`（0600）：`config.json`、`site-config.json`、`queue.json`、`downloaders.json`、`credentials.json`、`events.log`、`.secret`。

只在本地/测试机、已被 gitignore：`pta/web/assets/sites-data.local.js`、`pta/data/{sites-bookmark.local.json,site-search.local.json,site-arch.local.csv,site-defs/,samples/,cookies.tmp.json}`、`docs` 里只有 example。

## 干活方式

- 本机命令用 Bash（MSYS），检查脚本是 `pta\checks\run.cmd`（5 段：adapter 5 / smoke 22 / audit 全部交互点 / security 2 / api 29）
- 改完：跑检查 → 提交（信息用中文一句话，说清做了什么）→ 发版 → 线上探活 → 更新 HANDOFF.md
- 一段工作结束就把 HANDOFF.md 的「现在是什么状态」改成事实，不要留旧数字
- 少工具步数：一条命令跑多步，先 grep/glob 定位再 read 局部，大输出先截断
- 不装依赖、不引入构建工具（这是设计约束，不是省事）

## 用户写需求的最低要求（四要素）

有效提需求的形状，缺一项我就得猜：

1. 要什么：一句话动词短语
2. 改哪里：文件名 / 接口路径 / 页面名
3. 怎么算成功：能验证的现象（某个检查通过、某个接口返回、页面某个状态）
4. 什么不许动：明确否定项

例：把站点页的登录方式改成只存 cookie，改 `pta/web/assets/app.js` 的登录设置页和 `pta/server/app.js` 的凭据接口；成功标准是保存后只回 hasCookie 且自检能出结论；不要动面板账号密码登录，不要再加 2FA。

改主意时直接说「现在以 X 为准」，不要让我从多条里推断哪条是最新的。
