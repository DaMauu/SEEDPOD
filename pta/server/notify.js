/* 通知：Telegram 优先，通用 webhook 兜底。
   token/chat 优先读环境变量；没有就用面板加密保存的配置（token AES-GCM）。
   接口只回是否配置/来源/chat，不回 token。 */
const secretbox = require('./secretbox');
function makeNotify(ctx) {
  const { one, DATA_DIR } = ctx;
  const KEYRING = secretbox.loadKey(DATA_DIR || process.env.PTA_DATA || '.');
  const now = () => new Date().toISOString();

  function rawCfg() {
    try {
      const r = one("SELECT v FROM meta WHERE k = 'config'");
      return JSON.parse(r ? r.v : 'null') || {};
    } catch (e) { return {}; }
  }
  function readCfg() {
    const c = rawCfg();
    return {
      events: ['off', 'error', 'always'].indexOf(c.notifyEvents) >= 0 ? c.notifyEvents : 'error',
      webhook: String(process.env.PTA_NOTIFY_WEBHOOK || c.notifyWebhook || '').trim()
    };
  }
  function configCreds() {
    const c = rawCfg();
    let token = '';
    const enc = String(c.notifyTgToken || '');
    if (enc) { try { token = secretbox.decrypt(enc, KEYRING.key); } catch (e) { token = ''; } }
    const chat = String(c.notifyTgChat || '').trim();
    return { token: token, chat: chat, source: token && chat ? 'config' : '' };
  }
  function creds() {
    const api = String(process.env.PTA_TELEGRAM_API || 'https://api.telegram.org').replace(/\/+$/, '');
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
    return String(s || '').split(token).join('<token>').slice(0, 160);
  }
  async function send(event, text, extra, opts) {
    const c = readCfg(), t = creds();
    const force = !!(opts && opts.force);
    if (!force && c.events === 'off') return { ok: true, skipped: true, reason: 'off' };
    const isError = /fail|error|target\.failed|publish\.failed|scheduler\.error/i.test(String(event)) || event === 'test';
    if (!force && c.events === 'error' && !isError) return { ok: true, skipped: true, reason: 'not_error' };
    const msg = String(text || '').slice(0, 2000);
    if (t.token && t.chat) {
      try {
        const r = await fetch(t.api + '/bot' + t.token + '/sendMessage', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: t.chat, text: msg, disable_web_page_preview: true }),
          signal: AbortSignal.timeout(5000)
        });
        const b = await r.json().catch(function () { return null; });
        return { ok: r.ok && !!(b && b.ok), channel: 'telegram', status: r.status, skipped: false,
          error: b && b.description ? String(b.description).slice(0, 160) : '' };
      } catch (e) {
        return { ok: false, channel: 'telegram', status: 0, skipped: false, error: sanitize(e && e.message || e) };
      }
    }
    if (c.webhook) {
      try {
        const r = await fetch(c.webhook, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ event: event, text: msg, at: now(), source: 'seedpod' }),
          signal: AbortSignal.timeout(5000)
        });
        return { ok: r.ok, channel: 'webhook', status: r.status, skipped: false };
      } catch (e) {
        return { ok: false, channel: 'webhook', status: 0, skipped: false, error: sanitize(e && e.message || e) };
      }
    }
    return { ok: true, skipped: true, reason: 'no_channel' };
  }
  return { send: send, status: status, readCfg: readCfg };
}

module.exports = { makeNotify };
