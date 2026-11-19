/* 目标站提交与回查（Fastify v2）。
   干跑默认；真提交必须 realPublish=true；cookie 只从加密凭据读。 */
const fs = require('fs');
const { makeTarget } = require('./target');
const stage = require('./stage');
const { makeTargetService } = require('./target-service');

module.exports = function (app, ctx) {
  const { db, one, ok, bad, jparse } = ctx;
  const target = makeTarget(ctx);
  const targetService = makeTargetService(ctx, target);
  const now = () => new Date().toISOString();

  function loadQueue(id) {
    const row = one('SELECT id, data FROM queue WHERE id = ?', String(id || ''));
    return row ? { id: row.id, data: jparse(row.data) || {} } : null;
  }
  /* 真提交前必须等源种在 qB 里下到 100%；自动发布已有同一道闸门 */
  async function sourceReady(id) {
    if (!ctx.publisher || !id) return { ok: true };
    const src = await ctx.publisher.ensureSource(id, {});
    if (!src.ok) return { ok: false, code: src.code, message: src.message, http: src.http || 400 };
    if (!src.complete) {
      const pct = Math.round((Number(src.progress) || 0) * 100);
      return { ok: false, code: 'SOURCE_NOT_READY', message: '源种还没下完（' + pct + '%），下完再提交', http: 409 };
    }
    return { ok: true };
  }
  function saveQueue(it) {
    db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(it), now(), it.id);
  }
  function realGate(item, hosts, body) {
    if (!body || body.dryRun !== false) return null;
    const title = String(item && item.title || '');
    if (/(^|[\s._-])(sample|test|probe|fixture)([\s._-]|$)/i.test(title)) {
      return { code: 'TEST_ITEM_BLOCKED', message: '标题像测试种子，禁止真实提交', http: 403 };
    }
    const cfgRow = one("SELECT v FROM meta WHERE k = 'config'");
    const cfg = JSON.parse(cfgRow ? cfgRow.v : 'null') || {};
    const confirmed = Array.isArray(body.confirmHosts) ? body.confirmHosts.map(function (h) { return String(h).toLowerCase(); }) : [];
    const nonTest = (hosts || []).map(function (h) { return String(h || '').toLowerCase(); }).filter(function (h) { return h && !/^(test[.-]|127\.0\.0\.1$|localhost$)/i.test(h); });
    if (cfg.testOnly !== false && nonTest.length) {
      return { code: 'TEST_ONLY', message: '当前只允许提交到测试站：' + nonTest.join('、'), http: 403 };
    }
    if (cfg.allowMainTarget === true) return null;
    const bad = nonTest.filter(function (h) { return confirmed.indexOf(h) < 0; });
    if (bad.length) return { code: 'MAIN_TARGET_LOCKED', message: '这是主站，需要单独输入域名确认：' + bad.join('、'), http: 403 };
    return null;
  }
  function checkHost(item, host) {
    if (item.targetSite && String(item.targetSite) !== String(host)) {
      return { code: 'TARGET_MISMATCH', message: '条目目标站是 ' + item.targetSite + '，跟请求的 ' + host + ' 不一致' };
    }
    return null;
  }
  function flowMap() {
    const row = one("SELECT v FROM meta WHERE k = 'flow'");
    const flow = JSON.parse(row ? row.v : 'null') || {};
    const sets = flow.sets || {};
    const out = {};
    ['fetch', 'dedupe', 'pub'].forEach(function (k) {
      (Array.isArray(sets[k]) ? sets[k] : []).forEach(function (g) {
        (Array.isArray(g) ? g : []).forEach(function (r) {
          if (r && r.t && out[r.t] === undefined) out[r.t] = r;
        });
      });
    });
    return out;
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

  app.get('/api/targets', async () => {
    /* 目标站只列启用中的站；停用站不再出现在多目标里。默认目标站例外，它是用户明确选的 */
    const row = one("SELECT v FROM meta WHERE k = 'config'");
    const cfg = JSON.parse(row ? row.v : 'null') || {};
    const targetHost = String(cfg.targetHost || '').toLowerCase();
    const list = target.list().filter(function (t) {
      if (cfg.testOnly !== false && !/^(test[.-]|127\.0\.0\.1$|localhost$)/i.test(String(t.host || ''))) return false;
      return t.enabled !== false || t.host === targetHost;
    });
    return ok(list);
  });

  app.post('/api/probe', async (req, reply) => {
    const r = await targetService.probe(req.body || {});
    if (!r.ok) return bad(reply, r.code || 'PROBE_FAILED', r.message || '探测失败', r.http || 400);
    return ok(reply, r.data);
  });

  app.post('/api/targets/:host/announce', async (req, reply) => {
    const r = await target.announceCandidates(req.params.host);
    if (!r.ok) return bad(reply, r.code || 'ANNOUNCE_FAILED', r.message || 'announce 探测失败', r.http || 400);
    return ok(reply, {
      host: r.data.host,
      candidates: (r.data.candidates || []).map(function (x) { return { source: x.source, kind: x.kind, hasPasskey: !!x.hasPasskey }; })
    });
  });

  app.post('/api/targets/:host/delete', async (req, reply) => {
    const b = req.body || {};
    const r = await target.deleteTorrent(req.params.host, { id: b.id, url: b.url }, {
      dryRun: b.dryRun !== false, check: !!b.check, reason: b.reason, reasonType: b.reasonType
    });
    if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
    return ok(reply, r.data);
  });

  app.get('/api/coverage', async (req, reply) => {
    try {
      const list = target.list();
      const sample = { title: 'Coverage Test 2024 1080p Blu-ray', cat: 'movie', res: '1080p', size: '20 GB', site: 'coverage.example' };
      const out = { total: list.length, withCookie: 0, ready: 0, upload: 0, verify: 0, planOk: 0, planFail: 0, errors: {} };
      list.forEach(function (t) {
        if (t.hasCookie) out.withCookie++;
        if (t.ready) out.ready++;
        if (t.uploadPath) out.upload++;
        if (t.verifyPath) out.verify++;
        const p = target.plan(t.host, sample);
        if (p.ok) out.planOk++;
        else {
          out.planFail++;
          const k = p.code || 'PLAN_FAILED';
          out.errors[k] = (out.errors[k] || 0) + 1;
        }
      });
      return ok(reply, out);
    } catch (e) {
      return bad(reply, 'COVERAGE_FAILED', String(e && e.message || e).slice(0, 160), 500);
    }
  });

  const DETECT_AT = new Map();
  app.post('/api/targets/:host/detect-form', async (req, reply) => {
    const host = req.params.host;
    const last = DETECT_AT.get(host) || 0;
    if (Date.now() - last < 60000) return bad(reply, 'TOO_SOON', '刚识别过，等 1 分钟再试', 429);
    const r = await target.detectUploadForm(host);
    if (r.code !== 'NO_COOKIE' && r.code !== 'NO_TARGET_DEF') DETECT_AT.set(host, Date.now());
    if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
    return ok(reply, r.data);
  });

  /* 源资源标题：发布 name 用源种原名；这里提供回填接口（规则：源资源标题） */
  app.post('/api/queue/:id/fill-source-title', async (req, reply) => {
    const row = one('SELECT id, data FROM queue WHERE id = ?', req.params.id);
    if (!row) return bad(reply, 'NOT_FOUND', '队列条目不存在', 404);
    const it = jparse(row.data) || {};
    let name = '';
    try {
      const t = it.targetResults && it.targetResults[String(it.targetSite || '').toLowerCase()];
      const src = t && t.sourceTorrent && t.sourceTorrent.path;
      if (src && fs.existsSync(src)) {
        const meta = target.torrentMeta(fs.readFileSync(src));
        name = (meta && meta.name) || '';
      }
    } catch (e) { name = ''; }
    if (!name) {
      const f = await target.fetchSourceTorrent(it);
      if (f.err) return bad(reply, 'SOURCE_TORRENT_FAILED', f.err, 400);
      const meta = target.torrentMeta(f.buf);
      name = (meta && meta.name) || '';
    }
    if (!name) return bad(reply, 'NO_TORRENT_NAME', '源种里没有标题', 422);
    it.title = String(name).slice(0, 300);
    it.sourceTitle = it.title;
    it.sourceTitleAt = new Date().toISOString();
    db.prepare('UPDATE queue SET title = ?, data = ?, updated_at = ? WHERE id = ?')
      .run(it.title, JSON.stringify(it), new Date().toISOString(), row.id);
    return ok(reply, { id: row.id, title: it.title });
  });

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
    if (item) {
      const gate = realGate(item.data, [req.params.host], b);
      if (gate) return bad(reply, gate.code, gate.message, gate.http);
    }
    if (b.dryRun === false) {
      const gate = await sourceReady(b.queueId);
      if (!gate.ok) return bad(reply, gate.code, gate.message, gate.http || 400);
    }
    const r = await targetService.upload(req.params.host, b);
    if (!r.ok) {
      if (ctx.notify) {
        ctx.notify.send('target.failed', 'SEEDPOD 目标站提交失败：' + req.params.host + ' · ' + (r.message || r.code),
          { host: req.params.host, id: (req.body && req.body.queueId) || '' }).catch(function (e) { console.warn('[seedpod] notify failed:', e && e.message ? e.message : e) });
      }
      return bad(reply, r.code, r.message, r.http || 400);
    }
    return ok(reply, r.data);
  });

  app.post('/api/queue/:id/targets/upload', async (req, reply) => {
    const b = Object.assign({}, req.body || {}, { queueId: req.params.id });
    const item = loadQueue(req.params.id);
    if (item) {
      let hosts = Array.isArray(b.targets) ? b.targets : [];
      if (!hosts.length) hosts = [item.data.targetSite].concat(Array.isArray(item.data.targets) ? item.data.targets : []).filter(Boolean);
      const gate = realGate(item.data, hosts, b);
      if (gate) return bad(reply, gate.code, gate.message, gate.http);
    }
    if (b.dryRun === false) {
      const gate = await sourceReady(req.params.id);
      if (!gate.ok) return bad(reply, gate.code, gate.message, gate.http || 400);
    }
    const r = await targetService.uploadMany(b);
    if (!r.ok) return bad(reply, r.code, r.message, r.http || 400);
    return ok(reply, r.data);
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
