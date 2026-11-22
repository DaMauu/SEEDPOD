/* 目标站文本/HTML 解析与模板字段工具：纯函数，不碰网络和数据库。 */
const presets = require('../presets/store')();

function catMapOf(p, def, built) {
  const out = {};
  const b = built && built.catMap;
  if (b && !Array.isArray(b) && typeof b === 'object') Object.assign(out, b);
  const raw = (p && p.catMap) || (def && def.catMap);
  if (Array.isArray(raw)) {
    raw.forEach(function (x) {
      if (x && x.id != null && x.purpose) out[x.purpose] = String(x.id);
    });
  } else if (raw && typeof raw === 'object') {
    Object.assign(out, raw);
  }
  /* 站点只存 key；上传表单如果按中文选项名匹配，这里从全局预设补中文别名 */
  Object.keys(out).forEach(function (k) {
    const zh = presets.labelOf(k);
    if (zh && zh !== k && out[zh] == null) out[zh] = out[k];
  });
  return out;
}

/* 副标题：只用源副标题或中文名，不拼分辨率和体积 */
function composeSubtitle(item) {
  return String(item && (item.subtitle || item.cn) || '').trim().slice(0, 200);
}

function expand(s, v) {
  return String(s == null ? '' : s).replace(/\{([a-zA-Z0-9_]+)\}/g, function (_, k) {
    return v[k] != null ? String(v[k]) : '';
  }).slice(0, 60000);
}

function hideContent(text, kind) {
  const m = new RegExp('\\[hide=' + kind + '\\]([\\s\\S]*?)\\[\\/hide\\]', 'i').exec(String(text || ''));
  return m ? String(m[1]).trim() : '';
}
function stripHide(text, kind) {
  return String(text || '').replace(new RegExp('\\[hide=' + kind + '\\][\\s\\S]*?\\[\\/hide\\]', 'gi'), '').replace(/\n{3,}/g, '\n\n').trim();
}
/* Unit3D 各站字段名不统一：bdinfo / bd_info / disc_info / video_info / media_info / mi_info
   都认；站点包直接把 {bdinfo}/{mediainfo} 塞进别的字段时，也按模板内容认。 */
function infoFieldKey(fields, kind) {
  const keys = Object.keys(fields || {});
  const token = '{' + kind + '}';
  const byTemplate = keys.filter(function (k) {
    const tpl = String(fields[k] || '');
    return tpl.indexOf(token) >= 0 && tpl.indexOf('{description}') < 0;
  })[0];
  if (byTemplate) return byTemplate;
  const re = kind === 'bdinfo'
    ? /(^|[^a-z])(bd|bdmv|disc|disk|video)[-_ ]?info([^a-z]|$)/i
    : /(^|[^a-z])(media|mi)[-_ ]?info([^a-z]|$)/i;
  return keys.filter(function (k) { return re.test(k) && !/descr|description/i.test(k); })[0] || '';
}
function descrFieldKey(fields) {
  return Object.keys(fields || {}).filter(function (k) {
    return /\{description\}/i.test(String(fields[k])) || /^(descr|description)$/i.test(k);
  })[0] || '';
}

function attrsOf(tag) {
  const out = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
  let m;
  while ((m = re.exec(String(tag || '')))) out[m[1].toLowerCase()] = m[3] !== undefined ? m[3] : (m[4] !== undefined ? m[4] : m[5]);
  return out;
}
function textOf(html) {
  return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}
function isDeletedPageText(html) {
  const t = textOf(html);
  if (!t) return false;
  return /(种子|资源|torrent).{0,20}(已被|曾被|已被管理员|被).{0,20}(删除|移除)|回收站|recycle\s*bin|torrent.{0,30}(has been|was)\s+(deleted|removed)/i.test(t);
}
function parseDeleteForm(html) {
  const forms = [];
  const re = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) forms.push({ attrs: attrsOf(m[1]), body: m[2] });
  const f = forms.filter(function (x) { return /delete\.php/i.test(String(x.attrs.action || '')) || /reason/i.test(x.body); })[0];
  if (!f) return null;
  const hidden = {}, submit = [], radios = [], reasonFields = [];
  let current = null;
  const tagRe = /<(input|textarea)\b([^>]*)>/gi;
  let tm;
  while ((tm = tagRe.exec(f.body))) {
    const tag = String(tm[1] || '').toLowerCase();
    const a = attrsOf(tm[2]);
    if (!a.name) continue;
    const type = String(a.type || 'text').toLowerCase();
    if (tag === 'input' && type === 'hidden') hidden[a.name] = a.value || '';
    if (tag === 'input' && type === 'submit') submit.push({ name: a.name, value: a.value || '' });
    if (tag === 'input' && type === 'radio' && /^reason_?type$/i.test(a.name)) {
      current = { name: a.name, value: String(a.value || ''), index: tm.index, reasonFields: [], reasonIdx: [] };
      radios.push(current);
    } else if ((tag === 'textarea' && /reason/i.test(a.name)) || (tag === 'input' && (type === 'text' || type === '') && /^reason/i.test(a.name))) {
      const ri = reasonFields.length;
      reasonFields.push(a.name);
      if (current) { current.reasonFields.push(a.name); current.reasonIdx.push(ri); }
    }
  }
  radios.forEach(function (r, i) {
    const end = i + 1 < radios.length ? radios[i + 1].index : f.body.length;
    r.label = textOf(f.body.slice(r.index, end)).slice(0, 120);
  });
  return {
    action: f.attrs.action || 'delete.php', hidden: hidden, submit: submit,
    radioName: radios.length ? radios[0].name : '', radios: radios,
    reasonFields: reasonFields, reasonField: reasonFields[0] || ''
  };
}
function downloadLinksFromDetails(text, base) {
  const safe = String(text || '').replace(/&amp;/g, '&');
  const raw = [];
  const patterns = [
    /(?:href|src)=["']([^"']*(?:download\.php\?[^"']*?\bid=\d+|torrents?\.php\?action=download[^"']*|torrents?\/download\/\d+|\/download\/\d+)[^"']*)["']/gi,
    /(download\.php\?[^"'\s<>]*?\bid=\d+[^"'\s<>]*)/gi
  ];
  patterns.forEach(function (re) {
    let m;
    while ((m = re.exec(safe))) if (m[1]) raw.push(m[1]);
  });
  const seen = {};
  const out = [];
  raw.forEach(function (x) {
    try {
      const u = new URL(x, base + '/');
      if (!/^https?:$/i.test(u.protocol)) return;
      const key = u.toString();
      if (seen[key]) return;
      seen[key] = true;
      out.push(key);
    } catch (e) { /* 忽略：失败不影响主流程 */ }
  });
  return out;
}

module.exports = {
  catMapOf, composeSubtitle, expand, hideContent, stripHide, infoFieldKey, descrFieldKey,
  attrsOf, textOf, isDeletedPageText, parseDeleteForm, downloadLinksFromDetails
};
