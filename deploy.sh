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
sudo -n systemctl restart seedpod
sleep 1
systemctl is-active seedpod
curl -s -m 5 http://127.0.0.1:8080/api/health || true
echo

# 部署完成推一条 Telegram；没配凭据就静默跳过
if [ -f "$SRC/scripts/notify-tg.sh" ] && [ -f /etc/opencode-telegram-bot.env ]; then
  VER=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' /opt/seedpod/package.json | head -1)
  REV=$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo "?")
  OUT=$(bash "$SRC/scripts/notify-tg.sh" "SEEDPOD 已部署 v$VER ($REV)" 2>&1 || true)
  case "$OUT" in
    *'"ok":true'*) echo "TG 通知已发 v$VER ($REV)" ;;
    *) echo "TG 通知失败：$(printf '%s' "$OUT" | head -c 120)" ;;
  esac
fi
