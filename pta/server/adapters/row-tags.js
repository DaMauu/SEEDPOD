/* 从列表行/详情页 HTML 提取限制标签：禁转 / 限转 / HR / 独占 / DIY。
   站点通常用 tag/badge 元素或图标 title/alt 表达，URL 里的 tag_exclusive 只是站内字段名，
   并不等于“独占”（猫站就把 tag_exclusive 显示成“禁转”），所以只认可见文字和图标标签。
   HR 要避开 HR-HDTV 这类小组名，只认独立 HR / H&R / hit and run / hitandrun。 */
const HR_RE = /(^|[\s\[\(（])HR($|[\s\]\)）])|H&R|hit[\s&-]*and[\s&-]*run|hitandrun/i;
const RULES = [
  ['禁转', /禁转|禁止转载|禁止转发|(^|[^a-z0-9_=-])no[\s-]*re[\s-]*distribut/i],
  ['限转', /限转|(^|[^a-z0-9_=-])limited([^a-z0-9_=-]|$)/i],
  ['HR', HR_RE],
  ['独占', /独占|(^|[^a-z0-9_=-])exclusive([^a-z0-9_=-]|$)/i],
  ['DIY', /(^|[^a-z0-9_=-])diy([^a-z0-9_=-]|$)/i]
];

function unescapeHtml(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCharCode(parseInt(h, 16)); })
    .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(Number(d)); });
}
function stripNoise(html) {
  return unescapeHtml(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' '));
}
function textOf(html) {
  return unescapeHtml(String(html || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
function matchLabels(text) {
  const s = String(text || '');
  const out = [];
  RULES.forEach(function (x) { if (x[1].test(s) && out.indexOf(x[0]) < 0) out.push(x[0]); });
  return out;
}
function merge(out, add) {
  (add || []).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); });
  return out;
}
/* 只认“本身就是标签”的 class，避免 tag-row / sb-tag（全站筛选）这类容器被整块扫进来 */
function isTagToken(t) {
  const x = String(t || '').toLowerCase();
  return /^(?:torrents?|details?|search)?[-_]?tags?$/.test(x) ||
    x === 'badge' || x === 'label' ||
    /^torrent-search--list__tag$/.test(x);
}
function attrLabels(html) {
  const out = [];
  const re = /\b(?:title|alt|data-label|data-tag)\s*=\s*["']([^"']{1,160})["']/gi;
  let m;
  while ((m = re.exec(String(html || '')))) out.push(unescapeHtml(m[1]));
  return out;
}
function classMarks(html) {
  const s = String(html || '');
  const out = [];
  const re = /\bclass\s*=\s*["']([^"']+)["']/gi;
  let m;
  while ((m = re.exec(s))) {
    const toks = String(m[1] || '').toLowerCase().split(/\s+/);
    toks.forEach(function (t) {
      if (/^hit[\s_-]*(?:and[\s_-]*)?run(?:_icon)?$/.test(t) || /^hit[\s_-]*and[\s_-]*run$/.test(t)) out.push('HR');
      else if (t === 'no-redistribute' || t === 'no_redistribute' || t === 'noredistribute') out.push('禁转');
      else if (t === 'limited' || t === 'limited_icon') out.push('限转');
      else if (t === 'exclusive' || t === 'exclusive_icon') out.push('独占');
      else if (t === 'diy' || t === 'diy_icon') out.push('DIY');
    });
  }
  return out;
}
function tagElements(html) {
  const out = [];
  const openRe = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let m;
  while ((m = openRe.exec(String(html || '')))) {
    const attrs = m[2] || '';
    const cm = /\bclass\s*=\s*["']([^"']+)["']/i.exec(attrs);
    if (!cm) continue;
    const toks = String(cm[1] || '').split(/\s+/).filter(Boolean);
    if (!toks.some(isTagToken)) continue;
    const tag = String(m[1] || '').toLowerCase();
    const close = String(html || '').toLowerCase().indexOf('</' + tag + '>', openRe.lastIndex);
    const inner = close >= 0 ? String(html || '').slice(openRe.lastIndex, Math.min(close, openRe.lastIndex + 400)) : '';
    out.push({ attrs: attrs, text: textOf(inner) });
  }
  return out;
}

/* 列表行：tag 元素的文字 + 行内 title/alt（图标） */
function rowTags(html) {
  const s = stripNoise(html);
  const labels = [];
  tagElements(s).forEach(function (el) {
    if (el.text) labels.push(el.text);
    labels.push.apply(labels, attrLabels(el.attrs));
  });
  labels.push.apply(labels, attrLabels(s));
  return merge(matchLabels(labels.join(' ')), classMarks(s));
}

/* 详情页：只看 torrent 自己的 details-tag / torrents-tag 和 h1 里的 [禁转] 这类括号标记；
   全站搜索表单的 sb-tag 不看，避免每个详情都带同一个标签。 */
function detailTags(html) {
  const s = stripNoise(html);
  const labels = [];
  tagElements(s).forEach(function (el) {
    if (el.text) labels.push(el.text);
    labels.push.apply(labels, attrLabels(el.attrs));
  });
  const h1 = /<h1\b[^>]*>([\s\S]{0,3000}?)<\/h1>/i.exec(s);
  if (h1) {
    const inner = textOf(h1[1]);
    const brackets = [];
    inner.replace(/\[([^\]]{1,24})\]/g, function (_, x) { brackets.push(x); return ''; });
    labels.push(brackets.join(' '));
  }
  return merge(matchLabels(labels.join(' ')), classMarks(s));
}

/* 纯文本（标题/Tags 字段）：全字面匹配，URL 不参与 */
function textTags(text) {
  return matchLabels(unescapeHtml(text));
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

module.exports = { rowTags: rowTags, detailTags: detailTags, textTags: textTags, enclosingRow: enclosingRow, HR_RE: HR_RE };
