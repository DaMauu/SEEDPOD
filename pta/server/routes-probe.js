/* 站点会话自检与凭据导入（Fastify v2）。 */
const fs = require('fs');
const path = require('path');
const secretbox = require('./secretbox');
const adapters = require('./adapters');

module.exports = function (app, ctx) {
  const { db, DATA_DIR, one, all, ok, bad, jparse } = ctx;
  const KEYRING = secretbox.loadKey(DATA_DIR);
  const now = () => new Date().toISOString();
  const STATUS_FILE = path.join(DATA_DIR, 'site-status.json');

  function readStatus() { try { return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8')) || {}; } catch (e) { return {}; } }
  function writeStatus(host, rec) {
    try { const all2 = readStatus(); all2[host] = rec; fs.writeFileSync(STATUS_FILE, JSON.stringify(all2, null, 1), { mode: 0o600 }); } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }
  }
  function readDef(host) { try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'site-defs', host + '.json'), 'utf8')); } catch (e) { return null; } }
  function cred(host) {
    const r = one('SELECT cookie FROM credentials WHERE host = ?', host);
    if (!r || !r.cookie) return '';
    try { return secretbox.decrypt(r.cookie, KEYRING.key); } catch (e) { return ''; }
  }

  app.post('/api/sites/:host/session-test', async (req, reply) => {
    const host = req.params.host;
    const cookie = cred(host);
    if (!cookie) return bad(reply, 'NO_COOKIE', '这个站还没导入 cookie', 409);
    const def = readDef(host);
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
    let saved = 0, skipped = 0;
    for (const it of items.slice(0, 200)) {
      const host = String((it && it.host) || '').trim();
      const cookie = String((it && it.cookie) || '').trim();
      if (!host || !/^[a-z0-9][a-z0-9.-]*$/i.test(host) || !cookie || cookie.length > 4096) { skipped++; continue; }
      const enc = secretbox.encrypt(cookie, KEYRING.key);
      db.prepare('INSERT INTO credentials(host, cookie, updated_at) VALUES(?, ?, ?) ON CONFLICT(host) DO UPDATE SET cookie=excluded.cookie, updated_at=excluded.updated_at')
        .run(host, enc, now());
      saved++;
    }
    return ok(reply, { saved: saved, skipped: skipped });
  });
};
