/* 从列表行/详情页 HTML 提取限制标签：禁转 / 限转 / HR / 独占 / DIY。
   站点通常用 tag/badge 元素或图标 title/alt 表达，URL 里的 tag_exclusive 只是站内字段名，
   并不等于“独占”（猫站就把 tag_exclusive 显示成“禁转”），所以只认可见文字和图标标签。
   HR 要避开 HR-HDTV 这类小组名，只认独立 HR / H&R / hit and run / hitandrun。
   整页都有 HR 图标不代表全站 HR（可能只是当前页全是官方种），仍按行判断。 */
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
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    /* 面板/审计脚本注入的“跳过: 禁转/独占”徽章不是站点标记 */
    .replace(/<span\b[^>]*class=["'][^"']*pt-audit-badge[^"']*["'][^>]*>[\s\S]{0,400}?<\/span>/gi, ' '));
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
/* 只收图标/标签元素的 title/alt，别把种子标题链接的 title 当标记 */
function attrLabels(html) {
  const out = [];
  const src = String(html || '');
  const openRe = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let m;
  while ((m = openRe.exec(src))) {
    const tag = String(m[1] || '').toLowerCase();
    const attrs = m[2] || '';
    const cm = /\bclass\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const cls = cm ? String(cm[1] || '').toLowerCase() : '';
    if (tag !== 'img' && !/tag|badge|label|mark|flag|icon/.test(cls)) continue;
    const re = /\b(?:title|alt|data-label|data-tag)\s*=\s*["']([^"']{1,160})["']/gi;
    let a;
    while ((a = re.exec(attrs))) out.push(unescapeHtml(a[1]));
  }
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
/* 标签元素或彩色小徽章：class 是 tag/badge，或者行内 style 带颜色/背景 */
function labelElements(html) {
  const out = [];
  const src = String(html || '');
  const openRe = /<([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let m;
  while ((m = openRe.exec(src))) {
    const attrs = m[2] || '';
    const cm = /\bclass\s*=\s*["']([^"']+)["']/i.exec(attrs);
    const toks = cm ? String(cm[1] || '').split(/\s+/).filter(Boolean) : [];
    const byClass = toks.some(isTagToken);
    const byStyle = /\bstyle\s*=\s*["'][^"']*(?:background|color)\s*:[^"']*["']/i.test(attrs);
    if (!byClass && !byStyle) continue;
    const tag = String(m[1] || '').toLowerCase();
    const close = src.toLowerCase().indexOf('</' + tag + '>', openRe.lastIndex);
    const inner = close >= 0 ? src.slice(openRe.lastIndex, Math.min(close, openRe.lastIndex + 400)) : '';
    const t = textOf(inner);
    if (!t || t.length > 48) continue;
    out.push({ attrs: attrs, text: t });
  }
  return out;
}

/* 行内正文去掉标题链接文字，剩下用中文关键词兜底；不扫“独占”（可能是“全网独占”这类宣传语） */
const TEXT_RULES = RULES.filter(function (x) { return x[0] !== '独占'; });
function visibleWithoutTitles(html) {
  const s = textOf(String(html || '')
    .replace(/<a\b[^>]*(?:details\.php\?[^"']*id=\d+|\/torrents\/\d+)[^>]*>[\s\S]{0,400}?<\/a>/gi, ' '));
  const out = [];
  TEXT_RULES.forEach(function (x) { if (x[1].test(s) && out.indexOf(x[0]) < 0) out.push(x[0]); });
  return out.join(' ');
}

/* 列表行：标签/彩色徽章 + 行内 title/alt（图标）+ 去掉标题后的正文兜底 */
function rowTags(html) {
  const s = stripNoise(html);
  const labels = [];
  labelElements(s).forEach(function (el) {
    if (el.text) labels.push(el.text);
    labels.push.apply(labels, attrLabels(el.attrs));
  });
  labels.push.apply(labels, attrLabels(s));
  labels.push(visibleWithoutTitles(s));
  return merge(matchLabels(labels.join(' ')), classMarks(s));
}

/* 详情页：只看 torrent 自己的 details-tag / torrents-tag、标题区徽章和 h1 里的 [禁转]；
   全站搜索表单的 sb-tag 不看，避免每个详情都带同一个标签。 */
function detailTags(html) {
  const s = stripNoise(html);
  const labels = [];
  labelElements(s).forEach(function (el) {
    /* 详情页只收 details-tag/torrents-tag/tag 这类，不扫全站彩色广告条 */
    if (!/details?[-_]?tag|torrents?[-_]?tag|(^|\s)tag(\s|$)/i.test(el.attrs)) return;
    if (el.text) labels.push(el.text);
    labels.push.apply(labels, attrLabels(el.attrs));
  });
  const h1 = /<h1\b[^>]*>([\s\S]{0,3000}?)<\/h1>/i.exec(s);
  if (h1) {
    const inner = textOf(h1[1]);
    const brackets = [];
    inner.replace(/\[([^\]]{1,24})\]/g, function (_, x) { brackets.push(x); return ''; });
    labels.push(brackets.join(' '));
    const after = s.slice(h1.index + h1[0].length, h1.index + h1[0].length + 1600);
    labelElements(after).forEach(function (el) {
      if (el.text) labels.push(el.text);
    });
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
