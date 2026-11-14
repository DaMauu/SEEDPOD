/* 图床管道：把队列里的 data URL 截图上传到配置的图床，返回可写进简介的链接。
   默认只演练；真上传由调用方显式 allowReal，并且只接受已验证的 custom/local 接口。
   Pixhost / Imgbox 暂只做计划，不拿未验证的接口去真传。 */
const MAX_BYTES = 8 * 1024 * 1024;

function providerKey(name) {
  const s = String(name == null ? '' : name).trim().toLowerCase();
  if (!s || s === '站内' || s === 'none' || s === 'site') return 'none';
  if (s === 'pixhost') return 'pixhost';
  if (s === 'imgbox') return 'imgbox';
  if (s === '本地图床' || s === 'local') return 'local';
  return 'custom';
}
function envHeaders() {
  const raw = String(process.env.PTA_IMAGE_HOST_HEADERS || '').trim();
  if (!raw) return {};
  try {
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : {};
  } catch (e) {
    return {};
  }
}
function configFor(provider) {
  if (provider === 'custom' || provider === 'local') {
    return {
      endpoint: String(process.env.PTA_IMAGE_HOST_URL || '').trim(),
      field: String(process.env.PTA_IMAGE_HOST_FIELD || 'file').trim() || 'file',
      token: String(process.env.PTA_IMAGE_HOST_TOKEN || '').trim(),
      headers: envHeaders(),
      verified: true
    };
  }
  if (provider === 'pixhost') {
    return { endpoint: 'https://api.pixhost.to/images', field: 'img', token: '', headers: {}, verified: false };
  }
  if (provider === 'imgbox') {
    return { endpoint: 'https://imgbox.com/upload', field: 'file', token: '', headers: {}, verified: false };
  }
  return { endpoint: '', field: 'file', token: '', headers: {}, verified: false };
}
function dataUrlOf(s) {
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,([A-Za-z0-9+/=\s]+)$/i.exec(String(s || '').trim());
  if (!m) return null;
  const buf = Buffer.from(m[2].replace(/\s+/g, ''), 'base64');
  if (!buf.length || buf.length > MAX_BYTES) return null;
  return { mime: m[1].toLowerCase(), buf: buf };
}
function findUrl(value, depth) {
  if (depth > 6 || value == null) return '';
  if (typeof value === 'string') return /^https?:\/\//i.test(value.trim()) ? value.trim() : '';
  if (Array.isArray(value)) {
    for (const v of value) { const u = findUrl(v, depth + 1); if (u) return u; }
    return '';
  }
  if (typeof value === 'object') {
    const keys = ['direct_url', 'display_url', 'url', 'show_url', 'th_url', 'link', 'src'];
    for (const k of keys) if (value[k]) { const u = findUrl(value[k], depth + 1); if (u) return u; }
    for (const k of Object.keys(value)) { const u = findUrl(value[k], depth + 1); if (u) return u; }
  }
  return '';
}
function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, Math.max(0, Number(ms) || 0)); });
}
async function uploadOne(shot, cfg, opts) {
  const raw = String((shot && shot.url) || shot || '');
  if (/^https?:\/\//i.test(raw)) return { ok: true, url: raw, skipped: true, attempts: 0 };
  const data = dataUrlOf(raw);
  if (!data) return { ok: false, error: '不是 png/jpeg/webp 的 data URL', attempts: 0 };
  const total = Math.max(1, Math.min(5, Number(opts.retries) + 1 || 3));
  let last = '';
  for (let attempt = 1; attempt <= total; attempt++) {
    try {
      const form = new FormData();
      form.append(cfg.field, new Blob([data.buf], { type: data.mime }), String((shot && shot.name) || ('shot' + attempt + '.jpg')).slice(0, 80));
      const headers = Object.assign({}, cfg.headers || {});
      if (cfg.token) headers.authorization = 'Bearer ' + cfg.token;
      const res = await fetch(cfg.endpoint, {
        method: 'POST', headers: headers, body: form,
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) throw new Error('图床返回 HTTP ' + res.status);
      const text = await res.text();
      let url = '';
      try { url = findUrl(JSON.parse(text), 0); } catch (e) { /* 不是 JSON，继续按文本找 */ }
      if (!url) {
        const m = /https?:\/\/[^\s"'<>]+/i.exec(text);
        if (m) url = m[0];
      }
      if (!url) throw new Error('图床没有返回图片地址');
      return { ok: true, url: url, attempts: attempt };
    } catch (e) {
      last = String(e && e.message || e).slice(0, 200);
      if (attempt < total) await sleep(opts.delayMs == null ? 250 : opts.delayMs);
    }
  }
  return { ok: false, error: last || '上传失败', attempts: total };
}
async function processShots(providerName, shots, opts) {
  const o = opts || {};
  const provider = providerKey(providerName);
  const list = Array.isArray(shots) ? shots : [];
  const total = list.length;
  const dryRun = o.dryRun !== false;
  const retries = Math.max(0, Math.min(4, Number(o.retries) || 0));
  if (!total) return { ok: false, code: 'NO_SHOTS', message: '还没有截图', provider: provider, dryRun: dryRun, total: 0, uploaded: 0, failed: 0, items: [] };
  if (provider === 'none') {
    return { ok: true, code: 'IMAGE_HOST_MANUAL', message: '站内图床还没接；截图保留在队列里', provider: provider, dryRun: dryRun, total: total, uploaded: 0, failed: 0, items: list.map(function (s, i) { return { index: i, name: String((s && s.name) || ('shot' + (i + 1))), status: 'skipped' }; }) };
  }
  const cfg = configFor(provider);
  if (dryRun) {
    return { ok: true, code: 'IMAGE_DRY_RUN', message: '演练：没有上传图片', provider: provider, dryRun: true, total: total, uploaded: 0, failed: 0, endpoint: cfg.endpoint, field: cfg.field, verified: cfg.verified, items: list.map(function (s, i) { return { index: i, name: String((s && s.name) || ('shot' + (i + 1))), status: 'planned', bytes: dataUrlOf(s && s.url) ? dataUrlOf(s.url).buf.length : 0 }; }) };
  }
  if (!o.allowReal) {
    return { ok: false, code: 'REAL_IMAGES_DISABLED', message: '图床真上传没打开：把配置 realImages 设为 true（或设 PTA_ALLOW_REAL=1）再试', provider: provider, dryRun: false, total: total, uploaded: 0, failed: 0, items: [] };
  }
  if (!cfg.verified) {
    return { ok: false, code: 'IMAGE_HOST_UNVERIFIED', message: '这个图床还没验证真实上传接口；先用本地图床或自定义图床地址', provider: provider, dryRun: false, total: total, uploaded: 0, failed: 0, items: [] };
  }
  if (!/^https?:\/\//i.test(cfg.endpoint)) {
    return { ok: false, code: 'IMAGE_HOST_NOT_CONFIGURED', message: '没有配置图床地址：设 PTA_IMAGE_HOST_URL（可选 PTA_IMAGE_HOST_FIELD / PTA_IMAGE_HOST_TOKEN）', provider: provider, dryRun: false, total: total, uploaded: 0, failed: 0, items: [] };
  }
  const items = [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const r = await uploadOne(s, cfg, { retries: retries, delayMs: o.delayMs });
    items.push(Object.assign({ index: i, name: String((s && s.name) || ('shot' + (i + 1))) }, r));
  }
  const uploaded = items.filter(function (x) { return x.ok; }).length;
  const failed = items.length - uploaded;
  return {
    ok: failed === 0,
    code: failed === 0 ? 'IMAGE_UPLOADED' : (uploaded ? 'IMAGE_UPLOAD_PARTIAL' : 'IMAGE_UPLOAD_FAILED'),
    message: failed === 0 ? '图片已上传' : ('图床上传失败 ' + failed + ' 张'),
    provider: provider, dryRun: false, total: total, uploaded: uploaded, failed: failed,
    endpoint: cfg.endpoint, field: cfg.field, items: items
  };
}
function replaceDescription(description, links) {
  let out = String(description == null ? '' : description);
  const list = Array.isArray(links) ? links.filter(function (x) { return x && x.url; }) : [];
  if (!list.length) return out.slice(0, 20000);
  out = out.replace(/\[img\]data:image\/[^\[\]]+\[\/img\]/gi, '').trim();
  const block = list.map(function (x) { return '[img]' + x.url + '[/img]'; }).join('\n');
  if (block && out.indexOf(block) < 0) out = out ? out + '\n\n' + block : block;
  return out.slice(0, 20000);
}

module.exports = { process: processShots, replaceDescription: replaceDescription, providerKey: providerKey, configFor: configFor, dataUrlOf: dataUrlOf };
