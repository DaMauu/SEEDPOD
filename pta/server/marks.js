/* 种子标记：禁转 / 限转 / 独占 / DIY。
   禁转与限转未满 7 天是硬规则，送审时必须拦；独占/DIY 只打标记。 */
const DAY = 86400000;

function marksOf(title) {
  const t = String(title || '');
  const m = {};
  if (/禁转|禁止转载|no\s*-?re-?distribut/i.test(t)) m.noRedistribute = true;
  if (/独占|exclusive/i.test(t)) m.exclusive = true;
  if (/diy/i.test(t)) m.diy = true;
  if (/限转|limited/i.test(t)) m.limited = true;
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
  const m = Object.assign({}, marksOf(item && item.title), (item && item.marks) || {});
  if (m.limited && !m.limitedDays) {
    const d = limitedDaysOf(item, nowMs);
    if (d) m.limitedDays = d;
  }
  return m;
}

function complianceReason(item, nowMs) {
  const m = effectiveMarks(item, nowMs);
  if (m.noRedistribute) return '禁转';
  if (m.limited && Number(m.limitedDays) > 0) return '限转未满 7 天';
  return '';
}

module.exports = { marksOf, limitedDaysOf, effectiveMarks, complianceReason };
