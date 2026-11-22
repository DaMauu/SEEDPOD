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
  const s = [name, label, placeholder].join(' ').toLowerCase();
  if (/小标题|副标题|subtitle|small.?desc|\bsub\b/.test(s)) return '{subtitle}';
  if (/简介|描述|介绍|desc|intro|description|body|content/.test(s)) return '{description}';
  if (/分类|类别|类型|category|cat|\btype\b/.test(s)) return '{catId}';
  if (/匿名|anonymous|\banon\b/.test(s)) return '{anonymous}';
  if (/来源|媒介|source|medium/.test(s)) return '{source}';
  if (/编码|视频编码|codec|video.?code/.test(s)) return '{codec}';
  if (/分辨率|resolution|\bres\b/.test(s)) return '{resolution}';
  if (/制作组|压制组|team|group/.test(s)) return '{team}';
  if (/年份|year/.test(s)) return '{year}';
  if (/imdb/i.test(s)) return '{imdb}';
  if (/截图|图片|shots?|image|poster/.test(s)) return '{shots}';
  if (/音轨|audio/.test(s)) return '{audio}';
  if (/标题|片名|title|\bname\b/.test(s)) return '{title}';
  return '';
}

function parseFields(body) {
  const fields = [];
  const seen = {};
  function push(f) {
    if (!f.name || seen[f.name]) return;
    seen[f.name] = true;
    fields.push(f);
  }
  let m;
  const inputRe = /<input\b([^>]*)>/gi;
  while ((m = inputRe.exec(body))) {
    const tag = m[1];
    const type = (attr(tag, 'type') || 'text').toLowerCase();
    const name = attr(tag, 'name');
    if (!name || type === 'submit' || type === 'button' || type === 'reset') continue;
    const id = attr(tag, 'id');
    const label = labelFor(body, id);
    const placeholder = attr(tag, 'placeholder');
    push({ name: name, type: type, label: label || placeholder || name,
      value: attr(tag, 'value'), placeholder: placeholder, options: [],
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
