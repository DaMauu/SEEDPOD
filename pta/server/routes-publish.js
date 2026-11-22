/* 截图上传与发布（Fastify v2）。发布默认只演练：真发帖要等站点表单适配验证后再开。 */
const { makePublisher } = require('./publish');
const imagehost = require('./imagehost');
const flowConfig = require('./src/features/settings/flow-config');
const uploadLock = require('./src/infra/upload-lock');

module.exports = function (app, ctx) {
  const { db, one, ok, bad, jparse } = ctx;
  const publisher = makePublisher(ctx);
  const release = require('./release').makeRelease(ctx);
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

  /* 图床：默认演练；真上传要 realImages 开关，且只接受已验证的 custom/local 接口 */
  app.post('/api/queue/:id/images', async (req, reply) => {
    let cur = load(req.params.id);
    if (!cur) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    const b = req.body || {};
    let shots = Array.isArray(cur.data.shots) ? cur.data.shots : [];
    if (!shots.length) return bad(reply, 'NO_SHOTS', '还没有截图', 400);
    const picked = String(b.imageHost || cur.data.imageHost || '').trim();
    const provider = picked && picked !== '站内' ? picked : imagehost.defaultProvider();
    const dryRun = b.dryRun !== false;
    const allowReal = !dryRun && ctx.allowReal('realImages');
    if (!dryRun && !allowReal) {
      return bad(reply, 'REAL_IMAGES_DISABLED', '图床真上传没打开：把配置 realImages 设为 true（或设 ALLOW_REAL=1）再试', 409);
    }
    const retries = b.retries !== undefined ? b.retries : flowConfig.number(flowConfig.read(ctx), '图片上传重试', 2);
    const lockId = cur.id;
    if (!uploadLock.acquire(lockId, db)) return bad(reply, 'UPLOAD_IN_PROGRESS', '这个条目正在提交，等这次结束', 409);
    try {
      cur = load(req.params.id);
      if (!cur) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
      shots = Array.isArray(cur.data.shots) ? cur.data.shots : [];
      if (!shots.length) return bad(reply, 'NO_SHOTS', '还没有截图', 400);
      let r;
      try {
        r = await imagehost.process(provider, shots, { dryRun: dryRun, allowReal: allowReal, retries: retries, delayMs: b.delayMs });
      } catch (e) {
        return bad(reply, 'IMAGE_HOST_FAILED', String(e && e.message || e).slice(0, 240), 502);
      }
      cur.data.imagePlan = { at: now(), provider: r.provider, dryRun: r.dryRun, total: r.total, uploaded: r.uploaded, failed: r.failed, code: r.code, message: r.message };
      if (dryRun || r.code === 'IMAGE_HOST_MANUAL') {
        save(cur.data);
        return ok(reply, r);
      }
      if (!r.items.some(function (x) { return x.ok; })) {
        save(cur.data);
        return bad(reply, r.code, r.message, r.http || 502);
      }
      cur.data.imageHost = provider;
      cur.data.imageLinks = r.items.filter(function (x) { return x.ok && x.url; }).map(function (x) { return { name: x.name, url: x.url }; });
      save(cur.data);
      const prep = release.prepare(req.params.id, {});
      if (!prep.ok) return ok(reply, Object.assign({}, r, { preparedError: prep.message }));
      return ok(reply, Object.assign({}, r, { prepared: prep.data.prepared }));
    } finally { uploadLock.release(lockId, db); }
  });

  /* 客户端注入：默认演练；真注入复用 publishItem 的取种/加种/回查链路 */
  app.post('/api/queue/:id/inject', async (req, reply) => {
    const b = req.body || {};
    if (b.dryRun !== false) {
      const r = publisher.injectPlan(req.params.id, b);
      if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
      const cur = load(req.params.id);
      if (cur) {
        cur.data.injectPlan = r.data;
        save(cur.data);
      }
      return ok(reply, r.data);
    }
    const r = await publisher.publishItem(req.params.id, Object.assign({}, b, { dryRun: false }));
    if (!r.ok && ctx.notify) {
      ctx.notify.send('inject.failed', 'SEEDPOD 注入失败：' + (r.message || r.code) + ' · ' + req.params.id,
        { id: req.params.id, code: r.code }).catch(function (e) { console.warn('[seedpod] notify failed:', e && e.message ? e.message : e) });
    }
    if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
    return ok(reply, r.data);
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
