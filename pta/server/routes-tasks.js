/* 演练任务与发布预览（Fastify v2）。演练只走本地步骤，不发真实请求。 */
module.exports = function (app, ctx) {
  const { one, ok, bad, jparse } = ctx;
  const TASKS = new Map();
  let seq = 0;
  const now = () => new Date().toISOString();
  const STEPS = ['准备', '读取面板配置', '读取站点配置与搜索预设', '生成待抓取清单', '汇总'];

  app.post('/api/tasks', async (req, reply) => {
    const b = req.body || {};
    const host = String(b.siteHost || '').trim().toLowerCase();
    if (!host || !/^[a-z0-9][a-z0-9.-]*$/i.test(host)) return bad(reply, 'BAD_HOST', 'siteHost 不合法');
    if (b.dryRun === false) return bad(reply, 'DRY_RUN_ONLY', '真抓取还没接入，目前只支持演练（dryRun: true）');
    const id = 'task_' + String(++seq).padStart(4, '0');
    const t = { id: id, type: String(b.type || 'crawl'), siteHost: host, dryRun: true, state: 'running', progress: 0,
      steps: STEPS.map(function (s) { return { name: s, state: 'wait' }; }), createdAt: now(), startedAt: now() };
    TASKS.set(id, t);
    let i = 0;
    const timer = setInterval(function () {
      if (i >= STEPS.length) { clearInterval(timer); t.state = 'done'; t.progress = 100; t.finishedAt = now(); return; }
      t.steps[i].state = 'done';
      i++;
      t.progress = Math.round(i / STEPS.length * 100);
    }, 260);
    return ok(reply, t);
  });

  app.get('/api/tasks', async () => ok(Array.from(TASKS.values()).slice(-50).reverse()));
  app.get('/api/tasks/:id', async (req, reply) => {
    const t = TASKS.get(req.params.id);
    if (!t) return bad(reply, 'NOT_FOUND', '任务不存在', 404);
    return ok(reply, t);
  });

  /* 发布预览：按队列条目拼标题/副标题/简介，不发请求 */
  app.post('/api/publish/preview', async (req, reply) => {
    const id = String((req.body && req.body.id) || '');
    const row = one('SELECT data FROM queue WHERE id = ?', id);
    if (!row) return bad(reply, 'NOT_FOUND', '条目不存在', 404);
    const it = jparse(row.data) || {};
    const title = String(it.title || '').replace(/\s+/g, ' ').trim();
    const sub = [it.cn, it.res, it.size].filter(Boolean).join(' · ');
    const desc = [title, it.res ? it.res + ' 原盘' : '', it.site ? '来源 ' + it.site : ''].filter(Boolean).join('，') + '。';
    return ok(reply, { id: id, target: it.targetSite || '', title: title, subtitle: sub, description: desc, shots: (it.shots || []).length });
  });
};
