/* 通知：Telegram 优先，通用 webhook 兜底。
   token/chat 优先读环境变量；没有就用面板加密保存的配置（token AES-GCM）。
   接口只回是否配置/来源/chat，不回 token。 */
const secretbox = require('./src/infra/secretbox');
const urlGuard = require('./src/infra/url-guard');
const COOLDOWNS = new Map();
function cooldownKey(t, c) { return String((t && t.api) || '') + '|' + String((t && t.chat) || '') + '|' + String((c && c.webhook) || ''); }
function makeNotify(ctx) {
  const { one, DATA_DIR } = ctx;
  const KEYRING = secretbox.loadKey(DATA_DIR || require('./src/infra/env').read('DATA_DIR','PTA_DATA') || '.');
  const now = () => new Date().toISOString();
  function cooldownOf(key) { if (!COOLDOWNS.has(key)) COOLDOWNS.set(key, { until: 0, reason: '' }); return COOLDOWNS.get(key); }
  const COOLDOWN_MS = Math.max(0, Math.min(600000, Number(require('./src/infra/env').read('NOTIFY_COOLDOWN_MS', 'PTA_NOTIFY_COOLDOWN_MS') || 60000)));

  function rawCfg() {
    try {
      const r = one("SELECT v FROM meta WHERE k = 'config'");
      return JSON.parse(r ? r.v : 'null') || {};
    } catch (e) { return {}; }
  }
  function webhookOf(c) {
    const enc = String(c.notifyWebhookEnc || '');
    if (enc) {
      try { return String(secretbox.decrypt(enc, KEYRING) || '').trim(); }
      catch (e) { console.warn('[seedpod] notify webhook 解密失败'); return ''; }
    }
    /* 兼容旧版明文配置；下次保存会自动改成密文 */
    return String(c.notifyWebhook || '').trim();
  }
  function readCfg() {
    const c = rawCfg();
    return {
      events: ['off', 'error', 'always'].indexOf(c.notifyEvents) >= 0 ? c.notifyEvents : 'error',
      webhook: String(require('./src/infra/env').read('NOTIFY_WEBHOOK','PTA_NOTIFY_WEBHOOK') || webhookOf(c) || '').trim()
    };
  }
  function configCreds() {
    const c = rawCfg();
    let token = '';
    const enc = String(c.notifyTgToken || '');
    if (enc) { try { token = secretbox.decrypt(enc, KEYRING); } catch (e) { token = ''; } }
    const chat = String(c.notifyTgChat || '').trim();
    return { token: token, chat: chat, source: token && chat ? 'config' : '' };
  }
  function creds() {
    const api = String(require('./src/infra/env').read('TELEGRAM_API','PTA_TELEGRAM_API') || 'https://api.telegram.org').replace(/\/+$/, '');
    const envToken = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
    const envChat = String(process.env.TELEGRAM_ALLOWED_USER_ID || process.env.TELEGRAM_CHAT_ID || '').trim();
    if (envToken && envChat) return { token: envToken, chat: envChat, source: 'env', api: api };
    const c = configCreds();
    if (c.token && c.chat) return { token: c.token, chat: c.chat, source: 'config', api: api };
    return { token: '', chat: '', source: '', api: api };
  }
  function status() {
    const c = readCfg(), t = creds();
    return {
      telegram: !!(t.token && t.chat),
      source: t.source,
      chat: t.chat,
      webhook: !!c.webhook,
      events: c.events,
      channel: t.token && t.chat ? 'telegram' : (c.webhook ? 'webhook' : '')
    };
  }
  function sanitize(s) {
    const token = creds().token;
    const text = String(s || '');
    if (!token) return text.slice(0, 160);
    return text.split(token).join('<token>').slice(0, 160);
  }
  async function send(event, text, extra, opts) {
    const c = readCfg(), t = creds();
    const force = !!(opts && opts.force);
    const COOLDOWN = cooldownOf(cooldownKey(t, c));
    /* 双通道同时失败后短暂冷却，避免调度每轮重复打外部接口；同配置的实例共享 */
    if (!force && COOLDOWN.until > Date.now()) {
      return { ok: false, skipped: true, reason: 'cooldown', retryAt: new Date(COOLDOWN.until).toISOString(), lastError: COOLDOWN.reason };
    }
    if (!force && c.events === 'off') return { ok: true, skipped: true, reason: 'off' };
    const isError = /fail|error|target\.failed|publish\.failed|scheduler\.error/i.test(String(event)) || event === 'test';
    if (!force && c.events === 'error' && !isError) return { ok: true, skipped: true, reason: 'not_error' };
    const msg = String(text || '').slice(0, 2000);
    let telegramError = null;
    if (t.token && t.chat) {
      try {
        const u = t.api + '/bot' + t.token + '/sendMessage';
        const dg = await urlGuard.assertNoRebind(u);
        if (!dg.ok) throw new Error(dg.err);
        const r = await fetch(u, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: t.chat, text: msg, disable_web_page_preview: true }),
          redirect: 'manual',
          signal: AbortSignal.timeout(5000)
        });
        if (r.status >= 300 && r.status < 400) throw new Error('Telegram API 跳转了，停止');
        const b = await r.json().catch(function () { return null; });
        if (r.ok && b && b.ok) { COOLDOWN.until = 0; return { ok: true, channel: 'telegram', status: r.status, skipped: false, error: '' }; }
        telegramError = { ok: false, channel: 'telegram', status: r.status, skipped: false,
          error: b && b.description ? String(b.description).slice(0, 160) : ('HTTP ' + r.status) };
      } catch (e) {
        telegramError = { ok: false, channel: 'telegram', status: 0, skipped: false, error: sanitize(e && e.message || e) };
      }
    }
    if (c.webhook) {
      const tries = Math.max(0, Math.min(3, opts && opts.webhookRetries !== undefined ? Number(opts.webhookRetries) : 1));
      const delay = Math.max(0, Math.min(5000, opts && opts.webhookDelayMs !== undefined ? Number(opts.webhookDelayMs) : 300));
      let last = null;
      for (let attempt = 0; attempt <= tries; attempt++) {
        try {
          const dg = await urlGuard.assertNoRebind(c.webhook);
          if (!dg.ok) throw new Error(dg.err);
          const r = await fetch(c.webhook, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ event: event, text: msg, at: now(), source: 'seedpod' }),
            redirect: 'manual',
            signal: AbortSignal.timeout(5000)
          });
          if (r.status >= 300 && r.status < 400) throw new Error('webhook 跳转了，停止');
          if (r.ok) { COOLDOWN.until = 0; return { ok: true, channel: 'webhook', status: r.status, skipped: false, attempts: attempt + 1 }; }
          last = { ok: false, channel: 'webhook', status: r.status, skipped: false, error: 'HTTP ' + r.status, attempts: attempt + 1 };
        } catch (e) {
          last = { ok: false, channel: 'webhook', status: 0, skipped: false, error: sanitize(e && e.message || e), attempts: attempt + 1 };
        }
        if (attempt < tries && delay) await new Promise(function (r) { setTimeout(r, delay); });
      }
      if (!force) { COOLDOWN.until = Date.now() + COOLDOWN_MS; COOLDOWN.reason = (last && last.error) || 'webhook failed'; }
      return last;
    }
    if (telegramError) {
      if (!force) { COOLDOWN.until = Date.now() + COOLDOWN_MS; COOLDOWN.reason = telegramError.error || 'telegram failed'; }
      return telegramError;
    }
    return { ok: true, skipped: true, reason: 'no_channel' };
  }
  return { send: send, status: status, readCfg: readCfg };
}

module.exports = { makeNotify };
