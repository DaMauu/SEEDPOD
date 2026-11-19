/* 媒体接口（Fastify v2）：探测、截图、生成种子。
   文件路径限制在 MEDIA_ROOT（默认 data/media），拒绝越界；截图返回 data URL 供队列使用。 */
const fs = require('fs');
const path = require('path');
const media = require('./media');
const qb = require('./qb');
const { makeTarget } = require('./target');

module.exports = function (app, ctx) {
  const { DATA_DIR, one, all, jparse, ok, bad } = ctx;
  const target = makeTarget(ctx);
  const ROOT = path.resolve(require('./env').read('MEDIA_ROOT','PTA_MEDIA_ROOT') || path.join(DATA_DIR, 'media'));
  try { fs.mkdirSync(ROOT, { recursive: true, mode: 0o700 }); } catch (e) { console.warn('[seedpod] ignored:', e && e.message ? e.message : e) }

  function safeFile(rel) {
    const raw = String(rel || '').trim();
    if (!raw) return { err: 'path 不能为空' };
    const abs = path.resolve(ROOT, raw);
    if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return { err: '路径越界' };
    let real, realRoot;
    try { realRoot = fs.realpathSync(ROOT); } catch (e) { realRoot = ROOT; }
    try { real = fs.realpathSync(abs); } catch (e) { return { err: '文件不存在' }; }
    if (real !== realRoot && !real.startsWith(realRoot + path.sep)) return { err: '路径越界' };
    const st = fs.statSync(real);
    if (!st.isFile()) return { err: '不是文件' };
    return { file: real, size: st.size };
  }
  function safeName(s) {
    return String(s || 'upload').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80) || 'upload';
  }

  app.get('/api/media/config', async () => ok({ root: ROOT, exists: fs.existsSync(ROOT) }));

  /* 从 qB 已完成的种子里取媒体路径；只返回 MEDIA_ROOT 内的相对路径 */
  app.post('/api/queue/:id/media-path', async (req, reply) => {
    const row = one('SELECT data FROM queue WHERE id = ?', req.params.id);
    if (!row) return bad(reply, 'NOT_FOUND', '队列条目不存在', 404);
    const it = jparse(row.data) || {};
    let hash = String((it.qb && it.qb.hash) || it.infohash || (it.sourceState && it.sourceState.hash) || '').toLowerCase();
    const dls = all('SELECT data FROM downloaders').map(function (r) { return jparse(r.data) || {}; })
      .filter(function (d) { return String(d.kind || 'qb') === 'qb' && d.url; });
    const dl = dls.filter(function (d) { return d.id === it.downloaderId; })[0] || dls[0];
    if (!dl) return bad(reply, 'NO_DOWNLOADER', '没有可用的 qB 下载器', 409);
    let found = hash ? await qb.findTorrent(dl, hash, it.title) : null;
    if ((!found || !found.found) && !hash) found = await qb.findTorrent(dl, '', it.title);
    if ((!found || !found.found) && it.downloadUrl) {
      const t = await target.fetchSourceTorrent(it);
      if (t && t.err) return bad(reply, 'SOURCE_FETCH_FAILED', t.err, 502);
      const meta = qb.parseTorrent(t.buf);
      hash = String((meta && meta.hash) || '');
      if (!hash) return bad(reply, 'BAD_SOURCE', '源种解析不出 infohash', 422);
      found = await qb.findTorrent(dl, hash, (meta && meta.name) || it.title);
      if (!found || !found.found) {
        const src = await ctx.publisher.ensureSource(req.params.id, { allowWhenRealOff: true });
        if (!src.ok) return bad(reply, src.code || 'QB_ADD_FAILED', src.message || '加入 qB 失败', src.http || 502);
        if (!src.complete) {
          const pct = Math.round((Number(src.progress) || 0) * 100);
          return ok(reply, { added: true, progress: pct, message: '已加入 qB，当前 ' + pct + '%，下完再点一次' });
        }
        found = await qb.findTorrent(dl, hash, (meta && meta.name) || it.title);
      }
    }
    if (!found || !found.found) return bad(reply, 'NOT_IN_QB', 'qB 里没找到这个种子，先让它进一次 qB', 404);
    let abs = String(found.contentPath || '');
    if (!abs && found.savePath) abs = path.join(found.savePath, found.name || '');
    if (!abs) return bad(reply, 'NO_CONTENT_PATH', 'qB 没返回文件路径（版本太旧或种子还没开始）', 409);
    const VIDEO = /\.(mkv|mp4|ts|m2ts|iso|avi|mov|wmv|webm|flv)$/i;
    let target = abs;
    try {
      const st = fs.statSync(abs);
      if (st.isDirectory()) {
        const dirs = [abs, path.join(abs, 'BDMV', 'STREAM')];
        let best = null;
        dirs.forEach(function (d) {
          let list = [];
          try { list = fs.readdirSync(d); } catch (e) { list = []; }
          list.filter(function (f) { return VIDEO.test(f); }).forEach(function (f) {
            const p = path.join(d, f);
            try { const s2 = fs.statSync(p); if (s2.isFile() && (!best || s2.size > best.size)) best = { path: p, size: s2.size }; } catch (e) { /* 跳过 */ }
          });
        });
        if (!best) return bad(reply, 'NO_VIDEO', '这个目录里没找到视频文件，请手填具体文件路径', 422);
        target = best.path;
      }
    } catch (e) {
      return bad(reply, 'PATH_NOT_FOUND', 'qB 给的路径在服务器上不存在：' + abs.slice(0, 160), 404);
    }
    let realRoot = ROOT, real = target;
    try { realRoot = fs.realpathSync(ROOT); } catch (e) { realRoot = ROOT; }
    try { real = fs.realpathSync(target); } catch (e) { real = target; }
    if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
      return bad(reply, 'OUTSIDE_ROOT', '文件不在媒体目录下：' + target + '；把下载目录放到 ' + ROOT + ' 下，或手填相对路径', 409);
    }
    return ok(reply, { path: path.relative(realRoot, real), absolute: real, from: 'qb' });
  });

  app.post('/api/media/probe', async (req, reply) => {
    const safe = safeFile(req.body && req.body.path);
    if (safe.err) return bad(reply, 'BAD_PATH', safe.err, 400);
    try {
      return ok(reply, await media.probe(safe.file));
    } catch (e) {
      return bad(reply, 'PROBE_FAILED', String(e && e.message || e).slice(0, 240), 502);
    }
  });

  app.post('/api/media/shots', async (req, reply) => {
    const b = req.body || {};
    const safe = safeFile(b.path);
    if (safe.err) return bad(reply, 'BAD_PATH', safe.err, 400);
    const count = Math.max(1, Math.min(4, Number(b.count) || 3));
    const width = Math.max(160, Math.min(1920, Number(b.width) || 1280));
    const outDir = path.join(DATA_DIR, 'shots', String(Date.now()));
    try {
      const r = await media.shots(safe.file, { count: count, width: width, outDir: outDir, prefix: 'shot' });
      const items = [];
      let total = 0;
      for (const it of r.items) {
        const buf = fs.readFileSync(it.path);
        if (total + buf.length > 8 * 1024 * 1024) return bad(reply, 'SHOTS_TOO_LARGE', '截图总大小超过 8MB', 413);
        total += buf.length;
        items.push({ name: it.name, at: it.at, bytes: it.bytes,
          dataUrl: 'data:image/jpeg;base64,' + buf.toString('base64') });
      }
      return ok(reply, { dir: outDir, width: r.width, tonemap: r.tonemap, items: items });
    } catch (e) {
      return bad(reply, 'SHOTS_FAILED', String(e && e.message || e).slice(0, 240), 502);
    }
  });

  app.post('/api/media/torrent', async (req, reply) => {
    const b = req.body || {};
    const safe = safeFile(b.path);
    if (safe.err) return bad(reply, 'BAD_PATH', safe.err, 400);
    try {
      const t = await media.makeTorrent({ file: safe.file, announce: b.announce,
        name: b.name, pieceLength: b.pieceLength });
      const dir = path.join(DATA_DIR, 'torrents');
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const out = path.join(dir, safeName(t.name) + '.torrent');
      fs.writeFileSync(out, t.buffer, { mode: 0o600 });
      return ok(reply, { infohash: t.infohash, name: t.name, size: t.size,
        pieceLength: t.pieceLength, pieces: t.pieces, path: out,
        base64: t.buffer.toString('base64') });
    } catch (e) {
      return bad(reply, 'TORRENT_FAILED', String(e && e.message || e).slice(0, 240), 400);
    }
  });
};
