/* 发布预览（Fastify v2）。按队列条目拼标题/副标题/简介，不发请求。 */
module.exports = function (app, ctx) {
  const { one, ok, bad, jparse } = ctx;
  app.post('/api/publish/preview', async (req, reply) => {
    const id = String((req.body && req.body.id) || '');
    const row = one('SELECT data FROM queue WHERE id = ?', id);
    if (!row) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    const it = jparse(row.data) || {};
    const built = require('../features/media/meta').buildNames(it);
    return ok(reply, { id: id, target: it.targetSite || '', title: built.title,
      subtitle: built.subtitle, description: built.description, shots: (it.shots || []).length });
  });
};
