/* 目标站提交服务：HTTP 路由和 CLI core 共用。
   默认干跑；真提交门禁、截图门槛、阶段、幂等都在这里。 */
const fs = require('fs');
const path = require('path');
const stage = require('./stage');
const torrentClean = require('./torrent-clean');
const flowConfig = require('./flow-config');

function makeTargetService(ctx, target) {
  const { db, one, jparse, DATA_DIR } = ctx;
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

  function preparedItem(item, host) {
    const p = item && item.prepared;
    if (!p) return item;
    const out = Object.assign({}, item);
    if (p.title) out.title = p.title;
    if (p.subtitle) out.cn = p.subtitle;
    if (p.description) out.intro = p.description;
    return out;
  }

  /* 源资源标题：优先用已缓存源种，没有再取一次；成功才覆盖 title */
  async function fillSourceTitle(itemData) {
    if (!itemData) return { ok: false, error: 'NO_ITEM' };
    if (itemData.sourceTitleAt) return { ok: true, title: itemData.title, cached: true };
    if (itemData.sourceTitleErrorAt && Date.now() - Date.parse(itemData.sourceTitleErrorAt) < 3600000) {
      return { ok: false, error: 'RETRY_LATER' };
    }
    let name = '';
    try {
      const trs = itemData.targetResults || {};
      for (const h of Object.keys(trs)) {
        const src = trs[h] && trs[h].sourceTorrent && trs[h].sourceTorrent.path;
        if (src && fs.existsSync(src)) {
          const meta = target.torrentMeta(fs.readFileSync(src));
          name = (meta && meta.name) || '';
          if (name) break;
        }
      }
      if (!name && itemData.downloadUrl) {
        const f = await target.fetchSourceTorrent(itemData);
        if (f.buf) { const meta = target.torrentMeta(f.buf); name = (meta && meta.name) || ''; }
      }
    } catch (e) { name = ''; }
    if (!name) {
      itemData.sourceTitleErrorAt = now();
      return { ok: false, error: 'NO_SOURCE_TITLE' };
    }
    itemData.title = String(name).slice(0, 300);
    itemData.sourceTitle = itemData.title;
    itemData.sourceTitleAt = now();
    delete itemData.sourceTitleErrorAt;
    return { ok: true, title: itemData.title };
  }

  /* 独立查重：初筛后先跑一次，命中就跳过，避免补齐/详情请求。 */
  async function checkDupe(host, itemData, buf) {
    const flowCfg = flowConfig.read(ctx);
    let pre = null;
    try { pre = await target.verify(host, preparedItem(itemData, host), buf || null, buf ? {} : { hash: String(itemData.infohash || '') }); } catch (e) { pre = null; }
    if (!pre || !pre.ok || !pre.data || !pre.data.found) return { found: false };
    let foundTitle = String(pre.data.title || '');
    if (pre.data.detailsUrl) {
      try {
        const di = await target.fetchDetailsInfo(host, pre.data.detailsUrl);
        if (di.ok) foundTitle += ' ' + [di.data.subtitle, di.data.descr, di.data.tags, di.data.medium].filter(Boolean).join(' ');
      } catch (e) { /* 详情读不到就只用标题判定 */ }
    }
    foundTitle = foundTitle.slice(0, 4000);
    const isDiy = /diy|diy原盘|自译|自制字幕|修改菜单/i.test(foundTitle);
    const isRemux = /remux/i.test(foundTitle);
    const fullWords = String(flowConfig.value(flowCfg, '原盘判定关键词', '原盘|Full Disc|BDMV|ISO'))
      .split('|').map(function (x) { return String(x || '').trim(); }).filter(Boolean);
    const fullRe = new RegExp(fullWords.map(function (x) { return x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|'), 'i');
    const isFullDisc = fullRe.test(foundTitle) && !isRemux && !isDiy;
    const restricted = /禁转|限转/.test(foundTitle);
    const ruleRestrict = String(flowConfig.value(flowCfg, '禁转/限转处理', '跳过发布'));
    const ruleDiy = String(flowConfig.value(flowCfg, '目标站只有 DIY', '可发（标复核）'));
    const ruleFull = String(flowConfig.value(flowCfg, '目标站已有原盘', '跳过不收'));
    let skip = isDiy ? ruleDiy === '跳过' : (isFullDisc ? ruleFull === '跳过不收' : true);
    if (restricted && ruleRestrict === '跳过发布') skip = true;
    if (restricted && ruleRestrict === '标复核后仍发') skip = false;
    return { found: true, skip: skip, kind: isDiy ? 'diy' : (isFullDisc ? 'full_disc' : (isRemux ? 'remux' : 'other')), title: foundTitle.slice(0, 200), verify: pre.data, restricted: restricted };
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
    const minShots = shotRule ? Math.max(0, Number(shotRule.v) || 0) : 0;
    const shotCount = Array.isArray(item.data.shots) ? item.data.shots.length : 0;
    if (!dryRun && minShots > 0 && shotCount < minShots) {
      stage.fail(item.data, item.data.stage || 'previewed', '截图不足：至少 ' + minShots + ' 张');
      saveQueue(item.data);
      return { ok: false, code: 'SHOTS_REQUIRED', message: '截图不足：至少 ' + minShots + ' 张，当前 ' + shotCount + ' 张', http: 400 };
    }
    const bdRule = flow['BDInfo'];
    const bdMode = bdRule && bdRule.v ? String(bdRule.v) : '不要求';
    if (!dryRun && bdMode !== '不要求') {
      const pm = item.data.prepared && item.data.prepared.media;
      const bdOk = !!(pm && pm.kind && (bdMode !== '必须存在且校验通过' || pm.summary));
      if (!bdOk) {
        stage.fail(item.data, item.data.stage || 'previewed', 'BDInfo 门槛未过：' + bdMode);
        saveQueue(item.data);
        return { ok: false, code: 'BDINFO_REQUIRED', message: 'BDInfo 门槛未过：' + bdMode, http: 400 };
      }
    }
    const t = await torrentFor(b, item.data);
    if (t.err) {
      if (!dryRun) { stage.fail(item.data, item.data.stage || 'previewed', t.err); saveQueue(item.data); }
      return { ok: false, code: 'TORRENT_UNAVAILABLE', message: t.err, http: 400 };
    }
    let sourceTorrent = null;
    let sourceTorrentError = '';
    if (!dryRun) {
      const srcMeta = target.torrentMeta(t.buf);
      if (srcMeta && srcMeta.hash) {
        try {
          const dir = path.join(DATA_DIR, 'torrents');
          fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
          const file = path.join(dir, 'source-' + srcMeta.hash + '.torrent');
          if (!fs.existsSync(file)) fs.writeFileSync(file, t.buf, { mode: 0o600 });
          sourceTorrent = { infohash: srcMeta.hash, size: t.buf.length, path: file };
        } catch (e) { sourceTorrentError = '源种保存失败'; }
      } else sourceTorrentError = '源种解析不出 infohash';
    }
    const flowCfg = flowConfig.read(ctx);
    const wantClean = b.clean !== undefined ? !!b.clean : flowConfig.on(flowCfg, '上传前清洗 tracker', true);
    let cleaned = false;
    let cleanAnnounce = String(b.cleanAnnounce || '').trim();
    if (!cleanAnnounce) {
      const cand = await target.announceCandidates(host);
      if (cand.ok) {
        const list = cand.data.candidates || [];
        const pick = list.filter(function (x) { return x.kind === 'generic'; })[0] || null;
        if (pick) cleanAnnounce = pick.announce;
      }
    }
    if (!cleanAnnounce) {
      const tgt = target.resolve(host);
      if (tgt && tgt.base) cleanAnnounce = String(tgt.base).replace(/\/+$/, '') + '/announce.php';
    }
    if (wantClean) {
      if (!cleanAnnounce) {
        return { ok: false, code: 'NEED_TARGET_ANNOUNCE', message: '没找到目标站通用 announce；源种不会直传，请用 --announce 指定后再提交', http: 409 };
      }
      try { t.buf = torrentClean.replaceAnnounce(t.buf, cleanAnnounce); cleaned = true; }
      catch (e) { return { ok: false, code: 'CLEAN_FAILED', message: '种子清洗失败：' + String(e && e.message || e).slice(0, 120), http: 400 }; }
    }
    const uploadItem = preparedItem(item.data, host);
    const plan = preparedPlan(item.data, host);
    const dres = item.data.dupeResults && item.data.dupeResults[host];
    if (dres && dres.skip) {
      const msg = '目标站已有这条资源，跳过';
      setTargetResult(item.data, host, { stage: 'skipped', error: msg, verify: null });
      if (targetHosts(item.data).length <= 1) stage.set(item.data, 'submitted', { evidence: { host: host, skipped: 'target_exists' } });
      saveQueue(item.data);
      return { ok: false, skipped: true, code: 'TARGET_EXISTS', message: msg, http: 200, data: { host: host } };
    }
    if (!dryRun && b.preCheckDupe !== false && !(item.data.dupePassedAt && dres)) {
      const chk = await checkDupe(host, item.data, t.buf);
      if (chk.found && chk.skip) {
        const msg = '目标站已有这条资源，跳过';
        setTargetResult(item.data, host, { stage: 'skipped', error: msg, verify: chk.verify });
        if (targetHosts(item.data).length <= 1) stage.set(item.data, 'submitted', { evidence: { host: host, skipped: 'target_exists' } });
        saveQueue(item.data);
        return { ok: false, skipped: true, code: 'TARGET_EXISTS', message: msg, http: 200, data: { host: host, verify: chk.verify } };
      }
      if (chk.found) item.data.dupeReview = { host: host, kind: chk.kind, title: chk.title, at: now() };
      item.data.dupePassedAt = now();
    }
    const r = await target.submit(host, uploadItem, t.buf, { dryRun: dryRun, plan: plan || undefined });
    if (!r.ok) {
      if (!dryRun) {
        setTargetResult(item.data, host, { stage: 'failed', error: r.message || r.code, nextRetryAt: new Date(Date.now() + 15 * 60000).toISOString() });
        if (targetHosts(item.data).length <= 1) stage.fail(item.data, item.data.stage || 'previewed', r.message || r.code);
        saveQueue(item.data);
      }
      return r;
    }
    if (r.data) r.data.cleaned = cleaned;
    if (dryRun) return r;
    if (r.data && r.data.uncertain) {
      const msg = '提交返回 200，但没拿到详情页/成功提示：' + String(r.data.responseHint || '').slice(0, 180);
      setTargetResult(item.data, host, { stage: 'failed', error: msg, nextRetryAt: new Date(Date.now() + 15 * 60000).toISOString() });
      if (targetHosts(item.data).length <= 1) stage.fail(item.data, item.data.stage || 'previewed', msg);
      saveQueue(item.data);
      return { ok: false, code: 'UPLOAD_UNCONFIRMED', message: msg, http: 502, data: r.data };
    }
    item.data.targetUpload = {
      host: host, at: now(), url: r.data.url, detailsUrl: r.data.detailsUrl || '',
      infohash: r.data.infohash || '', status: r.data.status || 0, message: r.data.message || '',
      cleaned: cleaned
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
    if (shouldVerify && (!verified || !verified.found)) {
      const msg = '提交返回 200，但回查未找到（可能待审核/索引延迟）';
      const failed = { stage: 'failed', error: msg, nextRetryAt: new Date(Date.now() + 15 * 60000).toISOString(), verify: verified || null };
      setTargetResult(item.data, host, failed);
      if (targetHosts(item.data).length <= 1) stage.fail(item.data, item.data.stage || 'previewed', msg);
      saveQueue(item.data);
      return { ok: false, code: 'VERIFY_FAILED', message: msg, http: 502, data: { host: host, verify: verified || null } };
    }
    let publishedTorrent = null;
    let publishedTorrentError = '';
    const wantPublished = b.fetchPublishedTorrent !== undefined ? b.fetchPublishedTorrent !== false : flowConfig.on(flowCfg, '发布后抓权威种子', true);
    if (wantPublished && verified && verified.found) {
      const detailsUrl = (r.data && r.data.detailsUrl) || (verified && verified.url) || '';
      if (detailsUrl) {
        const tt = await target.fetchDetailsTorrent(host, detailsUrl);
        if (tt.ok) {
          try {
            const dir = path.join(DATA_DIR, 'torrents');
            fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
            const safeHost = String(host).replace(/[^a-z0-9.-]/gi, '_');
            const file = path.join(dir, safeHost + '-' + tt.data.meta.hash + '.published.torrent');
            fs.writeFileSync(file, tt.data.buf, { mode: 0o600 });
            publishedTorrent = {
              host: host, infohash: tt.data.meta.hash, size: tt.data.buf.length, path: file,
              sameInfohash: tt.data.meta.hash === (r.data.infohash || ''), source: 'published'
            };
          } catch (e) { publishedTorrentError = '目标站发布种子保存失败'; }
        } else publishedTorrentError = tt.message || tt.code || '目标站发布种子抓取失败';
      }
    }
    const result = {
      stage: 'submitted', infohash: r.data.infohash || '',
      detailsUrl: r.data.detailsUrl || '', status: r.data.status || 0,
      verified: !!(verified && verified.found), sourceTorrent: sourceTorrent,
      sourceTorrentError: sourceTorrentError, targetTorrent: publishedTorrent,
      targetTorrentError: publishedTorrentError, publishedTorrent: publishedTorrent,
      publishedTorrentError: publishedTorrentError, cleaned: cleaned, error: ''
    };
    setTargetResult(item.data, host, result);
    item.data.targetUpload.sourceTorrent = sourceTorrent ? { infohash: sourceTorrent.infohash, size: sourceTorrent.size } : null;
    item.data.targetUpload.targetTorrent = publishedTorrent ? {
      infohash: publishedTorrent.infohash, size: publishedTorrent.size, sameInfohash: publishedTorrent.sameInfohash
    } : null;
    const evidence = {
      host: host, infohash: result.infohash, detailsUrl: result.detailsUrl,
      verified: result.verified, sourceTorrent: result.sourceTorrent,
      targetTorrent: result.targetTorrent, publishedTorrent: result.publishedTorrent,
      cleaned: cleaned, targets: item.data.targetResults
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
    const perTarget = {};
    const raw = b.targetTorrents;
    if (Array.isArray(raw)) {
      raw.forEach(function (x) { if (x && x.host) perTarget[String(x.host).toLowerCase()] = x.torrentBase64 || x.torrent || ''; });
    } else if (raw && typeof raw === 'object') {
      Object.keys(raw).forEach(function (h) { perTarget[String(h).toLowerCase()] = raw[h]; });
    }
    const perAnnounce = {};
    const rawAnn = b.targetAnnounces;
    if (Array.isArray(rawAnn)) {
      rawAnn.forEach(function (x) { if (x && x.host) perAnnounce[String(x.host).toLowerCase()] = x.announce || x.url || ''; });
    } else if (rawAnn && typeof rawAnn === 'object') {
      Object.keys(rawAnn).forEach(function (h) { perAnnounce[String(h).toLowerCase()] = rawAnn[h]; });
    }
    const out = [];
    for (const host of hosts) {
      const one = Object.assign({}, b);
      if (perTarget[host]) one.torrentBase64 = perTarget[host];
      if (perAnnounce[host]) one.cleanAnnounce = perAnnounce[host];
      else if (hosts.length > 1) one.cleanAnnounce = '';
      const r = await upload(host, one);
      out.push({ host: host, ok: !!r.ok, skipped: !!r.skipped, code: r.code || '', message: r.message || '', data: r.data || null });
    }
    return { ok: true, data: { queueId: item.id, dryRun: b.dryRun !== false, targets: out, allOk: out.every(function (x) { return x.ok || x.skipped; }) } };
  }

  async function probe(body) {
    const b = body || {};
    const hosts = Array.isArray(b.hosts) ? b.hosts.map(function (h) { return String(h || '').trim().toLowerCase() }).filter(Boolean) : [];
    const limit = Math.max(1, Math.min(50, Number(b.limit) || 20));
    const delay = Math.max(0, Math.min(10000, b.delay === undefined ? 1200 : Number(b.delay) || 0));
    const sample = { title: 'Probe Test 2026 1080p', cat: 'movie', res: '1080p', size: '20 GB', source: 'Blu-ray', codec: 'AVC', audio: '国语', team: 'Probe', anonymous: true };
    const list = target.list().filter(function (t) {
      if (hosts.length && hosts.indexOf(t.host) < 0) return false;
      return b.all ? true : t.hasCookie;
    }).slice(0, limit);
    const out = { total: list.length, checked: 0, ok: 0, missing: 0, failed: 0, noCookie: 0, sites: [] };
    for (const t of list) {
      if (!t.hasCookie) {
        out.noCookie++;
        out.sites.push({ host: t.host, engine: t.engine, status: 'no_cookie', ready: false });
        continue;
      }
      const d = await target.detectUploadForm(t.host);
      if (!d.ok) {
        out.failed++;
        out.sites.push({ host: t.host, engine: t.engine, status: 'error', code: d.code || 'DETECT_FAILED', message: d.message || '' });
      } else {
        const plan = target.plan(t.host, sample);
        const formNames = new Set((d.data.fields || []).map(function (f) { return f.name; }));
        const planFields = plan.ok ? Object.keys(plan.data.fields || {}) : [];
        const criticalNames = ['name', 'small_descr', 'descr', 'type', 'type_id', 'category', 'category_id'].filter(function (n) { return planFields.indexOf(n) >= 0; });
        const missingCritical = criticalNames.filter(function (n) { return !formNames.has(n); });
        const extraPlanFields = planFields.filter(function (n) { return !formNames.has(n); });
        const hasFileField = !!d.data.fileField;
        const status = !plan.ok ? 'plan_failed' : (!hasFileField ? 'no_file_field' : (missingCritical.length ? 'missing_fields' : 'ok'));
        if (status === 'ok') out.ok++; else out.missing++;
        const cats = (d.data.fields || []).filter(function (f) {
          return /^(type|type_id|category|category_id|cat)$/i.test(f.name) || /categor/i.test(f.name);
        }).map(function (f) {
          return { name: f.name, label: f.label || '', options: (f.options || []).slice(0, 40) };
        });
        out.sites.push({
          host: t.host, engine: t.engine, status: status, ready: !!t.ready,
          formPath: d.data.formPath || '', fileField: d.data.fileField || '',
          fileFieldCurrent: plan.ok ? (plan.data.fileField || '') : '',
          fileFieldMismatch: !!(plan.ok && d.data.fileField && plan.data.fileField && d.data.fileField !== plan.data.fileField),
          hasFileField: hasFileField, formCount: d.data.formCount || 0,
          fieldCount: (d.data.fields || []).length,
          fields: (d.data.fields || []).slice(0, 60).map(function (f) {
            return { name: f.name, type: f.type || '', label: f.label || '', template: f.template || '', options: (f.options || []).length };
          }),
          planFields: planFields, missing: missingCritical, missingCritical: missingCritical,
          extraPlanFields: extraPlanFields, categories: cats,
          catMapCount: (target.resolve(t.host) && target.resolve(t.host).catMap || []).length,
          warnings: plan.ok ? (plan.data.warnings || []) : []
        });
        out.checked++;
      }
      if (delay && out.sites.length < list.length) await new Promise(function (r) { setTimeout(r, delay); });
    }
    return { ok: true, data: out };
  }

  return { upload: upload, uploadMany: uploadMany, checkDupe: checkDupe, fillSourceTitle: fillSourceTitle, probe: probe, loadQueue: loadQueue, saveQueue: saveQueue, checkHost: checkHost, flowMap: flowMap };
}

module.exports = { makeTargetService };
