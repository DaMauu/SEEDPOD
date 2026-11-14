#!/usr/bin/env bash
# 把当前开发进度推到作者 Telegram。只读 PROGRESS.md，不打印 token。
# 一条消息包含“工作中 + 百分比 + 总进度”；默认置顶，新进度替换旧置顶。
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

MSG="🛠 工作中：$goal · $pct
📊 总进度：$total
🕒 更新：$(date '+%m-%d %H:%M')"
[ -n "$note" ] && MSG="$MSG
$note"

TG_PIN="${TG_PIN:-1}" ENV_FILE="$ENV_FILE" bash "$ROOT/scripts/notify-tg.sh" "$MSG"
