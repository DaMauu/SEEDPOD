# 每次会话固定动作（照此执行，不要跳）

单写原则：同一时间只有一边在改，两边都只用 `main`，不新建分支。

## 开工

1. `cd SEEDPOD && bash scripts/sync-check.sh`（Linux 开发机；Windows 仅备用）
   - 输出「三方已一致」→ 直接开工
   - 输出「VPS 和 GitHub 不一致」或「VPS 有未提交改动」→ 停下，先问作者以谁为准
   - 本地落后 → 脚本会自己 `pull --ff-only`
2. 读 `HANDOFF.md` 的「现在是什么状态」，确认线上版本与最近改动。

## 每轮自查五问（写在改完之前）

1. 这条规则谁会读？服务端哪个文件、哪一行？
2. 什么时候读？请求时、发布前、还是只存配置？
3. 不设置会怎样？默认值是什么？
4. 当前体量/结构是否越过切换线（单文件 2000 行、同文件改 3 次、契约对不上）？
5. 这块对标 UA/upbrr 的哪一块？查过并记录到 `pta/docs/UPSTREAM.md` 了吗？

答不上来就不动代码；`node pta/scripts/audit-rules.js` 能查出服务端 0 命中的规则。

## 改完（在开发机）

1. 前端只改 `pta/web-src`，升 `package.json` 版本；Vite 产物带 hash，不再手改 `?v=`
2. `CHANGELOG.md` 记一条（删除 / 新增 / 优化 / 调整 / 重排）
3. `git add -A && git commit -m "0.7.xx 一句话" && git push origin main`
   - 只有 Windows 推送才要带代理：`git -c http.proxy=http://127.0.0.1:4399 -c https.proxy=http://127.0.0.1:4399 push origin main`

## 发版

```
ssh <部署主机> 'cd <部署仓库> && git pull --ff-only && DEPLOY_DIR=<部署目录> bash deploy.sh'
```

`deploy.sh` 会 rsync 到 `$DEPLOY_DIR`、重启服务、打印 health，并推一条 Telegram。
不要 rsync 覆盖：`data/`、`*.local.*`。

## 收尾

1. `bash scripts/sync-check.sh` 确认三方一致
2. 更新 `HANDOFF.md` 里的「现在是什么状态」和本轮改动
3. 一段工作结束提醒作者 `/compact`，或先写 HANDOFF 再开新会话

## 在 VPS 这边（Telegram 对话时）

1. `cd <部署仓库> && git pull --ff-only`
2. 改代码 → `git add -A && git commit && git push origin main`（部署密钥已配好）
3. `bash deploy.sh`

## 出事时

- push 被拒（non-fast-forward）：先 `git pull --ff-only` 再推；不要 force
- 两边都改了同一文件：停下，把两边 diff 给作者看，由他决定保留哪边
- VPS 拉不下来：`ssh -T git@github.com` 看密钥是否还在，密钥在 `~/.ssh/github_seedpod`
