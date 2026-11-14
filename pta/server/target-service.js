/* 目标站提交服务：HTTP 路由和 CLI core 共用。
   默认干跑；真提交门禁、截图门槛、阶段、幂等都在这里。 */
const stage = require('./stage');

function makeTargetService(ctx, target) {
  const { db, one, jparse } = ctx;
  const now = () => new Date().toISOString();

  function loadQueue(id) {
    const row = one('SELECT id, data FROM queue WHERE id = ?', String(id || ''));
    return row ? { id: row.id, data: jparse(row.data) || {} } : null;
  }
  function saveQueue(it) {
    db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(it), now(), it.id);
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
    ['dedupe', 'pub'].forEach(function (k) {
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

  function preparedItem(item, host) {
    const p = item && item.prepared;
    if (!p) return item;
    const out = Object.assign({}, item);
    if (p.title) out.title = p.title;
    if (p.subtitle) out.cn = p.subtitle;
    if (p.description) out.intro = p.description;
    return out;
  }

  async function upload(host, body) {
    const b = body || {};
    const item = loadQueue(b.queueId);
    if (!item) return { ok: false, code: 'NOT_FOUND', message: '队列条目不存在', http: 404 };
    const mism = checkHost(item.data, host);
    if (mism) return { ok: false, code: mism.code, message: mism.message, http: 400 };
    const dryRun = b.dryRun !== false;
    if (!dryRun && stage.isSubmitted(item.data)) {
      return { ok: false, code: 'ALREADY_SUBMITTED', message: '这个条目已经提交过，不能重复提交', http: 409 };
    }
    const flow = flowMap();
    const shotRule = flow['截图至少几张'];
    const minShots = shotRule ? Math.max(0, Number(shotRule.v) || 0) : 3;
    const shotCount = Array.isArray(item.data.shots) ? item.data.shots.length : 0;
    if (!dryRun && minShots > 0 && shotCount < minShots) {
      stage.fail(item.data, item.data.stage || 'previewed', '截图不足：至少 ' + minShots + ' 张');
      saveQueue(item.data);
      return { ok: false, code: 'SHOTS_REQUIRED', message: '截图不足：至少 ' + minShots + ' 张，当前 ' + shotCount + ' 张', http: 400 };
    }
    const t = await torrentFor(b, item.data);
    if (t.err) {
      if (!dryRun) { stage.fail(item.data, item.data.stage || 'previewed', t.err); saveQueue(item.data); }
      return { ok: false, code: 'TORRENT_UNAVAILABLE', message: t.err, http: 400 };
    }
    const uploadItem = preparedItem(item.data, host);
    const preparedPlan = item.data.prepared && item.data.prepared.targetHost === host ? item.data.prepared.target : null;
    const r = await target.submit(host, uploadItem, t.buf, { dryRun: dryRun, plan: preparedPlan || undefined });
    if (!r.ok) {
      if (!dryRun) { stage.fail(item.data, item.data.stage || 'previewed', r.message || r.code); saveQueue(item.data); }
      return r;
    }
    if (dryRun) return r;
    item.data.targetUpload = {
      host: host, at: now(), url: r.data.url, detailsUrl: r.data.detailsUrl || '',
      infohash: r.data.infohash || '', status: r.data.status || 0, message: r.data.message || ''
    };
    let verified = null;
    const verifyRule = flow['发布后校验'];
    const shouldVerify = b.verify !== undefined ? !!b.verify : (verifyRule ? verifyRule.on !== false : true);
    if (shouldVerify) {
      const v = await target.verify(host, uploadItem, t.buf, { url: r.data.detailsUrl || undefined });
      if (v.ok) {
        verified = v.data;
        item.data.targetVerify = Object.assign({}, v.data, { at: now() });
      }
    }
    stage.set(item.data, 'submitted', { evidence: {
      host: host, infohash: r.data.infohash || '',
      detailsUrl: r.data.detailsUrl || '', status: r.data.status || 0,
      verified: !!(verified && verified.found)
    } });
    saveQueue(item.data);
    return { ok: true, data: Object.assign({}, r.data, { verify: verified }) };
  }

  return { upload: upload, loadQueue: loadQueue, saveQueue: saveQueue, checkHost: checkHost, flowMap: flowMap };
}

module.exports = { makeTargetService };
