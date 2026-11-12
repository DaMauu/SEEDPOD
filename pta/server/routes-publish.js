/* 截图上传与发布（Fastify v2）。发布默认只演练：真发帖要等站点表单适配验证后再开。 */
module.exports = function (app, ctx) {
  const { db, one, ok, bad, jparse } = ctx;
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

  /* 发布：dryRun 默认 true（只校验不落账）；real 模式走真实状态流转并写 published。
     真发帖（POST 站点表单）不在这一步，按作者要求还没开始。 */
  app.post('/api/publish/:id', async (req, reply) => {
    const cur = load(req.params.id);
    if (!cur) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    const b = req.body || {};
    const dryRun = b.dryRun !== false;
    const it = cur.data;
    if (!it.title) return bad(reply, 'BAD_ITEM', '条目没有标题，发不了');
    if (!it.targetSite) return bad(reply, 'NO_TARGET', '还没选目标站');
    if (dryRun) {
      it.pubMsg = '演练：已按 ' + it.targetSite + ' 的表单准备标题、副标题、简介、' + (it.shots || []).length + ' 张图，没有发出真实请求';
      return ok(reply, { id: it.id, dryRun: true, published: false, msg: it.pubMsg });
    }
    if (!ctx.allowReal('realPublish')) {
      return bad(reply, 'REAL_PUBLISH_DISABLED', '真发布还没打开：把配置 realPublish 设为 true（或设 PTA_ALLOW_REAL=1）再试', 409);
    }
    if (it.status !== 'pending' && it.status !== 'approved' && it.status !== 'failed') {
      return bad(reply, 'BAD_STATE', '当前状态 ' + it.status + ' 不能发布');
    }
    it.status = 'published';
    it.publishedAt = now();
    it.approvedAt = it.approvedAt || now();
    it.pubMsg = '已通过并发布（记账）；真发帖未开始';
    save(it);
    db.prepare('INSERT INTO published(id, data, created_at) VALUES(?, ?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data')
      .run(it.id, JSON.stringify(it), it.publishedAt);
    if (it.catalogId) {
      const c = one('SELECT data FROM catalog WHERE id = ?', String(it.catalogId));
      if (c) {
        const cd = jparse(c.data) || {};
        cd.status = 'published';
        cd.updatedAt = now();
        db.prepare('UPDATE catalog SET data = ?, status = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(cd), 'published', now(), String(it.catalogId));
      }
    }
    return ok(reply, { id: it.id, dryRun: false, published: true, msg: it.pubMsg });
  });
};
