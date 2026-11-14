/* 媒体接口（Fastify v2）：探测、截图、生成种子。
   文件路径限制在 PTA_MEDIA_ROOT（默认 data/media），拒绝越界；截图返回 data URL 供队列使用。 */
const fs = require('fs');
const path = require('path');
const media = require('./media');

module.exports = function (app, ctx) {
  const { DATA_DIR, ok, bad } = ctx;
  const ROOT = path.resolve(process.env.PTA_MEDIA_ROOT || path.join(DATA_DIR, 'media'));
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
