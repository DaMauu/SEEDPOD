/* 发布核心：dry-run、真发布（取种 + qB add + 回查）、状态落账。
   路由与调度器共用，避免两份实现。 */
const secretbox = require('./secretbox');
const { makeQb } = require('./qb');
const watch = require('./clients/watch');
const rtorrent = require('./clients/rtorrent');
const deluge = require('./clients/deluge');

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
    if (!it.title) return { ok: false, code: 'BAD_ITEM', message: '条目没有标题，发不了', http: 400 };
    if (!it.targetSite) return { ok: false, code: 'NO_TARGET', message: '还没选目标站', http: 400 };
    const dl = downloaderOf(b, it);
    if (!dl) return { ok: false, code: 'NO_DOWNLOADER', message: '没有可用下载器，先去流程页添加 qB', http: 400 };

    if (dryRun) {
      it.pubMsg = '演练：目标站 ' + it.targetSite + '，下载器 ' + (dl.name || dl.id) + '，' + (it.shots || []).length + ' 张图，没有发出真实请求';
      return { ok: true, data: { id: it.id, dryRun: true, published: false, qb: { wouldAdd: true, downloader: { id: dl.id, name: dl.name || '' } }, msg: it.pubMsg } };
    }
    if (!ctx.allowReal('realPublish')) {
      return { ok: false, code: 'REAL_PUBLISH_DISABLED', message: '真发布还没打开：把配置 realPublish 设为 true（或设 PTA_ALLOW_REAL=1）再试', http: 409 };
    }
    if (it.status !== 'pending' && it.status !== 'approved' && it.status !== 'failed') {
      return { ok: false, code: 'BAD_STATE', message: '当前状态 ' + it.status + ' 不能发布', http: 400 };
    }

    const got = await fetchTorrent(it.downloadUrl, cookieOf(it.site));
    if (got.err) return { ok: false, code: 'TORRENT_FETCH_FAILED', message: got.err, http: 502 };
    const meta = qb.parseTorrent(got.buf);
    if ((dl.kind || 'qb') === 'watch') {
      const w = watch.addTorrent({ dir: dl.watchPath, buf: got.buf, filename: String(it.title || 'upload').slice(0, 60) + '.torrent' });
      if (!w.ok) {
        it.status = 'failed';
        it.pubMsg = 'watch 写入失败：' + w.message;
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
    const clientKind = dl.kind || 'qb';
    if (clientKind === 'rtorrent' || clientKind === 'deluge') {
      const mod = clientKind === 'rtorrent' ? rtorrent : deluge;
      const cadd = await mod.addTorrent(dl, got.buf, {
        filename: String(it.title || 'upload').slice(0, 60) + '.torrent',
        savePath: b.savePath || it.savePath
      });
      if (!cadd.ok) {
        it.status = 'failed';
        it.pubMsg = clientKind + ' 添加失败：' + (cadd.message || 'unknown');
        save(it);
        return { ok: false, code: clientKind.toUpperCase() + '_ADD_FAILED', message: it.pubMsg, http: 502 };
      }
      const cchk = await mod.findTorrent(dl, meta.hash);
      it.status = 'published';
      it.publishedAt = now();
      it.approvedAt = it.approvedAt || now();
      it.qb = { id: dl.id, name: dl.name || '', at: it.publishedAt, message: cadd.message || 'Ok.',
        hash: meta.hash || '', torrentName: meta.name || '', state: cchk.state || '',
        progress: Number(cchk.progress) || 0, verified: !!cchk.found, client: clientKind };
      it.pubMsg = '已通过 ' + clientKind + ' 添加' + (cchk.found ? '并校验到种子' : '，回查暂未找到');
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
        qb: { added: true, client: clientKind, message: cadd.message || 'Ok.', hash: meta.hash || '', verified: !!cchk.found, state: cchk.state || '' },
        msg: it.pubMsg } };
    }

    const add = await qb.addTorrent(dl, got.buf, {
      savePath: b.savePath || it.savePath,
      category: b.category || it.category,
      filename: String(it.title || 'upload').slice(0, 60) + '.torrent'
    });
    if (!add.ok) {
      it.status = 'failed';
      it.pubMsg = 'qB 添加失败：' + (add.message || add.error);
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
      ? '已加入 qB 并校验到种子（' + (chk.state || '未知') + '）'
      : '已加入 qB，但列表里还没找到（可能延迟）';
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

  return { publishItem };
}

module.exports = { makePublisher };
