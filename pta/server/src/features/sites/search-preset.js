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
  if (/medium|source|媒介|片源/.test(n)) return 'medium';
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
function mapType(label, presets) {
  const t = typeOf(label);
  return presets.keyOf(t) || presets.keyOf(label) || '';
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
  const values = {};
  const params = {};
  const labels = {};
  let catMode = '';
  function addCat(label, id) {
    const key = mapType(label, presets);
    if (!key || id == null || id === '') return;
    cats[key] = cats[key] || [];
    if (cats[key].indexOf(String(id)) < 0) cats[key].push(String(id));
  }
  function addOpt(dim, fieldName, label, val) {
    const key = mapDim(dim, label, presets);
    if (!key || val == null || val === '') return;
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

  /* NexusPHP 常见分类链接：?cat401=1，文字就是分类名 */
  const re = /<a\b[^>]*href=["'][^"']*[?&]cat(\d+)=1[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const label = textOf(m[2]);
    if (!label) continue;
    addCat(label, m[1]);
    catMode = 'key';
  }

  return { cats: cats, catMode: catMode, values: values, params: params, labels: labels };
}

module.exports = { parseSearchPreset, dimOf, isCatField, mapType, mapDim, textOf };
