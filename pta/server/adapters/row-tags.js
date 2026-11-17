/* 从列表行 HTML 提取限制标签：禁转 / 限转 / HR / 独占 / DIY。
   站点多数用徽章、图标 title/alt 或 class 表达，不在标题里；只在行内找，不猜详情页。
   HR 要避开 HR-HDTV 这类小组名，所以只认单词边界或 H&R / hit and run / hitandrun。 */
const HR_RE = /(^|[\s\[\(（])HR($|[\s\]\)）])|H&R|hit[\s&-]*and[\s&-]*run|hitandrun/i;
const RULES = [
  ['禁转', /禁转|禁止转载|禁止转发|no[\s-]*re[\s-]*distribut/i],
  ['限转', /限转|(^|[^a-z])limited([^a-z]|$)/i],
  ['HR', HR_RE],
  ['独占', /独占|(^|[^a-z])exclusive([^a-z]|$)/i],
  ['DIY', /(^|[^a-z])diy([^a-z]|$)/i]
];

function unescapeHtml(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); });
}

function rowTags(html) {
  const s = unescapeHtml(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' '));
  const out = [];
  RULES.forEach(function (x) {
    if (x[1].test(s) && out.indexOf(x[0]) < 0) out.push(x[0]);
  });
  return out;
}

/* 找链接所在的整行 <tr>；找不到就返回空串，让调用方退回窗口解析 */
function enclosingRow(src, idx) {
  const s = String(src || '');
  const i = Number(idx);
  if (!(i >= 0)) return '';
  const open = s.lastIndexOf('<tr', i);
  if (open < 0 || i - open > 20000) return '';
  const close = s.indexOf('</tr>', i);
  if (close < 0 || close - open > 20000) return '';
  return s.slice(open, close + 5);
}

module.exports = { rowTags: rowTags, enclosingRow: enclosingRow, HR_RE: HR_RE };
