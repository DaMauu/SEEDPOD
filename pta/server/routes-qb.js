/* 下载器接口（Fastify v2）：增删改、探测、分类读取；密码仍是 AES-GCM 密文。 */
const path = require('path');
const secretbox = require('./secretbox');
const { makeQb } = require('./qb');
const watch = require('./clients/watch');

module.exports = function (app, ctx) {
  const { db, DATA_DIR, one, all, ok, bad, jparse } = ctx;
  const KEYRING = secretbox.loadKey(DATA_DIR);
  const qb = makeQb(DATA_DIR);
  const now = () => new Date().toISOString();

  const dlPass = function (d) {
    const v = String((d && d.pass) || '');
    if (!v) return '';
    if (v.slice(0, 3) === 'v1:') { try { return secretbox.decrypt(v, KEYRING.key); } catch (e) { return ''; } }
    return v;
  };
  const publicDl = function (d) {
    return { id: d.id, name: d.name || '', kind: d.kind || 'qb', url: d.url || '', watchPath: d.watchPath || '',
      user: d.user || '', hasPass: !!d.pass, disableAuth: !!d.disableAuth, lastProbe: d.lastProbe || null };
  };
  function rows() { return all('SELECT data FROM downloaders').map(function (r) { return jparse(r.data) || {}; }); }
  function save(d) {
    db.prepare('INSERT INTO downloaders(id, data, created_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
      .run(d.id, JSON.stringify(d), now());
  }
  function find(id) { return rows().filter(function (d) { return d.id === id; })[0] || null; }

  app.post('/api/downloaders', async (req, reply) => {
    const b = req.body || {};
    const kind = b.kind === 'watch' ? 'watch' : 'qb';
    let url = '', watchPath = '';
    if (kind === 'watch') {
      const w = watch.normDir(b.watchPath);
      if (w.err) return bad(reply, 'BAD_WATCH_PATH', w.err);
      watchPath = w.dir;
    } else {
      url = qb.normDlUrl(b.url || '');
      if (!url) return bad(reply, 'BAD_URL', '地址必须是 http/https 开头');
    }
    const mx = one("SELECT MAX(CAST(SUBSTR(id, 4) AS INTEGER)) AS m FROM downloaders WHERE id LIKE 'dl_%'") || { m: 0 };
    const id = 'dl_' + String((Number(mx.m) || 0) + 1).padStart(3, '0');
    const name = String(b.name || '').slice(0, 60) || (kind === 'watch' ? path.basename(watchPath) : url);
    const d = { id: id, name: name, kind: kind, url: url, watchPath: watchPath,
      user: String(b.user || '').slice(0, 100),
      pass: b.pass ? secretbox.encrypt(String(b.pass).slice(0, 200), KEYRING.key) : '', disableAuth: !!b.disableAuth };
    save(d);
    return ok(reply, publicDl(d));
  });

  app.put('/api/downloaders/:id', async (req, reply) => {
    const d = find(req.params.id);
    if (!d) return bad(reply, 'NOT_FOUND', '下载器不存在', 404);
    const b = req.body || {};
    if (b.name !== undefined) d.name = String(b.name).slice(0, 60);
    if (b.kind !== undefined) d.kind = b.kind === 'watch' ? 'watch' : 'qb';
    if (b.watchPath !== undefined) { const w = watch.normDir(b.watchPath); if (w.err) return bad(reply, 'BAD_WATCH_PATH', w.err); d.watchPath = w.dir; }
    if (b.url !== undefined) { const u = qb.normDlUrl(b.url); if (!u) return bad(reply, 'BAD_URL', '地址必须是 http/https 开头'); d.url = u; }
    if (b.user !== undefined) d.user = String(b.user).slice(0, 100);
    if (b.pass !== undefined) d.pass = b.pass ? secretbox.encrypt(String(b.pass).slice(0, 200), KEYRING.key) : '';
    if (b.disableAuth !== undefined) d.disableAuth = !!b.disableAuth;
    if (d.kind === 'watch' && !d.watchPath) return bad(reply, 'BAD_WATCH_PATH', 'watch 目录不能为空');
    if (d.kind !== 'watch' && !d.url) return bad(reply, 'BAD_URL', 'qB 地址不能为空');
    save(d);
    return ok(reply, publicDl(d));
  });

  app.delete('/api/downloaders/:id', async (req, reply) => {
    const d = find(req.params.id);
    if (!d) return bad(reply, 'NOT_FOUND', '下载器不存在', 404);
    db.prepare('DELETE FROM downloaders WHERE id = ?').run(req.params.id);
    return ok(reply, { id: req.params.id });
  });

  app.post('/api/downloaders/probe', async (req, reply) => {
    const b = req.body || {};
    if (b.kind === 'watch') return ok(reply, watch.test({ dir: b.watchPath }));
    const url = qb.normDlUrl(b.url || '');
    if (!url) return bad(reply, 'BAD_URL', '地址要填成 http://主机:端口');
    const r = await qb.probeDownloader({ url: url, user: b.user, pass: b.pass });
    return ok(reply, r);
  });

  app.post('/api/downloaders/:id/test', async (req, reply) => {
    const d = find(req.params.id);
    if (!d) return bad(reply, 'NOT_FOUND', '下载器不存在', 404);
    const r = d.kind === 'watch' ? watch.test({ dir: d.watchPath }) : await qb.probeDownloader({ url: d.url, user: d.user, pass: dlPass(d) });
    d.lastProbe = { at: now(), pass: !!r.pass, version: r.version || '', freeSpace: Number(r.freeSpace) || 0,
      totalSpace: Number(r.totalSpace) || 0, savePath: r.savePath || (d.kind === 'watch' ? d.watchPath : '') || '' };
    save(d);
    return ok(reply, r);
  });

  app.get('/api/downloaders/:id/cats', async (req, reply) => {
    const d = find(req.params.id);
    if (!d) return bad(reply, 'NOT_FOUND', '下载器不存在', 404);
    if (d.kind === 'watch') return ok(reply, { cats: [] });
    const c = await qb.qbCategories({ url: d.url, user: d.user, pass: dlPass(d) });
    if (!c.pass) return bad(reply, 'QB_CATS_FAILED', c.error || '读不到下载器里的分类', 502);
    return ok(reply, { cats: c.cats });
  });
};
