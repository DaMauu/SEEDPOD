#!/usr/bin/env bash
# 恢复 SEEDPOD 数据：只覆盖备份里存在的文件，保留日志和其他运行文件。
# 用法：bash pta/scripts/restore.sh <backup.tar.gz> [数据目录]
# 目标已有 seedpod.db 时默认拒绝；确认覆盖用 FORCE=1。
set -euo pipefail
BACKUP="${1:?用法: restore.sh <backup.tar.gz> [data-dir]}"
DATA="${2:-${PTA_DATA:-data}}"

[ -f "$BACKUP" ] || { echo "备份不存在：$BACKUP" >&2; exit 1; }
LIST="$(tar -tzf "$BACKUP")" || { echo "备份读不出来：$BACKUP" >&2; exit 1; }
if printf '%s\n' "$LIST" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  echo "备份里有越界路径，拒绝恢复" >&2
  exit 1
fi
mkdir -p "$DATA"
if [ -f "$DATA/seedpod.db" ] && [ "${FORCE:-0}" != "1" ]; then
  echo "目标已有 seedpod.db；先备份或设 FORCE=1 再恢复" >&2
  exit 1
fi

tmp="${DATA}/.restore-$$"
rm -rf "$tmp"
mkdir -p "$tmp"
tar -xzf "$BACKUP" -C "$tmp" --no-same-owner
if [ ! -f "$tmp/seedpod.db" ]; then
  rm -rf "$tmp"
  echo "备份里没有 seedpod.db" >&2
  exit 1
fi
# 符号链接可能把恢复目标带到数据目录之外，直接拒绝
if find "$tmp" -type l | grep -q .; then
  rm -rf "$tmp"
  echo "备份里有符号链接，拒绝恢复" >&2
  exit 1
fi
# 先校验备份库，坏库不能覆盖现有数据
if NODE_NO_WARNINGS=1 node -e 'require("node:sqlite")' >/dev/null 2>&1; then
  if ! NODE_NO_WARNINGS=1 node -e '
const { DatabaseSync } = require("node:sqlite");
const db = new DatabaseSync(process.argv[1], { readOnly: true });
try {
  const r = db.prepare("PRAGMA integrity_check").get();
  process.exit(r && r.integrity_check === "ok" ? 0 : 1);
} finally { db.close(); }
' "$tmp/seedpod.db" 2>/dev/null; then
    rm -rf "$tmp"
    echo "备份里的 seedpod.db 校验失败，已保留现有数据" >&2
    exit 1
  fi
elif command -v sqlite3 >/dev/null 2>&1; then
  if [ "$(sqlite3 "$tmp/seedpod.db" 'PRAGMA integrity_check;' 2>/dev/null)" != "ok" ]; then
    rm -rf "$tmp"
    echo "备份里的 seedpod.db 校验失败，已保留现有数据" >&2
    exit 1
  fi
else
  echo "警告：没有 node:sqlite 或 sqlite3，跳过数据库校验" >&2
fi
[ -f "$tmp/.secret" ] || echo "警告：备份没有 .secret；如果凭据用文件密钥，恢复后无法解密" >&2

# 旧 WAL/SHM 必须清掉，否则会和恢复的 db 拼出旧状态
rm -f "$DATA/seedpod.db-wal" "$DATA/seedpod.db-shm"
for x in seedpod.db .secret auth.json presets.json sites.json site-urls.json cookies.json library.json site-status.json seedpod.db-wal seedpod.db-shm; do
  if [ -e "$tmp/$x" ]; then
    rm -rf "$DATA/$x"
    cp -a "$tmp/$x" "$DATA/$x"
  fi
done
rm -rf "$tmp"
chmod 600 "$DATA/seedpod.db" 2>/dev/null || true
[ -f "$DATA/.secret" ] && chmod 600 "$DATA/.secret"
echo "restore=$DATA"
