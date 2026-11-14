#!/usr/bin/env bash
# 开工前对一遍：本地 / GitHub（可选 VPS 仓库）。
# VPS 参数由 SSH_HOST / VPS_DIR 显式给；不写死主机路径。
set -uo pipefail
REPO=${REPO:-$(cd "$(dirname "$0")/.." && pwd)}
PROXY=${PROXY:-}
SSH_HOST=${SSH_HOST:-}
VPS_DIR=${VPS_DIR:-}

cd "$REPO" || exit 1
GIT=(git)
if [ -n "$PROXY" ]; then
  GIT+=(-c "http.proxy=$PROXY" -c "https.proxy=$PROXY")
fi
LOCAL=$(git rev-parse HEAD)
LOCAL_SHORT=$(git rev-parse --short HEAD)
DIRTY=$(git status --porcelain | head -5)
GH=$("${GIT[@]}" ls-remote origin refs/heads/main 2>/dev/null | awk '{print $1}')

echo "本地  ${LOCAL_SHORT}"
echo "GitHub ${GH:0:7}"

if [ -z "$GH" ]; then
  echo "对比失败：GitHub 取不到提交（网络/凭据），先别拉"; exit 2
fi

if [ -z "$SSH_HOST" ] || [ -z "$VPS_DIR" ]; then
  echo "跳过 VPS 对比（设置 SSH_HOST / VPS_DIR 后启用）"
  if [ "$LOCAL" = "$GH" ]; then
    echo "本地与 GitHub 一致，无需拉取"; exit 0
  fi
  if [ -n "$DIRTY" ]; then
    echo "本地有未提交改动："; echo "$DIRTY"; echo "先提交再拉"; exit 5
  fi
  echo "拉到最新…"
  "${GIT[@]}" pull --ff-only origin main 2>&1 | tail -5
  git log --oneline -1
  exit 0
fi

VPS_OUT=$(ssh -o BatchMode=yes -o ConnectTimeout=8 "$SSH_HOST" "cd \"$VPS_DIR\" && git rev-parse HEAD && git status --porcelain | head -5" 2>/dev/null)
VPS=$(echo "$VPS_OUT" | head -1)
VPS_DIRTY=$(echo "$VPS_OUT" | tail -n +2)

echo "VPS   ${VPS:0:7}"

if [ -z "$VPS" ]; then
  echo "对比失败：VPS 取不到提交（网络/凭据），先别拉"; exit 2
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
"${GIT[@]}" pull --ff-only origin main 2>&1 | tail -5
git log --oneline -1
