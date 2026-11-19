/* 目标站提交与回查（Fastify v2）。
   干跑默认；真提交必须 realPublish=true；cookie 只从加密凭据读。 */
const fs = require('fs');
const path = require('path');
const flowConfig = require('./flow-config');
const torrentClean = require('./torrent-clean');
const mediainfo = require('./mediainfo');
const { failuresOf, isDead } = require('./failure-queue');
const { makeTarget } = require('./target');
const stage = require('./stage');
const { makeTargetService } = require('./target-service');
const { makeCrossseed } = require('./crossseed');

module.exports = function (app, ctx) {
  const { db, one, ok, bad, jparse } = ctx;
  const target = makeTarget(ctx);
  const targetService = makeTargetService(ctx, target);
  const crossseed = makeCrossseed(ctx);
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
  async function runCrossseed(id, hosts) {
    if (!hosts || !hosts.length) return;
    const item = loadQueue(id);
    if (!item) return;
    for (const host of hosts) {
      try {
        const r = await crossseed.run({ id: item.id, data: item.data }, host, {});
        if (ctx.logEvent) ctx.logEvent(r.ok ? 'info' : 'warn', '目标站', '辅种' + (r.ok ? '完成' : '待重试') + ' · ' + host + ' · queue ' + id + (r.error ? ' · ' + r.error : ''));
      } catch (e) {
        if (ctx.logEvent) ctx.logEvent('warn', '目标站', '辅种异常 · ' + host + ' · queue ' + id + ' · ' + String(e && e.message || e).slice(0, 120));
      }
    }
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

  /* 发布前检查：只读计划和本地缓存源种，不请求目标站、不上传、不返回 announce 明文 */
  app.get('/api/queue/:id/publish-preview', async (req, reply) => {
    const item = loadQueue(req.params.id);
    if (!item) return bad(reply, 'NOT_FOUND', '队列条目不存在', 404);
    const host = String((req.query && req.query.host) || item.data.targetSite || '').trim().toLowerCase();
    if (!host) return bad(reply, 'NO_TARGET', '还没选目标站', 400);
    const p = target.plan(host, item.data);
    if (!p.ok) return bad(reply, p.code || 'PLAN_FAILED', p.message || '目标站计划失败', p.http || 400);
    const plan = p.data || {};
    const src = item.data.sourceState || {};
    const sourceHash = String(src.hash || (item.data.prepared && item.data.prepared.torrent && item.data.prepared.torrent.hash) || '');
    let checked = false;
    let hashUnchanged = null;
    if (sourceHash) {
      try {
        const file = path.join(ctx.DATA_DIR, 'torrents', 'source-' + sourceHash + '.torrent');
        if (fs.existsSync(file)) {
          const buf = fs.readFileSync(file);
          const before = torrentClean.infoHashOf(buf);
          /* 占位 announce 只为验证清洗不碰 info；不依赖目标站网络，也不回传真实 passkey */
          const after = torrentClean.infoHashOf(torrentClean.replaceAnnounce(buf, 'https://preview.invalid/announce'));
          checked = true;
          hashUnchanged = before === after && before === sourceHash;
        }
      } catch (e) { checked = false; hashUnchanged = null; }
    }
    const cleanOn = flowConfig.on(flowConfig.read(ctx), '上传前清洗 tracker', true);
    /* 失败与重试状态：只读队列，给发布前检查显示是否已用完自动重试 */
    let retry = null;
    const fails = failuresOf(item.data);
    if (fails.length) {
      const cfgRow2 = one("SELECT v FROM meta WHERE k = 'config'");
      const cfg2 = JSON.parse(cfgRow2 ? cfgRow2.v : 'null') || {};
      const max = Math.max(0, Math.min(10, cfg2.retryMax === undefined ? 2 : Number(cfg2.retryMax) || 0));
      const next = fails.map(function (f) { return f.nextRetryAt; }).filter(Boolean).sort()[0] || '';
      retry = {
        dead: isDead(fails, max),
        count: fails.length,
        attempts: Math.max.apply(null, fails.map(function (f) { return Number(f.attempts) || 0; })),
        nextRetryAt: next,
        stage: fails[0].stage || '',
        code: fails[0].code || '',
        message: fails[0].message || ''
      };
    }
    /* 媒体信息：优先用已存字段，弱值就去源站简介里重新识别 */
    let media = null;
    const bb = String(item.data.descrBb || item.data.intro || '');
    const ex = mediainfo.extractFromBbcode(bb);
    let mediaRaw = '';
    if (!mediainfo.isWeakMedia(item.data.bdinfo)) mediaRaw = item.data.bdinfo;
    else if (!mediainfo.isWeakMedia(item.data.mediainfo)) mediaRaw = item.data.mediainfo;
    else if (ex.bdinfo) mediaRaw = ex.bdinfo.raw;
    else if (ex.mediainfo) mediaRaw = ex.mediainfo.raw;
    if (mediaRaw) {
      const p2 = mediainfo.parse(mediaRaw);
      if (p2.kind) media = { kind: p2.kind, summary: p2.summary || '', source: 'source' };
    }
    const f = plan.fields || {};
    /* 目标站查重状态：只读队列里已有的结果，不在待审页发请求 */
    const dr = (item.data.dupeResults && item.data.dupeResults[host]) || null;
    let dupe = { state: 'unchecked', label: '发布时自动查' };
    if (dr) {
      dupe = (dr.found || dr.skip)
        ? { state: 'exists', label: '目标站已有同种，发布会跳过' }
        : { state: 'passed', label: '目标站查重已通过' };
    } else if (item.data.dupePassedAt) {
      dupe = { state: 'passed', label: '目标站查重已通过' };
    } else if (item.data.dupeLastError) {
      dupe = { state: 'error', label: '上次查重失败：' + String(item.data.dupeLastError).slice(0, 80) };
    }
    return ok(reply, {
      host: host,
      ready: !!plan.ready,
      dupe: dupe,
      retry: retry,
      media: media,
      warnings: plan.warnings || [],
      labels: plan.labels || {},
      fields: { type: f.type || '', source_sel: f.source_sel || '', team_sel: f.team_sel || '', medium_sel: f.medium_sel || '', standard_sel: f.standard_sel || '' },
      torrent: { hash: sourceHash, name: String(src.name || ''), size: String(item.data.size || '') },
      checked: checked,
      hashUnchanged: hashUnchanged,
      cleanEnabled: cleanOn,
      trackerNote: cleanOn ? '只换目标站通用 announce；找不到就停，不直传' : '未清洗：源站 tracker 会带过去'
    });
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
    if (b.dryRun === false) {
      const hosts = ((r.data && r.data.targets) || []).filter(function (x) { return x && x.ok; }).map(function (x) { return x.host; });
      await runCrossseed(req.params.id, hosts);
    }
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
