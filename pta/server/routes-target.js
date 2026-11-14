/* 目标站提交与回查（Fastify v2）。
   干跑默认；真提交必须 realPublish=true；cookie 只从加密凭据读。 */
const { makeTarget } = require('./target');

module.exports = function (app, ctx) {
  const { db, one, ok, bad, jparse } = ctx;
  const target = makeTarget(ctx);
  const now = () => new Date().toISOString();

  function loadQueue(id) {
    const row = one('SELECT id, data FROM queue WHERE id = ?', String(id || ''));
    return row ? { id: row.id, data: jparse(row.data) || {} } : null;
  }
  function saveQueue(it) {
    db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(it), now(), it.id);
  }
  function checkHost(item, host) {
    if (item.targetSite && String(item.targetSite) !== String(host)) {
      return { code: 'TARGET_MISMATCH', message: '条目目标站是 ' + item.targetSite + '，跟请求的 ' + host + ' 不一致' };
    }
    return null;
  }
  function decodeTorrent(b) {
    const raw = String((b && b.torrentBase64) || '');
    if (!raw) return null;
    let buf;
    try { buf = Buffer.from(raw, 'base64'); } catch (e) { return { err: '种子 base64 解不开' }; }
    if (!buf.length) return { err: '种子是空文件' };
    if (buf.length > 10 * 1024 * 1024) return { err: '种子超过 10MB' };
    if (buf[0] !== 0x64) return { err: '不是种子文件（bencode 应以 d 开头）' };
    const meta = target.torrentMeta(buf);
    if (!meta.hash) return { err: '种子解析不出 infohash' };
    return { buf: buf, meta: meta };
  }
  async function torrentFor(b, item) {
    const local = decodeTorrent(b);
    if (local && local.err) return local;
    if (local) return local;
    return target.fetchSourceTorrent(item);
  }

  app.get('/api/targets', async () => ok(target.list()));

  app.post('/api/targets/:host/plan', async (req, reply) => {
    const item = loadQueue(req.body && req.body.queueId);
    if (!item) return bad(reply, 'NOT_FOUND', '队列条目不存在', 404);
    const mism = checkHost(item.data, req.params.host);
    if (mism) return bad(reply, mism.code, mism.message, 400);
    const r = target.plan(req.params.host, item.data);
    if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
    return ok(reply, r.data);
  });

  app.post('/api/targets/:host/upload', async (req, reply) => {
    const b = req.body || {};
    const item = loadQueue(b.queueId);
    if (!item) return bad(reply, 'NOT_FOUND', '队列条目不存在', 404);
    const mism = checkHost(item.data, req.params.host);
    if (mism) return bad(reply, mism.code, mism.message, 400);
    const t = await torrentFor(b, item.data);
    if (t.err) return bad(reply, 'TORRENT_UNAVAILABLE', t.err, 400);
    const dryRun = b.dryRun !== false;
    const r = await target.submit(req.params.host, item.data, t.buf, { dryRun: dryRun });
    if (!r.ok) {
      if (ctx.notify) {
        ctx.notify.send('target.failed', 'SEEDPOD 目标站提交失败：' + req.params.host + ' · ' + (r.message || r.code),
          { host: req.params.host, id: b.queueId }).catch(function () {});
      }
      return bad(reply, r.code, r.message, r.http || 400);
    }
    if (dryRun) return ok(reply, r.data);

    item.data.targetUpload = {
      host: req.params.host, at: now(), url: r.data.url, detailsUrl: r.data.detailsUrl || '',
      infohash: r.data.infohash || '', status: r.data.status || 0, message: r.data.message || ''
    };
    let verified = null;
    if (b.verify !== false) {
      const v = await target.verify(req.params.host, item.data, t.buf, { url: r.data.detailsUrl || undefined });
      if (v.ok) {
        verified = v.data;
        item.data.targetVerify = Object.assign({}, v.data, { at: now() });
      }
    }
    saveQueue(item.data);
    return ok(reply, Object.assign({}, r.data, { verify: verified }));
  });

  app.post('/api/targets/:host/verify', async (req, reply) => {
    const b = req.body || {};
    const item = loadQueue(b.queueId);
    if (!item) return bad(reply, 'NOT_FOUND', '队列条目不存在', 404);
    const mism = checkHost(item.data, req.params.host);
    if (mism) return bad(reply, mism.code, mism.message, 400);
    const t = await torrentFor(b, item.data);
    if (t.err) return bad(reply, 'TORRENT_UNAVAILABLE', t.err, 400);
    const r = await target.verify(req.params.host, item.data, t.buf, { url: b.url });
    if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
    item.data.targetVerify = Object.assign({}, r.data, { at: now() });
    saveQueue(item.data);
    return ok(reply, r.data);
  });
};
