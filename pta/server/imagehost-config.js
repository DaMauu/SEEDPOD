/* 图床配置：provider 归一化、环境变量读取、上传端点。 */
function providerKey(name) {
  const s = String(name == null ? '' : name).trim().toLowerCase();
  if (!s || s === '站内' || s === 'none' || s === 'site') return 'none';
  if (s === 'pixhost') return 'pixhost';
  if (s === 'imgbox') return 'imgbox';
  if (s === '本地图床' || s === 'local') return 'local';
  if (s === 'chevereto' || s === 'pterclub' || s === 's3') return 'chevereto';
  return 'custom';
}

function envHeaders() {
  const raw = String(require('./env').read('IMAGE_HOST_HEADERS','PTA_IMAGE_HOST_HEADERS') || '').trim();
  if (!raw) return {};
  try {
    const j = JSON.parse(raw);
    return j && typeof j === 'object' ? j : {};
  } catch (e) {
    return {};
  }
}

function defaultProvider() {
  const explicit = require('./env').read('IMAGE_HOST_PROVIDER', 'PTA_IMAGE_HOST_PROVIDER');
  if (explicit) return providerKey(explicit);
  const url = String(require('./env').read('IMAGE_HOST_URL', 'PTA_IMAGE_HOST_URL') || '');
  if (/\/api\/1\/upload/i.test(url)) return 'chevereto';
  if (require('./env').read('IMAGE_HOST_USER', 'PTA_IMAGE_HOST_USER')) return 'chevereto';
  return 'custom';
}

function configFor(provider) {
  if (provider === 'chevereto') {
    const raw = String(require('./env').read('IMAGE_HOST_URL', 'PTA_IMAGE_HOST_URL') || 'https://s3.pterclub.net').trim();
    const url = /\/api\/1\/upload/i.test(raw) ? raw : raw.replace(/\/+$/, '') + '/api/1/upload';
    return {
      endpoint: url,
      field: 'source',
      token: String(require('./env').read('IMAGE_HOST_TOKEN', 'PTA_IMAGE_HOST_TOKEN') || require('./env').read('IMAGE_HOST_KEY', 'PTA_IMAGE_HOST_KEY') || '').trim(),
      headers: envHeaders(),
      verified: true,
      auth: 'chevereto',
      user: String(require('./env').read('IMAGE_HOST_USER', 'PTA_IMAGE_HOST_USER') || '').trim(),
      pass: String(require('./env').read('IMAGE_HOST_PASS', 'PTA_IMAGE_HOST_PASS') || ''),
      ssoHost: String(require('./env').read('IMAGE_HOST_SSO_HOST', 'PTA_IMAGE_HOST_SSO_HOST') || 'pterclub.net').trim()
    };
  }
  if (provider === 'custom' || provider === 'local') {
    return {
      endpoint: String(require('./env').read('IMAGE_HOST_URL','PTA_IMAGE_HOST_URL') || '').trim(),
      field: String(require('./env').read('IMAGE_HOST_FIELD','PTA_IMAGE_HOST_FIELD') || 'file').trim() || 'file',
      token: String(require('./env').read('IMAGE_HOST_TOKEN','PTA_IMAGE_HOST_TOKEN') || '').trim(),
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
  if (!buf.length) return null;
  return { mime: m[1].toLowerCase(), buf: buf };
}

module.exports = { providerKey, envHeaders, defaultProvider, configFor, dataUrlOf };
