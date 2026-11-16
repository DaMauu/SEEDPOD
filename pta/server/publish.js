/* 发布核心：dry-run、真发布（取种 + qB add + 回查）、状态落账。
   路由与调度器共用，避免两份实现。 */
const secretbox = require('./secretbox');
const { makeQb } = require('./qb');
const watch = require('./clients/watch');
const stage = require('./stage');
const flowConfig = require('./flow-config');

function makePublisher(ctx) {
  const { db, one, all, DATA_DIR, jparse } = ctx;
  const KEYRING = secretbox.loadKey(DATA_DIR);
  const qb = makeQb(DATA_DIR);
  const now = () => new Date().toISOString();

  function load(id) {
    const row = one('SELECT id, data FROM queue WHERE id = ?', id);
    return row ? { id: row.id, data: jparse(row.data) || {} } : null;
  }
  function save(it) {
    db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
      .run(it.status, JSON.stringify(it), now(), it.id);
  }
  function cookieOf(host) {
    const r = one('SELECT cookie FROM credentials WHERE host = ?', String(host || ''));
    if (!r || !r.cookie) return '';
    try { return secretbox.decrypt(r.cookie, KEYRING.key); } catch (e) { return ''; }
  }
  function downloaderOf(body, it) {
    const want = String((body && body.downloaderId) || it.downloaderId || '');
    const rows = all('SELECT data FROM downloaders').map(function (r) { return jparse(r.data) || {}; });
    if (want) return rows.filter(function (d) { return d.id === want; })[0] || null;
    return rows[0] || null;
  }
  function injectPlanFor(it, dl, body) {
    const b = body || {};
    stage.ensure(it);
    const kind = String((dl && dl.kind) || 'qb');
    const out = { ok: true, dryRun: true, client: kind,
      downloader: { id: dl.id, name: dl.name || '' },
      item: { id: it.id, title: it.title || '', stage: it.stage || 'draft', status: it.status || '' },
      hash: String(it.infohash || '').toLowerCase(),
      savePath: String(b.savePath || it.savePath || ''),
      category: String(b.category || it.category || ''),
      idempotent: false, alreadyInjected: false, wouldAdd: false, wouldWrite: false,
      retry: false, warnings: [], message: '' };
    if (stage.isInjected(it)) {
      out.idempotent = true;
      out.alreadyInjected = true;
      out.skipped = true;
      out.message = '已注入过，跳过重复操作';
      return out;
    }
    if (!it.title) out.warnings.push('条目没有标题');
    if (!it.downloadUrl) out.warnings.push('没有种子下载地址；真注入前要补种子');
    if (kind !== 'qb' && kind !== 'watch') {
      out.ok = false;
      out.code = 'UNSUPPORTED_DOWNLOADER';
      out.message = '这个下载器类型已不再支持；请改用 qB 或 watch';
      return out;
    }
    if (kind === 'watch') {
      const d = watch.normDir(dl.watchPath);
      if (d.err) { out.ok = false; out.code = 'BAD_WATCH_PATH'; out.message = d.err; return out; }
      out.wouldWrite = true;
      out.watchPath = d.dir;
      out.savePath = d.dir;
      out.filename = watch.safeName(String(it.title || 'upload').slice(0, 60) + '.torrent');
      out.message = '演练：会写入 watch 目录 ' + d.dir;
    } else {
      out.wouldAdd = true;
      out.url = String(dl.url || '');
      out.message = '演练：会通过 qB 加种' + (out.savePath ? ' · 保存到 ' + out.savePath : '');
    }
    if (it.stage === 'failed' && it.stageFailedFrom === 'injected') {
      out.retry = true;
      out.nextRetryAt = it.stageNextRetryAt || '';
      out.message += '；上次注入失败，这次是重试';
    }
    return out;
  }
  async function fetchTorrent(url, cookie) {
    if (!/^https?:\/\//i.test(String(url || ''))) return { err: '下载地址必须是 http/https' };
    if (!cookie) return { err: '来源站没有 cookie，取不到种子' };
    let res;
    try {
      res = await fetch(url, { headers: { cookie: cookie, 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
    } catch (e) {
      return { err: e && e.name === 'TimeoutError' ? '下载种子超时' : '下载种子失败：' + String(e && e.message || e).slice(0, 120) };
    }
    if (res.status !== 200) return { err: '下载种子返回 ' + res.status };
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length) return { err: '种子是空文件' };
    if (buf.length > 10 * 1024 * 1024) return { err: '种子超过 10MB' };
    if (/^\s*</.test(buf.slice(0, 200).toString('utf8'))) return { err: '下载到的是网页，不是种子' };
    return { buf: buf };
  }

  async function publishItem(id, body) {
    const b = body || {};
    const cur = load(id);
    if (!cur) return { ok: false, code: 'NOT_FOUND', message: '条目不存在', http: 404 };
    const dryRun = b.dryRun !== false;
    const it = cur.data;
    stage.ensure(it);
    if (stage.isInjected(it)) return { ok: true, data: { id: it.id, skipped: true, published: true, msg: '已注入过，跳过重复操作' } };
    if (!it.title) return { ok: false, code: 'BAD_ITEM', message: '条目没有标题，发不了', http: 400 };
    if (!it.targetSite) return { ok: false, code: 'NO_TARGET', message: '还没选目标站', http: 400 };
    const dl = downloaderOf(b, it);
    if (!dl) return { ok: false, code: 'NO_DOWNLOADER', message: '没有可用下载器，先去流程页添加 qB 或 watch', http: 400 };
    const clientKind = String(dl.kind || 'qb');
    if (clientKind !== 'qb' && clientKind !== 'watch') {
      return { ok: false, code: 'UNSUPPORTED_DOWNLOADER', message: '这个下载器类型已不再支持；请改用 qB 或 watch', http: 400 };
    }

    if (dryRun) {
      const plan = injectPlanFor(it, dl, b);
      if (!plan.ok) return { ok: false, code: plan.code, message: plan.message, http: 400 };
      it.pubMsg = plan.message;
      return { ok: true, data: { id: it.id, dryRun: true, published: false, inject: plan, qb: { wouldAdd: plan.wouldAdd, downloader: { id: dl.id, name: dl.name || '' } }, msg: plan.message } };
    }
    if (!ctx.allowReal('realPublish')) {
      return { ok: false, code: 'REAL_PUBLISH_DISABLED', message: '真发布还没打开：把配置 realPublish 设为 true（或设 PTA_ALLOW_REAL=1）再试', http: 409 };
    }
    if (it.status !== 'pending' && it.status !== 'approved' && it.status !== 'failed') {
      return { ok: false, code: 'BAD_STATE', message: '当前状态 ' + it.status + ' 不能发布', http: 400 };
    }

    const got = await fetchTorrent(it.downloadUrl, cookieOf(it.site));
    if (got.err) {
      stage.fail(it, it.stage || 'previewed', got.err);
      save(it);
      return { ok: false, code: 'TORRENT_FETCH_FAILED', message: got.err, http: 502 };
    }
    const meta = qb.parseTorrent(got.buf);
    if ((dl.kind || 'qb') === 'watch') {
      const w = watch.addTorrent({ dir: dl.watchPath, buf: got.buf, filename: String(it.title || 'upload').slice(0, 60) + '.torrent' });
      if (!w.ok) {
        it.status = 'failed';
        it.pubMsg = 'watch 写入失败：' + w.message;
        stage.fail(it, it.stage || 'previewed', it.pubMsg);
        save(it);
        return { ok: false, code: w.error || 'WATCH_WRITE_FAILED', message: w.message || 'watch 写入失败', http: 502 };
      }
      it.status = 'published';
      it.publishedAt = now();
      it.approvedAt = it.approvedAt || now();
      it.qb = { id: dl.id, name: dl.name || '', at: it.publishedAt, message: w.message || 'Ok.',
        hash: meta.hash || '', torrentName: meta.name || '', state: 'watch', progress: 0,
        verified: true, client: 'watch', path: w.path };
      it.pubMsg = '已写入 watch 目录：' + w.path;
      stage.set(it, 'injected', { evidence: { client: 'watch', hash: meta.hash || '', path: w.path, verified: true } });
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
      return { ok: true, data: { id: it.id, dryRun: false, published: true,
        qb: { added: true, client: 'watch', path: w.path, message: w.message || 'Ok.', hash: meta.hash || '', verified: true, state: 'watch' },
        msg: it.pubMsg } };
    }
    let add = await qb.addTorrent(dl, got.buf, {
      savePath: b.savePath || it.savePath,
      category: b.category || it.category,
      autoTMM: flowConfig.on(flowConfig.read(ctx), 'qB 自动种子管理', false),
      filename: String(it.title || 'upload').slice(0, 60) + '.torrent'
    });
    /* qB 里已经有同 hash 的种（比如上次注入过）：qB 会回 Fails.，确认存在就当成功 */
    if (!add.ok && /fails|already|duplicate|exist/i.test(String(add.message || ''))) {
      const ex = await qb.findTorrent(dl, meta.hash, meta.name);
      if (ex.found) add = { ok: true, existing: true, message: '已在 qB 里，跳过重复添加' };
    }
    if (!add.ok) {
      it.status = 'failed';
      it.pubMsg = 'qB 添加失败：' + (add.message || add.error);
      stage.fail(it, it.stage || 'previewed', it.pubMsg);
      save(it);
      return { ok: false, code: add.error || 'QB_ADD_FAILED', message: add.message || 'qB 添加失败', http: 502 };
    }

    const chk = await qb.findTorrent(dl, meta.hash, meta.name);
    it.status = 'published';
    it.publishedAt = now();
    it.approvedAt = it.approvedAt || now();
    it.qb = { id: dl.id, name: dl.name || '', at: it.publishedAt, message: add.message || 'Ok.',
      hash: meta.hash || '', torrentName: meta.name || '', state: chk.state || '',
      progress: Number(chk.progress) || 0, verified: !!chk.found, client: 'qb' };
    it.pubMsg = chk.found
      ? (add.existing ? 'qB 里已有这个种子，跳过重复添加' : '已加入 qB 并校验到种子（' + (chk.state || '未知') + '）')
      : '已加入 qB，但列表里还没找到（可能延迟）';
    stage.set(it, 'injected', { evidence: { client: 'qb', hash: meta.hash || '', verified: !!chk.found, state: chk.state || '' } });
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
    return { ok: true, data: { id: it.id, dryRun: false, published: true, qb: { added: true, downloader: { id: dl.id, name: dl.name || '' }, message: add.message || 'Ok.', hash: meta.hash || '', verified: !!chk.found, state: chk.state || '' }, msg: it.pubMsg } };
  }

  /* 转载流程前置：源种先进 qB，进度到 1 才允许发布到目标站 */
  async function ensureSource(id, body) {
    const b = body || {};
    const cur = load(id);
    if (!cur) return { ok: false, code: 'NOT_FOUND', message: '条目不存在', http: 404 };
    const it = cur.data;
    const dl = downloaderOf(b, it);
    if (!dl) return { ok: false, code: 'NO_DOWNLOADER', message: '没有可用下载器，先去流程页添加 qB', http: 400 };
    if (String(dl.kind || 'qb') !== 'qb') return { ok: true, complete: true, skipped: 'non-qb' };
    if (!ctx.allowReal('realPublish')) return { ok: false, code: 'REAL_PUBLISH_DISABLED', message: '真发布还没打开', http: 409 };
    if (!it.downloadUrl) return { ok: false, code: 'NO_SOURCE_URL', message: '条目没有源种下载地址', http: 400 };
    const got = await fetchTorrent(it.downloadUrl, cookieOf(it.site));
    if (got.err) {
      it.sourceState = { at: now(), ok: false, error: got.err };
      save(it);
      return { ok: false, code: 'SOURCE_FETCH_FAILED', message: got.err };
    }
    const meta = qb.parseTorrent(got.buf);
    if (!meta.hash) {
      it.sourceState = { at: now(), ok: false, error: '源种解析不出 infohash' };
      save(it);
      return { ok: false, code: 'BAD_SOURCE_TORRENT', message: '源种解析不出 infohash' };
    }
    let found = await qb.findTorrent(dl, meta.hash, meta.name);
    if (!found.found) {
      const add = await qb.addTorrent(dl, got.buf, {
        savePath: b.savePath || it.savePath,
        category: b.category || it.category,
        paused: false,
        filename: String(it.title || 'source').slice(0, 60) + '.torrent'
      });
      if (!add.ok && !/fails|already|duplicate|exist/i.test(String(add.message || ''))) {
        it.sourceState = { at: now(), ok: false, hash: meta.hash, error: add.message || add.error };
        save(it);
        return { ok: false, code: 'SOURCE_ADD_FAILED', message: add.message || add.error || '源种加 qB 失败' };
      }
      await qb.resumeTorrent(dl, meta.hash).catch(function () {});
      found = await qb.findTorrent(dl, meta.hash, meta.name);
    } else if (/stop|pause/i.test(String(found.state || ''))) {
      await qb.resumeTorrent(dl, meta.hash).catch(function () {});
      found = await qb.findTorrent(dl, meta.hash, meta.name);
    }
    const progress = Number(found.progress) || 0;
    const complete = found.found && progress >= 0.999;
    it.sourceState = { at: now(), ok: true, hash: meta.hash, name: meta.name || '', progress: progress, state: found.state || '', savePath: found.savePath || '', complete: complete };
    save(it);
    return { ok: true, complete: complete, hash: meta.hash, progress: progress, state: found.state || '', savePath: found.savePath || '' };
  }

  function injectPlan(id, body) {
    const cur = load(id);
    if (!cur) return { ok: false, code: 'NOT_FOUND', message: '条目不存在', http: 404 };
    const dl = downloaderOf(body, cur.data);
    if (!dl) return { ok: false, code: 'NO_DOWNLOADER', message: '没有可用下载器，先去流程页添加 qB/watch', http: 400 };
    return { ok: true, data: injectPlanFor(cur.data, dl, body) };
  }

  return { publishItem, injectPlan, ensureSource };
}

module.exports = { makePublisher };
