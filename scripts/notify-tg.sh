#!/usr/bin/env bash
# 把进度推给作者 Telegram：凭据只从环境文件读，不打印 token。
# TG_PIN=1 时发送后置顶；会先取消上一条自己置顶的消息。
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

RESP=$(curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_ALLOWED_USER_ID}" \
  --data-urlencode "text=${MSG}" 2>/dev/null || true)

SAFE=$(printf '%s' "$RESP" | sed "s/${TELEGRAM_BOT_TOKEN}/<token>/g" | head -c 300)
printf '%s\n' "$SAFE"

if [ "${TG_PIN:-0}" = "1" ]; then
  MID=$(printf '%s' "$RESP" | sed -n 's/.*"message_id":\([0-9][0-9]*\).*/\1/p' | head -1)
  if [ -n "$MID" ]; then
    STATE="${TG_PIN_STATE:-${XDG_CACHE_HOME:-$HOME/.cache}/seedpod/tg-pin}"
    OLD=""
    [ -f "$STATE" ] && OLD=$(cat "$STATE" 2>/dev/null || true)
    if [ -n "$OLD" ] && [ "$OLD" != "$MID" ]; then
      curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/unpinChatMessage" \
        --data-urlencode "chat_id=${TELEGRAM_ALLOWED_USER_ID}" \
        --data-urlencode "message_id=${OLD}" >/dev/null 2>&1 || true
    fi
    PIN_RESP=$(curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/pinChatMessage" \
      --data-urlencode "chat_id=${TELEGRAM_ALLOWED_USER_ID}" \
      --data-urlencode "message_id=${MID}" \
      --data-urlencode "disable_notification=true" 2>/dev/null || true)
    case "$PIN_RESP" in
      *'"ok":true'*) echo "pin=ok" ;;
      *) echo "pin=fail" ;;
    esac
    mkdir -p "$(dirname "$STATE")" 2>/dev/null || true
    printf '%s' "$MID" > "$STATE" 2>/dev/null || true
  else
    echo "pin=skip"
  fi
fi
