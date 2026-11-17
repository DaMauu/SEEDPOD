/* 目标站服务公共段：源标题回填、权威种抓取、查重策略。 */
const fs = require('fs');
const path = require('path');
const flowConfig = require('./flow-config');
const { dupeDecision, dedupeSwitchOn } = require('./target-rules');

function makeServiceCommon(deps) {
  const target = deps.target;
  const ctx = deps.ctx;
  const DATA_DIR = deps.DATA_DIR;
  const now = deps.now;
  const saveQueue = deps.saveQueue;
  const preparedItem = deps.preparedItem;

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

  async function fetchPublished(host, itemData) {
    const tr = ((itemData.targetResults || {})[host]) || {};
    if (tr.publishedTorrent) return { ok: true, data: tr.publishedTorrent, cached: true };
    const detailsUrl = tr.detailsUrl || (itemData.targetUpload && itemData.targetUpload.detailsUrl) || '';
    if (!detailsUrl) return { ok: false, code: 'NO_DETAILS_URL', message: '没有目标站详情地址' };
    const tt = await target.fetchDetailsTorrent(host, detailsUrl);
    if (!tt.ok) return tt;
    try {
      const dir = path.join(DATA_DIR, 'torrents');
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const safeHost = String(host).replace(/[^a-z0-9.-]/gi, '_');
      const file = path.join(dir, safeHost + '-' + tt.data.meta.hash + '.published.torrent');
      fs.writeFileSync(file, tt.data.buf, { mode: 0o600 });
      const rec = {
        host: host, infohash: tt.data.meta.hash, size: tt.data.buf.length, path: file,
        sameInfohash: tt.data.meta.hash === String(tr.infohash || ''), source: 'published'
      };
      tr.publishedTorrent = rec;
      tr.targetTorrent = rec;
      tr.publishedTorrentError = '';
      tr.targetTorrentError = '';
      itemData.targetResults = itemData.targetResults || {};
      itemData.targetResults[host] = tr;
      saveQueue(itemData);
      return { ok: true, data: rec };
    } catch (e) {
      return { ok: false, code: 'SAVE_FAILED', message: '目标站发布种子保存失败' };
    }
  }

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
    /* 开关语义：原盘/禁转开关开=跳过，DIY 开关开=仍可发；其余重复一律跳过 */
    const ruleRestrict = dedupeSwitchOn(flowCfg, '禁转/限转处理', true);
    const ruleDiy = dedupeSwitchOn(flowCfg, '目标站只有 DIY', true);
    const ruleFull = dedupeSwitchOn(flowCfg, '目标站已有原盘', true);
    const kind = isDiy ? 'diy' : (isFullDisc ? 'full_disc' : (isRemux ? 'remux' : 'other'));
    const skip = dupeDecision(kind, restricted, { restrict: ruleRestrict, diy: ruleDiy, full: ruleFull });
    return { found: true, skip: skip, kind: kind, title: foundTitle.slice(0, 200), verify: pre.data, restricted: restricted };
  }

  return { fillSourceTitle, fetchPublished, checkDupe };
}

module.exports = { makeServiceCommon };
