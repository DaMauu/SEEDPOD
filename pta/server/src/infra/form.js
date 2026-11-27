/* 上传表单识别：纯函数，输入 HTML，输出表单字段；不联网、不依赖第三方解析器。
   只做“够用”的解析：form/action、input/textarea/select、label/placeholder。 */

function decode(s) {
  return String(s == null ? '' : s)
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
}
function attr(tag, name) {
  const re = new RegExp('\\b' + name + '\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s>]+))', 'i');
  const m = re.exec(tag || '');
  return m ? decode(m[1] !== undefined ? m[1] : (m[2] !== undefined ? m[2] : m[3])) : '';
}
function plain(s) {
  return decode(String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}
function labelFor(body, id) {
  if (!id) return '';
  const re = new RegExp('<label\\b[^>]*\\bfor\\s*=\\s*["\']' + id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\'][^>]*>([\\s\\S]*?)</label>', 'i');
  const m = re.exec(body || '');
  return m ? plain(m[1]) : '';
}
function guessTemplate(name, type, label, placeholder) {
  if (String(type || '').toLowerCase() === 'file') return '';
  const n = String(name || '').toLowerCase();
  /* 外部 ID 不是内容分类；存在标记也不该复用 ID 模板 */
  if (/^imdb$/.test(n)) return '{imdb}';
  if (/^(tmdb|tvdb|mal|igdb)([_-]|$)/.test(n)) return '';
  if (/^(title|movie|tv|anime|game)_exists_on_/.test(n)) return '';
  const s = [name, label, placeholder].join(' ').toLowerCase();
  if (/小标题|副标题|subtitle|small.?desc|\bsub\b/.test(s)) return '{subtitle}';
  if (/简介|描述|介绍|desc|intro|description|body|content/.test(s)) return '{description}';
  if (/分类|类别|类型|category|cat|\btype\b/.test(s)) return '{catId}';
  if (/匿名|anonymous|\banon\b/.test(s)) return '{anonymous}';
  if (/来源|媒介|source|medium/.test(s)) return '{source}';
  /* 音频字段优先于视频编码：audiocodec_sel 同时含 audio 和 codec，
     不能因为先命中 codec 就被写成视频编码模板。 */
  if (/音轨|音频|audiocodec|audio[\s_-]?codec|audio[\s_-]?(format|sel|quality)?(?!book)/.test(s)) return '{audio}';
  if (/视频编码|编码|codec|video.?code/.test(s)) return '{codec}';
  if (/分辨率|resolution|\bres\b/.test(s)) return '{resolution}';
  if (/制作组|压制组|team|group/.test(s)) return '{team}';
  if (/年份|year/.test(s)) return '{year}';
  if (/imdb/i.test(s)) return '{imdb}';
  if (/截图|图片|shots?|image|poster/.test(s)) return '{shots}';
  if (/标题|片名|title|\bname\b/.test(s)) return '{title}';
  return '';
}

function labelNear(body, start, len, id, allowBare) {
  const direct = labelFor(body, id);
  if (direct) return direct;
  const after = String(body || '').slice(start + len, start + len + 300);
  const next = /^\s*<label\b[^>]*>([\s\S]*?)<\/label>/i.exec(after);
  if (next && !/<input\b/i.test(next[1])) return plain(next[1]);
  const before = String(body || '').slice(Math.max(0, start - 300), start);
  const labels = Array.from(before.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/gi));
  if (labels.length) {
    const last = labels[labels.length - 1];
    if (!before.slice(last.index + last[0].length).trim()) return plain(last[1]);
  }
  const open = String(body || '').lastIndexOf('<label', start);
  const close = String(body || '').lastIndexOf('</label>', start);
  if (open > close) {
    const end = String(body || '').indexOf('</label>', start);
    if (end > start) return plain(String(body || '').slice(open, end).replace(/<input\b[^>]*>/gi, ' '));
  }
  const a = /^\s*<a\b[^>]*>([\s\S]*?)<\/a>/i.exec(after);
  if (a) return plain(a[1]);
  /* 有些复选框后面直接跟文本，例如 <input ...> Blu-ray */
  if (!allowBare) return '';
  const bare = after.split('<')[0].replace(/\s+/g, ' ').trim();
  return bare ? plain(bare).slice(0, 80) : '';
}

