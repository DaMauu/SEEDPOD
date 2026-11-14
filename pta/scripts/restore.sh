#!/usr/bin/env bash
# 恢复 SEEDPOD 数据：只覆盖备份里存在的文件，保留日志和其他运行文件。
# 用法：bash pta/scripts/restore.sh <backup.tar.gz> [数据目录]
# 目标已有 seedpod.db 时默认拒绝；确认覆盖用 FORCE=1。
set -euo pipefail
BACKUP="${1:?用法: restore.sh <backup.tar.gz> [data-dir]}"
DATA="${2:-${PTA_DATA:-data}}"

[ -f "$BACKUP" ] || { echo "备份不存在：$BACKUP" >&2; exit 1; }
if tar -tzf "$BACKUP" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
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
tar -xzf "$BACKUP" -C "$tmp"
if [ ! -f "$tmp/seedpod.db" ]; then
  rm -rf "$tmp"
  echo "备份里没有 seedpod.db" >&2
  exit 1
fi

# 旧 WAL/SHM 必须清掉，否则会和恢复的 db 拼出旧状态
rm -f "$DATA/seedpod.db-wal" "$DATA/seedpod.db-shm"
for x in seedpod.db .secret site-defs site-pack.json library.json site-search.local.json site-status.json seedpod.db-wal seedpod.db-shm; do
  if [ -e "$tmp/$x" ]; then
    rm -rf "$DATA/$x"
    cp -a "$tmp/$x" "$DATA/$x"
  fi
done
rm -rf "$tmp"
chmod 600 "$DATA/seedpod.db" 2>/dev/null || true
[ -f "$DATA/.secret" ] && chmod 600 "$DATA/.secret"
echo "restore=$DATA"
