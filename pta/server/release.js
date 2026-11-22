/* 单 release 准备与阶段推进：纯本地，不发外部请求。
   为 CLI prepare/preview/advance/run 提供同一套逻辑，后续 G7/G8 再扩展提交/注入。 */
const meta = require('./meta');
const mediainfo = require('./mediainfo');
const imagehost = require('./imagehost');
const flowConfig = require('./flow-config');
const { makeQb } = require('./qb');
const { makeTarget } = require('./target');
const stage = require('./stage');
const { tx } = require('./db');

function makeRelease(ctx) {
  const { db, one, all, jparse, DATA_DIR } = ctx;
  const qb = makeQb(DATA_DIR);
  const target = makeTarget(ctx);
  const now = () => new Date().toISOString();
  const STAGES = ['draft', 'prepared', 'previewed', 'submitted', 'injected', 'failed'];

  function load(id) {
    const row = one('SELECT id, status, data FROM queue WHERE id = ?', id);
    return row ? { id: row.id, status: row.status, data: jparse(row.data) || {} } : null;
  }
  function save(item) {
    db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
      .run(item.status || item.data.status || 'pending', JSON.stringify(item.data), now(), item.id);
  }
  function fail(code, message, http) {
    return { ok: false, code: code, message: message, http: http || 400 };
  }
  function targetPlan(item, host) {
    if (!host) return { target: null, error: '' };
    try {
      const p = target.plan(host, item);
      if (p.ok) return { target: p.data, error: '' };
      return { target: null, error: p.message || p.code || '目标站计划失败' };
    } catch (e) {
      return { target: null, error: String(e && e.message || e).slice(0, 200) };
    }
  }
  function torrentOf(body) {
    if (!body || !body.torrentBase64) return { torrent: null, error: '' };
    try {
      const buf = Buffer.from(String(body.torrentBase64), 'base64');
      if (!buf.length) return { torrent: null, error: '种子是空文件' };
      if (buf.length > 10 * 1024 * 1024) return { torrent: null, error: '种子超过 10MB' };
      const t = qb.parseTorrent(buf);
      if (!t || !t.hash) return { torrent: null, error: '种子解析不出 infohash' };
      return { torrent: { hash: t.hash, name: t.name || '', size: buf.length }, error: '' };
    } catch (e) {
      return { torrent: null, error: '种子解析失败' };
    }
  }
  function build(item, body) {
    const b = body || {};
    const names = meta.buildNames(item);
    const flow = flowConfig.read(ctx);
    const titleOn = flowConfig.on(flow, '标题原样回填', true);
    const subOn = flowConfig.on(flow, '副标题拼贴', true);
    let raw = b.targets;
    if (typeof raw === 'string') raw = raw.split(',');
    raw = Array.isArray(raw) ? raw : [];
    const hosts = [];
    raw.concat([b.host], item.targets || [], [item.targetSite]).forEach(function (h) {
      h = String(h || '').trim().toLowerCase();
      if (h && hosts.indexOf(h) < 0) hosts.push(h);
    });
    const tr = torrentOf(b);
    const mediaText = String(b.mediaInfo || b.bdinfo || item.mediaInfo || item.bdinfo || '').trim();
    const media = mediaText ? mediainfo.parse(mediaText) : null;
    let mediaBlock = media && media.kind ? mediainfo.toBBCode(media) : '';
    /* 媒体文本就是从源站简介原样提取的：优先用原 BBCode 整块，避免加标签和空行 */
    if (media && media.kind && mediaBlock) {
      const ex = mediainfo.extractFromBbcode(item.descrBb || item.intro || '');
      const src = ex[media.kind];
      if (src && src.bbcode && String(src.raw).trim() === mediaText.trim()) mediaBlock = String(src.bbcode).trim().slice(0, 20000);
    }
    let description = mediainfo.tidyBbcode(names.description);
    const attachMedia = b.attachMedia !== undefined ? b.attachMedia !== false : flowConfig.on(flow, '自动附加 MediaInfo', true);
    if (mediaBlock && attachMedia) {
      const already = description.indexOf(media.raw) >= 0 ||
        /mediainfo|general\s+information|disc\s+title|complete\s+name|disc\s+size/i.test(description) ||
        /\[(?:quote|code|hide)(?:=[^\]]*)?\][\s\S]*?(?:Disc Title|Complete name)\s*:/i.test(description);
      if (!already) description = (description.trim() + '\n\n' + mediaBlock).slice(0, 60000);
    }
    const imageLinks = (Array.isArray(item.imageLinks) ? item.imageLinks : []).filter(function (x) { return x && x.url; });
    if (flowConfig.on(flow, '简介图片', true) && imageLinks.length) {
      const shots = Array.isArray(item.shots) ? item.shots : [];
      imageLinks.forEach(function (l, i) {
        const shot = shots.filter(function (s) { return s && s.name === l.name; })[0] || shots[i];
        const orig = shot && shot.url;
        if (orig && description.indexOf(orig) >= 0) description = description.split(orig).join(l.url);
      });
      description = imagehost.replaceDescription(description, imageLinks);
    }
    /* 目标站计划必须基于同一份最终简介，否则 prepared 字段和上传字段会对不上 */
    const planItem = Object.assign({}, item, { descrBb: description, intro: description });
    const targets = hosts.map(function (host) {
      const tp = targetPlan(planItem, host);
      return { host: host, target: tp.target, error: tp.error };
    });
    const first = targets[0] || { host: '', target: null, error: '' };
    return {
      at: now(),
      title: titleOn ? String(item.title || names.title) : '',
      releaseTitle: names.releaseTitle,
      subtitle: subOn ? String(item.cn || item.subtitle || names.subtitle) : '',
      description: description,
      parsed: names.parsed,
      media: media && media.kind ? {
        kind: media.kind,
        summary: media.summary,
        flags: media.flags,
        size: media.sizeText || '',
        duration: media.durationText || '',
        video: media.video || null,
        audio: media.audio || [],
        subtitle: media.subtitle || [],
        rawLength: mediaText.length
      } : null,
      mediaError: media && media.error ? media.error : '',
      mediaBbcode: mediaBlock,
      imageHost: item.imageHost || '',
      imageLinks: imageLinks.map(function (x) { return { name: x.name || '', url: x.url }; }),
      targetHost: first.host,
      target: first.target,
      targetError: first.error,
      targets: targets,
      torrent: tr.torrent,
      torrentError: tr.error,
      shots: Array.isArray(item.shots) ? item.shots.length : 0
    };
  }
  function prepareInner(id, body) {
    body = body || {};
    const cur = load(id);
    if (!cur) return fail('NOT_FOUND', '条目不存在', 404);
    const it = cur.data;
    const curStage = String(it.stage || 'draft');
    if (curStage === 'submitted' || curStage === 'injected') {
      return fail('ALREADY_SUBMITTED', '这个条目已经提交/注入，不能重新准备', 409);
    }
    if (typeof body.mediaInfo === 'string' && body.mediaInfo.trim()) it.mediaInfo = body.mediaInfo.slice(0, 200000);
    if (typeof body.bdinfo === 'string' && body.bdinfo.trim()) it.bdinfo = body.bdinfo.slice(0, 200000);
    /* 历史简介里的技术块可能被 HTML 转换插过空行；整理时顺手修掉，正文段落不动 */
    if (it.descrBb) it.descrBb = mediainfo.tidyBbcode(it.descrBb);
    if (it.intro) it.intro = mediainfo.tidyBbcode(it.intro);
    /* 源站简介里自带的 MediaInfo/BDInfo 自动识别；已有完整字段不覆盖，弱字段清掉 */
    const ex = mediainfo.extractFromBbcode(it.descrBb || it.intro || '');
    if (ex.mediainfo && mediainfo.isWeakMedia(it.mediainfo)) it.mediainfo = ex.mediainfo.raw;
    if (ex.bdinfo && mediainfo.isWeakMedia(it.bdinfo)) it.bdinfo = ex.bdinfo.raw;
    if (!ex.mediainfo && mediainfo.isWeakMedia(it.mediainfo)) delete it.mediainfo;
    if (!ex.bdinfo && mediainfo.isWeakMedia(it.bdinfo)) delete it.bdinfo;
    const prepared = build(it, body);
    /* 只写回原始媒体文本；最终简介留在 prepared，避免把图床链接污染回源简介 */
    const mediaText = String(body.mediaInfo || body.bdinfo || it.mediaInfo || it.bdinfo || '').trim();
    if (prepared.media && mediaText) {
      if (prepared.media.kind === 'bdinfo') it.bdinfo = mediaText.slice(0, 200000);
      else it.mediainfo = mediaText.slice(0, 200000);
    }
    it.prepared = prepared;
    it.preparedAt = prepared.at;
    it.targets = (prepared.targets || []).map(function (t) { return t.host }).filter(Boolean);
    if (it.targets.length) it.targetSite = it.targets[0];
    /* failed 保留失败阶段和错误；previewed 不回退；prepare 不计 retry attempts */
    if (curStage !== 'failed') {
      stage.set(it, curStage === 'previewed' ? 'previewed' : 'prepared', {
        countAttempt: false,
        evidence: { host: prepared.targetHost || '', targets: it.targets, shots: prepared.shots || 0, preparedAt: prepared.at }
      });
    }
    save(cur);
    return { ok: true, data: { id: id, stage: 'prepared', prepared: prepared } };
  }
  function previewInner(id) {
    const cur = load(id);
    if (!cur) return fail('NOT_FOUND', '条目不存在', 404);
    const it = cur.data;
    if (!it.prepared) {
      const p = prepareInner(id, {});
      if (!p.ok) return p;
      it.prepared = p.data.prepared;
    }
    it.previewedAt = now();
    stage.set(it, 'previewed', { evidence: { previewedAt: it.previewedAt } });
    save(cur);
    const p = it.prepared || {};
    const payload = {
      title: p.title || '', subtitle: p.subtitle || '', description: p.description || '',
      targetHost: p.targetHost || '', target: p.target || null, targetError: p.targetError || '',
      targets: p.targets || [], shots: p.shots || 0, torrent: p.torrent || null,
      media: p.media || null, mediaBbcode: p.mediaBbcode || '', mediaError: p.mediaError || '',
      imageHost: p.imageHost || '', imageLinks: p.imageLinks || []
    };
    return { ok: true, data: { id: id, stage: 'previewed', prepared: it.prepared, payload: payload } };
  }
  function advanceInner(id, body) {
    const cur = load(id);
    if (!cur) return fail('NOT_FOUND', '条目不存在', 404);
    const it = cur.data;
    stage.ensure(it);
    const curStage = it.stage;
    if (curStage === 'failed') {
      const next = Date.parse(it.stageNextRetryAt || '') || 0;
      if (next > Date.now()) {
        return { ok: true, data: { id: id, stage: 'failed', next: 'wait', nextRetryAt: it.stageNextRetryAt, note: '还没到重试时间' } };
      }
      if (it.stageFailedFrom === 'submitted') {
        return { ok: true, data: { id: id, stage: 'failed', next: 'target-upload', note: '提交失败；用 target-upload 重试，成功后自动标 submitted' } };
      }
      if (it.stageFailedFrom === 'injected') {
        return { ok: true, data: { id: id, stage: 'failed', next: 'publish', note: '注入失败；用 publish 重试，成功后自动标 injected' } };
      }
      /* 重试是一个新周期：attempts 清零，history 追加 draft 后再进 prepare */
      stage.set(it, 'draft', { countAttempt: false, evidence: { retryAt: now() } });
      it.stageAttempts = 0;
      save(cur);
      return prepareInner(id, body);
    }
    if (curStage === 'draft') return prepareInner(id, body);
    if (curStage === 'prepared') return previewInner(id);
    if (curStage === 'previewed') {
      return { ok: true, data: { id: id, stage: curStage, next: 'target-upload / publish', note: '本地准备完成；提交和注入用 target-upload / publish，默认干跑' } };
    }
    if (curStage === 'submitted') {
      return { ok: true, data: { id: id, stage: curStage, next: 'publish', note: '已提交目标站；下一步注入下载器' } };
    }
    if (curStage === 'injected') {
      return { ok: true, data: { id: id, stage: curStage, next: '', note: '已完成' } };
    }
    return fail('BAD_STAGE', '未知阶段：' + curStage);
  }
  /* 读改写放在同一个事务里：prepare/preview/advance 不会互相覆盖 stage/evidence */
  function prepare(id, body) {
    return tx(db, function () { return prepareInner(id, body); });
  }
  function preview(id) {
    return tx(db, function () { return previewInner(id); });
  }
  function advance(id, body) {
    return tx(db, function () { return advanceInner(id, body); });
  }
  function run(body) {
    const b = body || {};
    const stage = String(b.stage || 'prepared');
    if (stage !== 'prepared' && stage !== 'previewed') {
      return fail('BAD_STAGE', 'run 只支持 prepared / previewed');
    }
    const limit = Math.max(1, Math.min(100, Number(b.limit) || 20));
    /* 已发布的旧条目不能占满窗口；先按阶段筛，避免后面的草稿永远轮不到 */
    const candidates = all('SELECT id, status, data FROM queue ORDER BY created_at ASC LIMIT 1000');
    const rows = candidates.filter(function (row) {
      const it = jparse(row.data) || {};
      const cur = it.stage || 'draft';
      return stage === 'prepared' ? (cur === 'draft' || cur === 'failed') : (cur === 'prepared' || cur === 'failed');
    }).slice(0, limit);
    const out = { stage: stage, checked: candidates.length, prepared: 0, previewed: 0, skipped: Math.max(0, candidates.length - rows.length), failed: 0, items: [] };
    rows.forEach(function (row) {
      const it = jparse(row.data) || {};
      const cur = it.stage || 'draft';
      if (stage === 'prepared') {
        if (cur === 'draft' || cur === 'failed') {
          const r = prepare(row.id, b);
          if (r.ok) { out.prepared++; out.items.push({ id: row.id, stage: 'prepared' }); }
          else { out.failed++; out.items.push({ id: row.id, error: r.message }); }
        } else { out.skipped++; }
        return;
      }
      if (stage === 'previewed') {
        if (cur === 'prepared' || cur === 'failed') {
          const r = preview(row.id);
          if (r.ok) { out.previewed++; out.items.push({ id: row.id, stage: 'previewed' }); }
          else { out.failed++; out.items.push({ id: row.id, error: r.message }); }
        } else { out.skipped++; }
      }
    });
    return { ok: true, data: out };
  }
  return { prepare: prepare, preview: preview, advance: advance, run: run, STAGES: STAGES };
}

module.exports = { makeRelease };