function parseFields(body) {
  const fields = [];
  const byName = {};
  function push(f) {
    if (!f.name) return;
    const cur = byName[f.name];
    if (!cur) {
      byName[f.name] = f;
      fields.push(f);
      return;
    }
    /* 同名 checkbox/radio 是同一组选项；同名 select 也合并选项。 */
    if ((cur.type === 'checkbox' || cur.type === 'radio') && f.type === cur.type) {
      (f.options || []).forEach(function (o) {
        if (!cur.options.some(function (x) { return String(x.value) === String(o.value) })) cur.options.push(o);
      });
      if (f.checked) { cur.checked = true; if (f.value) cur.value = f.value; }
    } else if (cur.type === 'select' && f.type === 'select') {
      (f.options || []).forEach(function (o) {
        if (!cur.options.some(function (x) { return String(x.value) === String(o.value) })) cur.options.push(o);
      });
    }
  }
  let m;
  const inputRe = /<input\b([^>]*)>/gi;
  while ((m = inputRe.exec(body))) {
    const tag = m[1];
    const type = (attr(tag, 'type') || 'text').toLowerCase();
    const name = attr(tag, 'name');
    if (!name || type === 'submit' || type === 'button' || type === 'reset') continue;
    const id = attr(tag, 'id');
    const isChoice = type === 'checkbox' || type === 'radio';
    const label = labelNear(body, m.index, m[0].length, id, isChoice);
    const placeholder = attr(tag, 'placeholder');
    const value = attr(tag, 'value') || (isChoice ? 'on' : '');
    const checked = isChoice && /\bchecked\b/i.test(tag);
    const optionLabel = label || attr(tag, 'title') || placeholder || name;
    push({ name: name, type: type, label: optionLabel,
      value: value, checked: checked, placeholder: placeholder,
      options: isChoice ? [{ value: value, label: optionLabel }] : [],
      template: guessTemplate(name, type, label, placeholder) });
  }
  const areaRe = /<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/gi;
  while ((m = areaRe.exec(body))) {
    const tag = m[1];
    const name = attr(tag, 'name');
    if (!name) continue;
    const id = attr(tag, 'id');
    const label = labelFor(body, id);
    const placeholder = attr(tag, 'placeholder');
    push({ name: name, type: 'textarea', label: label || placeholder || name,
      value: plain(m[2]), placeholder: placeholder, options: [],
      template: guessTemplate(name, 'textarea', label, placeholder) });
  }
  const selectRe = /<select\b([^>]*)>([\s\S]*?)<\/select>/gi;
  while ((m = selectRe.exec(body))) {
    const tag = m[1];
    const name = attr(tag, 'name');
    if (!name) continue;
    const id = attr(tag, 'id');
    const label = labelFor(body, id);
    const options = [];
    const optRe = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
    let om;
    while ((om = optRe.exec(m[2]))) {
      options.push({ value: attr(om[1], 'value') || plain(om[2]), label: plain(om[2]) });
    }
    push({ name: name, type: 'select', label: label || name,
      value: '', placeholder: '', options: options,
      template: guessTemplate(name, 'select', label, '') });
  }
  return fields;
}

function parse(html) {
  const text = String(html || '');
  if (!text.trim()) return [];
  const forms = [];
  const formRe = /<form\b([^>]*)>([\s\S]*?)<\/form>/gi;
  let m;
  while ((m = formRe.exec(text))) {
    const fields = parseFields(m[2]);
    if (!fields.length) continue;
    let action = attr(m[1], 'action');
    try { if (/^https?:\/\//i.test(action)) action = new URL(action).pathname; } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
    forms.push({
      action: action || '',
      method: (attr(m[1], 'method') || 'post').toLowerCase(),
      enctype: attr(m[1], 'enctype') || '',
      fileField: (fields.filter(function (f) { return f.type === 'file' })[0] || {}).name || '',
      fields: fields
    });
  }
  if (!forms.length) {
    const fields = parseFields(text);
    if (fields.length) {
      forms.push({ action: '', method: 'post', enctype: '', fileField: (fields.filter(function (f) { return f.type === 'file' })[0] || {}).name || '', fields: fields });
    }
  }
  return forms;
}

module.exports = { parse: parse, guessTemplate: guessTemplate, decode: decode };
