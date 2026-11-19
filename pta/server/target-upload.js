/* 单目标站上传编排：门禁、截图/BDInfo、图床、禁转、提交与回查。 */
const fs = require('fs');
const path = require('path');
const stage = require('./stage');
const torrentClean = require('./torrent-clean');
const flowConfig = require('./flow-config');
const imagehost = require('./imagehost');
const marks = require('./marks');
const { dedupeSwitchOn } = require('./target-rules');

function makeUpload(deps) {
  const ctx = deps.ctx;
  const target = deps.target;
  const DATA_DIR = deps.DATA_DIR;
  const now = deps.now;
  const loadQueue = deps.loadQueue;
  const saveQueue = deps.saveQueue;
  const checkHost = deps.checkHost;
  const checkDupe = deps.checkDupe;
  const flowMap = deps.flowMap;
  const preparedItem = deps.preparedItem;
  const targetResults = deps.targetResults;
  const torrentFor = deps.torrentFor;
  const targetHosts = deps.targetHosts;
  const setTargetResult = deps.setTargetResult;
  const preparedPlan = deps.preparedPlan;
  const allDone = deps.allDone;

async function upload(host, body) {
    const b = body || {};
    const item = loadQueue(b.queueId);
    if (!item) return { ok: false, code: 'NOT_FOUND', message: '队列条目不存在', http: 404 };
    const mism = checkHost(item.data, host);
    if (mism) return { ok: false, code: mism.code, message: mism.message, http: 400 };
    const dryRun = b.dryRun !== false;
    if (!dryRun) {
      const title = String(item.data.title || '');
      if (/(^|[\s._-])(sample|test|probe|fixture)([\s._-]|$)/i.test(title)) {
        return { ok: false, code: 'TEST_ITEM_BLOCKED', message: '标题像测试种子，禁止真实提交', http: 403 };
      }
      const testHost = /^(test[.-]|127\.0\.0\.1$|localhost$)/i.test(host);
      const cfgRow = ctx.one("SELECT v FROM meta WHERE k = 'config'");
      const cfg = JSON.parse(cfgRow ? cfgRow.v : 'null') || {};
      if (!testHost && cfg.testOnly !== false) {
        return { ok: false, code: 'TEST_ONLY', message: '当前只允许提交到测试站', http: 403 };
      }
      const confirmed = Array.isArray(b.confirmHosts) && b.confirmHosts.indexOf(host) >= 0;
      if (!testHost && cfg.allowMainTarget !== true && !confirmed) {
        return { ok: false, code: 'MAIN_TARGET_LOCKED', message: '这是主站，需要单独输入域名确认', http: 403 };
      }
    }
    if (!dryRun && ctx.logEvent) ctx.logEvent('warn', '目标站', '真实提交开始 · ' + host + ' · queue ' + item.id);
    const tr = targetResults(item.data)[String(host).toLowerCase()];
    if (!dryRun && tr && (tr.stage === 'submitted' || tr.stage === 'injected')) {
      return { ok: false, code: 'ALREADY_SUBMITTED', message: '这个目标站已经提交过，不能重复提交', http: 409 };
    }
    const flow = flowMap();
    const shotOn = flowConfig.onLegacy(flow, '截图至少几张', true, function (v) { return Number(v) > 0; });
    if (!dryRun && shotOn) {
      const srcImgs = Array.isArray(item.data.sourceImages) ? item.data.sourceImages : [];
      const text = String(item.data.descrBb || item.data.intro || '');
      const lost = srcImgs.filter(function (u) { return text.indexOf(u) < 0; });
      if (lost.length) {
        const msg = '源简介截图没全部保留：缺 ' + lost.length + ' 张';
        stage.fail(item.data, item.data.stage || 'previewed', msg);
        saveQueue(item.data);
        return { ok: false, code: 'SHOTS_REQUIRED', message: msg, http: 400 };
      }
    }
    if (!dryRun && flowConfig.onLegacy(flow, 'BDInfo', true, function (v) { return String(v) === '不要求' ? false : true; })) {
      const pm = item.data.prepared && item.data.prepared.media;
      if (!(pm && pm.kind)) {
        stage.fail(item.data, item.data.stage || 'previewed', 'BDInfo 不齐：没有识别到 BDInfo/MediaInfo');
        saveQueue(item.data);
        return { ok: false, code: 'BDINFO_REQUIRED', message: 'BDInfo 不齐：没有识别到 BDInfo/MediaInfo', http: 400 };
      }
    }
    /* 源站 BBCode 里的远程图片：按规则转存图床，失败保留外链不阻断发布 */
    let mirrorChanged = false;
    if (!dryRun && String(item.data.descrBb || '').trim() && flowConfig.on(flowConfig.read(ctx), '简介图片', true)) {
      {
        const known = (item.data.imageMirror && item.data.imageMirror.map) || {};
        const provider = String(item.data.imageHost && item.data.imageHost !== '站内' ? item.data.imageHost : require('./imagehost').defaultProvider());
        const allowReal = typeof ctx.allowReal === 'function' ? ctx.allowReal('realImages') : false;
        let mr = null;
        try {
          mr = await imagehost.mirrorDescription(item.data.descrBb, {
            provider: provider, mode: '转存到图床', dryRun: false, allowReal: allowReal,
            retries: 1, known: known,
            referer: item.data.site ? 'https://' + item.data.site + '/' : ''
          });
        } catch (e) { mr = { ok: false, code: 'IMAGE_MIRROR_FAILED', message: String(e && e.message || e).slice(0, 120) }; }
        if (mr) {
          item.data.imageMirror = Object.assign({}, mr, { at: now(), map: Object.assign({}, known, mr.map || {}) });
          delete item.data.imageMirror.description;
          if (mr.description && mr.description !== item.data.descrBb) { item.data.descrBb = mr.description; mirrorChanged = true; }
          if (mr.uploaded > 0) item.data.descrMirroredAt = now();
          saveQueue(item.data);
        }
      }
    }
    /* 禁转/限转开关打开时，发布阶段再拦一次，防止手工条目绕过初筛/终审 */
    if (!dryRun && dedupeSwitchOn(flow, '禁转/限转处理', true)) {
      const reason = marks.complianceReason(item.data, Date.now());
      if (reason) {
        stage.fail(item.data, item.data.stage || 'previewed', '源种' + reason + '，按规则不发布');
        saveQueue(item.data);
        return { ok: false, code: 'RESTRICTED_SOURCE', message: '源种' + reason + '，按规则不发布', http: 409 };
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
    let plan = preparedPlan(item.data, host);
    const liveDesc = String(item.data.descrBb || '');
    const staleDesc = !!(liveDesc && plan && plan.fields && String(plan.fields.descr || '') !== liveDesc.slice(0, 60000));
    if (mirrorChanged || staleDesc) {
      const fresh = target.plan(host, item.data);
      if (!fresh.ok) {
        return { ok: false, code: fresh.code || 'PLAN_FAILED', message: fresh.message || '图片转存后重建上传计划失败', http: fresh.http || 400 };
      }
      plan = fresh.data;
    }
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
      if (chk && chk.ok === false) {
        const msg = '查重没查成：' + (chk.message || chk.code || '目标站不可用');
        setTargetResult(item.data, host, { stage: 'failed', error: msg, errorCode: chk.code || 'DEDUPE_FAILED', nextRetryAt: new Date(Date.now() + 15 * 60000).toISOString() });
        saveQueue(item.data);
        return { ok: false, code: chk.code || 'DEDUPE_FAILED', message: msg, http: 502 };
      }
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
    /* 上次提交成功但回查没跟上：先重新回查，找到了就不重复上传 */
    const verifyRule = flow['发布后校验'];
    const shouldVerify = b.verify !== undefined ? !!b.verify : (verifyRule ? verifyRule.on !== false : true);
    let verified = null;
    let reused = false;
    let deletedSee = null;
    const prev = targetResults(item.data)[String(host).toLowerCase()];
    if (!dryRun && shouldVerify && prev && prev.detailsUrl && !prev.verified) {
      for (let i = 0; i < 2 && !reused; i++) {
        if (i) await new Promise(function (r2) { setTimeout(r2, 3000); });
        const v = await target.verify(host, uploadItem, t.buf, {});
        if (v.ok && v.data && v.data.deleted) deletedSee = v.data;
        if (v.ok && v.data && v.data.found) {
          verified = v.data;
          reused = true;
          item.data.targetVerify = Object.assign({}, v.data, { at: now() });
          prev.verified = true;
          prev.stage = 'submitted';
          prev.error = '';
          delete prev.nextRetryAt;
          if (v.data.detailsUrl && !prev.detailsUrl) prev.detailsUrl = v.data.detailsUrl;
          setTargetResult(item.data, host, prev);
        }
      }
    }
    let r;
    if (reused) {
      r = { ok: true, data: { url: '', detailsUrl: prev.detailsUrl || '', infohash: prev.infohash || '', status: 200, message: '已提交过，回查确认存在' } };
    } else {
      r = await target.submit(host, uploadItem, t.buf, { dryRun: dryRun, plan: plan || undefined });
      if (!r.ok) {
        if (!dryRun) {
          setTargetResult(item.data, host, { stage: 'failed', error: r.message || r.code, nextRetryAt: new Date(Date.now() + 15 * 60000).toISOString() });
          if (targetHosts(item.data).length <= 1) stage.fail(item.data, item.data.stage || 'previewed', r.message || r.code);
          saveQueue(item.data);
        }
        return r;
      }
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
      host: host, at: now(), url: r.data.url || '', detailsUrl: r.data.detailsUrl || item.data.targetUpload && item.data.targetUpload.detailsUrl || '',
      infohash: r.data.infohash || (prev && prev.infohash) || '', status: r.data.status || 0, message: r.data.message || '',
      cleaned: cleaned
    };
    /* 回查：详情页 → 搜索，各给 2 次机会，容忍索引延迟 */
    if (shouldVerify && !verified) {
      for (let i = 0; i < 3 && !verified; i++) {
        if (i) await new Promise(function (r2) { setTimeout(r2, 3000); });
        const v = await target.verify(host, uploadItem, t.buf, { url: i === 0 ? (r.data.detailsUrl || undefined) : undefined });
        if (v.ok && v.data && v.data.deleted) deletedSee = v.data;
        if (v.ok && v.data && v.data.found) {
          verified = v.data;
          item.data.targetVerify = Object.assign({}, v.data, { at: now() });
        }
      }
    }
    if (shouldVerify && !verified && deletedSee) {
      const msg = '目标站已有同 infohash 的种子（在回收站），跳过重复上传';
      setTargetResult(item.data, host, { stage: 'skipped', error: msg, verify: deletedSee });
      if (targetHosts(item.data).length <= 1) stage.set(item.data, 'submitted', { evidence: { host: host, skipped: 'recycle_bin' } });
      saveQueue(item.data);
      return { ok: false, skipped: true, code: 'TARGET_EXISTS', message: msg, http: 200, data: { host: host, verify: deletedSee } };
    }
    if (shouldVerify && (!verified || !verified.found)) {
      const msg = '提交返回 200，但回查未找到（可能待审核/索引延迟）';
      const failed = { stage: 'failed', error: msg, nextRetryAt: new Date(Date.now() + 15 * 60000).toISOString(), verify: verified || null, detailsUrl: item.data.targetUpload.detailsUrl || '' };
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
    if (!dryRun && ctx.logEvent) ctx.logEvent('info', '目标站', '真实提交完成 · ' + host + ' · queue ' + item.id + ' · ' + (verified && verified.found ? '回查已找到' : '回查未找到') + (r.data && r.data.detailsUrl ? ' · ' + r.data.detailsUrl : ''));
    return { ok: true, data: Object.assign({}, r.data, { verify: verified, targetResults: item.data.targetResults }) };
  }

  return { upload: upload };
}

module.exports = { makeUpload };
