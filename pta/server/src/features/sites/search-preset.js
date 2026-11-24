/* 搜索页预设识别：从一次 GET 的 HTML 里解析分类 ID 和搜索维度。
   纯函数，不联网；分类标签归一到全局大分类，选项参数名按站点原样保存。 */
const form = require('../../infra/form');
const { typeOf } = require('../crawl/category');

function textOf(html) {
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
}
function token(x) {
  return String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function dimOf(name) {
  const n = String(name || '').toLowerCase();
  if (/medium|source|media|媒介|片源/.test(n)) return 'medium';
  if (/standard|resolution|分辨/.test(n)) return 'resolution';
  if (/spstate|discount|free|优惠/.test(n)) return 'discount';
  if (/restriction|limit|禁转|限转|\bhr\b/.test(n)) return 'restriction';
  if (/audiocodec|audio|音频/.test(n)) return 'audio';
  if (/codec|编码/.test(n)) return 'codec';
  if (/team|group|制作组|小组/.test(n)) return 'team';
  return '';
}
function isCatField(name) {
  const n = String(name || '').toLowerCase();
  if (/medium|source|standard|resolution|codec|audio|team|spstate|discount|restriction|search|keyword|page|sort/.test(n)) return false;
  return /cat|category|type|分类|类型/.test(n);
}
function inputLabel(html, name) {
  const n = String(name || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('<input[^>]*name=["\']' + n + '["\'][^>]*>', 'i');
  const m = re.exec(html);
  if (!m) return '';
  const after = html.slice(m.index + m[0].length, m.index + m[0].length + 80).split('<')[0];
  return after.replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}
function attrMap(raw) {
  const out = {};
  String(raw || '').replace(/([a-zA-Z0-9_:.\-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g, function (_, k, _q, a, b, c) {
    out[String(k).toLowerCase()] = a !== undefined ? a : (b !== undefined ? b : (c || ''));
    return '';
  });
  return out;
}
function labelFor(html, id) {
  const n = String(id || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('<label[^>]*for=["\']' + n + '["\'][^>]*>([\\s\\S]*?)<\\/label>', 'i');
  const m = re.exec(html);
  return m ? textOf(m[1]) : '';
}
/* 复选框的标签可能在前面、后面，或把 input 包在 label 里 */
function labelNear(html, start, len, attrs) {
  if (attrs && attrs.id) {
    const l = labelFor(html, attrs.id);
    if (l) return l;
  }
  const after = html.slice(start + len, start + len + 400);
  const m1 = /^\s*<label\b[^>]*>([\s\S]*?)<\/label>/i.exec(after);
  if (m1 && !/<input\b/i.test(m1[1])) return textOf(m1[1]);
  const before = html.slice(Math.max(0, start - 400), start);
  const labels = Array.from(before.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi));
  if (labels.length) {
    const last = labels[labels.length - 1];
    const tail = before.slice(last.index + last[0].length);
    if (!tail.trim()) return textOf(last[1]);
  }
  const open = html.lastIndexOf('<label', start);
  const close = html.lastIndexOf('</label>', start);
  if (open > close) {
    const end = html.indexOf('</label>', start);
    if (end > start) return textOf(html.slice(open, end).replace(/<input\b[^>]*>/gi, ' '));
  }
  return after.split('<')[0].replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
}
/* NexusPHP 分类复选框：<input name="cat401"> 旁边是 <a href="?cat=401"><img alt="Movies/电影"></a> */
function labelFromNearLink(html, start, len) {
  const after = html.slice(start + len, start + len + 500);
  const img = /<img\b[^>]*(?:alt|title)=["']([^"']+)["'][^>]*>/i.exec(after);
  if (img) return textOf(img[1]);
  const a = /<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(after);
  return a ? textOf(a[1]) : '';
}
function mapType(label, presets) {
  /* 样品/预告已不是内容类型，站点分类里出现时并到“其他” */
  if (/^(?:样品|sample|预告|trailers?)(?:\b|\s|\/|$)/i.test(String(label || '').trim())) return presets.keyOf('其他') || 'other';
  /* Unit3D 的单独 “TV Shows” 是剧集；带中文“综艺”的仍按综艺走 */
  if (/^tv\s*shows?$/i.test(String(label || '').trim())) return presets.keyOf('剧集') || 'tv';
  const t = typeOf(label);
  const key = presets.keyOf(t) || presets.keyOf(label) || '';
  return key && presets.types()[key] ? key : '';
}
function mapDim(dim, label, presets) {
  const k = presets.keyOfDim(dim, label);
  if (k) return k;
  if (dim === 'codec' || dim === 'audio') {
    const t = token(label);
    if (t) return t;
  }
  if (dim === 'team') return String(label || '').trim();
  return '';
}

function parseSearchPreset(html, presets) {
  const cats = {};
  const catLabels = {};
  const values = {};
  const params = {};
  const labels = {};
  const unmatched = [];
  let catMode = '';
  function addUnmatched(dim, label, value) {
    const text = String(label || '').trim();
    if (!text) return;
    if (unmatched.some(function (x) { return x.dim === dim && x.label === text; })) return;
    unmatched.push({ dim: dim, label: text, value: value == null ? '' : String(value) });
  }
  function addCat(label, id) {
    const key = mapType(label, presets);
    if (!key) { addUnmatched('type', label, id); return; }
    if (id == null || id === '') return;
    cats[key] = cats[key] || [];
    if (cats[key].indexOf(String(id)) < 0) cats[key].push(String(id));
    if (catLabels[String(id)] == null) catLabels[String(id)] = String(label || '');
  }
  function addOpt(dim, fieldName, label, val) {
    const key = mapDim(dim, label, presets);
    if (!key) { addUnmatched(dim, label, val); return; }
    if (val == null || val === '') return;
    values[dim] = values[dim] || {};
    params[dim] = params[dim] || {};
    labels[dim] = labels[dim] || {};
    if (values[dim][key] == null) {
      values[dim][key] = String(val);
      params[dim][key] = String(fieldName || '');
      labels[dim][key] = String(label || '');
    }
  }

  for (const f of form.parse(html)) {
    for (const fld of (f.fields || [])) {
      const opts = Array.isArray(fld.options) ? fld.options : [];
      const name = String(fld.name || '');
      if (opts.length && isCatField(name + ' ' + String(fld.label || ''))) {
        const bracket = /\[\]/.test(name);
        if (!catMode) catMode = bracket ? 'bracket' : 'single';
        opts.forEach(function (o) {
          const label = String(o.label || '').trim();
          const val = String(o.value || '').trim();
          if (!label || !val || val === '0' || /请选择|全部|不限|choose|select|all/i.test(label)) return;
          addCat(label, val);
        });
        continue;
      }
      /* Unit3D: <input type=checkbox name="categories[0][]" value="1"> + <label>Movies</label> */
      if (!opts.length && /checkbox|radio/i.test(String(fld.type || '')) && isCatField(name + ' ' + String(fld.label || ''))) {
        const label = String(fld.label || '').trim();
        const val = String(fld.value || '').trim();
        if (label && val && val !== '0' && !/请选择|全部|不限|choose|select|all/i.test(label)) {
          addCat(label, val);
          if (/\[\]/.test(name)) catMode = catMode === 'key' ? catMode : 'bracket';
          else if (!catMode) catMode = 'single';
        }
        continue;
      }
      const dim = dimOf(name + ' ' + String(fld.label || ''));
      if (!dim) continue;
      if (!opts.length) {
        const val = String(fld.value || '').trim();
        if (val && /checkbox|radio/i.test(String(fld.type || ''))) {
          addOpt(dim, name, inputLabel(html, name) || String(fld.label || ''), val);
        }
        continue;
      }
      opts.forEach(function (o) {
        const label = String(o.label || '').trim();
        const val = String(o.value || '').trim();
        if (!label || !val || val === '0' || /请选择|全部|不限|choose|select|all/i.test(label)) return;
        addOpt(dim, name, label, val);
      });
    }
  }

  /* NexusPHP 常见分类链接：?cat401=1，文字就是分类名。
     组合链接（?cat406=1&cat408=1）是站点预设，不是单个分类，跳过。 */
  const re = /<a\b[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = String(m[1] || '').replace(/&amp;/gi, '&');
    const ids = Array.from(href.matchAll(/[?&]cat(\d+)=1/gi)).map(function (x) { return x[1]; });
    if (ids.length !== 1) continue;
    const label = textOf(m[2]);
    if (!label) continue;
    addCat(label, ids[0]);
    catMode = 'key';
  }

  /* Unit3D 等复选框分类：name="categories[0][]" value="1" + <label for="cat_1">Movies</label>。
     form.parse 会把同名复选框合并成一个，这里直接扫 input 才能拿全。 */
  const inputs = /<input\b([^>]*)>/gi;
  while ((m = inputs.exec(html))) {
    const a = attrMap(m[1]);
    const type = String(a.type || '').toLowerCase();
    if (type !== 'checkbox' && type !== 'radio') continue;
    const name = String(a.name || '');
    const live = String(a['wire:model.live'] || a['wire:model'] || '');
    if (!isCatField(name) && !/categoryIds|category_ids/i.test(live)) continue;
    const val = String(a.value || '').trim();
    if (!val || val === '0') continue;
    const label = labelNear(html, m.index, m[0].length, a) || inputLabel(html, name) || labelFromNearLink(html, m.index, m[0].length);
    if (!label || /请选择|全部|不限|choose|select|all/i.test(label)) continue;
    const catId = (/^cat(\d+)$/i.exec(name) || [])[1] || val;
    addCat(label, catId);
    if (/^cat\d+$/i.test(name)) catMode = 'key';
    else if ((/\[\]/.test(name) || /categoryIds|category_ids/i.test(live)) && catMode !== 'key') catMode = 'bracket';
    else if (!catMode) catMode = 'single';
  }

  return { cats: cats, catLabels: catLabels, catMode: catMode, values: values, params: params, labels: labels, unmatched: unmatched };
}

module.exports = { parseSearchPreset, dimOf, isCatField, mapType, mapDim, textOf };
