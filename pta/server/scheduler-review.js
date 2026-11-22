/* 终审阶段：补齐、查缺、判定 ready/hold，写入 review 状态。 */
const flowConfig = require('./flow-config');
function makeReviewPhase(deps) {
  const siteStore = deps.DATA_DIR ? require('./src/features/sites/store')(deps.DATA_DIR) : null;
  const { one, all, jparse, target, targetService, metaFill, release } = deps;
  return async function runReviewPhase(o) {
    const { want, batch, ctx } = o;
      const flow = flowConfig.read(ctx);
      const titleOn = flowConfig.on(flow, '标题原样回填', true);
      const subOn = flowConfig.on(flow, '副标题拼贴', true);
      const introOn = flowConfig.on(flow, '简介回填', true);
      const needIntro = flowConfig.on(flow, '必须有简介', true);
      const needSub = flowConfig.on(flow, '必须有副标题', true);
      const bdOn = flowConfig.onLegacy(flow, 'BDInfo', true, function (v) { return String(v) === '不要求' ? false : true; });
      const shotOn = flowConfig.onLegacy(flow, '截图至少几张', true, function (v) { return Number(v) > 0; });
      const yearOn = flowConfig.on(flow, '年份必须一致', true);
      const reviewRows = want('review') ? all("SELECT id, status, data FROM queue WHERE status = 'pending' ORDER BY updated_at ASC LIMIT " + batch) : [];
      const review = { checked: reviewRows.length, ready: 0, hold: 0, skipped: 0, reasons: [], skippedStep: !want('review'), filled: 0, detailFetched: 0 };
      let fillTries = 0, detailTries = 0;
      for (const row of reviewRows) {
        const pre = jparse(row.data) || {};
        /* 缺源站 BBCode 简介：回源站详情页取一次，每轮最多 2 条、间隔 6 秒 */
        if (!String(pre.descrBb || '').trim() && pre.detailsUrl && pre.site && detailTries < 2) {
          const rec = siteStore ? siteStore.get(pre.site) : null;
          if (!rec || (rec.settings.enabled !== false && rec.settings.hidden !== true)) {
            if (detailTries > 0) await new Promise(function (r) { setTimeout(r, 6000); });
            detailTries++;
            let di = null;
            try { di = await target.fetchDetailsInfo(pre.site, pre.detailsUrl); } catch (e) { di = null; }
            if (di && di.ok && di.data) {
              const dd = di.data;
              if (dd.descrBb) { pre.descrBb = dd.descrBb; pre.intro = dd.descrBb; }
              if (dd.descr) pre.descr = dd.descr;
              if (dd.subtitle && !pre.subtitle) pre.subtitle = dd.subtitle;
              if (dd.tags && !pre.tags) pre.tags = dd.tags;
              if (dd.region && !pre.region) pre.region = dd.region;
              if (dd.language && !pre.language) pre.language = dd.language;
              if (dd.bdinfo) pre.bdinfo = dd.bdinfo;
              if (dd.mediainfo) pre.mediainfo = dd.mediainfo;
              if (dd.sizeBytes && !pre.sizeBytes) { pre.sizeBytes = dd.sizeBytes; pre.size = dd.sizeText || pre.size; }
              pre.detailAt = new Date().toISOString();
              review.detailFetched++;
              ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
                .run(JSON.stringify(pre), new Date().toISOString(), row.id);
            }
          }
        }
        /* 副标题/简介开关打开时，统一从豆影拉一次；每轮最多 5 条 */
        if ((subOn || introOn) && !pre.metaAt && fillTries < 5) {
          fillTries++;
          const fr = await metaFill.fillMeta(pre);
          if (fr.ok) {
            review.filled++;
            delete pre.metaLastError;
            delete pre.metaLastErrorCode;
            delete pre.metaNextRetryAt;
            ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
              .run(JSON.stringify(pre), new Date().toISOString(), row.id);
          } else if (fr.code !== 'RULE_OFF') {
            pre.metaAttempts = (Number(pre.metaAttempts) || 0) + 1;
            pre.metaLastAttemptAt = new Date().toISOString();
            pre.metaLastErrorCode = String(fr.code || 'UNKNOWN');
            pre.metaLastError = String(fr.code || 'META_FAILED');
            pre.metaNextRetryAt = new Date(Date.now() + 15 * 60000).toISOString();
            ctx.db.prepare('UPDATE queue SET data = ?, updated_at = ? WHERE id = ?')
              .run(JSON.stringify(pre), new Date().toISOString(), row.id);
          }
        }
        if (pre.downloadUrl && !pre.sourceTitleAt) {
          const ft = await targetService.fillSourceTitle(pre);
          if (ft.ok) {
            ctx.db.prepare('UPDATE queue SET title = ?, data = ?, updated_at = ? WHERE id = ?')
              .run(ft.title, JSON.stringify(pre), new Date().toISOString(), row.id);
          }
        }
        const prep = release ? release.prepare(row.id, {}) : { ok: false };
        const cur = one('SELECT status, data FROM queue WHERE id = ?', row.id);
        const d = jparse(cur ? cur.data : row.data) || {};
        const p = (d.prepared) || {};
        const missing = [];
        if (!d.dupePassedAt) missing.push('查重未完成');
        if (!titleOn || !String(d.title || '').trim()) missing.push('标题');
        if (!subOn || !String(d.cn || d.subtitle || '').trim()) missing.push('副标题');
        if (needIntro && !String(d.intro || d.descrBb || '').trim()) missing.push('简介');
        if (needSub && !String(d.cn || d.subtitle || '').trim() && missing.indexOf('副标题') < 0) missing.push('副标题');
        if (bdOn && !(p.media && p.media.kind)) missing.push('BDInfo');
        if (shotOn) {
          const srcImgs = Array.isArray(d.sourceImages) ? d.sourceImages : [];
          const text = String(d.descrBb || d.intro || '');
          if (srcImgs.some(function (u) { return text.indexOf(u) < 0; })) missing.push('截图未保留');
        }
        if (yearOn && d.year && d.meta && d.meta.year && Number(d.meta.year) > Number(d.year) + 2) missing.push('年份不一致');
        const t0 = (p.targets || [])[0] || null;
        if (!t0 || !t0.target) missing.push('目标站未就绪');
        else {
          if (!t0.target.fields || !t0.target.fields.type) missing.push('分类映射');
          if (t0.target.ready === false) missing.push('目标站未就绪');
        }
        d.review = { at: new Date().toISOString(), ok: missing.length === 0, missing: missing };
        let status = cur ? cur.status : row.status;
        if (!missing.length) {
          review.ready++;
          if (ctx.allowReal('realPublish')) status = 'approved';
        } else {
          review.hold++;
          if (review.reasons.length < 5) review.reasons.push({ id: row.id, missing: missing });
        }
        d.status = status;
        ctx.db.prepare('UPDATE queue SET status = ?, data = ?, updated_at = ? WHERE id = ?')
          .run(status, JSON.stringify(d), new Date().toISOString(), row.id);
      }
    return review;
  };
}

module.exports = { makeReviewPhase };
