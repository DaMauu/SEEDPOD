/* 补齐前端仍在调用的缺口接口：队列批量、抓取执行、更新日志、事件流别名。 */
const fs = require('fs');
const path = require('path');
const form = require('./form');

module.exports = function (app, ctx) {
  const { db, one, all, ok, bad, jparse, DATA_DIR } = ctx;
  const now = () => new Date().toISOString();

  /* 上传表单识别：只解析用户贴进来的本地 HTML，不联网。 */
  app.post('/api/form/parse', async (req, reply) => {
    const html = String((req.body && req.body.html) || '');
    if (!html.trim()) return bad(reply, 'BAD_REQUEST', 'html 必填');
    if (html.length > 2 * 1024 * 1024) return bad(reply, 'TOO_LARGE', 'HTML 超过 2MB');
    const forms = form.parse(html);
    if (!forms.length) return bad(reply, 'NO_FORM', '没识别到上传表单字段，可以继续用 JSON 编辑', 422);
    return ok(reply, { forms: forms, path: forms[0].action || '', fileField: forms[0].fileField || '' });
  });

  /* 队列批量动作：approve / reject / skip / delete */
  app.post('/api/queue/bulk', async (req, reply) => {
    const b = req.body || {};
    let ids = Array.isArray(b.ids) ? b.ids.map(String) : [];
    const action = String(b.action || '');
    if (['approve', 'reject', 'skip', 'publish'].indexOf(action) < 0) return bad(reply, 'BAD_REQUEST', 'action 只能是 approve / reject / skip / publish');
    const fromStatus = String(b.fromStatus || (action === 'publish' ? 'approved' : 'pending'));
    if (!ids.length) ids = all('SELECT id FROM queue WHERE status = ? LIMIT 200', fromStatus).map(function (r) { return r.id; });
    if (!ids.length) return ok(reply, { changed: 0, skipped: 0, errors: [] });
    let changed = 0, skipped = 0;
    const errors = [];
    if (action === 'publish') {
      for (const id of ids.slice(0, 200)) {
        const r = await ctx.publisher.publishItem(id, { dryRun: false });
        if (r.ok) changed++;
        else { skipped++; if (errors.length < 3) errors.push({ id: id, code: r.code, message: r.message }); }
      }
      return ok(reply, { changed: changed, skipped: skipped, errors: errors });
    }
    const target = { approve: 'approved', reject: 'rejected', skip: 'skipped' }[action];
    ids.slice(0, 200).forEach(function (id) {
      const row = one('SELECT data FROM queue WHERE id = ?', id);
      if (!row) return;
      const it = jparse(row.data) || {};
      it.status = target;
      it.actionAt = now();
      if (b.reason) it.reason = String(b.reason).slice(0, 500);
      db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?').run(target, JSON.stringify(it), now(), id);
      changed++;
    });
    return ok(reply, { changed: changed, status: target });
  });

  /* 抓取执行：演练默认；真抓需显式打开 realCrawl（或 PTA_ALLOW_REAL=1） */
  app.post('/api/crawl/run', async (req, reply) => {
    const b = req.body || {};
    const dryRun = b.dryRun !== false;
    const host = String(b.siteHost || b.host || '').trim().toLowerCase();
    if (host && !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', 'siteHost 不合法');
    if (!dryRun) {
      if (!ctx.allowReal('realCrawl')) return bad(reply, 'REAL_CRAWL_DISABLED', '真抓取还没打开：把配置 realCrawl 设为 true（或设 PTA_ALLOW_REAL=1）再试', 409);
      if (!host) return bad(reply, 'BAD_REQUEST', '要指定 siteHost');
      const r = await ctx.crawl.crawlOnce(host, { catIdx: b.catIdx, page: b.page, limit: b.limit, detail: b.detail, detailLimit: b.detailLimit, rotate: b.rotate });
      if (r && r.err) {
        const http = (r.err.code === 'TOO_SOON' || r.err.code === 'DAILY_LIMIT') ? 429 : 502;
        return bad(reply, r.err.code, r.err.message, http);
      }
      return ok(reply, r);
    }
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


  /* 发布预览：前端用 GET ?id=，与 POST 版本等价 */
  app.get('/api/publish/preview', async (req, reply) => {
    const id = String(req.query.id || '');
    const row = one('SELECT data FROM queue WHERE id = ?', id);
    if (!row) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    const it = jparse(row.data) || {};
    const title = String(it.title || '').replace(/\s+/g, ' ').trim();
    const built = require('./meta').buildNames(it);
    return ok(reply, { id: id, target: it.targetSite || '', title: title,
      subtitle: built.subtitle,
      description: built.description,
      parsed: built.parsed,
      releaseTitle: built.releaseTitle,
      shots: (it.shots || []).length });
  });

  /* 单条查重：队列 / 已发布 / 词条库本地比对，不发真实请求（真搜走 /api/dupe/check） */
  app.post('/api/queue/:id/check', async (req, reply) => {
    const row = one('SELECT data FROM queue WHERE id = ?', req.params.id);
    if (!row) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    const it = jparse(row.data) || {};
    const norm = (s) => String(s || '').toLowerCase().replace(/[\s\-_.]+/g, '');
    const title = norm(it.title);
    const hash = String(it.infohash || '').toLowerCase();
    let note = '';
    const hit = function (o, label) {
      if (note || !o) return;
      if (hash && String(o.infohash || '').toLowerCase() === hash) { note = label; return; }
      if (title && norm(o.title) === title) note = label;
    };
    all('SELECT id, title, data FROM queue').forEach(function (r) {
      if (String(r.id) === String(it.id)) return;
      hit(jparse(r.data) || { title: r.title }, '队列里的 ' + r.id);
    });
    all('SELECT id, data FROM published').forEach(function (r) { hit(jparse(r.data) || {}, '已发布 ' + r.id); });
    all("SELECT id, data FROM catalog WHERE status IN ('selected','published')").forEach(function (r) { hit(jparse(r.data) || {}, '词条库 ' + r.id); });
    it.check = note ? '已有同片' : '无重复';
    it.checkCls = note ? 'amber' : 'green';
    it.checkAt = now();
    db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(it), now(), it.id);
    return ok(reply, { id: it.id, duplicate: !!note, status: note ? 'dupe' : 'clean', matched: note, note: note || '本地库里没有重复' });
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
