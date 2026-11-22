/* 发布阶段：统一 queue.data 里的 stage/attempts/error/nextRetry/evidence。
   只改对象，不写库；调用方负责 save。 */
const STAGES = ['draft', 'prepared', 'previewed', 'submitted', 'injected', 'failed'];
const MAX_HISTORY = 20;

function now() { return new Date().toISOString(); }

const STATUSES = ['pending', 'approved', 'published', 'failed', 'rejected', 'skipped', 'dupe', 'selected'];

function ensure(item) {
  if (!item || typeof item !== 'object') return item;
  if (STAGES.indexOf(item.stage) < 0) {
    /* 旧数据没 stage 时按工作状态推断，避免一眼 draft 但其实已发布 */
    if (item.status === 'published') item.stage = 'injected';
    else if (item.status === 'failed') item.stage = 'failed';
    else item.stage = 'draft';
  }
  if (!Number.isFinite(Number(item.stageAttempts))) item.stageAttempts = 0;
  if (!Array.isArray(item.stageHistory)) item.stageHistory = [];
  if (!item.stageEvidence || typeof item.stageEvidence !== 'object' || Array.isArray(item.stageEvidence)) item.stageEvidence = {};
  return item;
}

function set(item, next, opts) {
  ensure(item);
  const o = opts || {};
  const target = STAGES.indexOf(next) >= 0 ? next : 'draft';
  /* submitted/injected 是终态：只允许前进到 injected 或失败，不能被 prepare/preview 回退 */
  if (item.stage === 'injected' && target !== 'failed') return item;
  if (item.stage === 'submitted' && target !== 'injected' && target !== 'failed' && target !== 'submitted') return item;
  item.stage = target;
  item.stageUpdatedAt = now();
  if (o.countAttempt !== false) item.stageAttempts = Number(item.stageAttempts || 0) + 1;
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

/* 阶段（流水线）与状态（工作流）可以分开，但组合必须自洽；返回问题清单。 */
function validate(item) {
  const it = item || {};
  const out = [];
  if (STAGES.indexOf(it.stage) < 0) out.push('stage 不在枚举里：' + String(it.stage || ''));
  if (it.status !== undefined && STATUSES.indexOf(it.status) < 0) out.push('status 不在枚举里：' + String(it.status || ''));
  if (!Number.isInteger(Number(it.stageAttempts)) || Number(it.stageAttempts) < 0) out.push('stageAttempts 不是非负整数');
  if (it.stage === 'failed' && !String(it.stageLastError || it.pubMsg || '').trim()) out.push('failed 没有错误信息');
  if (it.stage !== 'failed' && it.stageNextRetryAt) out.push('非 failed 还留着下次重试时间');
  if (it.status === 'published' && it.stage !== 'injected') out.push('published 但 stage 不是 injected');
  if (it.stage === 'injected' && it.status && it.status !== 'published') out.push('injected 但 status 不是 published');
  if (it.status === 'failed' && it.stage !== 'failed') out.push('status failed 但 stage 不是 failed');
  const h = Array.isArray(it.stageHistory) ? it.stageHistory[it.stageHistory.length - 1] : null;
  if (h && h.stage !== it.stage) out.push('stageHistory 最后一条与 stage 不一致');
  return out;
}

function isSubmitted(item) { return !!(item && (item.stage === 'submitted' || item.stage === 'injected')); }
function isInjected(item) { return !!(item && item.stage === 'injected'); }

module.exports = { STAGES, STATUSES, ensure, validate, set, fail, isSubmitted, isInjected };
