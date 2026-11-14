#!/usr/bin/env bash
# 把当前开发进度推到作者 Telegram。只读 PROGRESS.md，不打印 token。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FILE="${PROGRESS_FILE:-$ROOT/pta/docs/PROGRESS.md}"
ENV_FILE="${TELEGRAM_ENV_FILE:-${ENV_FILE:-}}"

if [ ! -f "$FILE" ]; then
  echo "找不到进度文件：$FILE" >&2
  exit 1
fi

goal="$(sed -n 's/^当前 goal：\*\*\(.*\)\*\*$/\1/p' "$FILE" | head -1)"
pct="$(sed -n 's/^当前 goal 进度：\*\*\(.*\)\*\*$/\1/p' "$FILE" | head -1)"
total="$(sed -n 's/^总进度：\*\*\(.*\)\*\*$/\1/p' "$FILE" | head -1)"
note="${1:-}"

[ -n "$goal" ] || goal="未知"
[ -n "$pct" ] || pct="—"
[ -n "$total" ] || total="—"

MSG="🛠 SEEDPOD 开发进度
当前：$goal · $pct
总进度：$total"
[ -n "$note" ] && MSG="$MSG
$note"

ENV_FILE="$ENV_FILE" bash "$ROOT/scripts/notify-tg.sh" "$MSG"
