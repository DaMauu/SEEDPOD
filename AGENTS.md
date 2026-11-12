# SEEDPOD 开发约定（给 AI 代理）

## 目录
- 代码仓库：`/opt/seedpod-git`（当前分支 `server-v0.5.5`，跟踪 `origin/server-v0.5.5`）
- 运行目录：`/opt/seedpod`（systemd 服务 `seedpod`，`node pta/server/app.js`，端口 8080）
- 数据：`/opt/seedpod/data`（SQLite），不进仓库

## 流程
1. 只在 `/opt/seedpod-git` 里改代码，不要直接改 `/opt/seedpod`。
2. 改完执行 `./deploy.sh`：同步 `pta/` 到运行目录并重启服务，最后打印服务状态。
3. 用 `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8080/` 确认返回 200。
4. 提交：`git add -A && git commit -m "..."`，然后 `git push`（SSH deploy key 已配好，可直接推）。
5. 排查日志：`journalctl -u seedpod -n 50 --no-pager`（有 sudo 权限）。

## 禁止
- 不 force push，不动 `main` / `vue-migration` 历史。
- 不提交 `pta/data/`、`pta/web/assets/sites-data.local.js`、`.env`。
- 不对真实 PT 站点做反复探测或压测，抓取一律先干跑。

## 九、长期开发约定（2026-11-13 起）

1. 前端固定 Vue 3（自托管 vue.global.prod.js，无构建，render 函数以符合 CSP）；后端固定 Node 原生 http，零依赖。
2. 每次改完必须 commit 并 push 到现有分支，不新建分支；提交信息带版本号与要点。
3. 已定稿的样式与布局不乱改，只有作者明确要求调整细节/顺序/样式时才动。
4. 每轮改完部署测试机、截图核对、更新版本号与 CHANGELOG。
5. 无人干预时继续自动推进，不停工。

## 十、技术策略 v2（2026-11-13）

前端 Vue 3；后端 Node.js + Fastify；存储 SQLite（node:sqlite），词条/队列/站点/下载器/日志/账号与 cookie 全部入库，密文列保持 AES-256-GCM；迁移期间接口路径不变，搬完再切服务。细节见 PLAN.md。

## 十一、运行时（2026-11-13 切换）

生产 systemd 单元 seedpod 现在执行 `pta/server/app-fastify.js`（Node + Fastify 5 + SQLite），数据在 /opt/seedpod/data（seedpod.db，JSON 为迁移前备份）。回滚步骤：`cp /opt/seedpod/seedpod.service.bak /etc/systemd/system/seedpod.service && systemctl daemon-reload && systemctl restart seedpod`，旧数据在 data-backup-* 目录。真抓取与真发帖仍返回 501，只做演练。
