#!/usr/bin/env bash
# 把当前检出同步到运行目录 /opt/seedpod 并重启服务
# 排除：运行数据 data/、站点本地覆盖 sites-data.local.js、日志
set -euo pipefail
SRC=$(cd "$(dirname "$0")" && pwd)
rsync -rc --delete \
  --exclude "data/" \
  --exclude "web/assets/sites-data.local.js" \
  --exclude "*.log" \
  "$SRC/pta/" /opt/seedpod/pta/
rsync -c "$SRC/package.json" "$SRC/CHANGELOG.md" /opt/seedpod/
systemctl restart seedpod
sleep 1
systemctl is-active seedpod
curl -s -m 5 http://127.0.0.1:8080/api/health || true
echo
