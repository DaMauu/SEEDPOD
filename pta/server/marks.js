/* 种子标记：禁转 / 限转 / HR / 独占 / DIY。
   禁转与限转未满 7 天是硬规则，送审时必须拦；独占/DIY/HR 只打标记。
   列表页的徽章、图标 title/alt、class 由适配器放进 item.tags，这里统一归一。 */
const textTags = require('./adapters/row-tags').textTags;

const DAY = 86400000;

function marksText(v) {
  if (v && typeof v === 'object') {
    const tags = Array.isArray(v.tags) ? v.tags.join(' ') : v.tags;
    return [v.title, tags, v.flags].filter(Boolean).join(' ');
  }
  return String(v == null ? '' : v);
}

function marksOf(v) {
  const tags = textTags(marksText(v));
  const m = {};
  if (tags.indexOf('禁转') >= 0) m.noRedistribute = true;
  if (tags.indexOf('限转') >= 0) m.limited = true;
  if (tags.indexOf('HR') >= 0) m.hr = true;
  if (tags.indexOf('独占') >= 0) m.exclusive = true;
  if (tags.indexOf('DIY') >= 0) m.diy = true;
  return m;
}

function limitedDaysOf(item, nowMs) {
  const raw = item && item.addedAt;
  if (!raw) return 0;
  const t = Date.parse(raw);
  if (!(t >= 0)) return 0;
  const age = (nowMs || Date.now()) - t;
  if (!(age >= 0 && age < 7 * DAY)) return 0;
  return Math.max(1, Math.ceil((7 * DAY - age) / DAY));
}

function effectiveMarks(item, nowMs) {
  const m = Object.assign({}, marksOf(item), (item && item.marks) || {});
  if (m.limited && !m.limitedDays) {
    const d = limitedDaysOf(item, nowMs);
    if (d) m.limitedDays = d;
  }
  return m;
}

/* 抓取卡“限制”行：命中任一选中的芯片就排除。单独抽出方便逐项回归。 */
function matchesLimit(item, selected, nowMs) {
  const want = Array.isArray(selected) ? selected.map(String) : [];
  if (!want.length) return false;
  const m = effectiveMarks(item, nowMs);
  if (want.indexOf('禁转') >= 0 && m.noRedistribute) return true;
  if (want.indexOf('限转') >= 0 && (m.limited || Number(m.limitedDays) > 0)) return true;
  if (want.indexOf('HR') >= 0 && m.hr) return true;
  if (want.indexOf('独占') >= 0 && m.exclusive) return true;
  if (want.indexOf('DIY') >= 0 && m.diy) return true;
  return false;
}

function complianceReason(item, nowMs) {
  const m = effectiveMarks(item, nowMs);
  if (m.noRedistribute) return '禁转';
  if (m.limited && Number(m.limitedDays) > 0) return '限转未满 7 天';
  return '';
}

module.exports = { marksOf, limitedDaysOf, effectiveMarks, matchesLimit, complianceReason };
