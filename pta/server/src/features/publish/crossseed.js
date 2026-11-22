/* 辅种：把目标站权威种子加进 qB，skip_checking + 复用源种 save path。
   调度和 CLI 共用；不硬链接、不改文件结构。 */
const fs = require('fs');
const { makeQb } = require('../../../qb');
const flowConfig = require('../settings/flow-config');

function makeCrossseed(ctx) {
  const { one, all, jparse } = ctx;
  const qb = ctx.qb || makeQb(ctx.DATA_DIR);
  const now = () => new Date().toISOString();
  /* 自己落库，不依赖 ctx.targetService（调度里没挂这个对象） */
  function saveQueue(data) {
    try {
      ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(data), now(), data.id);
    } catch (e) { console.warn('[seedpod] crossseed save failed:', e && e.message ? e.message : e); }
  }

  async function run(item, host, opts) {
    const o = opts || {};
    const h = String(host || '').toLowerCase();
    if (!item || !item.data) return { ok: false, error: 'NO_ITEM' };
    if (!h) return { ok: false, error: 'NO_HOST' };
    const results = item.data.targetResults || {};
    const tr = results[h] || {};
    /* 失败也记一笔，调度会按 retryAt 重试；成功后清掉错误 */
    function markFail(code, extra) {
      const prev = tr.crossseed || {};
      tr.crossseed = Object.assign({}, extra || {}, {
        at: now(), ok: false, error: code,
        attempts: (Number(prev.attempts) || 0) + 1,
        retryAt: new Date(Date.now() + 15 * 60000).toISOString()
      });
      results[h] = tr;
      item.data.targetResults = results;
      saveQueue(item.data);
      return { ok: false, error: code };
    }
    const pub = tr.publishedTorrent || tr.targetTorrent;
    if (!pub || !pub.path || !fs.existsSync(pub.path)) return markFail('NO_PUBLISHED_TORRENT');
    const sourceHash = (tr.sourceTorrent && tr.sourceTorrent.infohash) || item.data.infohash || '';
    if (!sourceHash) return markFail('NO_SOURCE_HASH');
    const rows = all('SELECT data FROM downloaders').map(function (r) { return jparse(r.data); }).filter(function (x) { return x && (x.kind || 'qb') === 'qb'; });
    const dl = rows.filter(function (x) { return !o.downloader || String(x.id) === String(o.downloader); })[0];
    if (!dl) return markFail('NO_QB');
    const found = await qb.findTorrent(dl, sourceHash);
    if (!found.found) return markFail('SOURCE_NOT_IN_QB');
    if (Number(found.progress) < 0.999) return markFail('SOURCE_INCOMPLETE', { progress: Number(found.progress) || 0 });
    const buf = fs.readFileSync(pub.path);
    const meta = qb.parseTorrent(buf);
    if (!meta.hash) return markFail('BAD_TARGET_TORRENT');
    if (meta.hash === sourceHash) {
      /* 同 infohash 说明不用辅种，记成功并停止重试 */
      tr.crossseed = { at: now(), ok: true, skipped: 'same_infohash', targetHash: meta.hash, attempts: (Number((tr.crossseed && tr.crossseed.attempts) || 0) + 1) };
      results[h] = tr;
      item.data.targetResults = results;
      saveQueue(item.data);
      return { ok: true, skipped: 'same_infohash' };
    }
    const skip = flowConfig.on(flowConfig.read(ctx), '辅种跳过校验', true);
    let add = await qb.addTorrent(dl, buf, { savePath: found.savePath || '', skipChecking: skip, paused: false, category: found.category || '' });
    if (!add.ok && /fails|already|duplicate|exist/i.test(String(add.message || ''))) {
      const ex = await qb.findTorrent(dl, meta.hash);
      if (ex.found) add = { ok: true, existing: true, message: '辅种种已在 qB 里' };
    }
    /* 加种失败也要落 retryAt/attempts，否则调度每轮都会立刻重试 */
    if (!add.ok) return markFail(add.error || 'QB_ADD_FAILED', { message: String(add.message || '').slice(0, 200) });
    /* qB 可能因为队列上限把新种停在 stopped 状态，这里显式续上再校验 */
    try { await qb.resumeTorrent(dl, meta.hash); } catch (e) { /* 续不上交给后面的校验报错 */ }
    /* 加完校验：进度 1 + 至少一个 tracker working */
    let verified = false, state = '', trackerOk = false;
    for (let i = 0; i < 3; i++) {
      await new Promise(function (r) { setTimeout(r, 5000); });
      const t = await qb.findTorrent(dl, meta.hash);
      const st = await qb.trackerStatus(dl, meta.hash);
      state = t.state || '';
      trackerOk = (st.trackers || []).some(function (x) { return x.working; });
      if (t.found && Number(t.progress) >= 0.999 && trackerOk) { verified = true; break; }
    }
    tr.crossseed = { at: now(), targetHash: meta.hash, savePath: found.savePath || '', ok: verified, state: state, trackerWorking: trackerOk,
      attempts: (Number((tr.crossseed && tr.crossseed.attempts) || 0) + 1),
      error: verified ? '' : 'NOT_VERIFIED',
      retryAt: verified ? '' : new Date(Date.now() + 15 * 60000).toISOString() };
    if (!verified) {
      results[h] = tr;
      item.data.targetResults = results;
      saveQueue(item.data);
      return { ok: false, error: 'NOT_VERIFIED', state: state, trackerWorking: trackerOk, targetHash: meta.hash };
    }
    results[h] = tr;
    item.data.targetResults = results;
    saveQueue(item.data);
    return { ok: true, targetHash: meta.hash, savePath: found.savePath || '' };
  }
  return { run };
}

module.exports = { makeCrossseed };
