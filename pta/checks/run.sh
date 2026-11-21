#!/usr/bin/env bash
# SEEDPOD 检查入口（Linux / macOS）。Windows 用 WSL / Git Bash 跑同一脚本。
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

echo "==== build (Vite) ===="
if npm run build >/tmp/pta-build.log 2>&1; then
  echo "构建通过"
else
  tail -5 /tmp/pta-build.log
  echo "构建失败"
  fail=1
fi

run smoke smoke-live.js
run responsive responsive-layout.js
run frontend-regress frontend-regress.js
run ui-visual ui-visual.js
run css-breakpoints css-breakpoints.js
run css-baseline-update css-baseline-update.js
run adapter adapter.js
run crawl-detail crawl-detail.js
run crawl-loop crawl-loop.js
run category-policy category-policy.js
run screen-type screen-type.js
run prepare-guard prepare-guard.js
run state-consistency state-consistency.js
run publish-id-capture publish-id-capture.js
run marks marks.js
run dupe-classify dupe-classify.js
run dupe-policy dupe-policy.js
run collage collage.js
run flow-config flow-config.js
run security security.js
run url-guard url-guard.js
run secret-rotate secret-rotate.js
run mock-shape mock-shape.js
run api api-v2.js
run form form.js
run catalog-bulk catalog-bulk.js
run catalog-item catalog-item.js
run site-pack site-pack.js
run site-pack-concurrency site-pack-concurrency.js
run backup backup.js
run day-boundary day-boundary.js
run backup-concurrency backup-concurrency.js
run backup-interrupt backup-interrupt.js
run deploy-docker deploy-docker.js
run publish publish.js
run publish-lock publish-lock.js
run publish-review-gate publish-review-gate.js
run scheduler scheduler.js
run scheduler-running scheduler-running.js
run scheduler-timer scheduler-timer.js
run scheduler-retry-backoff scheduler-retry-backoff.js
run review-branches review-branches.js
run scheduler-crossseed scheduler-crossseed.js
run crossseed crossseed.js
run scheduler-crawl scheduler-crawl.js
run scheduler-dedupe scheduler-dedupe.js
run scheduler-publish scheduler-publish.js
run scheduler-publish-gate scheduler-publish-gate.js
run scheduler-publish-concurrency scheduler-publish-concurrency.js
run failpoint failpoint.js
run errors errors.js
run failures failures.js
run failure-replay failure-replay.js
run failure-held failure-held.js
run replay-scheduler replay-scheduler.js
run dedupe-errors dedupe-errors.js
run rules-registry rules-registry.js
run config-migration config-migration.js
run transactions transactions.js
run db-concurrency db-concurrency.js
run fault-injection fault-injection.js
run request-queue request-queue.js
run env-names env-names.js
run detect detect.js
run torrent-clean torrent-clean.js
run target target.js
run target-pages-dns target-pages-dns.js
run target-upload-many target-upload-many.js
run target-submit target-submit.js
run target-pages-session target-pages-session.js
run target-lock target-lock.js
run upload-lock upload-lock.js
run target-defaults target-defaults.js
run meta meta.js
run mediainfo mediainfo.js
run imagehost imagehost.js
run meta-ext meta-ext.js
run media media.js
run media-api media-api.js
run clients clients.js
run qb-session qb-session.js
run qb-recovery qb-recovery.js
run target-discovery target-discovery.js
run downloader-policy downloader-policy.js
run downloader-probe downloader-probe.js
run cli cli.js
run resume resume.js
run sidecar sidecar.js
run stage stage.js
run notify notify.js
run web build.js

echo
echo "==== UI 冻结 ===="
node pta/scripts/ui-freeze.js
s=$?
[ "$s" -eq 0 ] || fail=1

echo
echo "==== 质量审计 ===="
node pta/scripts/audit-quality.js --project pta --fail
s=$?
[ "$s" -eq 0 ] || fail=1

echo
echo "==== 规则体检 ===="
node pta/scripts/audit-rules.js --fail
s=$?
[ "$s" -eq 0 ] || fail=1

echo
if [ "$fail" -eq 0 ]; then
  echo "ALL CHECKS PASSED"
else
  echo "FAILED: 看上面各段输出"
fi
exit "$fail"
