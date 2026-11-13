#!/usr/bin/env bash
# SEEDPOD 检查入口（Linux / macOS）。Windows 备用：run.cmd。
set -uo pipefail
cd "$(dirname "$0")/../.."

export PTA_PW="${PTA_PW:-$PWD/node_modules/playwright-core}"
fail=0

run() {
  echo
  echo "==== $1 ===="
  node "pta/checks/$2"
  local s=$?
  [ "$s" -eq 0 ] || fail=1
  return 0
}

run smoke smoke.js
run audit audit.js
run adapter adapter.js
run security security.js
run api api-v2.js

echo
echo "==== build (Vite) ===="
if npm run build >/tmp/pta-build.log 2>&1; then
  echo "构建通过"
  run web build.js
else
  tail -5 /tmp/pta-build.log
  echo "构建失败"
  fail=1
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "ALL CHECKS PASSED"
else
  echo "FAILED: 看上面各段输出"
fi
exit "$fail"
