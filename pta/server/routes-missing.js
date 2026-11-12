/* 补齐前端仍在调用的缺口接口：队列批量、抓取执行、更新日志、事件流别名。 */
const fs = require('fs');
const path = require('path');

module.exports = function (app, ctx) {
  const { db, one, all, ok, bad, jparse, DATA_DIR } = ctx;
  const now = () => new Date().toISOString();

  /* 队列批量动作：approve / reject / skip / delete */
  app.post('/api/queue/bulk', async (req, reply) => {
    const b = req.body || {};
    const ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    const action = String(b.action || '');
    if (!ids.length) return bad(reply, 'BAD_REQUEST', 'ids 不能为空');
    if (['approve', 'reject', 'skip'].indexOf(action) < 0) return bad(reply, 'BAD_REQUEST', 'action 只能是 approve / reject / skip');
    const target = { approve: 'approved', reject: 'rejected', skip: 'skipped' }[action];
    let changed = 0;
    ids.slice(0, 200).forEach(function (id) {
      const row = one('SELECT data FROM queue WHERE id = ?', id);
      if (!row) return;
      const it = jparse(row.data) || {};
      it.status = target;
      it.actionAt = now();
      db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?').run(target, JSON.stringify(it), now(), id);
      changed++;
    });
    return ok(reply, { changed: changed, status: target });
  });

  /* 抓取执行：按铁律只允许演练，真抓尚未接入 */
  app.post('/api/crawl/run', async (req, reply) => {
    const b = req.body || {};
    const dryRun = b.dryRun !== false;
    if (!dryRun) return bad(reply, 'NOT_IMPLEMENTED', '真抓取还没接（要过站点适配验证），先用演练', 501);
    const host = String(b.siteHost || b.host || '').trim().toLowerCase();
    if (host && !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', 'siteHost 不合法');
    return ok(reply, { dryRun: true, siteHost: host, startedAt: now(), steps: ['准备', '读取配置', '生成清单', '汇总'], note: '演练：没有发出真实请求' });
  });

  /* 更新日志：读 CHANGELOG.md，前端按 Markdown 标题/列表渲染 */
  app.get('/api/changelog', async (req, reply) => {
    const p = path.join(DATA_DIR, '..', 'CHANGELOG.md');
    let text = '';
    try { text = fs.readFileSync(p, 'utf8'); } catch (e) { return bad(reply, 'NO_CHANGELOG', '读不到 CHANGELOG.md', 500); }
    const version = (one('SELECT 1 AS x') && require('../../package.json').version) || '';
    return ok(reply, { version: version, text: text.slice(0, 200000) });
  });

  /* 事件流别名：前端日志面板用的是 /api/logs/stream，这里提供 /api/events 兼容 */
  app.get('/api/events', async (req, reply) => {
    reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    reply.raw.write('retry: 3000\n\n');
    const ping = setInterval(function () { try { reply.raw.write(': ping\n\n'); } catch (e) {} }, 15000);
    req.raw.on('close', function () { clearInterval(ping); });
    return reply;
  });
};
