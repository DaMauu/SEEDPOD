/* 发布阶段：统一 queue.data 里的 stage/attempts/error/nextRetry/evidence。
   只改对象，不写库；调用方负责 save。 */
const STAGES = ['draft', 'prepared', 'previewed', 'submitted', 'injected', 'failed'];
const MAX_HISTORY = 20;

function now() { return new Date().toISOString(); }

function ensure(item) {
  if (!item || typeof item !== 'object') return item;
  if (STAGES.indexOf(item.stage) < 0) item.stage = 'draft';
  if (!Number.isFinite(Number(item.stageAttempts))) item.stageAttempts = 0;
  if (!Array.isArray(item.stageHistory)) item.stageHistory = [];
  if (!item.stageEvidence || typeof item.stageEvidence !== 'object' || Array.isArray(item.stageEvidence)) item.stageEvidence = {};
  return item;
}

function set(item, next, opts) {
  ensure(item);
  const o = opts || {};
  item.stage = STAGES.indexOf(next) >= 0 ? next : 'draft';
  item.stageUpdatedAt = now();
  item.stageAttempts = Number(item.stageAttempts || 0) + 1;
  item.stageLastError = o.error ? String(o.error).slice(0, 500) : '';
  item.stageNextRetryAt = o.error ? String(o.nextRetryAt || '') : '';
  if (o.evidence) item.stageEvidence = Object.assign({}, item.stageEvidence || {}, o.evidence);
  if (item.stage === 'failed') item.stageFailedFrom = String(o.failedFrom || item.stageFailedFrom || '');
  else item.stageFailedFrom = '';
  item.stageHistory.push({ stage: item.stage, at: item.stageUpdatedAt, ok: !o.error, error: o.error ? String(o.error).slice(0, 200) : '' });
  if (item.stageHistory.length > MAX_HISTORY) item.stageHistory.splice(0, item.stageHistory.length - MAX_HISTORY);
  return item;
}

function fail(item, from, error, delayMs) {
  const wait = Math.max(60000, Number(delayMs) || 15 * 60000);
  return set(item, 'failed', {
    error: error || '失败',
    failedFrom: from || item.stage || 'draft',
    nextRetryAt: new Date(Date.now() + wait).toISOString()
  });
}

function isSubmitted(item) { return !!(item && (item.stage === 'submitted' || item.stage === 'injected')); }
function isInjected(item) { return !!(item && item.stage === 'injected'); }

module.exports = { STAGES, ensure, set, fail, isSubmitted, isInjected };
