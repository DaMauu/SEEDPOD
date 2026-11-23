/* 站点 JSON 格式化：每个站固定四块。
   meta 一行；search 四行；publish 四行；settings 一行。
   只负责排版，不改字段；所有写入 sites.json / sites.preset.json 的地方都走这里。 */

function isPlain(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }

function inline(v) {
  if (v === undefined || v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return '[' + v.map(inline).join(', ') + ']';
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (!keys.length) return '{}';
    return '{ ' + keys.map(function (k) { return JSON.stringify(k) + ': ' + inline(v[k]); }).join(', ') + ' }';
  }
  return JSON.stringify(String(v));
}
function kv(k, v) { return JSON.stringify(k) + ': ' + inline(v); }
function pick(obj, keys) {
  return keys.filter(function (k) { return obj[k] !== undefined; })
    .map(function (k) { return kv(k, obj[k]); });
}
function join(parts) { return parts.filter(Boolean).join(', '); }

const SEARCH_KNOWN = ['path', 'params', 'catMode', 'catSlot', 'type', 'medium', 'codec', 'audio',
  'resolution', 'discount', 'restriction', 'team', 'selected', 'labels', 'limits', 'downloadLink', 'refreshCron'];
const PUBLISH_KNOWN = ['upload', 'verify', 'type', 'medium', 'codec', 'audio', 'resolution', 'discount',
  'restriction', 'team', 'tagMap', 'tagValue', 'form', 'valueMaps', 'baseValueMaps'];

/* search 四行：
   1 请求参数
   2 类型 / 媒介 / 编码 / 音频
   3 分辨率 / 优惠 / 限制 / 制作组
   4 已选 / 站点标签 / 抓取限制 */
function searchLines(s) {
  const x = s || {};
  const extra = Object.keys(x).filter(function (k) { return SEARCH_KNOWN.indexOf(k) < 0; })
    .map(function (k) { return kv(k, x[k]); });
  const lines = [
    join(pick(x, ['path', 'params', 'catMode', 'catSlot'])),
    join(pick(x, ['type', 'medium', 'codec', 'audio'])),
    join(pick(x, ['resolution', 'discount', 'restriction', 'team'])),
    join(pick(x, ['selected', 'labels', 'limits', 'downloadLink', 'refreshCron']).concat(extra))
  ];
  return lines.filter(Boolean);
}

/* publish 四行：
   1 上传 / 回查
   2 类型 / 媒介 / 编码 / 音频
   3 分辨率 / 优惠 / 限制 / 制作组
   4 标签 / 表单 / 值映射 */
function publishLines(p) {
  const x = p || {};
  const extra = Object.keys(x).filter(function (k) { return PUBLISH_KNOWN.indexOf(k) < 0; })
    .map(function (k) { return kv(k, x[k]); });
  const lines = [
    join(pick(x, ['upload', 'verify'])),
    join(pick(x, ['type', 'medium', 'codec', 'audio'])),
    join(pick(x, ['resolution', 'discount', 'restriction', 'team'])),
    join(pick(x, ['tagMap', 'tagValue', 'form', 'valueMaps', 'baseValueMaps']).concat(extra))
  ];
  return lines.filter(Boolean);
}

function formatSite(host, site, last) {
  const s = site || {};
  const lines = [];
  lines.push('    ' + JSON.stringify(host) + ': {');
  lines.push('      "meta": ' + inline(s.meta || {}) + ',');

  const sl = searchLines(s.search);
  lines.push('      "search": {');
  sl.forEach(function (line, i) { lines.push('        ' + line + (i === sl.length - 1 ? '' : ',')); });
  lines.push('      },');

  const pl = publishLines(s.publish);
  lines.push('      "publish": {');
  pl.forEach(function (line, i) { lines.push('        ' + line + (i === pl.length - 1 ? '' : ',')); });
  lines.push('      }' + (s.settings !== undefined || (s.extra && Object.keys(s.extra).length) ? ',' : ''));

  if (s.settings !== undefined) {
    lines.push('      "settings": ' + inline(s.settings) + (s.extra && Object.keys(s.extra).length ? ',' : ''));
  }
  if (s.extra && Object.keys(s.extra).length) lines.push('      "extra": ' + inline(s.extra));
  lines.push('    }' + (last ? '' : ','));
  return lines.join('\n');
}

function formatSitesDoc(doc) {
  const d = doc || {};
  const sites = d.sites || {};
  const hosts = Object.keys(sites);
  const head = [];
  const order = Object.keys(d).filter(function (k) { return k !== 'sites'; });
  /* 常用头字段先写，保证每次输出顺序一致 */
  ['version', 'presets', 'generatedAt'].forEach(function (k) {
    if (d[k] !== undefined) { head.push('  ' + kv(k, d[k])); order.splice(order.indexOf(k), 1); }
  });
  order.forEach(function (k) { head.push('  ' + kv(k, d[k])); });
  const blocks = hosts.map(function (h, i) { return formatSite(h, sites[h], i === hosts.length - 1); });
  const body = blocks.length ? '\n\n' + blocks.join('\n\n') + '\n' : '';
  return '{\n' + head.join(',\n') + (head.length ? ',\n' : '') + '  "sites": {' + body + '  }\n}\n';
}

/* 搜索维度选项字符串：
   medium: "bluray = medium1 = 1"（key = 参数名 = 值）
   其他:   "standard = 1"（参数名 = 值） */
function parseSearchOption(str, withKey) {
  const parts = String(str == null ? '' : str).split(/\s*=\s*/);
  if (withKey) {
    if (parts.length >= 3) return { key: parts[0], param: parts[1], value: parts.slice(2).join(' = ') };
    if (parts.length === 2) return { key: '', param: parts[0], value: parts[1] };
    return { key: '', param: '', value: parts[0] || '' };
  }
  if (parts.length >= 2) return { key: '', param: parts[0], value: parts.slice(1).join(' = ') };
  return { key: '', param: '', value: parts[0] || '' };
}
function formatSearchOption(key, param, value, withKey) {
  if (withKey) return [key, param, value].filter(function (x) { return x !== '' && x !== undefined && x !== null; }).join(' = ');
  return [param, value].filter(function (x) { return x !== '' && x !== undefined && x !== null; }).join(' = ');
}

/* 发布维度选项字符串：
   type:   "402"（只有一个值）
   媒介:   "full_disc = 1"（key = 值） */
function parsePublishOption(str) {
  const parts = String(str == null ? '' : str).split(/\s*=\s*/);
  if (parts.length >= 2) return { key: parts[0], value: parts.slice(1).join(' = ') };
  return { key: '', value: parts[0] || '' };
}
function formatPublishOption(key, value) {
  return [key, value].filter(function (x) { return x !== '' && x !== undefined && x !== null; }).join(' = ');
}

module.exports = {
  isPlain, inline, formatSite, formatSitesDoc, searchLines, publishLines,
  parseSearchOption, formatSearchOption, parsePublishOption, formatPublishOption
};
