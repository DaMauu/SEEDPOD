/* 站点会话自检与凭据导入（Fastify v2）。 */
const fs = require('fs');
const path = require('path');
const adapters = require('./adapters');
const jsonFile = require('./src/infra/json-file');
const urlGuard = require('./url-guard');

module.exports = function (app, ctx) {
  const { db, DATA_DIR, one, all, ok, bad, jparse } = ctx;
  const cookieStore = require('./src/features/sites/credentials')(DATA_DIR);
  const siteStore = require('./src/features/sites/store')(DATA_DIR);
  const now = () => new Date().toISOString();
  const STATUS_FILE = path.join(DATA_DIR, 'site-status.json');

  function readStatus() { try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')) || {}; } catch (e) { return {}; } }
  function writeStatus(host, rec) {
    try { const all2 = readStatus(); all2[host] = rec; jsonFile.writeAtomic(STATUS_FILE, all2, 0o600); } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
  }
  function readDef(host) { return siteStore.legacyDef(host); }
  function cred(host) {
    const c = cookieStore.get(host);
    return c.cookie || '';
  }

  app.post('/api/sites/:host/session-test', async (req, reply) => {
    const host = String(req.params.host || '');
    if (!/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', '站点域名不合法');
    const cookie = cred(host);
    if (!cookie) return bad(reply, 'NO_COOKIE', '这个站还没导入 cookie', 409);
    const def = readDef(host);
    if (def && def.base && !urlGuard.baseOk(host, def.base)) return bad(reply, 'BAD_BASE', '站点 base 不是该站域名');
    const base = (def && def.base ? String(def.base) : 'https://' + host).replace(/\/+$/, '');
    const engine = (def && def.engine) || '';
    const probePath = engine === 'nexusphp' || engine === '' ? '/index.php' : '/torrents';
    const t0 = Date.now();
    try {
      const res = await fetch(base + probePath, {
        headers: { cookie: cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        redirect: 'manual', signal: AbortSignal.timeout(15000)
      });
      const html = await res.text().catch(function () { return ''; });
      const verdict = adapters.isLoggedIn(html);
      const pass = res.status === 200 && verdict === true;
      writeStatus(host, { at: now(), pass: pass, engine: engine, status: res.status });
      return ok(reply, { pass: pass, engine: engine, steps: [{ step: 'session', path: probePath, status: res.status, ms: Date.now() - t0, ok: pass }] });
    } catch (e) {
      writeStatus(host, { at: now(), pass: false, engine: engine, status: 0, error: String(e && e.message || e).slice(0, 120) });
      return ok(reply, { pass: false, engine: engine, steps: [{ step: 'connect', status: 0, error: String(e && e.message || e).slice(0, 120) }] });
    }
  });

  app.get('/api/site-status', async () => ok(readStatus()));

  /* 批量导入 cookie：{ items: [{host, cookie}] } */
  app.put('/api/credentials/import', async (req, reply) => {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (!items.length) return bad(reply, 'BAD_REQUEST', 'items 不能为空');
    const r = cookieStore.importMany(items, db);
    if (r.saved === 0 && r.skipped) return bad(reply, 'CRYPTO_UNAVAILABLE', '凭据密钥不可用或数据不合法', 409);
    return ok(reply, { saved: r.saved, skipped: r.skipped });
  });
};
