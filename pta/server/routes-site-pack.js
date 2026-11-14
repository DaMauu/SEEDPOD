/* 站点包状态与分类例外接口：例外确认只写私有 data/site-defs，不改密文包。 */
module.exports = function (app, ctx) {
  const { ok, bad } = ctx;
  const admin = require('./site-pack-admin');

  app.get('/api/site-pack', async (req) => ok(admin.overview(ctx, {
    q: req.query.q, host: req.query.host, limit: req.query.limit
  })));

  app.post('/api/site-pack/exception', async (req, reply) => {
    const r = admin.confirm(ctx, req.body || {});
    if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
    return ok(reply, r.data);
  });
};
