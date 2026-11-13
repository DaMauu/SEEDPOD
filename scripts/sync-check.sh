#!/usr/bin/env bash
# 开工前对一遍三方状态：本地 / GitHub / VPS 仓库
# 一致（VPS 与 GitHub 同一个提交）才把最新代码拉到本地
set -uo pipefail
REPO=${REPO:-$(cd "$(dirname "$0")/.." && pwd)}
PROXY=${PROXY:-http://127.0.0.1:4399}
SSH_HOST=${SSH_HOST:-pta}
VPS_DIR=${VPS_DIR:-/opt/seedpod-git}

cd "$REPO" || exit 1
LOCAL=$(git rev-parse HEAD)
LOCAL_SHORT=$(git rev-parse --short HEAD)
DIRTY=$(git status --porcelain | head -5)

GH=$(git -c http.proxy="$PROXY" -c https.proxy="$PROXY" ls-remote origin refs/heads/main 2>/dev/null | awk '{print $1}')

VPS_OUT=$(ssh -o BatchMode=yes -o ConnectTimeout=8 "$SSH_HOST" "cd $VPS_DIR && git rev-parse HEAD && git status --porcelain | head -5" 2>/dev/null)
VPS=$(echo "$VPS_OUT" | head -1)
VPS_DIRTY=$(echo "$VPS_OUT" | tail -n +2)

echo "本地  ${LOCAL_SHORT}"
echo "GitHub ${GH:0:7}"
echo "VPS   ${VPS:0:7}"

if [ -z "$GH" ] || [ -z "$VPS" ]; then
  echo "对比失败：GitHub 或 VPS 取不到提交（网络/凭据），先别拉"; exit 2
fi
if [ -n "$VPS_DIRTY" ]; then
  echo "VPS 仓库有未提交改动："; echo "$VPS_DIRTY"; echo "先处理再拉"; exit 3
fi
if [ "$VPS" != "$GH" ]; then
  echo "VPS 和 GitHub 不一致：以谁为准先确认，不自动拉"; exit 4
fi

if [ "$LOCAL" = "$GH" ]; then
  echo "三方已一致，无需拉取"; exit 0
fi
if [ -n "$DIRTY" ]; then
  echo "本地有未提交改动："; echo "$DIRTY"; echo "先提交再拉"; exit 5
fi
echo "拉到最新…"
git -c http.proxy="$PROXY" -c https.proxy="$PROXY" pull --ff-only origin main 2>&1 | tail -5
git log --oneline -1
