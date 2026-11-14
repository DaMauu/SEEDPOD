#!/usr/bin/env bash
# 备份 SEEDPOD 数据：SQLite 一致性快照、密钥、私有站点配置；不含日志和旧备份。
# 用法：bash pta/scripts/backup.sh [数据目录] [输出文件]
set -euo pipefail
DATA="${PTA_DATA:-${1:-data}}"
OUT="${2:-seedpod-backup-$(date +%Y%m%d-%H%M%S).tar.gz}"

if [ ! -f "$DATA/seedpod.db" ]; then
  echo "找不到 seedpod.db：$DATA" >&2
  exit 1
fi

STAGE="${TMPDIR:-/tmp}/seedpod-backup-stage-$$"
TMPOUT="${OUT}.tmp-$$"
ERR="${TMPDIR:-/tmp}/seedpod-backup-err-$$"
cleanup() { rm -rf "$STAGE" "$TMPOUT" "$ERR"; }
trap cleanup EXIT
rm -rf "$STAGE"
mkdir -p "$STAGE"

# SQLite 可能开着 WAL；用 VACUUM INTO 做一致性快照，避免只拷主文件丢数据。
SNAPSHOT=0
if NODE_NO_WARNINGS=1 node -e '
const { DatabaseSync } = require("node:sqlite");
const src = process.argv[1], dst = process.argv[2];
const q = "\x27" + dst.replace(/\x27/g, "\x27\x27") + "\x27";
const db = new DatabaseSync(src, { readOnly: true });
try { db.exec("VACUUM INTO " + q); } finally { db.close(); }
' "$DATA/seedpod.db" "$STAGE/seedpod.db" 2>"$ERR"; then
  SNAPSHOT=1
else
  # 没有 node:sqlite 时退回“主文件 + WAL/SHM”一起拷，恢复时也不会丢 WAL。
  cp -a "$DATA/seedpod.db" "$STAGE/seedpod.db"
  [ -f "$DATA/seedpod.db-wal" ] && cp -a "$DATA/seedpod.db-wal" "$STAGE/seedpod.db-wal"
  [ -f "$DATA/seedpod.db-shm" ] && cp -a "$DATA/seedpod.db-shm" "$STAGE/seedpod.db-shm"
fi

for x in .secret site-defs site-pack.json library.json site-search.local.json site-status.json seedpod.db-wal seedpod.db-shm; do
  case "$x" in
    seedpod.db-wal|seedpod.db-shm) [ "$SNAPSHOT" = "1" ] && continue ;;
  esac
  [ -e "$DATA/$x" ] && [ ! -e "$STAGE/$x" ] && cp -a "$DATA/$x" "$STAGE/$x"
done

tar -czf "$TMPOUT" -C "$STAGE" .
mv "$TMPOUT" "$OUT"
chmod 600 "$OUT"
echo "backup=$OUT files=$(find "$STAGE" -maxdepth 1 -mindepth 1 | wc -l | tr -d ' ')"
