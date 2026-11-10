#!/bin/sh
# 以 root 启动时先修数据目录属主（bind mount 常见问题），再降权运行。
set -e
if [ "$(id -u)" = "0" ]; then
  mkdir -p "${PTA_DATA:-/data}"
  chown -R pta:pta "${PTA_DATA:-/data}" 2>/dev/null || true
  exec su-exec pta "$@"
fi
exec "$@"
