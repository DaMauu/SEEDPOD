# 站点识别体检

目标：对每个有 cookie 的站做一次只读识别，记录搜索分类、上传表单、上传分类控件、未识别项和与已保存配置的差异，供后续分批修正。

## 请求限制

- 每站最多 3 个请求：搜索页 GET 1 次，上传页 GET 最多 2 次（默认路径 404/405 才试一次备用路径）。
- 不重试、不跟随登录跳转、不提交上传、不遍历分类详情。
- 同一站两次请求间隔至少 10 秒；站与站之间也串行。
- 遇到 429/403/503、验证码、登录跳转立即停止该站；连续限流停止整批。
- 只使用用户已保存的该站 cookie；不新建账号、不换 IP、不绕限制。

## 运行

```bash
node pta/server/scripts/audit-site-detection.js \
  --data <数据目录> --out <输出目录> \
  --limit 5 --delay 10000 --include-no-cookie --resume
```

- 默认只处理有 cookie 的站；`--include-no-cookie` 只记录缺 cookie，不发请求。
- `--resume` 跳过已有 `sites/<host>.json` 的站，适合分批。
- `--stop-after-rate 2`：连续两个站被限流就停整批。

## 产物

- `sites/<host>.json`：单站识别结果、差异、问题代码、请求数。
- `raw/<host>/search.html`、`upload.html`：原始页面，仅本地人工复核，0600。
- `last-run.json`：本批汇总。
- `summary.json` / `summary.md` / `notes.md`：统计和人工笔记。

原始 HTML 可能含账号信息或 CSRF token，只放本地数据目录，不复制到仓库、不打印、不提交。
