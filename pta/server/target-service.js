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
    const want = String(host || '').toLowerCase();
    const allowed = [];
    if (item.targetSite) allowed.push(String(item.targetSite).toLowerCase());
    (Array.isArray(item.targets) ? item.targets : []).forEach(function (h) { allowed.push(String(h || '').toLowerCase()); });
    if (item.prepared && Array.isArray(item.prepared.targets)) item.prepared.targets.forEach(function (t) { if (t && t.host) allowed.push(String(t.host).toLowerCase()); });
    if (allowed.length && allowed.indexOf(want) < 0) {
      return { code: 'TARGET_MISMATCH', message: '条目目标站是 ' + allowed.join(', ') + '，跟请求的 ' + host + ' 不一致' };
    }
    return null;
  }
  function targetResults(item) {
    if (!item.targetResults || typeof item.targetResults !== 'object' || Array.isArray(item.targetResults)) item.targetResults = {};
    return item.targetResults;
  }
  function targetHosts(item) {
    const list = [];
    (Array.isArray(item.targets) ? item.targets : []).forEach(function (h) { h = String(h || '').toLowerCase(); if (h && list.indexOf(h) < 0) list.push(h); });
    if (!list.length && item.targetSite) list.push(String(item.targetSite).toLowerCase());
    return list;
  }
  function allDone(item) {
    const hosts = targetHosts(item);
    if (!hosts.length) return false;
    return hosts.every(function (h) { const r = targetResults(item)[h]; return r && (r.stage === 'submitted' || r.stage === 'injected'); });
  }
  function setTargetResult(item, host, rec) {
    const r = targetResults(item);
    r[String(host).toLowerCase()] = Object.assign({ at: now() }, rec || {});
    return r;
  }
  function preparedPlan(item, host) {
    const p = item && item.prepared;
    if (!p) return null;
    const list = Array.isArray(p.targets) ? p.targets : [];
    const hit = list.filter(function (t) { return t && String(t.host).toLowerCase() === String(host).toLowerCase(); })[0];
    if (hit) return hit.target || null;
    if (p.targetHost && String(p.targetHost).toLowerCase() === String(host).toLowerCase()) return p.target || null;
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
    const tr = targetResults(item.data)[String(host).toLowerCase()];
    if (!dryRun && tr && (tr.stage === 'submitted' || tr.stage === 'injected')) {
      return { ok: false, code: 'ALREADY_SUBMITTED', message: '这个目标站已经提交过，不能重复提交', http: 409 };
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
    const plan = preparedPlan(item.data, host);
    const r = await target.submit(host, uploadItem, t.buf, { dryRun: dryRun, plan: plan || undefined });
    if (!r.ok) {
      if (!dryRun) {
        setTargetResult(item.data, host, { stage: 'failed', error: r.message || r.code, nextRetryAt: new Date(Date.now() + 15 * 60000).toISOString() });
        if (targetHosts(item.data).length <= 1) stage.fail(item.data, item.data.stage || 'previewed', r.message || r.code);
        saveQueue(item.data);
      }
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
    const result = {
      stage: 'submitted', infohash: r.data.infohash || '',
      detailsUrl: r.data.detailsUrl || '', status: r.data.status || 0,
      verified: !!(verified && verified.found), error: ''
    };
    setTargetResult(item.data, host, result);
    const evidence = {
      host: host, infohash: result.infohash, detailsUrl: result.detailsUrl,
      verified: result.verified, targets: item.data.targetResults
    };
    if (allDone(item.data)) {
      stage.set(item.data, 'submitted', { evidence: evidence });
    } else {
      stage.ensure(item.data);
      item.data.stageEvidence = Object.assign({}, item.data.stageEvidence || {}, evidence);
    }
    saveQueue(item.data);
    return { ok: true, data: Object.assign({}, r.data, { verify: verified, targetResults: item.data.targetResults }) };
  }

  async function uploadMany(body) {
    const b = body || {};
    const item = loadQueue(b.queueId);
    if (!item) return { ok: false, code: 'NOT_FOUND', message: '队列条目不存在', http: 404 };
    let hosts = Array.isArray(b.targets) ? b.targets : (typeof b.targets === 'string' ? b.targets.split(',') : []);
    hosts = hosts.map(function (h) { return String(h || '').trim().toLowerCase() }).filter(Boolean);
    if (!hosts.length) hosts = targetHosts(item.data);
    if (!hosts.length) return { ok: false, code: 'NO_TARGET', message: '没有配置目标站', http: 400 };
    const out = [];
    for (const host of hosts) {
      const r = await upload(host, b);
      out.push({ host: host, ok: !!r.ok, code: r.code || '', message: r.message || '', data: r.data || null });
    }
    return { ok: true, data: { queueId: item.id, dryRun: b.dryRun !== false, targets: out, allOk: out.every(function (x) { return x.ok }) } };
  }

  return { upload: upload, uploadMany: uploadMany, loadQueue: loadQueue, saveQueue: saveQueue, checkHost: checkHost, flowMap: flowMap };
}

module.exports = { makeTargetService };
