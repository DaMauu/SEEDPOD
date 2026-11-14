#!/usr/bin/env bash
# 把进度推给作者 Telegram：凭据只从环境文件读，不打印 token
set -euo pipefail
if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_ALLOWED_USER_ID:-}" ]; then
  [ -n "${ENV_FILE:-}" ] && [ -f "$ENV_FILE" ] || {
    echo "missing Telegram env: set TELEGRAM_BOT_TOKEN / TELEGRAM_ALLOWED_USER_ID or ENV_FILE" >&2
    exit 1
  }
  set -a; . "$ENV_FILE"; set +a
fi
MSG=${1:-}
[ -n "$MSG" ] || MSG=$(cat)
curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_ALLOWED_USER_ID}" \
  --data-urlencode "text=${MSG}" | sed "s/${TELEGRAM_BOT_TOKEN}/<token>/g" | head -c 300
echo
