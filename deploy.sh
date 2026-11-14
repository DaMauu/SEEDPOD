#!/usr/bin/env bash
# 把当前检出同步到 DEPLOY_DIR 并重启服务。
# 部署参数放未入库的 .deploy.env 或环境变量；仓库里不写死主机路径。
set -euo pipefail
SRC=$(cd "$(dirname "$0")" && pwd)
if [ -f "$SRC/.deploy.env" ]; then
  set -a
  . "$SRC/.deploy.env"
  set +a
fi
DEPLOY_DIR=${DEPLOY_DIR:-}
SERVICE_NAME=${SERVICE_NAME:-seedpod}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:${PTA_PORT:-8080}/api/health}
if [ -z "$DEPLOY_DIR" ]; then
  echo "缺少 DEPLOY_DIR：在未入库的 .deploy.env 里设置 DEPLOY_DIR=<部署目录>，或运行时导出。" >&2
  exit 2
fi
case "$DEPLOY_DIR" in
  /*) ;;
  *) echo "DEPLOY_DIR 必须是绝对路径" >&2; exit 2 ;;
esac

# 前端构建：有 web-src 就先装依赖再出 dist，失败直接停
if [ -d "$SRC/pta/web-src" ]; then
  ( cd "$SRC" && npm ci --no-audit --no-fund && npm run build )
fi
rsync -rc --delete \
  --exclude "data/" \
  --exclude "web/assets/sites-data.local.js" \
  --exclude "*.log" \
  "$SRC/pta/" "$DEPLOY_DIR/pta/"
rsync -c "$SRC/package.json" "$SRC/CHANGELOG.md" "$DEPLOY_DIR/"
sudo -n systemctl restart "$SERVICE_NAME"
sleep 1
systemctl is-active "$SERVICE_NAME"
curl -s -m 5 "$HEALTH_URL" || true
echo

# 部署完成推一条 Telegram；ENV_FILE 由本地环境显式给，没给就跳过
TG_ENV_FILE=${TELEGRAM_ENV_FILE:-}
if [ -f "$SRC/scripts/notify-tg.sh" ] && [ -n "$TG_ENV_FILE" ] && [ -f "$TG_ENV_FILE" ]; then
  VER=$(sed -n 's/.*"version": "\([^"]*\)".*/\1/p' "$DEPLOY_DIR/package.json" | head -1)
  REV=$(git -C "$SRC" rev-parse --short HEAD 2>/dev/null || echo "?")
  OUT=$(ENV_FILE="$TG_ENV_FILE" bash "$SRC/scripts/notify-tg.sh" "SEEDPOD 已部署 v$VER ($REV)" 2>&1 || true)
  case "$OUT" in
    *'"ok":true'*) echo "TG 通知已发 v$VER ($REV)" ;;
    *) echo "TG 通知失败：$(printf '%s' "$OUT" | head -c 120)" ;;
  esac
fi
