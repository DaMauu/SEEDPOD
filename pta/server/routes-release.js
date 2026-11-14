/* 单 release 准备接口：prepare / preview / advance / run。
   只做本地准备，不发目标站请求；提交仍走 routes-target / routes-publish。 */
module.exports = function (app, ctx) {
  const { ok, bad } = ctx;
  const release = require('./release').makeRelease(ctx);

  function send(reply, r) {
    if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
    return ok(reply, r.data);
  }

  app.post('/api/queue/:id/prepare', async (req, reply) => {
    return send(reply, release.prepare(req.params.id, req.body || {}));
  });

  app.get('/api/queue/:id/preview', async (req, reply) => {
    return send(reply, release.preview(req.params.id));
  });

  app.post('/api/queue/:id/advance', async (req, reply) => {
    return send(reply, release.advance(req.params.id, req.body || {}));
  });

  app.post('/api/release/run', async (req, reply) => {
    return send(reply, release.run(req.body || {}));
  });
};
