/* 截图上传与发布（Fastify v2）。发布默认只演练：真发帖要等站点表单适配验证后再开。 */
const { makePublisher } = require('./publish');

module.exports = function (app, ctx) {
  const { db, one, ok, bad, jparse } = ctx;
  const publisher = makePublisher(ctx);
  const now = () => new Date().toISOString();
  const MAX_SHOTS = 6;
  const MAX_LEN = 3 * 1024 * 1024;

  function load(id) {
    const row = one('SELECT id, data FROM queue WHERE id = ?', id);
    return row ? { id: row.id, data: jparse(row.data) || {} } : null;
  }
  function save(it) {
    db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
      .run(it.status, JSON.stringify(it), now(), it.id);
  }

  app.post('/api/queue/:id/shots', async (req, reply) => {
    const cur = load(req.params.id);
    if (!cur) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    const b = req.body || {};
    const list = Array.isArray(b.shots) ? b.shots : [];
    if (!list.length) return bad(reply, 'BAD_REQUEST', 'shots 不能为空');
    const shots = (cur.data.shots || []).slice();
    for (const s of list) {
      if (shots.length >= MAX_SHOTS) break;
      const url = String((s && s.url) || s || '');
      if (!/^data:image\/(png|jpe?g|webp);base64,/i.test(url)) return bad(reply, 'BAD_IMAGE', '只收 png/jpeg/webp 的 data URL');
      if (url.length > MAX_LEN) return bad(reply, 'TOO_LARGE', '单张图太大，先压到 3MB 以内');
      shots.push({ name: String((s && s.name) || ('shot' + (shots.length + 1))).slice(0, 60), url: url });
    }
    cur.data.shots = shots;
    save(cur.data);
    return ok(reply, { id: cur.id, count: shots.length });
  });

  app.delete('/api/queue/:id/shots/:idx', async (req, reply) => {
    const cur = load(req.params.id);
    if (!cur) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    const shots = (cur.data.shots || []).slice();
    const i = Number(req.params.idx);
    if (!(i >= 0 && i < shots.length)) return bad(reply, 'BAD_INDEX', '没有这张图', 404);
    shots.splice(i, 1);
    cur.data.shots = shots;
    save(cur.data);
    return ok(reply, { id: cur.id, count: shots.length });
  });

  /* 发布：核心在 publish.js，路由只做参数与错误映射 */
  app.post('/api/publish/:id', async (req, reply) => {
    const r = await publisher.publishItem(req.params.id, req.body || {});
    if (!r.ok && ctx.notify) {
      ctx.notify.send('publish.failed', 'SEEDPOD 发布失败：' + (r.message || r.code) + ' · ' + req.params.id,
        { id: req.params.id, code: r.code }).catch(function (e) { console.warn('[seedpod] notify failed:', e && e.message ? e.message : e) });
    }
    if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
    return ok(reply, r.data);
  });
};
